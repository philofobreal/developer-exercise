import type { CodeToken, Normalization } from './types.js';
import { normalizeLine } from './normalize.js';

/** What counts as the same content: the row's normalization and its normalized code. Two rows
 * with equal keys are interchangeable for the validator; every core module that groups rows by
 * content asks this function, never `trim()` or its own rule. */
export function contentKey(code: string, normalization: Normalization = 'indent'): string {
  return `${normalization}\u0000${normalizeLine(code, normalization)}`;
}

/** Which reference tokens each submitted line may stand for, by content alone (ADR-023).
 * The validator searches a bijection over exactly these candidates; the diagnostics reason
 * about the same sets, so both read content the same way. */
export interface ContentMatch {
  /** Normalization and normalized code of every token: equal keys are interchangeable. */
  tokenKeys: string[];
  /** Per position, the token indices whose content matches, before the fixed filter. */
  matching: number[][];
  /** Per position, the matching tokens that may also stand there: a fixed token only at its slot.
   * Ascending by token index: the search relies on this order to keep its first witness (ADR-036). */
  candidates: number[][];
  /** Positions whose content matches no token. */
  unknown: number[];
  /** Fixed slots that do not hold their fixed token's content. */
  pinnedMismatch: number[];
}

export function matchContent(tokens: readonly CodeToken[], lines: readonly string[]): ContentMatch {
  const tokenKeys = tokens.map(t => contentKey(t.code, t.normalization));
  const index = new Map<string, number[]>();
  tokenKeys.forEach((key, i) => { const items = index.get(key) ?? []; items.push(i); index.set(key, items); });
  const matching = lines.map(line => [
    ...(index.get(contentKey(line, 'indent')) ?? []),
    ...(index.get(contentKey(line, 'exact')) ?? [])
  ].sort((a, b) => a - b));
  const unknown = matching.flatMap((a, i) => a.length ? [] : [i]);
  const pinnedMismatch = tokens.flatMap(token => {
    if (token.fixedPosition === undefined) return [];
    const line = lines[token.fixedPosition];
    const mode = token.normalization ?? 'indent';
    return line === undefined || normalizeLine(line, mode) !== normalizeLine(token.code, mode) ? [token.fixedPosition] : [];
  });
  const candidates = matching.map((items, position) => items.filter(i => tokens[i]!.fixedPosition === undefined || tokens[i]!.fixedPosition === position));
  return { tokenKeys, matching, candidates, unknown, pinnedMismatch };
}
