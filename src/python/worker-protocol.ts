import {PythonParserError, type PythonReply, type PythonRequest} from '../../dist/author/python-parser.js';
export function failureReply(request: PythonRequest, error: unknown): PythonReply {
 return {protocolVersion: 1, requestId: request.requestId, ok: false, error: {
  code: error instanceof PythonParserError ? error.code : 'runtime_error',
  message: error instanceof Error ? error.message.slice(0, 1800) : 'A Python parser hibát jelzett.',
  ...(error instanceof PythonParserError && error.position ? {position: error.position} : {})
 }};
}
