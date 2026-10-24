import type { ExerciseDefinition, OrderingEdge, ValidationResult } from './types.js';
export interface CompiledRules {
    definition: ExerciseDefinition;
    /** Base profile is also included when no profiles are supplied. */
    profiles: {
        id: string;
        edges: OrderingEdge[];
    }[];
}
/** Validate trusted author data once when publishing/loading it, NEVER trust the browser's copy. */
export declare function compileDefinition(def: ExerciseDefinition): CompiledRules | ValidationResult;
export declare function isModelError(result: CompiledRules | ValidationResult): result is ValidationResult;
