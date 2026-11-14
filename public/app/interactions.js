import { captureAuthorRequest, formatLoaded, modelDraftStatus, replaceDraft } from './author-workspace.js';
import { trackActivity } from './activity.js';
import { viewSwitchesOffered } from './code-view.js';
const views = ['sort', 'edit', 'author', 'model'];
export function activateView(state, attempt, formatted, next) {
    // ADR-133: the solution editor (Megoldáskód) is switched off with the view switches; its code stays.
    if (!views.includes(next) || next === 'edit' && !viewSwitchesOffered())
        return;
    if (next === 'edit' && attempt && !attempt.editorDirty) {
        attempt.draft = formatted.join('\n');
        attempt.editorGeneration = attempt.generation;
    }
    state.view = next;
}
export function markEditorDraft(attempt, text) { if (!attempt.editorDirty)
    attempt.editorGeneration = attempt.generation; attempt.draft = text; attempt.editorDirty = true; }
export function markEditorApplied(attempt) { attempt.editorDirty = false; attempt.editorGeneration = attempt.generation; }
export function reloadEditorFromArrangement(attempt, formatted) { attempt.draft = formatted.join('\n'); markEditorApplied(attempt); }
/** A late formatter response must still belong to the same untouched draft. */
export function captureEditorRequest(editor, state, attempt, getAttempt, language) {
    const text = editor.value, active = state.active, view = state.view, generation = attempt?.generation, originalLanguage = language();
    return () => editor.isConnected && editor.value === text && state.active === active && state.view === view && getAttempt() === attempt && attempt?.generation === generation && language() === originalLanguage;
}
/** Row buttons target the adjacent movable slot, skipping fixed physical slots. */
export function adjacentMoveBoundary(position, direction, length, isFixed) {
    for (let target = position + direction; target >= 0 && target < length; target += direction)
        if (!isFixed(target))
            return target + (direction === 1 ? 1 : 0);
    return position;
}
/** Header and step menus (ADR-105) are disclosure widgets: a click outside, Escape, or an action inside closes them. */
/** ADR-120 (U3): a control the availability model disabled (aria-disabled with a reason) never runs: this capture-phase
 * guard stops the click (or Enter/Space) before any handler and shows the reason beside the control, read out politely.
 * Nothing failed, so there is no error message; the reason says what to do instead. */
export function installDisabledGuard(root) {
    let timer;
    root.addEventListener('click', event => {
        const control = event.target instanceof Element ? event.target.closest('[aria-disabled="true"][data-disabled-reason]') : null;
        if (!control)
            return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const reason = control.dataset.disabledReason ?? '';
        let hint = root.querySelector('.disabled-hint');
        if (!hint) {
            hint = document.createElement('div');
            hint.className = 'disabled-hint';
            hint.setAttribute('role', 'status');
            root.append(hint);
        }
        hint.textContent = reason;
        const box = control.getBoundingClientRect(), width = Math.min(320, innerWidth - 24);
        hint.style.width = `${width}px`;
        hint.style.left = `${Math.max(12, Math.min(box.left, innerWidth - width - 12))}px`;
        hint.style.top = `${box.bottom + 6 + 260 > innerHeight ? Math.max(12, box.top - 6 - hint.offsetHeight) : box.bottom + 6}px`;
        hint.hidden = false;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => { if (hint)
            hint.hidden = true; }, 4500);
    }, true);
}
export function installMenus(root) {
    const close = (except) => { for (const menu of root.querySelectorAll('details.menu[open]'))
        if (menu !== except)
            menu.open = false; };
    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null, menu = target?.closest('details.menu') ?? null;
        // A click whose render replaced the page left the menus as that render wanted them (a choice keeps its menu open).
        if (target && !target.isConnected)
            return;
        close(menu);
        if (menu instanceof HTMLDetailsElement && target?.closest('.menu-panel button'))
            menu.open = false;
    });
    root.addEventListener('keydown', event => { if (event.key !== 'Escape')
        return; const menu = event.target instanceof Element ? event.target.closest('details.menu[open]') : null; if (!menu)
        return; menu.open = false; menu.querySelector('summary')?.focus(); });
}
/** ADR-145 (D5): the toolbar menu's help row leads to the help under the lists: opens it where it stands, shows it and
 *  hands it the focus (on a phone it is a screen or two below the tools). */
export function openWorkspaceHelp(root) {
    const help = root.querySelector('details.workspace-help'), summary = help?.querySelector(':scope > summary');
    if (!help || !summary)
        return;
    help.open = true;
    summary.focus({ preventScroll: true });
    help.scrollIntoView({ block: 'start' });
}
export function installWorkbenchKeyboard(root) {
    root.addEventListener('keydown', event => {
        const target = event.target instanceof Element ? event.target : null, tab = target?.closest('[role="tab"]');
        if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            const tabs = [...root.querySelectorAll('[role="tab"]')], index = tabs.indexOf(tab);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            event.preventDefault();
            tabs[next]?.focus();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.altKey) {
            const active = root.dataset.renderedView;
            const selector = active === 'author' ? '.step-panel [data-author-apply],[data-model-apply]' : active === 'model' ? '[data-model-apply]' : active === 'edit' ? '[data-apply]' : '[data-check]';
            event.preventDefault();
            root.querySelector(selector)?.click();
        }
    });
}
const running = new WeakSet();
/** ADR-127 (P1): the actions that wait for work (the engine, the formatter, a fetch), by their control, with the name the
 *  progress indicator shows. A busy control is disabled and `aria-busy`; its icon turns into a spinner only when the
 *  indicator appears (activity.ts), so quick work does not flash. */
const BUSY = [
    ['data-check', 'Ellenőrzés'], ['data-author-apply', 'Modell készítése'], ['data-author-check', 'Forrás vizsgálata'],
    ['data-model-apply', 'JSON alkalmazása'], ['data-model-refresh', 'Sorfüggőségek újraszámítása'],
    ['data-format', 'Formázás'], ['data-author-format', 'Formázás'], ['data-author-sample', 'TypeScript minta betöltése'],
    ['data-load-local', 'Mentett munka megnyitása'],
    ['data-rule-edit', 'Szabály módosítása'], ['data-rule-kind-confirm', 'Szabály módosítása'], ['data-rule-connect', 'Szabály módosítása'], ['data-rule-pin', 'Szabály módosítása'],
];
export async function dispatchWorkbenchAction(event, handler, onError) {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button || running.has(button))
        return;
    const busy = BUSY.find(([attribute]) => button.hasAttribute(attribute))?.[1];
    const disabled = button.disabled, hadFocus = document.activeElement === button, owner = button.closest('#app');
    const context = owner ? { exercise: owner.dataset.renderedExercise, view: owner.dataset.renderedView } : undefined;
    const action = button.getAttributeNames().find(name => name.startsWith('data-'));
    if (busy) {
        running.add(button);
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
    }
    try {
        await (busy ? trackActivity(busy, handler(button), button) : handler(button));
    }
    catch (error) {
        if (onError)
            onError(error);
        else
            throw error;
    }
    finally {
        if (busy) {
            running.delete(button);
            if (button.isConnected) {
                button.disabled = disabled;
                button.removeAttribute('aria-busy');
            }
            if (hadFocus && action && owner && context && context.exercise === owner.dataset.renderedExercise && context.view === owner.dataset.renderedView && document.activeElement === document.body)
                owner.querySelector('[' + action + ']')?.focus({ preventScroll: true });
        }
    }
}
/** Two author inputs converge on the same compiled preview; learner mode is UI isolation, not authorization. */
export function installAuthoringFlows(root, state, render, format) {
    let returnView = 'sort';
    root.addEventListener('input', event => {
        const editor = event.target;
        if (!(editor instanceof HTMLTextAreaElement))
            return;
        if (editor.id === 'code-editor') {
            const status = root.querySelector('[data-editor-status]');
            if (status) {
                status.textContent = 'Nem alkalmazott változat';
                status.classList.add('pending');
            }
            const tab = root.querySelector('[data-view="edit"]');
            if (tab && !tab.querySelector('.dirty-dot')) {
                const dot = document.createElement('span');
                dot.className = 'dirty-dot';
                dot.setAttribute('aria-label', 'Nem alkalmazott változtatás');
                tab.append(dot);
            }
        }
        else if (editor.id === 'model-editor') {
            // ADR-155 (T1.7): one owner says whether the JSON is applied, here with the text as it is typed.
            const answer = modelDraftStatus(state, editor.value), status = root.querySelector('[data-model-status]');
            if (status) {
                status.textContent = answer.label;
                status.classList.toggle('pending', answer.pending);
            }
        }
    });
    root.addEventListener('click', event => {
        if (!(event.target instanceof Element) || !event.target.closest('[data-preview-toggle]'))
            return;
        if (state.learnerPreview) {
            state.learnerPreview = false;
            state.view = returnView;
        }
        else {
            returnView = state.view;
            state.learnerPreview = true;
            if (state.view !== 'edit')
                state.view = 'sort';
        }
        render();
        root.querySelector('[data-preview-toggle]')?.focus({ preventScroll: true });
    });
    root.addEventListener('change', async (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || !input.hasAttribute('data-source-file'))
            return;
        const file = input.files?.[0];
        if (!file)
            return;
        const current = captureAuthorRequest(state);
        try {
            if (file.size > 200000)
                throw Error('A forrásfájl legfeljebb 200 KB lehet.');
            const next = await trackActivity('Forrásfájl megnyitása', (async () => {
                const source = (await file.text()).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
                if (source.length > 50000)
                    throw Error('Legfeljebb 50000 karakteres forrás tölthető be.');
                const language = /\.ts$/i.test(file.name) ? 'typescript' : /\.(mjs|js)$/i.test(file.name) ? 'javascript' : state.author.language;
                return formatLoaded({ ...state.author, source, language, message: `${file.name} betöltve. A forrás még nincs alkalmazva. A cím és leírás nem változik automatikusan; ellenőrizd őket.` }, format);
            })());
            if (!current())
                return;
            replaceDraft(state, next);
        }
        catch (error) {
            if (!current())
                return;
            state.author.message = error instanceof Error ? error.message : 'A forrásfájl nem olvasható.';
        }
        if (!state.learnerPreview && state.view === 'author')
            render();
    });
    root.addEventListener('click', event => { if (event.target instanceof Element && event.target.closest('[data-import-source]'))
        root.querySelector('[data-source-file]')?.click(); });
}
