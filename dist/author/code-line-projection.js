import { reduceGeneratedDependencies, sealMultiRowUnits } from './ordering-relations.js';
/** Physical rows that become lines: non-blank, or whitespace-exact. */
export function projectedRows(physical, exact) {
    return physical.flatMap((code, line) => code.trim() || exact.has(line) ? [{ code, line }] : []);
}
/** Joins clause blocks sharing a boundary row (`} else {`) into one container: the
 * shared rows become separators, each clause a segment between two of them. Only a
 * row shared by exactly the two linked clauses qualifies, and the chain's own first
 * and last rows must be unshared. */
function clauseChains(blocks, counts) {
    const clauses = blocks.filter(block => block.clause && block.kind === 'block');
    const next = new Map(), linked = new Set();
    for (const block of clauses) {
        const following = clauses.filter(other => other !== block && other.start === block.end);
        if (following.length === 1 && counts.get(block.end) === 2) {
            next.set(block, following[0]);
            linked.add(following[0]);
        }
    }
    const chains = [], members = new Set();
    for (const head of clauses) {
        if (linked.has(head) || !next.has(head))
            continue;
        const chain = [head];
        for (let current = next.get(head); current; current = next.get(current))
            chain.push(current);
        const tail = chain.at(-1);
        if (counts.get(head.start) !== 1 || counts.get(tail.end) !== 1)
            continue;
        chain.forEach(block => members.add(block));
        chains.push({ start: head.start, end: tail.end, kind: 'block', clause: true, separators: chain.slice(1).map(block => block.start) });
    }
    return { chains, members };
}
export function projectCodeLine({ physical, exact, structure, ordering }) {
    const rows = projectedRows(physical, exact);
    const intervals = structure.filter(block => block.start < block.end);
    const counts = new Map();
    for (const block of intervals)
        for (const row of [block.start, block.end])
            counts.set(row, (counts.get(row) ?? 0) + 1);
    const { chains, members } = clauseChains(intervals, counts);
    const candidates = [...intervals.filter(block => !members.has(block)).map(block => ({ ...block, separators: [] })), ...chains].sort((a, b) => a.start - b.start || b.end - a.end);
    const retained = [], omitted = [];
    for (const block of candidates) {
        if ((counts.get(block.start) ?? 0) > 1 || (counts.get(block.end) ?? 0) > 1 || retained.length >= 250)
            omitted.push(block);
        else
            retained.push({ ...block, id: 'scope-' + (retained.length + 1), parent: null });
    }
    let nextFunction = 1;
    for (const block of retained) {
        block.parent = retained.filter(other => other.start < block.start && other.end > block.end).at(-1) ?? null;
        if (block.kind === 'function')
            block.functionBlock = nextFunction++;
    }
    const byPhysical = new Map(rows.map((row, i) => [row.line, i + 1]));
    const blocks = retained.map(block => ({ id: block.id, kind: block.kind, parentScopeId: block.parent?.id ?? null, openLineId: byPhysical.get(block.start), closeLineId: byPhysical.get(block.end), ...(block.kind === 'function' ? { functionBlock: block.functionBlock } : {}) }));
    const scopeOf = (line) => retained.filter(block => block.start < line && line < block.end).at(-1) ?? null;
    // Reasons per line ID, then per predecessor ID; replaced together with a line's dependencies.
    const why = new Map();
    const explain = (before, after, category, code) => {
        const own = why.get(after) ?? new Map();
        own.set(before, [...own.get(before) ?? [], { category, code }]);
        why.set(after, own);
    };
    // An unlisted row keeps its source predecessor: a closing row for its block, a continued
    // row for its multi-row unit, any other row because no analysis freed it.
    const closers = new Set(retained.map(block => block.end)), spans = ordering?.spans ?? [];
    rows.forEach(({ line }, i) => {
        if (!i)
            return;
        if (closers.has(line))
            explain(i, i + 1, 'structure', 'block-close');
        else if (spans.some(span => span.first < line && line <= span.last))
            explain(i, i + 1, 'unit', 'continued-row');
        else
            explain(i, i + 1, 'conservative', 'source-order');
    });
    const lines = rows.map(({ code, line }, i) => {
        const boundary = retained.find(block => block.start === line || block.end === line), scope = scopeOf(line);
        let owner = boundary?.kind === 'function' ? boundary : scope;
        while (owner && owner.kind !== 'function')
            owner = owner.parent;
        return { id: i + 1, sourceLine: line + 1, code, dependencies: i ? [i] : [], fixed: false, functionBlock: owner?.functionBlock ?? 0, scopeId: scope?.id ?? null, normalization: exact.has(line) ? 'exact' : 'indent' };
    });
    // Project the adapter's language-independent ordering relations onto line IDs.
    const protectedById = new Map(), toIds = (list) => [...list].flatMap(row => { const id = byPhysical.get(row); return id === undefined ? [] : [id]; });
    if (ordering) {
        for (const entry of ordering.entries) {
            const id = byPhysical.get(entry.row);
            if (id === undefined)
                continue;
            lines[id - 1].dependencies = toIds(entry.after);
            why.delete(id);
            for (const before of entry.after) {
                const own = (entry.reasons ?? []).filter(reason => reason.before === before), from = byPhysical.get(before);
                if (from !== undefined)
                    for (const { category, code } of own.length ? own : [{ category: 'unknown', code: 'adapter-unspecified' }])
                        explain(from, id, category, code);
            }
        }
        for (const [row, inputs] of ordering.protectedInputs) {
            const id = byPhysical.get(row);
            if (id !== undefined)
                protectedById.set(id, new Set(toIds(inputs)));
        }
    }
    // Clause segments: a separator follows the previous boundary and every top-level row of
    // the clause before it; every top-level row of the clause after it follows the separator.
    // (The container is one scope, so these edges, not the scope, keep each row in its clause.)
    for (const chain of retained.filter(block => block.separators.length)) {
        const boundaries = [chain.start, ...chain.separators, chain.end];
        const segment = (from, to) => rows.filter(row => row.line > from && row.line < to && scopeOf(row.line) === chain && !chain.separators.includes(row.line)).map(row => byPhysical.get(row.line));
        chain.separators.forEach((separator, i) => {
            const id = byPhysical.get(separator), previous = segment(boundaries[i], separator);
            lines[id - 1].dependencies = [...new Set([byPhysical.get(boundaries[i]), ...previous])];
            why.delete(id);
            explain(byPhysical.get(boundaries[i]), id, 'structure', 'clause-boundary');
            for (const before of previous)
                explain(before, id, 'structure', 'clause-segment');
            for (const after of segment(separator, boundaries[i + 2])) {
                const dependencies = lines[after - 1].dependencies;
                if (!dependencies.includes(id))
                    dependencies.push(id);
                explain(id, after, 'structure', 'clause-separator');
            }
        });
    }
    if (ordering) {
        const units = ordering.spans.flatMap(unit => { const first = byPhysical.get(unit.first), last = byPhysical.get(unit.last); return first === undefined || last === undefined ? [] : [{ first, last }]; });
        sealMultiRowUnits(lines, units, new Map(retained.map(block => [byPhysical.get(block.start), block.id])), (before, after) => explain(before, after, 'unit', 'sealed-unit'));
    }
    reduceGeneratedDependencies(lines, protectedById);
    // A row can still close and open unrelated blocks; lock only each such unrepresentable interval.
    const edgeMap = new Map();
    for (const block of omitted) {
        const ids = rows.flatMap((row, i) => row.line >= block.start && row.line <= block.end ? [i + 1] : []);
        for (let i = 1; i < ids.length; i++)
            edgeMap.set(ids[i - 1] + ':' + ids[i], { before: ids[i - 1], after: ids[i] });
    }
    const provenance = [];
    const emit = (before, after, reasons) => {
        const seen = new Set();
        for (const { category, code } of reasons)
            if (!seen.has(category + ':' + code)) {
                seen.add(category + ':' + code);
                provenance.push({ before, after, category, code });
            }
    };
    for (const line of lines)
        for (const before of line.dependencies)
            emit(before, line.id, why.get(line.id)?.get(before) ?? [{ category: 'unknown', code: 'projection-unspecified' }]);
    for (const edge of edgeMap.values())
        emit(edge.before, edge.after, [{ category: 'conservative', code: 'shared-boundary-lock' }]);
    provenance.sort((a, b) => a.after - b.after || a.before - b.before);
    return { lines, blocks, edges: [...edgeMap.values()], omittedBlocks: omitted.length, clauseChains: chains.filter(chain => retained.some(block => block.start === chain.start && block.end === chain.end)).length, provenance };
}
//# sourceMappingURL=code-line-projection.js.map