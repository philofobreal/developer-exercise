import type { ExerciseDefinition, Normalization, ValidationResult } from './types.js';
import { type CompiledRules } from './model.js';
/** Kept source-compatible with the user-proposed interface. IDs are transport identities, not semantic identities. */
export interface CodeLine {
    id: number;
    code: string;
    /** All predecessors must occur somewhere earlier; never means immediately before. */
    dependencies: number[];
    /** Cannot be moved from the zero-based source index; enforced on the server, too. */
    fixed: boolean;
    /** Owning function ID (0 means top-level), including opener and closer. */
    functionBlock: number;
}
/** Separates nested lexical scopes from ownership of functions, and raw whitespace from indentation. */
export interface StructuredCodeLine extends CodeLine {
    /** Original one-based physical source line; metadata, never an ordering key. */
    sourceLine?: number;
    scopeId: string | null;
    normalization?: Normalization;
}
export interface CodeBlock {
    id: string;
    /** 'function' blocks map to numeric functionBlock; 'block' includes loops/conditionals. */
    kind: 'function' | 'block';
    functionBlock?: number;
    parentScopeId: string | null;
    openLineId: number;
    closeLineId: number;
}
/** Why a constraint exists (ADR-014). `unknown`: an imported or legacy model carries no provenance for it. */
export type ConstraintCategory = 'data' | 'effect' | 'structure' | 'unit' | 'policy' | 'author' | 'conservative' | 'unknown';
/** Explanation metadata for one `before → after` constraint (a dependency or an edge); never a grading rule. */
export interface ConstraintProvenance {
    before: number;
    after: number;
    category: ConstraintCategory;
    code: string;
}
export interface CodeLineExercise {
    schemaVersion: 2;
    id: string;
    revision: number;
    language: 'javascript' | 'typescript';
    title: string;
    description: string;
    lines: StructuredCodeLine[];
    blocks: CodeBlock[];
    /** Shared mandatory partial ordering, outside per-line dependencies. */
    edges?: {
        before: number;
        after: number;
    }[];
    /** Each profile adds AND constraints; alternative profiles are OR. */
    profiles?: {
        id: string;
        edges: {
            before: number;
            after: number;
        }[];
    }[];
    authoring?: {
        strategy?: string;
        reason?: string;
        note?: string;
        omittedBlocks?: number;
        semanticEquivalenceProven?: false;
        dependencyPolicy?: 'primitive-const-islands-v1' | 'scoped-primitive-dag-v2' | 'scoped-type-members-v3' | 'scoped-effect-analysis-v4' | 'scoped-effect-analysis-v5' | 'scoped-effect-analysis-v6' | 'scoped-effect-analysis-v7' | 'scoped-effect-analysis-v8' | 'scoped-effect-analysis-v9';
        dependencyHints?: {
            name: string;
            declarationLine: number;
            usageLine: number;
        }[];
        provenance?: ConstraintProvenance[];
    };
}
export type AdaptResult = {
    definition: ExerciseDefinition;
    compiled: CompiledRules;
} | ValidationResult;
/** Compile and audit once at publication time. Never compile rules supplied by a learner. */
export declare function compileCodeLineExercise(raw: CodeLineExercise): AdaptResult;
