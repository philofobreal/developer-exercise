/** Language-independent CodeLine v2 projection (ADR-011, ADR-013). The adapter
 * supplies the block intervals, the exact-whitespace rows and the ordering
 * relations; this module owns the block/scope hierarchy, the physical-row to
 * line-ID mapping, clause chains, sealing and transitive reduction. It knows no
 * parser and no syntax kind, and never runs for learner input. Rows are 0-based
 * physical rows of the normalised reference source. */
import {reduceGeneratedDependencies, sealMultiRowUnits, type OrderingRelations} from './ordering-relations.js';

/** A block interval from the adapter. `clause`: one clause of a compound statement
 * (if/else, try/catch/finally) that may share its first or last row with the next
 * clause, as in `} else {`. */
export interface StructureBlock {start: number; end: number; kind: 'function' | 'block'; clause?: boolean;}
export interface ProjectionInput {physical: readonly string[]; exact: ReadonlySet<number>; structure: readonly StructureBlock[]; ordering?: OrderingRelations | undefined;}
export interface ProjectedCodeLine {id: number; sourceLine: number; code: string; dependencies: number[]; fixed: false; functionBlock: number; scopeId: string | null; normalization: 'exact' | 'indent';}
export interface ProjectedBlock {id: string; kind: 'function' | 'block'; parentScopeId: string | null; openLineId: number; closeLineId: number; functionBlock?: number;}
export interface CodeLineProjection {
 lines: ProjectedCodeLine[];
 blocks: ProjectedBlock[];
 /** Source-order locks of omitted blocks whose rows no block can represent. */
 edges: {before: number; after: number}[];
 omittedBlocks: number;
 /** Clause chains represented as one container with separator rows. */
 clauseChains: number;
}
interface Candidate extends StructureBlock {separators: number[];}
interface Retained extends Candidate {id: string; parent: Retained | null; functionBlock?: number;}

/** Physical rows that become lines: non-blank, or whitespace-exact. */
export function projectedRows(physical: readonly string[], exact: ReadonlySet<number>): {code: string; line: number}[] {
 return physical.flatMap((code, line) => code.trim() || exact.has(line) ? [{code, line}] : []);
}

/** Joins clause blocks sharing a boundary row (`} else {`) into one container: the
 * shared rows become separators, each clause a segment between two of them. Only a
 * row shared by exactly the two linked clauses qualifies, and the chain's own first
 * and last rows must be unshared. */
function clauseChains(blocks: readonly StructureBlock[], counts: ReadonlyMap<number, number>): {chains: Candidate[]; members: Set<StructureBlock>} {
 const clauses = blocks.filter(block => block.clause && block.kind === 'block');
 const next = new Map<StructureBlock, StructureBlock>(), linked = new Set<StructureBlock>();
 for (const block of clauses) {
  const following = clauses.filter(other => other !== block && other.start === block.end);
  if (following.length === 1 && counts.get(block.end) === 2) {next.set(block, following[0]!); linked.add(following[0]!);}
 }
 const chains: Candidate[] = [], members = new Set<StructureBlock>();
 for (const head of clauses) {
  if (linked.has(head) || !next.has(head)) continue;
  const chain = [head];
  for (let current = next.get(head); current; current = next.get(current)) chain.push(current);
  const tail = chain.at(-1)!;
  if (counts.get(head.start) !== 1 || counts.get(tail.end) !== 1) continue;
  chain.forEach(block => members.add(block));
  chains.push({start: head.start, end: tail.end, kind: 'block', clause: true, separators: chain.slice(1).map(block => block.start)});
 }
 return {chains, members};
}

export function projectCodeLine({physical, exact, structure, ordering}: ProjectionInput): CodeLineProjection {
 const rows = projectedRows(physical, exact);
 const intervals = structure.filter(block => block.start < block.end);
 const counts = new Map<number, number>();
 for (const block of intervals) for (const row of [block.start, block.end]) counts.set(row, (counts.get(row) ?? 0) + 1);
 const {chains, members} = clauseChains(intervals, counts);
 const candidates: Candidate[] = [...intervals.filter(block => !members.has(block)).map(block => ({...block, separators: []})), ...chains].sort((a, b) => a.start - b.start || b.end - a.end);
 const retained: Retained[] = [], omitted: Candidate[] = [];
 for (const block of candidates) {
  if ((counts.get(block.start) ?? 0) > 1 || (counts.get(block.end) ?? 0) > 1 || retained.length >= 250) omitted.push(block);
  else retained.push({...block, id: 'scope-' + (retained.length + 1), parent: null});
 }
 let nextFunction = 1;
 for (const block of retained) {
  block.parent = retained.filter(other => other.start < block.start && other.end > block.end).at(-1) ?? null;
  if (block.kind === 'function') block.functionBlock = nextFunction++;
 }
 const byPhysical = new Map(rows.map((row, i) => [row.line, i + 1]));
 const blocks: ProjectedBlock[] = retained.map(block => ({id: block.id, kind: block.kind, parentScopeId: block.parent?.id ?? null, openLineId: byPhysical.get(block.start)!, closeLineId: byPhysical.get(block.end)!, ...(block.kind === 'function' ? {functionBlock: block.functionBlock!} : {})}));
 const scopeOf = (line: number): Retained | null => retained.filter(block => block.start < line && line < block.end).at(-1) ?? null;
 const lines: ProjectedCodeLine[] = rows.map(({code, line}, i) => {
  const boundary = retained.find(block => block.start === line || block.end === line), scope = scopeOf(line);
  let owner: Retained | null = boundary?.kind === 'function' ? boundary : scope;
  while (owner && owner.kind !== 'function') owner = owner.parent;
  return {id: i + 1, sourceLine: line + 1, code, dependencies: i ? [i] : [], fixed: false, functionBlock: owner?.functionBlock ?? 0, scopeId: scope?.id ?? null, normalization: exact.has(line) ? 'exact' : 'indent'};
 });
 // Project the adapter's language-independent ordering relations onto line IDs.
 const protectedById = new Map<number, Set<number>>(), toIds = (list: Iterable<number>): number[] => [...list].flatMap(row => {const id = byPhysical.get(row); return id === undefined ? [] : [id];});
 if (ordering) {
  for (const entry of ordering.entries) {const id = byPhysical.get(entry.row); if (id !== undefined) lines[id - 1]!.dependencies = toIds(entry.after);}
  for (const [row, inputs] of ordering.protectedInputs) {const id = byPhysical.get(row); if (id !== undefined) protectedById.set(id, new Set(toIds(inputs)));}
 }
 // Clause segments: a separator follows the previous boundary and every top-level row of
 // the clause before it; every top-level row of the clause after it follows the separator.
 // (The container is one scope, so these edges, not the scope, keep each row in its clause.)
 for (const chain of retained.filter(block => block.separators.length)) {
  const boundaries = [chain.start, ...chain.separators, chain.end];
  const segment = (from: number, to: number): number[] => rows.filter(row => row.line > from && row.line < to && scopeOf(row.line) === chain && !chain.separators.includes(row.line)).map(row => byPhysical.get(row.line)!);
  chain.separators.forEach((separator, i) => {
   const id = byPhysical.get(separator)!;
   lines[id - 1]!.dependencies = [...new Set([byPhysical.get(boundaries[i]!)!, ...segment(boundaries[i]!, separator)])];
   for (const after of segment(separator, boundaries[i + 2]!)) {const dependencies = lines[after - 1]!.dependencies; if (!dependencies.includes(id)) dependencies.push(id);}
  });
 }
 if (ordering) {
  const units = ordering.spans.flatMap(unit => {const first = byPhysical.get(unit.first), last = byPhysical.get(unit.last); return first === undefined || last === undefined ? [] : [{first, last}];});
  sealMultiRowUnits(lines, units, new Map(retained.map(block => [byPhysical.get(block.start)!, block.id])));
 }
 reduceGeneratedDependencies(lines, protectedById);
 // A row can still close and open unrelated blocks; lock only each such unrepresentable interval.
 const edgeMap = new Map<string, {before: number; after: number}>();
 for (const block of omitted) {
  const ids = rows.flatMap((row, i) => row.line >= block.start && row.line <= block.end ? [i + 1] : []);
  for (let i = 1; i < ids.length; i++) edgeMap.set(ids[i - 1] + ':' + ids[i], {before: ids[i - 1]!, after: ids[i]!});
 }
 return {lines, blocks, edges: [...edgeMap.values()], omittedBlocks: omitted.length, clauseChains: chains.filter(chain => retained.some(block => block.start === chain.start && block.end === chain.end)).length};
}
