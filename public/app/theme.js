export const THEME_KEY = 'ngdynamic.theme.v1';
const ORDER = ['system', 'light', 'dark'];
export const THEME_LABEL = { system: 'Rendszer', light: 'Világos', dark: 'Sötét' };
export function themeChoice(root = document.documentElement) {
    const value = root.dataset.theme;
    return value === 'light' || value === 'dark' ? value : 'system';
}
export const THEME_CHOICES = ORDER;
/** The choice, applied at once and remembered where storage allows; anything else than light or dark is the system's. */
export function setTheme(choice, root = document.documentElement) {
    const next = choice === 'light' || choice === 'dark' ? choice : 'system';
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
/** The next choice in system → light → dark order. */
export function cycleTheme(root = document.documentElement) {
    return setTheme(ORDER[(ORDER.indexOf(themeChoice(root)) + 1) % ORDER.length], root);
}
