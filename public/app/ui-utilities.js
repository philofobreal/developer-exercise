/** Editor gutters and scroll are presentation infrastructure, never grading policy. */
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
/** ADR-121 (M4): syntax highlighting with the vendored Prism, the one highlighter of the app (sorter rows, rule board,
 *  snippets, editors). JSON uses the JavaScript grammar. Without Prism the code is escaped plain text. */
export function highlight(code, language) {
    // The global, not `window`: the help page's build highlights in Node with the same vendored Prism (ADR-135).
    try {
        const prism = globalThis.Prism, grammar = prism?.languages[language] ?? (language === 'json' ? prism?.languages.javascript : undefined);
        if (prism && grammar)
            return prism.highlight(code, grammar, language === 'json' ? 'javascript' : language);
    }
    catch { }
    return escapeHtml(code);
}
/** ADR-135 (NY-31): the highlighted code cut into lines, for numbered listings. Prism highlights the whole text, so a
 *  token over several lines (a template string, a block comment) keeps its colour; each line closes the spans still
 *  open at its end and the next line opens them again, so every line is well-formed markup on its own. */
export function highlightLines(code, language) {
    const lines = [], open = [];
    let current = '';
    for (const part of highlight(code, language).split(/(<span[^>]*>|<\/span>)/)) {
        if (part.startsWith('<span')) {
            open.push(part);
            current += part;
        }
        else if (part === '</span>') {
            open.pop();
            current += part;
        }
        else {
            const pieces = part.split('\n');
            pieces.forEach((piece, index) => { if (index > 0) {
                lines.push(current + '</span>'.repeat(open.length));
                current = open.join('');
            } current += piece; });
        }
    }
    lines.push(current);
    return lines;
}
/** ADR-121 (M4): one code editor for the source, the CodeLine JSON and the solution code. A transparent textarea keeps the
 *  native editing (undo, selection, IME, paste, mobile keyboards) above a highlighted layer with the same metrics. */
export function editorShell(id, kind = 'code', language = 'javascript') {
    const label = kind === 'model' ? 'CodeLine JSON adatmodell' : id === 'code-editor' ? 'Megoldás forráskódja' : 'JavaScript vagy TypeScript referenciaforrás';
    return `<div class="editor-frame" data-editor-kind="${escapeHtml(kind)}" data-language="${escapeHtml(kind === 'model' ? 'json' : language)}"><div class="editor-gutter" aria-hidden="true"></div><div class="editor-surface"><pre class="editor-highlight" aria-hidden="true"><code></code></pre><textarea id="${escapeHtml(id)}" spellcheck="false" autocomplete="off" autocapitalize="off" wrap="off" aria-label="${label}"></textarea></div></div>`;
}
/** Keeps each editor's line numbers, highlighted layer and scroll in step with its textarea (after a render, an input, a scroll). */
export function syncEditors(root) {
    root.querySelectorAll('.editor-frame').forEach(frame => {
        const textarea = frame.querySelector('textarea'), gutter = frame.querySelector('.editor-gutter'), layer = frame.querySelector('.editor-highlight'), code = layer?.querySelector('code');
        if (!textarea || !gutter)
            return;
        const count = Math.max(1, textarea.value.split('\n').length);
        if (gutter.childElementCount !== count)
            gutter.innerHTML = Array.from({ length: count }, (_, i) => `<span>${i + 1}</span>`).join('');
        gutter.scrollTop = textarea.scrollTop;
        gutter.style.height = `${textarea.clientHeight}px`;
        if (layer && code) {
            if (code.dataset.text !== textarea.value) {
                code.innerHTML = highlight(textarea.value, frame.dataset.language ?? 'javascript') + '\n';
                code.dataset.text = textarea.value;
            }
            layer.scrollTop = textarea.scrollTop;
            layer.scrollLeft = textarea.scrollLeft;
        }
    });
}
/** ADR-121 (M4): the editing keys as a pure function (testable without a DOM). `text`, `start`, `end` describe the
 *  replacement of the range [start,end) and the caret after it. Tab and Shift+Tab indent or outdent the selected lines
 *  (or insert one unit at the caret); Enter keeps the line's indentation and adds a unit after an opening bracket; a
 *  closing brace typed on an indentation-only line steps back one unit. Anything else returns null (the browser acts). */
export function editorKey(value, start, end, key, shift, unit) {
    const pad = ' '.repeat(unit), lineStart = value.lastIndexOf('\n', start - 1) + 1;
    if (key === 'Tab') {
        if (start === end && !shift)
            return { from: start, to: end, text: pad, start: start + unit, end: start + unit };
        const blockEnd = (() => { const i = value.indexOf('\n', end - (end > start && value[end - 1] === '\n' ? 1 : 0)); return i < 0 ? value.length : i; })();
        const lines = value.slice(lineStart, blockEnd).split('\n');
        const changed = lines.map(line => shift ? line.replace(new RegExp(`^ {1,${unit}}`), '') : pad + line).join('\n');
        return { from: lineStart, to: blockEnd, text: changed, start: lineStart, end: lineStart + changed.length };
    }
    if (key === 'Enter' && !shift) {
        const before = value.slice(lineStart, start), indent = /^[ \t]*/.exec(before)[0], opens = /[{[(]\s*$/.test(before);
        const text = '\n' + indent + (opens ? pad : '');
        return { from: start, to: end, text, start: start + text.length, end: start + text.length };
    }
    if (key === '}' && start === end) {
        const before = value.slice(lineStart, start);
        if (before.length > 0 && /^ +$/.test(before)) {
            const kept = before.slice(0, Math.max(0, before.length - unit));
            return { from: lineStart, to: start, text: kept + '}', start: lineStart + kept.length + 1, end: lineStart + kept.length + 1 };
        }
    }
    return null;
}
/** Applies editorKey to a textarea, through the browser's own editing so native undo keeps working. */
export function handleEditorKey(event) {
    const textarea = event.target;
    if (!(textarea instanceof HTMLTextAreaElement) || !textarea.closest('.editor-frame') || event.ctrlKey || event.metaKey || event.altKey || event.isComposing)
        return;
    const unit = textarea.closest('.editor-frame')?.dataset.editorKind === 'model' ? 2 : 5;
    const change = editorKey(textarea.value, textarea.selectionStart, textarea.selectionEnd, event.key, event.shiftKey, unit);
    if (!change)
        return;
    event.preventDefault();
    textarea.setSelectionRange(change.from, change.to);
    const native = typeof document.execCommand === 'function' && document.execCommand('insertText', false, change.text);
    if (!native) {
        textarea.setRangeText(change.text, change.from, change.to, 'end');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    textarea.setSelectionRange(change.start, change.end);
}
/** Scroll positions of the sorter zones and other marked scroll boxes, per continuity key. */
export function createScrollMemory(root) {
    const cache = new Map();
    let previous = '';
    const boxes = () => [...root.querySelectorAll('.drop-zone[data-zone],[data-scroll-memory]')].map(box => [box.dataset.zone ?? box.dataset.scrollMemory ?? '', box]);
    return { capture() { if (previous)
            for (const [name, box] of boxes())
                cache.set(previous + ':' + name, { top: box.scrollTop, left: box.scrollLeft }); },
        restore(id) { previous = id; for (const [name, box] of boxes()) {
            const saved = cache.get(id + ':' + name);
            if (saved) {
                box.scrollTop = saved.top;
                box.scrollLeft = saved.left;
            }
        } } };
}
export { copyToClipboard } from './clipboard.js';
/** Selects one 1-based line of an editor and scrolls it into view (ADR-108, E7: a gate finding points at its line). */
export function revealLine(editor, line) {
    const lines = editor.value.split('\n'), index = Math.min(Math.max(1, Math.floor(line)), lines.length) - 1;
    const start = lines.slice(0, index).reduce((offset, text) => offset + text.length + 1, 0);
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(start, start + (lines[index]?.length ?? 0));
    const height = parseFloat(getComputedStyle(editor).lineHeight) || 20;
    editor.scrollTop = Math.max(0, index * height - editor.clientHeight / 3);
    editor.dispatchEvent(new Event('scroll'));
}
