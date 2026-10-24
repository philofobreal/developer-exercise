import type { CodeLineExerciseV3, IndentPolicy } from './language-ir.js';
import type { ValidationResult } from './types.js';
export interface RenderUnit {
    id: string;
    fixed: boolean;
    rows: {
        id: string;
        code: string;
        normalization: 'indent' | 'exact';
        sourceLine: number;
    }[];
}
export interface RenderPlan {
    language: string;
    indentPolicy: IndentPolicy;
    units: RenderUnit[];
}
/** Display projection deliberately excludes dependencies, binding scopes and profiles. */
export declare function prepareRenderPlan(model: CodeLineExerciseV3): RenderPlan | ValidationResult;
/** A future display adapter may change only ASCII indent, and only when authorized. */
export declare function projectDisplayRows(unit: RenderUnit, policy: IndentPolicy, display?: readonly string[]): string[];
