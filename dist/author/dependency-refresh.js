function blockKeys(model) {
    const positions = new Map(model.lines.map((line, index) => [line.id, index]));
    return new Map(model.blocks.map(block => [block.id, JSON.stringify([positions.get(block.openLineId), positions.get(block.closeLineId), block.kind])]));
}
/** Called with two audited models; only explicit author intent may replace dependencies. */
export function reconcileDependencies(original, generated) {
    const fail = () => { throw Error('Az új elemzés eltérő sor-/blokkstruktúrát ad. A változtatás nem alkalmazható csak a függőségekre; használd a Referenciaforrás alkalmazását új feladatként.'); };
    if (original.language !== generated.language || original.lines.length !== generated.lines.length || original.lines.some((line, index) => line.code !== generated.lines[index].code))
        return fail();
    const oldKeys = blockKeys(original), newKeys = blockKeys(generated);
    const signature = (block, keys) => JSON.stringify([keys.get(block.id), block.parentScopeId === null ? null : keys.get(block.parentScopeId)]);
    const oldBlocks = new Set(original.blocks.map(block => signature(block, oldKeys)));
    if (oldBlocks.size !== generated.blocks.length || generated.blocks.some(block => !oldBlocks.has(signature(block, newKeys))) || original.lines.some((line, index) => (line.scopeId === null ? null : oldKeys.get(line.scopeId)) !== (generated.lines[index].scopeId === null ? null : newKeys.get(generated.lines[index].scopeId))))
        return fail();
    const idMap = new Map(generated.lines.map((line, index) => [line.id, original.lines[index].id]));
    const edges = new Map((original.edges ?? []).map(edge => [JSON.stringify([edge.before, edge.after]), { ...edge }]));
    for (const edge of generated.edges ?? []) {
        const mapped = { before: idMap.get(edge.before), after: idMap.get(edge.after) };
        edges.set(JSON.stringify([mapped.before, mapped.after]), mapped);
    }
    const sourceLine = (row) => original.lines[row - 1]?.sourceLine ?? row;
    return {
        ...structuredClone(original),
        lines: original.lines.map((line, index) => ({ ...structuredClone(line), dependencies: generated.lines[index].dependencies.map(id => idMap.get(id)) })),
        edges: [...edges.values()],
        // Provenance (ADR-014) describes only the regenerated constraints; a kept original edge has none and explains as unknown.
        authoring: { ...original.authoring, ...generated.authoring, dependencyHints: (generated.authoring?.dependencyHints ?? []).map(hint => ({ ...hint, declarationLine: sourceLine(hint.declarationLine), usageLine: sourceLine(hint.usageLine) })), provenance: (generated.authoring?.provenance ?? []).map(entry => ({ ...entry, before: idMap.get(entry.before), after: idMap.get(entry.after) })) }
    };
}
//# sourceMappingURL=dependency-refresh.js.map