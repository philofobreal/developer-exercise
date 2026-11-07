export const CODE_VIEW_KEY = 'ngdynamic.code-view.v1';
export const CODE_VIEW_LABEL = { editor: 'Szerkesztő', cards: 'Kártyák' };
const valid = (value) => value === 'editor' || value === 'cards';
export function codeView(root) {
    const value = root.dataset.codeView;
    if (valid(value))
        return value;
    let stored = null;
    try {
        stored = localStorage.getItem(CODE_VIEW_KEY);
    }
    catch { /* storage blocked */ }
    const chosen = valid(stored) ? stored : typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'cards' : 'editor';
    root.dataset.codeView = chosen;
    return chosen;
}
export function setCodeView(root, value) {
    root.dataset.codeView = value;
    try {
        localStorage.setItem(CODE_VIEW_KEY, value);
    }
    catch { /* this page only */ }
}
