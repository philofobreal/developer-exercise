/** Binding of explanation metadata to the model it describes (ADR-015).
 *
 * Provenance names line IDs; it is valid only for the lines, scopes and analysis it
 * was derived from. The digest detects drift (a hand-edited line, renumbered IDs, a
 * changed block); it is not a cryptographic seal and grants no trust: provenance is
 * never a grading input, and verification re-derives it instead of believing it.
 */
import type { CodeLineExercise, StructuredCodeLine } from './code-line.js';

/** 64-bit, non-cryptographic digest of the ordered line IDs, texts and scopes, as 16 hex digits. */
export function codeLineDigest(lines: readonly Pick<StructuredCodeLine, 'id' | 'code' | 'scopeId'>[]): string {
  const text = JSON.stringify(lines.map(line => [line.id, line.code, line.scopeId]));
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ unit, 2654435761);
    h2 = Math.imul(h2 ^ unit, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

/** `current`: the evidence describes these lines; `stale`: they changed since; `absent`: no evidence. */
export function evidenceStatus(model: Pick<CodeLineExercise, 'lines' | 'authoring'>): 'current' | 'stale' | 'absent' {
  const evidence = model.authoring?.evidence;
  if (!evidence) return 'absent';
  return evidence.sourceDigest === codeLineDigest(model.lines) ? 'current' : 'stale';
}
