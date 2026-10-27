const same = (a, b) => a.source === b.source && a.language === b.language && a.title === b.title && a.description === b.description && (a.importEmit ?? 'verbatim') === (b.importEmit ?? 'verbatim');
/** The generation request for the reference; the import emit is a TypeScript-only assumption (ADR-013). */
export function authorRequest(author) {
    const { title, description, language, source, importEmit } = author;
    return { title, description, language, source, ...(language === 'typescript' && importEmit ? { importEmit } : {}) };
}
/** The reference differs from the one the applied model was built from (or none was built yet). */
export function authorDraftPending(state) {
    return !!state.authorBaseline && !same(state.author, state.authorBaseline);
}
export function refreshAuthorStatus(root, state) {
    const pending = authorDraftPending(state), status = root.querySelector('[data-author-status]');
    if (status) {
        status.textContent = !state.authorBaseline ? 'Még nem készült modell' : pending ? 'Nem alkalmazott referencia' : 'A modell ebből a forrásból készült';
        status.classList.toggle('pending', pending);
    }
    const step = root.querySelector('[data-step="source"]');
    if (pending && step && !step.querySelector('.dirty-dot')) {
        const dot = document.createElement('span');
        dot.className = 'dirty-dot';
        dot.setAttribute('aria-label', 'Nem alkalmazott referencia');
        step.append(dot);
    }
    else if (!pending)
        step?.querySelector('.dirty-dot')?.remove();
}
const nextRequest = (state) => state.authorRequestGeneration = (state.authorRequestGeneration ?? 0) + 1;
const previewId = (state) => state.previews.keys().next().value;
/** Capture at user intent, before file/clipboard/network I/O; the latest reference action wins. */
export function captureAuthorRequest(state) {
    const generation = nextRequest(state), current = captureAuthorAdmission(state);
    return () => generation === state.authorRequestGeneration && current();
}
/** Async admission is for the captured reference and model, never newer text or another preview. */
export function captureAuthorAdmission(state) {
    const preview = previewId(state), author = { ...state.author }, modelDraft = state.modelDraft;
    return () => previewId(state) === preview && same(author, state.author) && state.modelDraft === modelDraft;
}
/** An example is a starting point: its reference becomes the unapplied draft. */
export function startFromExample(state, exercise) {
    nextRequest(state);
    state.author = { title: exercise.title, description: exercise.description, language: exercise.language, source: exercise.lines.map(line => line.code).join('\n'), message: `A(z) „${exercise.title}” példa referenciája betöltve. A modell a Modell készítése gombbal készül el belőle.` };
}
/** Discards unapplied reference edits: the draft returns to what the applied model was built from. */
export function revertAuthorDraft(state) {
    if (!state.authorBaseline)
        return;
    nextRequest(state);
    state.author = { ...state.authorBaseline, message: 'A nem alkalmazott változtatásokat elvetettük.' };
}
/** Call only after installPreview succeeds: the admitted model becomes the reference baseline.
 * `keepPending`: a rule edit changes no line, so an unapplied reference draft stays pending. */
export function admitAuthorModel(state, model, source, { keepPending = false } = {}) {
    nextRequest(state);
    const pending = keepPending && authorDraftPending(state) ? state.author : undefined, importEmit = model.authoring?.evidence?.environment?.importEmit;
    const author = { title: model.title, description: model.description, language: model.language, source: source ?? model.lines.map(l => l.code).join('\n'), message: '', ...(importEmit ? { importEmit } : {}) };
    state.author = pending ?? author;
    state.authorBaseline = { ...author };
}
