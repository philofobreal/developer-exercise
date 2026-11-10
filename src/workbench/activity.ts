/**
 * ADR-127 (P1): one progress indicator for the work a user started and waits for (Modell készítése, Forrás vizsgálata,
 * Ellenőrzés, rule edits, Formázás, opening a sample, a file or a session). Hidden here: when it appears, how long it
 * stays, how it winds down, where it stands and what a screen reader hears.
 *
 * The timing follows the common delayed-spinner practice (Nielsen's 0.1 s / 1 s / 10 s limits; spin-delay, Carbon's
 * inline loading): work done within 400 ms shows nothing; once shown, the indicator stays at least 600 ms, so it never
 * flashes; when the work ends, its line fills (350 ms) and it fades (250 ms). It does not say „Kész”: the work's own
 * message says how it ended, and an operation can end with an error the indicator cannot see. After 3 s it counts the
 * seconds. Several operations share one slot: the latest one is named, and the slot winds down when the last ends.
 */

export const ACTIVITY_TIMING={delay:400,minimum:600,settle:350,leave:250,countAfter:3000} as const;
export type ActivityPhase='hidden'|'running'|'settling'|'leaving';
/** What the slot shows: the phase, the named work, its seconds (from 3 s on) and the control that started it. */
export interface ActivityView {phase:ActivityPhase;label:string;seconds?:number;source?:Element;}
export interface ActivityClock {now():number;set(callback:()=>void,ms:number):number;clear(handle:number):void;}
export interface Activity {track<T>(label:string,work:Promise<T>,source?:Element):Promise<T>;}

/** The timing alone, against any clock and any painter (the unit tests drive it with a fake clock). */
export function createActivity(clock:ActivityClock,paint:(view:ActivityView)=>void):Activity {
 interface Entry {label:string;start:number;source?:Element;}
 const active:Entry[]=[];
 let phase:ActivityPhase='hidden',shownAt=0,timer:number|undefined,shown:ActivityView={phase:'hidden',label:''};
 const later=(ms:number):void=>{if(timer!==undefined)clock.clear(timer);timer=clock.set(()=>{timer=undefined;step();},Math.max(0,ms));};
 const draw=(next:ActivityView):void=>{shown=next;paint(next);};
 function step():void {
  const now=clock.now(),top=active[active.length-1];
  if(top){
   if(phase==='hidden'){
    const first=Math.min(...active.map(entry=>entry.start));
    if(now<first+ACTIVITY_TIMING.delay){later(first+ACTIVITY_TIMING.delay-now);return;}
    shownAt=now;
   }
   phase='running';
   const elapsed=now-top.start,counting=elapsed>=ACTIVITY_TIMING.countAfter;
   draw({phase,label:top.label,...(counting?{seconds:Math.floor(elapsed/1000)}:{}),...(top.source?{source:top.source}:{})});
   later(counting?1000-elapsed%1000:ACTIVITY_TIMING.countAfter-elapsed);return;
  }
  if(phase==='hidden'){if(timer!==undefined){clock.clear(timer);timer=undefined;}return;}
  if(phase==='running'){
   if(now<shownAt+ACTIVITY_TIMING.minimum){later(shownAt+ACTIVITY_TIMING.minimum-now);return;}
   phase='settling';draw({...shown,phase});later(ACTIVITY_TIMING.settle);return;
  }
  if(phase==='settling'){phase='leaving';draw({...shown,phase});later(ACTIVITY_TIMING.leave);return;}
  phase='hidden';draw({phase,label:''});
 }
 return {
  track(label,work,source){
   const entry:Entry={label,start:clock.now(),...(source?{source}:{})};active.push(entry);step();
   const end=():void=>{const index=active.indexOf(entry);if(index>=0)active.splice(index,1);step();};
   work.then(end,end);return work;
  },
 };
}

/** The slot in the page: a status line for screen readers and, above everything (the top layer, so also over the
 *  full-screen workspace), a chip docked above the sticky action bar of the current step. */
function mountActivity(doc:Document):Activity {
 const live=doc.createElement('div');live.className='sr-only';live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.dataset.activityLive='';
 const chip=doc.createElement('div');chip.className='activity';chip.dataset.activity='';chip.setAttribute('aria-hidden','true');chip.hidden=true;
 const topLayer=typeof chip.showPopover==='function';if(topLayer)chip.popover='manual';
 chip.innerHTML='<span class="activity-text"><span class="activity-label"></span><span class="activity-seconds"></span></span><span class="activity-line"></span>';
 doc.body.append(live,chip);
 const label=chip.querySelector<HTMLElement>('.activity-label'),seconds=chip.querySelector<HTMLElement>('.activity-seconds');
 let marked:Element|undefined;
 const mark=(source?:Element):void=>{if(marked===source)return;marked?.removeAttribute('data-busy-shown');marked=source;source?.setAttribute('data-busy-shown','');};
 // The sticky bar at the bottom of the screen (a step's action bar, the result bar): the chip stands above it.
 const dock=():void=>{
  const height=doc.documentElement.clientHeight;let top=height;
  for(const bar of doc.querySelectorAll('.action-bar,.evaluation-bar')){const box=bar.getBoundingClientRect();if(box.height&&box.top<height&&box.bottom>=height-2)top=Math.min(top,box.top);}
  chip.style.setProperty('--activity-dock',`${Math.round(height-top)}px`);
 };
 const paint=(view:ActivityView):void=>{
  chip.dataset.phase=view.phase;
  if(view.phase==='hidden'){mark();live.textContent='';if(topLayer&&chip.matches(':popover-open'))chip.hidePopover();chip.hidden=true;return;}
  if(label)label.textContent=view.phase==='running'?`${view.label}…`:view.label;
  if(seconds)seconds.textContent=view.seconds===undefined?'':`${view.seconds} s`;
  if(view.phase==='running'){
   mark(view.source);
   const said=`${view.label} folyamatban.`;if(live.textContent!==said)live.textContent=said;
  }else mark();
  if(chip.hidden){chip.hidden=false;dock();if(topLayer)chip.showPopover();}
  else if(view.phase==='running')dock();
 };
 return createActivity({now:()=>performance.now(),set:(callback,ms)=>window.setTimeout(callback,ms),clear:handle=>window.clearTimeout(handle)},paint);
}

let shared:Activity|undefined;
/** Shows `work` in the page's one progress slot (if it lasts) and returns it unchanged. Outside a page it only returns it. */
export function trackActivity<T>(label:string,work:Promise<T>,source?:Element):Promise<T> {
 if(typeof document==='undefined'||!document.body)return work;
 shared??=mountActivity(document);
 return shared.track(label,work,source);
}
