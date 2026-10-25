import type { CodeLineExercise, CodeLineExerciseV3, CompiledRules, IndentPolicy, LanguageIR, RenderPlan } from '../../dist/index.js';
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
    }): CodeLineExercise | Promise<CodeLineExercise>;
    audit(model: CodeLineExercise): void | Promise<void>;
    format(source: string, language: 'javascript' | 'typescript'): FormatResult | Promise<FormatResult>;
}
/** Explicit author reanalysis: preserve reference identity/content, fixed slots and manual edges/profiles. */
export declare function refreshLegacyDependencies(input: CodeLineExercise, ports: Pick<LegacyJSTSPorts, 'generate' | 'audit'>): Promise<CodeLineExercise>;
export declare function createLegacyJSTSBridge(language: 'javascript' | 'typescript', ports: LegacyJSTSPorts): LanguagePlugin;
