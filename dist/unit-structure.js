export function hierarchyValid(items) {
    const byId = new Map(items.map(item => [item.id, item]));
    if (byId.size !== items.length || items.some(item => !item.id))
        return false;
    for (const item of items) {
        const visited = new Set([item.id]);
        let parent = item.parentId;
        while (parent !== null) {
            if (visited.has(parent) || !byId.has(parent))
                return false;
            visited.add(parent);
            parent = byId.get(parent).parentId;
        }
    }
    return true;
}
/** Audit the lowered opt-in contract even when compileDefinition is called directly. */
export function auditUnitStructure(def, s) {
    if (!s || !Array.isArray(s.units) || !s.units.length || s.units.length > 500 || !Array.isArray(s.containers) || s.containers.length > 250 || !Array.isArray(s.boundaries) || s.boundaries.length > 500 || def.blocks.length)
        return 'Hibás unit/container szerkezet.';
    if (s.containers.some(c => !c || typeof c.id !== 'string' || (c.parentId !== null && typeof c.parentId !== 'string')) || !hierarchyValid(s.containers))
        return 'Hibás konténerhierarchia.';
    const tokenIds = new Set(def.tokens.map(t => t.id)), seen = new Set(), units = new Set();
    const edges = [];
    for (const unit of s.units) {
        if (!unit || typeof unit.id !== 'string' || !unit.id || units.has(unit.id) || !Array.isArray(unit.tokenIds) || !unit.tokenIds.length || unit.tokenIds.length > 500)
            return 'Hibás vagy ismétlődő unit.';
        units.add(unit.id);
        for (const [i, id] of unit.tokenIds.entries()) {
            if (!tokenIds.has(id) || seen.has(id))
                return 'A unitoknak partícionálniuk kell a fizikai sorokat.';
            seen.add(id);
            if (i)
                edges.push({ before: unit.tokenIds[i - 1], after: id });
        }
    }
    if (seen.size !== tokenIds.size)
        return 'Unit nélküli fizikai sor.';
    const containers = new Set(s.containers.map(c => c.id));
    if (def.tokens.some(t => t.scope !== null && !containers.has(t.scope)))
        return 'Ismeretlen syntactic container.';
    const opened = new Set(), closed = new Set();
    for (const b of s.boundaries) {
        if (!b || !tokenIds.has(b.tokenId) || !containers.has(b.containerId) || !['before', 'after'].includes(b.phase) || !['open', 'close'].includes(b.action))
            return 'Hibás határesemény.';
        const actions = b.action === 'open' ? opened : closed;
        if (actions.has(b.containerId))
            return 'Ismétlődő konténerhatár.';
        actions.add(b.containerId);
        const unit = s.units.find(u => u.tokenIds.includes(b.tokenId));
        if (b.tokenId !== (b.phase === 'before' ? unit.tokenIds[0] : unit.tokenIds.at(-1)))
            return 'Határesemény csak unithatárhoz köthető.';
    }
    if (opened.size !== containers.size || closed.size !== containers.size)
        return 'Hiányzó konténerhatár.';
    return edges;
}
/** Precomputed structural checks for the existing bounded bijection search. */
export function createUnitChecks(def) {
    const s = def.structure;
    const byId = new Map(def.tokens.map((t, i) => [t.id, i]));
    const parents = new Map(s.containers.map(c => [c.id, c.parentId]));
    const before = new Map(), after = new Map();
    for (const event of s.boundaries) {
        const map = event.phase === 'before' ? before : after, index = byId.get(event.tokenId);
        const events = map.get(index) ?? [];
        events.push(event);
        map.set(index, events);
    }
    const members = new Map();
    for (const unit of s.units) {
        const group = unit.tokenIds.map((id, offset) => ({ token: byId.get(id), offset }));
        for (const member of group)
            members.set(member.token, group);
    }
    function scopesValid(assignment, partial) {
        const stack = [];
        function eventsValid(events = []) {
            for (const e of events) {
                if (e.action === 'close') {
                    if (stack.pop() !== e.containerId)
                        return false;
                }
                else {
                    if ((stack.at(-1) ?? null) !== parents.get(e.containerId))
                        return false;
                    stack.push(e.containerId);
                }
            }
            return true;
        }
        for (const index of assignment) {
            if (index < 0)
                return partial;
            if (!eventsValid(before.get(index)) || def.tokens[index].scope !== (stack.at(-1) ?? null) || !eventsValid(after.get(index)))
                return false;
        }
        return stack.length === 0;
    }
    function placementValid(token, position, positions) {
        const group = members.get(token), offset = group.find(m => m.token === token).offset;
        const start = position - offset;
        if (start < 0 || start + group.length > def.tokens.length)
            return false;
        return group.every(m => positions[m.token] < 0 || positions[m.token] === start + m.offset);
    }
    return { scopesValid, placementValid };
}
//# sourceMappingURL=unit-structure.js.map