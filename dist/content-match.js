import { normalizeLine } from './normalize.js';
export function matchContent(tokens, lines) {
    const tokenKeys = tokens.map(t => `${t.normalization ?? 'indent'}\u0000${normalizeLine(t.code, t.normalization ?? 'indent')}`);
    const index = new Map();
    tokenKeys.forEach((key, i) => { const items = index.get(key) ?? []; items.push(i); index.set(key, items); });
    const matching = lines.map(line => [
        ...(index.get(`indent\u0000${normalizeLine(line, 'indent')}`) ?? []),
        ...(index.get(`exact\u0000${line}`) ?? [])
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