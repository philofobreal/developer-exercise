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
import { fnv1a64 } from './fingerprint.js';
export const POLICY_SCHEMA = 'author-policy-v1';
const OPTIONS = {
    inputs: { values: ['any', 'valid'], fallback: 'any', label: 'Bemenetek' },
    keyOrder: { values: ['observed', 'ignored'], fallback: 'observed', label: 'Objektumkulcsok sorrendje' },
    classFields: { values: ['either', 'define'], fallback: 'either', label: 'Osztálymezők' },
    importEmit: { values: ['verbatim', 'elide-unused'], fallback: 'verbatim', label: 'Importok kibocsátása', languages: ['typescript'] },
    portability: { values: ['configured', 'conservative'], fallback: 'configured', label: 'Hordozhatóság' },
    unknownPolicy: { values: ['warn', 'block'], fallback: 'warn', label: 'Nem eldönthető eredmények' },
    tsDiagnostics: { values: ['baseline', 'strict'], fallback: 'baseline', label: 'TypeScript-diagnosztika', languages: ['typescript'] },
    jsCheck: { values: ['off', 'on'], fallback: 'off', label: 'JavaScript típusellenőrzés', languages: ['javascript'] },
    objectState: { values: ['off', 'local'], fallback: 'local', label: 'Helyi objektumállapot' }
};
/** The source-contract options keep their top-level request names; the newer ones live under `policy`. */
const TOP_LEVEL = ['inputs', 'keyOrder', 'classFields', 'importEmit'];
const NESTED = ['portability', 'unknownPolicy', 'tsDiagnostics', 'jsCheck', 'objectState'];
/** C01–C04: the conservative preset and the strict value of each source-contract option. */
const CONSERVATIVE = [
    { path: 'inputs', value: 'any', rule: 'C01', reason: 'A konzervatív sorrend nem tételezhet fel érvényes bemenetet: minden bemenetet vizsgál.' },
    { path: 'keyOrder', value: 'observed', rule: 'C02', reason: 'A konzervatív sorrend nem enged bizonyítatlan kulcssorrend-cserét.' },
    { path: 'classFields', value: 'either', rule: 'C03', reason: 'A konzervatív sorrend mindkét osztálymező-módban helyes sorrendet kér (a natív JS-mező önmagában szabványos).' },
    { path: 'importEmit', value: 'verbatim', rule: 'C04', reason: 'A konzervatív sorrend minden importot megtartottnak vesz; a buildkörnyezet így sem bizonyított.' }
];
const text = (value) => typeof value === 'string' ? value : undefined;
/** Resolves a compile request (`inputs`, `keyOrder`, `classFields`, `importEmit` at the top level,
 * `policy: {portability, unknownPolicy}`) into the effective author policy. Never throws. */
export function resolveAuthorPolicy(request) {
    const language = request['language'] === 'typescript' ? 'typescript' : 'javascript';
    const conflicts = [], locks = [], inactive = [];
    const requested = {};
    const nested = request['policy'];
    if (nested !== undefined && (typeof nested !== 'object' || nested === null || Array.isArray(nested)))
        conflicts.push({ code: 'C33', path: 'policy', message: 'A policy objektum kell legyen.', blocking: true });
    const policy = typeof nested === 'object' && nested !== null && !Array.isArray(nested) ? nested : {};
    // C33: an option the analysis does not implement is refused, never silently ignored.
    for (const key of Object.keys(policy))
        if (!NESTED.includes(key))
            conflicts.push({ code: 'C33', path: 'policy.' + key, message: `Ismeretlen vagy még nem megvalósított elemzési beállítás: ${key}.`, blocking: true });
    const effective = {};
    for (const path of [...TOP_LEVEL, ...NESTED]) {
        const option = OPTIONS[path], raw = (TOP_LEVEL.includes(path) ? request : policy)[path];
        if (raw === undefined) {
            effective[path] = option.fallback;
            continue;
        }
        const value = text(raw);
        if (value === undefined || !option.values.includes(value)) {
            conflicts.push({ code: 'C33', path, message: `${option.label}: érvénytelen érték (${String(raw)}); megengedett: ${option.values.join(', ')}.`, blocking: true });
            effective[path] = option.fallback;
            continue;
        }
        requested[path] = value;
        effective[path] = value;
    }
    // C12: a TypeScript-only option has no meaning for JavaScript; the request keeps it for a later switch back.
    for (const path of [...TOP_LEVEL, ...NESTED]) {
        const only = OPTIONS[path].languages;
        if (only && !only.includes(language) && requested[path] !== undefined)
            inactive.push({ path, reason: `${OPTIONS[path].label}: csak ${only.join(', ')} nyelvnél érvényes.` });
    }
    if (effective.portability === 'conservative')
        for (const lock of CONSERVATIVE) {
            if (OPTIONS[lock.path].languages && !OPTIONS[lock.path].languages.includes(language))
                continue;
            if (effective[lock.path] !== lock.value)
                locks.push({ path: lock.path, requested: requested[lock.path], effective: lock.value, rule: lock.rule, reason: lock.reason });
            effective[lock.path] = lock.value;
        }
    const resolved = effective;
    const canonical = JSON.stringify({ schema: POLICY_SCHEMA, language, effective: Object.fromEntries([...TOP_LEVEL, ...NESTED].filter(path => !OPTIONS[path].languages || OPTIONS[path].languages.includes(language)).map(path => [path, resolved[path]])) });
    return { schema: POLICY_SCHEMA, language, requested, effective: resolved, locks, inactive, conflicts, fingerprint: 'p1-' + fnv1a64(canonical) };
}
/** The source contract an imported model recorded (`authoring.evidence.environment`), as request fields. */
export function recordedContract(model) {
    const environment = model.authoring?.evidence?.environment ?? {};
    return Object.fromEntries(TOP_LEVEL.filter(path => typeof environment[path] === 'string').map(path => [path, environment[path]]));
}
/** The blocking conflicts as one author-facing message, or '' when the policy is admissible. */
export const policyRefusal = (resolution) => resolution.conflicts.filter(conflict => conflict.blocking).map(conflict => conflict.message).join(' ');
/** The language audit's mode for the effective policy (E2); an option of the other language is left out. */
export function auditMode(resolution) {
    return resolution.language === 'typescript' ? { tsDiagnostics: resolution.effective.tsDiagnostics } : { jsCheck: resolution.effective.jsCheck };
}
/** The generator's options for the effective policy; a JavaScript request carries no import emit. */
export function generatorOptions(resolution) {
    const { inputs, keyOrder, classFields, importEmit } = resolution.effective;
    return { inputs, keyOrder, classFields, ...(resolution.language === 'typescript' ? { importEmit } : {}) };
}
//# sourceMappingURL=config-resolver.js.map