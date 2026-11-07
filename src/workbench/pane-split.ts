/** The width split between the pool and the solution (ADR-107): a separator between the two lists,
 * moved by pointer or keyboard, kept as a root CSS variable (so every render keeps it) and remembered
 * where storage allows. Values are percentages of the lists' width for the pool, within 20–80. */
export const SPLIT_KEY='ngdynamic.pane-split.v1';
const MIN=20,MAX=80,DEFAULT=40,STEP=2;
const clamp=(value:number):number=>Math.round(Math.min(MAX,Math.max(MIN,value)));
function apply(root:HTMLElement,value:number):number {
 const v=clamp(value);root.style.setProperty('--split',v+'%');root.dataset.split=String(v);
 for(const handle of root.querySelectorAll<HTMLElement>('[data-pane-split]'))handle.setAttribute('aria-valuenow',String(v));
 return v;
}
const remember=(value:number):void=>{try{localStorage.setItem(SPLIT_KEY,String(value));}catch{/* this page only */}};
/** The pool's share in percent; the first call restores the remembered split. */
export function paneSplit(root:HTMLElement):number {
 const current=Number(root.dataset.split);if(Number.isFinite(current)&&current>0)return current;
 let stored=NaN;try{stored=Number(localStorage.getItem(SPLIT_KEY));}catch{/* storage blocked */}
 return apply(root,Number.isFinite(stored)&&stored>0?stored:DEFAULT);
}
/** Pointer drag on a separator moves the split; arrows, Home and End move it by keyboard. `moved` runs
 * after each change (the rule arcs follow the rows). */
export function installPaneSplit(root:HTMLElement,moved:()=>void):void {
 let drag:{pointer:number;panes:HTMLElement}|null=null;
 root.addEventListener('pointerdown',event=>{
  const handle=event.target instanceof Element?event.target.closest<HTMLElement>('[data-pane-split]'):null,panes=handle?.closest<HTMLElement>('.panes');
  if(!handle||!panes||event.button>0)return;
  event.preventDefault();drag={pointer:event.pointerId,panes};handle.classList.add('dragging');
  try{handle.setPointerCapture(event.pointerId);}catch{/* the root still sees the moves */}
 });
 root.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.pointer)return;
  const box=drag.panes.getBoundingClientRect();if(!box.width)return;
  apply(root,(event.clientX-box.left)/box.width*100);moved();
 });
 const finish=(event:PointerEvent):void=>{
  if(!drag||event.pointerId!==drag.pointer)return;
  drag=null;for(const handle of root.querySelectorAll('[data-pane-split].dragging'))handle.classList.remove('dragging');remember(paneSplit(root));
 };
 root.addEventListener('pointerup',finish);root.addEventListener('pointercancel',finish);
 root.addEventListener('keydown',event=>{
  if(!(event.target instanceof Element)||!event.target.matches('[data-pane-split]'))return;
  const now=paneSplit(root),next=event.key==='ArrowLeft'?now-STEP:event.key==='ArrowRight'?now+STEP:event.key==='Home'?MIN:event.key==='End'?MAX:null;
  if(next===null)return;
  event.preventDefault();remember(apply(root,next));moved();
 });
}
