/** Binding of explanation metadata to the model it describes (ADR-015).
 *
 * Provenance names line IDs; it is valid only for the lines, scopes and analysis it
 * was derived from. The digest detects drift (a hand-edited line, renumbered IDs, a
 * changed block); it is not a cryptographic seal and grants no trust: provenance is
 * never a grading input, and verification re-derives it instead of believing it.
 */
import type { CodeLineExercise, StructuredCodeLine } from './code-line.js';
/** 64-bit, non-cryptographic digest of the ordered line IDs, texts and scopes, as 16 hex digits. */
export declare function codeLineDigest(lines: readonly Pick<StructuredCodeLine, 'id' | 'code' | 'scopeId'>[]): string;
/** ADR-044: digest of the reference source alone (the line texts in reference order). An author
 * relaxation holds for the source it was confirmed on; IDs and scopes do not change what runs. */
export declare function sourceTextDigest(lines: readonly Pick<StructuredCodeLine, 'code'>[]): string;
/** `current`: the evidence describes these lines; `stale`: they changed since; `absent`: no evidence. */
export declare function evidenceStatus(model: Pick<CodeLineExercise, 'lines' | 'authoring'>): 'current' | 'stale' | 'absent';
