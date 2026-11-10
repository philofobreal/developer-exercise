import type { CodeLineExercise, CodeLineExerciseV3, CompiledRules, ConstraintExplanation, DirectConstraint, IndentPolicy, LanguageIR, ModelVerification, RefreshReport, RenderPlan, RuleEdit, RuleEditResult, VerificationInput } from '../../dist/index.js';
export interface AuthorSource {
    source: string;
    title?: string;
    description?: string;
}
export interface FormatResult {
    code: string;
}
export interface LanguagePlugin {
    contractVersion: 1;
    id: string;
    adapterVersion: string;
    capabilities: {
        analysis: 'native-ir' | 'legacy-v2';
        format: boolean;
    };
    indentPolicy: IndentPolicy;
    analyze(input: AuthorSource): LanguageIR | Promise<LanguageIR>;
    format?: (source: string) => FormatResult | Promise<FormatResult>;
}
export declare class AdapterContractError extends Error {
    constructor(message: string);
}
/** Explicit trusted-code registration only; no learner plugin loading or global mutable registry. */
export declare class LanguageEngine {
    private readonly plugins;
    register(plugin: LanguagePlugin): void;
    languages(): string[];
    private plugin;
    generate(language: string, input: AuthorSource, identity?: {
        id: string;
        revision: number;
    }): Promise<{
        model: CodeLineExerciseV3;
        compiled: CompiledRules;
        renderPlan: RenderPlan;
    }>;
    format(language: string, source: string): Promise<FormatResult>;
}
/** Narrow transitional ports; this does not claim the legacy MJS is type checked. */
export interface LegacyJSTSPorts {
    generate(input: AuthorSource & {
        language: 'javascript' | 'typescript';
        importEmit?: 'verbatim' | 'elide-unused';
        inputs?: 'any' | 'valid';
        keyOrder?: 'observed' | 'ignored';
        classFields?: 'either' | 'define';
    }): CodeLineExercise | Promise<CodeLineExercise>;
    audit(model: CodeLineExercise): void | Promise<void>;
    format(source: string, language: 'javascript' | 'typescript'): FormatResult | Promise<FormatResult>;
}
/** Explicit author reanalysis: preserve reference identity/content, fixed slots and manual edges/profiles. */
export declare function refreshLegacyDependencies(input: CodeLineExercise, ports: Pick<LegacyJSTSPorts, 'generate' | 'audit'>): Promise<CodeLineExercise>;
/** Explicit author reanalysis that carries the author's rules, relaxations and notes over to
 * the regenerated constraints and reports every one it could not carry (ADR-018). */
export declare function refreshAuthorModel(input: CodeLineExercise, ports: Pick<LegacyJSTSPorts, 'generate' | 'audit'>): Promise<{
    model: CodeLineExercise;
    report: RefreshReport;
}>;
/** A batch of typed rule edits (ADR-018), requalified by the verification gate (ADR-017):
 * the edited model is never presented as analysed when an edit cannot be justified. */
export declare function editAuthorModel(model: CodeLineExercise, edits: readonly RuleEdit[], ports: Pick<LegacyJSTSPorts, 'generate'>, input?: Pick<VerificationInput, 'audit' | 'maxStates' | 'neighbours'>): Promise<{
    result: RuleEditResult;
    verification?: ModelVerification;
}>;
/** What the author rule panel shows (ADR-021): every direct constraint of the explanation
 * once, without the transitive closure, which grows quadratically (1.1 MB for a 436-line
 * model). The panel needs no closure: cycles and redundancy are the core's decisions.
 * `meanings`: what each registered reason code of these constraints protects, in Hungarian
 * (ADR-054); the register stays the author analysis's, the presentation only shows it. */
export interface AuthorRuleSheet extends Pick<ConstraintExplanation, 'provenance' | 'unexplained' | 'stale' | 'relaxations'> {
    constraints: DirectConstraint[];
    meanings: Record<string, string>;
}
export declare function authorRuleSheet(model: CodeLineExercise): AuthorRuleSheet;
/** Model Verification Gate for a JS/TS v2 model (ADR-017). The generated constraints are
 * re-derived from the model's own source under its recorded import emit: they must equal
 * the regeneration, less the recorded relaxations (ADR-018), exactly (dependencies per line,
 * non-author edges and reasons), so neither a hand
 * edit nor forged provenance passes as analysis. The regeneration also supplies the
 * current analyser version and the projection loss; the core gate does the rest.
 * ADR-114: a model that differs only by narrowing is `narrower`, not `differs`: the same block
 * structure, every regenerated ordering implied by the model's own (dependencies and edges, at any
 * distance), and every analysis reason it records one the regeneration also gives. Its accepted
 * orders are then a subset of the regenerated model's, so nothing the analysis rejects is accepted.
 * B2: with the same block structure, the regenerated orderings the model leaves free are passed on (`unimplied`), so
 * a hand model that both narrows and relaxes is told which generated rule it relaxes. */
export declare function verifyAuthorModel(model: CodeLineExercise, ports: Pick<LegacyJSTSPorts, 'generate'>, input?: Pick<VerificationInput, 'audit' | 'maxStates' | 'neighbours'>): Promise<ModelVerification>;
export declare function createLegacyJSTSBridge(language: 'javascript' | 'typescript', ports: LegacyJSTSPorts): LanguagePlugin;
