/** Reconcile author analysis with an existing v2 identity/structure contract. No parsing or grading. */
import type { CodeLineExercise } from '../../dist/index.js';
/** Whether two models of the same lines have the same block structure: the same blocks (rows and
 * kind) and every line in the same block (ADR-079: the verification gate compares this, not counts). */
export declare function sameStructure(a: CodeLineExercise, b: CodeLineExercise): boolean;
/** Called with two audited models; only explicit author intent may replace dependencies. */
export declare function reconcileDependencies(original: CodeLineExercise, generated: CodeLineExercise): CodeLineExercise;
