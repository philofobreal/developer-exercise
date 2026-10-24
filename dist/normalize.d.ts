import type { Normalization } from './types.js';
/** Only leading indentation is discarded; internal/trailing whitespace stays meaningful. */
export declare function normalizeLine(code: string, mode?: Normalization): string;
/** A code line is single-line by contract; no silent merging or structural guesswork. */
export declare function isSingleLine(code: string): boolean;
