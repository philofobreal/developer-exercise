import { type CodeLineExercise, type RuleRelaxation } from './code-line.js';
export type RuleEdit = {
    kind: 'add-rule';
    before: number;
    after: number;
    note?: string;
} | {
    kind: 'remove-rule';
    before: number;
    after: number;
    acknowledge?: Acknowledgement;
    note?: string;
} | {
    kind: 'set-note';
    before: number;
    after: number;
    note: string;
} | {
    kind: 'set-fixed';
    line: number;
    fixed: boolean;
} | {
    kind: 'add-profile';
    id: string;
} | {
    kind: 'remove-profile';
    id: string;
} | {
    kind: 'add-profile-rule';
    profile: string;
    before: number;
    after: number;
} | {
    kind: 'remove-profile-rule';
    profile: string;
    before: number;
    after: number;
};
export type RuleEditError = 'invalid-model' | 'invalid-edit' | 'unknown-line' | 'unknown-profile' | 'duplicate-profile' | 'not-a-constraint' | 'transitive-only' | 'hard-constraint' | 'needs-acknowledgement' | 'cycle' | 'against-reference' | 'admission';
/** `no`: impossible by constraint inclusion; `yes`: shown by the witness (line IDs in order); `maybe`: undecided. */
export interface EditEffect {
    stricter: 'no' | 'yes' | 'maybe';
    looser: 'no' | 'yes' | 'maybe';
    stricterWitness?: number[];
    looserWitness?: number[];
}
export type Acknowledgement = 'unproven-relaxation' | 'policy-override';
export type RuleEditResult = {
    ok: true;
    model: CodeLineExercise;
    effect: EditEffect;
}
/** `index`: the failing edit, or null when the finished batch failed admission.
 * `acknowledge`: with `needs-acknowledgement`, the level that would admit the removal. */
 | {
    ok: false;
    error: RuleEditError;
    message: string;
    index: number | null;
    acknowledge?: Acknowledgement;
};
/** Applies a batch atomically and reports its effect; the input model is never mutated. */
export declare function applyRuleEdits(model: CodeLineExercise, edits: readonly RuleEdit[]): RuleEditResult;
/** ADR-044: whether a recorded relaxation still holds for these lines: it was confirmed on this
 * source, or recorded before fingerprints existed. The one place that decides it. */
export declare function relaxationHolds(relaxation: Pick<RuleRelaxation, 'sourceDigest'>, lines: CodeLineExercise['lines']): boolean;
export interface RefreshReport {
    /** Author rules kept as mandatory edges (including former author dependencies). */
    authorRules: number;
    /** Unexplained edges of a legacy or imported model, kept because their origin is unknown. */
    legacyEdges: number;
    /** Generated edges of the previous analysis, superseded by the regenerated ones. */
    supersededEdges: number;
    /** `reapplied`: removed again; `revoked`: the regenerated constraint is stronger and stays;
     * `implied`: now only a transitive consequence; `obsolete`: no longer constrained at all.
     * ADR-044: `reconfirm`: the source changed since the author confirmed it, so the constraint
     * stays until a new removal confirms it again (the note travels with the report);
     * `unchecked`: removed again, but recorded before fingerprints, so it was confirmed on an
     * unknown source; it carries the current one from now on. */
    relaxations: {
        before: number;
        after: number;
        outcome: 'reapplied' | 'revoked' | 'implied' | 'obsolete' | 'reconfirm' | 'unchecked';
        note?: string;
    }[];
    droppedNotes: number;
}
/** Re-applies the author's rules to a regenerated model of the same lines and blocks
 * (ADR-018). `regenerated` carries only regenerated dependencies, edges and provenance;
 * `original` is the model before the refresh. Nothing is dropped silently: the report
 * names every rule that could not be carried over. The original's provenance tells author
 * rules from generated edges only while it is bound to its lines (ADR-015); otherwise every
 * original edge is kept as legacy. Throws if the merge is inadmissible. */
export declare function mergeAuthorRules(original: CodeLineExercise, regenerated: CodeLineExercise): {
    model: CodeLineExercise;
    report: RefreshReport;
};
