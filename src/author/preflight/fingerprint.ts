/** Fingerprints of the preflight proofs (ADR-108). FNV-1a, 64 bit, over a canonical text: an identifier
 * of what was checked, never a credential; a server trusts only the snapshot it stored itself. */
export function fnv1a64(input: string): string {
 let hash = 0xcbf29ce484222325n;
 for (let i = 0; i < input.length; i++) {hash ^= BigInt(input.charCodeAt(i)); hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;}
 return hash.toString(16).padStart(16, '0');
}
/** The author's source as the first gate reviews it: no byte order mark, LF line ends. */
export const normalizeSource = (source: string): string => source.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
export const sourceFingerprint = (source: string): string => 's1-' + fnv1a64(normalizeSource(source));
/** The parts of a model a learner arranges and the core grades by. */
export const modelFingerprint = (model: {lines: unknown; blocks?: unknown; edges?: unknown; profiles?: unknown; dependencyMode?: unknown}): string =>
 'm1-' + fnv1a64(JSON.stringify([model.lines, model.blocks ?? null, model.edges ?? null, model.profiles ?? null, model.dependencyMode ?? null]));
