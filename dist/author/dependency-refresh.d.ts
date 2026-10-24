/** Reconcile author analysis with an existing v2 identity/structure contract. No parsing or grading. */
import type { CodeLineExercise } from '../../dist/index.js';
/** Called with two audited models; only explicit author intent may replace dependencies. */
export declare function reconcileDependencies(original: CodeLineExercise, generated: CodeLineExercise): CodeLineExercise;
