import { dirname } from 'node:path';
import { createRequire } from 'node:module';
import { loadPyodide } from 'pyodide';
import { isPythonRequest } from '../../dist/author/python-parser.js';
import { createAuditRuntime } from './runtime.js';
import { failureReply } from './worker-protocol.js';
const runtime = createAuditRuntime(loadPyodide, dirname(createRequire(import.meta.url).resolve('pyodide')) + '/');
process.on('message', (request) => {
    if (!isPythonRequest(request)) {
        process.exitCode = 1;
        process.disconnect();
        return;
    }
    void runtime.then(audit => audit(request)).catch(error => failureReply(request, error)).then(reply => { if (process.connected)
        process.send?.(reply); });
});
// Initialization failures are reported to the first request, without an unhandled rejection.
void runtime.catch(() => { });
//# sourceMappingURL=node-worker.js.map