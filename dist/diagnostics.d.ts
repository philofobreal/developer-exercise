/** Explainable validation (ADR-023).
 *
 * `validateSubmission` stays the only judge: the report carries its verdict unchanged, and the
 * diagnostics only explain it. A rejection names a conflict only when it is proven, i.e. it
 * holds under every content-consistent assignment of submitted lines to reference tokens, and
 * alone rules out acceptance. The proofs read the validator's own candidate sets
 * (`matchContent`): a token may stand only at its candidate positions, so an ordering rule
 * `a → b` is violated in every assignment when every candidate position of `a` follows every
 * candidate position of `b`. Duplicated content therefore never names a single line, and a
 * profile-specific conflict proves nothing unless every alternative profile has one.
 * Everything else falls back to a correct, more general explanation.
 *
 * All work is counted against an explicit step budget; an exhausted budget keeps what is
 * already proven and says that the report is partial. Texts are deterministic templates, and
 * a semantic reason appears only from bound provenance (ADR-014, ADR-015).
 */
import type { ExerciseDefinition, Submission, ValidationOptions, ValidationResult } from './types.js';
import type { CodeLineExercise, ConstraintCategory } from './code-line.js';
import { type CompiledRules } from './model.js';
export type DiagnosticCode = 'invalid-reference' | 'invalid-submission' | 'search-budget' | 'unknown-content' | 'extra-line' | 'missing-line' | 'wrong-multiplicity' | 'fixed-position' | 'order-direct' | 'order-transitive' | 'pedagogical-rule' | 'structural-placement' | 'scope-boundary' | 'unit-split' | 'profile-conflict' | 'unexplained-rejection' | 'single-move-repair' | 'diagnostic-budget' | 'withheld';
/** `proven`: true under every content-consistent assignment, and enough to explain the
 * verdict. `general`: correct but names no cause. */
export type DiagnosticCertainty = 'proven' | 'general';
/** What a diagnostic reveals, weakest first; a disclosure policy (F2) caps it. */
export type DisclosureLevel = 'verdict' | 'positions' | 'rules' | 'provenance';
export declare const disclosureLevels: readonly DisclosureLevel[];
/** Where a violated rule comes from in the compiled model. */
export type RuleOrigin = 'dependency' | 'edge' | 'block' | 'unit' | 'profile';
export interface DiagnosticRule {
    before: string;
    after: string;
    origins: RuleOrigin[];
    /** Reasons from bound provenance only; empty when unknown. */
    categories: ConstraintCategory[];
    /** The alternative profile this rule belongs to, when it is profile-specific. */
    profile?: string;
    /** A shortest rule chain `before → … → after` for a transitive conflict. */
    path?: string[];
}
/** `verified`: the validator accepts the result. `partial`: removes this proven conflict,
 * other errors may remain. `guidance`: a direction, not a checked change. `move` uses the
 * sorter's insert semantics: the line at `from` ends at `to`, movable neighbours shift. */
export interface DiagnosticFix {
    level: 'verified' | 'partial' | 'guidance';
    text: string;
    move?: {
        from: number;
        to: number;
    };
}
export interface Diagnostic {
    code: DiagnosticCode;
    severity: 'error' | 'notice';
    certainty: DiagnosticCertainty;
    /** Zero-based submission positions. `all`: each is involved; `some`: at least one of them,
     * which one is not proven; `none`: no position applies. */
    positions: number[];
    positionScope: 'all' | 'some' | 'none';
    /** Reference tokens whose identity at those positions is proven. */
    references: string[];
    rule?: DiagnosticRule;
    summary: string;
    detail: string;
    /** Why the rule holds, from bound provenance (ADR-027): shown only at `provenance`, together
     * with `rule.categories`; below it both are removed, the rest of the diagnostic stays. */
    reasons?: string[];
    fix?: DiagnosticFix;
    evidence: string;
    limits?: string;
    disclosure: DisclosureLevel;
}
export interface DiagnosticReport {
    /** Exactly what `validateSubmission` returned for the same input. */
    verdict: ValidationResult;
    diagnostics: Diagnostic[];
    /** The verdict is accepted, or a proven diagnostic explains it. */
    explained: boolean;
    /** Elementary steps, including the validator states spent on checking fixes. */
    budget: {
        limit: number;
        used: number;
        exhausted: boolean;
    };
}
export interface DiagnosticOptions extends ValidationOptions {
    /** Explicit, finite diagnostic budget in elementary steps. */
    maxSteps?: number;
    /** Validator states per checked fix. */
    repairStates?: number;
    /** ADR-030: validator states in all for the single-move search of an unexplained rejection. */
    moveSearchStates?: number;
    /** Bound provenance per rule, keyed by `ruleKey`; see `codeLineDiagnosticReasons`. */
    reasons?: ReadonlyMap<string, readonly ConstraintCategory[]>;
}
export declare const ruleKey: (before: string, after: string) => string;
/** What one viewer is shown (ADR-026): the diagnostics up to `level`, the rest withheld and
 * counted. A rejection whose every error was withheld keeps one general line with the verdict's
 * own message, so the viewer gets no false cause and no cause above the level either. The
 * verdict itself is never changed. */
export interface Feedback {
    level: DisclosureLevel;
    diagnostics: Diagnostic[];
    explained: boolean;
    withheld: number;
}
export declare function discloseReport(report: DiagnosticReport, level: DisclosureLevel): Feedback;
/** Who asks for an evaluation (ADR-027). */
export type FeedbackChannel = 'author-preview' | 'learner';
/** The single disclosure policy (ADR-027), used alike by the trusted server and the Pages demo:
 * the author preview sees everything and the learner level beside it; a learner gets the level
 * the exercise's author chose (`learnerFeedback`, default `positions`), never reasons or
 * provenance. An unknown stored value falls back to `positions`. */
export declare function channelFeedback(report: DiagnosticReport, channel: FeedbackChannel, learnerFeedback?: string): {
    author?: Feedback;
    learner: Feedback;
};
/** Bound provenance of a CodeLine v2 model as diagnostic reasons; empty when unbound or absent. */
export declare function codeLineDiagnosticReasons(model: CodeLineExercise): Map<string, ConstraintCategory[]>;
/** Diagnose one submission. The verdict is computed by `validateSubmission` with the same options. */
export declare function diagnoseSubmission(compiledOrRaw: CompiledRules | ExerciseDefinition, submission: Submission, options?: DiagnosticOptions): DiagnosticReport;
/** Fixed slots stay; the moved line takes `to`, movable neighbours shift (insert, never swap). */
export declare function moveLine<T>(lines: readonly T[], fixedSlots: ReadonlySet<number>, from: number, to: number): T[] | null;
