/** Gutter, copy and scroll are UI infrastructure, not evaluation semantics. */
export const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function editorShell(id,kind='code'){return `<div class="editor-frame" data-editor-kind="${kind}"><div class="editor-gutter" aria-hidden="true"></div><textarea id="${id}" spellcheck="false" autocomplete="off" autocapitalize="off" wrap="off" aria-label="${kind==='model'?'CodeLine JSON':'TypeScript vagy JavaScript forráskód'}"></textarea></div>`;}
export function updateGutters(root){
  root.querySelectorAll('.editor-frame').forEach(frame=>{
    const t=frame.querySelector('textarea'),g=frame.querySelector('.editor-gutter');
    if(!t||!g)return;const count=Math.max(1,t.value.split('\n').length);
    if(g.childElementCount!==count)g.innerHTML=Array.from({length:count},(_,i)=>`<span>${i+1}</span>`).join('');
    g.scrollTop=t.scrollTop;g.style.height=`${t.clientHeight}px`;
  });
}
export function createScrollMemory(root){
  const cache=new Map();let previous='';
  return {
    capture(){if(!previous)return;for(const zone of root.querySelectorAll('.drop-zone[data-zone]'))cache.set(previous+':'+zone.dataset.zone,{top:zone.scrollTop,left:zone.scrollLeft});},
    restore(id){previous=id;for(const zone of root.querySelectorAll('.drop-zone[data-zone]')){const value=cache.get(id+':'+zone.dataset.zone);if(value){zone.scrollTop=value.top;zone.scrollLeft=value.left;}}}
  };
}
export async function copyToClipboard(value){try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return true;}}catch{}
  try{const temp=document.createElement('textarea');temp.value=value;temp.style.cssText='position:fixed;left:-9999px';document.body.appendChild(temp);temp.select();const success=document.execCommand('copy');temp.remove();return success;}catch{return false;}}
