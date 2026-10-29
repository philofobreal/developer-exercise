import { normalizeLine } from './normalize.js';
/** What counts as the same content: the row's normalization and its normalized code. Two rows
 * with equal keys are interchangeable for the validator; every core module that groups rows by
 * content asks this function, never `trim()` or its own rule. */
export function contentKey(code, normalization = 'indent') {
    return `${normalization}\u0000${normalizeLine(code, normalization)}`;
}
export function matchContent(tokens, lines) {
    const tokenKeys = tokens.map(t => contentKey(t.code, t.normalization));
    const index = new Map();
    tokenKeys.forEach((key, i) => { const items = index.get(key) ?? []; items.push(i); index.set(key, items); });
    const matching = lines.map(line => [
        ...(index.get(contentKey(line, 'indent')) ?? []),
        ...(index.get(contentKey(line, 'exact')) ?? [])
    ].sort((a, b) => a - b));
    const unknown = matching.flatMap((a, i) => a.length ? [] : [i]);
    const pinnedMismatch = tokens.flatMap(token => {
        if (token.fixedPosition === undefined)
            return [];
        const line = lines[token.fixedPosition];
        const mode = token.normalization ?? 'indent';
        return line === undefined || normalizeLine(line, mode) !== normalizeLine(token.code, mode) ? [token.fixedPosition] : [];
    });
    const candidates = matching.map((items, position) => items.filter(i => tokens[i].fixedPosition === undefined || tokens[i].fixedPosition === position));
    return { tokenKeys, matching, candidates, unknown, pinnedMismatch };
}
//# sourceMappingURL=content-match.js.map