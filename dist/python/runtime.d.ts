import { type PythonRequest, type PythonReply } from '../../dist/author/python-parser.js';
export type PyodideLoader = (options: {
    indexURL: string;
    stdout: (text: string) => void;
    stderr: (text: string) => void;
}) => Promise<unknown>;
/** Loader/AST implementation is confined to author workers; never a learner evaluation API. */
export declare function createAuditRuntime(load: PyodideLoader, indexURL: string): Promise<(request: PythonRequest) => PythonReply>;
