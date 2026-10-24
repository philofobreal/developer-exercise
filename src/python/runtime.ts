import {decodePythonAudit, decodePythonReply, isRecord, PYODIDE_VERSION, PythonParserError, type PythonRequest, type PythonReply} from '../../dist/author/python-parser.js';
import {PYTHON_AUDIT_BOOTSTRAP} from './audit-script.js';
export type PyodideLoader = (options: { indexURL: string; stdout: (text: string) => void; stderr: (text: string) => void }) => Promise<unknown>;

/** Loader/AST implementation is confined to author workers; never a learner evaluation API. */
export async function createAuditRuntime(load: PyodideLoader, indexURL: string): Promise<(request: PythonRequest) => PythonReply> {
 const runtime = await load({indexURL, stdout: () => {}, stderr: () => {}});
 if (!isRecord(runtime) || runtime.version !== PYODIDE_VERSION || typeof runtime.runPython !== 'function' || !isRecord(runtime.globals) || typeof runtime.globals.get !== 'function') throw new PythonParserError('runtime_error', 'Eltérő vagy hibás Pyodide runtime.');
 runtime.runPython(PYTHON_AUDIT_BOOTSTRAP);
 const audit: unknown = runtime.globals.get('_ng_audit');
 if (typeof audit !== 'function') throw new PythonParserError('runtime_error', 'A rögzített Python auditfüggvény nem érhető el.');
 return request => {
  const raw: unknown = audit(request.source);
  if (typeof raw !== 'string') throw new PythonParserError('invalid_protocol', 'Érvénytelen Python DTO-típus.');
  if (raw.length > 8_000_000) throw new PythonParserError('resource_limit', 'A Python elemzés DTO-méretkerete elfogyott.');
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new PythonParserError('invalid_protocol', 'A Python auditválasz nem érvényes JSON.'); }
  if (!isRecord(value)) throw new PythonParserError('invalid_protocol', 'Hiányzó Python auditválasz.');
  if (value.ok === true) return {protocolVersion: 1, requestId: request.requestId, ok: true, audit: decodePythonAudit(value.audit, request.source)};
  // Reuse the port's error decoder instead of trusting a Python JSON assertion.
  decodePythonReply({protocolVersion: 1, requestId: request.requestId, ok: value.ok, error: value.error}, request);
  throw new PythonParserError('invalid_protocol', 'Hiányzó Python auditválasz.');
 };
}
