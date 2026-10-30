import { escapeHtml as esc } from './ui-utilities.js';
import { icon } from './icons.js';
const editabilityLabel = { hard: 'Szerkezeti', proven: 'Bizonyított', conservative: 'Konzervatív', pedagogical: 'Szerzői', legacy: 'Ismeretlen eredetű' };
const categoryLabel = { structure: 'szerkezet', unit: 'egység', data: 'adatfüggés', effect: 'hatás', policy: 'sorrendpolitika', conservative: 'konzervatív becslés', author: 'szerzői szabály', unknown: 'ismeretlen eredet' };
const statusLabel = { 'analysis-verified': 'Elemzéssel igazolt', conservative: 'Konzervatív', 'author-modified': 'Szerzői döntéssel módosított', unverified: 'Nem igazolt' };
const basisLabel = { checked: 'ellenőrizve', tested: 'tesztelt (generátor)', 'not-established': 'nem megállapított', refuted: 'cáfolt' };
const auditLabel = { ok: 'Nincs nyelvi hiba ebben az egyfájlos kontextusban.', errors: 'A referencia nyelvi hibát tartalmaz.', unverifiable: 'Projektkontextus nélkül nem ellenőrizhető.', 'not-run': 'A nyelvi audit nem futott (a statikus demó nem tartalmaz szabványos könyvtárat).' };
const refreshOutcome = { reapplied: 'újra alkalmazva', revoked: 'visszavonva: az új elemzés erősebb kényszert talált', implied: 'már csak tranzitív következmény', obsolete: 'tárgytalan: nincs már ilyen kényszer',
    reconfirm: 'nincs alkalmazva: a forrás megváltozott a jóváhagyás óta, ezért a kényszer visszakerült; ha a lazítás továbbra is helyes, távolítsd el újra megerősítéssel',
    unchecked: 'újra alkalmazva, de régi lazítás: nem tudni, milyen forrásra hagyták jóvá; mostantól a forrás változását figyeli' };
const effectLabel = { yes: 'igen', no: 'nem (bizonyítva)', maybe: 'nem eldöntött (korlátos tanúkeresés)' };
const provenanceNotice = { complete: '', partial: 'Néhány szabálynak nincs ismert oka; ezek ismeretlen eredetűként jelennek meg.',
    absent: 'A modellnek nincs provenienciája: régi vagy importált modell, vagy olyan nagy, hogy a generátor nem menti az okokat. Minden generált szabály ismeretlen eredetű, ezért eltávolításuk policy-felülírást kér. Az Adatmodell nézet „Sorfüggőségek újraszámítása” gombja újra levezeti az okokat.',
    unbound: 'A proveniencia nem ezekhez a sorokhoz tartozik, mert a kód a generálás óta változott. Minden generált szabály ismeretlen eredetű, amíg az Adatmodell nézet „Sorfüggőségek újraszámítása” gombja újra nem köti.' };
const snippet = (code, limit = 120) => esc(code.length > limit ? code.slice(0, limit - 1) + '…' : code);
const badge = (status) => `<span class="verification-badge status-${status}" data-verification-status>${statusLabel[status]}</span>`;
function context(state) {
    if (state.learnerPreview || !state.previews.has(state.active ?? ''))
        return null;
    const model = state.authorModel, rules = state.authorInsight?.rules;
    return model && rules ? { model, constraints: rules.constraints } : null;
}
export const rulesAvailable = (state) => !!context(state);
/** Sorter row classes: the selected line and its direct predecessors and successors. */
export function createRuleMarks(state) {
    const found = context(state), line = state.ruleSelection?.line;
    if (!found || line === undefined)
        return () => '';
    const before = new Set(found.constraints.filter(c => c.after === line).map(c => c.before)), after = new Set(found.constraints.filter(c => c.before === line).map(c => c.after));
    return id => typeof id !== 'number' ? '' : id === line ? ' rule-selected' : before.has(id) ? ' rule-before' : after.has(id) ? ' rule-after' : '';
}
export const ruleButton = (state, id) => `<button type="button" class="rule-toggle" data-rule-line="${id}" aria-pressed="${state.ruleSelection?.line === id}" aria-label="A(z) #${id} sor szabályai" title="Szabályok megjelenítése és szerkesztése">${icon('link')}</button>`;
function effectView(effect) {
    if (!effect)
        return '';
    const row = (label, value, witness, meaning) => `<li><b>${label}:</b> ${effectLabel[value]}${witness ? `<details><summary>Tanúsorrend · ${witness.length} sor</summary><p>${meaning}</p><code>${witness.map(id => '#' + id).join(' ')}</code></details>` : ''}</li>`;
    return `<div class="rule-effect" data-rule-effect><b>A legutóbbi módosítás hatása</b><ul>${row('Szigorítás', effect.stricter, effect.stricterWitness, 'Ezt a sorrendet a módosítás előtt elfogadta, most elutasítja.')}${row('Lazítás', effect.looser, effect.looserWitness, 'Ezt a sorrendet a módosítás előtt elutasította, most elfogadja.')}</ul></div>`;
}
export function renderRulePanel(state) {
    const found = context(state), selection = state.ruleSelection;
    if (!found)
        return '';
    if (!selection)
        return `<p class="rule-hint" data-rule-hint>${icon('link')}<span>Szerzői előnézet: a sorok láncszem gombjával megnyithatod és szerkesztheted a szabályaikat. A tanulói preview ebből semmit nem mutat.</span></p>`;
    const { model, constraints } = found, index = model.lines.findIndex(line => line.id === selection.line), line = model.lines[index];
    if (!line)
        return '';
    const code = new Map(model.lines.map(item => [item.id, item.code])), before = constraints.filter(c => c.after === line.id), after = constraints.filter(c => c.before === line.id);
    const item = (c, other) => {
        const pair = `data-before="${c.before}" data-after="${c.after}"`, reasons = c.reasons.map(reason => `${categoryLabel[reason.category]} · <code>${esc(reason.code)}</code>`).join('; ');
        return `<li class="rule-item editability-${c.editability}" data-rule-pair="${c.before}-${c.after}"><div class="rule-item-main"><button type="button" class="rule-jump" data-rule-line="${other}" aria-label="Ugrás a(z) #${other} sor szabályaira">#${other}</button><code>${snippet(code.get(other) ?? '')}</code></div><div class="rule-item-meta"><span class="rule-badge">${editabilityLabel[c.editability]}</span><span class="rule-reasons">${reasons}</span></div>${c.note ? `<p class="rule-note" data-rule-note-text>${esc(c.note)}</p>` : ''}<div class="rule-item-actions">${c.editability === 'hard' ? '<span class="rule-locked">Szerkezeti szabály, nem távolítható el</span>' : `<button type="button" data-rule-edit="remove" ${pair} aria-label="A(z) #${c.before} → #${c.after} szabály eltávolítása">${icon('close')}<span>Eltávolítás</span></button>`}<details class="rule-note-editor" data-rule-form><summary>Megjegyzés</summary><label>Megjegyzés a(z) #${c.before} → #${c.after} szabályhoz<input data-rule-note maxlength="500" autocomplete="off" value="${esc(c.note ?? '')}"></label><button type="button" data-rule-edit="note" ${pair}>Megjegyzés mentése</button></details></div></li>`;
    };
    const list = (items, other) => items.length ? `<ul class="rule-list">${items.map(c => item(c, other(c))).join('')}</ul>` : '<p class="rule-empty">Nincs közvetlen szabály.</p>';
    // Only lines consistent with the reference order are offered; the core still decides admissibility.
    const earlier = model.lines.slice(0, index).map(item => item.id).filter(id => !before.some(c => c.before === id)), later = model.lines.slice(index + 1).map(item => item.id).filter(id => !after.some(c => c.after === id));
    const add = (direction, ids) => ids.length ? `<div class="rule-add" data-rule-form data-rule-add="${direction}"><label>${direction === 'before' ? 'Új előzmény' : 'Új követő'}<select data-rule-other><option value="">Válassz sort…</option>${ids.map(id => `<option value="${id}">#${id} · ${snippet(code.get(id) ?? '', 60)}</option>`).join('')}</select></label><label>Megjegyzés<input data-rule-note maxlength="500" autocomplete="off" placeholder="Nem kötelező"></label><button type="button" data-rule-edit="add">${icon('plus')}<span>Szabály hozzáadása</span></button></div>` : '';
    const column = (direction, title, items, other, candidates) => `<section class="rule-column" aria-labelledby="rule-${direction}-title"><h4 id="rule-${direction}-title"><span class="rule-swatch ${direction}" aria-hidden="true"></span>${title} · ${items.length}</h4>${list(items, other)}${add(direction, candidates)}</section>`;
    const pending = selection.pending, notice = provenanceNotice[state.authorInsight?.rules?.provenance ?? 'complete'], verification = state.authorInsight?.verification;
    const confirm = pending ? `<div class="rule-confirm" data-rule-form data-rule-confirm role="group" aria-labelledby="rule-confirm-title"><p id="rule-confirm-title"><b>Megerősítés szükséges: #${pending.edit.before} → #${pending.edit.after}</b></p><p>${esc(pending.message)}</p><label>Indoklás, amely a lazítással együtt a modellbe kerül<input data-rule-note maxlength="500" autocomplete="off"></label><div class="rule-confirm-actions"><button type="button" class="danger" data-rule-edit="confirm">${pending.acknowledge === 'unproven-relaxation' ? 'Nem bizonyított lazítás megerősítése' : 'Policy-felülírás megerősítése'}</button><button type="button" data-rule-cancel>Mégse</button></div></div>` : '';
    const fixed = `<div class="rule-fixed"><button type="button" data-rule-edit="fixed" data-fixed="${!line.fixed}" aria-pressed="${line.fixed}">${icon('pin')}<span>${line.fixed ? 'Rögzítés feloldása' : 'Rögzítés a referencia helyén'}</span></button><span>${line.fixed ? `A sor a megoldás ${index + 1}. helyén rögzített.` : 'A sor helyét csak a szabályok kötik.'}</span></div>`;
    return `<section class="rule-panel" data-rule-panel data-rule-panel-line="${line.id}" aria-labelledby="rule-panel-title"><div class="rule-panel-heading"><div><span class="eyebrow">SZERZŐI SZABÁLYOK</span><h3 id="rule-panel-title" tabindex="-1">#${line.id} sor · a referencia ${index + 1}. sora</h3><pre class="rule-code"><code>${snippet(line.code, 400)}</code></pre></div><div class="rule-panel-tools">${verification ? badge(verification.status) : ''}<button type="button" data-rule-close>${icon('close')}<span>Bezárás</span></button></div></div>${notice ? `<p class="draft-notice" data-rule-provenance>${notice}</p>` : ''}<div class="rule-columns">${column('before', 'Előtte kell állnia', before, c => c.before, earlier)}${column('after', 'Utána kell állnia', after, c => c.after, later)}</div><p class="rule-legend">Az előzménynek bárhol előbb kell állnia, közé más sorok kerülhetnek. Kötelező szabály csak a referencia sorrendjével összhangban adható; eltérő sorrendhez OR-profil kell, amely az Adatmodell JSON-jában szerkeszthető.</p>${fixed}${confirm}${effectView(state.authorInsight?.effect)}<p class="rule-status" role="status" aria-live="polite">${esc(selection.message)}</p></section>`;
}
/** Author intent as a typed rule edit; null while the form is incomplete. */
export function readRuleEdit(button, selection) {
    const kind = button.dataset.ruleEdit, line = selection.line, note = (button.closest('[data-rule-form]')?.querySelector('[data-rule-note]')?.value ?? '').trim();
    const pair = { before: Number(button.dataset.before), after: Number(button.dataset.after) };
    if (kind === 'add') {
        const form = button.closest('[data-rule-add]'), other = Number(form?.querySelector('[data-rule-other]')?.value);
        if (!form || !other)
            return null;
        const earlier = form.dataset.ruleAdd === 'before';
        return { kind: 'add-rule', before: earlier ? other : line, after: earlier ? line : other, ...(note ? { note } : {}) };
    }
    if (kind === 'remove')
        return { kind: 'remove-rule', ...pair };
    if (kind === 'note')
        return { kind: 'set-note', ...pair, note };
    if (kind === 'fixed')
        return { kind: 'set-fixed', line, fixed: button.dataset.fixed === 'true' };
    if (kind === 'confirm' && selection.pending)
        return { ...selection.pending.edit, acknowledge: selection.pending.acknowledge, ...(note ? { note } : {}) };
    return null;
}
/** A rule edit installs a new model and its JSON; an unapplied JSON draft must be settled first, never overwritten. */
export function ruleEditBlocked(state) {
    const model = state.authorModel;
    return model && state.modelDraft && state.modelDraft !== JSON.stringify(model, null, 2) ? 'Az Adatmodell nézetben nem alkalmazott JSON-módosítás van. Alkalmazd, vagy írd vissza az aktív modell szerinti állapotra, mielőtt itt szabályt szerkesztesz.' : '';
}
/** A refused edit leaves the draft as it was; a removal waits for the acknowledgement the core names. */
export function recordRuleRefusal(selection, result, edits) {
    const [edit] = edits;
    if (result.error === 'needs-acknowledgement' && result.acknowledge && edit?.kind === 'remove-rule') {
        selection.pending = { edit, acknowledge: result.acknowledge, message: result.message };
        selection.message = '';
    }
    else {
        delete selection.pending;
        selection.message = result.message;
    }
}
/** After a new draft is installed: an applied edit settles the selection; a new model may drop it. */
export function settleRuleSelection(state, edited) {
    const selection = state.ruleSelection;
    if (!selection)
        return;
    if (!state.authorModel?.lines.some(line => line.id === selection.line)) {
        delete state.ruleSelection;
        return;
    }
    delete selection.pending;
    selection.message = edited ? 'A szabálymódosítás érvényes; a modell újraminősítve.' : '';
}
export function renderModelInsight(insight) {
    const verification = insight?.verification;
    if (!verification)
        return '';
    const { audit, refresh, rules } = insight;
    const findings = verification.findings.length ? `<ul class="insight-findings">${verification.findings.map(finding => `<li>${esc(finding)}</li>`).join('')}</ul>` : '';
    const claims = `<div class="dependency-scroll"><table class="insight-claims"><thead><tr><th>Állítás</th><th>Alap</th></tr></thead><tbody>${verification.claims.map(claim => `<tr><td>${esc(claim.claim)}</td><td class="basis-${claim.basis}">${basisLabel[claim.basis]}</td></tr>`).join('')}</tbody></table></div>`;
    const auditView = audit ? `<div class="insight-block" data-insight-audit><h4>A referencia nyelvi auditja</h4><p>${auditLabel[audit.semantics]}</p>${audit.diagnostics.length ? `<ul>${audit.diagnostics.slice(0, 5).map(item => `<li>${item.line}. sor · TS${item.code}: ${esc(item.message)}${item.context ? ' (hiányzó projektkontextus)' : ''}</li>`).join('')}</ul>` : ''}${audit.unresolved.length ? `<p>Feloldatlan modulok: ${audit.unresolved.map(name => `<code>${esc(name)}</code>`).join(', ')}</p>` : ''}</div>` : '';
    const relaxations = rules?.relaxations.length ? `<div class="insight-block" data-insight-relaxations><h4>Szerzői lazítások</h4><ul>${rules.relaxations.map(entry => `<li>#${entry.before} → #${entry.after} · ${editabilityLabel[entry.editability]}${entry.note ? ` · ${esc(entry.note)}` : ''}</li>`).join('')}</ul></div>` : '';
    const refreshView = refresh ? `<div class="insight-block" data-insight-refresh><h4>Az újraszámítás jelentése</h4><ul><li>${refresh.authorRules} szerzői szabály megmaradt</li><li>${refresh.legacyEdges} ismeretlen eredetű él megmaradt</li><li>${refresh.supersededEdges} korábbi generált él lecserélve</li>${refresh.relaxations.map(entry => `<li>#${entry.before} → #${entry.after} lazítás: ${refreshOutcome[entry.outcome]}${entry.note ? ` · ${esc(entry.note)}` : ''}</li>`).join('')}${refresh.droppedNotes ? `<li>${refresh.droppedNotes} megjegyzés elveszett, mert a szabálya megszűnt</li>` : ''}</ul></div>` : '';
    return `<section class="model-insight" data-model-insight aria-labelledby="model-insight-title"><div class="insight-heading"><h3 id="model-insight-title">Minősítés</h3>${badge(verification.status)}<span class="publish-badge ${verification.publishable ? 'ok' : 'blocked'}">${verification.publishable ? 'Publikálható' : 'Nem publikálható'}</span></div>${findings}<details data-memory="verification-claims"><summary>Állítások és alapjuk</summary>${claims}</details>${auditView}${relaxations}${refreshView}</section>`;
}
