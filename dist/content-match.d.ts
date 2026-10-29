import type { CodeToken, Normalization } from './types.js';
/** What counts as the same content: the row's normalization and its normalized code. Two rows
 * with equal keys are interchangeable for the validator; every core module that groups rows by
 * content asks this function, never `trim()` or its own rule. */
export declare function contentKey(code: string, normalization?: Normalization): string;
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
export declare function matchContent(tokens: readonly CodeToken[], lines: readonly string[]): ContentMatch;
