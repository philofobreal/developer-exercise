import type { Submission, ValidationOptions, ValidationResult } from './types.js';
import { type CompiledRules } from './model.js';
/**
 * Witness-based exact validation:
 *   ∃ bijection of submitted positions to reference token instances
 *   respecting content normalization, lexical scopes, ordering edges, and one profile.
 * Deterministic bounded search: exhausted budget => INDETERMINATE, never falsely rejected.
 * No JS/TS execution, eval, vm, or server-side source parsing.
 */
export declare function validateSubmission(compiledOrRaw: CompiledRules | import('./types.js').ExerciseDefinition, submission: Submission, opts?: ValidationOptions): ValidationResult;
