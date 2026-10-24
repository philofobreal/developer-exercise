import validateShape from './schema-check.js';
import { compileDefinition, isModelError } from './model.js';
const invalid = (message) => ({ status: 'invalid_reference', accepted: false, reason: 'invalid_model', message, exploredStates: 0 });
const refId = (id) => `n:${id}`;
/** Compile and audit once at publication time. Never compile rules supplied by a learner. */
export function compileCodeLineExercise(raw) {
    if (!validateShape(raw))
        return invalid('A CodeLine JSON Schema alakja, méretkorlátja vagy egyediségi feltétele sérült.');
    if (!raw || raw.schemaVersion !== 2 || !Array.isArray(raw.lines) || !Array.isArray(raw.blocks) || !raw.lines.length || raw.lines.length > 500)
        return invalid('Hibás CodeLine v2 definíció.');
    const seen = new Set();
    for (const l of raw.lines) {
        if (!l || !Number.isSafeInteger(l.id) || l.id < 1 || seen.has(l.id) || !Array.isArray(l.dependencies) || l.dependencies.some(d => !Number.isSafeInteger(d)) || typeof l.fixed !== 'boolean' || !Number.isSafeInteger(l.functionBlock) || l.functionBlock < 0 || (l.scopeId !== null && typeof l.scopeId !== 'string'))
            return invalid('Hibás sorazonosító, dependencies, fixed, functionBlock vagy scopeId.');
        seen.add(l.id);
    }
    const bIds = new Set();
    const boundaries = new Map();
    const functionIds = new Set();
    for (const b of raw.blocks) {
        if (!b || typeof b.id !== 'string' || !b.id || bIds.has(b.id) || !seen.has(b.openLineId) || !seen.has(b.closeLineId) || b.openLineId === b.closeLineId || boundaries.has(b.openLineId) || boundaries.has(b.closeLineId) || !['block', 'function'].includes(b.kind) || (b.parentScopeId !== null && typeof b.parentScopeId !== 'string'))
            return invalid('Hibás vagy átfedő blokkhatár.');
        if (b.kind === 'function') {
            if (!Number.isSafeInteger(b.functionBlock) || b.functionBlock <= 0 || functionIds.has(b.functionBlock))
                return invalid('Egyedi pozitív functionBlock szükséges a függvényblokkokhoz.');
            functionIds.add(b.functionBlock);
        }
        else if (b.functionBlock !== undefined)
            return invalid('A közönséges blokk nem definiálhat functionBlock azonosítót.');
        bIds.add(b.id);
        boundaries.set(b.openLineId, b);
        boundaries.set(b.closeLineId, b);
    }
    const blockById = new Map(raw.blocks.map(b => [b.id, b]));
    for (const l of raw.lines) {
        if (l.scopeId !== null && !bIds.has(l.scopeId))
            return invalid('Ismeretlen lexical scope.');
        const boundary = boundaries.get(l.id);
        let scope = boundary?.kind === 'function' ? boundary.id : l.scopeId;
        const visited = new Set();
        let owner = 0;
        while (scope !== null) {
            if (visited.has(scope))
                return invalid('Körkörös blokk-hierarchia.');
            visited.add(scope);
            const block = blockById.get(scope);
            if (!block)
                return invalid('Hiányzó blokk.');
            if (block.kind === 'function') {
                owner = block.functionBlock;
                break;
            }
            scope = block.parentScopeId;
        }
        if (l.functionBlock !== owner)
            return invalid(`A(z) ${l.id}. sor functionBlock értéke nem felel meg a blokk-hierarchiának (elvárt: ${owner}).`);
    }
    const tokens = raw.lines.map((l, index) => ({ id: refId(l.id), code: l.code, scope: l.scopeId, after: l.dependencies.map(refId), normalization: l.normalization ?? 'indent', ...(l.fixed ? { fixedPosition: index } : {}) }));
    const edges = (raw.edges ?? []).map(e => ({ before: refId(e.before), after: refId(e.after) }));
    // Pin token identity to a position; ordering edges would also partition peers.
    const profiles = (raw.profiles ?? []).map(p => ({ id: p.id, edges: p.edges.map(e => ({ before: refId(e.before), after: refId(e.after) })) }));
    const definition = { schemaVersion: 1, id: raw.id, revision: raw.revision, language: raw.language, title: raw.title, description: raw.description, tokens, blocks: raw.blocks.map(b => ({ id: b.id, open: refId(b.openLineId), close: refId(b.closeLineId), parent: b.parentScopeId })), edges, profiles };
    const compiled = compileDefinition(definition);
    if (isModelError(compiled))
        return compiled;
    return { definition, compiled };
}
//# sourceMappingURL=code-line.js.map