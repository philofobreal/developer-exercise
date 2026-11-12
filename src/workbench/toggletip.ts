/** ADR-141 (T1): the ⓘ bubble floats in the top layer (a `popover`) beside its button and moves nothing on the page.
 *
 * Hidden here: where the bubble stands (under the button, or above it when there is more room there, clamped to the
 * viewport with a 16 px margin and never taller than the room, its rest scrolling inside); when it closes besides the
 * browser's own Escape and outside click (the focus leaving it, its button leaving the screen); and that a render the
 * reader did not cause (ADR-136) opens the same bubble again. The markup is `renderInfo`'s (help-topics.ts): a
 * `.toggletip` holding an `.info-button` and its `.toggletip-panel[popover]`; the pairing ids are given here, per render,
 * so the string renderers stay pure. */
const MARGIN=16,GAP=6,MIN_ROOM=160;
type Open={help:string;index:number};

function place(button:HTMLElement,panel:HTMLElement):void {
 panel.style.maxHeight='none';panel.style.left='0px';panel.style.top='0px';
 const width=document.documentElement.clientWidth,height=window.innerHeight;
 let box=button.getBoundingClientRect();const natural=panel.offsetHeight;
 let below=height-box.bottom-GAP-MARGIN,above=box.top-GAP-MARGIN;
 // A button at an edge leaves no room on either side: bring it to the middle first.
 if(Math.max(below,above)<Math.min(natural,MIN_ROOM)){button.scrollIntoView({block:'center'});box=button.getBoundingClientRect();below=height-box.bottom-GAP-MARGIN;above=box.top-GAP-MARGIN;}
 const under=natural<=below||below>=above,room=Math.max(0,under?below:above),shown=Math.min(natural,room);
 panel.style.maxHeight=`${Math.floor(room)}px`;
 const left=Math.max(MARGIN,Math.min(box.left,width-MARGIN-panel.offsetWidth));
 panel.style.left=`${Math.round(left)}px`;
 panel.style.top=`${Math.round(under?box.bottom+GAP:box.top-GAP-shown)}px`;
 panel.dataset.side=under?'below':'above';
}

export interface Toggletips {
 /** After every render: pairs each button with its bubble; `background` (ADR-136) reopens the bubble open before. */
 rendered(options?:{background?:boolean}):void;
}

export function installToggletips(root:HTMLElement):Toggletips {
 let open:Open|null=null,frame=0;
 const tips=():HTMLElement[]=>[...root.querySelectorAll<HTMLElement>('.toggletip')];
 const parts=(tip:Element):{button:HTMLElement;panel:HTMLElement}|null=>{
  const button=tip.querySelector<HTMLElement>(':scope > .info-button'),panel=tip.querySelector<HTMLElement>(':scope > .toggletip-panel');
  return button&&panel?{button,panel}:null;
 };
 const shown=():HTMLElement|null=>root.querySelector<HTMLElement>('.toggletip-panel:popover-open');
 function follow():void {
  if(frame)return;
  frame=requestAnimationFrame(()=>{
   frame=0;const panel=shown(),tip=panel?.parentElement,button=tip&&parts(tip)?.button;if(!panel||!button)return;
   const box=button.getBoundingClientRect();
   // A bubble whose button scrolled away would float beside nothing.
   if(box.bottom<0||box.top>window.innerHeight){panel.hidePopover();return;}
   place(button,panel);
  });
 }
 root.addEventListener('toggle',event=>{
  const panel=event.target;if(!(panel instanceof HTMLElement)||!panel.matches('.toggletip-panel'))return;
  const tip=panel.parentElement,pair=tip&&parts(tip);if(!tip||!pair)return;
  const isOpen=(event as ToggleEvent).newState==='open';pair.button.setAttribute('aria-expanded',String(isOpen));
  if(!isOpen){if(open&&open.help===tip.dataset.help)open=null;return;}
  open={help:tip.dataset.help??'',index:tips().filter(item=>item.dataset.help===tip.dataset.help).indexOf(tip)};
  place(pair.button,panel);
 },true);
 // The focus leaving the bubble and its button closes it: nothing under it is reached while it covers it (WCAG 2.4.11).
 // A click on the bubble's own text moves the focus nowhere (no related target) and leaves it open.
 root.addEventListener('focusout',event=>{
  const tip=event.target instanceof Element?event.target.closest('.toggletip'):null,next=event.relatedTarget;
  if(!tip||!(next instanceof Node)||tip.contains(next))return;
  const panel=parts(tip)?.panel;if(panel?.matches(':popover-open'))panel.hidePopover();
 });
 addEventListener('scroll',follow,{capture:true,passive:true});addEventListener('resize',follow);
 return {rendered({background=false}={}){
  tips().forEach((tip,index)=>{const pair=parts(tip);if(!pair)return;pair.panel.id=`toggletip-${index}`;pair.button.setAttribute('popovertarget',pair.panel.id);pair.button.setAttribute('aria-expanded','false');});
  const again=background?open:null;open=null;if(!again)return;
  const tip=tips().filter(item=>item.dataset.help===again.help)[again.index],pair=tip&&parts(tip);
  if(pair)pair.panel.showPopover();
 }};
}
