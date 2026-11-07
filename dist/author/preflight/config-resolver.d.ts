/** Author policy resolution (ADR-108, E1). Author-only; the learner path never reads it.
 *
 * One pure function turns what the author (or an API caller) asked for into the policy the analysis
 * actually runs with: `requested` is kept as given, `effective` is what the generator and the gates
 * use, `locks` say which requested value a preset overrode and why, `inactive` which option does not
 * apply to the language, and `conflicts` which value is refused (a blocking conflict stops admission).
 * Only options with an implemented analysis exist here (ADR-108, deviation 2); a later analyzer adds
 * its own option. The fingerprint identifies the effective policy for the proofs of later gates; it is
 * no credential, and a server trusts only the snapshot it stored itself.
 *
 * The four source-contract options keep their stable names and their historical fallback (`any`,
 * `observed`, `either`, `verbatim`): a request or a model without them means what it always meant.
 * New drafts start elsewhere (`NEW_DRAFT_SETTINGS`, ADR-106) and send their values explicitly.
 */
export declare const POLICY_SCHEMA = "author-policy-v1";
export type PolicyLanguage = 'javascript' | 'typescript';
export interface AuthorPolicy {
    inputs: 'any' | 'valid';
    keyOrder: 'observed' | 'ignored';
    classFields: 'either' | 'define';
    /** TypeScript only (ADR-013). */
    importEmit: 'verbatim' | 'elide-unused';
    /** `conservative` is a preset: it locks every source-contract option to its strict value. It does not
     * claim that the program runs alike in every environment. */
    portability: 'configured' | 'conservative';
    /** How the gates treat a `possible` or `unknown` finding; a definite error always blocks (ADR-108).
     * `require-ack` joins with the acknowledgement flow (E6–E7); until then it is refused (ADR-108, deviation 2). */
    unknownPolicy: 'warn' | 'block';
    /** TypeScript only (E2): `strict` compiles with the `strict` family; its errors are definite compile errors. */
    tsDiagnostics: 'baseline' | 'strict';
    /** JavaScript only (E2): `on` adds a `checkJs` type check; what only it finds is a possible error. */
    jsCheck: 'off' | 'on';
}
export type PolicyPath = keyof AuthorPolicy;
export interface PolicyLock {
    path: PolicyPath;
    requested: string | undefined;
    effective: string;
    rule: string;
    reason: string;
}
export interface PolicyNote {
    path: PolicyPath;
    reason: string;
}
export interface PolicyConflict {
    code: string;
    path: string;
    message: string;
    blocking: boolean;
}
export interface PolicyResolution {
    schema: typeof POLICY_SCHEMA;
    language: PolicyLanguage;
    requested: Partial<Record<PolicyPath, string>>;
    effective: AuthorPolicy;
    locks: PolicyLock[];
    inactive: PolicyNote[];
    conflicts: PolicyConflict[];
    fingerprint: string;
}
/** Resolves a compile request (`inputs`, `keyOrder`, `classFields`, `importEmit` at the top level,
 * `policy: {portability, unknownPolicy}`) into the effective author policy. Never throws. */
export declare function resolveAuthorPolicy(request: Readonly<Record<string, unknown>>): PolicyResolution;
/** The blocking conflicts as one author-facing message, or '' when the policy is admissible. */
export declare const policyRefusal: (resolution: PolicyResolution) => string;
/** The language audit's mode for the effective policy (E2); an option of the other language is left out. */
export declare function auditMode(resolution: PolicyResolution): {
    tsDiagnostics?: AuthorPolicy['tsDiagnostics'];
    jsCheck?: AuthorPolicy['jsCheck'];
};
/** The generator's options for the effective policy; a JavaScript request carries no import emit. */
export declare function generatorOptions(resolution: PolicyResolution): {
    inputs: AuthorPolicy['inputs'];
    keyOrder: AuthorPolicy['keyOrder'];
    classFields: AuthorPolicy['classFields'];
    importEmit?: AuthorPolicy['importEmit'];
};
