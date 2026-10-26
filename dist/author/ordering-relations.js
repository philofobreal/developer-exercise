/** Merges entries per row: predecessor sets and (deduplicated) reasons are unions. */
export function mergeOrderingEntries(entries) {
    const merged = new Map();
    for (const entry of entries) {
        const target = merged.get(entry.row) ?? { after: new Set(), reasons: new Map() };
        entry.after.forEach(row => target.after.add(row));
        for (const reason of entry.reasons ?? [])
            target.reasons.set(reason.before + ':' + reason.category + ':' + reason.code, reason);
        merged.set(entry.row, target);
    }
    return [...merged].map(([row, { after, reasons }]) => ({ row, after: [...after], ...(reasons.size ? { reasons: [...reasons.values()] } : {}) }));
}
/** Conjunction of independent analyses: predecessor sets, reasons, protected inputs and spans are unions. */
export function combineOrderingRelations(parts) {
    const protectedInputs = new Map();
    for (const part of parts)
        for (const [row, inputs] of part.protectedInputs) {
            const set = protectedInputs.get(row) ?? new Set();
            inputs.forEach(input => set.add(input));
            protectedInputs.set(row, set);
        }
    return { entries: mergeOrderingEntries(parts.flatMap(part => part.entries)), protectedInputs, spans: parts.flatMap(part => part.spans), note: parts.map(part => part.note).filter(Boolean).join(' ') };
}
/** The validator admits a row wherever the open scope equals its scopeId. Inside a
 * multi-row unit that holds only at continuation rows and at shared `} else {`
 * style boundaries (omitted blocks); there every same-scope sibling unit keeps its
 * source side (ADR-009). `units` are line-ID spans, `opener` maps a line opening a
 * retained block to that block's scopeId. Mutates the lines' dependencies and
 * reports every required pair, present or added, to `required`. */
export function sealMultiRowUnits(lines, units, opener, required = () => undefined) {
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
            required(before, after);
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