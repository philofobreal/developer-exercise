import { type PythonParser, type PythonRequest } from '../../dist/author/python-parser.js';
export interface ParserTransport {
    send(request: PythonRequest): void;
    terminate(): void;
}
export type TransportFactory = (reply: (value: unknown) => void, failed: (error: Error) => void) => ParserTransport;
/** Owns deadlines, response identity and process lifetime, independent of the host API. */
export declare function createParserClient(connect: TransportFactory): PythonParser;
