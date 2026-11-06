export const THEME_KEY = 'ngdynamic.theme.v1';
const ORDER = ['system', 'light', 'dark'];
export const THEME_LABEL = { system: 'Rendszer', light: 'Világos', dark: 'Sötét' };
export function themeChoice(root = document.documentElement) {
    const value = root.dataset.theme;
    return value === 'light' || value === 'dark' ? value : 'system';
}
/** The next choice in system → light → dark order, applied at once and remembered where storage allows. */
export function cycleTheme(root = document.documentElement) {
    const next = ORDER[(ORDER.indexOf(themeChoice(root)) + 1) % ORDER.length] ?? 'system';
    if (next === 'system')
        delete root.dataset.theme;
    else
        root.dataset.theme = next;
    try {
        if (next === 'system')
            localStorage.removeItem(THEME_KEY);
        else
            localStorage.setItem(THEME_KEY, next);
    }
    catch { /* private mode: the choice lasts for this page */ }
    return next;
}
