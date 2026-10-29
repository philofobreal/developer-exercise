import { compileDefinition, isModelError } from './model.js';
import { matchContent } from './content-match.js';
import { validateSubmission } from './validator.js';
import { reachability } from './reachability.js';
import { explainConstraints } from './constraint-explanation.js';
export const disclosureLevels = ['verdict', 'positions', 'rules', 'provenance'];
export const ruleKey = (before, after) => before + '\u0000' + after;
const MAX_REPORTED = 12, MAX_REPAIRED = 3;
const clampInt = (value, fallback, max) => Math.max(1, Math.min(max, Math.floor(Number.isFinite(value) ? value : fallback)));
const reasonText = {
    data: 'A két sor ugyanazt az adatot olvassa vagy írja, ezért a sorrendjük számít.',
    effect: 'A két sor megfigyelhető mellékhatása miatt a sorrendjük nem cserélhető fel.',
    policy: 'A sorrendet a feladat rendezési szabályrendszere rögzíti.',
    conservative: 'A generátor konzervatív korlátozást alkalmaz, mert a felcserélhetőség nem bizonyított.',
    author: 'A feladat készítője ennél a sornál kifejezett sorrendi előírást adott meg.',
    structure: 'A két sor helyét a program szerkezete (blokk- vagy klauzulahatár) köti.',
    unit: 'A két sor egy többsoros egység része, ezért együtt mozog.',
    unknown: ''
};
export function discloseReport(report, level) {
    const rank = disclosureLevels.indexOf(level);
    const redact = (d) => {
        if (rank >= disclosureLevels.indexOf('provenance'))
            return d;
        // ADR-030: where a line belongs is rule-level knowledge; below `rules` a moving fix is withheld.
        if (d.fix?.move && rank < disclosureLevels.indexOf('rules')) {
            const { fix: _fix, ...unfixed } = d;
            d = unfixed;
        }
        // The reason-derived codes name a provenance category, so below `provenance` they read as a plain order rule.
        const { reasons: _reasons, ...rest } = d, code = d.code === 'pedagogical-rule' || d.code === 'structural-placement' ? 'order-direct' : d.code;
        return rest.rule ? { ...rest, code, rule: { ...rest.rule, categories: [] } } : rest;
    };
    const shown = report.diagnostics.filter(d => disclosureLevels.indexOf(d.disclosure) <= rank).map(redact), withheld = report.diagnostics.length - shown.length;
    if (withheld && report.verdict.status === 'rejected' && !shown.some(d => d.severity === 'error'))
        shown.unshift({ ...base('withheld', 'error', 'general', 'verdict'), summary: report.verdict.message, detail: 'A megoldás nem fogadható el; a pontos ok ebben a nézetben nem jelenik meg.', evidence: 'A validátor döntése.' });
    return { level, diagnostics: shown, explained: report.verdict.accepted || shown.some(d => d.certainty === 'proven' && d.code !== 'diagnostic-budget'), withheld };
}
/** The single disclosure policy (ADR-027), used alike by the trusted server and the Pages demo:
 * the author preview sees everything and the learner level beside it; a learner gets the level
 * the exercise's author chose (`learnerFeedback`, default `positions`), never reasons or
 * provenance. An unknown stored value falls back to `positions`. */
export function channelFeedback(report, channel, learnerFeedback) {
    const learner = discloseReport(report, learnerFeedback === 'rules' ? 'rules' : 'positions');
    return channel === 'author-preview' ? { author: discloseReport(report, 'provenance'), learner } : { learner };
}
/** Bound provenance of a CodeLine v2 model as diagnostic reasons; empty when unbound or absent. */
export function codeLineDiagnosticReasons(model) {
    const reasons = new Map();
    const explanation = explainConstraints(model);
    if ('status' in explanation || explanation.provenance === 'absent' || explanation.provenance === 'unbound')
        return reasons;
    for (const line of explanation.lines)
        for (const constraint of line.predecessors) {
            const categories = [...new Set(constraint.reasons.map(reason => reason.category).filter(category => category !== 'unknown'))];
            if (categories.length)
                reasons.set(ruleKey('n:' + constraint.before, 'n:' + constraint.after), categories);
        }
    return reasons;
}
/** Diagnose one submission. The verdict is computed by `validateSubmission` with the same options. */
export function diagnoseSubmission(compiledOrRaw, submission, options = {}) {
    const verdict = validateSubmission(compiledOrRaw, submission, options);
    const limit = clampInt(options.maxSteps, 1_000_000, 50_000_000);
    const budget = { limit, used: 0, spend(steps) { this.used += steps; return this.used <= this.limit; } };
    const finish = (diagnostics) => {
        const exhausted = budget.used > limit;
        if (exhausted)
            diagnostics.push(notice('diagnostic-budget', 'A részletes magyarázat számítási kerete elfogyott.', 'Az eredmény érvényes, de a magyarázat részleges: csak a keret elfogyása előtt bizonyított okok szerepelnek.', 'A diagnosztika lépésszáma elérte a beállított keretet.'));
        return { verdict, diagnostics, explained: verdict.accepted || diagnostics.some(d => d.certainty === 'proven' && d.code !== 'diagnostic-budget'), budget: { limit, used: Math.min(budget.used, limit), exhausted } };
    };
    if (verdict.status === 'accepted')
        return finish([]);
    if (verdict.status === 'invalid_reference')
        return finish([notice('invalid-reference', 'A feladat referenciamodellje hibás; ez nem a megoldás hibája.', 'A megoldás nem értékelhető, mert a feladat modellje nem fogadható be: ' + verdict.message, 'A modell befogadása elutasította a referenciát.')]);
    if (verdict.status === 'indeterminate')
        return finish([notice('search-budget', 'Az ellenőrzés számítási kerete elfogyott, ezért a megoldás helyessége nem dönthető el.', 'A megoldás nem minősíthető hibásnak: a validátor a keretén belül nem talált sem szabályos hozzárendelést, sem cáfolatot.', `A validátor ${verdict.exploredStates} állapotot vizsgált.`)]);
    const compiled = 'profiles' in compiledOrRaw && 'definition' in compiledOrRaw ? compiledOrRaw : compileDefinition(compiledOrRaw);
    if (isModelError(compiled))
        return finish([]);
    const lines = submission.lines;
    if (verdict.reason === 'invalid_submission' || verdict.reason === 'unknown_content' && !verdict.positions) {
        return finish([{ ...base('invalid-submission', 'error', 'proven', 'positions'), summary: 'A beküldés nem értékelhető formájú.', detail: verdict.message, evidence: 'A beküldés sémája, feladatazonosítója vagy egy sora érvénytelen.' }]);
    }
    const def = compiled.definition, tokens = def.tokens;
    if (!budget.spend(lines.length + tokens.length))
        return finish([]);
    const match = matchContent(tokens, lines);
    const content = contentDiagnostics(def, lines, match, budget);
    if (content.length || lines.length !== tokens.length)
        return finish(content.length ? content : [unexplained(def, compiled)]);
    const fixed = fixedDiagnostics(def, lines, match);
    if (fixed.length)
        return finish(fixed);
    return finish(orderingDiagnostics(compiled, lines, match.candidates, options, budget));
}
function base(code, severity, certainty, disclosure) {
    return { code, severity, certainty, positions: [], positionScope: 'none', references: [], disclosure };
}
function notice(code, summary, detail, evidence) {
    return { ...base(code, 'notice', 'proven', 'verdict'), summary, detail, evidence };
}
function quote(code) {
    const text = code.replace(/^[ \t]*/, '');
    return '„' + (Array.from(text).length > 60 ? Array.from(text).slice(0, 59).join('') + '…' : text) + '”';
}
const row = (position) => `${position + 1}. sor`;
const rows = (positions) => positions.map(p => `${p + 1}.`).join(', ') + ' sor';
/** Content: unknown lines, and per group of interchangeable content a count mismatch. */
function contentDiagnostics(def, lines, match, budget) {
    const out = [];
    for (const position of match.unknown)
        out.push({ ...base('unknown-content', 'error', 'proven', 'positions'), positions: [position], positionScope: 'all', summary: `A(z) ${row(position)} (${quote(lines[position])}) nem része a feladatnak.`, detail: `A(z) ${row(position)} tartalma egyetlen referenciasorral sem egyezik, ezért nem szerepelhet a megoldásban.`, evidence: 'A sor tartalma (a behúzási szabály szerint) egyik referenciasorral sem egyezik.', fix: { level: 'guidance', text: 'Töröld ezt a sort, vagy javítsd a tartalmát.' } });
    // Components of the content graph: tokens with equal keys, and each position with its matches.
    const n = def.tokens.length, parent = Array.from({ length: n + lines.length }, (_, i) => i);
    const find = (x) => { while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
    } return x; };
    const union = (a, b) => { parent[find(a)] = find(b); };
    const firstOfKey = new Map();
    match.tokenKeys.forEach((key, i) => { const first = firstOfKey.get(key); if (first === undefined)
        firstOfKey.set(key, i);
    else
        union(i, first); });
    match.matching.forEach((items, position) => { for (const token of new Set(items.map(i => firstOfKey.get(match.tokenKeys[i]))))
        union(n + position, token); });
    if (!budget.spend(n + lines.length))
        return out;
    const groups = new Map();
    const group = (x) => { const root = find(x); const g = groups.get(root) ?? { tokens: [], positions: [] }; groups.set(root, g); return g; };
    for (let i = 0; i < n; i++)
        group(i).tokens.push(i);
    match.matching.forEach((items, position) => { if (items.length)
        group(n + position).positions.push(position); });
    for (const { tokens, positions } of groups.values()) {
        const codes = new Set(tokens.map(i => def.tokens[i].code.replace(/^[ \t]*/, '')));
        const named = codes.size === 1 ? quote(def.tokens[tokens[0]].code) : 'egymással felcserélhető';
        if (positions.length > tokens.length)
            out.push({ ...base('extra-line', 'error', 'proven', 'rules'), positions, positionScope: 'some', summary: `A(z) ${named} sor ${positions.length}-szor szerepel, de csak ${tokens.length}-szer kell.`, detail: `A(z) ${rows(positions)} tartalma azonos szerepű; közülük ${positions.length - tokens.length} fölösleges. Hogy melyik, az a tartalomból nem dönthető el.`, evidence: 'Az azonos tartalmú beküldött sorok száma meghaladja a referencia ilyen sorainak számát.', limits: 'Nem nevezhető meg, melyik azonos tartalmú sor a fölösleges.', fix: { level: 'guidance', text: `Távolíts el ${positions.length - tokens.length} ilyen sort.` } });
        else if (positions.length < tokens.length)
            out.push({ ...base('missing-line', 'error', 'proven', 'rules'), summary: positions.length ? `A(z) ${named} sorból ${tokens.length} kell, de csak ${positions.length} szerepel.` : `Hiányzik ${tokens.length === 1 ? 'egy' : tokens.length} sor: ${named}.`, detail: `A referencia ${tokens.length} ilyen sort tartalmaz, a beküldés ${positions.length}-t.`, evidence: 'A beküldött sorok tartalma kevesebbszer fordul elő, mint a referenciában.', fix: { level: 'guidance', text: 'Pótold a hiányzó sort a megfelelő helyre.' } });
        else if (new Set(tokens.map(i => match.tokenKeys[i])).size > 1 && perfectMatching(tokens, positions, match.matching, budget) === false)
            out.push({ ...base('wrong-multiplicity', 'error', 'proven', 'rules'), positions, positionScope: 'some', summary: 'A sorok előfordulási száma nem egyezik a feladatéval.', detail: `A(z) ${rows(positions)} együtt sem feleltethető meg a referencia azonos szerepű sorainak.`, evidence: 'A tartalmi párosítás (behúzással és pontos egyezéssel) nem teljes.', limits: 'Nem nevezhető meg egyetlen hibás sor.' });
    }
    return out;
}
/** Kuhn's augmenting paths inside one content group; only mixed `indent`/`exact` groups need it.
 * `null` when the budget ran out: then nothing is proven either way. */
function perfectMatching(tokens, positions, matching, budget) {
    const owner = new Map();
    const tryAssign = (position, seen) => {
        for (const token of matching[position]) {
            if (!budget.spend(1))
                return false;
            if (seen.has(token))
                continue;
            seen.add(token);
            const other = owner.get(token);
            if (other === undefined || tryAssign(other, seen)) {
                owner.set(token, position);
                return true;
            }
        }
        return false;
    };
    const complete = positions.every(position => tryAssign(position, new Set())) && owner.size === tokens.length;
    return budget.used > budget.limit ? null : complete;
}
/** A fixed slot holds other content, or a line could stand only at a fixed slot that is taken. */
function fixedDiagnostics(def, lines, match) {
    const out = [];
    for (const position of match.pinnedMismatch) {
        const token = def.tokens.find(t => t.fixedPosition === position);
        out.push({ ...base('fixed-position', 'error', 'proven', 'positions'), positions: [position], positionScope: 'all', references: [token.id], summary: `A(z) ${row(position)} rögzített hely: itt a(z) ${quote(token.code)} sornak kell állnia.`, detail: `A rögzített sorok nem mozdíthatók; a(z) ${row(position)} helyén most ${quote(lines[position])} áll.`, evidence: 'A rögzített sor tartalma nem a kötelező sorhelyen áll.', fix: { level: 'guidance', text: `Állítsd vissza a(z) ${quote(token.code)} sort a(z) ${row(position)} helyére.` } });
    }
    match.candidates.forEach((items, position) => {
        if (items.length || !match.matching[position].length)
            return;
        out.push({ ...base('fixed-position', 'error', 'proven', 'positions'), positions: [position], positionScope: 'all', summary: `A(z) ${row(position)} (${quote(lines[position])}) csak a rögzített helyén állhat.`, detail: 'Ez a tartalom a feladatban csak rögzített sorként szerepel, és a rögzített helye máshol van.', evidence: 'A sor tartalma kizárólag rögzített referenciasorokkal egyezik, amelyek másik sorhelyhez kötöttek.', fix: { level: 'guidance', text: 'Töröld innen ezt a sort.' } });
    });
    return out;
}
function unexplained(def, compiled) {
    const keys = def.tokens.map(t => (t.normalization ?? 'indent') + '\u0000' + (t.normalization === 'exact' ? t.code : t.code.replace(/^[ \t]*/, '')));
    const duplicated = new Set(keys).size < keys.length, profiles = compiled.profiles.length > 1;
    const why = [duplicated ? 'az azonos tartalmú sorok többféleképpen párosíthatók a feladat soraival' : '', profiles ? 'a feladat több alternatív sorrendet is megenged' : '', !duplicated && !profiles ? 'több szabály csak együtt zárja ki ezt az elrendezést' : ''].filter(Boolean).join(', és ');
    return { ...base('unexplained-rejection', 'error', 'general', 'verdict'), summary: 'A sorok tartalma rendben van, de az elrendezés nem teljesíti a feladat szabályait.', detail: `A pontos ok nem nevezhető meg biztosan, mert ${why}.`, evidence: 'A validátor kimerítő kereséssel igazolta, hogy nincs minden szabályt teljesítő hozzárendelés.', limits: 'Egyetlen hibás sor sem nevezhető meg bizonyítottan.' };
}
/** Ordering, scope and unit conflicts over the candidate positions of every token. */
function orderingDiagnostics(compiled, lines, candidates, options, budget) {
    const def = compiled.definition, tokens = def.tokens, n = tokens.length;
    const byId = new Map(tokens.map((t, i) => [t.id, i]));
    const lo = new Array(n).fill(Infinity), hi = new Array(n).fill(-Infinity);
    candidates.forEach((items, position) => { for (const t of items) {
        lo[t] = Math.min(lo[t], position);
        hi[t] = Math.max(hi[t], position);
    } });
    if (!budget.spend(n + lines.length))
        return [];
    const forced = (t) => lo[t] === hi[t];
    const origins = ruleOrigins(def);
    const keyOf = ([a, b]) => ruleKey(tokens[a].id, tokens[b].id);
    const edgeSets = compiled.profiles.map(profile => dedupe(profile.edges.map(e => [byId.get(e.before), byId.get(e.after)]), keyOf));
    const common = edgeSets.reduce((shared, edges) => { const keys = new Set(edges.map(keyOf)); return shared.filter(e => keys.has(keyOf(e))); });
    const commonKeys = new Set(common.map(keyOf));
    const out = [];
    const shared = conflicts(common, n, lo, hi, budget);
    const units = unitDiagnostics(def, lines, byId, lo, forced, budget);
    const unitTokens = new Set(units.flatMap(d => d.references));
    for (const violation of shared) {
        const key = keyOf([violation.a, violation.b]);
        if (!violation.transitive && origins.get(key)?.every(o => o === 'unit') && unitTokens.has(tokens[violation.a].id))
            continue;
        out.push(ruleDiagnostic(violation, compiled, lines, candidates, lo, hi, origins.get(key) ?? [], options, common));
    }
    out.push(...units, ...scopeDiagnostics(def, lines, byId, candidates, lo, hi, forced, new Set(shared.flatMap(v => [v.a, v.b])), budget));
    if (!out.length && compiled.profiles.length > 1) {
        const perProfile = compiled.profiles.map((profile, i) => conflicts(edgeSets[i], n, lo, hi, budget).filter(v => v.transitive || !commonKeys.has(keyOf([v.a, v.b]))).map(v => ({ ...v, profile: profile.id })));
        if (perProfile.every(list => list.length))
            perProfile.forEach((list, i) => out.push(ruleDiagnostic(list[0], compiled, lines, candidates, lo, hi, origins.get(keyOf([list[0].a, list[0].b])) ?? ['profile'], options, edgeSets[i])));
    }
    if (!out.length) {
        if (budget.used > budget.limit)
            return [];
        const move = moveRepair(compiled, lines, candidates, common, options);
        return move ? [unexplained(def, compiled), move] : [unexplained(def, compiled)];
    }
    const ranked = out.sort((x, y) => Math.min(...x.positions, Infinity) - Math.min(...y.positions, Infinity)).slice(0, MAX_REPORTED);
    let repaired = 0;
    for (const diagnostic of ranked) {
        if (repaired >= MAX_REPAIRED || budget.used > budget.limit)
            break;
        if (diagnostic.rule && diagnostic.positionScope === 'all' && diagnostic.references.length === 2) {
            const fix = repair(compiled, lines, candidates, diagnostic, options, budget);
            if (fix) {
                diagnostic.fix = fix;
                repaired++;
            }
        }
    }
    return ranked;
}
function dedupe(edges, key) {
    const seen = new Set();
    return edges.filter(edge => { const k = key(edge); if (seen.has(k))
        return false; seen.add(k); return true; });
}
function ruleOrigins(def) {
    const origins = new Map();
    const add = (before, after, origin) => { const key = ruleKey(before, after), list = origins.get(key) ?? []; if (!list.includes(origin))
        list.push(origin); origins.set(key, list); };
    for (const t of def.tokens)
        for (const before of t.after ?? [])
            add(before, t.id, 'dependency');
    for (const e of def.edges ?? [])
        add(e.before, e.after, 'edge');
    if (def.structure)
        for (const unit of def.structure.units)
            unit.tokenIds.forEach((id, i) => { if (i)
                add(unit.tokenIds[i - 1], id, 'unit'); });
    else {
        const blocks = new Map(def.blocks.map(b => [b.id, b]));
        for (const t of def.tokens) {
            const b = t.scope === null ? undefined : blocks.get(t.scope);
            if (b) {
                add(b.open, t.id, 'block');
                add(t.id, b.close, 'block');
            }
        }
        for (const b of def.blocks)
            add(b.open, b.close, 'block');
    }
    for (const profile of def.profiles ?? [])
        for (const e of profile.edges)
            add(e.before, e.after, 'profile');
    return origins;
}
/** Rules violated in every assignment: direct ones, then transitive ones that no reported
 * direct violation on a connecting chain already explains. */
function conflicts(edges, n, lo, hi, budget) {
    const violated = (a, b) => Number.isFinite(lo[a]) && Number.isFinite(hi[b]) && lo[a] > hi[b];
    const direct = edges.filter(([a, b]) => violated(a, b)).map(([a, b]) => ({ a, b, transitive: false }));
    // Only MAX_REPORTED conflicts are shown; enough direct ones make the closure unnecessary.
    // The closure's cost is charged up front in bitset words, as before.
    const words = (n + 31) >>> 5;
    if (!budget.spend(edges.length) || direct.length >= MAX_REPORTED || !budget.spend(edges.length * words + n))
        return direct;
    const reach = reachability(n, edges), has = reach.reaches, rank = reach.rank;
    const directKeys = new Set(edges.map(([a, b]) => a * n + b));
    const found = [];
    for (let a = 0; a < n; a++) {
        if (!Number.isFinite(lo[a]))
            continue;
        if (!budget.spend(words))
            return direct;
        for (const b of reach.descendants(a))
            if (!directKeys.has(a * n + b) && violated(a, b))
                found.push({ a, b, transitive: true });
    }
    if (!budget.spend(found.length))
        return direct;
    found.sort((x, y) => (rank[x.b] - rank[x.a]) - (rank[y.b] - rank[y.a]));
    const covering = [...direct], reported = [];
    for (const v of found) {
        if (reported.length + direct.length >= MAX_REPORTED || !budget.spend(covering.length))
            break;
        if (covering.some(d => (d.a === v.a || has(v.a, d.a)) && (d.b === v.b || has(d.b, v.b))))
            continue;
        covering.push(v);
        reported.push(v);
    }
    return [...direct, ...reported];
}
function path(edges, from, to) {
    const succ = new Map();
    for (const [a, b] of edges) {
        const list = succ.get(a) ?? [];
        list.push(b);
        succ.set(a, list);
    }
    const previous = new Map([[from, from]]), queue = [from];
    for (let head = 0; head < queue.length && !previous.has(to); head++)
        for (const next of succ.get(queue[head]) ?? [])
            if (!previous.has(next)) {
                previous.set(next, queue[head]);
                queue.push(next);
            }
    const chain = [to];
    while (chain[0] !== from && previous.has(chain[0]))
        chain.unshift(previous.get(chain[0]));
    return chain;
}
function ruleDiagnostic(v, compiled, lines, candidates, lo, hi, origins, options, edges) {
    const tokens = compiled.definition.tokens, a = tokens[v.a], b = tokens[v.b];
    const categories = [...(options.reasons?.get(ruleKey(a.id, b.id)) ?? [])];
    const at = (t) => candidates.flatMap((items, position) => items.includes(t) ? [position] : []);
    const posA = at(v.a), posB = at(v.b), exact = posA.length === 1 && posB.length === 1;
    const code = v.profile ? 'profile-conflict' : v.transitive ? 'order-transitive' : origins.includes('block') ? 'scope-boundary' : origins.length && origins.every(o => o === 'unit') ? 'unit-split' : categories.includes('structure') ? 'structural-placement' : categories.length && categories.every(c => c === 'author') ? 'pedagogical-rule' : 'order-direct';
    const chain = v.transitive ? path(edges, v.a, v.b).map(t => tokens[t].id) : undefined;
    const reason = categories.map(c => reasonText[c]).filter(Boolean);
    const name = (t, positions) => positions.length === 1 ? row(positions[0]) : quote(tokens[t].code) + ' sor';
    const where = exact
        ? `A(z) ${row(posA[0])} (${quote(lines[posA[0]])}) a(z) ${row(posB[0])} (${quote(lines[posB[0]])}) előtt kell állnia, de most utána áll.`
        : `A(z) ${quote(a.code)} sornak a(z) ${quote(b.code)} sor előtt kell állnia, de az ilyen tartalmú sorok mindegyike most a másik után áll (${rows([...posA, ...posB].sort((x, y) => x - y))}).`;
    // A block rule binds a member between its block's open and close lines; name the member and the block.
    const block = compiled.definition.blocks.find(k => k.open === a.id && k.close !== b.id || k.close === b.id && k.open !== a.id);
    const member = block ? (block.open === a.id ? v.b : v.a) : -1, opener = block ? tokens.find(t => t.id === block.open).code : '';
    const summary = code === 'scope-boundary'
        ? (member < 0 ? 'Egy blokk záró sora a nyitó sora előtt áll.' : `A(z) ${name(member, member === v.a ? posA : posB)} a(z) ${quote(opener)} blokkhoz tartozik, de kívül áll rajta.`)
        : code === 'profile-conflict' ? `A(z) „${v.profile}” alternatív sorrend sem teljesül.`
            : exact ? `A(z) ${row(posA[0])} a(z) ${row(posB[0])} előtt kell állnia.` : `A(z) ${quote(a.code)} sor a(z) ${quote(b.code)} sor előtt kell állnia.`;
    const rule = code === 'profile-conflict' ? 'A feladat több alternatív sorrendet enged meg, de mindegyikben van megsértett szabály; ez ennek az alternatívának a szabálya.'
        : v.transitive ? `A szabály közvetett: ${chain.length - 2} köztes soron keresztül következik a feladat közvetlen szabályaiból.`
            : code === 'scope-boundary' ? 'Egy blokk sorainak a nyitó és a záró sora között kell állniuk.'
                : code === 'unit-split' ? 'A két sor egy többsoros egység része.'
                    : 'Ezt a feladat egyik sorrendi szabálya köti.';
    const detail = [where, rule].filter(Boolean).join(' ');
    return {
        ...base(code, 'error', 'proven', 'rules'),
        ...(reason.length ? { reasons: reason } : {}),
        positions: [...new Set([...posA, ...posB])].sort((x, y) => x - y), positionScope: exact ? 'all' : 'some', references: [...(posA.length === 1 ? [a.id] : []), ...(posB.length === 1 ? [b.id] : [])],
        rule: { before: a.id, after: b.id, origins: v.transitive ? [] : origins, categories, ...(v.profile ? { profile: v.profile } : {}), ...(chain ? { path: chain } : {}) },
        summary, detail,
        evidence: exact ? 'Mindkét sor tartalma egyértelmű, így a helyük minden lehetséges hozzárendelésben ez.' : `A(z) ${quote(a.code)} sor minden lehetséges helye (${lo[v.a] + 1}.–) a(z) ${quote(b.code)} sor minden lehetséges helye (–${hi[v.b] + 1}.) után van.`,
        ...(exact ? {} : { limits: 'Az azonos tartalmú sorok közül nem nevezhető meg, melyik a hibás.' }),
        fix: { level: 'guidance', text: `Helyezd a(z) ${quote(a.code)} sort a(z) ${quote(b.code)} sor elé.` }
    };
}
/** v3 multi-line units must stay contiguous and in order; proven when every member is forced. */
function unitDiagnostics(def, lines, byId, lo, forced, budget) {
    const out = [];
    for (const unit of def.structure?.units ?? []) {
        if (unit.tokenIds.length < 2 || !budget.spend(unit.tokenIds.length))
            continue;
        const members = unit.tokenIds.map(id => byId.get(id));
        if (!members.every(forced) || members.every((t, i) => !i || lo[t] === lo[members[i - 1]] + 1))
            continue;
        const positions = members.map(t => lo[t]);
        out.push({ ...base('unit-split', 'error', 'proven', 'rules'), positions: [...positions].sort((x, y) => x - y), positionScope: 'all', references: [...unit.tokenIds], summary: `A(z) ${rows([...positions].sort((x, y) => x - y))} egy többsoros egység, amelyet szétszakít az elrendezés.`, detail: `Ezeknek a soroknak (${quote(lines[positions[0]])} …) egymás után, ebben a sorrendben kell állniuk.`, evidence: 'Az egység minden sorának tartalma egyértelmű, és a helyük nem folytonos.', fix: { level: 'guidance', text: 'Helyezd az egység sorait közvetlenül egymás után.' } });
    }
    return out;
}
/** Block membership by the forced positions of the block's boundaries: a line inside a block it
 * does not belong to, or outside the block it belongs to. */
function scopeDiagnostics(def, lines, byId, candidates, lo, hi, forced, reported, budget) {
    const containers = [], parent = new Map();
    if (def.structure) {
        for (const c of def.structure.containers)
            parent.set(c.id, c.parentId);
        for (const c of def.structure.containers) {
            const open = def.structure.boundaries.find(b => b.containerId === c.id && b.action === 'open'), close = def.structure.boundaries.find(b => b.containerId === c.id && b.action === 'close');
            if (open && close)
                containers.push({ id: c.id, open: byId.get(open.tokenId), openPhase: open.phase, close: byId.get(close.tokenId), closePhase: close.phase });
        }
    }
    else
        for (const b of def.blocks) {
            parent.set(b.id, b.parent);
            containers.push({ id: b.id, open: byId.get(b.open), openPhase: 'after', close: byId.get(b.close), closePhase: 'before' });
        }
    const within = (scope, container) => { for (let s = scope; s !== null; s = parent.get(s) ?? null)
        if (s === container)
            return true; return false; };
    const out = [], seen = new Set(reported);
    for (const c of containers) {
        if (!Number.isFinite(lo[c.open]) || !Number.isFinite(lo[c.close]))
            continue;
        // ADR-030: a boundary with interchangeable content may stand at any of its candidate positions.
        // A line is inside in every assignment when it follows the latest possible opener and precedes
        // the earliest possible closer; outside when it precedes every opener or follows every closer.
        // A block closes after it opens; an assignment with reversed boundaries breaks that rule
        // instead. So a forced opener bounds its closer from below, a forced closer its opener from above.
        const places = (t) => candidates.flatMap((items, position) => items.includes(t) ? [position] : []);
        const closeLo = forced(c.open) ? places(c.close).find(p => p > lo[c.open]) ?? Infinity : lo[c.close];
        const openHi = forced(c.close) ? places(c.open).filter(p => p < lo[c.close]).at(-1) ?? -Infinity : hi[c.open];
        const shift = c.openPhase === 'after' ? 1 : 0, back = c.closePhase === 'before' ? 1 : 0;
        const surelyIn = [openHi + shift, closeLo - back], surelyOut = [lo[c.open] + shift, hi[c.close] - back];
        const exact = forced(c.open) && forced(c.close);
        // No well-formed reading (reversed boundaries): that is an ordering conflict, not a block claim.
        if (!Number.isFinite(closeLo) || !Number.isFinite(openHi) || exact && surelyIn[0] > surelyIn[1] + 1)
            continue;
        if (!budget.spend(def.tokens.length))
            break;
        def.tokens.forEach((token, t) => {
            if (!forced(t) || seen.has(t) || t === c.open || t === c.close)
                return;
            const p = lo[t], member = within(token.scope, c.id);
            const inside = p >= surelyIn[0] && p <= surelyIn[1], outside = p < surelyOut[0] || p > surelyOut[1];
            if (!(inside && !member || outside && member))
                return;
            const position = p, opener = lines[lo[c.open]];
            out.push({ ...base('scope-boundary', 'error', 'proven', 'rules'), positions: [position], positionScope: 'all', references: [token.id], summary: inside ? `A(z) ${row(position)} nem tartozhat ebbe a blokkba.` : `A(z) ${row(position)} a(z) ${quote(opener)} blokkhoz tartozik, de kívül áll rajta.`, detail: inside ? `A(z) ${row(position)} (${quote(lines[position])}) a(z) ${quote(opener)} kezdetű blokkon belül áll, pedig nem annak a része.` : `A(z) ${row(position)} (${quote(lines[position])}) helye a(z) ${quote(opener)} kezdetű blokkon belül van.`, evidence: exact ? 'A sor és a blokkhatárok tartalma egyértelmű, így a helyük minden lehetséges hozzárendelésben ez.' : 'A sor helye egyértelmű, és a blokk azonos tartalmú határsorainak minden olyan lehetséges helye mellett, ahol a blokk a nyitó sora után zárul, ugyanígy áll a blokkhoz képest.', fix: { level: 'guidance', text: inside ? 'Vidd ki a sort ebből a blokkból.' : 'Vidd be a sort a blokkba.' } });
            seen.add(t);
        });
    }
    return out;
}
/** Fixed slots stay; the moved line takes `to`, movable neighbours shift (insert, never swap). */
export function moveLine(lines, fixedSlots, from, to) {
    if (fixedSlots.has(from) || fixedSlots.has(to) || from === to || from < 0 || to < 0 || from >= lines.length || to >= lines.length)
        return null;
    const slots = lines.map((_, i) => i).filter(i => !fixedSlots.has(i)), values = slots.map(i => lines[i]);
    const [moved] = values.splice(slots.indexOf(from), 1);
    values.splice(slots.indexOf(to), 0, moved);
    const out = [...lines];
    slots.forEach((slot, i) => { out[slot] = values[i]; });
    return out;
}
/** ADR-030/033: when no cause is proven, one or two line moves the validator accepts. It is a
 * verified way out, not a proven culprit: other moves may fix the arrangement as well.
 * Windows: the lines are aligned with the reference (equal content in order), the longest run in
 * reference order stays, and each line outside it is tried only between its nearest neighbours of
 * that run, by any line of its content. Order: single moves into windows; then two moves, the
 * first from the windows that leave the fewest rules broken in every assignment, the second from
 * the windows of its result; then any single move by increasing distance. One allowance bounds
 * all phases apart from the diagnostic budget; `null` when nothing is accepted within it. */
function moveRepair(compiled, lines, candidates, common, options) {
    const def = compiled.definition, n = lines.length;
    const fixedSlots = new Set(def.tokens.flatMap(t => t.fixedPosition === undefined ? [] : [t.fixedPosition]));
    const states = clampInt(options.repairStates, 5_000, 200_000);
    let allowance = clampInt(options.moveSearchStates, 400_000, 50_000_000);
    /** Rules broken in every assignment. The lines' candidate rows move with them; a fixed row's
     * candidate kept at another position only widens the bounds, so nothing acceptable is skipped. */
    const broken = (rows) => {
        allowance -= n + common.length;
        const lo = new Array(def.tokens.length).fill(Infinity), hi = new Array(def.tokens.length).fill(-Infinity);
        rows.forEach((items, position) => { for (const t of items) {
            if (position < lo[t])
                lo[t] = position;
            if (position > hi[t])
                hi[t] = position;
        } });
        return common.filter(([a, b]) => lo[a] > hi[b]).length;
    };
    /** A validation re-matches every line: its cost grows with the rows, not only the states. */
    const accepted = (moved) => {
        if (allowance <= 0)
            return null;
        allowance -= 4 * n;
        const check = validateSubmission(compiled, { exerciseId: def.id, revision: def.revision, lines: moved }, { maxStates: Math.min(states, Math.max(1, allowance)) });
        allowance -= check.exploredStates + n;
        return check.accepted;
    };
    const windows = (rows) => {
        // Alignment: every line takes the first unused reference row of its content, in order.
        const used = new Set(), seq = rows.map(items => { const t = items.find(i => !used.has(i)) ?? -1; used.add(t); return t; });
        // Longest strictly increasing run of reference rows (patience sorting), as positions.
        const tails = [], back = new Array(n).fill(-1);
        seq.forEach((t, p) => {
            if (t < 0)
                return;
            let lo = 0, hi = tails.length;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (seq[tails[mid]] < t)
                    lo = mid + 1;
                else
                    hi = mid;
            }
            back[p] = lo ? tails[lo - 1] : -1;
            tails[lo] = p;
        });
        const kept = [];
        for (let p = tails.at(-1) ?? -1; p >= 0; p = back[p])
            kept.unshift(p);
        const inRun = new Set(kept), content = rows.map(items => items.join(',')), out = [], seen = new Set();
        // Lines of equal content are interchangeable: the window an out-of-run line belongs to may be
        // filled by any line of its content (a misplaced `}` shifts the alignment of all later ones).
        for (let displaced = 0; displaced < n; displaced++) {
            if (inRun.has(displaced) || seq[displaced] < 0)
                continue;
            const t = seq[displaced], below = kept.filter(p => seq[p] < t).at(-1), above = kept.find(p => seq[p] > t);
            const sources = content.flatMap((key, p) => key === content[displaced] ? [p] : []).sort((x, y) => Math.abs(x - displaced) - Math.abs(y - displaced));
            for (const from of sources) {
                const shift = (p) => p > from ? p - 1 : p;
                const first = below === undefined ? 0 : shift(below) + 1, last = above === undefined ? n - 1 : shift(above);
                for (let to = first; to <= last; to++)
                    if (to !== from && !seen.has(from * n + to)) {
                        seen.add(from * n + to);
                        out.push({ from, to });
                    }
            }
        }
        return out;
    };
    const single = (moves) => {
        const [{ from, to }] = moves;
        return { ...base('single-move-repair', 'notice', 'general', 'positions'), positions: [from], positionScope: 'some', summary: `Egyetlen sor áthelyezése elég: a(z) ${row(from)} (${quote(lines[from])}) máshová kerülve elfogadható megoldást ad.`, detail: 'Ez nem bizonyítja, hogy éppen ez a sor a hibás: más áthelyezés is javíthatja az elrendezést.', evidence: 'A validátor az áthelyezett elrendezést elfogadta.', limits: 'Ellenőrzött kiút, nem bizonyított ok.', fix: { level: 'verified', move: { from, to }, moves: [{ from, to }], text: `Ha a(z) ${row(from)}t a(z) ${row(to)} helyére teszed, a megoldás elfogadott.` } };
    };
    const double = (first, second) => {
        // The second move counts positions after the first; name its line by its original position.
        const original = moveLine(lines.map((_, i) => i), fixedSlots, first.from, first.to)[second.from];
        const positions = [...new Set([first.from, original])].sort((x, y) => x - y);
        return { ...base('two-move-repair', 'notice', 'general', 'positions'), positions, positionScope: 'some', summary: `Két sor áthelyezése elég: a(z) ${rows(positions)} máshová kerülve elfogadható megoldást ad.`, detail: 'Egyetlen áthelyezés nem javítja az elrendezést, kettő igen. Ez nem bizonyítja, hogy éppen ezek a sorok a hibásak.', evidence: 'A validátor a kétszer áthelyezett elrendezést elfogadta.', limits: 'Ellenőrzött kiút, nem bizonyított ok.', fix: { level: 'verified', move: first, moves: [first, second], text: `Ha a(z) ${row(first.from)}t a(z) ${row(first.to)} helyére teszed, majd az így kapott elrendezés ${row(second.from)}át a(z) ${row(second.to)} helyére, a megoldás elfogadott.` } };
    };
    const tried = new Set();
    const one = (move) => {
        if (tried.has(move.from * n + move.to))
            return undefined;
        tried.add(move.from * n + move.to);
        const moved = moveLine(lines, fixedSlots, move.from, move.to);
        if (!moved)
            return undefined;
        if (allowance <= 0)
            return null;
        if (broken(moveLine(candidates, fixedSlots, move.from, move.to)))
            return undefined;
        const ok = accepted(moved);
        return ok === null ? null : ok ? single([move]) : undefined;
    };
    const near = windows(candidates);
    for (const move of near) {
        const found = one(move);
        if (found !== undefined)
            return found;
    }
    // ADR-033: two moves, the most promising first moves only.
    const firsts = near.slice(0, 200).flatMap(move => {
        const rows2 = moveLine(candidates, fixedSlots, move.from, move.to);
        return rows2 && allowance > 0 ? [{ move, rows: rows2, broken: broken(rows2) }] : [];
    }).sort((x, y) => x.broken - y.broken).slice(0, 16);
    for (const first of firsts) {
        const after = moveLine(lines, fixedSlots, first.move.from, first.move.to);
        for (const second of windows(first.rows)) {
            if (allowance <= 0)
                return null;
            const rows2 = moveLine(first.rows, fixedSlots, second.from, second.to);
            if (!rows2 || broken(rows2))
                continue;
            const ok = accepted(moveLine(after, fixedSlots, second.from, second.to));
            if (ok === null)
                return null;
            if (ok)
                return double(first.move, second);
        }
    }
    for (let distance = 1; distance < n; distance++)
        for (let from = 0; from < n; from++) {
            for (const to of [from - distance, from + distance]) {
                const found = one({ from, to });
                if (found !== undefined)
                    return found;
            }
        }
    return null;
}
/** Move one of the two forced lines next to the other; verified only if the validator accepts. */
function repair(compiled, lines, candidates, diagnostic, options, budget) {
    const def = compiled.definition, ids = new Map(def.tokens.map((t, i) => [t.id, i]));
    const a = ids.get(diagnostic.rule.before), b = ids.get(diagnostic.rule.after);
    const pa = candidates.findIndex(items => items.includes(a)), pb = candidates.findIndex(items => items.includes(b));
    if (pa < 0 || pb < 0)
        return null;
    const fixedSlots = new Set(def.tokens.flatMap(t => t.fixedPosition === undefined ? [] : [t.fixedPosition]));
    const states = clampInt(options.repairStates, 5_000, 200_000);
    let partial = null;
    for (const [from, to, text] of [[pa, pb, `a(z) ${row(pb)} elé`], [pb, pa, `a(z) ${row(pa)} után`]]) {
        const moved = moveLine(lines, fixedSlots, from, to);
        if (!moved || budget.used > budget.limit)
            continue;
        const check = validateSubmission(compiled, { exerciseId: def.id, revision: def.revision, lines: moved }, { maxStates: states });
        budget.spend(check.exploredStates + moved.length);
        if (check.accepted)
            return { level: 'verified', move: { from, to }, text: `Ha a(z) ${row(from)}t ${text} helyezed, a megoldás elfogadott.` };
        const after = matchContent(def.tokens, moved).candidates;
        const first = (t) => after.findIndex(items => items.includes(t)), last = (t) => after.length - 1 - [...after].reverse().findIndex(items => items.includes(t));
        if (!partial && first(a) < last(b))
            partial = { level: 'partial', move: { from, to }, text: `Ha a(z) ${row(from)}t ${text} helyezed, ez az ütközés megszűnik, de más hiba még maradhat.` };
    }
    return partial;
}
//# sourceMappingURL=diagnostics.js.map