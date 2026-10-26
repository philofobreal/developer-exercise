/** Language-independent ordering relations between physical reference rows (ADR-011).
 *
 * A language adapter owns its AST and its binding/effect analysis and hands
 * the projection only these relations; the projection owns the block/scope
 * hierarchy and the CodeLine v2 mapping. Nothing here knows a parser, a
 * syntax kind or a language rule, and nothing here runs for learner input.
 *
 * Rows are 0-based physical rows of the normalised reference source.
 */
import type {ConstraintCategory} from '../../dist/index.js';
/** Why `before` must precede the entry's row (ADR-014): explanation only, never a grading rule. */
export interface OrderingReason {before: number; category: ConstraintCategory; code: string;}
/** `reasons` should cover every row of `after`; an uncovered one is projected as `unknown`. */
export interface OrderingEntry {row: number; after: number[]; reasons?: OrderingReason[];}
export interface OrderingRelations {
 /** A listed row must follow every row in `after` (a conjunction); unlisted rows keep their source predecessor. */
 entries: OrderingEntry[];
 /** Value inputs (row → declaration rows) that transitive reduction must keep. */
 protectedInputs: Map<number, Set<number>>;
 /** Row span of every ordered unit (statement or member); a multi-row span is one indivisible unit. */
 spans: {first: number; last: number}[];
 /** Human explanation for authors, never a grading rule; '' when there is nothing to say. */
 note: string;
}

/** Merges entries per row: predecessor sets and (deduplicated) reasons are unions. */
export function mergeOrderingEntries(entries: Iterable<OrderingEntry>): OrderingEntry[] {
 const merged = new Map<number, {after: Set<number>; reasons: Map<string, OrderingReason>}>();
 for (const entry of entries) {
  const target = merged.get(entry.row) ?? {after: new Set<number>(), reasons: new Map<string, OrderingReason>()};
  entry.after.forEach(row => target.after.add(row));
  for (const reason of entry.reasons ?? []) target.reasons.set(reason.before + ':' + reason.category + ':' + reason.code, reason);
  merged.set(entry.row, target);
 }
 return [...merged].map(([row, {after, reasons}]) => ({row, after: [...after], ...(reasons.size ? {reasons: [...reasons.values()]} : {})}));
}

/** Conjunction of independent analyses: predecessor sets, reasons, protected inputs and spans are unions. */
export function combineOrderingRelations(parts: OrderingRelations[]): OrderingRelations {
 const protectedInputs = new Map<number, Set<number>>();
 for (const part of parts) for (const [row, inputs] of part.protectedInputs) {const set = protectedInputs.get(row) ?? new Set<number>(); inputs.forEach(input => set.add(input)); protectedInputs.set(row, set);}
 return {entries: mergeOrderingEntries(parts.flatMap(part => part.entries)), protectedInputs, spans: parts.flatMap(part => part.spans), note: parts.map(part => part.note).filter(Boolean).join(' ')};
}

/** CodeLine v2 line as the projection sees it: IDs are 1-based and contiguous in reference order. */
export interface ProjectedLine {id: number; scopeId: string | null; dependencies: number[];}

/** The validator admits a row wherever the open scope equals its scopeId. Inside a
 * multi-row unit that holds only at continuation rows and at shared `} else {`
 * style boundaries (omitted blocks); there every same-scope sibling unit keeps its
 * source side (ADR-009). `units` are line-ID spans, `opener` maps a line opening a
 * retained block to that block's scopeId. Mutates the lines' dependencies and
 * reports every required pair, present or added, to `required`. */
export function sealMultiRowUnits(lines: ProjectedLine[], units: {first: number; last: number}[], opener: Map<number, string>, required: (before: number, after: number) => void = () => undefined): void {
 const scope = (id: number): string | null => lines[id - 1]!.scopeId;
 for (const unit of units) {
  if (unit.first >= unit.last) continue;
  const own = scope(unit.first);
  let hole = false;
  for (let id = unit.first; id < unit.last && !hole; id++) hole = (opener.get(id) ?? scope(id)) === own;
  if (!hole) continue;
  for (const other of units) {
   if (scope(other.first) !== own) continue;
   const pair = other.last < unit.first ? [other.last, unit.first] : other.first > unit.last ? [unit.last, other.first] : undefined;
   if (!pair) continue;
   const [before, after] = pair as [number, number], dependencies = lines[after - 1]!.dependencies;
   if (!dependencies.includes(before)) dependencies.push(before);
   required(before, after);
  }
 }
}

/** Remove only redundant synthetic edges, retaining actual value-read inputs. */
export function reduceGeneratedDependencies(lines: {id: number; dependencies: number[]}[], protectedById: Map<number, Set<number>> = new Map()): void {
 const ancestors = new Map<number, Set<number>>();
 for (const item of lines) {const all = new Set<number>(); for (const dep of item.dependencies) {all.add(dep); for (const ancestor of ancestors.get(dep) ?? []) all.add(ancestor);} ancestors.set(item.id, all);}
 for (const item of lines) {const protectedIds = protectedById.get(item.id) ?? new Set<number>(); item.dependencies = item.dependencies.filter(dep => protectedIds.has(dep) || !item.dependencies.some(other => other !== dep && ancestors.get(other)?.has(dep))).sort((a, b) => a - b);}
}
