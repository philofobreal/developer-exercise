import type { Normalization } from './types.js';

/** Only leading indentation is discarded; internal/trailing whitespace stays meaningful. */
export function normalizeLine(code: string, mode: Normalization = 'indent'): string {
  return mode === 'indent' ? code.replace(/^[ \t]*/, '') : code;
}

/** A code line is single-line by contract; no silent merging or structural guesswork. */
export function isSingleLine(code: string): boolean {
  return !/[\r\n\u2028\u2029]/.test(code);
}
