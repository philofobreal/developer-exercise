/** Full-surface presentation (ADR-106). `app` lifts the whole workbench to the full screen; `focus`
 * keeps only the code workspace (sorter or solution editor with its check bar) on the largest surface.
 * The surface is a root attribute, so it survives every render; the Fullscreen API is used where the
 * browser has it, and the same layout works without it (iOS Safari) as a fixed overlay. Either way the
 * root scrolls itself: a fullscreen element is not scrolled by the page.
 * Focus entered from the full-screen app (`app`) returns to it when left: the browser's full screen stays and only
 * the focus ends (ADR-110). Entered from the page, leaving focus leaves the full screen it opened. */
export type Surface='app'|'focus';
export function surface(root:HTMLElement):Surface|null {
 const value=root.dataset.surface;return value==='app'||value==='focus'?value:null;
}
async function leaveNative(root:HTMLElement):Promise<void> {
 delete root.dataset.native;
 if(document.fullscreenElement===root){try{await document.exitFullscreen();}catch{/* already left */}}
}
/** Leaves the current surface: back to the full-screen app when focus came from there, else to the page. */
async function leave(root:HTMLElement,changed:()=>void):Promise<void> {
 if(surface(root)==='focus'&&root.dataset.surfaceReturn==='app'){root.dataset.surface='app';delete root.dataset.surfaceReturn;changed();return;}
 delete root.dataset.surface;delete root.dataset.surfaceReturn;await leaveNative(root);changed();
}
/** Enter `wanted`, or leave it when it is the current surface; `changed` re-renders the labels. */
export async function toggleSurface(root:HTMLElement,wanted:Surface,changed:()=>void):Promise<void> {
 const current=surface(root);
 if(current===wanted){await leave(root,changed);return;}
 if(wanted==='focus'&&current==='app')root.dataset.surfaceReturn='app';else delete root.dataset.surfaceReturn;
 root.dataset.surface=wanted;changed();
 if(document.fullscreenElement===root||typeof root.requestFullscreen!=='function')return;
 try{
  await root.requestFullscreen();
  // Left again while the browser was still entering: the full screen it opened must not outlive the surface.
  if(!surface(root)){try{await document.exitFullscreen();}catch{/* already left */}return;}
  root.dataset.native='1';
 }catch{/* refused or unsupported: the overlay stays */}
}
/** Leaving the browser's fullscreen (Escape, a browser gesture) leaves the surface too; without the
 * Fullscreen API, Escape outside a list, an editor or a menu leaves it. */
export function installSurface(root:HTMLElement,changed:()=>void):void {
 document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement!==root&&root.dataset.native){delete root.dataset.native;delete root.dataset.surface;delete root.dataset.surfaceReturn;changed();}});
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||event.defaultPrevented||!surface(root)||root.dataset.native)return;
  const target=event.target instanceof Element?event.target:null;
  if(target?.closest('.drop-zone,.board-list,textarea,input,select,details.menu[open]')||root.querySelector('.code-row.picked,.connect-source'))return;
  void leave(root,changed);
 });
}
