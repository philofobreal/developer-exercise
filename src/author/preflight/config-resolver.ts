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
export const POLICY_SCHEMA = 'author-policy-v1';
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
}
export type PolicyPath = keyof AuthorPolicy;
export interface PolicyLock {path: PolicyPath; requested: string | undefined; effective: string; rule: string; reason: string;}
export interface PolicyNote {path: PolicyPath; reason: string;}
export interface PolicyConflict {code: string; path: string; message: string; blocking: boolean;}
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

interface Option {values: readonly string[]; fallback: string; label: string; languages?: readonly PolicyLanguage[];}
const OPTIONS: Readonly<Record<PolicyPath, Option>> = {
 inputs: {values: ['any', 'valid'], fallback: 'any', label: 'Bemenetek'},
 keyOrder: {values: ['observed', 'ignored'], fallback: 'observed', label: 'Objektumkulcsok sorrendje'},
 classFields: {values: ['either', 'define'], fallback: 'either', label: 'Osztálymezők'},
 importEmit: {values: ['verbatim', 'elide-unused'], fallback: 'verbatim', label: 'Importok kibocsátása', languages: ['typescript']},
 portability: {values: ['configured', 'conservative'], fallback: 'configured', label: 'Hordozhatóság'},
 unknownPolicy: {values: ['warn', 'block'], fallback: 'warn', label: 'Nem eldönthető eredmények'}
};
/** The source-contract options keep their top-level request names; the newer ones live under `policy`. */
const TOP_LEVEL: readonly PolicyPath[] = ['inputs', 'keyOrder', 'classFields', 'importEmit'];
const NESTED: readonly PolicyPath[] = ['portability', 'unknownPolicy'];
/** C01–C04: the conservative preset and the strict value of each source-contract option. */
const CONSERVATIVE: readonly {path: PolicyPath; value: string; rule: string; reason: string}[] = [
 {path: 'inputs', value: 'any', rule: 'C01', reason: 'A konzervatív sorrend nem tételezhet fel érvényes bemenetet: minden bemenetet vizsgál.'},
 {path: 'keyOrder', value: 'observed', rule: 'C02', reason: 'A konzervatív sorrend nem enged bizonyítatlan kulcssorrend-cserét.'},
 {path: 'classFields', value: 'either', rule: 'C03', reason: 'A konzervatív sorrend mindkét osztálymező-módban helyes sorrendet kér (a natív JS-mező önmagában szabványos).'},
 {path: 'importEmit', value: 'verbatim', rule: 'C04', reason: 'A konzervatív sorrend minden importot megtartottnak vesz; a buildkörnyezet így sem bizonyított.'}
];

const text = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined;
/** FNV-1a, 64 bit, over the canonical policy text: an identifier, not a credential. */
function fnv1a64(input: string): string {
 let hash = 0xcbf29ce484222325n;
 for (let i = 0; i < input.length; i++) {hash ^= BigInt(input.charCodeAt(i)); hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;}
 return hash.toString(16).padStart(16, '0');
}

/** Resolves a compile request (`inputs`, `keyOrder`, `classFields`, `importEmit` at the top level,
 * `policy: {portability, unknownPolicy}`) into the effective author policy. Never throws. */
export function resolveAuthorPolicy(request: Readonly<Record<string, unknown>>): PolicyResolution {
 const language: PolicyLanguage = request['language'] === 'typescript' ? 'typescript' : 'javascript';
 const conflicts: PolicyConflict[] = [], locks: PolicyLock[] = [], inactive: PolicyNote[] = [];
 const requested: Partial<Record<PolicyPath, string>> = {};
 const nested = request['policy'];
 if (nested !== undefined && (typeof nested !== 'object' || nested === null || Array.isArray(nested))) conflicts.push({code: 'C33', path: 'policy', message: 'A policy objektum kell legyen.', blocking: true});
 const policy: Readonly<Record<string, unknown>> = typeof nested === 'object' && nested !== null && !Array.isArray(nested) ? nested as Record<string, unknown> : {};
 // C33: an option the analysis does not implement is refused, never silently ignored.
 for (const key of Object.keys(policy)) if (!(NESTED as readonly string[]).includes(key)) conflicts.push({code: 'C33', path: 'policy.' + key, message: `Ismeretlen vagy még nem megvalósított elemzési beállítás: ${key}.`, blocking: true});
 const effective = {} as Record<PolicyPath, string>;
 for (const path of [...TOP_LEVEL, ...NESTED]) {
  const option = OPTIONS[path], raw = (TOP_LEVEL.includes(path) ? request : policy)[path];
  if (raw === undefined) {effective[path] = option.fallback; continue;}
  const value = text(raw);
  if (value === undefined || !option.values.includes(value)) {
   conflicts.push({code: 'C33', path, message: `${option.label}: érvénytelen érték (${String(raw)}); megengedett: ${option.values.join(', ')}.`, blocking: true});
   effective[path] = option.fallback; continue;
  }
  requested[path] = value; effective[path] = value;
 }
 // C12: a TypeScript-only option has no meaning for JavaScript; the request keeps it for a later switch back.
 for (const path of [...TOP_LEVEL, ...NESTED]) {
  const only = OPTIONS[path].languages;
  if (only && !only.includes(language) && requested[path] !== undefined) inactive.push({path, reason: `${OPTIONS[path].label}: csak ${only.join(', ')} nyelvnél érvényes.`});
 }
 if (effective.portability === 'conservative') for (const lock of CONSERVATIVE) {
  if (OPTIONS[lock.path].languages && !OPTIONS[lock.path].languages!.includes(language)) continue;
  if (effective[lock.path] !== lock.value) locks.push({path: lock.path, requested: requested[lock.path], effective: lock.value, rule: lock.rule, reason: lock.reason});
  effective[lock.path] = lock.value;
 }
 const resolved = effective as unknown as AuthorPolicy;
 const canonical = JSON.stringify({schema: POLICY_SCHEMA, language, effective: Object.fromEntries([...TOP_LEVEL, ...NESTED].filter(path => !OPTIONS[path].languages || OPTIONS[path].languages!.includes(language)).map(path => [path, resolved[path]]))});
 return {schema: POLICY_SCHEMA, language, requested, effective: resolved, locks, inactive, conflicts, fingerprint: 'p1-' + fnv1a64(canonical)};
}

/** The blocking conflicts as one author-facing message, or '' when the policy is admissible. */
export const policyRefusal = (resolution: PolicyResolution): string => resolution.conflicts.filter(conflict => conflict.blocking).map(conflict => conflict.message).join(' ');

/** The generator's options for the effective policy; a JavaScript request carries no import emit. */
export function generatorOptions(resolution: PolicyResolution): {inputs: AuthorPolicy['inputs']; keyOrder: AuthorPolicy['keyOrder']; classFields: AuthorPolicy['classFields']; importEmit?: AuthorPolicy['importEmit']} {
 const {inputs, keyOrder, classFields, importEmit} = resolution.effective;
 return {inputs, keyOrder, classFields, ...(resolution.language === 'typescript' ? {importEmit} : {})};
}
