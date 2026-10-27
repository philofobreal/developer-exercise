/** Editor gutters and scroll are presentation infrastructure, never grading policy. */
export const escapeHtml=(value:unknown):string=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));
export function editorShell(id:string,kind='code'):string {
 const label=kind==='model'?'CodeLine JSON adatmodell':id==='code-editor'?'Megoldás forráskódja':'JavaScript vagy TypeScript referenciaforrás';
 return `<div class="editor-frame" data-editor-kind="${escapeHtml(kind)}"><div class="editor-gutter" aria-hidden="true"></div><textarea id="${escapeHtml(id)}" spellcheck="false" autocomplete="off" autocapitalize="off" wrap="off" aria-label="${label}"></textarea></div>`;
}
export function updateGutters(root:HTMLElement):void {
 root.querySelectorAll<HTMLElement>('.editor-frame').forEach(frame=>{
  const textarea=frame.querySelector('textarea'),gutter=frame.querySelector<HTMLElement>('.editor-gutter');if(!textarea||!gutter)return;
  const count=Math.max(1,textarea.value.split('\n').length);if(gutter.childElementCount!==count)gutter.innerHTML=Array.from({length:count},(_,i)=>`<span>${i+1}</span>`).join('');
  gutter.scrollTop=textarea.scrollTop;gutter.style.height=`${textarea.clientHeight}px`;
 });
}
/** Scroll positions of the sorter zones and other marked scroll boxes, per continuity key. */
export function createScrollMemory(root:HTMLElement){
 const cache=new Map<string,{top:number;left:number}>();let previous='';
 const boxes=():[string,HTMLElement][]=>[...root.querySelectorAll<HTMLElement>('.drop-zone[data-zone],[data-scroll-memory]')].map(box=>[box.dataset.zone??box.dataset.scrollMemory??'',box]);
 return {capture(){if(previous)for(const [name,box] of boxes())cache.set(previous+':'+name,{top:box.scrollTop,left:box.scrollLeft});},
 restore(id:string){previous=id;for(const [name,box] of boxes()){const saved=cache.get(id+':'+name);if(saved){box.scrollTop=saved.top;box.scrollLeft=saved.left;}}}};
}
export {copyToClipboard} from './clipboard.js';
