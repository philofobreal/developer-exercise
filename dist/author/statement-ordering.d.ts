/** Author-only, scope-compositional statement ordering from conservative effect
 * summaries (ADR-008). It never runs for learner submissions.
 *
 * Each statement list (source file, block, module block) is split into units:
 *  - pure: evaluation has no observable effect and cannot throw once its
 *    inputs are initialised; it may read bindings and initialise its own one;
 *  - position-free: no evaluation event at its position (hoisted function
 *    declaration in a function/script list, erased TypeScript declaration);
 *  - barrier: everything else (calls, property access, writes, loops, control
 *    transfer, unknown syntax, multi-row shapes without block delimiters);
 *  - opaque: comment and other non-statement rows.
 * For units i < j an edge i.last → j.first exists iff one is opaque, or neither
 * is position-free and at least one is a barrier. Every evaluation-time read of
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
/** Remove only redundant synthetic edges, retaining actual value-read inputs. */
export declare function reduceGeneratedDependencies(lines: {
    id: number;
    dependencies: number[];
}[], protectedById?: Map<number, Set<number>>): void;
export {};
