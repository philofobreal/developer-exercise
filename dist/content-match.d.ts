import type { CodeToken } from './types.js';
/** Which reference tokens each submitted line may stand for, by content alone (ADR-023).
 * The validator searches a bijection over exactly these candidates; the diagnostics reason
 * about the same sets, so both read content the same way. */
export interface ContentMatch {
    /** Normalization and normalized code of every token: equal keys are interchangeable. */
    tokenKeys: string[];
    /** Per position, the token indices whose content matches, before the fixed filter. */
    matching: number[][];
    /** Per position, the matching tokens that may also stand there: a fixed token only at its slot. */
    candidates: number[][];
    /** Positions whose content matches no token. */
    unknown: number[];
    /** Fixed slots that do not hold their fixed token's content. */
    pinnedMismatch: number[];
}
export declare function matchContent(tokens: readonly CodeToken[], lines: readonly string[]): ContentMatch;
