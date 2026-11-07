/** First author gate, Source → Rules (ADR-108, E5a). Author-only; never runs for learner input.
 *
 * Decides from the language audit of the reference (ADR-016) and the effective author policy:
 *  - a definite language error (a TypeScript compile error, a JavaScript binding or grammar error)
 *    always blocks; no option weakens it;
 *  - a result the audit could not establish (`unverifiable`: missing project context; `not-run`: no
 *    standard library, as on Pages) is `inconclusive`, never `passed`; the policy's `unknownPolicy`
 *    lets it through with a warning (`warn`) or blocks it (`block`);
 *  - only a clean audit is `passed`, meaning: no error found within the audit's supported scope.
 * The audit's own certainty is kept: its non-context diagnostics are definite, its context ones unknown.
 */
import type {ReferenceAudit} from '../reference-audit.js';
import type {PolicyResolution} from './config-resolver.js';

export type GateVerdict = 'passed' | 'blocked' | 'inconclusive';
export interface GateDiagnostic {line: number; code: string; message: string; certainty: 'definite' | 'unknown'; origin: 'compiler' | 'environment';}
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

export function sourceGate(audit: ReferenceAudit, policy: PolicyResolution): SourceGate {
 const diagnostics: GateDiagnostic[] = audit.diagnostics.map(d => ({line: d.line, code: 'TS' + d.code, message: d.message, certainty: d.context ? 'unknown' : 'definite', origin: d.context ? 'environment' : 'compiler'}));
 const base = {gate: 'source-to-rules' as const, diagnostics, policyFingerprint: policy.fingerprint, assumptions: audit.assumptions};
 if (audit.semantics === 'errors') {
  const definite = diagnostics.filter(d => d.certainty === 'definite');
  return {...base, verdict: 'blocked', admitted: false, completeness: 'within-supported-scope', message: `A referencia nyelvi hibát tartalmaz, ezért nem készült modell; a korábbi modell megmaradt. ${describe(definite)}`};
 }
 if (audit.semantics === 'ok') return {...base, verdict: 'passed', admitted: true, completeness: 'within-supported-scope', message: ''};
 const blocked = policy.effective.unknownPolicy === 'block';
 const why = audit.semantics === 'not-run'
  ? 'A nyelvi ellenőrzés itt nem futott le (nincs standard könyvtár, például a Local Demóban).'
  : `A forrás egy része projektkontextus nélkül nem ellenőrizhető${audit.unresolved.length ? ` (feloldatlan: ${audit.unresolved.slice(0, 5).join(', ')})` : ''}.`;
 return {...base, verdict: 'inconclusive', admitted: !blocked, completeness: audit.semantics === 'not-run' ? 'not-run' : 'partial',
  message: blocked ? `${why} A „tilt” beállítás miatt nem készült modell; ez nem jelenti, hogy a forrás hibás.` : `${why} Továbbléphetsz, de a forrás nem tekinthető ellenőrzöttnek.`};
}
