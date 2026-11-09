import { renderDependencyTable, renderWitness } from './dependency-view.js';
import { createFieldRenderer } from './fields.js';
import { beautifier } from '../formatter.js';
import { validationMode } from './api.js';
import { escapeHtml as esc, editorShell, updateGutters } from './ui-utilities.js';
import { icon } from './icons.js';
import { createViewContinuity } from './continuity.js';
import { installWorkbenchKeyboard, installAuthoringFlows, installMenus } from './interactions.js';
import { authorDraftPending, canUndoReplace, refreshAuthorStatus } from './author-workspace.js';
import { renderPreflightSettings, renderSettingsOrigin, renderSourceDiagnostics } from './preflight-settings.js';
import { createRuleMarks, renderModelInsight, renderRuleCause, renderRuleKinds, renderRulePanel, rulesAvailable } from './rule-panel.js';
import { drawRuleArcs, renderRuleBoard, renderTryConnecting, renderTryRules, tryRowRuleControls } from './rule-board.js';
import { installPaneSplit, paneSplit } from './pane-split.js';
import { authorPreviewId, continuityKey, flowSteps, jsonPending, staleReason, stepOf } from './flow.js';
import { THEME_LABEL, themeChoice } from './theme.js';
import { CODE_VIEW_LABEL, codeView } from './code-view.js';
import { installSurface, surface } from './surface.js';
const DEMO_NOTICE = 'codeline.local-demo-notice';
const demoNoticeSeen = () => { try {
    return localStorage.getItem(DEMO_NOTICE) === 'seen';
}
catch {
    return false;
} };
const tool = (attribute, label, name, extra = '') => `<button type="button" ${attribute} ${extra}>${icon(name)}<span>${label}</span></button>`;
const languageName = (language) => language === 'typescript' ? 'TypeScript' : 'JavaScript';
export function createWorkbenchView({ root, state, ex, at, attempt, scroll }) {
    const continuity = createViewContinuity(root);
    root.addEventListener('click', event => { if (!(event.target instanceof Element) || !event.target.closest('[data-dismiss-notice]'))
        return; try {
        localStorage.setItem(DEMO_NOTICE, 'seen');
    }
    catch { } root.querySelector('[data-validation-notice]')?.remove(); root.querySelector('#workbench-main')?.focus({ preventScroll: true }); });
    installWorkbenchKeyboard(root);
    installMenus(root);
    installSurface(root, () => render());
    codeView(root);
    paneSplit(root);
    installPaneSplit(root, () => drawRuleArcs(root, state));
    installAuthoringFlows(root, state, render);
    addEventListener('resize', () => { drawRuleArcs(root, state); updateGutters(root); });
    // ADR-090: a code list scrolls sideways as one; its rule arcs follow the row controls pinned at its right edge.
    let arcFrame = 0;
    root.addEventListener('scroll', event => { if (arcFrame || !(event.target instanceof HTMLElement) || !event.target.matches('.drop-zone[data-zone]') || !event.target.querySelector(':scope > svg.zone-arcs'))
        return; arcFrame = requestAnimationFrame(() => { arcFrame = 0; drawRuleArcs(root, state); }); }, { capture: true, passive: true });
    function syntax(code, language = ex()?.language ?? state.author.language) { try {
        const prism = window.Prism, grammar = prism?.languages[language];
        if (prism && grammar)
            return prism.highlight(code, grammar, language);
    }
    catch { } return esc(code); }
    // ── Try: the learner's sorter and solution editor (author step 3, practice, learner preview) ──
    /** The feedback this view may show: the learner's in practice and in the learner preview, else the author's. */
    const feedbackOf = (report) => report?.feedback ? (state.learnerPreview || !report.feedback.author ? report.feedback.learner : report.feedback.author) : undefined;
    /** Sorter slot → the diagnostics that name it, with whether it is surely involved (ADR-026). */
    function slotMarks(a) {
        const marks = new Map(), feedback = feedbackOf(a.report), slots = a.report?.slots;
        if (!feedback || !slots)
            return marks;
        feedback.diagnostics.forEach((d, k) => { if (d.severity !== 'error')
            return; for (const position of d.positions) {
            const slot = slots[position];
            if (slot === undefined)
                continue;
            const mark = marks.get(slot) ?? { items: [], sure: false };
            mark.items.push(k);
            mark.sure ||= d.positionScope === 'all';
            marks.set(slot, mark);
        } });
        return marks;
    }
    function zone(e, a, list) {
        const source = list === 'pool', ids = a[list], pretty = source ? ids.map(attempt.text) : attempt.formattedAnswer(), marks = createRuleMarks(state), graded = source ? new Map() : slotMarks(a);
        const rows = ids.map((id, i) => {
            const blank = id === null, pinned = !source && attempt.fixed(i), locked = pinned && !blank, raw = pretty[i] ?? '';
            const handle = locked ? icon('lock') : blank ? '·' : icon('grip');
            const actions = tryRowRuleControls(state, id) + (locked ? '<span class="fixed-tag">Rögzített</span>' : blank ? '' : source ? tool(`data-move="${i}"`, '', 'plus', `aria-label="${i + 1}. sor beszúrása" title="Beszúrás az első szabad helyre"`) :
                tool(`data-up="${i}"`, '', 'up', `aria-label="${i + 1}. sor feljebb helyezése" title="Egy hellyel feljebb"`) + tool(`data-down="${i}"`, '', 'down', `aria-label="${i + 1}. sor lejjebb helyezése" title="Egy hellyel lejjebb"`) + tool(`data-remove="${i}"`, '', 'back', `aria-label="${i + 1}. sor visszahelyezése a forráslistába" title="Vissza a felhasználható sorokhoz"`));
            const mark = graded.get(i), diagnosis = mark ? ` diag-${mark.sure ? 'error' : 'possible'}${state.feedbackFocus !== undefined && mark.items.includes(state.feedbackFocus) ? ' diag-focus' : ''}` : '', described = mark ? ` aria-describedby="${mark.items.map(k => 'feedback-' + k).join(' ')}"` : '';
            return `<div class="code-row ${source ? 'source-row' : 'solution-row'} ${pinned ? 'fixed-row' : ''} ${blank ? 'blank-row' : ''}${blank ? '' : marks(id)}${state.ruleConnect !== undefined && state.ruleConnect === id ? ' connect-source' : ''}${diagnosis}" data-list="${list}" data-index="${i}" data-line-id="${esc(id ?? '')}"${described} role="listitem" draggable="${!blank && !locked}"><button type="button" class="drag-handle" tabindex="${blank || locked ? -1 : 0}" aria-disabled="${blank || locked}" ${blank || locked ? 'disabled' : ''} aria-label="${i + 1}. sor mozgatása" aria-describedby="move-help" title="${locked ? 'Rögzített sor' : blank ? 'Üres hely' : 'Húzd a beszúrás helyére'}">${handle}</button><div class="gutter"><span>${i + 1}</span></div><pre class="code-text"><code>${blank ? ' ' : syntax(raw)}</code></pre><div class="row-actions">${actions}</div></div>`;
        }).join('');
        return `<div class="ide-pane"><div class="drop-zone ${source ? 'source-zone' + (!rows ? ' empty-source' : '') : 'solution-zone'}" data-zone="${list}" role="${rows ? 'list' : 'group'}" tabindex="0" aria-label="${source ? 'Felhasználható sorok' : 'Megoldás sorai'}">${rows || `<div class="empty">${icon('check')}<strong>Minden sor a megoldásban</strong><span>A vissza nyíllal bármelyik mozgatható sort visszateheted.</span></div>`}</div></div>`;
    }
    function sortView(e, a) {
        const filled = a.answer.filter(id => id !== null).length;
        // ADR-107: the two lists with a movable separator; the rule inspector docks beside them only on request.
        const rules = rulesAvailable(state), open = rules && !!state.rulePanelOpen, split = paneSplit(root);
        const separator = `<div class="pane-split" data-pane-split role="separator" tabindex="0" aria-orientation="vertical" aria-controls="pool-pane answer-pane" aria-label="A két lista szélessége: balra vagy jobbra nyíllal állítható" aria-valuemin="20" aria-valuemax="80" aria-valuenow="${split}" title="Húzd a két lista szélességének állításához"></div>`;
        const inspector = open ? `<aside id="try-rule-panel" class="rule-inspector" aria-labelledby="inspector-title"><div class="inspector-head"><h2 id="inspector-title">${icon('link')}Szabályok</h2>${tool('data-rule-panel-toggle', '', 'close', 'class="icon-only" aria-label="Szabálypanel bezárása" title="Bezárás (Escape)"')}</div>${renderTryRules(state)}<div class="try-rule-panel">${renderRulePanel(state)}</div></aside>` : '';
        return `${renderTryConnecting(state)}<div class="try-body${open ? ' with-inspector' : ''}"><div class="panes"${rules ? ' data-try-rules' : ''}><section id="pool-pane" class="pane pool-pane" aria-labelledby="source-title"><div class="panel-title"><div><h2 id="source-title">Felhasználható sorok</h2><span class="count">${a.pool.length}</span></div><div class="pane-clipboard">${tool('data-copy-pool', '', 'copy', 'class="icon-only" aria-label="Másolás: a felhasználható sorok a vágólapra" title="Másolás"')}</div></div>${zone(e, a, 'pool')}</section>${separator}<section id="answer-pane" class="pane answer-pane" aria-labelledby="solution-title"><div class="panel-title"><div><h2 id="solution-title">Megoldás</h2><span class="count">${filled}/${a.answer.length}</span><progress data-arrangement-progress max="${e.lines.length}" value="${filled}" aria-label="Elhelyezett sorok">${filled}/${e.lines.length}</progress></div><div class="pane-clipboard">${tool('data-copy-arrangement data-copy-solution', '', 'copy', 'class="icon-only" aria-label="Másolás: az összerendezett megoldás a vágólapra" title="Másolás"')}${tool('data-paste-solution', '', 'paste', 'class="icon-only" aria-label="Beillesztés: megoldás a vágólapról a rendezőbe" title="Beillesztés"')}</div></div>${zone(e, a, 'answer')}</section></div>${inspector}</div>`;
    }
    function editView(e, a) {
        const stale = a.editorDirty && a.editorGeneration !== a.generation;
        return `<section class="solution-editor" aria-labelledby="editor-title"><div class="editor-heading"><h2 id="editor-title">Megoldáskód</h2><span data-editor-status class="context-label ${a.editorDirty ? 'pending' : ''}">${a.editorDirty ? 'Nem alkalmazott változat' : 'A rendező aktuális állapota'}</span><div class="editor-tools">${tool('data-copy-editor', '', 'copy', 'class="icon-only" aria-label="Másolás: a szerkesztett megoldás a vágólapra" title="Másolás"')}${tool('data-paste-editor', '', 'paste', 'class="icon-only" aria-label="Beillesztés: megoldás a vágólapról a szerkesztőbe" title="Beillesztés"')}</div></div>${stale ? '<p class="draft-notice" role="note">A rendező a szerkesztés óta módosult. Az Alkalmazás ezt a szerkesztett változatot helyezi át a rendezőbe.</p>' : ''}<div class="ide-pane">${editorShell('code-editor')}</div><div class="editor-actions">${tool('data-format', 'Formázás', 'code')}${tool('data-editor-reload', 'Rendezőből újratöltés', 'reset', 'title="A szerkesztett megoldás elvetése és az aktuális rendező betöltése"')}${tool('data-apply', 'Megoldás alkalmazása', 'arrow', 'class="primary"')}</div></section>`;
    }
    const fixLabel = { verified: 'Ellenőrzött javítás', partial: 'Részleges javítás', guidance: 'Útmutatás' };
    /** The detailed explanation (ADR-026): every disclosed diagnostic, its fix at its own certainty,
     * and for the author its evidence; an item that names rows can move the focus to them. */
    function feedbackList(feedback, a) {
        if (!feedback?.diagnostics.length)
            return '';
        const author = feedback.level === 'provenance', slots = a.report?.slots ?? [];
        const items = feedback.diagnostics.map((d, k) => {
            const rows = d.positions.flatMap(position => slots[position] === undefined ? [] : [slots[position] + 1]);
            return `<li id="feedback-${k}" class="feedback-item severity-${d.severity} certainty-${d.certainty}" data-feedback-item="${k}"><p class="feedback-summary"><b>${esc(d.summary)}</b></p><p>${esc(d.detail)}</p>${d.reasons?.length ? `<p class="feedback-reasons">${esc(d.reasons.join(' '))}</p>` : ''}${d.fix ? `<p class="feedback-fix"><b>${fixLabel[d.fix.level]}:</b> ${esc(d.fix.text)}</p>` : ''}${author ? `<p class="feedback-evidence">Bizonyíték: ${esc(d.evidence)}${d.limits ? ` Korlát: ${esc(d.limits)}` : ''}</p>` : ''}${rows.length ? `<button type="button" class="link-action" data-feedback-goto="${k}">Ugrás: ${rows.map(row => row + '.').join(', ')} sor${d.positionScope === 'some' ? ' (ezek egyike)' : ''}</button>` : ''}</li>`;
        }).join('');
        const withheld = feedback.withheld ? `<p class="feedback-withheld">${feedback.withheld} további részlet ebben a nézetben nem jelenik meg.</p>` : '';
        return `<details class="feedback-details" data-memory="feedback-details" data-feedback><summary>Részletes magyarázat (${feedback.diagnostics.length})</summary><ol class="feedback-list">${items}</ol>${withheld}</details>`;
    }
    function reportView(e, a) {
        const remaining = a.answer.filter(id => id === null).length, report = a.report, preview = state.previews.has(e.id);
        const title = report ? report.status === 'accepted' ? 'Elfogadva' : report.status === 'indeterminate' ? 'Nem eldönthető' : report.status === 'invalid_reference' ? 'Érvénytelen referencia' : 'Hibás' : remaining ? 'Állítsd össze a megoldást' : 'Készen áll az ellenőrzésre';
        const feedback = feedbackOf(report), top = feedback?.diagnostics.find(d => d.severity === 'error' && d.certainty === 'proven') ?? feedback?.diagnostics[0];
        // ADR-054: in the author's own preview, why the violated rule holds and how to lift it.
        const lineOf = (token) => { const match = /^n:(\d+)$/.exec(token); return match ? Number(match[1]) : null; };
        const chain = top?.rule ? (top.rule.path ?? [top.rule.before, top.rule.after]).map(lineOf) : [];
        const cause = report?.status === 'rejected' && preview && !state.learnerPreview && chain.length > 1 && chain.every(id => id !== null) ? renderRuleCause(state, chain) : '';
        const message = top?.summary ?? report?.message ?? (remaining ? `Még ${remaining} sor vár elhelyezésre. Részleges megoldást is ellenőrizhetsz.` : 'A teljes sorrend elkészült. Ellenőrizd a tartalmat, a függőségeket és a blokkokat.');
        return `<footer class="evaluation-bar"><div class="report ${report?.status ?? 'idle'}" role="status" aria-live="polite"><span class="report-symbol">${icon(report?.status === 'accepted' ? 'check' : report ? 'help' : 'code')}</span><div><b>${title}</b><p>${esc(message)}</p>${cause}${report?.status === 'rejected' && !state.learnerPreview && preview && state.authorModel?.authoring?.note ? `<details data-ordering-policy><summary>Generált sorrendszabályok</summary><p>${esc(state.authorModel.authoring.note)}</p><a href="./samples/typescript/index.html" target="_blank" rel="noopener">TypeScript példák és ellenpéldák</a></details>` : ''}${report && !state.learnerPreview ? `<details class="technical-details" data-memory="evaluation-details"><summary>Technikai részletek</summary><span>Keresett állapotok: ${report.exploredStates ?? 0}</span></details>` : ''}</div></div><div class="check-action">${tool('data-check', 'Ellenőrzés', 'check', 'class="primary check" aria-keyshortcuts="Control+Enter" title="Ellenőrzés (Ctrl + Enter)"')}</div></footer>${feedbackList(feedback, a)}${state.learnerPreview ? '' : renderWitness(report, e, preview ? state.authorModel : null)}`;
    }
    /** One menu for the session (ADR-105): save, restore, export and import live together in the header. */
    function sessionMenu() {
        return `<details class="menu session-menu"><summary aria-label="Munkamenet: mentés és betöltés" title="Munkamenet">${icon('save')}<span>Munkamenet</span></summary><div class="menu-panel" role="group" aria-label="Munkamenet">${tool('data-save-local', 'Helyi mentés', 'save')}${tool('data-load-local', 'Visszatöltés', 'reset')}${tool('data-export-session', 'Fájl export', 'download', 'aria-label="Fájl export: a munkamenet fájlba"')}${tool('data-import-session', 'Fájl import', 'upload', 'aria-label="Fájl import: munkamenet fájlból"')}<small>A helyi mentés ezen a böngészőn marad; hitelesített eredményt nem tartalmaz.</small></div></details>`;
    }
    /** Rendező | Megoldáskód: the only tabs left; the steps are not tabs. */
    function tryPanel(e, a, { actions = true } = {}) {
        const v = state.view === 'edit' ? 'edit' : 'sort', tab = (view, label, name) => `<button type="button" id="tab-${view}" role="tab" data-view="${view}" aria-controls="panel-try" aria-selected="${v === view}" tabindex="${v === view ? 0 : -1}" class="${v === view ? 'active' : ''}">${icon(name)}<span>${label}</span>${view === 'edit' && a.editorDirty ? '<span class="dirty-dot" aria-label="Nem alkalmazott változtatás"></span>' : ''}</button>`;
        // ADR-106: the code view (editor or cards) and the focus surface sit with the workspace they change.
        const view = codeView(root), focused = surface(root) === 'focus', styles = v === 'sort' ? `<div class="segment code-view-switch" role="group" aria-label="Kódnézet">${['editor', 'cards'].map((value) => `<button type="button" data-set-code-view="${value}" aria-pressed="${view === value}" class="${view === value ? 'active' : ''}" title="Kódnézet: ${CODE_VIEW_LABEL[value]}">${icon(value === 'editor' ? 'rows' : 'cards')}<span>${CODE_VIEW_LABEL[value]}</span></button>`).join('')}</div>` : '';
        const focus = tool('data-focus', focused ? 'Kilépés' : 'Fókusz', focused ? 'exit' : 'focus', `class="focus-toggle" aria-pressed="${focused}" title="${focused ? 'Kilépés a fókusz módból (Escape)' : 'Fókusz mód: csak a kódfelület, a lehető legnagyobb méretben'}"`);
        const inspect = v === 'sort' && rulesAvailable(state) ? tool('data-rule-panel-toggle', 'Szabályok', 'link', `class="inspector-toggle" aria-pressed="${!!state.rulePanelOpen}" aria-expanded="${!!state.rulePanelOpen}" aria-controls="try-rule-panel" title="${state.rulePanelOpen ? 'Szabálypanel bezárása' : 'Szabálypanel: a kijelölt sor szabályai és szerkesztésük'}"`) : '';
        return `<div class="toolbar"><div class="toolbar-start"><div class="segment try-tabs" role="tablist" aria-label="Megoldás">${tab('sort', 'Rendező', 'sort')}${tab('edit', 'Megoldáskód', 'edit')}</div>${styles}</div><div class="workspace-actions">${actions ? tool('data-reset', 'Visszaállítás', 'reset') + (state.learnerPreview ? '' : tool('data-all', 'Minta kitöltés', 'file')) : ''}${inspect}${focus}</div></div><div id="panel-try" role="tabpanel" aria-labelledby="tab-${v}">${v === 'edit' ? editView(e, a) : sortView(e, a)}</div>${v === 'sort' ? reportView(e, a) : ''}<p class="note" role="status" aria-live="polite">${esc(a.feedback || '')}</p>`;
    }
    // ── Author step 1: the reference source (code or a whole CodeLine JSON) ──
    function jsonBlock(context) {
        const m = authorPreviewId(state) ? state.authorModel : undefined, dirty = jsonPending(state);
        const refresh = context === 'rules' && m ? `<div class="draft-notice" data-dependency-refresh><p>${m.authoring?.strategy === 'ast-hierarchy' && !m.authoring.dependencyPolicy ? 'Régebbi generált modell: a változatlan JSON a korábbi sorfüggőségeket használja. A dependencyHints csak tájékoztató. ' : ''}Az újraszámítás az itt látható JSON kódsorai alapján lecseréli a generált sorfüggőségeket. A kód, a sor-ID-k, a fixed helyek, a blokkok, a szerzői szabályok és a profilok megmaradnak; a jelentés a Minősítés alatt jelenik meg.</p>${tool('data-model-refresh', 'Sorfüggőségek újraszámítása', 'code')}</div>` : '';
        return `${context === 'rules' ? renderDependencyTable(m) : ''}${refresh}<div class="editor-heading"><h3>CodeLine JSON</h3><span data-model-status class="context-label ${dirty ? 'pending' : ''}">${dirty ? 'Nem alkalmazott JSON' : m ? 'Aktív modell' : 'Új feladat JSON-ból'}</span><div class="editor-tools">${tool('data-copy-model', 'JSON másolása', 'copy', 'aria-label="JSON másolása: a modell a vágólapra"')}${tool('data-paste-model', 'Beillesztés', 'paste', 'aria-label="Beillesztés: JSON-modell a vágólapról"')}${tool('data-import-model', 'JSON betöltése', 'upload')}${m ? tool('data-export-model', 'JSON export', 'download') : ''}</div></div><div class="ide-pane">${editorShell('model-editor', 'model')}</div><div class="editor-actions"><p class="inline-hint">A scopeId, functionBlock és blocks mezőknek konzisztensnek kell maradniuk.</p>${tool('data-model-apply', context === 'source' ? 'Modell betöltése → Szabályok' : 'JSON alkalmazása', 'arrow', 'class="primary"')}</div><p class="author-status" data-model-message role="status" aria-live="polite">${esc(state.modelMessage || 'Hibás modellnél a korábbi aktív állapot megmarad.')}</p>`;
    }
    /** Author step 1 (ADR-105): what the exercise is (title, language, level, description) in one block; the
     * analysis settings fold away with their current values in the summary; opening a source is one menu. */
    function sourceStep() {
        const a = state.author, kind = state.sourceKind === 'json' ? 'json' : 'code', trusted = state.exercises.filter(e => !state.previews.has(e.id));
        const kindTab = (value, label) => `<button type="button" data-source-kind="${value}" aria-pressed="${kind === value}" class="${kind === value ? 'active' : ''}">${label}</button>`;
        const option = (value, current, label) => `<option value="${value}" ${current ? 'selected' : ''}>${label}</option>`;
        const open = `<details class="menu open-menu"><summary>${icon('folder')}<span>Megnyitás</span></summary><div class="menu-panel" role="group" aria-label="Forrás megnyitása"><label>Példa<select data-start-example title="A választott példa azonnal betöltődik; a Visszavonás visszahozza a korábbi forrást."><option value="">Válassz példát…</option>${trusted.map(e => `<option value="${esc(e.id)}">${esc(e.title)} · ${languageName(e.language)}</option>`).join('')}</select></label>${tool('data-import-source', 'Forrásfájl…', 'upload')}${tool('data-author-sample', 'TS tesztfájl', 'file')}<a class="menu-link" data-typescript-catalog href="./samples/typescript/index.html" target="_blank" rel="noopener">TypeScript példatár ↗</a></div></details>`;
        const settings = renderPreflightSettings(a, state.authorPolicy, state.settingsOrigin);
        const code = `<div class="form-grid"><label class="span-2">Cím<input data-author="title" value="${esc(a.title)}" maxlength="140" autocomplete="off"></label><label>Nyelv<select data-author="language">${option('javascript', a.language === 'javascript', 'JavaScript')}${option('typescript', a.language === 'typescript', 'TypeScript')}</select></label><label>Szint<select data-author="level">${option('', !a.level, 'Nincs megadva')}${option('beginner', a.level === 'beginner', 'Kezdő')}${option('intermediate', a.level === 'intermediate', 'Közepes')}${option('advanced', a.level === 'advanced', 'Haladó')}</select></label><label class="span-all">Feladatleírás<input data-author="description" value="${esc(a.description)}" maxlength="500"></label></div>${settings}<input type="file" data-source-file accept=".js,.mjs,.ts,.txt,text/plain" hidden><div class="editor-heading"><h3>Referenciaforrás</h3><span data-author-status class="context-label ${authorDraftPending(state) ? 'pending' : ''}"></span><div class="editor-tools">${tool('data-author-format', 'Formázás', 'code', 'class="labeled-tool" title="Formázás: 5 szóközös behúzás, a szintaxis ellenőrzésével"')}${tool('data-copy-author', '', 'copy', 'class="icon-only" aria-label="Másolás: a forráskód a vágólapra" title="Másolás"')}${tool('data-paste-author', '', 'paste', 'class="icon-only" aria-label="Beillesztés: forráskód a vágólapról" title="Beillesztés"')}</div></div><div class="ide-pane">${editorShell('author-editor')}</div><div class="editor-actions">${authorDraftPending(state) ? tool('data-author-revert', 'Változások elvetése', 'reset', 'title="Vissza ahhoz a forráshoz, amelyből az aktív modell készült"') : ''}${tool('data-author-check', 'Forrás ellenőrzése', 'check', 'title="Az első kapu a választott beállításokkal, modell készítése nélkül"')}${tool('data-author-apply', 'Modell készítése', 'arrow', 'class="primary"')}</div><p class="author-status" role="status" aria-live="polite">${esc(a.message || 'A Modell készítése ellenőrzi a szintaxist és a szerkezetet, majd elkészíti a sorokat és a szabályokat.')}${canUndoReplace(state) ? tool('data-author-undo', 'Visszavonás', 'back', 'class="link-action" title="A betöltés előtti forrás visszaállítása"') : ''}</p>${renderSourceDiagnostics(state.sourceGate?.gate, !!state.sourceGate && state.sourceGate.source !== a.source)}`;
        return `<section class="author step-panel" aria-labelledby="step-title"><div class="section-bar"><h2 id="step-title">Forrás</h2><div class="section-actions"><div class="segment source-kind" role="group" aria-label="A forrás fajtája">${kindTab('code', 'Forráskód')}${kindTab('json', 'CodeLine JSON')}</div>${kind === 'code' ? open : ''}</div></div>${kind === 'json' ? jsonBlock('source') : code}</section>`;
    }
    // ── Author step 2: rules (visual board with the rule panel, or the JSON) ──
    /** ADR-055: the analysis settings the model records, so the rules read in their light. */
    function analysisSettings(m) {
        const environment = m?.authoring?.evidence?.environment;
        if (!environment)
            return renderSettingsOrigin(state.settingsOrigin);
        return `<p class="analysis-settings" data-analysis-settings><span>Bemenetek: <b>${environment.inputs === 'valid' ? 'érvényes egyszerű adat' : 'szigorú'}</b></span><span>Objektumkulcsok sorrendje: <b>${environment.keyOrder === 'ignored' ? 'nem számít' : 'számít'}</b></span><span>Osztálymezők: <b>${environment.classFields === 'define' ? 'csak szabványos' : 'mindkét mód'}</b></span><span class="inline-hint">A Forrás lépésben állítható; a modell ezzel készült.</span></p>${renderSettingsOrigin(state.settingsOrigin)}`;
    }
    function rulesStep() {
        const m = state.authorModel, v = state.rulesView === 'json' ? 'json' : 'visual', verification = state.authorInsight?.verification;
        const tab = (value, label, name) => `<button type="button" role="tab" id="rules-tab-${value}" data-rules-view="${value}" aria-controls="rules-panel" aria-selected="${v === value}" tabindex="${v === value ? 0 : -1}" class="${v === value ? 'active' : ''}">${icon(name)}<span>${label}</span>${value === 'json' && jsonPending(state) ? '<span class="dirty-dot" aria-label="Nem alkalmazott JSON"></span>' : ''}</button>`;
        const visual = `${renderRuleKinds(state)}<div class="rules-layout"><div class="rules-main">${renderRuleBoard(state, code => syntax(code, m?.language))}</div><aside class="rules-side" data-scroll-memory="rules-side" aria-label="A kijelölt sor szabályai">${renderRulePanel(state)}</aside></div><details class="insight-details" data-memory="model-insight" open><summary>Minősítés és ellenőrzések</summary>${renderModelInsight(state.authorInsight)}</details>`;
        return `<section class="author step-panel" aria-labelledby="step-title"><div class="section-bar"><h2 id="step-title">Szabályok</h2><div class="section-actions">${verification ? `<span class="verification-badge status-${verification.status}" data-step-verification>${{ 'analysis-verified': 'Elemzéssel igazolt', conservative: 'Konzervatív', 'author-modified': 'Szerzői döntéssel módosított', unverified: 'Nem igazolt' }[verification.status]}</span>` : ''}<div class="segment rules-tabs" role="tablist" aria-label="Szabályszerkesztő">${tab('visual', 'Vizuális', 'link')}${tab('json', 'JSON', 'settings')}</div></div></div><div class="model-overview"><span><b>${m?.lines.length ?? 0}</b> kódsor</span><span><b>${m?.blocks.length ?? 0}</b> blokk</span><span><b>${state.authorInsight?.rules?.constraints.filter(c => c.editability !== 'hard').length ?? 0}</b> nem szerkezeti szabály</span><p>${esc(state.modelMessage || 'A szabály részleges rend: az előzménynek bárhol előbb kell állnia. A módosítás azonnal érvényes.')}</p></div>${analysisSettings(m)}${m?.authoring?.note ? `<p class="draft-notice" data-ordering-policy>${esc(m.authoring.note)}</p>` : ''}<div id="rules-panel" role="tabpanel" aria-labelledby="rules-tab-${v}">${v === 'json' ? jsonBlock('rules') : visual}</div><div class="step-nav">${tool('data-goto="source"', 'Vissza a forráshoz', 'back')}${tool('data-goto="try"', 'Tovább a próbához', 'arrow', 'class="primary"')}</div></section>`;
    }
    // ── Shells ──
    const languageBadge = (language, rows) => `<span class="language-badge ${language === 'typescript' ? 'ts' : 'js'}" title="${languageName(language)}">${language === 'typescript' ? 'TS' : 'JS'}</span><span>${languageName(language)}${rows !== undefined ? ` · ${rows} sor` : ''}</span>`;
    /** The validation the current view runs (AGENTS.md: Local Demo, Preview Validation and the trusted server stay named). */
    const validationLabel = () => validationMode === 'local-demo' ? 'Local Demo / Preview Validation' : state.mode === 'author' ? 'Preview Validation' : 'Trusted Server Validation';
    /** The badge names the validation in short (the Pages demo: just „Local Demo”); its full name and meaning are its title and accessible name. */
    const badge = () => {
        const meaning = validationMode === 'local-demo' ? 'Helyi demonstráció, nem hitelesített vizsgaeredmény' : state.mode === 'author' ? 'Saját feladat tesztelése, nem hitelesített vizsgaeredmény' : 'A beépített referencia szabályait a szerver kezeli';
        const short = validationMode === 'local-demo' ? 'Local Demo' : validationLabel();
        return `<span class="mode-badge" role="note" title="${validationLabel()} · ${meaning}" aria-label="${validationLabel()}: ${meaning}"><span class="status-dot" aria-hidden="true"></span>${short}</span>`;
    };
    /** The heading of the exercise in hand: its title, language and size, and what validates it. */
    const heading = (title, language, rows, extra = '') => `<div class="task-heading"><h1>${esc(title)}</h1><p class="task-meta">${languageBadge(language, rows)}${badge()}</p>${extra}</div>`;
    const themeButton = () => {
        const choice = themeChoice(), next = choice === 'system' ? 'light' : choice === 'light' ? 'dark' : 'system', glyph = choice === 'light' ? 'sun' : choice === 'dark' ? 'moon' : 'contrast';
        return tool('data-theme-cycle', THEME_LABEL[choice], glyph, `class="theme-toggle" aria-label="Téma: ${THEME_LABEL[choice]}. Váltás: ${THEME_LABEL[next]}" title="Téma: ${THEME_LABEL[choice]} (váltás: ${THEME_LABEL[next]})"`);
    };
    function header() {
        const learner = !!state.learnerPreview, author = state.mode === 'author', tryStep = author && stepOf(state.view) === 'try' && !!authorPreviewId(state);
        const modeButton = (value, label, name) => `<button type="button" data-mode="${value}" aria-pressed="${state.mode === value}" class="${state.mode === value ? 'active' : ''}">${icon(name)}<span>${label}</span></button>`;
        return `<a class="skip-link" href="#workbench-main">Ugrás a munkaterületre</a><p id="move-help" class="sr-only">Mozgatás: szóköz vagy Enter, majd nyilak, Home vagy End; Enter az elhelyezéshez, Escape a megszakításhoz.</p><div class="sr-only" data-move-status role="status" aria-live="polite"></div><header class="header"><div class="brand"><span class="brand-mark" aria-hidden="true"></span><strong>CodeLine<span class="brand-tail">Sorter</span></strong><small>Studio</small></div>${learner ? '' : `<div class="mode-switch mode-tabs" role="group" aria-label="Munkamód">${modeButton('author', 'Feladat készítése', 'plus')}${modeButton('practice', 'Gyakorlás', 'sort')}</div>`}<div class="header-actions">${learner || tryStep ? tool('data-preview-toggle', learner ? 'Vissza a szerzői nézethez' : 'Tanulói nézet', learner ? 'back' : 'code', 'class="preview-toggle"') : ''}${learner ? '' : sessionMenu()}${themeButton()}${tool('data-fullscreen', '', 'fullscreen', `class="icon-only fullscreen-toggle" aria-pressed="${surface(root) === 'app'}" aria-label="Teljes képernyő" title="${surface(root) === 'app' ? 'Kilépés a teljes képernyőből' : 'Teljes képernyő'}"`)}</div></header><div class="focus-bar"><span class="brand-mark" aria-hidden="true"></span><strong>CodeLine<span class="brand-tail">Sorter</span></strong></div><input type="file" accept="application/json,.json" data-model-file hidden><input type="file" accept="application/json,.json" data-session-file hidden>`;
    }
    /** Pages is a Local Demo (AGENTS.md): the badge always names it; this line says once what that means, until the
     * viewer dismisses it (a per-viewer convenience in local storage; without storage it simply shows). */
    const notice = () => validationMode === 'local-demo' && !demoNoticeSeen() ? `<p class="validation-notice" role="note" data-validation-notice><span>Local Demo / Preview Validation · Helyi demonstráció, nem hitelesített vizsgaeredmény. A jelvény a cím alatt mindig jelzi.</span>${tool('data-dismiss-notice', 'Értem', 'check', 'class="notice-dismiss"')}</p>` : '';
    function help(language) {
        return `<details class="workspace-help" data-memory="workspace-help"><summary>${icon('help')}Súgó: kezelés és billentyűzet</summary><div class="help-body"><p>A sorokat húzással, a sorvégi gombokkal vagy billentyűzettel mozgathatod. A rögzített sorok helye megmarad. ${state.learnerPreview ? 'A Megoldáskódból az Alkalmazás gombbal térhetsz vissza a rendezőbe.' : 'A szerkesztett forrás és JSON csak alkalmazáskor válik aktívvá.'}</p><p><b>Billentyűzet:</b> fókuszálj a sor fogantyújára. Szóköz vagy Enter: felvétel; nyilak, Home, End: célzás; Enter: elhelyezés; Escape: megszakítás. <kbd>Ctrl</kbd> + <kbd>Enter</kbd>: ellenőrzés.</p><p class="formatter-status ${language === 'typescript' || beautifier() ? 'ready' : 'unavailable'}">${languageName(language)} · 5 szóközös élő behúzás · ${language === 'typescript' ? 'TypeScript lexikai formázás' : beautifier() ? 'helyi JS Beautify elérhető' : 'JS Beautify nem érhető el'}</p></div></details>`;
    }
    function authorShell() {
        const step = stepOf(state.view), steps = flowSteps(state), stale = staleReason(state), e = ex(), a = at();
        const here = steps.findIndex(s => s.current);
        const stepper = `<nav class="stepper" aria-label="A feladatkészítés lépései"><ol>${steps.map((s, i) => { const done = i < here && !s.locked && !s.stale && s.tone !== 'blocked'; const status = s.status; return `<li><button type="button" data-step="${s.step}" class="step ${s.current ? 'current' : ''} ${done ? 'done' : ''} ${s.locked ? 'locked' : ''} ${s.stale ? 'stale' : ''} ${s.tone ? 'tone-' + s.tone : ''}" ${s.current ? 'aria-current="step"' : ''} ${s.locked ? `disabled aria-disabled="true" title="${esc(s.locked)}"` : `title="${esc(s.hint)}"`}><span class="step-number" aria-hidden="true">${done ? icon('check') : String(s.number).padStart(2, '0')}</span><span class="step-text"><b>${s.label}</b>${status ? `<small>${status}</small>` : ''}</span></button></li>`; }).join('')}</ol></nav>`;
        const banner = stale && step !== 'source' ? `<div class="draft-notice stale-notice" data-stale-notice role="note"><p>${esc(stale)}</p><div>${authorDraftPending(state) ? tool('data-author-apply', 'Modell újrakészítése', 'reset') + tool('data-author-revert', 'Forrásváltozás elvetése', 'back') : tool('data-open-json', 'JSON megnyitása', 'settings')}</div></div>` : '';
        const body = step === 'source' ? sourceStep() : step === 'rules' ? rulesStep() : e && a ? `<section class="step-panel try-step" aria-labelledby="step-title"><h2 id="step-title" class="sr-only">Próbarendező</h2>${tryPanel(e, a)}<div class="step-nav">${tool('data-goto="rules"', 'Vissza a szabályokhoz', 'back')}</div></section>` : '';
        return `<div class="shell author-shell"><main id="workbench-main" class="author-flow" tabindex="-1">${heading(state.author.title, state.author.language, e?.lines.length)}${notice()}${stepper}${banner}${body}${help(state.author.language)}</main></div>`;
    }
    function practiceShell() {
        const e = ex(), a = at(), trusted = state.exercises.filter(x => !state.previews.has(x.id));
        // ADR-105: on a narrow screen the task list folds into a picker above the task; wide, it is the side list.
        const narrow = typeof matchMedia === 'function' && matchMedia('(max-width: 850px)').matches;
        const library = `<aside class="library" aria-label="Gyakorlófeladatok"><details class="task-picker" data-memory="task-picker" ${narrow ? '' : 'open'}><summary><span>Feladatok</span><b>${esc(e?.title ?? '')}</b></summary><nav aria-label="Feladatok">${createFieldRenderer(trusted, esc, e?.id ?? '')}</nav></details></aside>`;
        const main = e && a ? `<main id="workbench-main" tabindex="-1">${heading(e.title, e.language, e.lines.length, `${e.description ? `<p class="description">${esc(e.description)}</p>` : ''}${tool('data-edit-example', 'Saját feladat ebből', 'plus', 'class="link-action"')}`)}${notice()}${tryPanel(e, a)}${help(e.language)}</main>` : '<main id="workbench-main"><p class="loading">Nincs gyakorlófeladat.</p></main>';
        return `<div class="shell practice-shell">${library}${main}</div>`;
    }
    function learnerShell() {
        const e = ex(), a = at();
        if (!e || !a)
            return '';
        return `<div class="shell learner-shell"><main id="workbench-main" tabindex="-1">${heading(e.title, e.language, e.lines.length, e.description ? `<p class="description">${esc(e.description)}</p>` : '')}${notice()}${tryPanel(e, a)}${help(e.language)}</main></div>`;
    }
    function render() {
        const v = state.view, learner = !!state.learnerPreview, key = continuityKey(state);
        continuity.capture();
        scroll.capture();
        root.classList.toggle('learner-preview', learner);
        root.classList.toggle('author-mode', state.mode === 'author' && !learner);
        root.innerHTML = header() + (learner ? learnerShell() : state.mode === 'practice' ? practiceShell() : authorShell());
        const fill = (selector, value) => { const editor = root.querySelector(selector); if (editor)
            editor.value = value; };
        fill('#author-editor', state.author.source);
        fill('#model-editor', state.modelDraft);
        fill('#code-editor', at()?.draft ?? '');
        refreshAuthorStatus(root, state);
        updateGutters(root);
        drawRuleArcs(root, state);
        root.dataset.renderedExercise = state.active ?? '';
        root.dataset.renderedView = v;
        root.dataset.renderedMode = state.mode;
        scroll.restore(key);
        continuity.restore(key + ':' + v + (v === 'model' ? ':' + (state.rulesView ?? 'visual') : v === 'author' ? ':' + (state.sourceKind ?? 'code') : ''));
    }
    return { render };
}
