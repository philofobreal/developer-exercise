/** Reconcile author analysis with an existing v2 identity/structure contract. No parsing or grading. */
import type {CodeLineExercise, CodeBlock} from '../../dist/index.js';

function blockKeys(model: CodeLineExercise): Map<string, string> {
 const positions = new Map(model.lines.map((line, index) => [line.id, index]));
 return new Map(model.blocks.map(block => [block.id, JSON.stringify([positions.get(block.openLineId), positions.get(block.closeLineId), block.kind])]));
}

/** The block structure of the refreshed model. The regeneration may refine the original
 * structure only by adding plain blocks, the multi-row units a block holds together
 * (ADR-066): removing them must give back exactly the original blocks, parents and line
 * scopes. Original blocks keep their IDs; an added block gets a fresh one. Anything else
 * changes the learner's structure and is refused. */
function refinedStructure(original: CodeLineExercise, generated: CodeLineExercise): {blocks: CodeBlock[]; scopeOf: (index: number) => string | null} | undefined {
 const oldKeys = blockKeys(original), newKeys = blockKeys(generated);
 const byKey = new Map(original.blocks.map(block => [oldKeys.get(block.id)!, block]));
 const generatedById = new Map(generated.blocks.map(block => [block.id, block]));
 const matched = new Map(generated.blocks.flatMap(block => {const old = byKey.get(newKeys.get(block.id)!); return old ? [[block.id, old] as const] : [];}));
 if (matched.size !== original.blocks.length || generated.blocks.some(block => !matched.has(block.id) && block.kind !== 'block')) return undefined;
 // The nearest enclosing original block, skipping the added ones.
 const lowered = (scope: string | null): string | null => {
  let at = scope;
  for (let guard = 0; at !== null && !matched.has(at) && guard <= generated.blocks.length; guard++) at = generatedById.get(at)?.parentScopeId ?? null;
  return at === null ? null : matched.get(at)?.id ?? null;
 };
 if (generated.blocks.some(block => matched.has(block.id) && lowered(block.parentScopeId) !== matched.get(block.id)!.parentScopeId)) return undefined;
 if (original.lines.some((line, index) => lowered(generated.lines[index]!.scopeId) !== line.scopeId)) return undefined;
 const taken = new Set(original.blocks.map(block => block.id)), ids = new Map<string, string>();
 let next = 1;
 for (const block of generated.blocks) {
  if (matched.has(block.id)) {ids.set(block.id, matched.get(block.id)!.id); continue;}
  while (taken.has('unit-' + next)) next++;
  ids.set(block.id, 'unit-' + next); taken.add('unit-' + next);
 }
 const id = (scope: string | null): string | null => scope === null ? null : ids.get(scope)!;
 const lineId = (generatedId: number): number => original.lines[generatedId - 1]!.id;
 const blocks = generated.blocks.map(block => {
  const old = matched.get(block.id);
  return old ? {...structuredClone(old), parentScopeId: id(block.parentScopeId)} : {id: id(block.id)!, kind: 'block' as const, parentScopeId: id(block.parentScopeId), openLineId: lineId(block.openLineId), closeLineId: lineId(block.closeLineId)};
 });
 return {blocks, scopeOf: index => id(generated.lines[index]!.scopeId)};
}

/** Called with two audited models; only explicit author intent may replace dependencies. */
export function reconcileDependencies(original: CodeLineExercise, generated: CodeLineExercise): CodeLineExercise {
 const fail = (): never => { throw Error('Az új elemzés eltérő sor-/blokkstruktúrát ad. A változtatás nem alkalmazható csak a függőségekre; használd a Referenciaforrás alkalmazását új feladatként.'); };
 if (original.language !== generated.language || original.lines.length !== generated.lines.length || original.lines.some((line, index) => line.code !== generated.lines[index]!.code)) return fail();
 const structure = refinedStructure(original, generated) ?? fail();
 const idMap = new Map(generated.lines.map((line, index) => [line.id, original.lines[index]!.id]));
 // Only the regenerated edges: which original edges are author rules decides mergeAuthorRules (ADR-018).
 const edges = (generated.edges ?? []).map(edge => ({before: idMap.get(edge.before)!, after: idMap.get(edge.after)!}));
 const sourceLine = (row: number): number => original.lines[row - 1]?.sourceLine ?? row;
 return {
  ...structuredClone(original),
  lines: original.lines.map((line, index) => ({...structuredClone(line), scopeId: structure.scopeOf(index), dependencies: generated.lines[index]!.dependencies.map(id => idMap.get(id)!)})),
  blocks: structure.blocks,
  edges,
  // Provenance (ADR-014) describes only the regenerated constraints.
  authoring: {...original.authoring, ...generated.authoring, dependencyHints: (generated.authoring?.dependencyHints ?? []).map(hint => ({...hint, declarationLine: sourceLine(hint.declarationLine), usageLine: sourceLine(hint.usageLine)})), provenance: (generated.authoring?.provenance ?? []).map(entry => ({...entry, before: idMap.get(entry.before)!, after: idMap.get(entry.after)!}))}
 };
}
