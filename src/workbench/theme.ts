/** The colour theme the reader chose (ADR-105): the system's, light or dark. The stylesheet follows
 * `prefers-color-scheme` unless the root carries `data-theme`; this module owns that attribute and
 * its persisted value. theme-boot.ts applies the stored value before the first paint; it repeats
 * THEME_KEY because it must run as a classic script (tests/theme.test.mjs keeps the two equal). */
export type ThemeChoice='system'|'light'|'dark';
export const THEME_KEY='ngdynamic.theme.v1';
const ORDER:readonly ThemeChoice[]=['system','light','dark'];
export const THEME_LABEL:Readonly<Record<ThemeChoice,string>>={system:'Rendszer',light:'Világos',dark:'Sötét'};
export function themeChoice(root:HTMLElement=document.documentElement):ThemeChoice {
 const value=root.dataset.theme;return value==='light'||value==='dark'?value:'system';
}
export const THEME_CHOICES:readonly ThemeChoice[]=ORDER;
/** The choice, applied at once and remembered where storage allows; anything else than light or dark is the system's. */
export function setTheme(choice:unknown,root:HTMLElement=document.documentElement):ThemeChoice {
 const next:ThemeChoice=choice==='light'||choice==='dark'?choice:'system';
 if(next==='system')delete root.dataset.theme;else root.dataset.theme=next;
 try{if(next==='system')localStorage.removeItem(THEME_KEY);else localStorage.setItem(THEME_KEY,next);}catch{/* private mode: the choice lasts for this page */}
 return next;
}
/** The next choice in system → light → dark order. */
export function cycleTheme(root:HTMLElement=document.documentElement):ThemeChoice {
 return setTheme(ORDER[(ORDER.indexOf(themeChoice(root))+1)%ORDER.length],root);
}
