/** Model Verification Gate (ADR-017): what an admitted CodeLine v2 model may claim.
 *
 * Admission proves shape, graph, scopes and that the reference is accepted. This gate
 * adds the evidence a published model needs and keeps three kinds of claim apart:
 * `checked` (established now for this model), `tested` (rests on the generator's
 * proof sketch and its finite independent tests, not on this model) and
 * `not-established`; a contradicted claim is `refuted`. It never executes the
 * reference or any submission, and it never changes a verdict.
 *
 * Status, strongest first:
 *  - `analysis-verified`: every constraint is a re-derived consequence of the current
 *    analysis, with no conservative fallback, no projection loss and no author rule;
 *  - `conservative`: the same, but fallbacks or projection loss may reject valid orders;
 *  - `author-modified`: author rules, fixed slots or OR profiles deliberately narrow the
 *    generated model (the generator emits none of them);
 *  - `unverified`: the provenance is missing, unbound or not re-derived, the model
 *    differs from its regeneration, the reference has a language error, or the author
 *    removed a generated constraint (ADR-018): an author's acknowledgement is no proof.
 * `publishable` additionally requires the reference, every adjacent swap and the hard probes
 * (ADR-036) to be decided within the production search budget and the reference to be free of language
 * errors (ADR-035): a definite error blocks publication under every policy, while a
 * missing context (`unverifiable`) or an audit that did not run only lowers the claims.
 */
import { validateSubmission } from './validator.js';
import { compileCodeLineExercise } from './code-line.js';
import { explainConstraints } from './constraint-explanation.js';
import { evidenceStatus } from './evidence.js';
import { contentKey } from './content-match.js';
export function verifyModel(model, input = {}) {
    const maxStates = input.maxStates ?? 50_000, findings = [];
    const checks = {
        admission: 'failed', reference: 'not-run', budget: { probed: 0, indeterminate: 0, maxStates }, provenance: 'absent',
        rederivation: input.rederivation ?? 'not-run', analyzer: 'unknown', audit: input.audit ?? 'not-run',
        fallbacks: { count: 0, codes: {} }, projectionLoss: null, authorRules: 0, fixed: model.lines.filter(line => line.fixed).length, profiles: model.profiles?.length ?? 0,
        relaxations: { conservative: (model.authoring?.relaxations ?? []).filter(entry => entry.editability === 'conservative').length, overrides: (model.authoring?.relaxations ?? []).filter(entry => entry.editability !== 'conservative').length }
    };
    const compiled = compileCodeLineExercise(model);
    if ('status' in compiled)
        return { status: 'unverified', publishable: false, checks, findings: ['A modell befogadása sikertelen: ' + compiled.message], claims: [] };
    checks.admission = 'ok';
    const grade = (lines) => validateSubmission(compiled.compiled, { exerciseId: model.id, revision: model.revision, lines }, { maxStates });
    const referenceResult = grade(model.lines.map(line => line.code));
    checks.reference = referenceResult.status === 'accepted' ? 'accepted' : referenceResult.status === 'indeterminate' ? 'indeterminate' : 'rejected';
    const { probed, undecided } = checks.reference === 'accepted' ? runGateProbes(model, grade, referenceResult.exploredStates, maxStates, input.neighbours) : { probed: 0, undecided: null };
    checks.budget.probed = probed;
    if (undecided)
        checks.budget.indeterminate = 1;
    const explanation = explainConstraints(model);
    if ('status' in explanation)
        return { status: 'unverified', publishable: false, checks, findings: [explanation.message], claims: [] };
    checks.provenance = explanation.provenance;
    const analyzer = model.authoring?.evidence?.analyzer;
    checks.analyzer = !analyzer || !input.currentAnalyzer ? 'unknown' : analyzer === input.currentAnalyzer ? 'current' : 'outdated';
    for (const line of explanation.lines)
        for (const constraint of line.predecessors) {
            if (constraint.reasons.some(reason => reason.category === 'author'))
                checks.authorRules++;
            if (constraint.editability !== 'conservative')
                continue;
            checks.fallbacks.count++;
            for (const reason of constraint.reasons)
                if (reason.category === 'conservative')
                    checks.fallbacks.codes[reason.code] = (checks.fallbacks.codes[reason.code] ?? 0) + 1;
        }
    const bound = evidenceStatus(model) === 'current' ? model.authoring?.evidence?.projectionLoss?.pairs : undefined;
    checks.projectionLoss = input.projectionLoss ?? bound ?? null;
    const publishable = checks.reference === 'accepted' && checks.budget.indeterminate === 0 && checks.audit !== 'errors';
    if (checks.reference !== 'accepted')
        findings.push(checks.reference === 'indeterminate' ? 'A referencia a kereten belül nem dől el.' : 'A modell a saját referenciáját sem fogadja el.');
    if (undecided)
        findings.push(`Egy kapupróba nem dőlt el (${undecided}, ${maxStates} állapot próbánként); a további próbák elmaradtak.`);
    if (checks.audit === 'errors')
        findings.push('Nyelvi hibás referencia nem publikálható.');
    const unverified = [];
    const missing = { partial: 'Néhány kényszernek nincs oka.', absent: 'A modellnek nincs provenienciája (régi vagy importált modell).', unbound: 'A proveniencia nem ezekhez a sorokhoz tartozik.' };
    if (checks.provenance !== 'complete')
        unverified.push(missing[checks.provenance]);
    if (checks.rederivation === 'differs')
        unverified.push('A generált szabályok eltérnek a forrás újragenerálásától (kézi módosítás vagy más elemző).');
    if (checks.rederivation === 'not-run')
        unverified.push('A szabályokat nem vezettük le újra a forrásból.');
    if (checks.audit === 'errors')
        unverified.push('A referencia nyelvi hibát tartalmaz.');
    if (checks.relaxations.conservative)
        unverified.push(`${checks.relaxations.conservative} konzervatív szabályt a szerző eltávolított; a lazítás helyessége nem igazolt.`);
    if (checks.relaxations.overrides)
        unverified.push(`${checks.relaxations.overrides} bizonyított vagy ismeretlen eredetű szabályt a szerző policy-felülírással eltávolított; a modell eltér a sorrendpolitikától.`);
    findings.push(...unverified);
    const limits = [];
    if (checks.fallbacks.count)
        limits.push(`${checks.fallbacks.count} kényszer konzervatív fallback (${Object.keys(checks.fallbacks.codes).join(', ')}).`);
    if (checks.projectionLoss)
        limits.push(`${checks.projectionLoss} egységpárt a v2-projekció rendez, bár az elemzés szabadon hagyta.`);
    if (checks.projectionLoss === null)
        limits.push('A projekciós veszteség nem ismert.');
    if (checks.analyzer === 'outdated')
        limits.push('A modell régebbi szabályverzióval készült.');
    findings.push(...limits);
    if (checks.authorRules)
        findings.push(`${checks.authorRules} szerzői szabály szűkíti a generált modellt.`);
    if (checks.fixed)
        findings.push(`${checks.fixed} sor rögzített pozíciójú (szerzői döntés).`);
    if (checks.profiles)
        findings.push(`${checks.profiles} szerzői OR-profil határozza meg az elfogadott sorrendeket.`);
    if (checks.audit === 'unverifiable')
        findings.push('A referencia nyelvi helyessége projektkontextus nélkül nem ellenőrizhető.');
    if (checks.audit === 'not-run')
        findings.push('A referencia nyelvi auditja nem futott.');
    const status = unverified.length ? 'unverified' : checks.authorRules || checks.fixed || checks.profiles ? 'author-modified' : limits.length ? 'conservative' : 'analysis-verified';
    const analysed = status !== 'unverified';
    const claims = [
        { claim: 'A modell befogadható, és elfogadja a saját referenciáját.', basis: checks.reference === 'accepted' ? 'checked' : 'refuted' },
        { claim: `A szomszédos cserék és a nehéz próbák a produkciós kereten belül eldőlnek (${checks.budget.probed} vizsgált).`, basis: checks.budget.indeterminate ? 'refuted' : checks.reference === 'accepted' ? 'checked' : 'not-established' },
        { claim: 'Minden kényszer oka az aktuális elemzésből újra levezetett.', basis: checks.rederivation === 'match' && checks.provenance === 'complete' ? 'checked' : checks.rederivation === 'differs' ? 'refuted' : 'not-established' },
        { claim: 'Az elfogadott sorrendek a policy szerint egyenértékűek (soundness).', basis: analysed ? 'tested' : 'not-established' },
        { claim: 'A kezelt esetekben nincs indokolatlan elutasítás (completeness).', basis: status === 'analysis-verified' ? 'tested' : 'not-established' },
        { claim: 'A referencia nyelvileg helyes.', basis: checks.audit === 'ok' ? 'checked' : checks.audit === 'errors' ? 'refuted' : 'not-established' }
    ];
    return { status, publishable, checks, findings, claims };
}
/** All gate probes together may explore this many times the per-verdict budget. */
const GATE_BUDGET_FACTOR = 20;
/** Grades the gate probes until one is undecided, which already refuses publication, or the
 * probes together exceed their bound, so an author request cannot hold the server for long
 * (ADR-036). `undecided` names the probe kind, or the exhausted bound. */
function runGateProbes(model, grade, spentOnReference, maxStates, neighbours) {
    const bound = maxStates * GATE_BUDGET_FACTOR;
    let probed = 0, spent = spentOnReference;
    for (const { kind, lines } of gateProbes(model, neighbours)) {
        if (spent >= bound)
            return { probed, undecided: `a kapupróbák ${bound} állapotos összesített kerete` };
        const result = grade(lines);
        probed++;
        spent += result.exploredStates;
        if (result.status === 'indeterminate')
            return { probed, undecided: kind };
    }
    return { probed, undecided: null };
}
/** The submissions the gate grades besides the reference (ADR-036): every adjacent swap (or
 * an even sample of `neighbours`), then the hard probes that put repeated content where a late
 * error forces the search through every way of matching it: up to 100 repeated rows, the last
 * copy first and the first copy last, then the reversed and the end-swapped order. Repetition
 * is the validator's own content key; a submission equal to the reference or to an earlier
 * probe is not graded again. */
function* gateProbes(model, neighbours) {
    const reference = model.lines, n = reference.length, seen = new Set([reference.map(line => line.code).join('\n')]);
    function* fresh(kind, order) {
        const lines = order.map(line => line.code), key = lines.join('\n');
        if (!seen.has(key)) {
            seen.add(key);
            yield { kind, lines };
        }
    }
    const swaps = Math.min(neighbours ?? n - 1, n - 1);
    for (let k = 0; k < swaps; k++) {
        const i = Math.floor(k * (n - 1) / swaps), order = [...reference];
        [order[i], order[i + 1]] = [order[i + 1], order[i]];
        yield* fresh('szomszédos csere', order);
    }
    const copies = new Map();
    for (const line of reference) {
        const key = contentKey(line.code, line.normalization);
        copies.set(key, [...copies.get(key) ?? [], line]);
    }
    const moved = (line, front) => { const rest = reference.filter(other => other !== line); return front ? [line, ...rest] : [...rest, line]; };
    for (const lines of [...copies.values()].filter(lines => lines.length > 1).slice(0, 100)) {
        yield* fresh('ismétlődő sor az elejére', moved(lines.at(-1), true));
        yield* fresh('ismétlődő sor a végére', moved(lines[0], false));
    }
    yield* fresh('fordított sorrend', [...reference].reverse());
    if (n > 1)
        yield* fresh('első és utolsó sor cseréje', [reference.at(-1), ...reference.slice(1, -1), reference[0]]);
}
export function publicationRefusal(verification, policy = 'publishable') {
    if (verification.checks.audit === 'errors')
        return 'A referencia nyelvi hibát tartalmaz.';
    if (!verification.publishable)
        return 'A referencia vagy egy kapupróba (szomszédos csere, nehéz próba) nem dönthető el a keretben.';
    if (policy === 'verified-only' && verification.status === 'unverified')
        return 'A modell nem igazolt; explicit frissítés (refresh) után publikálható.';
    return null;
}
//# sourceMappingURL=model-verification.js.map