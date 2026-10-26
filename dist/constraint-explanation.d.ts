/** Language-independent explanation of an admitted CodeLine v2 model's constraints (ADR-014).
 *
 * It answers, for every line, which constraints bind it, why, and how freely an
 * author may change each one. The reasons come from `authoring.provenance`, which
 * is explanation metadata only: this module never changes or replaces validation,
 * and a model without provenance explains as `legacy`. Provenance counts only while its
 * evidence binds it to these exact lines (ADR-015); otherwise it is `unbound` and every
 * dependency and edge explains as `legacy` too. Block membership is read
 * from the block hierarchy itself, so it is always a hard structural constraint.
 */
import type { ValidationResult } from './types.js';
import { type CodeLineExercise, type ConstraintCategory } from './code-line.js';
/** How a constraint may change: `hard` only with the structure, `proven` only with the
 * code or the ordering policy, `conservative` by a more precise analysis or an explicit
 * author decision, `pedagogical` by the author, `legacy` is unexplained. */
export type Editability = 'hard' | 'proven' | 'conservative' | 'pedagogical' | 'legacy';
export interface ConstraintReason {
    category: ConstraintCategory;
    code: string;
}
/** One direct `before → after` constraint; `origins` lists where the model states it. */
export interface DirectConstraint {
    before: number;
    after: number;
    origins: ('dependency' | 'edge' | 'block')[];
    reasons: ConstraintReason[];
    editability: Editability;
}
export interface LineConstraints {
    id: number;
    scopeId: string | null;
    functionBlock: number;
    fixed: boolean;
    predecessors: DirectConstraint[];
    successors: DirectConstraint[];
    /** Every line that must precede (follow) this one, transitively, in model order. */
    ancestors: number[];
    descendants: number[];
}
export interface ConstraintExplanation {
    lines: LineConstraints[];
    /** `absent`: no provenance at all (legacy or imported model); `unbound`: provenance whose evidence is
     * missing or no longer matches the lines, so it is ignored; `partial`: some constraints are unexplained. */
    provenance: 'complete' | 'partial' | 'absent' | 'unbound';
    /** Dependencies and edges without a reason. */
    unexplained: number;
    /** Provenance entries that name no dependency or edge of the model; ignored. */
    stale: number;
}
/** Admits the model first; an inadmissible model is never explained. */
export declare function explainConstraints(model: CodeLineExercise): ConstraintExplanation | ValidationResult;
