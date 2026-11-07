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
    /** E4: `local` reports a definite TypeError on a local binding whose value is known from its declaration
     * (a null/undefined dereference, a call of a non-callable literal). */
    objectState: 'off' | 'local';
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
/** C16: a value the analysis cannot carry out where it runs (no standard library, e.g. the Local Demo). */
export interface PolicyUnavailable {
    path: PolicyPath;
    value: string;
    reason: string;
}
/** Where the analysis runs. `languageAudit: false`: the language audit cannot run (no standard library). */
export interface PolicyEnvironment {
    languageAudit?: boolean;
}
export interface PolicyResolution {
    schema: typeof POLICY_SCHEMA;
    language: PolicyLanguage;
    requested: Partial<Record<PolicyPath, string>>;
    effective: AuthorPolicy;
    locks: PolicyLock[];
    inactive: PolicyNote[];
    conflicts: PolicyConflict[];
    /** C16: values not offered here, whatever was asked; a request for one is a conflict or an inactive note. */
    unavailable: PolicyUnavailable[];
    fingerprint: string;
}
/** Resolves a compile request (`inputs`, `keyOrder`, `classFields`, `importEmit` at the top level,
 * `policy: {portability, unknownPolicy}`) into the effective author policy where it runs. Never throws. */
export declare function resolveAuthorPolicy(request: Readonly<Record<string, unknown>>, environment?: PolicyEnvironment): PolicyResolution;
/** The source contract an imported model recorded (`authoring.evidence.environment`), as request fields. */
export declare function recordedContract(model: {
    authoring?: {
        evidence?: {
            environment?: Readonly<Record<string, unknown>>;
        };
    };
}): Partial<Record<'inputs' | 'keyOrder' | 'classFields' | 'importEmit', string>>;
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
