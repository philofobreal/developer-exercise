/** Typed author rule edits on an admitted CodeLine v2 model (ADR-018).
 *
 * The author changes rules only through these edits, never by mutating the model in
 * a view. A batch is atomic: every edit is checked against the model as the previous
 * edits left it, the result must be admitted and must accept its own reference order,
 * and on any failure the caller's model is untouched (it is never mutated).
 *
 * Safety by editability (ADR-014): a hard (structural) constraint cannot be removed;
 * a conservative one only with an explicit `unproven-relaxation` acknowledgement, a
 * proven or unexplained one only with `policy-override`. Such removals are recorded
 * in `authoring.relaxations`, so the model states that it left the ordering policy.
 * Author rules are mandatory `edges` with `author` provenance; they survive a
 * dependency refresh (see `mergeAuthorRules`). OR alternatives use profiles.
 *
 * The effect report never overstates: `no` is proven by constraint inclusion, `yes`
 * by a witness order that the real validator accepts under one model and rejects
 * under the other, `maybe` when neither was established.
 */
import { validateSubmission } from './validator.js';
import { compileCodeLineExercise } from './code-line.js';
import { editabilityOrder, explainConstraints } from './constraint-explanation.js';
import { evidenceStatus } from './evidence.js';
const AUTHOR_RULE = 'author-rule';
const fail = (error, message, index) => ({ ok: false, error, message, index });
const isId = (value) => Number.isSafeInteger(value) && value > 0;
const pairOf = (entry, before, after) => entry.before === before && entry.after === after;
class EditFailure extends Error {
    error;
    constructor(error, message) {
        super(message);
        this.error = error;
    }
}
/** Applies a batch atomically and reports its effect; the input model is never mutated. */
export function applyRuleEdits(model, edits) {
    const initial = explainConstraints(model);
    if ('status' in initial)
        return fail('invalid-model', initial.message, null);
    if (!Array.isArray(edits) || !edits.length || edits.length > 100)
        return fail('invalid-edit', 'Legalább 1, legfeljebb 100 szabályművelet adható meg egyszerre.', null);
    const draft = structuredClone(model);
    let explanation = initial;
    for (let index = 0; index < edits.length; index++) {
        try {
            apply(draft, explanation, edits[index]);
        }
        catch (error) {
            if (error instanceof EditFailure)
                return fail(error.error, error.message, index);
            throw error;
        }
        const next = explainConstraints(draft);
        if ('status' in next)
            return fail('admission', next.message, index);
        explanation = next;
    }
    draft.revision = model.revision + 1;
    const compiled = compileCodeLineExercise(draft);
    if ('status' in compiled)
        return fail('admission', compiled.message, null);
    const self = validateSubmission(compiled.compiled, { exerciseId: draft.id, revision: draft.revision, lines: draft.lines.map(line => line.code) }, { maxStates: 200_000 });
    if (!self.accepted)
        return fail('against-reference', 'A módosított szabályok a referencia sorrendjét sem fogadnák el: ' + self.message, null);
    return { ok: true, model: draft, effect: assessEffect(model, draft) };
}
function apply(draft, explanation, edit) {
    if (!edit || typeof edit !== 'object')
        throw new EditFailure('invalid-edit', 'Ismeretlen szabályművelet.');
    const position = new Map(draft.lines.map((line, index) => [line.id, index]));
    const line = (id) => {
        if (!isId(id))
            throw new EditFailure('invalid-edit', 'A sorazonosító pozitív egész szám.');
        if (!position.has(id))
            throw new EditFailure('unknown-line', `A(z) ${id}. azonosítójú sor nem létezik.`);
        return id;
    };
    const pair = (before, after) => {
        const pair = [line(before), line(after)];
        if (pair[0] === pair[1])
            throw new EditFailure('invalid-edit', 'Egy sor nem előzheti meg önmagát.');
        return pair;
    };
    const explained = (id) => explanation.lines.find(item => item.id === id);
    const direct = (before, after) => explained(after).predecessors.find(constraint => constraint.before === before);
    const authoring = draft.authoring ??= {};
    const noteText = (note) => {
        if (typeof note !== 'string' || note.trim().length > 500)
            throw new EditFailure('invalid-edit', 'A megjegyzés legfeljebb 500 karakteres szöveg.');
        return note.trim();
    };
    const setNote = (before, after, note) => {
        const notes = (authoring.ruleNotes ?? []).filter(entry => !pairOf(entry, before, after));
        if (note)
            notes.push({ before, after, note });
        if (notes.length)
            authoring.ruleNotes = notes;
        else
            delete authoring.ruleNotes;
    };
    const dropPair = (before, after) => {
        const target = draft.lines[position.get(after)];
        target.dependencies = target.dependencies.filter(id => id !== before);
        draft.edges = (draft.edges ?? []).filter(edge => !pairOf(edge, before, after));
        authoring.provenance = (authoring.provenance ?? []).filter(entry => !pairOf(entry, before, after));
        setNote(before, after, '');
    };
    const profile = (id) => {
        const found = typeof id === 'string' ? draft.profiles?.find(item => item.id === id) : undefined;
        if (!found)
            throw new EditFailure('unknown-profile', 'Ismeretlen profil.');
        return found;
    };
    switch (edit.kind) {
        case 'add-rule': {
            const [before, after] = pair(edit.before, edit.after);
            const note = edit.note === undefined ? '' : noteText(edit.note);
            if (explained(before).ancestors.includes(after))
                throw new EditFailure('cycle', `A(z) ${after}. sornak már meg kell előznie a(z) ${before}. sort; a szabály kört okozna.`);
            if (position.get(before) > position.get(after))
                throw new EditFailure('against-reference', 'Kötelező szabály csak a referencia sorrendjével összhangban adható hozzá; eltérő sorrendhez használj profilt.');
            if (!(draft.edges ?? []).some(edge => pairOf(edge, before, after)))
                (draft.edges ??= []).push({ before, after });
            const provenance = authoring.provenance ??= [];
            if (!provenance.some(entry => pairOf(entry, before, after) && entry.category === 'author'))
                provenance.push({ before, after, category: 'author', code: AUTHOR_RULE });
            if (note)
                setNote(before, after, note);
            return;
        }
        case 'remove-rule': {
            const [before, after] = pair(edit.before, edit.after);
            const note = edit.note === undefined ? '' : noteText(edit.note);
            const constraint = direct(before, after);
            if (!constraint) {
                if (explained(after).ancestors.includes(before))
                    throw new EditFailure('transitive-only', `A(z) ${before} → ${after} sorrend csak tranzitív következmény; a köztes közvetlen szabályok egyikét kell módosítani.`);
                throw new EditFailure('not-a-constraint', `A(z) ${before} → ${after} között nincs szabály.`);
            }
            const generated = constraint.reasons.filter(reason => reason.category !== 'author');
            // An author rule is peeled off first; a generated constraint on the same pair stays.
            if (generated.length < constraint.reasons.length) {
                authoring.provenance = (authoring.provenance ?? []).filter(entry => !(pairOf(entry, before, after) && entry.category === 'author'));
                if (!generated.length)
                    dropPair(before, after);
                return;
            }
            if (constraint.editability === 'hard')
                throw new EditFailure('hard-constraint', `A(z) ${before} → ${after} szerkezeti szabály (${constraint.reasons.map(reason => reason.code).join(', ')}); nem távolítható el.`);
            const target = draft.lines[position.get(after)];
            const rest = { ...draft, lines: draft.lines.map(item => item === target ? { ...item, dependencies: item.dependencies.filter(id => id !== before) } : item), edges: (draft.edges ?? []).filter(edge => !pairOf(edge, before, after)) };
            const redundant = reaches(rest, before, after);
            if (!redundant) {
                const editability = constraint.editability;
                if (editability === 'conservative' ? !edit.acknowledge : edit.acknowledge !== 'policy-override')
                    throw new EditFailure('needs-acknowledgement', editability === 'conservative'
                        ? 'Konzervatív szabály: a lazítás helyessége nem bizonyított; csak kifejezett szerzői megerősítéssel (unproven-relaxation) távolítható el.'
                        : `${editability === 'proven' ? 'Bizonyított' : 'Ismeretlen eredetű'} szabály: eltávolítása eltér a sorrendpolitikától, csak kifejezett policy-felülírással (policy-override) lehetséges.`);
                authoring.relaxations = [...(authoring.relaxations ?? []).filter(entry => !pairOf(entry, before, after)), { before, after, editability, ...(note ? { note } : {}) }];
            }
            dropPair(before, after);
            return;
        }
        case 'set-note': {
            const [before, after] = pair(edit.before, edit.after);
            if (!direct(before, after))
                throw new EditFailure('not-a-constraint', `A(z) ${before} → ${after} nem közvetlen szabály; megjegyzés csak ahhoz fűzhető.`);
            setNote(before, after, noteText(edit.note));
            return;
        }
        case 'set-fixed': {
            const id = line(edit.line);
            if (typeof edit.fixed !== 'boolean')
                throw new EditFailure('invalid-edit', 'A fixed értéke logikai.');
            draft.lines[position.get(id)].fixed = edit.fixed;
            return;
        }
        case 'add-profile': {
            if (typeof edit.id !== 'string' || !edit.id || edit.id.length > 200)
                throw new EditFailure('invalid-edit', 'A profilazonosító 1–200 karakteres szöveg.');
            if (draft.profiles?.some(item => item.id === edit.id))
                throw new EditFailure('duplicate-profile', 'Már van ilyen azonosítójú profil.');
            if ((draft.profiles?.length ?? 0) >= 32)
                throw new EditFailure('invalid-edit', 'Legfeljebb 32 profil adható meg.');
            (draft.profiles ??= []).push({ id: edit.id, edges: [] });
            return;
        }
        case 'remove-profile': {
            const found = profile(edit.id);
            draft.profiles = draft.profiles.filter(item => item !== found);
            return;
        }
        case 'add-profile-rule': {
            const found = profile(edit.profile), [before, after] = pair(edit.before, edit.after);
            if (explained(before).ancestors.includes(after))
                throw new EditFailure('cycle', `A(z) ${after}. sornak már meg kell előznie a(z) ${before}. sort; a profilszabály kört okozna.`);
            if (!found.edges.some(edge => pairOf(edge, before, after)))
                found.edges.push({ before, after });
            return;
        }
        case 'remove-profile-rule': {
            const found = profile(edit.profile), [before, after] = pair(edit.before, edit.after);
            if (!found.edges.some(edge => pairOf(edge, before, after)))
                throw new EditFailure('not-a-constraint', 'A profilban nincs ilyen szabály.');
            found.edges = found.edges.filter(edge => !pairOf(edge, before, after));
            return;
        }
        default: throw new EditFailure('invalid-edit', 'Ismeretlen szabályművelet.');
    }
}
/** Every direct constraint of one alternative: dependencies, edges, block membership, profile edges. */
function predecessors(model, extra = []) {
    const result = new Map(model.lines.map(line => [line.id, [...line.dependencies]]));
    const add = (before, after) => { result.get(after).push(before); };
    for (const edge of [...model.edges ?? [], ...extra])
        add(edge.before, edge.after);
    const blocks = new Map(model.blocks.map(block => [block.id, block]));
    for (const line of model.lines) {
        const block = line.scopeId === null ? undefined : blocks.get(line.scopeId);
        if (block) {
            add(block.openLineId, line.id);
            add(line.id, block.closeLineId);
        }
    }
    for (const block of model.blocks)
        add(block.openLineId, block.closeLineId);
    return result;
}
/** Ancestor sets of an acyclic constraint graph. */
function ancestorSets(model, extra = []) {
    const direct = predecessors(model, extra), memo = new Map();
    const visit = (id) => {
        const known = memo.get(id);
        if (known)
            return known;
        const all = new Set();
        memo.set(id, all);
        for (const before of direct.get(id)) {
            all.add(before);
            for (const ancestor of visit(before))
                all.add(ancestor);
        }
        return all;
    };
    model.lines.forEach(line => visit(line.id));
    return memo;
}
const reaches = (model, before, after) => ancestorSets(model).get(after).has(before);
const alternatives = (model) => (model.profiles?.length ? model.profiles : [{ id: 'base', edges: [] }]).map(profile => ({ edges: profile.edges, ancestors: ancestorSets(model, profile.edges) }));
const includes = (outer, inner) => [...inner.ancestors].every(([id, set]) => [...set].every(before => outer.ancestors.get(id).has(before)));
const fixedSet = (model) => new Set(model.lines.filter(line => line.fixed).map(line => line.id));
/** `to` accepts nothing `from` rejects: every alternative of `to` contains the constraints of
 * some alternative of `from`, and `to` fixes every line `from` fixes. Lines and blocks are equal. */
function noLooser(from, to, fromAlternatives, toAlternatives) {
    const toFixed = fixedSet(to);
    return [...fixedSet(from)].every(id => toFixed.has(id)) && toAlternatives.every(target => fromAlternatives.some(source => includes(target, source)));
}
/** A scope-respecting order satisfying one alternative; lines ranked lower are placed first. */
function extension(model, extra, rank) {
    const direct = predecessors(model, extra), placed = new Set(), order = [];
    const opens = new Map(model.blocks.map(block => [block.openLineId, block])), closes = new Map(model.blocks.map(block => [block.closeLineId, block]));
    const fixedAt = new Map(model.lines.flatMap((line, index) => line.fixed ? [[index, line.id]] : []));
    const stack = [null];
    for (let slot = 0; slot < model.lines.length; slot++) {
        const top = stack.at(-1);
        const ready = model.lines.filter(line => !placed.has(line.id) && direct.get(line.id).every(id => placed.has(id)) && (closes.get(line.id)?.id ?? line.scopeId) === top && (fixedAt.get(slot) ?? line.id) === line.id && !(line.fixed && fixedAt.get(slot) !== line.id));
        if (!ready.length)
            return null;
        const next = ready.reduce((best, line) => rank(line.id) < rank(best.id) ? line : best);
        placed.add(next.id);
        order.push(next.id);
        if (closes.has(next.id))
            stack.pop();
        const opened = opens.get(next.id);
        if (opened)
            stack.push(opened.id);
    }
    return order;
}
/** Inclusion proves `no`; otherwise targeted scope-respecting orders are graded by the real validator. */
function assessEffect(before, after) {
    const old = alternatives(before), next = alternatives(after);
    const looserPossible = !noLooser(before, after, old, next), stricterPossible = !noLooser(after, before, next, old);
    const effect = { stricter: stricterPossible ? 'maybe' : 'no', looser: looserPossible ? 'maybe' : 'no' };
    const compile = (model) => { const result = compileCodeLineExercise(model); if ('status' in result)
        throw Error(result.message); return result.compiled; };
    const verdict = (model, compiled, order) => {
        const code = new Map(model.lines.map(line => [line.id, line.code]));
        return validateSubmission(compiled, { exerciseId: model.id, revision: model.revision, lines: order.map(id => code.get(id)) }, { maxStates: 20_000 }).status;
    };
    /** An order accepted under `source` and rejected under `target`, aimed at constraints only `target` has. */
    const witness = (source, sourceAlternatives, target, targetAlternatives) => {
        const sourceCompiled = compile(source), targetCompiled = compile(target), sourceFixed = fixedSet(source), position = new Map(source.lines.map((line, index) => [line.id, index]));
        const aims = [];
        for (const alternative of sourceAlternatives) {
            for (const goal of targetAlternatives)
                for (const [id, set] of goal.ancestors)
                    for (const ancestor of set) {
                        if (aims.length >= 12 || alternative.ancestors.get(id).has(ancestor))
                            continue;
                        // Aim for `id` before `ancestor`: lift id and what it needs, sink ancestor and what needs it.
                        const lift = alternative.ancestors.get(id);
                        aims.push(line => line === id || lift.has(line) ? 0 : line === ancestor || alternative.ancestors.get(line).has(ancestor) ? 2 : 1);
                    }
            for (const line of target.lines)
                if (line.fixed && !sourceFixed.has(line.id) && aims.length < 16)
                    aims.push(id => id === line.id ? -1 : 0, id => id === line.id ? 1 : 0);
            aims.push(id => -position.get(id));
            for (const rank of aims.splice(0)) {
                const order = extension(source, alternative.edges, id => rank(id) * 1_000_000 + position.get(id));
                if (order && verdict(source, sourceCompiled, order) === 'accepted' && verdict(target, targetCompiled, order) === 'rejected')
                    return order;
            }
        }
        return undefined;
    };
    if (stricterPossible) {
        const order = witness(before, old, after, next);
        if (order) {
            effect.stricter = 'yes';
            effect.stricterWitness = order;
        }
    }
    if (looserPossible) {
        const order = witness(after, next, before, old);
        if (order) {
            effect.looser = 'yes';
            effect.looserWitness = order;
        }
    }
    return effect;
}
/** Re-applies the author's rules to a regenerated model of the same lines and blocks
 * (ADR-018). `regenerated` carries only regenerated dependencies, edges and provenance;
 * `original` is the model before the refresh. Nothing is dropped silently: the report
 * names every rule that could not be carried over. The original's provenance tells author
 * rules from generated edges only while it is bound to its lines (ADR-015); otherwise every
 * original edge is kept as legacy. Throws if the merge is inadmissible. */
export function mergeAuthorRules(original, regenerated) {
    const model = structuredClone(regenerated), authoring = model.authoring ??= {};
    const report = { authorRules: 0, legacyEdges: 0, supersededEdges: 0, relaxations: [], droppedNotes: 0 };
    const provenance = evidenceStatus(original) === 'current' ? original.authoring?.provenance : undefined, reasons = (before, after) => (provenance ?? []).filter(entry => pairOf(entry, before, after));
    const edges = model.edges ??= [], explained = authoring.provenance ??= [];
    const keep = (before, after, author) => {
        if (!edges.some(edge => pairOf(edge, before, after)))
            edges.push({ before, after });
        if (author && !explained.some(entry => pairOf(entry, before, after) && entry.category === 'author'))
            explained.push({ before, after, category: 'author', code: AUTHOR_RULE });
    };
    for (const edge of original.edges ?? []) {
        const own = reasons(edge.before, edge.after);
        if (own.some(entry => entry.category === 'author')) {
            keep(edge.before, edge.after, true);
            report.authorRules++;
        }
        else if (!own.length) {
            keep(edge.before, edge.after, false);
            report.legacyEdges++;
        }
        else
            report.supersededEdges++;
    }
    // A hand-written dependency (author provenance) stays as a mandatory edge.
    for (const line of original.lines)
        for (const before of line.dependencies)
            if (reasons(before, line.id).some(entry => entry.category === 'author') && !(original.edges ?? []).some(edge => pairOf(edge, before, line.id))) {
                keep(before, line.id, true);
                report.authorRules++;
            }
    const admitted = () => { const result = explainConstraints(model); if ('status' in result)
        throw Error(result.message); return result; };
    let explanation = admitted();
    const relaxations = [];
    for (const relaxation of original.authoring?.relaxations ?? []) {
        const { before, after } = relaxation, line = explanation.lines.find(item => item.id === after);
        const constraint = line.predecessors.find(item => item.before === before);
        if (!constraint) {
            report.relaxations.push({ before, after, outcome: line.ancestors.includes(before) ? 'implied' : 'obsolete' });
            continue;
        }
        const current = constraint.editability;
        if (current === 'hard' || current === 'pedagogical' || editabilityOrder.indexOf(current) > editabilityOrder.indexOf(relaxation.editability)) {
            report.relaxations.push({ before, after, outcome: 'revoked' });
            continue;
        }
        const target = model.lines.find(item => item.id === after);
        target.dependencies = target.dependencies.filter(id => id !== before);
        model.edges = model.edges.filter(edge => !pairOf(edge, before, after));
        authoring.provenance = authoring.provenance.filter(entry => !pairOf(entry, before, after));
        relaxations.push({ ...relaxation, editability: current });
        report.relaxations.push({ before, after, outcome: 'reapplied' });
        explanation = admitted();
    }
    if (relaxations.length)
        authoring.relaxations = relaxations;
    else
        delete authoring.relaxations;
    const notes = (original.authoring?.ruleNotes ?? []).filter(({ before, after }) => explanation.lines.find(item => item.id === after).predecessors.some(item => item.before === before));
    report.droppedNotes = (original.authoring?.ruleNotes?.length ?? 0) - notes.length;
    if (notes.length)
        authoring.ruleNotes = notes;
    else
        delete authoring.ruleNotes;
    if (!model.edges.length && !original.edges)
        delete model.edges;
    return { model, report };
}
//# sourceMappingURL=rule-editing.js.map