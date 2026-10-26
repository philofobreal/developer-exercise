/** Author-only, scope-compositional statement ordering from conservative effect
 * summaries (ADR-008). It never runs for learner submissions.
 *
 * Each statement list (source file, block, module block) is split into units:
 *  - pure: evaluation has no observable effect and cannot throw; every binding
 *    it reads is initialised whenever it runs (same-context declaration with a
 *    protected edge, parameter, catch/loop binding, hoisted function, or a var);
 *    it may initialise its own binding;
 *  - position-free: no evaluation event at its position (hoisted function
 *    declaration in a function/script list, erased TypeScript declaration);
 *  - barrier: everything else (calls, property access, writes, loops, control
 *    transfer, unknown syntax, multi-row shapes without block delimiters);
 *  - opaque: comment and other non-statement rows.
 * For units i < j an edge i.last → j.first exists iff one is opaque, or neither
 * is position-free and at least one is a barrier, or (ADR-010) both create
 * global-object properties in a classic script (function and var declarations,
 * and the TypeScript enums, namespaces and import aliases emitted as var):
 * Object.keys(globalThis) reflects their creation order. The specification creates function bindings
 * before var bindings, V8 interleaves them in source order, so all such units
 * keep their mutual source order. Every evaluation-time read of
 * a binding whose initialisation has a TDZ/value position in the same function
 * context adds a protected edge from that declaration row. Pure units thus
 * commute; a barrier keeps its position relative to every ordered sibling.
 */
import type ts from 'typescript';
type Compiler = typeof ts;
export type UnitKind = 'pure' | 'position-free' | 'barrier' | 'opaque';
/** Evidence for one unit: why it may move, or why it may not. */
export interface StatementUnit {
    first: number;
    last: number;
    kind: UnitKind;
    reason: string;
}
export interface OrderingEntry {
    row: number;
    after: number[];
}
export interface StatementOrdering {
    entries: OrderingEntry[];
    protectedInputs: Map<number, Set<number>>;
    units: StatementUnit[];
}
/** Separate, browser-safe checker host: only the reference file is visible. */
export declare function bindingChecker(file: ts.SourceFile, compiler: Compiler): ts.TypeChecker;
export declare function statementOrdering(file: ts.SourceFile, compiler: Compiler): StatementOrdering;
export {};
