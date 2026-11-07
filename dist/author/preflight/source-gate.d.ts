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
import type { ReferenceAudit } from '../reference-audit.js';
import type { PolicyResolution } from './config-resolver.js';
import type { RuntimeAnalysis } from './binding-safety.js';
export type GateVerdict = 'passed' | 'blocked' | 'inconclusive';
export interface GateDiagnostic {
    line: number;
    code: string;
    message: string;
    certainty: 'definite' | 'possible' | 'unknown';
    origin: 'compiler' | 'environment' | 'runtime-order' | 'runtime-value';
}
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
export declare function sourceGate(audit: ReferenceAudit, policy: PolicyResolution, binding?: RuntimeAnalysis): SourceGate;
