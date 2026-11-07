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
import type { ReferenceAudit } from '../reference-audit.js';
import type { PolicyResolution } from './config-resolver.js';
export type GateVerdict = 'passed' | 'blocked' | 'inconclusive';
export interface GateDiagnostic {
    line: number;
    code: string;
    message: string;
    certainty: 'definite' | 'unknown';
    origin: 'compiler' | 'environment';
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
export declare function sourceGate(audit: ReferenceAudit, policy: PolicyResolution): SourceGate;
