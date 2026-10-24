import type { Normalization, OrderingEdge, OrderingProfile } from './types.js';
import type { CodeLineExercise } from './code-line.js';
/** Half-open UTF-16 coordinates into the retained LF source. */
export interface SourcePosition {
    offset: number;
    line: number;
    column: number;
}
export interface SourceSpan {
    start: SourcePosition;
    end: SourcePosition;
}
export interface CodeLineV3 {
    id: string;
    code: string;
    sourceSpan: SourceSpan;
    normalization: Normalization;
}
export interface IndentPolicy {
    mode: 'presentation' | 'semantic';
    tabWidth: number;
    display: 'adapter' | 'preserve';
}
export interface MovableUnit {
    id: string;
    /** Ordered physical rows; indivisible and contiguous in every solution. */
    lineIds: string[];
    containerId: string | null;
    bindingScopeId: string | null;
    dependencies: string[];
    fixed: boolean;
}
export interface SyntacticContainer {
    id: string;
    parentId: string | null;
    kind: string;
}
export interface BindingScope {
    id: string;
    parentId: string | null;
    kind: string;
}
export interface BlockBoundary {
    containerId: string;
    unitId: string;
    phase: 'before' | 'after';
    action: 'open' | 'close';
    /** Virtual events have no textual closer/opener; neither kind creates a row. */
    virtual: boolean;
}
export interface LanguageIR {
    irVersion: 1;
    language: string;
    source: string;
    lines: CodeLineV3[];
    units: MovableUnit[];
    containers: SyntacticContainer[];
    bindingScopes: BindingScope[];
    /** Array order is event order at a shared anchor/phase. */
    boundaries: BlockBoundary[];
    edges: OrderingEdge[];
    profiles: OrderingProfile[];
    indentPolicy: IndentPolicy;
    analysis: {
        strategy: 'legacy-v2-projection' | 'native';
        sourceOrigin: 'original' | 'reconstructed-v2';
        semanticEquivalenceProven: false;
        /** Retained v2 author decisions, never used as grading rules. */
        legacyAuthoring?: CodeLineExercise['authoring'];
    };
}
export interface CodeLineExerciseV3 {
    schemaVersion: 3;
    id: string;
    revision: number;
    title: string;
    description: string;
    ir: LanguageIR;
}
/** Internal lowering contract, independent of parsers and source-language syntax. */
export interface UnitStructure {
    units: {
        id: string;
        tokenIds: string[];
    }[];
    containers: {
        id: string;
        parentId: string | null;
    }[];
    boundaries: {
        tokenId: string;
        containerId: string;
        phase: 'before' | 'after';
        action: 'open' | 'close';
    }[];
}
