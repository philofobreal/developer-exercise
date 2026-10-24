import { isPythonRequest, isRecord } from '../../dist/author/python-parser.js';
import { createAuditRuntime } from './runtime.js';
import { failureReply } from './worker-protocol.js';
// Runtime URL is fixed by this module; source text can never select a module/package.
async function loadRuntime() {
    const indexURL = new URL('../../vendor/python/', import.meta.url).href;
    const module = await import(new URL('pyodide.mjs', indexURL).href);
    if (!isRecord(module) || typeof module.loadPyodide !== 'function')
        throw Error('Hiányzó helyi Pyodide loader.');
    return createAuditRuntime(module.loadPyodide, indexURL);
}
const runtime = loadRuntime();
const port = globalThis;
port.onmessage = event => {
    const request = event.data;
    if (!isPythonRequest(request)) {
        port.close();
        return;
    }
    void runtime.then(audit => audit(request)).catch(error => failureReply(request, error)).then(reply => port.postMessage(reply));
};
void runtime.catch(() => { });
//# sourceMappingURL=browser-worker.js.map