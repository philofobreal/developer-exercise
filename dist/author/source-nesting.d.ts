/** Lexical nesting budget of an author JS/TS source (ADR-103). Author-only; never runs for learner input.
 *
 * The TypeScript parser is recursive: a few kilobytes of nested brackets exhaust the call stack
 * (`RangeError`), and type-checking time grows steeply with nesting depth (ADR-103 measurement). This
 * module measures the deepest nesting of `(`, `[`, `{` and template substitutions `${…}` with the
 * compiler's scanner, which is linear and non-recursive, before any parse. A `/` after a token that
 * cannot end an expression is rescanned as a regular expression, and a `}` that closes a template
 * substitution is rescanned as template text, so brackets inside literals, comments, regular
 * expressions and template text never count. The caller rejects a source deeper than `MAX_NESTING`.
 */
import type ts from 'typescript';
/** The same bound the Python author audit applies to lexical nesting (src/python/audit-script.ts). */
export declare const MAX_NESTING = 64;
export interface NestingExcess {
    /** 1-based physical row where the nesting first exceeds the limit. */
    line: number;
}
/** The first place where the nesting exceeds `limit`, or null. Stops there, so the cost stays linear. */
export declare function nestingExcess(source: string, compiler: typeof ts, limit?: number): NestingExcess | null;
