import { fork } from 'node:child_process';
import { PythonParserError } from '../../dist/author/python-parser.js';
import { createParserClient } from './client.js';
/** Author-only local process; no learner API imports this module. */
export function createNodePythonParser() {
    return createParserClient((reply, failed) => {
        const child = fork(new URL('./node-worker.js', import.meta.url), [], { execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
        child.on('message', (value) => reply(value));
        child.on('error', () => failed(new PythonParserError('runtime_error', 'A Python parserfolyamat nem indult el.')));
        child.on('exit', () => failed(new PythonParserError('runtime_error', 'A Python parserfolyamat leállt.')));
        return { send: request => { child.send(request); }, terminate: () => { child.kill(); } };
    });
}
//# sourceMappingURL=node-parser.js.map