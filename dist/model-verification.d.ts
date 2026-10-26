import { type CodeLineExercise, type DependencyPolicy } from './code-line.js';
export type VerificationStatus = 'analysis-verified' | 'conservative' | 'author-modified' | 'unverified';
export interface VerificationInput {
    /** The admitting party's language audit of the reference (ADR-016). */
    audit?: 'ok' | 'errors' | 'unverifiable' | 'not-run';
    /** Whether the generated constraints equal a fresh regeneration of the source. */
    rederivation?: 'match' | 'differs';
    /** The analyser version of that regeneration. */
    currentAnalyzer?: DependencyPolicy;
    /** Projection loss of that regeneration; otherwise the bound evidence's own figure. */
    projectionLoss?: number;
    /** Search budget per verdict (production: 50 000) and the number of adjacent swaps probed. */
    maxStates?: number;
    neighbours?: number;
}
export interface VerificationClaim {
    claim: string;
    basis: 'checked' | 'tested' | 'not-established' | 'refuted';
}
export interface ModelVerification {
    status: VerificationStatus;
    publishable: boolean;
    checks: {
        admission: 'ok' | 'failed';
        reference: 'accepted' | 'rejected' | 'indeterminate' | 'not-run';
        budget: {
            probed: number;
            indeterminate: number;
            maxStates: number;
        };
        provenance: 'complete' | 'partial' | 'absent' | 'unbound';
        rederivation: 'match' | 'differs' | 'not-run';
        analyzer: 'current' | 'outdated' | 'unknown';
        audit: 'ok' | 'errors' | 'unverifiable' | 'not-run';
        /** Constraints whose strongest reason is a conservative fallback, by reason code. */
        fallbacks: {
            count: number;
            codes: Record<string, number>;
        };
        projectionLoss: number | null;
        /** Author-made narrowing: rules with `author` provenance, fixed slots, profiles. */
        authorRules: number;
        fixed: number;
        profiles: number;
        /** Generated constraints the author removed: `conservative` ones and policy overrides. */
        relaxations: {
            conservative: number;
            overrides: number;
        };
    };
    /** Why the status or publishability is not higher, in Hungarian. */
    findings: string[];
    claims: VerificationClaim[];
}
export declare function verifyModel(model: CodeLineExercise, input?: VerificationInput): ModelVerification;
