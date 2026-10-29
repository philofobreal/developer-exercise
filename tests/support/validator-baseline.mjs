/** Frozen copy of the validator search before ADR-036 (commit 312314f), compiled output.
 * Test support only: the equivalence tests compare the pruned search against it. Never import
 * it from production code. Content matching, whose candidate order decides which witness is
 * found first, is frozen here too; compilation and the v3 unit checks are shared on purpose:
 * both searches must read the same rules. */
import { compileDefinition, isModelError } from '../../dist/model.js';
const normalizeLine = (code, mode = 'indent') => mode === 'indent' ? code.replace(/^[ \t]*/, '') : code;
function matchContent(tokens, lines) {
    const tokenKeys = tokens.map(t => `${t.normalization ?? 'indent'}\u0000${normalizeLine(t.code, t.normalization ?? 'indent')}`);
    const index = new Map();
    tokenKeys.forEach((key, i) => { const items = index.get(key) ?? []; items.push(i); index.set(key, items); });
    const matching = lines.map(line => [
        ...(index.get(`indent\u0000${normalizeLine(line, 'indent')}`) ?? []),
        ...(index.get(`exact\u0000${line}`) ?? [])
    ].sort((a, b) => a - b));
    const unknown = matching.flatMap((a, i) => a.length ? [] : [i]);
    const pinnedMismatch = tokens.flatMap(token => {
        if (token.fixedPosition === undefined) return [];
        const line = lines[token.fixedPosition], mode = token.normalization ?? 'indent';
        return line === undefined || normalizeLine(line, mode) !== normalizeLine(token.code, mode) ? [token.fixedPosition] : [];
    });
    const candidates = matching.map((items, position) => items.filter(i => tokens[i].fixedPosition === undefined || tokens[i].fixedPosition === position));
    return { tokenKeys, matching, candidates, unknown, pinnedMismatch };
}
import { createUnitChecks } from '../../dist/unit-structure.js';
const result = (status, reason, message, exploredStates, positions) => ({ status, accepted: status === 'accepted', reason, message, exploredStates, ...(positions ? { positions } : {}) });
/**
 * Witness-based exact validation:
 *   ∃ bijection of submitted positions to reference token instances
 *   respecting content normalization, lexical scopes, ordering edges, and one profile.
 * Deterministic bounded search: exhausted budget => INDETERMINATE, never falsely rejected.
 * No JS/TS execution, eval, vm, or server-side source parsing.
 */
export function validateSubmissionBaseline(compiledOrRaw, submission, opts = {}) {
    if (!compiledOrRaw || typeof compiledOrRaw !== 'object')
        return result('invalid_reference', 'invalid_model', 'Hiányzó referencia.', 0);
    const compiled = 'profiles' in compiledOrRaw && 'definition' in compiledOrRaw
        ? compiledOrRaw : compileDefinition(compiledOrRaw);
    if (isModelError(compiled))
        return compiled;
    const def = compiled.definition;
    if (submission?.exerciseId !== def.id || submission.revision !== def.revision || !Array.isArray(submission.lines))
        return result('rejected', 'invalid_submission', 'Feladatazonosító, verzió vagy beküldési séma eltér.', 0);
    if (submission.lines.length !== def.tokens.length)
        return result('rejected', 'wrong_length', `Várt elemszám: ${def.tokens.length}, beküldött: ${submission.lines.length}.`, 0);
    if (submission.lines.some(x => typeof x !== 'string' || Array.from(x).length > 2048 || /[\r\n\u2028\u2029]/.test(x)))
        return result('rejected', 'unknown_content', 'Érvénytelen kódsor szerepel a beküldésben.', 0);
    const tokens = def.tokens;
    const { tokenKeys, candidates, unknown: impossible, pinnedMismatch } = matchContent(tokens, submission.lines);
    if (impossible.length)
        return result('rejected', 'unknown_content', 'A feladatban nem engedélyezett sor található.', 0, impossible);
    if (pinnedMismatch.length)
        return result('rejected', 'rule_violation', 'A rögzített sor tartalma nem a kötelező sorhelyen áll.', 0, pinnedMismatch);
    const counts = new Map();
    for (const key of tokenKeys) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // Fast sufficient multiplicity check: all candidates map to exactly one key set.
    const singles = candidates.map(a => new Set(a.map(i => tokenKeys[i])));
    if (singles.every(s => s.size === 1)) {
        const got = new Map();
        for (const s of singles) {
            const k = [...s][0];
            got.set(k, (got.get(k) ?? 0) + 1);
        }
        if ([...counts].some(([k, v]) => got.get(k) !== v))
            return result('rejected', 'wrong_multiplicity', 'A kódsorok előfordulási száma nem egyezik.', 0);
    }
    const ids = tokens.map(t => t.id), byId = new Map(ids.map((id, i) => [id, i]));
    const opening = new Map(def.blocks.map(b => [byId.get(b.open), b.id]));
    const closing = new Map(def.blocks.map(b => [byId.get(b.close), b.id]));
    const maxStates = Math.max(1, Math.min(1_000_000, Math.floor(Number.isFinite(opts.maxStates) ? opts.maxStates : 30_000)));
    let totalStates = 0;
    let exceeded = false;
    const unitChecks = def.structure ? createUnitChecks(def) : null;
    function scopesValid(assignment, partial = false) {
        if (unitChecks)
            return unitChecks.scopesValid(assignment, partial);
        const stack = [];
        for (const idx of assignment) {
            // The assigned prefix already determines lexical ownership. A later
            // assignment cannot repair a wrong scope earlier in that prefix.
            if (idx < 0)
                return partial;
            const t = tokens[idx];
            const closeId = closing.get(idx);
            if (closeId !== undefined) {
                if (stack[stack.length - 1] !== closeId)
                    return false;
                stack.pop();
            }
            const current = stack.length ? stack[stack.length - 1] : null;
            if (t.scope !== current)
                return false;
            const openId = opening.get(idx);
            if (openId !== undefined)
                stack.push(openId);
        }
        return stack.length === 0;
    }
    for (const profile of compiled.profiles) {
        const edges = profile.edges.map(e => [byId.get(e.before), byId.get(e.after)]);
        const related = Array.from({ length: tokens.length }, () => []);
        for (const edge of edges) {
            related[edge[0]].push(edge);
            related[edge[1]].push(edge);
        }
        const assignment = new Int32Array(tokens.length).fill(-1);
        const posByToken = new Int32Array(tokens.length).fill(-1);
        const used = new Uint8Array(tokens.length);
        // MRV heuristic: least choices first, then most dependencies for early rejection.
        const visitOrder = candidates.map((a, i) => ({ i, size: a.length, degree: Math.max(...a.map(j => related[j].length)) }))
            .sort((a, b) => a.size - b.size || b.degree - a.degree || a.i - b.i).map(x => x.i);
        function dfs(depth) {
            if (totalStates >= maxStates) {
                exceeded = true;
                return false;
            }
            totalStates++;
            if (!scopesValid(assignment, true))
                return false;
            if (depth === visitOrder.length)
                return scopesValid(assignment);
            const position = visitOrder[depth];
            for (const idx of candidates[position]) {
                if (used[idx])
                    continue;
                if (unitChecks && !unitChecks.placementValid(idx, position, posByToken))
                    continue;
                let valid = true;
                for (const [before, after] of related[idx]) {
                    const other = before === idx ? after : before;
                    const otherPos = posByToken[other];
                    if (otherPos < 0)
                        continue;
                    if (before === idx && !(position < otherPos) || after === idx && !(otherPos < position)) {
                        valid = false;
                        break;
                    }
                }
                if (!valid)
                    continue;
                used[idx] = 1;
                assignment[position] = idx;
                posByToken[idx] = position;
                if (dfs(depth + 1))
                    return true;
                used[idx] = 0;
                assignment[position] = -1;
                posByToken[idx] = -1;
                if (exceeded)
                    return false;
            }
            return false;
        }
        if (dfs(0))
            return { ...result('accepted', null, 'Az összeállított tartalomsorozathoz létezik minden szabályt kielégítő hozzárendelés.', totalStates), matchedProfile: profile.id, matchedTokenIds: [...assignment].map(index => tokens[index].id) };
        if (exceeded)
            break;
    }
    if (exceeded)
        return result('indeterminate', 'search_budget', 'A keresési keret elfogyott; a megoldás NEM minősíthető hibásnak.', totalStates);
    return result('rejected', 'rule_violation', 'A tartalom megvan, de nem létezik az összes szabályt teljesítő elrendezés.', totalStates);
}
