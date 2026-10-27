import { createRuleMarks, ruleButton, rulesAvailable } from './rule-panel.js';
const SVG = 'http://www.w3.org/2000/svg';
/** Nesting depth for indentation only: the number of enclosing blocks. */
function depths(model) {
    const parent = new Map(model.blocks.map(block => [block.id, block.parentScopeId])), depth = (scope) => { let count = 0; for (let at = scope; at !== null && count < 32; at = parent.get(at) ?? null)
        count++; return count; };
    return new Map(model.lines.map(line => [line.id, depth(line.scopeId)]));
}
export const connectButton = (state, id) => `<button type="button" class="board-connect" data-rule-connect="${id}" aria-pressed="${state.ruleConnect === id}" aria-label="A(z) #${id} sor összekötése egy másik sorral" title="Húzd egy másik sorra, vagy válaszd ki itt, majd a másik soron: a kettő közé szabály kerül"><span aria-hidden="true"></span></button>`;
const legend = '<p class="board-legend"><span class="rule-swatch before" aria-hidden="true"></span>előtte kell állnia <span class="rule-swatch selected" aria-hidden="true"></span>kijelölt <span class="rule-swatch after" aria-hidden="true"></span>utána kell állnia · Láncszem: a sor szabályai. Kör: egy másik sorra húzva szabályt veszel fel köztük.</p>';
const toggle = (state) => `<label class="board-toggle"><input type="checkbox" data-board-all ${state.boardAll ? 'checked' : ''}> Minden nem szerkezeti szabály rajzolása</label>`;
const connecting = (state) => state.ruleConnect !== undefined ? `<p class="board-connecting" role="status">A(z) #${state.ruleConnect} sorból indított összekötés: válaszd ki a másik sor körgombját. Escape: megszakítás.</p>` : '';
export function renderRuleBoard(state, highlight) {
    const model = state.authorModel;
    if (!model || !rulesAvailable(state))
        return '';
    const marks = createRuleMarks(state), indent = depths(model);
    const rows = model.lines.map((line, index) => `<li class="board-row${marks(line.id)}${state.ruleConnect === line.id ? ' connect-source' : ''}${line.fixed ? ' fixed-row' : ''}" data-board-line="${line.id}">${connectButton(state, line.id)}<span class="board-id">#${line.id}</span><span class="board-index">${index + 1}.</span><pre class="code-text depth-${Math.min(indent.get(line.id) ?? 0, 8)}"><code>${highlight(line.code)}</code></pre><span class="row-actions">${ruleButton(state, line.id)}</span></li>`).join('');
    return `<section class="rule-board" aria-labelledby="rule-board-title"><div class="board-heading"><h3 id="rule-board-title">A referencia sorai és szabályai</h3>${toggle(state)}</div>${legend}${connecting(state)}<div class="board-frame"><svg class="board-arcs" data-board-arcs aria-hidden="true" focusable="false"></svg><ol class="board-list" data-board-list aria-label="A referencia sorai">${rows}</ol></div></section>`;
}
/** The Try step's rule bar: the same legend and drawing switch as the board. */
export const renderTryRules = (state) => rulesAvailable(state) ? `<div class="try-rules" data-try-rules><div class="board-heading"><span class="eyebrow">SZERZŐI SZABÁLYOK A RENDEZŐBEN</span>${toggle(state)}</div>${legend}${connecting(state)}</div>` : '';
/** Row controls for a sorter row of the author's preview; nothing for learners or practice. */
export const tryRowRuleControls = (state, id) => typeof id === 'number' && rulesAvailable(state) ? ruleButton(state, id) + connectButton(state, id) : '';
/** What to draw: the selected line's direct constraints, and on request every non-structural one. */
function shownConstraints(state) {
    const line = state.ruleSelection?.line;
    return (state.authorInsight?.rules?.constraints ?? []).filter(c => line !== undefined && (c.before === line || c.after === line) || !!state.boardAll && c.editability !== 'hard');
}
/** Arcs bulge left from `anchor`; positions are row centres measured after rendering. */
function paintArcs(svg, state, centre, anchor, reach, width, height) {
    const line = state.ruleSelection?.line, prefix = svg.dataset.arcPrefix ?? 'arc';
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.replaceChildren();
    const defs = document.createElementNS(SVG, 'defs');
    for (const kind of ['before', 'after', 'other']) {
        const marker = document.createElementNS(SVG, 'marker'), head = document.createElementNS(SVG, 'path');
        const attributes = [['id', `${prefix}-head-${kind}`], ['viewBox', '0 0 8 8'], ['refX', '7'], ['refY', '4'], ['markerWidth', '7'], ['markerHeight', '7'], ['orient', 'auto']];
        for (const [name, value] of attributes)
            marker.setAttribute(name, value);
        head.setAttribute('d', 'M0 0 8 4 0 8z');
        head.setAttribute('class', 'arc-head ' + kind);
        marker.append(head);
        defs.append(marker);
    }
    svg.append(defs);
    for (const c of shownConstraints(state)) {
        const y1 = centre.get(c.before), y2 = centre.get(c.after);
        if (y1 === undefined || y2 === undefined)
            continue;
        const kind = c.after === line ? 'before' : c.before === line ? 'after' : 'other', bulge = Math.min(reach, 10 + Math.abs(y2 - y1) * .12), path = document.createElementNS(SVG, 'path');
        path.setAttribute('d', `M ${anchor} ${y1} C ${anchor - bulge} ${y1}, ${anchor - bulge} ${y2}, ${anchor - 1} ${y2}`);
        path.setAttribute('class', `arc ${kind} editability-${c.editability}`);
        path.setAttribute('marker-end', `url(#${prefix}-head-${kind})`);
        path.dataset.arc = c.before + '-' + c.after;
        svg.append(path);
    }
}
/** Board arcs in its gutter; sorter arcs inside each zone, between rows of that zone, left of the
 * row controls (a constraint between the pool and the solution is shown by row highlighting). */
export function drawRuleArcs(root, state) {
    const svg = root.querySelector('[data-board-arcs]'), list = root.querySelector('[data-board-list]');
    if (svg && list) {
        const width = svg.getBoundingClientRect().width || 56;
        paintArcs(svg, state, new Map([...list.querySelectorAll('[data-board-line]')].map(row => [Number(row.dataset.boardLine), row.offsetTop + row.offsetHeight / 2])), width, width - 4, width, list.offsetHeight);
    }
    if (!rulesAvailable(state) || !root.querySelector('[data-try-rules]'))
        return;
    for (const zone of root.querySelectorAll('.drop-zone[data-zone]')) {
        const rows = [...zone.querySelectorAll(':scope > .code-row')].filter(row => /^\d+$/.test(row.dataset.lineId ?? ''));
        let layer = zone.querySelector(':scope > svg.zone-arcs');
        if (!layer) {
            layer = document.createElementNS(SVG, 'svg');
            layer.setAttribute('class', 'zone-arcs');
            layer.setAttribute('aria-hidden', 'true');
            layer.setAttribute('focusable', 'false');
            layer.dataset.zoneArcs = zone.dataset.zone ?? '';
            layer.dataset.arcPrefix = 'arc-' + (zone.dataset.zone ?? 'zone');
            zone.append(layer);
        }
        const controls = rows[0]?.querySelector('.row-actions'), anchor = controls ? controls.offsetLeft - 6 : zone.clientWidth - 8;
        paintArcs(layer, state, new Map(rows.map(row => [Number(row.dataset.lineId), row.offsetTop + row.offsetHeight / 2])), anchor, Math.min(140, anchor - 60), zone.clientWidth, zone.scrollHeight);
    }
}
/** The reference order decides direction: a mandatory rule can only follow it (ADR-018). */
export function connection(model, a, b) {
    const index = new Map(model.lines.map((line, position) => [line.id, position])), x = index.get(a), y = index.get(b);
    if (x === undefined || y === undefined || x === y)
        return null;
    return x < y ? { before: a, after: b } : { before: b, after: a };
}
const lineOf = (row) => Number(row.dataset.boardLine ?? row.dataset.lineId);
/** Pointer drag between a connector and another line's row. On the sorter the rows are natively
 * draggable, so a drag that starts on a connector cancels the native row drag. The click that
 * may follow a drag is swallowed only briefly and only from a pointer (`detail > 0`): when the
 * edit re-renders first, that click never fires, and a keyboard activation is never mistaken for it. */
export function installRuleBoard(root, onConnect, onCancel) {
    let drag = null, suppressUntil = 0;
    const rowAt = (x, y) => { const row = document.elementFromPoint(x, y)?.closest('[data-board-line],.drop-zone .code-row[data-line-id]') ?? null; return row && Number.isInteger(lineOf(row)) ? row : null; };
    root.addEventListener('pointerdown', event => {
        const handle = event.target instanceof Element ? event.target.closest('[data-rule-connect]') : null;
        if (!handle || event.button > 0)
            return;
        drag = { from: Number(handle.dataset.ruleConnect), pointer: event.pointerId, moved: false, target: null };
        try {
            handle.setPointerCapture(event.pointerId);
        }
        catch { }
    });
    root.addEventListener('dragstart', event => { if (drag || event.target instanceof Element && event.target.closest('[data-rule-connect]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
    } }, true);
    root.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.pointer)
            return;
        const row = rowAt(event.clientX, event.clientY), target = row && lineOf(row) !== drag.from ? row : null;
        if (target)
            drag.moved = true;
        if (target !== drag.target) {
            drag.target?.classList.remove('connect-target');
            target?.classList.add('connect-target');
            drag.target = target;
        }
        if (drag.moved)
            event.preventDefault();
    });
    const finish = (event, commit) => {
        if (!drag || event.pointerId !== drag.pointer)
            return;
        const { from, target, moved } = drag;
        target?.classList.remove('connect-target');
        drag = null;
        if (moved) {
            suppressUntil = performance.now() + 400;
            if (commit && target)
                onConnect(from, lineOf(target));
        }
    };
    root.addEventListener('pointerup', event => finish(event, true));
    root.addEventListener('pointercancel', event => finish(event, false));
    root.addEventListener('click', event => { if (event.detail > 0 && performance.now() < suppressUntil && event.target instanceof Element && event.target.closest('[data-rule-connect]')) {
        suppressUntil = 0;
        event.preventDefault();
        event.stopImmediatePropagation();
    } }, true);
    root.addEventListener('keydown', event => { if (event.key === 'Escape' && root.querySelector('.connect-source,[data-rule-connect][aria-pressed="true"]'))
        onCancel(); });
}
