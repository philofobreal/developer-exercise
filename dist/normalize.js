/** Only leading indentation is discarded; internal/trailing whitespace stays meaningful. */
export function normalizeLine(code, mode = 'indent') {
    return mode === 'indent' ? code.replace(/^[ \t]*/, '') : code;
}
/** A code line is single-line by contract; no silent merging or structural guesswork. */
export function isSingleLine(code) {
    return !/[\r\n\u2028\u2029]/.test(code);
}
//# sourceMappingURL=normalize.js.map