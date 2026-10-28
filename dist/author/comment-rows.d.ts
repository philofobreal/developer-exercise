/** Free comment rows (ADR-025, policy v12). Moving a comment never changes what a program does,
 * so a physical row that holds exactly one complete comment, and nothing else, needs no order:
 * it stays only inside its block. Kept ordered: a row of a multi-row comment (its interior would
 * turn code into comment text or back), and directives that act on their neighbourhood
 * (`@ts-` comments, triple-slash references, `//#` pragmas, `@jsx` pragmas), and JSDoc, which
 * documents the declaration after it (tooling, `@deprecated`, `@internal`, JS type annotations). The rows come from
 * the compiler's own comment ranges over a trivia gap, never from text patterns alone. */
import type ts from 'typescript';
type Compiler = typeof ts;
/** The free comment rows among the 0-based physical rows `from`..`to` (inclusive), which must be
 * trivia only (blank lines and comments between two statements or members). */
export declare function freeCommentRows(file: ts.SourceFile, compiler: Compiler, from: number, to: number): Set<number>;
export {};
