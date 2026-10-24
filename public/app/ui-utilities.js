/** Editor gutters and scroll are presentation infrastructure, never grading policy. */
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
export function editorShell(id, kind = 'code') {
    const label = kind === 'model' ? 'CodeLine JSON adatmodell' : id === 'code-editor' ? 'Megoldás forráskódja' : 'JavaScript vagy TypeScript referenciaforrás';
    return `<div class="editor-frame" data-editor-kind="${escapeHtml(kind)}"><div class="editor-gutter" aria-hidden="true"></div><textarea id="${escapeHtml(id)}" spellcheck="false" autocomplete="off" autocapitalize="off" wrap="off" aria-label="${label}"></textarea></div>`;
}
export function updateGutters(root) {
    root.querySelectorAll('.editor-frame').forEach(frame => {
        const textarea = frame.querySelector('textarea'), gutter = frame.querySelector('.editor-gutter');
        if (!textarea || !gutter)
            return;
        const count = Math.max(1, textarea.value.split('\n').length);
        if (gutter.childElementCount !== count)
            gutter.innerHTML = Array.from({ length: count }, (_, i) => `<span>${i + 1}</span>`).join('');
        gutter.scrollTop = textarea.scrollTop;
        gutter.style.height = `${textarea.clientHeight}px`;
    });
}
export function createScrollMemory(root) {
    const cache = new Map();
    let previous = '';
    return { capture() { if (previous)
            for (const zone of root.querySelectorAll('.drop-zone[data-zone]'))
                cache.set(previous + ':' + zone.dataset.zone, { top: zone.scrollTop, left: zone.scrollLeft }); },
        restore(id) { previous = id; for (const zone of root.querySelectorAll('.drop-zone[data-zone]')) {
            const saved = cache.get(id + ':' + zone.dataset.zone);
            if (saved) {
                zone.scrollTop = saved.top;
                zone.scrollLeft = saved.left;
            }
        } } };
}
export { copyToClipboard } from './clipboard.js';
