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
 *    differs from its regeneration, or the reference has a language error.
 * `publishable` additionally requires the reference and its adjacent swaps to be
 * decided within the production search budget.
 */
import { validateSubmission } from './validator.js';
import { compileCodeLineExercise, type CodeLineExercise, type DependencyPolicy } from './code-line.js';
import { explainConstraints } from './constraint-explanation.js';
import { evidenceStatus } from './evidence.js';

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
export interface VerificationClaim { claim: string; basis: 'checked' | 'tested' | 'not-established' | 'refuted'; }
export interface ModelVerification {
  status: VerificationStatus;
  publishable: boolean;
  checks: {
    admission: 'ok' | 'failed';
    reference: 'accepted' | 'rejected' | 'indeterminate' | 'not-run';
    budget: { probed: number; indeterminate: number; maxStates: number };
    provenance: 'complete' | 'partial' | 'absent' | 'unbound';
    rederivation: 'match' | 'differs' | 'not-run';
    analyzer: 'current' | 'outdated' | 'unknown';
    audit: 'ok' | 'errors' | 'unverifiable' | 'not-run';
    /** Constraints whose strongest reason is a conservative fallback, by reason code. */
    fallbacks: { count: number; codes: Record<string, number> };
    projectionLoss: number | null;
    /** Author-made narrowing: rules with `author` provenance, fixed slots, profiles. */
    authorRules: number;
    fixed: number;
    profiles: number;
  };
  /** Why the status or publishability is not higher, in Hungarian. */
  findings: string[];
  claims: VerificationClaim[];
}

export function verifyModel(model: CodeLineExercise, input: VerificationInput = {}): ModelVerification {
  const maxStates = input.maxStates ?? 50_000, findings: string[] = [];
  const checks: ModelVerification['checks'] = {
    admission: 'failed', reference: 'not-run', budget: { probed: 0, indeterminate: 0, maxStates }, provenance: 'absent',
    rederivation: input.rederivation ?? 'not-run', analyzer: 'unknown', audit: input.audit ?? 'not-run',
    fallbacks: { count: 0, codes: {} }, projectionLoss: null, authorRules: 0, fixed: model.lines.filter(line => line.fixed).length, profiles: model.profiles?.length ?? 0
  };
  const compiled = compileCodeLineExercise(model);
  if ('status' in compiled) return { status: 'unverified', publishable: false, checks, findings: ['A modell befogadása sikertelen: ' + compiled.message], claims: [] };
  checks.admission = 'ok';
  const code = new Map(model.lines.map(line => [line.id, line.code]));
  const verdict = (order: number[]): string => validateSubmission(compiled.compiled, { exerciseId: model.id, revision: model.revision, lines: order.map(id => code.get(id)!) }, { maxStates }).status;
  const reference = model.lines.map(line => line.id);
  const referenceVerdict = verdict(reference);
  checks.reference = referenceVerdict === 'accepted' ? 'accepted' : referenceVerdict === 'indeterminate' ? 'indeterminate' : 'rejected';
  // Adjacent swaps near the reference are the orders learners most often submit.
  const swaps = Math.min(input.neighbours ?? 100, reference.length - 1);
  for (let k = 0; k < swaps; k++) {
    const i = Math.floor(k * (reference.length - 1) / swaps), order = [...reference];
    [order[i], order[i + 1]] = [order[i + 1]!, order[i]!];
    checks.budget.probed++;
    if (verdict(order) === 'indeterminate') checks.budget.indeterminate++;
  }
  const explanation = explainConstraints(model);
  if ('status' in explanation) return { status: 'unverified', publishable: false, checks, findings: [explanation.message], claims: [] };
  checks.provenance = explanation.provenance;
  const analyzer = model.authoring?.evidence?.analyzer;
  checks.analyzer = !analyzer || !input.currentAnalyzer ? 'unknown' : analyzer === input.currentAnalyzer ? 'current' : 'outdated';
  for (const line of explanation.lines) for (const constraint of line.predecessors) {
    if (constraint.reasons.some(reason => reason.category === 'author')) checks.authorRules++;
    if (constraint.editability !== 'conservative') continue;
    checks.fallbacks.count++;
    for (const reason of constraint.reasons) if (reason.category === 'conservative') checks.fallbacks.codes[reason.code] = (checks.fallbacks.codes[reason.code] ?? 0) + 1;
  }
  const bound = evidenceStatus(model) === 'current' ? model.authoring?.evidence?.projectionLoss?.pairs : undefined;
  checks.projectionLoss = input.projectionLoss ?? bound ?? null;

  const publishable = checks.reference === 'accepted' && checks.budget.indeterminate === 0;
  if (checks.reference !== 'accepted') findings.push(checks.reference === 'indeterminate' ? 'A referencia a kereten belül nem dől el.' : 'A modell a saját referenciáját sem fogadja el.');
  if (checks.budget.indeterminate) findings.push(`${checks.budget.indeterminate} szomszédos csere a ${maxStates} állapotos kereten belül eldöntetlen.`);
  const unverified: string[] = [];
  const missing: Record<Exclude<ModelVerification['checks']['provenance'], 'complete'>, string> = { partial: 'Néhány kényszernek nincs oka.', absent: 'A modellnek nincs provenienciája (régi vagy importált modell).', unbound: 'A proveniencia nem ezekhez a sorokhoz tartozik.' };
  if (checks.provenance !== 'complete') unverified.push(missing[checks.provenance]);
  if (checks.rederivation === 'differs') unverified.push('A generált szabályok eltérnek a forrás újragenerálásától (kézi módosítás vagy más elemző).');
  if (checks.rederivation === 'not-run') unverified.push('A szabályokat nem vezettük le újra a forrásból.');
  if (checks.audit === 'errors') unverified.push('A referencia nyelvi hibát tartalmaz.');
  findings.push(...unverified);
  const limits: string[] = [];
  if (checks.fallbacks.count) limits.push(`${checks.fallbacks.count} kényszer konzervatív fallback (${Object.keys(checks.fallbacks.codes).join(', ')}).`);
  if (checks.projectionLoss) limits.push(`${checks.projectionLoss} egységpárt a v2-projekció rendez, bár az elemzés szabadon hagyta.`);
  if (checks.projectionLoss === null) limits.push('A projekciós veszteség nem ismert.');
  if (checks.analyzer === 'outdated') limits.push('A modell régebbi szabályverzióval készült.');
  findings.push(...limits);
  if (checks.authorRules) findings.push(`${checks.authorRules} szerzői szabály szűkíti a generált modellt.`);
  if (checks.fixed) findings.push(`${checks.fixed} sor rögzített pozíciójú (szerzői döntés).`);
  if (checks.profiles) findings.push(`${checks.profiles} szerzői OR-profil határozza meg az elfogadott sorrendeket.`);
  if (checks.audit === 'unverifiable') findings.push('A referencia nyelvi helyessége projektkontextus nélkül nem ellenőrizhető.');
  if (checks.audit === 'not-run') findings.push('A referencia nyelvi auditja nem futott.');
  const status: VerificationStatus = unverified.length ? 'unverified' : checks.authorRules || checks.fixed || checks.profiles ? 'author-modified' : limits.length ? 'conservative' : 'analysis-verified';

  const analysed = status !== 'unverified';
  const claims: VerificationClaim[] = [
    { claim: 'A modell befogadható, és elfogadja a saját referenciáját.', basis: checks.reference === 'accepted' ? 'checked' : 'refuted' },
    { claim: `A szomszédos cserék a produkciós kereten belül eldőlnek (${checks.budget.probed} vizsgált).`, basis: checks.budget.indeterminate ? 'refuted' : 'checked' },
    { claim: 'Minden kényszer oka az aktuális elemzésből újra levezetett.', basis: checks.rederivation === 'match' && checks.provenance === 'complete' ? 'checked' : checks.rederivation === 'differs' ? 'refuted' : 'not-established' },
    { claim: 'Az elfogadott sorrendek a policy szerint egyenértékűek (soundness).', basis: analysed ? 'tested' : 'not-established' },
    { claim: 'A kezelt esetekben nincs indokolatlan elutasítás (completeness).', basis: status === 'analysis-verified' ? 'tested' : 'not-established' },
    { claim: 'A referencia nyelvileg helyes.', basis: checks.audit === 'ok' ? 'checked' : checks.audit === 'errors' ? 'refuted' : 'not-established' }
  ];
  return { status, publishable, checks, findings, claims };
}
