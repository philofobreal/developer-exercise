/** Generated browser renderer source. Domain rules remain behind presentation ports; which
 * mode, step and model are shown is the flow's decision (ADR-022). */
import { availability, availabilityAttributes, disabledAttributes } from './availability.js';
import { renderDependencyTable, renderWitness } from './dependency-view.js';
import { createFieldRenderer } from './fields.js';
import { beautifier } from '../formatter.js';
import { validationMode } from './api.js';
import { article, escapeHtml as esc, editorShell, highlight, syncEditors } from './ui-utilities.js';
import { icon } from './icons.js';
import { createViewContinuity } from './continuity.js';
import { installHeaderFit } from './header-fit.js';
import { installListFit } from './list-fit.js';
import { installToolbarFit } from './toolbar-fit.js';
import { installWorkbenchKeyboard, installAuthoringFlows, installMenus, installDisabledGuard } from './interactions.js';
import { installToggletips } from './toggletip.js';
import { authorDraftPending, canUndoReplace, refreshAuthorStatus } from './author-workspace.js';
import { renderInputsContract, renderPreflightSettings, renderSettingsOrigin, renderSourceDiagnostics } from './preflight-settings.js';
import { authorDecisions, createRuleMarks, renderModelInsight, ruleCount, renderRuleCause, renderRuleKinds, renderRulePanel, rulesAvailable, rulesEditable } from './rule-panel.js';
import { drawRuleArcs, renderRuleBoard, renderTryConnecting, renderTryRules, tryRowRuleControls } from './rule-board.js';
import { installPaneSplit, paneSplit, separatorAttributes } from './pane-split.js';
import { authorPreviewId, continuityKey, jsonPending, renderStepper, staleReason, stepOf, tryAdmission } from './flow.js';
import { renderTaskStatus, taskStatus } from './task-status.js';
import { THEME_CHOICES, THEME_LABEL, themeChoice } from './theme.js';
import { CODE_VIEW_LABEL, codeView, viewSwitchesOffered } from './code-view.js';
import { installSurface, surface } from './surface.js';
const DEMO_NOTICE = 'codeline.local-demo-notice';
const demoNoticeSeen = () => { try {
    return localStorage.getItem(DEMO_NOTICE) === 'seen';
}
catch {
    return false;
} };
/** ADR-117 (U1): the one action-button maker. Every button it makes is a .btn; a role (primary, check, link-action, danger)
 * or a shape (icon-only) comes in `extra` as its class and joins .btn, so the geometry has one owner (style.css). */
/** ADR-120: a control's availability as attributes for tool(); disabled ones stay focusable and carry their reason. */
const gate = (answer) => disabledAttributes(answer);
/** A row's own controls (insert, up, down, return) are the code row's component, not action buttons: no .btn (ADR-117). */
const rowTool = (attribute, name, extra) => `<button type="button" ${attribute} ${extra}>${icon(name)}<span></span></button>`;
const tool = (attribute, label, name, extra = '') => {
    const own = /class="([^"]*)"/.exec(extra);
    return `<button type="button" class="btn${own ? ' ' + own[1] : ''}" ${attribute} ${own ? extra.replace(own[0], '') : extra}>${icon(name)}<span>${label}</span></button>`;
};
/** ADR-123 (UI4): the one action bar of a step, sticky at the bottom: back on the left, the state in one sentence, the
 * main action on the right. */
const actionBar = (label, start, status, end) => `<div class="action-bar" role="group" aria-label="${label}"><div class="action-start">${start}</div>${status || '<span class="action-status"></span>'}<div class="action-end">${end}</div></div>`;
const languageName = (language) => language === 'typescript' ? 'TypeScript' : 'JavaScript';
export function createWorkbenchView({ root, state, ex, at, attempt, scroll, format }) {
    const continuity = createViewContinuity(root), fitHeader = installHeaderFit(root), fitLists = installListFit(root), fitToolbar = installToolbarFit(root), tips = installToggletips(root);
    root.addEventListener('click', event => { if (!(event.target instanceof Element) || !event.target.closest('[data-dismiss-notice]'))
        return; try {
        localStorage.setItem(DEMO_NOTICE, 'seen');
    }
    catch { } root.querySelector('[data-validation-notice]')?.remove(); root.querySelector('#workbench-main')?.focus({ preventScroll: true }); });
    installWorkbenchKeyboard(root);
    installDisabledGuard(root);
    installMenus(root);
    installSurface(root, () => render());
    codeView(root);
    paneSplit(root);
    installPaneSplit(root, () => drawRuleArcs(root, state));
    installAuthoringFlows(root, state, render, format);
    addEventListener('resize', () => { drawRuleArcs(root, state); syncEditors(root); });
    // ADR-145 (D5): a narrow screen gathers the header's and the toolbar's rarer tools in a menu each; crossing that
    // width draws the page the other way.
    const narrowScreen = typeof matchMedia === 'function' ? matchMedia('(max-width: 650px)') : null, narrow = () => narrowScreen?.matches === true;
    narrowScreen?.addEventListener('change', () => render({ background: true }));
    // ADR-090: a code list scrolls sideways as one; its rule arcs follow the row controls pinned at its right edge.
    let arcFrame = 0;
    root.addEventListener('scroll', event => { if (arcFrame || !(event.target instanceof HTMLElement) || !event.target.matches('.drop-zone[data-zone]') || !event.target.querySelector(':scope > svg.zone-arcs'))
        return; arcFrame = requestAnimationFrame(() => { arcFrame = 0; drawRuleArcs(root, state); }); }, { capture: true, passive: true });
    function syntax(code, language = ex()?.language ?? state.author.language) { return highlight(code, language); }
    // ── Try: the learner's sorter and solution editor (author step 3, practice, learner preview) ──
    /** ADR-123 (UI4): headings follow the page: h1 the task, h2 the step, h3 a panel. In the author's step a panel is h3;
     * in practice and the learner preview there is no step heading, so it is h2. */
    const paneHeading = () => state.mode === 'author' && !state.learnerPreview ? 'h3' : 'h2';
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
            const actions = tryRowRuleControls(state, id) + (locked ? '<span class="fixed-tag">Rögzített</span>' : blank ? '' : source ? rowTool(`data-move="${i}"`, 'plus', `aria-label="${i + 1}. sor beszúrása" title="Beszúrás az első szabad helyre"`) :
                rowTool(`data-up="${i}"`, 'up', `aria-label="${i + 1}. sor feljebb helyezése" title="Egy hellyel feljebb"`) + rowTool(`data-down="${i}"`, 'down', `aria-label="${i + 1}. sor lejjebb helyezése" title="Egy hellyel lejjebb"`) + rowTool(`data-remove="${i}"`, 'back', `aria-label="${i + 1}. sor visszahelyezése a forráslistába" title="Vissza a felhasználható sorokhoz"`));
            const mark = graded.get(i), diagnosis = mark ? ` diag-${mark.sure ? 'error' : 'possible'}${state.feedbackFocus !== undefined && mark.items.includes(state.feedbackFocus) ? ' diag-focus' : ''}` : '', described = mark ? ` aria-describedby="${mark.items.map(k => 'feedback-' + k).join(' ')}"` : '';
            const picked = !blank && state.rowPick?.list === list && state.rowPick.id === String(id);
            return `<div class="code-row ${source ? 'source-row' : 'solution-row'}${picked ? ' picked' : ''} ${pinned ? 'fixed-row' : ''} ${blank ? 'blank-row' : ''}${blank ? '' : marks(id)}${state.ruleConnect !== undefined && state.ruleConnect === id ? ' connect-source' : ''}${diagnosis}" data-list="${list}" data-index="${i}" data-line-id="${esc(id ?? '')}"${described} role="listitem" draggable="${!blank && !locked}"><button type="button" class="drag-handle" tabindex="${blank || locked ? -1 : 0}" aria-disabled="${blank || locked}" ${blank || locked ? 'disabled' : ''} aria-label="${i + 1}. sor mozgatása" aria-describedby="move-help" title="${locked ? 'Rögzített sor' : blank ? 'Üres hely' : 'Húzd a beszúrás helyére'}">${handle}</button><div class="gutter"><span>${i + 1}</span></div><pre class="code-text"><code>${blank ? ' ' : syntax(raw)}</code></pre><div class="row-actions">${actions}</div></div>`;
        }).join('');
        return `<div class="ide-pane"><div class="drop-zone ${source ? 'source-zone' + (!rows ? ' empty-source' : '') : 'solution-zone'}${state.rowPick ? ' tap-target' : ''}" data-zone="${list}" role="${rows ? 'list' : 'group'}" tabindex="0" aria-label="${source ? 'Felhasználható sorok' : 'Megoldás sorai'}">${rows || `<div class="empty">${icon('check')}<strong>Minden sor a megoldásban</strong><span>A vissza nyíllal bármelyik mozgatható sort visszateheted.</span></div>`}</div></div>`;
    }
    /** ADR-120: while the rule editor waits (one draft at a time), it says so once, above the rules, with what to do. */
    function editPaused() { const answer = availability(state, 'rule-edit'); return answer.state === 'disabled' ? `<p class="edit-paused" role="note" data-edit-paused>${icon('lock')}<span>Szabályszerkesztés szünetel. ${esc(answer.reason)}</span></p>` : ''; }
    /** ADR-118 (M1b): the picked row's actions in the action bar, where the check bar is, so on a touch screen no control
     * covers the code. The same buttons and handlers as the row's own (data-move, data-up, data-down, data-remove); a move
     * keeps the pick on the row (data-keep-pick), Done ends it. Empty when no row of this attempt is picked. */
    function pickBar(a) {
        const pick = state.rowPick;
        if (!pick)
            return '';
        const ids = a[pick.list], i = ids.findIndex(id => id !== null && String(id) === pick.id);
        if (i < 0)
            return '';
        const id = ids[i], answer = pick.list === 'answer';
        const moves = answer ? tool(`data-up="${i}" data-keep-pick`, '', 'up', `class="icon-only" aria-label="${i + 1}. sor feljebb" title="Feljebb"`) + tool(`data-down="${i}" data-keep-pick`, '', 'down', `class="icon-only" aria-label="${i + 1}. sor lejjebb" title="Lejjebb"`) + tool(`data-remove="${i}"`, 'Vissza a sorokhoz', 'back') : tool(`data-move="${i}"`, 'Beszúrás', 'plus', 'title="Beszúrás az első szabad helyre"');
        const rules = rulesAvailable(state) && typeof id === 'number' ? tool(`data-rule-line="${id}"`, 'Sor szabályai', 'link') : '';
        // ADR-118 (amended): the row's connections, as the row's own circle on a pointer screen: mark them, hide them, or with
        // another row's connections marked, add or remove the rule between the two (a rule edit, so it waits as one, ADR-120).
        const anchor = state.ruleConnect;
        const connect = !rulesEditable(state) || typeof id !== 'number' ? '' : anchor === undefined ? tool(`data-rule-connect="${id}" data-keep-pick`, 'Kapcsolatok', 'connect', 'aria-pressed="false" title="A sor kapcsolatainak megjelölése: kék előtte, borostyán utána"')
            : anchor === id ? tool(`data-rule-connect="${id}" data-keep-pick`, 'Kapcsolatok elrejtése', 'connect', 'aria-pressed="true"')
                : tool(`data-rule-connect="${id}"`, `Kapcsolat ${article(anchor)} #${anchor} sorral`, 'connect', disabledAttributes(availability(state, 'rule-edit')) + ` title="Szabály létrehozása vagy törlése ${article(anchor)} #${anchor} és e sor között"`);
        // NY-27: on a phone a long row shows only its start in the list; the bar shows the picked row whole, wrapped.
        const code = (answer ? attempt.formattedAnswer()[i] : attempt.text(id ?? null)) ?? '';
        return `<div class="evaluation-bar pick-bar" role="toolbar" aria-label="A kijelölt sor műveletei"><p class="pick-status">${answer ? `A megoldás ${i + 1}. sora` : 'Felhasználható sor'} kijelölve. Koppints a helyére, vagy:</p><code class="pick-code" data-pick-code>${syntax(code.trim())}</code><div class="pick-actions">${moves}${rules}${connect}${tool('data-unpick', 'Kész', 'check', 'class="primary"')}</div></div>`;
    }
    function sortView(e, a) {
        const pane = paneHeading(), filled = a.answer.filter(id => id !== null).length;
        // ADR-107, ADR-146: the two lists with a movable separator; the rule inspector docks beside them only on request,
        // behind a separator of its own.
        const rules = rulesAvailable(state), open = rules && !!state.rulePanelOpen;
        const separator = `<div class="pane-split" ${separatorAttributes(root, 'lists')} aria-controls="pool-pane answer-pane" aria-label="A két lista szélessége: balra vagy jobbra nyíllal állítható" title="Húzd a két lista szélességének állításához"></div>`;
        const inspector = open ? `<div class="pane-split rules-split" ${separatorAttributes(root, 'rules')} aria-controls="try-rule-panel" aria-label="A szabálypanel szélessége: balra vagy jobbra nyíllal állítható" title="Húzd a szabálypanel szélességének állításához"></div><aside id="try-rule-panel" class="rule-inspector" aria-labelledby="inspector-title"><div class="inspector-head"><${pane} id="inspector-title">${icon('link')}Sor szabályai</${pane}>${tool('data-rule-panel-toggle', '', 'close', 'class="icon-only" aria-label="Szabálypanel bezárása" title="Bezárás (Escape)"')}</div>${rulesEditable(state) ? editPaused() : ''}${renderTryRules(state)}<div class="try-rule-panel">${renderRulePanel(state)}</div></aside>` : '';
        return `${renderTryConnecting(state)}<div class="try-body${open ? ' with-inspector' : ''}"><div class="panes"${rules ? ' data-try-rules' : ''}><section id="pool-pane" class="pane pool-pane" aria-labelledby="source-title"><div class="panel-title"><div><${pane} id="source-title">Felhasználható sorok</${pane}><span class="count">${a.pool.length}</span></div><div class="pane-clipboard">${tool('data-copy-pool', '', 'copy', 'class="icon-only" aria-label="Másolás: a felhasználható sorok a vágólapra" title="Másolás"')}</div></div>${zone(e, a, 'pool')}</section>${separator}<section id="answer-pane" class="pane answer-pane" aria-labelledby="solution-title"><div class="panel-title"><div><${pane} id="solution-title">Megoldás</${pane}><span class="count">${filled}/${a.answer.length}</span><progress data-arrangement-progress max="${e.lines.length}" value="${filled}" aria-label="Elhelyezett sorok">${filled}/${e.lines.length}</progress></div><div class="pane-clipboard">${tool('data-copy-arrangement data-copy-solution', '', 'copy', 'class="icon-only" aria-label="Másolás: az összerendezett megoldás a vágólapra" title="Másolás"')}${tool('data-paste-solution', '', 'paste', 'class="icon-only" aria-label="Beillesztés: megoldás a vágólapról a rendezőbe" title="Beillesztés"')}</div></div>${zone(e, a, 'answer')}</section></div>${inspector}</div>`;
    }
    function editView(e, a) {
        const pane = paneHeading(), stale = a.editorDirty && a.editorGeneration !== a.generation;
        return `<section class="solution-editor" aria-labelledby="editor-title"><div class="editor-heading"><${pane} id="editor-title">Megoldáskód</${pane}><span data-editor-status class="context-label ${a.editorDirty ? 'pending' : ''}">${a.editorDirty ? 'Nem alkalmazott változat' : 'A rendező aktuális állapota'}</span><div class="editor-tools">${tool('data-copy-editor', '', 'copy', 'class="icon-only" aria-label="Másolás: a szerkesztett megoldás a vágólapra" title="Másolás"')}${tool('data-paste-editor', '', 'paste', 'class="icon-only" aria-label="Beillesztés: megoldás a vágólapról a szerkesztőbe" title="Beillesztés"')}</div></div>${stale ? '<p class="draft-notice" role="note">A rendező a szerkesztés óta módosult. Az Alkalmazás ezt a szerkesztett változatot helyezi át a rendezőbe.</p>' : ''}<div class="ide-pane">${editorShell('code-editor', 'code', e.language)}</div><div class="editor-actions">${tool('data-format', 'Formázás', 'code')}${tool('data-editor-reload', 'Kód frissítése a rendezőből', 'reset', 'title="A szerkesztett megoldás elvetése és az aktuális rendező betöltése"')}${tool('data-apply', 'Megoldás alkalmazása', 'arrow', 'class="primary"')}</div></section>`;
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
            return `<li id="feedback-${k}" class="feedback-item severity-${d.severity} certainty-${d.certainty}" data-feedback-item="${k}"><p class="feedback-summary"><b>${esc(d.summary)}</b></p><p>${esc(d.detail)}</p>${d.reasons?.length ? `<p class="feedback-reasons">${esc(d.reasons.join(' '))}</p>` : ''}${d.fix ? `<p class="feedback-fix"><b>${fixLabel[d.fix.level]}:</b> ${esc(d.fix.text)}</p>` : ''}${author ? `<p class="feedback-evidence">Bizonyíték: ${esc(d.evidence)}${d.limits ? ` Korlát: ${esc(d.limits)}` : ''}</p>` : ''}${rows.length ? `<button type="button" class="btn link-action" data-feedback-goto="${k}">Ugrás: ${rows.map(row => row + '.').join(', ')} sor${d.positionScope === 'some' ? ' (ezek egyike)' : ''}</button>` : ''}</li>`;
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
    const sessionTools = () => `${tool('data-save-local', 'Mentés a böngészőbe', 'save')}${tool('data-load-local', 'Mentett munka megnyitása', 'reset', availabilityAttributes(state, 'load-local'))}${tool('data-export-session', 'Exportálás fájlba…', 'download', 'aria-label="Exportálás fájlba: a munkamenet letöltése"')}${tool('data-import-session', 'Importálás fájlból…', 'upload', 'aria-label="Importálás fájlból: munkamenet megnyitása"')}<small>A böngészőbe mentett munka csak ezen az eszközön érhető el; hitelesített eredményt nem tartalmaz.</small>`;
    function sessionMenu() {
        return `<details class="menu session-menu"><summary aria-label="Munkamenet: mentés és megnyitás" title="Munkamenet">${icon('save')}<span>Munkamenet</span></summary><div class="menu-panel" role="group" aria-label="Munkamenet">${sessionTools()}</div></details>`;
    }
    /** ADR-145 (D5): on a narrow screen the header's session menu and theme button are one menu behind one icon: rows
     * with an icon and the whole label, the theme a choice of three (the button alone cycled, and did not say what comes).
     * It keeps the session menu's name, so what opens that menu finds it either way. */
    function appMenu() {
        const choice = themeChoice(), parts = THEME_CHOICES.map(value => `<button type="button" data-theme-set="${value}" aria-pressed="${choice === value}" class="${choice === value ? 'active' : ''}">${THEME_LABEL[value]}</button>`).join('');
        return `<details class="menu session-menu app-menu"><summary aria-label="Menü: munkamenet és megjelenés" title="Menü">${icon('menu')}</summary><div class="menu-panel" role="group" aria-label="Menü"><p class="menu-heading">Munkamenet</p>${sessionTools()}<hr class="menu-rule"><p class="menu-heading" id="theme-choice-label">Megjelenés</p><div class="segment theme-choice" role="group" aria-labelledby="theme-choice-label">${parts}</div></div></details>`;
    }
    /** Rendező | Megoldáskód: the only tabs left; the steps are not tabs. ADR-133: they, and the Kódnézet switch, are
     *  drawn only when the view switches are on; otherwise the workspace is the sorter alone, without a tab list. */
    function tryPanel(e, a, { actions = true, helpBelow = false } = {}) {
        const switches = viewSwitchesOffered(), v = switches && state.view === 'edit' ? 'edit' : 'sort', tab = (view, label, name) => `<button type="button" id="tab-${view}" role="tab" data-view="${view}" aria-controls="panel-try" aria-selected="${v === view}" tabindex="${v === view ? 0 : -1}" class="${v === view ? 'active' : ''}">${icon(name)}<span>${label}</span>${view === 'edit' && a.editorDirty ? '<span class="dirty-dot" aria-label="Nem alkalmazott változtatás"></span>' : ''}</button>`;
        // ADR-106: the code view (editor or cards) and the focus surface sit with the workspace they change.
        const view = codeView(root), focused = surface(root) === 'focus', styles = switches && v === 'sort' ? `<div class="segment code-view-switch" role="group" aria-label="Kódnézet">${['editor', 'cards'].map((value) => `<button type="button" data-set-code-view="${value}" aria-pressed="${view === value}" class="${view === value ? 'active' : ''}" title="Kódnézet: ${CODE_VIEW_LABEL[value]}">${icon(value === 'editor' ? 'rows' : 'cards')}<span>${CODE_VIEW_LABEL[value]}</span></button>`).join('')}</div>` : '';
        // ADR-145 (D5): on a narrow screen a tool shows its label where the row has room for it: the tool the step is about
        // first (rank 1), the others after it (rank 2); toolbar-fit measures. Újrakezdés and the way to the help under the
        // lists, the two rarely needed, wait behind one icon where there are two of them.
        const compact = actions && narrow(), rules = v === 'sort' && rulesAvailable(state), fills = actions && !state.learnerPreview;
        const rank = (first) => compact ? ` data-label-rank="${first ? 1 : 2}"` : '';
        const focus = tool('data-focus', focused ? 'Kilépés' : 'Fókusz', focused ? 'exit' : 'focus', `class="focus-toggle" aria-pressed="${focused}" title="${focused ? 'Kilépés a fókusz módból (Escape)' : 'Fókusz mód: csak a kódfelület, a lehető legnagyobb méretben'}"${rank(!rules && !fills)}`);
        const inspect = rules ? tool('data-rule-panel-toggle', 'Sor szabályai', 'link', `class="inspector-toggle" aria-pressed="${!!state.rulePanelOpen}" aria-expanded="${!!state.rulePanelOpen}" aria-controls="try-rule-panel" title="${state.rulePanelOpen ? 'Szabálypanel bezárása' : rulesEditable(state) ? 'Szabálypanel: a kijelölt sor szabályai és szerkesztésük' : 'Szabálypanel: a kijelölt sor szabályai'}"${rank(true)}`) : '';
        const more = compact && helpBelow, reset = actions ? tool('data-reset', 'Újrakezdés', 'reset', gate(availability(state, 'reset', a)) + (more ? '' : rank(false))) : '', fill = fills ? tool('data-all', 'Mintamegoldás kitöltése', 'file', rank(!rules)) : '';
        const tools = more ? `${fill}${inspect}${focus}<details class="menu more-menu"><summary aria-label="További eszközök" title="További eszközök">${icon('more')}</summary><div class="menu-panel" role="group" aria-label="További eszközök">${reset}${tool('data-workspace-help', 'Súgó: kezelés és billentyűzet', 'help')}</div></details>` : `${reset}${fill}${inspect}${focus}`;
        const start = switches ? `<div class="toolbar-start"><div class="segment try-tabs" role="tablist" aria-label="Megoldás">${tab('sort', 'Rendező', 'sort')}${tab('edit', 'Megoldáskód', 'edit')}</div>${styles}</div>` : '';
        // ADR-146: the tools and the panels they work on are one frame; the result bar and the note stand under it.
        return `<div class="workspace"><div class="toolbar">${start}<div class="workspace-actions">${tools}</div></div><div id="panel-try"${switches ? ` role="tabpanel" aria-labelledby="tab-${v}"` : ''}>${v === 'edit' ? editView(e, a) : sortView(e, a)}</div></div>${v === 'sort' ? pickBar(a) || reportView(e, a) : ''}<p class="note" role="status" aria-live="polite">${esc(a.feedback || '')}</p>`;
    }
    // ── Author step 1: the reference source (code or a whole CodeLine JSON) ──
    function jsonBlock(context) {
        const m = authorPreviewId(state) ? state.authorModel : undefined, dirty = jsonPending(state);
        const refresh = context === 'rules' && m ? `<div class="draft-notice" data-dependency-refresh><p>${m.authoring?.strategy === 'ast-hierarchy' && !m.authoring.dependencyPolicy ? 'Régebbi generált modell: a változatlan JSON a korábbi sorfüggőségeket használja. A dependencyHints csak tájékoztató. ' : ''}Az újraszámítás az itt látható JSON kódsorai alapján lecseréli a generált sorfüggőségeket. A kód, a sor-ID-k, a fixed helyek, a blokkok, a szerzői szabályok és a profilok megmaradnak; a jelentés a Minősítés alatt jelenik meg.</p>${tool('data-model-refresh', 'Sorfüggőségek újraszámítása', 'code')}</div>` : '';
        return `${context === 'rules' ? renderDependencyTable(m) : ''}${refresh}<div class="editor-heading"><h3>CodeLine JSON</h3><span data-model-status class="context-label ${dirty ? 'pending' : ''}">${dirty ? 'Nem alkalmazott JSON' : m ? 'Aktív modell' : 'Új feladat JSON-ból'}</span><div class="editor-tools">${tool('data-copy-model', 'JSON másolása', 'copy', 'aria-label="JSON másolása: a modell a vágólapra"')}${tool('data-paste-model', 'Beillesztés', 'paste', 'aria-label="Beillesztés: JSON-modell a vágólapról"')}${tool('data-import-model', 'JSON megnyitása…', 'upload')}${m ? tool('data-export-model', 'JSON exportálása…', 'download') : ''}</div></div><div class="ide-pane">${editorShell('model-editor', 'model')}</div><div class="editor-actions"><p class="inline-hint">A scopeId, functionBlock és blocks mezőknek konzisztensnek kell maradniuk.</p>${tool('data-model-apply', 'JSON alkalmazása', 'arrow', 'class="primary"')}</div><p class="author-status" data-model-message role="status" aria-live="polite">${esc(state.modelMessage || 'Hibás modellnél a korábbi aktív állapot megmarad.')}</p>`;
    }
    /** Author step 1 (ADR-105): what the exercise is (title, language, level, description) in one block; the
     * analysis settings fold away with their current values in the summary; opening a source is one menu. */
    function sourceStep() {
        const a = state.author, kind = state.sourceKind === 'json' ? 'json' : 'code', trusted = state.exercises.filter(e => !state.previews.has(e.id));
        const kindTab = (value, label) => `<button type="button" data-source-kind="${value}" aria-pressed="${kind === value}" class="${kind === value ? 'active' : ''}">${label}</button>`;
        const option = (value, current, label) => `<option value="${value}" ${current ? 'selected' : ''}>${label}</option>`;
        const open = `<details class="menu open-menu"><summary>${icon('folder')}<span>Megnyitás</span></summary><div class="menu-panel" role="group" aria-label="Forrás megnyitása"><label>Példa<select data-start-example title="A választott példa azonnal betöltődik; a Visszavonás visszahozza a korábbi forrást."><option value="">Válassz példát…</option>${trusted.map(e => `<option value="${esc(e.id)}">${esc(e.title)} · ${languageName(e.language)}</option>`).join('')}</select></label>${tool('data-import-source', 'Forrásfájl megnyitása…', 'upload')}${tool('data-author-sample', 'TypeScript minta (436 sor)', 'file')}<a class="menu-link" data-typescript-catalog href="./samples/typescript/index.html" target="_blank" rel="noopener">TypeScript példatár ↗</a></div></details>`;
        const settings = renderPreflightSettings(a, state.authorPolicy, 'source');
        // ADR-123 (M5): the Kód step is about the source: its language, how it is checked, the editor. The learner-facing
        // title, description and level are set in the Próba és kiadás step; the analysis settings in Elemzés és szabályok.
        const code = `<div class="form-grid source-meta"><label>Nyelv<select data-author="language">${option('javascript', a.language === 'javascript', 'JavaScript')}${option('typescript', a.language === 'typescript', 'TypeScript')}</select></label></div>${settings}<input type="file" data-source-file accept=".js,.mjs,.ts,.txt,text/plain" hidden><div class="editor-heading"><h3>Referenciaforrás</h3><span data-author-status class="context-label ${authorDraftPending(state) ? 'pending' : ''}"></span><div class="editor-tools">${tool('data-author-format', 'Formázás', 'code', 'class="labeled-tool" title="Formázás: 5 szóközös behúzás, a szintaxis ellenőrzésével"')}${tool('data-copy-author', '', 'copy', 'class="icon-only" aria-label="Másolás: a forráskód a vágólapra" title="Másolás"')}${tool('data-paste-author', '', 'paste', 'class="icon-only" aria-label="Beillesztés: forráskód a vágólapról" title="Beillesztés"')}</div></div><div class="ide-pane">${editorShell('author-editor', 'code', a.language)}</div>${renderSourceDiagnostics(state.sourceGate?.gate, !!state.sourceGate && state.sourceGate.source !== a.source)}${actionBar('A Kód lépés műveletei', authorDraftPending(state) ? tool('data-author-revert', 'Változtatások elvetése', 'reset', 'title="Vissza ahhoz a forráshoz, amelyből az aktív modell készült"') : '', `<p class="author-status action-status" role="status" aria-live="polite">${esc(a.message || 'A Modell készítése megvizsgálja a forrást, majd elkészíti a sorokat és a szabályokat.')}${canUndoReplace(state) ? tool('data-author-undo', 'Visszavonás', 'back', 'class="link-action" title="A betöltés előtti forrás visszaállítása"') : ''}</p>`, tool('data-author-check', 'Forrás vizsgálata', 'check', availabilityAttributes(state, 'author-check')) + tool('data-author-apply', 'Modell készítése', 'arrow', availabilityAttributes(state, 'author-apply') + ' class="primary"'))}`;
        return `<section class="author step-panel" aria-labelledby="step-title"><div class="section-bar"><h2 id="step-title">Kód</h2><div class="section-actions"><div class="segment source-kind" role="group" aria-label="A forrás fajtája">${kindTab('code', 'Forráskód')}${kindTab('json', 'CodeLine JSON')}</div>${kind === 'code' ? open : ''}</div></div>${kind === 'json' ? jsonBlock('source') : code}</section>`;
    }
    // ── Author step 2: rules (visual board with the rule panel, or the JSON) ──
    /** ADR-055: the analysis settings the model records, so the rules read in their light. */
    function analysisSettings(m) {
        const environment = m?.authoring?.evidence?.environment;
        if (!environment)
            return '';
        return `<div class="analysis-settings" data-analysis-settings>${renderInputsContract(environment)}<span>Objektumkulcsok sorrendje: <b>${environment.keyOrder === 'ignored' ? 'nem számít' : 'számít'}</b></span><span>Osztálymezők: <b>${environment.classFields === 'define' ? 'csak szabványos' : 'mindkét mód'}</b></span><span class="inline-hint">A modell ezzel a környezettel készült.</span></div>`;
    }
    function rulesStep() {
        const m = state.authorModel, v = state.rulesView === 'json' ? 'json' : 'visual', verification = state.authorInsight?.verification;
        const tab = (value, label, name) => `<button type="button" role="tab" id="rules-tab-${value}" data-rules-view="${value}" aria-controls="rules-panel" aria-selected="${v === value}" tabindex="${v === value ? 0 : -1}" class="${v === value ? 'active' : ''}">${icon(name)}<span>${label}</span>${value === 'json' && jsonPending(state) ? '<span class="dirty-dot" aria-label="Nem alkalmazott JSON"></span>' : ''}</button>`;
        const visual = `${editPaused()}${renderRuleKinds(state)}<div class="rules-layout"><div class="rules-main">${renderRuleBoard(state, code => syntax(code, m?.language))}</div><aside class="rules-side" data-scroll-memory="rules-side" aria-label="A kijelölt sor szabályai">${renderRulePanel(state)}</aside></div><details class="insight-details" data-memory="model-insight" open><summary>Minősítés</summary>${renderModelInsight(state.authorInsight, m)}</details>`;
        return `<section class="author step-panel" aria-labelledby="step-title"><div class="section-bar"><h2 id="step-title">Elemzés és szabályok</h2><div class="section-actions">${verification ? `<span class="verification-badge status-${verification.status}" data-step-verification>${{ 'analysis-verified': 'Elemzéssel igazolt', conservative: 'Konzervatív', 'author-modified': 'Szerzői döntéssel módosított', unverified: 'Nem igazolt' }[verification.status]}</span>` : ''}<div class="segment rules-tabs" role="tablist" aria-label="Szabályszerkesztő">${tab('visual', 'Vizuális', 'link')}${tab('json', 'JSON', 'settings')}</div></div></div>${renderTaskStatus(state)}<div class="model-overview"><span><b>${m?.lines.length ?? 0}</b> kódsor</span><span><b>${m?.blocks.length ?? 0}</b> blokk</span><span><b>${ruleCount(state.authorInsight)}</b> nem szerkezeti szabály</span><p>${esc(state.modelMessage || 'A szabály részleges rend: az előzménynek bárhol előbb kell állnia. A módosítás azonnal érvényes.')}</p></div>${analysisSettings(m)}${renderPreflightSettings(state.author, state.authorPolicy, 'analysis')}${renderSettingsOrigin(state.settingsOrigin)}${m?.authoring?.note ? `<p class="draft-notice" data-ordering-policy>${esc(m.authoring.note)}</p>` : ''}<div id="rules-panel" role="tabpanel" aria-labelledby="rules-tab-${v}">${v === 'json' ? jsonBlock('rules') : visual}</div>${rulesActionBar()}</section>`;
    }
    /** ADR-123 (UI4): the Rules step's action bar: back to the code, the next step in one sentence, on to the try. The
     * task status decides which way is the one to take (primary); a refused try says why instead of failing on a click. */
    function rulesActionBar() {
        const status = taskStatus(state), admission = tryAdmission(state), toSource = status?.next.action === 'source';
        const back = tool('data-goto="source"', 'Vissza a kódhoz', 'back', toSource ? 'class="primary"' : ''), next = tool('data-goto="try"', 'Tovább a próbához', 'arrow', (toSource ? '' : 'class="primary"') + (admission.ok ? '' : disabledAttributes({ state: 'disabled', reason: admission.message })));
        return actionBar('Az Elemzés és szabályok lépés műveletei', back, status ? `<p class="action-status" data-task-next><b>Következő lépés:</b> ${esc(status.next.text)}</p>` : '', next);
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
        const modeButton = (value, label, name) => `<button type="button" data-mode="${value}" aria-pressed="${state.mode === value}" class="${state.mode === value ? 'active' : ''}" title="${label}">${icon(name)}<span>${label}</span></button>`;
        return `<a class="skip-link" href="#workbench-main">Ugrás a munkaterületre</a><p id="move-help" class="sr-only">Mozgatás: szóköz vagy Enter, majd nyilak, Home vagy End; Enter az elhelyezéshez, Escape a megszakításhoz.</p><div class="sr-only" data-move-status role="status" aria-live="polite"></div><header class="header"><div class="brand"><span class="brand-mark" aria-hidden="true"></span><strong>CodeLine<span class="brand-tail">Sorter</span></strong><small>Editor</small></div>${learner ? '' : `<div class="mode-switch mode-tabs" role="group" aria-label="Munkamód">${modeButton('author', 'Feladat készítése', 'plus')}${modeButton('practice', 'Gyakorlás', 'sort')}</div>`}<div class="header-actions">${learner || tryStep ? tool('data-preview-toggle', learner ? 'Vissza a szerzői nézethez' : 'Tanulói nézet', learner ? 'back' : 'code', 'class="preview-toggle"') : ''}${learner ? themeButton() : narrow() ? appMenu() : sessionMenu() + themeButton()}${tool('data-fullscreen', '', 'fullscreen', `class="icon-only fullscreen-toggle" aria-pressed="${surface(root) === 'app'}" aria-label="Teljes képernyő" title="${surface(root) === 'app' ? 'Kilépés a teljes képernyőből' : 'Teljes képernyő'}"`)}</div></header><div class="focus-bar"><span class="brand-mark" aria-hidden="true"></span><strong>CodeLine<span class="brand-tail">Sorter</span></strong></div><input type="file" accept="application/json,.json" data-model-file hidden><input type="file" accept="application/json,.json" data-session-file hidden>`;
    }
    /** Pages is a Local Demo (AGENTS.md): the badge always names it; this line says once what that means, until the
     * viewer dismisses it (a per-viewer convenience in local storage; without storage it simply shows). */
    const notice = () => validationMode === 'local-demo' && !demoNoticeSeen() ? `<p class="validation-notice" role="note" data-validation-notice><span>Local Demo / Preview Validation · Helyi demonstráció, nem hitelesített vizsgaeredmény. A jelvény a cím alatt mindig jelzi.</span>${tool('data-dismiss-notice', 'Értem', 'check', 'class="notice-dismiss"')}</p>` : '';
    function help(language) {
        return `<details class="workspace-help" data-memory="workspace-help"><summary>${icon('help')}Súgó: kezelés és billentyűzet</summary><div class="help-body"><p>A sorokat húzással, a sorvégi gombokkal vagy billentyűzettel mozgathatod. A rögzített sorok helye megmarad. ${state.learnerPreview ? viewSwitchesOffered() ? 'A Megoldáskódból az Alkalmazás gombbal térhetsz vissza a rendezőbe.' : '' : 'A szerkesztett forrás és JSON csak alkalmazáskor válik aktívvá.'}</p><p><b>Billentyűzet:</b> fókuszálj a sor fogantyújára. Szóköz vagy Enter: felvétel; nyilak, Home, End: célzás; Enter: elhelyezés; Escape: megszakítás. <kbd>Ctrl</kbd> + <kbd>Enter</kbd>: ellenőrzés.</p><p><a class="help-link" href="./help/index.html" target="_blank" rel="noopener">A teljes súgó: beállítások, minősítés, leletek, ellenőrzött példákkal${icon('external')}<span class="sr-only"> (új lapon)</span></a></p><p class="formatter-status ${language === 'typescript' || beautifier() ? 'ready' : 'unavailable'}">${languageName(language)} · 5 szóközös élő behúzás · ${language === 'typescript' ? 'TypeScript lexikai formázás' : beautifier() ? 'helyi JS Beautify elérhető' : 'JS Beautify nem érhető el'}</p></div></details>`;
    }
    /** ADR-123 (M5): what the learner reads (title, description, level) and the way out (export), beside the try where it
     * is seen; changing it is no reanalysis (setLearnerData). */
    function learnerData() {
        const a = state.author, option = (value, label) => `<option value="${value}"${(a.level || '') === value ? ' selected' : ''}>${label}</option>`;
        // ADR-147: how much the learner is told is the author's choice for this exercise; the rule panel is its third level.
        const told = (value, label) => `<option value="${value}"${(a.learnerFeedback ?? 'positions') === value ? ' selected' : ''}>${label}</option>`;
        return `<details class="panel learner-data" data-memory="learner-data"><summary>Tanulói adatok és kiadás</summary><div class="form-grid"><label class="span-2">Cím<input data-learner="title" value="${esc(a.title)}" maxlength="140" autocomplete="off"></label><label>Szint<select data-learner="level">${option('', 'Nincs megadva')}${option('beginner', 'Kezdő')}${option('intermediate', 'Közepes')}${option('advanced', 'Haladó')}</select></label><label class="span-all">Feladatleírás<input data-learner="description" value="${esc(a.description)}" maxlength="500" autocomplete="off"></label><label class="span-all">Mit lát a tanuló egy hibás megoldásról?<select data-learner="learnerFeedback">${told('positions', 'Csak azt, hogy melyik helyen van hiba')}${told('rules', 'A megsértett szabály két sorát is')}${told('graph', 'A megsértett szabály két sorát, és az első ellenőrzés után megnyithatja a „Sor szabályai” panelt')}</select></label></div><p class="inline-hint">A tanulónak szól; módosítása nem igényel újraelemzést. A szabályok okát a tanuló egyik szinten sem látja.</p><div class="learner-actions">${tool('data-export-model', 'JSON exportálása…', 'download')}</div></details>`;
    }
    function authorShell() {
        const step = stepOf(state.view), stale = staleReason(state), e = ex(), a = at();
        const stepper = renderStepper(state);
        // ADR-123: a rebuild from the source discards the author's own rule decisions; the banner says so before the click.
        const decisions = authorDraftPending(state) ? authorDecisions(state.authorInsight) : 0, loss = decisions ? ` <b data-rebuild-loss>A modell újrakészítése elveti ${article(decisions)} ${decisions} kézi szabálydöntést</b> (szűkítés, rögzítés, profil vagy feloldás).` : '';
        const banner = stale && step !== 'source' ? `<div class="draft-notice notice tone-warning stale-notice" data-stale-notice role="note"><p>${esc(stale)}${loss}</p><div>${authorDraftPending(state) ? tool('data-author-apply', 'Modell újrakészítése', 'reset') + tool('data-author-revert', 'Változtatások elvetése', 'back') : tool('data-open-json', 'JSON szerkesztése', 'settings')}</div></div>` : '';
        const body = step === 'source' ? sourceStep() : step === 'rules' ? rulesStep() : e && a ? `<section class="step-panel try-step" aria-labelledby="step-title"><h2 id="step-title" class="sr-only">Próba és kiadás</h2>${tryPanel(e, a)}${learnerData()}<div class="step-nav">${tool('data-goto="rules"', 'Vissza a szabályokhoz', 'back')}</div></section>` : '';
        return `<div class="shell author-shell"><main id="workbench-main" class="author-flow" tabindex="-1"><div class="context-bar">${heading(state.author.title, state.author.language, e?.lines.length)}${stepper}</div>${notice()}${banner}${body}${help(state.author.language)}</main></div>`;
    }
    function practiceShell() {
        const e = ex(), a = at(), trusted = state.exercises.filter(x => !state.previews.has(x.id));
        // ADR-105: on a narrow screen the task list folds into a picker above the task; wide, it is the side list.
        // ADR-116: a phone on its side is narrow too (the same query as the stylesheet); wide, the list shows even when closed.
        const narrow = typeof matchMedia === 'function' && matchMedia('(max-width: 850px), (max-height: 500px) and (orientation: landscape)').matches;
        const library = `<aside class="library" aria-label="Gyakorlófeladatok"><details class="task-picker" data-memory="task-picker" ${narrow ? '' : 'open'}><summary><span>Feladatok</span><b>${esc(e?.title ?? '')}</b></summary><nav aria-label="Feladatok">${createFieldRenderer(trusted, esc, e?.id ?? '')}</nav></details></aside>`;
        const main = e && a ? `<main id="workbench-main" tabindex="-1">${heading(e.title, e.language, e.lines.length, `${e.description ? `<p class="description">${esc(e.description)}</p>` : ''}${tool('data-edit-example', 'Saját feladat ebből', 'plus', 'class="link-action"')}`)}${notice()}${tryPanel(e, a, { helpBelow: true })}${help(e.language)}</main>` : '<main id="workbench-main"><p class="loading">Nincs gyakorlófeladat.</p></main>';
        return `<div class="shell practice-shell">${library}${main}</div>`;
    }
    function learnerShell() {
        const e = ex(), a = at();
        if (!e || !a)
            return '';
        return `<div class="shell learner-shell"><main id="workbench-main" tabindex="-1">${heading(e.title, e.language, e.lines.length, e.description ? `<p class="description">${esc(e.description)}</p>` : '')}${notice()}${tryPanel(e, a, { helpBelow: true })}${help(e.language)}</main></div>`;
    }
    /** `background`: the render answers something the reader did not just do (ADR-136): an open menu stays open. */
    function render({ background = false } = {}) {
        const v = state.view, learner = !!state.learnerPreview, key = continuityKey(state);
        continuity.capture({ background });
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
        syncEditors(root);
        drawRuleArcs(root, state);
        root.dataset.renderedExercise = state.active ?? '';
        root.dataset.renderedView = v;
        root.dataset.renderedMode = state.mode;
        fitHeader();
        fitToolbar();
        fitLists();
        scroll.restore(key);
        continuity.restore(key + ':' + v + (v === 'model' ? ':' + (state.rulesView ?? 'visual') : v === 'author' ? ':' + (state.sourceKind ?? 'code') : ''));
        tips.rendered({ background });
    }
    return { render };
}
