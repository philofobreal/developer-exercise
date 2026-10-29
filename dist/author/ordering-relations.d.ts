/** Language-independent ordering relations between physical reference rows (ADR-011).
 *
 * A language adapter owns its AST and its binding/effect analysis and hands
 * the projection only these relations; the projection owns the block/scope
 * hierarchy and the CodeLine v2 mapping. Nothing here knows a parser, a
 * syntax kind or a language rule, and nothing here runs for learner input.
 *
 * Rows are 0-based physical rows of the normalised reference source.
 */
import type { ReasonCodeName } from './reason-codes.js';
/** Why `before` must precede the entry's row (ADR-014): explanation only, never a grading rule. */
/** `code` is a registered reason code; its category is the register's (reason-codes.ts, ADR-038). */
export interface OrderingReason {
    before: number;
    code: ReasonCodeName;
}
/** `reasons` should cover every row of `after`; an uncovered one is projected as `unknown`. */
export interface OrderingEntry {
    row: number;
    after: number[];
    reasons?: OrderingReason[];
}
export interface OrderingRelations {
    /** A listed row must follow every row in `after` (a conjunction); unlisted rows keep their source predecessor. */
    entries: OrderingEntry[];
    /** Value inputs (row → declaration rows) that transitive reduction must keep. */
    protectedInputs: Map<number, Set<number>>;
    /** Row span of every ordered unit (statement or member); a multi-row span is one indivisible unit. */
    spans: {
        first: number;
        last: number;
    }[];
    /** Human explanation for authors, never a grading rule; '' when there is nothing to say. */
    note: string;
}
/** Merges entries per row: predecessor sets and (deduplicated) reasons are unions. */
export declare function mergeOrderingEntries(entries: Iterable<OrderingEntry>): OrderingEntry[];
/** Conjunction of independent analyses: predecessor sets, reasons, protected inputs and spans are unions. */
export declare function combineOrderingRelations(parts: OrderingRelations[]): OrderingRelations;
/** CodeLine v2 line as the projection sees it: IDs are 1-based and contiguous in reference order. */
export interface ProjectedLine {
    id: number;
    scopeId: string | null;
    dependencies: number[];
}
/** The validator admits a row wherever the open scope equals its scopeId. Inside a
 * multi-row unit that holds only at continuation rows and at shared `} else {`
 * style boundaries (omitted blocks); there every same-scope sibling unit keeps its
 * source side (ADR-009). `units` are line-ID spans, `opener` maps a line opening a
 * retained block to that block's scopeId. Mutates the lines' dependencies and
 * reports every required pair, present or added, to `required`. */
export declare function sealMultiRowUnits(lines: ProjectedLine[], units: {
    first: number;
    last: number;
}[], opener: Map<number, string>, required?: (before: number, after: number) => void): void;
/** Remove only redundant synthetic edges, retaining actual value-read inputs. */
export declare function reduceGeneratedDependencies(lines: {
    id: number;
    dependencies: number[];
}[], protectedById?: Map<number, Set<number>>): void;
