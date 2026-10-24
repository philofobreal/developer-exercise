import {decodePythonReply, isRecord, normalizePythonSource, PYTHON_GRAMMAR, PythonParserError, type PythonAudit, type PythonAuditOptions, type PythonParser, type PythonRequest} from '../../dist/author/python-parser.js';

export interface ParserTransport { send(request: PythonRequest): void; terminate(): void; }
export type TransportFactory = (reply: (value: unknown) => void, failed: (error: Error) => void) => ParserTransport;
interface Pending { request: PythonRequest; resolve(value: PythonAudit): void; reject(error: Error): void; cleanup(): void; }

/** Owns deadlines, response identity and process lifetime, independent of the host API. */
export function createParserClient(connect: TransportFactory): PythonParser {
 let transport: ParserTransport | undefined, sequence = 0, generation = 0, closed = false;
 const pending = new Map<number, Pending>();
 function reset(error: Error): void {
  generation++;
  const old = transport; transport = undefined;
  for (const item of pending.values()) { item.cleanup(); item.reject(error); }
  pending.clear(); old?.terminate();
 }
 function receive(value: unknown): void {
  if (!isRecord(value) || typeof value.requestId !== 'number' || !pending.has(value.requestId)) {
   reset(new PythonParserError('invalid_protocol', 'Ismeretlen Python-válaszazonosító.')); return;
  }
  const item = pending.get(value.requestId)!;
  try {
   const audit = decodePythonReply(value, item.request);
   pending.delete(value.requestId); item.cleanup(); item.resolve(audit);
  } catch (error) {
   if (error instanceof PythonParserError && error.code !== 'invalid_protocol') {
    pending.delete(value.requestId); item.cleanup(); item.reject(error);
   } else reset(error instanceof Error ? error : new PythonParserError('invalid_protocol', 'Hibás parserprotokoll.'));
  }
 }
 return {
  audit(source: string, options: PythonAuditOptions = {}): Promise<PythonAudit> {
   return new Promise((resolve, reject) => {
    if (closed) throw new PythonParserError('closed', 'A Python parser bezárt.');
    const normalized = normalizePythonSource(source), timeout = options.timeoutMs ?? 15_000;
    if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60_000) throw new PythonParserError('resource_limit', 'Érvénytelen parser-határidő (1–60000 ms).');
    if (options.signal?.aborted) throw new PythonParserError('aborted', 'A Python audit megszakadt.');
    if (pending.size >= 8 || sequence >= 1_000_000) throw new PythonParserError('resource_limit', 'A parser kérésszámkerete elfogyott.');
    const request: PythonRequest = {protocolVersion: 1, requestId: ++sequence, grammarVersion: PYTHON_GRAMMAR, source: normalized};
    const abort = (): void => reset(new PythonParserError('aborted', 'A Python audit megszakadt.'));
    const timer = setTimeout(() => reset(new PythonParserError('timeout', 'A Python audit határideje lejárt.')), timeout);
    const cleanup = (): void => { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); };
    pending.set(request.requestId, {request, resolve, reject, cleanup});
    options.signal?.addEventListener('abort', abort, {once: true});
    try {
     if (!transport) {
      const current = ++generation;
      const opened = connect(value => { if (current === generation) receive(value); }, error => { if (current === generation) reset(error); });
      if (current !== generation) { opened.terminate(); return; }
      transport = opened;
     }
     transport.send(request);
    } catch (error) { reset(error instanceof Error ? error : new PythonParserError('runtime_error', 'A parser nem indult el.')); }
   });
  },
  close(): void { closed = true; reset(new PythonParserError('closed', 'A Python parser bezárt.')); }
 };
}
