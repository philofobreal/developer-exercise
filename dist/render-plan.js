import { compileCodeLineExerciseV3 } from './code-line-v3.js';
import { normalizeLine } from './normalize.js';
/** Display projection deliberately excludes dependencies, binding scopes and profiles. */
export function prepareRenderPlan(model) {
    const checked = compileCodeLineExerciseV3(model);
    if ('status' in checked)
        return checked;
    const byId = new Map(model.ir.lines.map(l => [l.id, l]));
    return { language: model.ir.language, indentPolicy: { ...model.ir.indentPolicy }, units: model.ir.units.map(u => ({ id: u.id, fixed: u.fixed, rows: u.lineIds.map(id => { const l = byId.get(id); return { id, code: l.code, normalization: l.normalization, sourceLine: l.sourceSpan.start.line }; }) })) };
}
/** A future display adapter may change only ASCII indent, and only when authorized. */
export function projectDisplayRows(unit, policy, display) {
    const original = unit.rows.map(r => r.code);
    if (policy.mode === 'semantic' || policy.display === 'preserve' || !display || display.length !== original.length)
        return original;
    if (display.some((code, i) => typeof code !== 'string' || /[\r\n\u2028\u2029]/.test(code) || normalizeLine(code, unit.rows[i].normalization) !== normalizeLine(original[i], unit.rows[i].normalization)))
        return original;
    return [...display];
}
//# sourceMappingURL=render-plan.js.map