import type { CodeLineExercise, CodeLineExerciseV3, CompiledRules, IndentPolicy, LanguageIR, ModelVerification, RefreshReport, RenderPlan, RuleEdit, RuleEditResult, VerificationInput } from '../../dist/index.js';
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
/** Model Verification Gate for a JS/TS v2 model (ADR-017). The generated constraints are
 * re-derived from the model's own source under its recorded import emit: they must equal
 * the regeneration, less the recorded relaxations (ADR-018), exactly (dependencies per line,
 * non-author edges and reasons), so neither a hand
 * edit nor forged provenance passes as analysis. The regeneration also supplies the
 * current analyser version and the projection loss; the core gate does the rest. */
export declare function verifyAuthorModel(model: CodeLineExercise, ports: Pick<LegacyJSTSPorts, 'generate'>, input?: Pick<VerificationInput, 'audit' | 'maxStates' | 'neighbours'>): Promise<ModelVerification>;
export declare function createLegacyJSTSBridge(language: 'javascript' | 'typescript', ports: LegacyJSTSPorts): LanguagePlugin;
