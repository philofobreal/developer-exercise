import type { CodeLineExerciseV3 } from './language-ir.js';
import type { CodeLineExercise, AdaptResult } from './code-line.js';
import type { ValidationResult } from './types.js';
/** Author-time admission only. No language syntax or parser is needed here. */
export declare function compileCodeLineExerciseV3(raw: CodeLineExerciseV3): AdaptResult;
/** Lossless grading projection; never regenerate or parse imported v2 constraints. */
export declare function upgradeCodeLineExerciseV2(model: CodeLineExercise, originalSource?: string): CodeLineExerciseV3 | ValidationResult;
export declare function compileVersionedExercise(model: CodeLineExercise | CodeLineExerciseV3): AdaptResult;
