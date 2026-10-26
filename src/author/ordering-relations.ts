/** Language-independent ordering relations between physical reference rows (ADR-011).
 *
 * A language adapter owns its AST and its binding/effect analysis and hands
 * the projection only these relations; the projection owns the block/scope
 * hierarchy and the CodeLine v2 mapping. Nothing here knows a parser, a
 * syntax kind or a language rule, and nothing here runs for learner input.
 *
 * Rows are 0-based physical rows of the normalised reference source.
 */
export interface OrderingEntry {row: number; after: number[];}
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

/** Conjunction of independent analyses: predecessor sets, protected inputs and spans are unions. */
export function combineOrderingRelations(parts: OrderingRelations[]): OrderingRelations {
 const entries = new Map<number, Set<number>>(), protectedInputs = new Map<number, Set<number>>();
 const add = (target: Map<number, Set<number>>, row: number, values: Iterable<number>): void => {const set = target.get(row) ?? new Set<number>(); for (const value of values) set.add(value); target.set(row, set);};
 for (const part of parts) {
  for (const entry of part.entries) add(entries, entry.row, entry.after);
  for (const [row, inputs] of part.protectedInputs) add(protectedInputs, row, inputs);
 }
 return {entries: [...entries].map(([row, after]) => ({row, after: [...after]})), protectedInputs, spans: parts.flatMap(part => part.spans), note: parts.map(part => part.note).filter(Boolean).join(' ')};
}

/** CodeLine v2 line as the projection sees it: IDs are 1-based and contiguous in reference order. */
export interface ProjectedLine {id: number; scopeId: string | null; dependencies: number[];}

/** The validator admits a row wherever the open scope equals its scopeId. Inside a
 * multi-row unit that holds only at continuation rows and at shared `} else {`
 * style boundaries (omitted blocks); there every same-scope sibling unit keeps its
 * source side (ADR-009). `units` are line-ID spans, `opener` maps a line opening a
 * retained block to that block's scopeId. Mutates the lines' dependencies. */
export function sealMultiRowUnits(lines: ProjectedLine[], units: {first: number; last: number}[], opener: Map<number, string>): void {
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
  }
 }
}

/** Remove only redundant synthetic edges, retaining actual value-read inputs. */
export function reduceGeneratedDependencies(lines: {id: number; dependencies: number[]}[], protectedById: Map<number, Set<number>> = new Map()): void {
 const ancestors = new Map<number, Set<number>>();
 for (const item of lines) {const all = new Set<number>(); for (const dep of item.dependencies) {all.add(dep); for (const ancestor of ancestors.get(dep) ?? []) all.add(ancestor);} ancestors.set(item.id, all);}
 for (const item of lines) {const protectedIds = protectedById.get(item.id) ?? new Set<number>(); item.dependencies = item.dependencies.filter(dep => protectedIds.has(dep) || !item.dependencies.some(other => other !== dep && ancestors.get(other)?.has(dep))).sort((a, b) => a - b);}
}
