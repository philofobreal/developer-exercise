/** Author-only parser protocol. Coordinates deliberately retain their native units. */
export const PYODIDE_VERSION = '314.0.7';
export const PYTHON_VERSION = '3.14.2';
export const PYTHON_GRAMMAR = '3.14';
export class PythonParserError extends Error {
    code;
    position;
    constructor(code, message, position) {
        super(message);
        this.code = code;
        this.position = position;
        this.name = 'PythonParserError';
    }
}
export function normalizePythonSource(source) {
    if (typeof source !== 'string' || source.length > 50_000 || /[\u2028\u2029\0]/.test(source) || Array.from(source).some(character => character.length === 1 && character.charCodeAt(0) >= 0xd800 && character.charCodeAt(0) <= 0xdfff))
        throw new PythonParserError('resource_limit', 'Hiányzó, túl hosszú vagy nem támogatott Python forrás.');
    const normalized = source.replace(/\r\n?/g, '\n'), rows = normalized.split('\n');
    if (rows.length - (normalized.endsWith('\n') ? 1 : 0) > 500 || rows.some(row => Array.from(row).length > 2048))
        throw new PythonParserError('resource_limit', 'Legfeljebb 500 fizikai sor és soronként 2048 karakter támogatott.');
    return normalized;
}
export function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
const text = (value, max = 50_000) => typeof value === 'string' && value.length <= max;
const integer = (value, min = 0, max = 1_000_000) => Number.isSafeInteger(value) && value >= min && value <= max;
function position(value) { return isRecord(value) && integer(value.line, 1, 501) && integer(value.column, 0, 100_000); }
const nullablePosition = (value) => value === null || position(value);
/** Validate the untrusted IPC/JSON boundary before handing DTOs to an author adapter. */
export function decodePythonAudit(value, source) {
    const fail = () => { throw new PythonParserError('invalid_protocol', 'Hibás vagy inkompatibilis Python parser DTO.'); };
    if (!isRecord(value) || value.protocolVersion !== 1 || value.grammarVersion !== PYTHON_GRAMMAR || value.runtimeVersion !== PYTHON_VERSION || value.source !== source || !Array.isArray(value.tokens) || value.tokens.length > 50_000 || !Array.isArray(value.scopes) || value.scopes.length > 500)
        return fail();
    let nodes = 0;
    function ast(item, depth = 0) {
        if (++nodes > 50_000 || depth > 200)
            return false;
        if (item === null || typeof item === 'boolean' || text(item))
            return true;
        if (Array.isArray(item))
            return item.length <= 20_000 && item.every(child => ast(child, depth + 1));
        if (!isRecord(item))
            return false;
        if (typeof item.literalType === 'string' && ['int', 'float', 'complex', 'bytes', 'ellipsis'].includes(item.literalType) && text(item.value) && item.kind === undefined)
            return true;
        return text(item.kind, 100) && isRecord(item.fields) && Object.keys(item.fields).length < 100 && nullablePosition(item.start) && nullablePosition(item.end) && Object.values(item.fields).every(child => ast(child, depth + 1));
    }
    if (!isRecord(value.tree) || value.tree.kind !== 'Module' || !ast(value.tree))
        return fail();
    for (const token of value.tokens)
        if (!isRecord(token) || !text(token.kind, 100) || !text(token.exactKind, 100) || !text(token.text) || !position(token.start) || !position(token.end))
            return fail();
    const scopeIds = new Set();
    for (const scope of value.scopes) {
        if (!isRecord(scope) || !text(scope.id, 200) || !scope.id || scopeIds.has(scope.id) || !(scopeIds.size === 0 ? scope.parentId === null && scope.kind === 'module' : typeof scope.parentId === 'string' && scopeIds.has(scope.parentId)) || !text(scope.kind, 100) || !text(scope.name) || !integer(scope.line, 0, 500) || !Array.isArray(scope.symbols) || scope.symbols.length > 20_000 || scope.symbols.some(symbol => !isRecord(symbol) || !text(symbol.name) || !Array.isArray(symbol.flags) || symbol.flags.length > 20 || symbol.flags.some(flag => !text(flag, 40))))
            return fail();
        scopeIds.add(scope.id);
    }
    if (!scopeIds.size)
        return fail();
    return value;
}
export function decodePythonReply(value, request) {
    if (!isRecord(value) || value.protocolVersion !== 1 || value.requestId !== request.requestId)
        throw new PythonParserError('invalid_protocol', 'A Python-válasz nem a kért művelethez tartozik.');
    if (value.ok === true)
        return decodePythonAudit(value.audit, request.source);
    const codes = ['syntax_error', 'resource_limit', 'runtime_error', 'invalid_protocol', 'aborted', 'timeout', 'closed'];
    if (value.ok !== false || !isRecord(value.error) || typeof value.error.code !== 'string' || !codes.includes(value.error.code) || !text(value.error.message, 2000) || (value.error.position !== undefined && !position(value.error.position)))
        throw new PythonParserError('invalid_protocol', 'Hibás Python-hibaválasz.');
    throw new PythonParserError(value.error.code, value.error.message, value.error.position);
}
export function isPythonRequest(value) {
    if (!isRecord(value) || value.protocolVersion !== 1 || value.grammarVersion !== PYTHON_GRAMMAR || !integer(value.requestId, 1) || typeof value.source !== 'string')
        return false;
    try {
        return normalizePythonSource(value.source) === value.source;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=python-parser.js.map