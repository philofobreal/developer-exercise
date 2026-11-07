import { modelFingerprint, normalizeSource, sourceFingerprint } from './fingerprint.js';
export const snapshotOf = (source, policy, gate) => ({ sourceFingerprint: sourceFingerprint(normalizeSource(source)), policy, gate });
export function rulesGate(input) {
    const blocked = (reasons) => ({ gate: 'rules-to-try', verdict: 'blocked', admitted: false, reasons, message: `A Próba lépés nem nyitható meg: ${reasons.join(' ')}` });
    const { snapshot, current, verification } = input;
    if (!snapshot)
        return blocked(['Ehhez a modellhez nincs első kapus ellenőrzés; készítsd el a modellt a Forrás lépésben.']);
    if (typeof current.source !== 'string')
        return blocked(['Hiányzik a jelenlegi forrás.']);
    const stale = [];
    if (sourceFingerprint(current.source) !== snapshot.sourceFingerprint)
        stale.push('A forrás a modell készítése óta változott; készítsd újra a modellt, vagy vesd el a változtatást.');
    if (current.policy.fingerprint !== snapshot.policy.fingerprint)
        stale.push('Az elemzési beállítások a modell készítése óta változtak; készítsd újra a modellt.');
    if (stale.length)
        return blocked(stale);
    if (!snapshot.gate.admitted)
        return blocked(['Az első kapu nem engedte tovább a forrást.']);
    if (!verification || verification.checks.reference === 'rejected')
        return blocked(['A modell nem fogadja el a saját referenciasorrendjét.']);
    const unknown = [];
    if (snapshot.gate.verdict === 'inconclusive')
        unknown.push('A forrás ellenőrzése nem volt teljes (első kapu).');
    if (verification.checks.reference !== 'accepted')
        unknown.push('A referenciasorrend elfogadása nem dőlt el.');
    if (verification.status === 'unverified')
        unknown.push(`A modell minősítése: nem igazolt${verification.findings?.length ? ` (${verification.findings.slice(0, 2).join(' ')})` : ''}.`);
    const proof = { sourceFingerprint: snapshot.sourceFingerprint, policyFingerprint: snapshot.policy.fingerprint, modelFingerprint: modelFingerprint(input.model), analyzer: input.analyzer, verification: verification.status };
    if (!unknown.length)
        return { gate: 'rules-to-try', verdict: 'passed', admitted: true, reasons: [], message: '', proof };
    const block = current.policy.effective.unknownPolicy === 'block';
    return { gate: 'rules-to-try', verdict: 'inconclusive', admitted: !block, reasons: unknown, proof,
        message: block ? `A Próba lépés nem nyitható meg a „tilt” beállítás miatt: ${unknown.join(' ')}` : `Továbbléphetsz a Próbára, de a modell nem tekinthető teljesen ellenőrzöttnek: ${unknown.join(' ')}` };
}
//# sourceMappingURL=rules-gate.js.map