/** Language-independent CodeLine v2 projection (ADR-011, ADR-013). The adapter
 * supplies the block intervals, the exact-whitespace rows and the ordering
 * relations; this module owns the block/scope hierarchy, the physical-row to
 * line-ID mapping, clause chains, sealing and transitive reduction. It knows no
 * parser and no syntax kind, and never runs for learner input. Rows are 0-based
 * physical rows of the normalised reference source. */
import { type OrderingRelations } from './ordering-relations.js';
/** A block interval from the adapter. `clause`: one clause of a compound statement
 * (if/else, try/catch/finally) that may share its first or last row with the next
 * clause, as in `} else {`. */
export interface StructureBlock {
    start: number;
    end: number;
    kind: 'function' | 'block';
    clause?: boolean;
}
export interface ProjectionInput {
    physical: readonly string[];
    exact: ReadonlySet<number>;
    structure: readonly StructureBlock[];
    ordering?: OrderingRelations | undefined;
}
export interface ProjectedCodeLine {
    id: number;
    sourceLine: number;
    code: string;
    dependencies: number[];
    fixed: false;
    functionBlock: number;
    scopeId: string | null;
    normalization: 'exact' | 'indent';
}
export interface ProjectedBlock {
    id: string;
    kind: 'function' | 'block';
    parentScopeId: string | null;
    openLineId: number;
    closeLineId: number;
    functionBlock?: number;
}
export interface CodeLineProjection {
    lines: ProjectedCodeLine[];
    blocks: ProjectedBlock[];
    /** Source-order locks of omitted blocks whose rows no block can represent. */
    edges: {
        before: number;
        after: number;
    }[];
    omittedBlocks: number;
    /** Clause chains represented as one container with separator rows. */
    clauseChains: number;
}
/** Physical rows that become lines: non-blank, or whitespace-exact. */
export declare function projectedRows(physical: readonly string[], exact: ReadonlySet<number>): {
    code: string;
    line: number;
}[];
export declare function projectCodeLine({ physical, exact, structure, ordering }: ProjectionInput): CodeLineProjection;
