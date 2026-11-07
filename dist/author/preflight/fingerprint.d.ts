/** Fingerprints of the preflight proofs (ADR-108). FNV-1a, 64 bit, over a canonical text: an identifier
 * of what was checked, never a credential; a server trusts only the snapshot it stored itself. */
export declare function fnv1a64(input: string): string;
/** The author's source as the first gate reviews it: no byte order mark, LF line ends. */
export declare const normalizeSource: (source: string) => string;
export declare const sourceFingerprint: (source: string) => string;
/** The parts of a model a learner arranges and the core grades by. */
export declare const modelFingerprint: (model: {
    lines: unknown;
    blocks?: unknown;
    edges?: unknown;
    profiles?: unknown;
    dependencyMode?: unknown;
}) => string;
