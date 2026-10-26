/** Conjunction of independent analyses: predecessor sets, protected inputs and spans are unions. */
export function combineOrderingRelations(parts) {
    const entries = new Map(), protectedInputs = new Map();
    const add = (target, row, values) => { const set = target.get(row) ?? new Set(); for (const value of values)
        set.add(value); target.set(row, set); };
    for (const part of parts) {
        for (const entry of part.entries)
            add(entries, entry.row, entry.after);
        for (const [row, inputs] of part.protectedInputs)
            add(protectedInputs, row, inputs);
    }
    return { entries: [...entries].map(([row, after]) => ({ row, after: [...after] })), protectedInputs, spans: parts.flatMap(part => part.spans), note: parts.map(part => part.note).filter(Boolean).join(' ') };
}
/** The validator admits a row wherever the open scope equals its scopeId. Inside a
 * multi-row unit that holds only at continuation rows and at shared `} else {`
 * style boundaries (omitted blocks); there every same-scope sibling unit keeps its
 * source side (ADR-009). `units` are line-ID spans, `opener` maps a line opening a
 * retained block to that block's scopeId. Mutates the lines' dependencies. */
export function sealMultiRowUnits(lines, units, opener) {
    const scope = (id) => lines[id - 1].scopeId;
    for (const unit of units) {
        if (unit.first >= unit.last)
            continue;
        const own = scope(unit.first);
        let hole = false;
        for (let id = unit.first; id < unit.last && !hole; id++)
            hole = (opener.get(id) ?? scope(id)) === own;
        if (!hole)
            continue;
        for (const other of units) {
            if (scope(other.first) !== own)
                continue;
            const pair = other.last < unit.first ? [other.last, unit.first] : other.first > unit.last ? [unit.last, other.first] : undefined;
            if (!pair)
                continue;
            const [before, after] = pair, dependencies = lines[after - 1].dependencies;
            if (!dependencies.includes(before))
                dependencies.push(before);
        }
    }
}
/** Remove only redundant synthetic edges, retaining actual value-read inputs. */
export function reduceGeneratedDependencies(lines, protectedById = new Map()) {
    const ancestors = new Map();
    for (const item of lines) {
        const all = new Set();
        for (const dep of item.dependencies) {
            all.add(dep);
            for (const ancestor of ancestors.get(dep) ?? [])
                all.add(ancestor);
        }
        ancestors.set(item.id, all);
    }
    for (const item of lines) {
        const protectedIds = protectedById.get(item.id) ?? new Set();
        item.dependencies = item.dependencies.filter(dep => protectedIds.has(dep) || !item.dependencies.some(other => other !== dep && ancestors.get(other)?.has(dep))).sort((a, b) => a - b);
    }
}
//# sourceMappingURL=ordering-relations.js.map