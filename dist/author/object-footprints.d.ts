/** Local object effect footprints (ADR-025, policy v12). Author-only: it reads the reference
 * source and never runs for learner submissions.
 *
 * In one function-context statement list, a statement that only creates or operates on the
 * list's own objects gets a footprint: the abstract objects it reads and writes, and whether it
 * may throw. Own objects are `const x = new C(…)` of an analysable class declared in the file,
 * and `const x = []` / `{…}` literals. The bodies of the constructor, methods and accessors that
 * run are interpreted abstractly with `this` bound to the receiver and the parameters to the
 * argument values, so a statement's footprint includes what its callee does:
 *  - values are primitives, sets of abstract objects, or `other` (a fresh result nobody tracks);
 *  - field values and array elements are collected flow-insensitively per object, so a stored
 *    reference (an item in a store, a shared log in two objects) is seen by every later read or
 *    mutation through it, whatever the order;
 *  - a fresh array or object created inside a body is an object of its own, per owner and site.
 * Anything outside this subset — unknown or global calls, statics, closures that escape,
 * implicit conversion of an object, inheritance, prototype or reflection tricks — makes the
 * statement unknown (no footprint), and it stays an ordinary barrier. An object that occurs in
 * any statement without a footprint (other than the list's `return`) escapes: unknown code may
 * reach it, so no statement touching it gets a footprint either. Two footprinted statements
 * commute when neither may throw and neither writes an object the other reads or writes.
 */
import type ts from 'typescript';
type Compiler = typeof ts;
export interface Footprint {
    reads: Set<string>;
    writes: Set<string>;
    mayThrow: boolean;
}
/** `primitive`: whether a list-level expression is an effect-free primitive (the analyser's own test). */
export interface FootprintHost {
    primitive(expr: ts.Expression): boolean;
}
export declare function objectFootprints(list: readonly ts.Statement[], file: ts.SourceFile, compiler: Compiler, checker: ts.TypeChecker, host: FootprintHost): Map<ts.Statement, Footprint>;
/** Why two footprinted statements must keep their order; empty when they commute. */
export declare function footprintConflicts(a: Footprint, b: Footprint): string[];
export {};
