import { authorDraftPending, evidenceStale } from './author-workspace.js';
import { activateView } from './interactions.js';
export const stepOf = (view) => view === 'author' ? 'source' : view === 'model' ? 'rules' : 'try';
const NEEDS_MODEL = 'Előbb készíts modellt a Forrás lépésben.';
/** The applied author model's preview exercise id; there is at most one. */
export const authorPreviewId = (state) => state.previews.keys().next().value ?? null;
/** Whose scroll, focus and open details a render restores. Every admission (a rule edit, a refresh,
 * a rebuild) yields a new preview id, but it is still the one author project; a practice exercise
 * is its own identity. */
export const continuityKey = (state) => (state.mode === 'author' ? 'author-project' : state.active ?? 'none') + ':' + state.mode;
export function jsonPending(state) {
    const model = authorPreviewId(state) ? state.authorModel : undefined;
    return !!state.modelDraft && (!model || state.modelDraft !== JSON.stringify(model, null, 2));
}
/** Why the steps after the source no longer show the latest author intent, or ''. */
export function staleReason(state) {
    if (!authorPreviewId(state))
        return '';
    if (authorDraftPending(state))
        return 'A referenciaforrás az utolsó modellkészítés óta módosult; a szabályok és a próba még a korábbi modellt mutatják.';
    return jsonPending(state) ? 'A Szabályok lépés JSON-jában nem alkalmazott módosítás van; a próba még az aktív modellt használja.' : '';
}
/** The first gate's word on the source: refused, or admitted with an undecided finding; only for the text it checked. */
function sourceStatus(state) {
    const record = state.sourceGate;
    if (!record || record.source !== state.author.source)
        return { status: '', tone: '' };
    return record.gate.verdict === 'blocked' ? { status: 'Hibás forrás', tone: 'blocked' } : record.gate.verdict === 'inconclusive' ? { status: 'Figyelmeztetés', tone: 'warning' } : { status: '', tone: '' };
}
/** The second gate's word on the applied draft: admitted with a warning (an unverified model, an undecided check). */
function tryStatus(state) {
    const gate = state.authorInsight?.tryGate;
    return gate?.verdict === 'inconclusive' && gate.admitted ? { status: 'Figyelmeztetéssel', tone: 'warning' } : gate && !gate.admitted ? { status: 'Zárva', tone: 'blocked' } : { status: '', tone: '' };
}
const STALE_EVIDENCE = 'A Próba lépés nem nyitható meg: a forrás vagy az elemzési beállítások a modell készítése óta változott; készítsd újra a modellt, vagy vesd el a változtatást.';
/** ADR-108 (E6): whether the author's Try step opens now. The draft brings the second gate's decision for the
 * source and policy it was made from; a source or setting changed since makes that decision stale. A draft
 * without one stays closed. Opening is navigation only: the server checks every preview again. */
export function tryAdmission(state) {
    if (!authorPreviewId(state))
        return { ok: false, message: NEEDS_MODEL };
    if (evidenceStale(state))
        return { ok: false, message: STALE_EVIDENCE };
    const gate = state.authorInsight?.tryGate;
    if (!gate)
        return { ok: false, message: 'A Próba lépés nem nyitható meg: ehhez a modellhez nincs második kapus döntés; készítsd újra a modellt.' };
    return { ok: gate.admitted, message: gate.message };
}
export function flowSteps(state) {
    const current = stepOf(state.view), locked = authorPreviewId(state) ? '' : NEEDS_MODEL, stale = !!staleReason(state);
    const later = (step) => locked ? { status: 'Zárolt', tone: 'locked' } : stale ? { status: 'Elavult', tone: 'stale' } : step === 'try' ? tryStatus(state) : { status: '', tone: '' };
    return [
        { step: 'source', view: 'author', number: 1, label: 'Forrás', hint: 'A helyes referenciakód', current: current === 'source', locked: '', stale: false, ...sourceStatus(state) },
        { step: 'rules', view: 'model', number: 2, label: 'Szabályok', hint: 'Függőségek és minősítés', current: current === 'rules', locked, stale, ...later('') },
        { step: 'try', view: 'sort', number: 3, label: 'Próba', hint: 'Rendezés és ellenőrzés', current: current === 'try', locked, stale, ...later('try') }
    ];
}
/** Why a view cannot be entered now, or ''. */
export function blockedReason(state, view) {
    if (state.mode === 'practice' || state.learnerPreview)
        return view === 'sort' || view === 'edit' ? '' : 'Ebben a nézetben csak a rendező és a megoldáskód érhető el.';
    return view === 'author' || authorPreviewId(state) ? '' : NEEDS_MODEL;
}
/** Enters a view when allowed; entering the solution editor captures the current arrangement. */
export function enterView(state, attempt, formatted, next) {
    if (blockedReason(state, next))
        return false;
    activateView(state, attempt, formatted, next);
    return state.view === next;
}
/** Switches mode; each mode keeps its own active exercise and returns to its own view. */
export function enterMode(state, mode) {
    if (state.mode === mode)
        return;
    const views = state.modeViews ??= {};
    views[state.mode] = state.view;
    state.learnerPreview = false;
    state.mode = mode;
    if (mode === 'practice') {
        const trusted = state.exercises.filter(exercise => !state.previews.has(exercise.id));
        state.practiceActive = trusted.some(exercise => exercise.id === state.practiceActive) ? state.practiceActive : trusted[0]?.id ?? null;
        state.active = state.practiceActive ?? null;
    }
    else
        state.active = authorPreviewId(state);
    const back = views[mode] ?? (mode === 'practice' ? 'sort' : 'author');
    state.view = blockedReason(state, back) ? (mode === 'practice' ? 'sort' : 'author') : back;
}
/** After a new author model is installed: where the author continues. */
export function landAfterAdmission(state, land) {
    state.mode = 'author';
    state.active = authorPreviewId(state);
    if (land === 'rules')
        state.view = 'model';
    else if (land === 'try')
        state.view = 'sort';
    else if (blockedReason(state, state.view))
        state.view = 'model';
}
