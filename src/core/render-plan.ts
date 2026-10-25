import type { CodeLineExerciseV3, IndentPolicy } from './language-ir.js';
import type { ValidationResult } from './types.js';
import { compileCodeLineExerciseV3 } from './code-line-v3.js';
import { normalizeLine } from './normalize.js';

export interface RenderUnit {
  id: string;
  fixed: boolean;
  rows: { id: string; code: string; normalization: 'indent' | 'exact'; sourceLine: number }[];
}
export interface RenderPlan { language: string; indentPolicy: IndentPolicy; units: RenderUnit[]; }

/** Display projection deliberately excludes dependencies, binding scopes and profiles. */
export function prepareRenderPlan(model: CodeLineExerciseV3): RenderPlan | ValidationResult {
  const checked = compileCodeLineExerciseV3(model);
  if ('status' in checked) return checked;
  const byId = new Map(model.ir.lines.map(l => [l.id, l]));
  return { language: model.ir.language, indentPolicy: { ...model.ir.indentPolicy }, units: model.ir.units.map(u => ({ id: u.id, fixed: u.fixed, rows: u.lineIds.map(id => { const l = byId.get(id)!; return { id, code: l.code, normalization: l.normalization, sourceLine: l.sourceSpan.start.line }; }) })) };
}

/** A future display adapter may change only ASCII indent, and only when authorized. */
export function projectDisplayRows(unit: RenderUnit, policy: IndentPolicy, display?: readonly string[]): string[] {
  const original = unit.rows.map(r => r.code);
  if (policy.mode === 'semantic' || policy.display === 'preserve' || !display || display.length !== original.length) return original;
  if (original.some((_, i) => { const code = display[i]; return typeof code !== 'string' || /[\r\n\u2028\u2029]/.test(code) || normalizeLine(code, unit.rows[i]!.normalization) !== normalizeLine(original[i]!, unit.rows[i]!.normalization); })) return original;
  return [...display];
}
