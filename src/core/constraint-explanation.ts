/** Language-independent explanation of an admitted CodeLine v2 model's constraints (ADR-014).
 *
 * It answers, for every line, which constraints bind it, why, and how freely an
 * author may change each one. The reasons come from `authoring.provenance`, which
 * is explanation metadata only: this module never changes or replaces validation,
 * and a model without provenance explains as `legacy`. Provenance counts only while its
 * evidence binds it to these exact lines (ADR-015); otherwise it is `unbound` and every
 * dependency and edge explains as `legacy` too. Block membership is read
 * from the block hierarchy itself, so it is always a hard structural constraint.
 */
import type { ValidationResult } from './types.js';
import { compileCodeLineExercise, type CodeLineExercise, type ConstraintCategory } from './code-line.js';
import { evidenceStatus } from './evidence.js';

/** How a constraint may change: `hard` only with the structure, `proven` only with the
 * code or the ordering policy, `conservative` by a more precise analysis or an explicit
 * author decision, `pedagogical` by the author, `legacy` is unexplained. */
export type Editability = 'hard' | 'proven' | 'conservative' | 'pedagogical' | 'legacy';
export interface ConstraintReason { category: ConstraintCategory; code: string; }
/** One direct `before → after` constraint; `origins` lists where the model states it. */
export interface DirectConstraint { before: number; after: number; origins: ('dependency' | 'edge' | 'block')[]; reasons: ConstraintReason[]; editability: Editability; }
export interface LineConstraints {
  id: number;
  scopeId: string | null;
  functionBlock: number;
  fixed: boolean;
  predecessors: DirectConstraint[];
  successors: DirectConstraint[];
  /** Every line that must precede (follow) this one, transitively, in model order. */
  ancestors: number[];
  descendants: number[];
}
export interface ConstraintExplanation {
  lines: LineConstraints[];
  /** `absent`: no provenance at all (legacy or imported model); `unbound`: provenance whose evidence is
   * missing or no longer matches the lines, so it is ignored; `partial`: some constraints are unexplained. */
  provenance: 'complete' | 'partial' | 'absent' | 'unbound';
  /** Dependencies and edges without a reason. */
  unexplained: number;
  /** Provenance entries that name no dependency or edge of the model; ignored. */
  stale: number;
}

const editabilityOf: Record<ConstraintCategory, Editability> = { structure: 'hard', unit: 'hard', data: 'proven', effect: 'proven', policy: 'proven', conservative: 'conservative', author: 'pedagogical', unknown: 'legacy' };
const strength: Editability[] = ['legacy', 'pedagogical', 'conservative', 'proven', 'hard'];

/** Admits the model first; an inadmissible model is never explained. */
export function explainConstraints(model: CodeLineExercise): ConstraintExplanation | ValidationResult {
  const admitted = compileCodeLineExercise(model);
  if ('status' in admitted) return admitted;
  const recorded = model.authoring?.provenance, bound = !!recorded && evidenceStatus(model) === 'current';
  const provenance = bound ? recorded : undefined;
  const constraints = new Map<string, DirectConstraint>();
  const state = (before: number, after: number, origin: DirectConstraint['origins'][number]): DirectConstraint => {
    const key = before + ':' + after;
    const constraint = constraints.get(key) ?? { before, after, origins: [], reasons: [], editability: 'legacy' };
    if (!constraint.origins.includes(origin)) constraint.origins.push(origin);
    constraints.set(key, constraint);
    return constraint;
  };
  for (const line of model.lines) for (const before of line.dependencies) state(before, line.id, 'dependency');
  for (const edge of model.edges ?? []) state(edge.before, edge.after, 'edge');
  let stale = 0;
  for (const entry of provenance ?? []) {
    const constraint = constraints.get(entry.before + ':' + entry.after);
    if (!constraint) { stale++; continue; }
    if (!constraint.reasons.some(reason => reason.category === entry.category && reason.code === entry.code)) constraint.reasons.push({ category: entry.category, code: entry.code });
  }
  let unexplained = 0;
  for (const constraint of constraints.values()) if (!constraint.reasons.length) { unexplained++; constraint.reasons.push({ category: 'unknown', code: provenance ? 'missing-provenance' : recorded ? 'unbound-provenance' : 'legacy-model' }); }
  // The block hierarchy orders every member between its block's open and close lines.
  const blocks = new Map(model.blocks.map(block => [block.id, block]));
  const structural = (before: number, after: number, code: string): void => { state(before, after, 'block').reasons.push({ category: 'structure', code }); };
  for (const line of model.lines) {
    const block = line.scopeId === null ? undefined : blocks.get(line.scopeId);
    if (block) { structural(block.openLineId, line.id, 'block-member'); structural(line.id, block.closeLineId, 'block-member'); }
  }
  for (const block of model.blocks) structural(block.openLineId, block.closeLineId, 'block-pair');
  for (const constraint of constraints.values()) constraint.editability = constraint.reasons.reduce<Editability>((best, reason) => strength.indexOf(editabilityOf[reason.category]) > strength.indexOf(best) ? editabilityOf[reason.category] : best, 'legacy');

  const ids = model.lines.map(line => line.id), position = new Map(ids.map((id, index) => [id, index]));
  const byOrder = (a: number, b: number): number => position.get(a)! - position.get(b)!;
  const incoming = new Map(ids.map(id => [id, [] as DirectConstraint[]])), outgoing = new Map(ids.map(id => [id, [] as DirectConstraint[]]));
  for (const constraint of constraints.values()) { incoming.get(constraint.after)!.push(constraint); outgoing.get(constraint.before)!.push(constraint); }
  // Admission rejected cycles, so a depth-first closure terminates; memoised per line.
  const closure = (edges: Map<number, DirectConstraint[]>, next: (constraint: DirectConstraint) => number): Map<number, Set<number>> => {
    const memo = new Map<number, Set<number>>();
    const visit = (id: number): Set<number> => {
      const known = memo.get(id);
      if (known) return known;
      const all = new Set<number>();
      memo.set(id, all);
      for (const constraint of edges.get(id)!) { const other = next(constraint); all.add(other); for (const transitive of visit(other)) all.add(transitive); }
      return all;
    };
    ids.forEach(visit);
    return memo;
  };
  const ancestors = closure(incoming, constraint => constraint.before), descendants = closure(outgoing, constraint => constraint.after);
  const sorted = (list: DirectConstraint[], key: (constraint: DirectConstraint) => number): DirectConstraint[] => [...list].sort((a, b) => byOrder(key(a), key(b)));
  return {
    lines: model.lines.map(line => ({
      id: line.id, scopeId: line.scopeId, functionBlock: line.functionBlock, fixed: line.fixed,
      predecessors: sorted(incoming.get(line.id)!, constraint => constraint.before),
      successors: sorted(outgoing.get(line.id)!, constraint => constraint.after),
      ancestors: [...ancestors.get(line.id)!].sort(byOrder),
      descendants: [...descendants.get(line.id)!].sort(byOrder)
    })),
    provenance: recorded && !bound ? 'unbound' : !provenance ? 'absent' : unexplained ? 'partial' : 'complete',
    unexplained,
    stale
  };
}
