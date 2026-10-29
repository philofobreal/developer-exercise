import { contentKey } from './content-match.js';
import { reachability } from './reachability.js';
import { createUnitChecks } from './unit-structure.js';
export function createPlacement(compiled, profile) {
    const { acyclic, ancestors, descendants, lowest, highest, geometry, unitsOf, unitCount, scopes } = prepared(compiled, profile);
    const n = compiled.definition.tokens.length, assignment = new Int32Array(n).fill(-1), positions = new Int32Array(n).fill(-1);
    const blocks = geometry?.count ?? 0, low = new Int32Array(blocks).fill(-1), high = new Int32Array(blocks).fill(-1);
    // Blocks with a placed member, in placement order; `undo` restores in reverse.
    const active = [], saved = Array.from({ length: n }, () => []), placed = new Int32Array(unitCount), history = [];
    function admits(token, position) {
        if (!acyclic || positions[token] >= 0 || position < lowest[token] || position > highest[token])
            return false;
        if (!scopes.placementValid(token, position, positions))
            return false;
        // The closure includes every direct edge: no placed ancestor after, no placed descendant before.
        for (const other of ancestors[token])
            if (positions[other] > position)
                return false;
        for (const other of descendants[token]) {
            const at = positions[other];
            if (at >= 0 && at < position)
                return false;
        }
        if (geometry) {
            // A non-member may not fall strictly inside a block's placed hull ...
            for (const block of active)
                if (low[block] < position && position < high[block] && !geometry.member[block][token])
                    return false;
            // ... and a member may not stretch its block's hull over a placed non-member.
            for (const block of geometry.memberOf[token]) {
                if (high[block] < 0)
                    continue;
                const from = Math.min(low[block], position), to = Math.max(high[block], position);
                for (let at = from + 1; at < to; at++) {
                    if (at > low[block] && at < high[block]) {
                        at = high[block] - 1;
                        continue;
                    }
                    const other = assignment[at];
                    if (other >= 0 && !geometry.member[block][other])
                        return false;
                }
            }
        }
        // A unit not yet touched is tried only when no lower unit of its class is untouched either.
        for (const { unit, lower } of unitsOf[token])
            if (placed[unit] === 0 && lower.some(other => placed[other] === 0))
                return false;
        return true;
    }
    function place(token, position) {
        assignment[position] = token;
        positions[token] = position;
        history.push(token);
        if (geometry) {
            const undo = saved[token];
            for (const block of geometry.memberOf[token]) {
                undo.push(block, low[block], high[block]);
                if (high[block] < 0) {
                    active.push(block);
                    low[block] = high[block] = position;
                }
                else {
                    low[block] = Math.min(low[block], position);
                    high[block] = Math.max(high[block], position);
                }
            }
        }
        for (const { unit } of unitsOf[token])
            placed[unit]++;
    }
    function undo() {
        const token = history.pop(), undo = saved[token];
        for (let i = undo.length - 3; i >= 0; i -= 3) {
            const block = undo[i];
            low[block] = undo[i + 1];
            high[block] = undo[i + 2];
            if (high[block] < 0)
                active.pop();
        }
        undo.length = 0;
        for (const { unit } of unitsOf[token])
            placed[unit]--;
        assignment[positions[token]] = -1;
        positions[token] = -1;
    }
    return {
        tryPlace(token, position) {
            if (!admits(token, position))
                return false;
            place(token, position);
            // The placed prefix already determines lexical ownership; a later placement cannot repair it.
            if (scopes.prefixValid(assignment, true))
                return true;
            undo();
            return false;
        },
        undo,
        complete: () => scopes.prefixValid(assignment, false),
        witness: () => [...assignment]
    };
}
function scopeChecks(def) {
    if (def.structure) {
        const units = createUnitChecks(def);
        return { placementValid: units.placementValid, prefixValid: units.scopesValid };
    }
    const byId = new Map(def.tokens.map((token, i) => [token.id, i]));
    const opening = new Map(def.blocks.map(block => [byId.get(block.open), block.id])), closing = new Map(def.blocks.map(block => [byId.get(block.close), block.id]));
    return {
        placementValid: () => true,
        prefixValid(assignment, partial) {
            const stack = [];
            for (const token of assignment) {
                if (token < 0)
                    return partial;
                const closes = closing.get(token);
                if (closes !== undefined) {
                    if (stack.at(-1) !== closes)
                        return false;
                    stack.pop();
                }
                if (def.tokens[token].scope !== (stack.at(-1) ?? null))
                    return false;
                const opens = opening.get(token);
                if (opens !== undefined)
                    stack.push(opens);
            }
            return stack.length === 0;
        }
    };
}
const cache = new WeakMap();
function prepared(compiled, profile) {
    const entries = cache.get(compiled) ?? [];
    cache.set(compiled, entries);
    return entries[profile] ??= prepare(compiled.definition, compiled.profiles[profile].edges);
}
function prepare(def, ruleEdges) {
    const n = def.tokens.length, index = new Map(def.tokens.map((token, i) => [token.id, i]));
    const edges = ruleEdges.map(edge => [index.get(edge.before), index.get(edge.after)]);
    const reach = reachability(n, edges);
    const ancestors = Array.from({ length: n }, (_, token) => reach.ancestors(token)), descendants = Array.from({ length: n }, (_, token) => reach.descendants(token));
    // Convexity and units read legacy blocks; v3 unit containers keep their own checks.
    const geometry = def.structure ? null : blockGeometry(def);
    const unitsOf = Array.from({ length: n }, () => []);
    let unitCount = 0;
    if (geometry && reach.acyclic)
        for (const members of interchangeableUnits(def, edges, geometry)) {
            const ids = members.map(() => unitCount++);
            members.forEach((unit, rank) => { for (const token of unit)
                unitsOf[token].push({ unit: ids[rank], lower: ids.slice(0, rank) }); });
        }
    return {
        acyclic: reach.acyclic, ancestors, descendants, scopes: scopeChecks(def), geometry, unitsOf, unitCount,
        lowest: Int32Array.from(ancestors, list => list.length), highest: Int32Array.from(descendants, list => n - 1 - list.length)
    };
}
function blockGeometry(def) {
    const n = def.tokens.length, index = new Map(def.blocks.map((block, i) => [block.id, i])), byId = new Map(def.tokens.map((token, i) => [token.id, i]));
    const count = def.blocks.length, open = new Int32Array(count), parent = new Int32Array(count), boundary = new Int32Array(n).fill(-1);
    def.blocks.forEach((block, i) => { open[i] = byId.get(block.open); boundary[open[i]] = i; boundary[byId.get(block.close)] = i; parent[i] = block.parent === null ? -1 : index.get(block.parent); });
    const scope = Int32Array.from(def.tokens, token => token.scope === null ? -1 : index.get(token.scope));
    const member = Array.from({ length: count }, () => new Uint8Array(n)), memberOf = Array.from({ length: n }, () => []);
    const join = (block, token) => { if (!member[block][token]) {
        member[block][token] = 1;
        memberOf[token].push(block);
    } };
    for (let token = 0; token < n; token++) {
        for (let block = scope[token]; block >= 0; block = parent[block])
            join(block, token);
        if (boundary[token] >= 0)
            join(boundary[token], token);
    }
    return { count, open, scope, parent, boundary, member, memberOf };
}
/** Classes of sibling subtrees (a row that is no boundary, or a whole block) whose exchange is
 * an automorphism of this profile: equal content keys, no fixed slot, scopes and boundaries
 * mapped block for block, and every edge touching them mapped onto an edge. Each class lists
 * its units, each unit its tokens ascending, ranked by first token, with every k-th token
 * strictly increasing from rank to rank, so a skip can never cycle. */
function interchangeableUnits(def, edges, geometry) {
    const n = def.tokens.length, { boundary, open, scope, member } = geometry, keys = def.tokens.map(token => contentKey(token.code, token.normalization));
    const edgeSet = new Set(edges.map(([before, after]) => before * n + after)), touching = Array.from({ length: n }, () => []);
    for (const edge of edges) {
        touching[edge[0]].push(edge);
        touching[edge[1]].push(edge);
    }
    const siblings = new Map();
    const add = (parent, unit) => { const list = siblings.get(parent) ?? []; list.push(unit); siblings.set(parent, list); };
    for (let token = 0; token < n; token++)
        if (boundary[token] < 0)
            add(scope[token], [token]);
    for (let block = 0; block < geometry.count; block++) {
        const unit = [];
        for (let token = 0; token < n; token++)
            if (member[block][token])
                unit.push(token);
        add(geometry.parent[block], unit);
    }
    const classes = [];
    for (const units of siblings.values()) {
        const groups = new Map();
        for (const unit of units) {
            if (unit.some(token => def.tokens[token].fixedPosition !== undefined))
                continue;
            const signature = unit.map(token => keys[token] + '\u0001' + (boundary[token] < 0 ? '-' : open[boundary[token]] === token ? 'o' : 'c')).join('\u0002');
            const group = groups.get(signature) ?? [];
            group.push(unit);
            groups.set(signature, group);
        }
        for (const group of groups.values()) {
            let remaining = group.sort((a, b) => a[0] - b[0]);
            while (remaining.length > 1) {
                const representative = remaining[0], kept = [representative], rest = [];
                // Exchanges with one representative generate every exchange within the class.
                for (const other of remaining.slice(1))
                    (exchangeable(representative, other) ? kept : rest).push(other);
                if (kept.length > 1 && kept.every((unit, rank) => !rank || unit.every((token, k) => token > kept[rank - 1][k])))
                    classes.push(kept);
                remaining = rest;
            }
        }
    }
    return classes;
    function exchangeable(left, right) {
        if (left.length !== right.length)
            return false;
        const image = new Map();
        left.forEach((token, i) => { image.set(token, right[i]); image.set(right[i], token); });
        const map = (token) => image.get(token) ?? token;
        const blockImage = (block) => block < 0 ? -1 : boundary[map(open[block])];
        for (const token of [...left, ...right]) {
            const mapped = map(token), role = boundary[token];
            if (keys[mapped] !== keys[token] || def.tokens[mapped].fixedPosition !== undefined || scope[mapped] !== blockImage(scope[token]))
                return false;
            if (role < 0 ? boundary[mapped] >= 0 : boundary[mapped] !== blockImage(role) || (open[role] === token) !== (open[boundary[mapped]] === mapped))
                return false;
            for (const [before, after] of touching[token])
                if (!edgeSet.has(map(before) * n + map(after)))
                    return false;
        }
        return true;
    }
}
//# sourceMappingURL=placement.js.map