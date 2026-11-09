/** Second author gate, Rules → Try (ADR-108, E6). Author-only; the learner path never passes it.
 *
 * A draft carries the snapshot of its first gate: the reviewed source, the effective policy and the
 * first gate's decision. Entering the Try step (and so every preview evaluation, which the server
 * refuses for a draft that has not passed here) needs:
 *  - a snapshot at all (a draft admitted through the first gate);
 *  - the author's current source and policy to be the ones the snapshot was made from (C26, C36);
 *    otherwise the evidence is stale and the model must be made again;
 *  - the model to accept its own reference order (verification `reference: accepted`); a rejected
 *    reference blocks, an undecided one is unknown;
 *  - the model's verification: `unverified` (for example a relaxed proven rule, C29) is unknown, never
 *    passed; a first gate that was itself inconclusive stays so.
 * Unknown follows the policy's `unknownPolicy` (warn lets through, block stops). A rule edit makes a new
 * draft, so the gate is passed again (C28). The proof names what was checked by fingerprints.
 *
 * `tryReadiness` is the same decision for the source and policy the draft was made from: every draft response
 * carries it, so a client can open the step without asking again; whether its current text is still that
 * source is the client's to know, and a preview is refused by the server all the same when it is not.
 */
import type {PolicyResolution} from './config-resolver.js';
import type {SourceGate} from './source-gate.js';
import {modelFingerprint, normalizeSource, sourceFingerprint} from './fingerprint.js';

export interface SourceSnapshot {sourceFingerprint: string; policy: PolicyResolution; gate: SourceGate;}
export interface RulesProof {sourceFingerprint: string; policyFingerprint: string; modelFingerprint: string; analyzer: string; verification: string;}
export interface RulesGate {gate: 'rules-to-try'; verdict: 'passed' | 'blocked' | 'inconclusive'; admitted: boolean; message: string; reasons: string[]; proof?: RulesProof;}

export const snapshotOf = (source: string, policy: PolicyResolution, gate: SourceGate): SourceSnapshot => ({sourceFingerprint: sourceFingerprint(normalizeSource(source)), policy, gate});

export interface RulesGateInput {
 snapshot: SourceSnapshot | undefined;
 /** The author's current source and the policy resolved from the current request. */
 current: {source: unknown; policy: PolicyResolution};
 model: {lines: unknown; blocks?: unknown; edges?: unknown; profiles?: unknown; dependencyMode?: unknown};
 verification: {status: string; checks: {reference: string}; findings?: readonly string[]} | undefined;
 /** The analysis versions the proof depends on (rule version, compiler version). */
 analyzer: string;
}

const blocked = (reasons: string[]): RulesGate => ({gate: 'rules-to-try', verdict: 'blocked', admitted: false, reasons, message: `A Próba lépés nem nyitható meg: ${reasons.join(' ')}`});

export function rulesGate(input: RulesGateInput): RulesGate {
 const {snapshot, current, verification} = input;
 if (!snapshot) return blocked(['Ehhez a modellhez nincs első kapus ellenőrzés; készítsd el a modellt a Forrás lépésben.']);
 if (typeof current.source !== 'string') return blocked(['Hiányzik a jelenlegi forrás.']);
 const stale: string[] = [];
 if (sourceFingerprint(current.source) !== snapshot.sourceFingerprint) stale.push('A forrás a modell készítése óta változott; készítsd újra a modellt, vagy vesd el a változtatást.');
 if (current.policy.fingerprint !== snapshot.policy.fingerprint) stale.push('Az elemzési beállítások a modell készítése óta változtak; készítsd újra a modellt.');
 if (stale.length) return blocked(stale);
 return tryReadiness({snapshot, model: input.model, verification, analyzer: input.analyzer});
}

/** The second gate for the draft's own source and policy (no staleness to check). */
export function tryReadiness(input: Omit<RulesGateInput, 'current' | 'snapshot'> & {snapshot: SourceSnapshot | undefined}): RulesGate {
 const {snapshot, verification} = input;
 if (!snapshot) return blocked(['Ehhez a modellhez nincs első kapus ellenőrzés; készítsd el a modellt a Forrás lépésben.']);
 if (!snapshot.gate.admitted) return blocked(['Az első kapu nem engedte tovább a forrást.']);
 if (!verification || verification.checks.reference === 'rejected') return blocked(['A modell nem fogadja el a saját referenciasorrendjét.']);
 const unknown: string[] = [];
 if (snapshot.gate.verdict === 'inconclusive') unknown.push('A forrás vizsgálata nem volt teljes (első kapu).');
 if (verification.checks.reference !== 'accepted') unknown.push('A referenciasorrend elfogadása nem dőlt el.');
 if (verification.status === 'unverified') unknown.push(`A modell minősítése: nem igazolt${verification.findings?.length ? ` (${verification.findings.slice(0, 2).join(' ')})` : ''}.`);
 const proof: RulesProof = {sourceFingerprint: snapshot.sourceFingerprint, policyFingerprint: snapshot.policy.fingerprint, modelFingerprint: modelFingerprint(input.model), analyzer: input.analyzer, verification: verification.status};
 if (!unknown.length) return {gate: 'rules-to-try', verdict: 'passed', admitted: true, reasons: [], message: '', proof};
 const block = snapshot.policy.effective.unknownPolicy === 'block';
 return {gate: 'rules-to-try', verdict: 'inconclusive', admitted: !block, reasons: unknown, proof,
  message: block ? `A Próba lépés nem nyitható meg a „tilt” beállítás miatt: ${unknown.join(' ')}` : `Továbbléphetsz a Próbára, de a modell nem tekinthető teljesen ellenőrzöttnek: ${unknown.join(' ')}`};
}
