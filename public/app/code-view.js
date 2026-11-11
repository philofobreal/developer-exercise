export const CODE_VIEW_KEY = 'ngdynamic.code-view.v1';
/** ADR-133 (the user's decision): the page offers no view switches, neither Rendező | Megoldáskód nor Szerkesztő |
 * Kártyák. The views stay in the code, switched off: the Try workspace is the sorter, and its rows are drawn as the
 * pointer suits (a coarse pointer gets cards, for their large targets; a fine one the editor), whatever an earlier
 * choice stored. Developers and the tests that cover the switched-off views turn them back on with this key set to
 * `on` in the page's storage. */
export const VIEW_SWITCHES_KEY = 'ngdynamic.view-switches.v1';
export function viewSwitchesOffered() {
    try {
        return typeof localStorage !== 'undefined' && localStorage.getItem(VIEW_SWITCHES_KEY) === 'on';
    }
    catch {
        return false;
    }
}
export const CODE_VIEW_LABEL = { editor: 'Szerkesztő', cards: 'Kártyák' };
const valid = (value) => value === 'editor' || value === 'cards';
export function codeView(root) {
    const value = root.dataset.codeView;
    if (valid(value))
        return value;
    let stored = null;
    if (viewSwitchesOffered())
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
