import { compileCodeLineExercise } from './code-line.js';
const editabilityOf = { structure: 'hard', unit: 'hard', data: 'proven', effect: 'proven', policy: 'proven', conservative: 'conservative', author: 'pedagogical', unknown: 'legacy' };
const strength = ['legacy', 'pedagogical', 'conservative', 'proven', 'hard'];
/** Admits the model first; an inadmissible model is never explained. */
export function explainConstraints(model) {
    const admitted = compileCodeLineExercise(model);
    if ('status' in admitted)
        return admitted;
    const provenance = model.authoring?.provenance;
    const constraints = new Map();
    const state = (before, after, origin) => {
        const key = before + ':' + after;
        const constraint = constraints.get(key) ?? { before, after, origins: [], reasons: [], editability: 'legacy' };
        if (!constraint.origins.includes(origin))
            constraint.origins.push(origin);
        constraints.set(key, constraint);
        return constraint;
    };
    for (const line of model.lines)
        for (const before of line.dependencies)
            state(before, line.id, 'dependency');
    for (const edge of model.edges ?? [])
        state(edge.before, edge.after, 'edge');
    let stale = 0;
    for (const entry of provenance ?? []) {
        const constraint = constraints.get(entry.before + ':' + entry.after);
        if (!constraint) {
            stale++;
            continue;
        }
        if (!constraint.reasons.some(reason => reason.category === entry.category && reason.code === entry.code))
            constraint.reasons.push({ category: entry.category, code: entry.code });
    }
    let unexplained = 0;
    for (const constraint of constraints.values())
        if (!constraint.reasons.length) {
            unexplained++;
            constraint.reasons.push({ category: 'unknown', code: provenance ? 'missing-provenance' : 'legacy-model' });
        }
    // The block hierarchy orders every member between its block's open and close lines.
    const blocks = new Map(model.blocks.map(block => [block.id, block]));
    const structural = (before, after, code) => { state(before, after, 'block').reasons.push({ category: 'structure', code }); };
    for (const line of model.lines) {
        const block = line.scopeId === null ? undefined : blocks.get(line.scopeId);
        if (block) {
            structural(block.openLineId, line.id, 'block-member');
            structural(line.id, block.closeLineId, 'block-member');
        }
    }
    for (const block of model.blocks)
        structural(block.openLineId, block.closeLineId, 'block-pair');
    for (const constraint of constraints.values())
        constraint.editability = constraint.reasons.reduce((best, reason) => strength.indexOf(editabilityOf[reason.category]) > strength.indexOf(best) ? editabilityOf[reason.category] : best, 'legacy');
    const ids = model.lines.map(line => line.id), position = new Map(ids.map((id, index) => [id, index]));
    const byOrder = (a, b) => position.get(a) - position.get(b);
    const incoming = new Map(ids.map(id => [id, []])), outgoing = new Map(ids.map(id => [id, []]));
    for (const constraint of constraints.values()) {
        incoming.get(constraint.after).push(constraint);
        outgoing.get(constraint.before).push(constraint);
    }
    // Admission rejected cycles, so a depth-first closure terminates; memoised per line.
    const closure = (edges, next) => {
        const memo = new Map();
        const visit = (id) => {
            const known = memo.get(id);
            if (known)
                return known;
            const all = new Set();
            memo.set(id, all);
            for (const constraint of edges.get(id)) {
                const other = next(constraint);
                all.add(other);
                for (const transitive of visit(other))
                    all.add(transitive);
            }
            return all;
        };
        ids.forEach(visit);
        return memo;
    };
    const ancestors = closure(incoming, constraint => constraint.before), descendants = closure(outgoing, constraint => constraint.after);
    const sorted = (list, key) => [...list].sort((a, b) => byOrder(key(a), key(b)));
    return {
        lines: model.lines.map(line => ({
            id: line.id, scopeId: line.scopeId, functionBlock: line.functionBlock, fixed: line.fixed,
            predecessors: sorted(incoming.get(line.id), constraint => constraint.before),
            successors: sorted(outgoing.get(line.id), constraint => constraint.after),
            ancestors: [...ancestors.get(line.id)].sort(byOrder),
            descendants: [...descendants.get(line.id)].sort(byOrder)
        })),
        provenance: !provenance ? 'absent' : unexplained ? 'partial' : 'complete',
        unexplained,
        stale
    };
}
//# sourceMappingURL=constraint-explanation.js.map