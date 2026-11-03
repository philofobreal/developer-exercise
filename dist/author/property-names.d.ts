/** The property names a program reaches without spelling them out, and then uses (ADR-052, policy
 * v27; ADR-053, policy v28). Author-only: it reads the reference source and never runs for learner
 * submissions.
 *
 * The key-order rules (ADR-020, ADR-029) and the input contract (ADR-050) recognise reflection, key
 * listing and read-changing APIs by their names in the source text. A program can reach them without
 * the name appearing: it reads a property by a name computed at run time (`Object['ke' + 'ys']`),
 * reads `constructor` (the way to `Function`, so to code built from a string) or hands a string to a
 * timer.
 *
 * Such a read only yields a value; code runs when the value is called, or once it goes where this
 * analysis does not follow it (an argument, a store into something not the program's own literal, a
 * throw). This module hides that analysis:
 * - which name a computed key has: literals, literal choices, concatenations and numbers fold to a
 *   known set of names, which the callers' name rules then judge as if spelled; anything else is
 *   any name;
 * - which uses of a read value keep it harmless: comparing, computing with, converting, testing,
 *   keying by it, reading from it, calling a spelled method on it, keeping it in the program's own
 *   array or object literal, returning it to a call whose result is used the same way.
 * Names are followed by name, not by scope, which only makes the answer stricter.
 */
import type ts from 'typescript';
type Compiler = typeof ts;
/** The names reached and used without being spelled out, or `'any'` when one cannot be known. */
export type UnspelledNames = 'any' | readonly string[];
export declare function unspelledNames(file: ts.SourceFile, compiler: Compiler): UnspelledNames;
/** Whether `pattern` matches the source text or a name the program reaches unspelled. */
export declare function namesMatch(file: ts.SourceFile, reached: UnspelledNames, pattern: RegExp, text?: string): boolean;
export {};
