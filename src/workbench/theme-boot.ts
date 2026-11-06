/** Classic script in <head> (ADR-105): apply the stored theme before the first paint, so a light or
 * dark choice never flashes the system theme. The key is theme.ts's THEME_KEY. No imports or exports:
 * it must not become a module, which the browser would defer. */
(():void=>{try{const value=localStorage.getItem('ngdynamic.theme.v1');if(value==='light'||value==='dark')document.documentElement.dataset.theme=value;}catch{/* storage blocked: the system theme */}})();
