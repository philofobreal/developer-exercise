/** Author-only parser protocol. Coordinates deliberately retain their native units. */
export declare const PYODIDE_VERSION = "314.0.7";
export declare const PYTHON_VERSION = "3.14.2";
export declare const PYTHON_GRAMMAR = "3.14";
export interface PythonPosition {
    line: number;
    column: number;
}
export interface PythonAstNode {
    kind: string;
    fields: Record<string, PythonAstValue>;
    start: PythonPosition | null;
    end: PythonPosition | null;
}
export type PythonAstValue = PythonAstNode | PythonAstValue[] | string | boolean | null | {
    literalType: string;
    value: string;
};
export interface PythonToken {
    kind: string;
    exactKind: string;
    text: string;
    start: PythonPosition;
    end: PythonPosition;
}
export interface PythonBindingScope {
    id: string;
    parentId: string | null;
    kind: string;
    name: string;
    line: number;
    symbols: {
        name: string;
        flags: string[];
    }[];
}
export interface PythonAudit {
    protocolVersion: 1;
    grammarVersion: '3.14';
    runtimeVersion: '3.14.2';
    source: string;
    tree: PythonAstNode;
    tokens: PythonToken[];
    scopes: PythonBindingScope[];
}
export type PythonErrorCode = 'syntax_error' | 'resource_limit' | 'runtime_error' | 'invalid_protocol' | 'aborted' | 'timeout' | 'closed';
export declare class PythonParserError extends Error {
    readonly code: PythonErrorCode;
    readonly position?: PythonPosition | undefined;
    constructor(code: PythonErrorCode, message: string, position?: PythonPosition | undefined);
}
export interface PythonAuditOptions {
    signal?: AbortSignal;
    timeoutMs?: number;
}
export interface PythonParser {
    audit(source: string, options?: PythonAuditOptions): Promise<PythonAudit>;
    close(): void;
}
export interface PythonRequest {
    protocolVersion: 1;
    requestId: number;
    grammarVersion: '3.14';
    source: string;
}
export type PythonReply = {
    protocolVersion: 1;
    requestId: number;
    ok: true;
    audit: PythonAudit;
} | {
    protocolVersion: 1;
    requestId: number;
    ok: false;
    error: {
        code: PythonErrorCode;
        message: string;
        position?: PythonPosition;
    };
};
export declare function normalizePythonSource(source: string): string;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
/** Validate the untrusted IPC/JSON boundary before handing DTOs to an author adapter. */
export declare function decodePythonAudit(value: unknown, source: string): PythonAudit;
export declare function decodePythonReply(value: unknown, request: PythonRequest): PythonAudit;
export declare function isPythonRequest(value: unknown): value is PythonRequest;
