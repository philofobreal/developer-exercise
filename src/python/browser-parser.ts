import {PythonParserError, type PythonParser} from '../../dist/author/python-parser.js';
import {createParserClient} from './client.js';

export function createBrowserPythonParser(): PythonParser {
 return createParserClient((reply, failed) => {
  const worker = new Worker(new URL('./browser-worker.js', import.meta.url), {type: 'module'});
  worker.onmessage = (event: MessageEvent<unknown>) => reply(event.data);
  worker.onerror = event => { event.preventDefault(); failed(new PythonParserError('runtime_error', 'A Python parser worker nem indult el.')); };
  worker.onmessageerror = () => failed(new PythonParserError('invalid_protocol', 'A worker üzenete nem olvasható.'));
  return {send: request => worker.postMessage(request), terminate: () => worker.terminate()};
 });
}
