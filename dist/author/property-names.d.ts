/** Whether a program can reach an API by a property name its source does not spell out (ADR-052,
 * policy v27). Author-only: it reads the reference source and never runs for learner submissions.
 *
 * The key-order rules (ADR-020, ADR-029) and the input contract (ADR-050) recognise reflection, key
 * listing and read-changing APIs by their names in the source text. A program can reach any of them
 * without the name appearing: it reads a property by a name computed at run time
 * (`Object['ke' + 'ys']`), reads `constructor` (the way to `Function`, so to code built from a
 * string) or hands a string to a timer.
 *
 * Such a read only yields a value; code runs when the value is called, or once it is stored,
 * passed, returned or thrown, where the analysis no longer follows it. This module hides that
 * escape analysis: which computed names are harmless (a literal, whose text the name rules see;
 * a choice between literals; a number, which never converts to an API name), and which uses of
 * an unspelled value keep it harmless (comparison, arithmetic, conversion, a test, a key, a
 * further read, a call of a spelled method on it). Names are followed by name, not by scope,
 * which only makes the answer stricter.
 */
import type ts from 'typescript';
type Compiler = typeof ts;
/** True when the program may use, beyond comparing or computing with it, a value it read by a
 * property name its source does not spell out. */
export declare function readsUnspelledNames(file: ts.SourceFile, compiler: Compiler): boolean;
export {};
