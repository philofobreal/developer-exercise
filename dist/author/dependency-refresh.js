function blockKeys(model) {
    const positions = new Map(model.lines.map((line, index) => [line.id, index]));
    return new Map(model.blocks.map(block => [block.id, JSON.stringify([positions.get(block.openLineId), positions.get(block.closeLineId), block.kind])]));
}
/** Whether two models of the same lines have the same block structure: the same blocks (rows and
 * kind) and every line in the same block (ADR-079: the verification gate compares this, not counts). */
export function sameStructure(a, b) {
    if (a.lines.length !== b.lines.length)
        return false;
    const keysA = blockKeys(a), keysB = blockKeys(b), scope = (keys, id) => id === null ? null : keys.get(id) ?? '?';
    const sorted = (keys) => JSON.stringify([...keys.values()].sort());
    return sorted(keysA) === sorted(keysB) && a.lines.every((line, index) => scope(keysA, line.scopeId) === scope(keysB, b.lines[index].scopeId));
}
/** The block structure of the refreshed model. The regeneration may refine the original
 * structure only by adding plain blocks, the multi-row units a block holds together
 * (ADR-066), and by opening a block earlier at its header rows (ADR-079: overload signatures,
 * which then lie in it): removing the added blocks and moving the anchored openings back must
 * give exactly the original blocks, parents and line scopes. Original blocks keep their IDs; an
 * added block gets a fresh one. Anything else changes the learner's structure and is refused. */
function refinedStructure(original, generated) {
    const oldKeys = blockKeys(original), newKeys = blockKeys(generated);
    const byKey = new Map(original.blocks.map(block => [oldKeys.get(block.id), block]));
    const generatedById = new Map(generated.blocks.map(block => [block.id, block]));
    const matched = new Map(generated.blocks.flatMap(block => { const old = byKey.get(newKeys.get(block.id)); return old ? [[block.id, old]] : []; }));
    // ADR-079: an unmatched block of the same kind and closing row that opens earlier is anchored.
    const at = (model, id) => model.lines.findIndex(line => line.id === id);
    const anchored = new Map(), claimed = new Set([...matched.values()].map(block => block.id));
    for (const block of generated.blocks) {
        if (matched.has(block.id))
            continue;
        const old = original.blocks.find(candidate => !claimed.has(candidate.id) && candidate.kind === block.kind && at(original, candidate.closeLineId) === at(generated, block.closeLineId) && at(original, candidate.openLineId) > at(generated, block.openLineId));
        if (!old)
            continue;
        matched.set(block.id, old);
        claimed.add(old.id);
        anchored.set(block.id, { from: at(generated, block.openLineId) + 1, to: at(original, old.openLineId) });
    }
    if (matched.size !== original.blocks.length || generated.blocks.some(block => !matched.has(block.id) && block.kind !== 'block'))
        return undefined;
    // The nearest enclosing original block, skipping the added ones.
    const lowered = (scope) => {
        let at = scope;
        for (let guard = 0; at !== null && !matched.has(at) && guard <= generated.blocks.length; guard++)
            at = generatedById.get(at)?.parentScopeId ?? null;
        return at === null ? null : matched.get(at)?.id ?? null;
    };
    if (generated.blocks.some(block => matched.has(block.id) && lowered(block.parentScopeId) !== matched.get(block.id).parentScopeId))
        return undefined;
    // The header rows of an anchored block were siblings before its original opening row, now inside it.
    const moved = (index, scope) => [...anchored].some(([id, { from, to }]) => index >= from && index <= to && lowered(scope) === matched.get(id).id && original.lines[index].scopeId === matched.get(id).parentScopeId);
    if (original.lines.some((line, index) => lowered(generated.lines[index].scopeId) !== line.scopeId && !moved(index, generated.lines[index].scopeId)))
        return undefined;
    const taken = new Set(original.blocks.map(block => block.id)), ids = new Map();
    let next = 1;
    for (const block of generated.blocks) {
        if (matched.has(block.id)) {
            ids.set(block.id, matched.get(block.id).id);
            continue;
        }
        while (taken.has('unit-' + next))
            next++;
        ids.set(block.id, 'unit-' + next);
        taken.add('unit-' + next);
    }
    const id = (scope) => scope === null ? null : ids.get(scope);
    const lineId = (generatedId) => original.lines[generatedId - 1].id;
    const blocks = generated.blocks.map(block => {
        const old = matched.get(block.id);
        return old ? { ...structuredClone(old), parentScopeId: id(block.parentScopeId), ...(anchored.has(block.id) ? { openLineId: lineId(block.openLineId) } : {}) } : { id: id(block.id), kind: 'block', parentScopeId: id(block.parentScopeId), openLineId: lineId(block.openLineId), closeLineId: lineId(block.closeLineId) };
    });
    return { blocks, scopeOf: index => id(generated.lines[index].scopeId) };
}
/** Called with two audited models; only explicit author intent may replace dependencies. */
export function reconcileDependencies(original, generated) {
    const fail = () => { throw Error('Az új elemzés eltérő sor-/blokkstruktúrát ad. A változtatás nem alkalmazható csak a függőségekre; használd a Referenciaforrás alkalmazását új feladatként.'); };
    if (original.language !== generated.language || original.lines.length !== generated.lines.length || original.lines.some((line, index) => line.code !== generated.lines[index].code))
        return fail();
    const structure = refinedStructure(original, generated) ?? fail();
    const idMap = new Map(generated.lines.map((line, index) => [line.id, original.lines[index].id]));
    // ADR-079: an anchored block's header rows now belong to its function; derive each line's owner from
    // the refreshed hierarchy as the core checks it (a function block's boundary row, else the scope chain).
    const byId = new Map(structure.blocks.map(block => [block.id, block])), boundaries = new Map();
    for (const block of structure.blocks)
        for (const line of [block.openLineId, block.closeLineId])
            boundaries.set(line, block);
    const owner = (lineId, scope) => {
        let at = boundaries.get(lineId)?.kind === 'function' ? boundaries.get(lineId).id : scope;
        for (let guard = 0; at !== null && guard <= structure.blocks.length; guard++) {
            const block = byId.get(at);
            if (!block)
                return 0;
            if (block.kind === 'function')
                return block.functionBlock ?? 0;
            at = block.parentScopeId;
        }
        return 0;
    };
    // Only the regenerated edges: which original edges are author rules decides mergeAuthorRules (ADR-018).
    const edges = (generated.edges ?? []).map(edge => ({ before: idMap.get(edge.before), after: idMap.get(edge.after) }));
    const sourceLine = (row) => original.lines[row - 1]?.sourceLine ?? row;
    return {
        ...structuredClone(original),
        lines: original.lines.map((line, index) => ({ ...structuredClone(line), scopeId: structure.scopeOf(index), functionBlock: owner(line.id, structure.scopeOf(index)), dependencies: generated.lines[index].dependencies.map(id => idMap.get(id)) })),
        blocks: structure.blocks,
        edges,
        // Provenance (ADR-014) describes only the regenerated constraints.
        authoring: { ...original.authoring, ...generated.authoring, dependencyHints: (generated.authoring?.dependencyHints ?? []).map(hint => ({ ...hint, declarationLine: sourceLine(hint.declarationLine), usageLine: sourceLine(hint.usageLine) })), provenance: (generated.authoring?.provenance ?? []).map(entry => ({ ...entry, before: idMap.get(entry.before), after: idMap.get(entry.after) })) }
    };
}
//# sourceMappingURL=dependency-refresh.js.map