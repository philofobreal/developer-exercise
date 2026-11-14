/** The widths the reader sets (ADR-107, ADR-146): a separator between two panels of the workspace, moved by pointer or
 * keyboard. Hidden here: each split's range, start and storage, and how a pointer's place becomes a share. A split is
 * kept as a root CSS variable, so every render keeps it and the stylesheet alone lays the panels out, and it is
 * remembered where storage allows. Values are whole percentages:
 * - `lists`: the pool's share of the two lists' width (`--split`);
 * - `rules`: the rule panel's share of the lists and the panel together (`--rules-split`); the panel stands on the
 *   right, so its share grows as its separator moves left. */
export type SplitName='lists'|'rules';
interface Split {key:string;property:string;min:number;max:number;start:number;fromEnd:boolean}
const STEP=2;
const SPLITS:Readonly<Record<SplitName,Split>>={
 lists:{key:'ngdynamic.pane-split.v1',property:'--split',min:20,max:80,start:40,fromEnd:false},
 rules:{key:'ngdynamic.rules-split.v1',property:'--rules-split',min:20,max:50,start:28,fromEnd:true}
};
const named=(handle:Element):SplitName|null=>{const name=handle.getAttribute('data-pane-split');return name==='lists'||name==='rules'?name:null;};
function apply(root:HTMLElement,name:SplitName,value:number):number {
 const split=SPLITS[name],v=Math.round(Math.min(split.max,Math.max(split.min,value)));
 root.style.setProperty(split.property,v+'%');
 for(const handle of root.querySelectorAll<HTMLElement>(`[data-pane-split="${name}"]`))handle.setAttribute('aria-valuenow',String(v));
 return v;
}
const remember=(name:SplitName,value:number):void=>{try{localStorage.setItem(SPLITS[name].key,String(value));}catch{/* this page only */}};
/** The share of `name` in percent; the first call restores the remembered split. */
export function paneSplit(root:HTMLElement,name:SplitName='lists'):number {
 const split=SPLITS[name],current=parseFloat(root.style.getPropertyValue(split.property));if(current>0)return current;
 let stored=NaN;try{stored=Number(localStorage.getItem(split.key));}catch{/* storage blocked */}
 return apply(root,name,Number.isFinite(stored)&&stored>0?stored:split.start);
}
/** What makes an element the separator of `name`: its name, role and range, and where it stands now. The caller adds
 *  what it separates and how it is called. */
export function separatorAttributes(root:HTMLElement,name:SplitName):string {
 const split=SPLITS[name];
 return `data-pane-split="${name}" role="separator" tabindex="0" aria-orientation="vertical" aria-valuemin="${split.min}" aria-valuemax="${split.max}" aria-valuenow="${paneSplit(root,name)}"`;
}
/** Pointer drag on a separator moves its split within the element the separator stands in; arrows, Home and End move
 * it by keyboard, the way the separator itself moves on the screen. `moved` runs after each change (the rule arcs
 * follow the rows). */
export function installPaneSplit(root:HTMLElement,moved:()=>void):void {
 let drag:{pointer:number;name:SplitName;within:HTMLElement}|null=null;
 root.addEventListener('pointerdown',event=>{
  const handle=event.target instanceof Element?event.target.closest<HTMLElement>('[data-pane-split]'):null,name=handle?named(handle):null,within=handle?.parentElement;
  if(!handle||!name||!within||event.button>0)return;
  event.preventDefault();drag={pointer:event.pointerId,name,within};handle.classList.add('dragging');
  try{handle.setPointerCapture(event.pointerId);}catch{/* the root still sees the moves */}
 });
 root.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.pointer)return;
  const box=drag.within.getBoundingClientRect();if(!box.width)return;
  apply(root,drag.name,(SPLITS[drag.name].fromEnd?box.right-event.clientX:event.clientX-box.left)/box.width*100);moved();
 });
 const finish=(event:PointerEvent):void=>{
  if(!drag||event.pointerId!==drag.pointer)return;
  const name=drag.name;drag=null;
  for(const handle of root.querySelectorAll('[data-pane-split].dragging'))handle.classList.remove('dragging');
  remember(name,paneSplit(root,name));
 };
 root.addEventListener('pointerup',finish);root.addEventListener('pointercancel',finish);
 root.addEventListener('keydown',event=>{
  const name=event.target instanceof Element&&event.target.matches('[data-pane-split]')?named(event.target):null;if(!name)return;
  // Left and Home take the separator left: the pool narrows, the rule panel on the right widens.
  const split=SPLITS[name],now=paneSplit(root,name),left=split.fromEnd?1:-1,leftmost=split.fromEnd?split.max:split.min,rightmost=split.fromEnd?split.min:split.max;
  const next=event.key==='ArrowLeft'?now+left*STEP:event.key==='ArrowRight'?now-left*STEP:event.key==='Home'?leftmost:event.key==='End'?rightmost:null;
  if(next===null)return;
  event.preventDefault();remember(name,apply(root,name,next));moved();
 });
}
