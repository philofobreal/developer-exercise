import {isPythonRequest, isRecord} from '../../dist/author/python-parser.js';
import {createAuditRuntime, type PyodideLoader} from './runtime.js';
import {failureReply} from './worker-protocol.js';

// Runtime URL is fixed by this module; source text can never select a module/package.
async function loadRuntime(): ReturnType<typeof createAuditRuntime> {
 const indexURL = new URL('../../vendor/python/', import.meta.url).href;
 const module: unknown = await import(new URL('pyodide.mjs', indexURL).href);
 if (!isRecord(module) || typeof module.loadPyodide !== 'function') throw Error('Hiányzó helyi Pyodide loader.');
 return createAuditRuntime(module.loadPyodide as PyodideLoader, indexURL);
}
const runtime = loadRuntime();
const port = globalThis as unknown as {onmessage: ((event: MessageEvent<unknown>) => void) | null; postMessage(value: unknown): void; close(): void};
port.onmessage = event => {
 const request: unknown = event.data;
 if (!isPythonRequest(request)) { port.close(); return; }
 void runtime.then(audit => audit(request)).catch(error => failureReply(request, error)).then(reply => port.postMessage(reply));
};
void runtime.catch(() => {});
