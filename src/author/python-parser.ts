/** Author-only parser protocol. Coordinates deliberately retain their native units. */
export const PYODIDE_VERSION = '314.0.7';
export const PYTHON_VERSION = '3.14.2';
export const PYTHON_GRAMMAR = '3.14';
export interface PythonPosition { line: number; column: number; }
export interface PythonAstNode { kind: string; fields: Record<string, PythonAstValue>; start: PythonPosition | null; end: PythonPosition | null; }
export type PythonAstValue = PythonAstNode | PythonAstValue[] | string | boolean | null | { literalType: string; value: string };
export interface PythonToken { kind: string; exactKind: string; text: string; start: PythonPosition; end: PythonPosition; }
export interface PythonBindingScope { id: string; parentId: string | null; kind: string; name: string; line: number; symbols: { name: string; flags: string[] }[]; }
export interface PythonAudit {
 protocolVersion: 1; grammarVersion: '3.14'; runtimeVersion: '3.14.2'; source: string;
 tree: PythonAstNode; tokens: PythonToken[]; scopes: PythonBindingScope[];
}
export type PythonErrorCode = 'syntax_error' | 'resource_limit' | 'runtime_error' | 'invalid_protocol' | 'aborted' | 'timeout' | 'closed';
export class PythonParserError extends Error {
 constructor(public readonly code: PythonErrorCode, message: string, public readonly position?: PythonPosition) { super(message); this.name = 'PythonParserError'; }
}
export interface PythonAuditOptions { signal?: AbortSignal; timeoutMs?: number; }
export interface PythonParser { audit(source: string, options?: PythonAuditOptions): Promise<PythonAudit>; close(): void; }
export interface PythonRequest { protocolVersion: 1; requestId: number; grammarVersion: '3.14'; source: string; }
export type PythonReply = { protocolVersion: 1; requestId: number; ok: true; audit: PythonAudit } | { protocolVersion: 1; requestId: number; ok: false; error: { code: PythonErrorCode; message: string; position?: PythonPosition } };

export function normalizePythonSource(source: string): string {
 if (typeof source !== 'string' || source.length > 50_000 || /[\u2028\u2029\0]/.test(source) || Array.from(source).some(character => character.length === 1 && character.charCodeAt(0) >= 0xd800 && character.charCodeAt(0) <= 0xdfff)) throw new PythonParserError('resource_limit', 'Hiányzó, túl hosszú vagy nem támogatott Python forrás.');
 const normalized = source.replace(/\r\n?/g, '\n'), rows = normalized.split('\n');
 if (rows.length - (normalized.endsWith('\n') ? 1 : 0) > 500 || rows.some(row => Array.from(row).length > 2048)) throw new PythonParserError('resource_limit', 'Legfeljebb 500 fizikai sor és soronként 2048 karakter támogatott.');
 return normalized;
}
export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
const text = (value: unknown, max = 50_000): value is string => typeof value === 'string' && value.length <= max;
const integer = (value: unknown, min = 0, max = 1_000_000): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
function position(value: unknown): value is PythonPosition { return isRecord(value) && integer(value.line, 1, 501) && integer(value.column, 0, 100_000); }
const nullablePosition = (value: unknown): boolean => value === null || position(value);

/** Validate the untrusted IPC/JSON boundary before handing DTOs to an author adapter. */
export function decodePythonAudit(value: unknown, source: string): PythonAudit {
 const fail = (): never => { throw new PythonParserError('invalid_protocol', 'Hibás vagy inkompatibilis Python parser DTO.'); };
 if (!isRecord(value) || value.protocolVersion !== 1 || value.grammarVersion !== PYTHON_GRAMMAR || value.runtimeVersion !== PYTHON_VERSION || value.source !== source || !Array.isArray(value.tokens) || value.tokens.length > 50_000 || !Array.isArray(value.scopes) || value.scopes.length > 500) return fail();
 let nodes = 0;
 function ast(item: unknown, depth = 0): boolean {
  if (++nodes > 50_000 || depth > 200) return false;
  if (item === null || typeof item === 'boolean' || text(item)) return true;
  if (Array.isArray(item)) return item.length <= 20_000 && item.every(child => ast(child, depth + 1));
  if (!isRecord(item)) return false;
  if (typeof item.literalType === 'string' && ['int', 'float', 'complex', 'bytes', 'ellipsis'].includes(item.literalType) && text(item.value) && item.kind === undefined) return true;
  return text(item.kind, 100) && isRecord(item.fields) && Object.keys(item.fields).length < 100 && nullablePosition(item.start) && nullablePosition(item.end) && Object.values(item.fields).every(child => ast(child, depth + 1));
 }
 if (!isRecord(value.tree) || value.tree.kind !== 'Module' || !ast(value.tree)) return fail();
 for (const token of value.tokens) if (!isRecord(token) || !text(token.kind, 100) || !text(token.exactKind, 100) || !text(token.text) || !position(token.start) || !position(token.end)) return fail();
 const scopeIds = new Set<string>();
 for (const scope of value.scopes) {
  if (!isRecord(scope) || !text(scope.id, 200) || !scope.id || scopeIds.has(scope.id) || !(scopeIds.size === 0 ? scope.parentId === null && scope.kind === 'module' : typeof scope.parentId === 'string' && scopeIds.has(scope.parentId)) || !text(scope.kind, 100) || !text(scope.name) || !integer(scope.line, 0, 500) || !Array.isArray(scope.symbols) || scope.symbols.length > 20_000 || scope.symbols.some(symbol => !isRecord(symbol) || !text(symbol.name) || !Array.isArray(symbol.flags) || symbol.flags.length > 20 || symbol.flags.some(flag => !text(flag, 40)))) return fail();
  scopeIds.add(scope.id);
 }
 if (!scopeIds.size) return fail();
 return value as unknown as PythonAudit;
}

export function decodePythonReply(value: unknown, request: PythonRequest): PythonAudit {
 if (!isRecord(value) || value.protocolVersion !== 1 || value.requestId !== request.requestId) throw new PythonParserError('invalid_protocol', 'A Python-válasz nem a kért művelethez tartozik.');
 if (value.ok === true) return decodePythonAudit(value.audit, request.source);
 const codes: readonly string[] = ['syntax_error', 'resource_limit', 'runtime_error', 'invalid_protocol', 'aborted', 'timeout', 'closed'];
 if (value.ok !== false || !isRecord(value.error) || typeof value.error.code !== 'string' || !codes.includes(value.error.code) || !text(value.error.message, 2000) || (value.error.position !== undefined && !position(value.error.position))) throw new PythonParserError('invalid_protocol', 'Hibás Python-hibaválasz.');
 throw new PythonParserError(value.error.code as PythonErrorCode, value.error.message, value.error.position as PythonPosition | undefined);
}

export function isPythonRequest(value: unknown): value is PythonRequest {
 if (!isRecord(value) || value.protocolVersion !== 1 || value.grammarVersion !== PYTHON_GRAMMAR || !integer(value.requestId, 1) || typeof value.source !== 'string') return false;
 try { return normalizePythonSource(value.source) === value.source; } catch { return false; }
}
