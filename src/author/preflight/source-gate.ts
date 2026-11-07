/** First author gate, Source → Rules (ADR-108, E5a). Author-only; never runs for learner input.
 *
 * Decides from the language audit of the reference (ADR-016) and the effective author policy:
 *  - a definite language error (a TypeScript compile error, a JavaScript binding or grammar error)
 *    always blocks; no option weakens it;
 *  - a result the audit could not establish (`unverifiable`: missing project context; `not-run`: no
 *    standard library, as on Pages) is `inconclusive`, never `passed`; the policy's `unknownPolicy`
 *    lets it through with a warning (`warn`) or blocks it (`block`);
 *  - a possible error (only a JavaScript type check reports it, E2) is `inconclusive` under the same policy;
 *  - a definite binding-safety finding (E3: access before initialization, directly or through a call)
 *    blocks like a language error; it needs no standard library, so it blocks on Pages too; a spent
 *    analysis budget is unknown;
 *  - only a clean audit and a clean binding analysis are `passed`: no error found within the supported scope.
 * The audit's own certainty is kept per diagnostic: definite, possible (type check only) or unknown (context).
 */
import type {ReferenceAudit} from '../reference-audit.js';
import type {PolicyResolution} from './config-resolver.js';
import type {RuntimeAnalysis} from './binding-safety.js';

export type GateVerdict = 'passed' | 'blocked' | 'inconclusive';
export interface GateDiagnostic {line: number; code: string; message: string; certainty: 'definite' | 'possible' | 'unknown'; origin: 'compiler' | 'environment' | 'runtime-order' | 'runtime-value';}
export interface SourceGate {
 gate: 'source-to-rules';
 verdict: GateVerdict;
 /** Whether the flow may continue to model generation. */
 admitted: boolean;
 completeness: 'within-supported-scope' | 'partial' | 'not-run';
 /** Author-facing summary (Hungarian), empty when passed. */
 message: string;
 diagnostics: GateDiagnostic[];
 policyFingerprint: string;
 assumptions: string[];
}

const describe = (diagnostics: readonly GateDiagnostic[]): string => diagnostics.slice(0, 5).map(d => `${d.line}. sor: ${d.message} (${d.code})`).join(' · ');

/** The compiler's own access-before-declaration codes; a binding finding on the same line repeats them. */
const TDZ_CODES = new Set(['TS2448', 'TS2449', 'TS2450']);

export function sourceGate(audit: ReferenceAudit, policy: PolicyResolution, binding?: RuntimeAnalysis): SourceGate {
 const compiled: GateDiagnostic[] = audit.diagnostics.map(d => ({line: d.line, code: 'TS' + d.code, message: d.message, certainty: d.certainty, origin: d.context ? 'environment' : 'compiler'}));
 // C35: one list. A definite compiler report on a line stays the one report there (TDZ, not callable…);
 // a runtime finding replaces a possible TDZ report of the type check on its line.
 const found = (binding?.findings ?? []).filter(f => !compiled.some(d => d.line === f.line && d.certainty === 'definite'));
 const diagnostics: GateDiagnostic[] = [...compiled.filter(d => !(d.certainty === 'possible' && TDZ_CODES.has(d.code) && found.some(f => f.line === d.line))), ...found.map(f => ({line: f.line, code: f.code, message: f.message, certainty: f.certainty, origin: f.origin}))].sort((a, b) => a.line - b.line);
 const base = {gate: 'source-to-rules' as const, diagnostics, policyFingerprint: policy.fingerprint, assumptions: binding ? [...audit.assumptions, 'binding-safety'] : audit.assumptions};
 if (audit.semantics === 'errors' || found.length) {
  const definite = diagnostics.filter(d => d.certainty === 'definite');
  const what = audit.semantics === 'errors' ? 'nyelvi hibát tartalmaz' : found.some(f => f.origin === 'runtime-order') ? 'futáskor biztosan hibát dob (inicializálás előtti hozzáférés)' : 'futáskor biztosan hibát dob (null/undefined vagy nem hívható érték)';
  return {...base, verdict: 'blocked', admitted: false, completeness: 'within-supported-scope', message: `A referencia ${what}, ezért nem készült modell; a korábbi modell megmaradt. ${describe(definite)}`};
 }
 const blocked = policy.effective.unknownPolicy === 'block';
 const possible = diagnostics.filter(d => d.certainty === 'possible');
 if (binding?.completeness === 'budget-exceeded') return {...base, verdict: 'inconclusive', admitted: !blocked, completeness: 'partial',
  message: `A kötéselemzés túllépte a költségkeretét, ezért nem teljes.${blocked ? ' A „tilt” beállítás miatt nem készült modell; ez nem jelenti, hogy a forrás hibás.' : ' Továbbléphetsz, de a forrás nem tekinthető ellenőrzöttnek.'}`};
 if (audit.semantics === 'ok' && !possible.length) return {...base, verdict: 'passed', admitted: true, completeness: 'within-supported-scope', message: ''};
 // E2: a JavaScript type check's finding is a possible error: the program may still run as meant.
 if (audit.semantics === 'ok') return {...base, verdict: 'inconclusive', admitted: !blocked, completeness: 'within-supported-scope',
  message: `A típusellenőrzés lehetséges hibát jelez (a JavaScript ettől még lefuthat). ${describe(possible)}${blocked ? ' A „tilt” beállítás miatt nem készült modell.' : ' Továbbléphetsz, de a forrás nem tekinthető ellenőrzöttnek.'}`};
 const why = audit.semantics === 'not-run'
  ? 'A nyelvi ellenőrzés itt nem futott le (nincs standard könyvtár, például a Local Demóban).'
  : `A forrás egy része projektkontextus nélkül nem ellenőrizhető${audit.unresolved.length ? ` (feloldatlan: ${audit.unresolved.slice(0, 5).join(', ')})` : ''}.`;
 return {...base, verdict: 'inconclusive', admitted: !blocked, completeness: audit.semantics === 'not-run' ? 'not-run' : 'partial',
  message: blocked ? `${why} A „tilt” beállítás miatt nem készült modell; ez nem jelenti, hogy a forrás hibás.` : `${why} Továbbléphetsz, de a forrás nem tekinthető ellenőrzöttnek.`};
}
