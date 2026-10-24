import { isSingleLine } from './normalize.js';
const failed = (message) => ({
    status: 'invalid_reference', accepted: false, reason: 'invalid_model', message, exploredStates: 0
});
function hasCycle(ids, edges) {
    const degree = new Map([...ids].map(x => [x, 0]));
    const out = new Map([...ids].map(x => [x, []]));
    for (const e of edges) {
        degree.set(e.after, (degree.get(e.after) ?? 0) + 1);
        out.get(e.before).push(e.after);
    }
    const queue = [...ids].filter(x => degree.get(x) === 0);
    let count = 0;
    for (let head = 0; head < queue.length; head++) {
        const id = queue[head];
        count++;
        for (const v of out.get(id)) {
            const next = degree.get(v) - 1;
            degree.set(v, next);
            if (next === 0)
                queue.push(v);
        }
    }
    return count !== ids.size;
}
/** Validate trusted author data once when publishing/loading it, NEVER trust the browser's copy. */
export function compileDefinition(def) {
    if (!def || def.schemaVersion !== 1 || typeof def.id !== 'string' || !def.id || typeof def.language !== 'string' || !def.language || typeof def.title !== 'string' || typeof def.description !== 'string' || !Number.isSafeInteger(def.revision) || def.revision < 1)
        return failed('Érvénytelen sémaverzió vagy feladatazonosító.');
    if (!Array.isArray(def.tokens) || def.tokens.length < 1 || def.tokens.length > 500 || !Array.isArray(def.blocks) || def.blocks.length > 250 || (def.edges !== undefined && (!Array.isArray(def.edges) || def.edges.length > 5000)) || (def.profiles !== undefined && !Array.isArray(def.profiles)))
        return failed('Érvénytelen feladatméret.');
    const tokenIds = new Set(), fixedPositions = new Set();
    for (const t of def.tokens) {
        if (!t || typeof t.id !== 'string' || !t.id || tokenIds.has(t.id) || typeof t.code !== 'string' || !isSingleLine(t.code) || Array.from(t.code).length > 2048 || (t.scope !== null && typeof t.scope !== 'string') || (t.after !== undefined && (!Array.isArray(t.after) || t.after.length > 500 || new Set(t.after).size !== t.after.length)) || (t.normalization !== undefined && t.normalization !== 'indent' && t.normalization !== 'exact'))
            return failed('Duplikált token vagy érvénytelen kódsor.');
        if (t.fixedPosition !== undefined) {
            if (!Number.isSafeInteger(t.fixedPosition) || t.fixedPosition < 0 || t.fixedPosition >= def.tokens.length || fixedPositions.has(t.fixedPosition))
                return failed('Érvénytelen vagy ütköző rögzített sorhely.');
            fixedPositions.add(t.fixedPosition);
        }
        tokenIds.add(t.id);
    }
    const blocks = new Map();
    const boundaries = new Set();
    for (const b of def.blocks) {
        if (typeof b?.id !== 'string' || !b.id || blocks.has(b.id) || (b.parent !== null && typeof b.parent !== 'string') || !tokenIds.has(b.open) || !tokenIds.has(b.close) || b.open === b.close || boundaries.has(b.open) || boundaries.has(b.close))
            return failed('Érvénytelen blokkhatárok.');
        boundaries.add(b.open);
        boundaries.add(b.close);
        blocks.set(b.id, { open: b.open, close: b.close, parent: b.parent });
    }
    for (const [id, b] of blocks) {
        if (b.parent !== null && (!blocks.has(b.parent) || id === b.parent))
            return failed('Nem létező vagy önhivatkozó szülőblokk.');
    }
    for (const b of blocks.values()) {
        const visited = new Set();
        let parent = b.parent;
        while (parent !== null) {
            if (visited.has(parent))
                return failed('Körkörös blokk-hierarchia.');
            visited.add(parent);
            parent = blocks.get(parent).parent;
        }
    }
    for (const t of def.tokens) {
        if (t.scope !== null && !blocks.has(t.scope))
            return failed(`Ismeretlen scope: ${t.id}`);
    }
    const byId = new Map(def.tokens.map(t => [t.id, t]));
    for (const [id, b] of blocks) {
        if (byId.get(b.open).scope !== b.parent || byId.get(b.close).scope !== b.parent)
            return failed(`Hibás blokk-határ scope: ${id}`);
    }
    const base = [];
    for (const t of def.tokens) {
        for (const p of t.after ?? [])
            base.push({ before: p, after: t.id });
        if (t.scope !== null) {
            const b = blocks.get(t.scope);
            base.push({ before: b.open, after: t.id }, { before: t.id, after: b.close });
        }
    }
    for (const b of blocks.values())
        base.push({ before: b.open, after: b.close });
    base.push(...(def.edges ?? []));
    const extras = def.profiles?.length ? def.profiles : [{ id: 'base', edges: [] }];
    if (extras.length > 32 || extras.some(x => !x || typeof x.id !== 'string' || !Array.isArray(x.edges)) || new Set(extras.map(x => x.id)).size !== extras.length)
        return failed('Érvénytelen vagy ismétlődő alternatíva.');
    const profiles = [];
    for (const profile of extras) {
        if (typeof profile?.id !== 'string' || !profile.id || !Array.isArray(profile.edges) || profile.edges.length > 5000)
            return failed('Érvénytelen alternatíva.');
        const edges = [...base, ...profile.edges];
        for (const e of edges)
            if (!e || !tokenIds.has(e.before) || !tokenIds.has(e.after) || e.before === e.after)
                return failed('Érvénytelen függőség-él.');
        if (edges.length > 10_000)
            return failed('Túl sok függőség.');
        if (hasCycle(tokenIds, edges))
            return failed(`Körkörös sorrendi feltétel: ${profile.id}`);
        profiles.push({ id: profile.id, edges });
    }
    return { definition: structuredClone(def), profiles: structuredClone(profiles) };
}
export function isModelError(result) {
    return 'status' in result;
}
//# sourceMappingURL=model.js.map