import type { CodeLineExerciseV3, LanguageIR, MovableUnit, UnitStructure } from './language-ir.js';
import type { CodeLineExercise, AdaptResult } from './code-line.js';
import type { ExerciseDefinition, OrderingEdge, ValidationResult } from './types.js';
import { compileCodeLineExercise } from './code-line.js';
import { compileDefinition, isModelError } from './model.js';
import { validateSubmission } from './validator.js';
import { validateV3 } from './schema-check.js';
import { hierarchyValid } from './unit-structure.js';

const invalid = (message: string): ValidationResult => ({ status: 'invalid_reference', accepted: false, reason: 'invalid_model', message, exploredStates: 0 });
const first = (unit: MovableUnit): string => unit.lineIds[0]!;
const last = (unit: MovableUnit): string => unit.lineIds.at(-1)!;

/** Author-time admission only. No language syntax or parser is needed here. */
export function compileCodeLineExerciseV3(raw: CodeLineExerciseV3): AdaptResult {
  if (!validateV3(raw)) return invalid('Hibás CodeLine v3 / Language IR v1 séma.');
  const ir = raw.ir;
  const lineIds = ir.lines.map(l => l.id), units = new Map(ir.units.map(u => [u.id, u]));
  if (new Set(lineIds).size !== lineIds.length || units.size !== ir.units.length || !hierarchyValid(ir.containers) || !hierarchyValid(ir.bindingScopes)) return invalid('Ismétlődő ID vagy hibás IR-hierarchia.');
  const partition = ir.units.flatMap(u => u.lineIds);
  if (partition.length !== lineIds.length || partition.some((id, i) => id !== lineIds[i])) return invalid('A referenciaunitoknak sorrendtartó sorpartíciót kell alkotniuk.');
  const containers = new Set(ir.containers.map(c => c.id)), scopes = new Set(ir.bindingScopes.map(s => s.id));
  if (ir.units.some(u => u.containerId !== null && !containers.has(u.containerId) || u.bindingScopeId !== null && !scopes.has(u.bindingScopeId))) return invalid('Hiányzó konténer vagy binding scope.');
  if (ir.indentPolicy.mode === 'semantic' && ir.lines.some(l => l.normalization !== 'exact')) return invalid('A szemantikus behúzás exact sorokat igényel.');
  const physical = ir.source.split('\n'), offsets: number[] = [];
  const physicalCount = physical.length - (ir.source.endsWith('\n') ? 1 : 0);
  if (ir.analysis.strategy === 'native' && (ir.lines.length !== physicalCount || ir.lines.some((line, index) => line.sourceSpan.start.line !== index + 1))) return invalid('A natív IR-nek minden fizikai forrássort meg kell őriznie; csak a végső sorhatár nem önálló sor.');
  let offset = 0; for (const row of physical) { offsets.push(offset); offset += row.length + 1; }
  let previousLine = 0;
  for (const line of ir.lines) {
    const { start, end } = line.sourceSpan, row = physical[start.line - 1];
    const legacyTrimmedSuffix = ir.analysis.strategy === 'legacy-v2-projection' && end.offset === ir.source.trimEnd().length;
    if (start.line <= previousLine || row === undefined || end.line !== start.line || start.column !== 0 || end.column !== line.code.length || (end.column !== row.length && !legacyTrimmedSuffix) || start.offset !== offsets[start.line - 1] || end.offset !== start.offset + line.code.length || ir.source.slice(start.offset, end.offset) !== line.code) return invalid('A source span nem az eredeti fizikai sorra mutat.');
    previousLine = start.line;
  }
  const owner = new Map(ir.units.flatMap(unit => unit.lineIds.map(id => [id, unit] as const)));
  const structure: UnitStructure = {
    units: ir.units.map(u => ({ id: u.id, tokenIds: [...u.lineIds] })),
    containers: ir.containers.map(c => ({ id: c.id, parentId: c.parentId })),
    boundaries: []
  };
  for (const b of ir.boundaries) {
    const unit = units.get(b.unitId);
    if (!unit) return invalid('Hiányzó határesemény-unit.');
    structure.boundaries.push({ tokenId: b.phase === 'before' ? first(unit) : last(unit), containerId: b.containerId, phase: b.phase, action: b.action });
  }
  function lowerEdges(edges: OrderingEdge[]): OrderingEdge[] | null {
    const result: OrderingEdge[] = [];
    for (const e of edges) {
      const before = units.get(e.before), after = units.get(e.after);
      if (!before || !after || before === after) return null;
      result.push({ before: last(before), after: first(after) });
    }
    return result;
  }
  const edges = lowerEdges([...ir.edges, ...ir.units.flatMap(u => u.dependencies.map(before => ({ before, after: u.id })))]);
  if (!edges) return invalid('Hibás unitfüggőség.');
  const profiles = [];
  for (const profile of ir.profiles) {
    const lowered = lowerEdges(profile.edges); if (!lowered) return invalid('Hibás profilfüggőség.');
    profiles.push({ id: profile.id, edges: lowered });
  }
  const definition: ExerciseDefinition = {
    schemaVersion: 1, id: raw.id, revision: raw.revision, title: raw.title, description: raw.description, language: ir.language,
    tokens: ir.lines.map((l, index) => ({ id: l.id, code: l.code, normalization: l.normalization, scope: owner.get(l.id)!.containerId, ...(owner.get(l.id)!.fixed ? { fixedPosition: index } : {}) })),
    blocks: [], structure, edges, profiles
  };
  const compiled = compileDefinition(definition);
  if (isModelError(compiled)) return compiled;
  const self = validateSubmission(compiled, { exerciseId: raw.id, revision: raw.revision, lines: ir.lines.map(l => l.code) }, { maxStates: 200_000 });
  if (!self.accepted) return { ...self, status: self.status === 'indeterminate' ? 'indeterminate' : 'invalid_reference', accepted: false, message: 'A v3 referencia nem fogadható be: ' + self.message };
  return { definition, compiled };
}

/** Lossless grading projection; never regenerate or parse imported v2 constraints. */
export function upgradeCodeLineExerciseV2(model: CodeLineExercise, originalSource?: string): CodeLineExerciseV3 | ValidationResult {
  const legacy = compileCodeLineExercise(model);
  if ('status' in legacy) return legacy;
  const source = originalSource === undefined ? model.lines.map(l => l.code).join('\n') : originalSource.replace(/\r\n?/g, '\n');
  const physical = source.split('\n'), offsets: number[] = [];
  let offset = 0; for (const row of physical) { offsets.push(offset); offset += row.length + 1; }
  const id = (n: number): string => `n:${n}`;
  const blockById = new Map(model.blocks.map(b => [b.id, b]));
  const functionScope = (scope: string | null): string | null => {
    while (scope !== null) { const b = blockById.get(scope)!; if (b.kind === 'function') return b.id; scope = b.parentScopeId; }
    return null;
  };
  const ir: LanguageIR = {
    irVersion: 1, language: model.language, source,
    lines: model.lines.map((l, i) => {
      const row = originalSource === undefined ? i + 1 : (l.sourceLine ?? i + 1), start = offsets[row - 1] ?? -1;
      return { id: id(l.id), code: l.code, normalization: l.normalization ?? 'indent', sourceSpan: { start: { offset: start, line: row, column: 0 }, end: { offset: start + l.code.length, line: row, column: l.code.length } } };
    }),
    units: model.lines.map(l => ({ id: id(l.id), lineIds: [id(l.id)], containerId: l.scopeId, bindingScopeId: model.blocks.find(b => b.kind === 'function' && b.functionBlock === l.functionBlock)?.id ?? null, dependencies: l.dependencies.map(id), fixed: l.fixed })),
    containers: model.blocks.map(b => ({ id: b.id, parentId: b.parentScopeId, kind: b.kind })),
    bindingScopes: model.blocks.filter(b => b.kind === 'function').map(b => ({ id: b.id, parentId: functionScope(b.parentScopeId), kind: 'function' })),
    boundaries: model.blocks.flatMap(b => [
      { containerId: b.id, unitId: id(b.openLineId), phase: 'after' as const, action: 'open' as const, virtual: false },
      { containerId: b.id, unitId: id(b.closeLineId), phase: 'before' as const, action: 'close' as const, virtual: false }
    ]),
    edges: (model.edges ?? []).map(e => ({ before: id(e.before), after: id(e.after) })),
    profiles: (model.profiles ?? []).map(p => ({ id: p.id, edges: p.edges.map(e => ({ before: id(e.before), after: id(e.after) })) })),
    indentPolicy: { mode: 'presentation', tabWidth: 5, display: 'adapter' },
    analysis: { strategy: 'legacy-v2-projection', sourceOrigin: originalSource === undefined ? 'reconstructed-v2' : 'original', semanticEquivalenceProven: false, ...(model.authoring ? { legacyAuthoring: structuredClone(model.authoring) } : {}) }
  };
  const upgraded: CodeLineExerciseV3 = { schemaVersion: 3, id: model.id, revision: model.revision, title: model.title, description: model.description, ir };
  const checked = compileCodeLineExerciseV3(upgraded);
  return 'status' in checked ? checked : upgraded;
}

export function compileVersionedExercise(model: CodeLineExercise | CodeLineExerciseV3): AdaptResult {
  if (model?.schemaVersion === 2) return compileCodeLineExercise(model);
  if (model?.schemaVersion === 3) return compileCodeLineExerciseV3(model);
  return invalid('Nem támogatott feladatséma-verzió.');
}
