/** The workbench's two modes and the author's three steps (ADR-022). This module alone knows
 * which step can be entered, which model each step shows and what is stale; views and
 * handlers ask here instead of re-deriving it from scattered flags.
 *
 * Author (ADR-123): Kód (`author`) → Elemzés és szabályok (`model`) → Próba és kiadás (`sort` | `edit`). Rules and try
 * need an applied model; every later step shows that model, and a reference or JSON edit made
 * after it marks them stale until it is applied or discarded. Practice: the trusted exercises,
 * `sort` | `edit` only. Learner preview is UI isolation inside the author's try step. */
import type {AttemptSnapshot,Mode,ViewName,WorkbenchState} from './contracts.js';
import {authorDraftPending,evidenceStale,modelJson} from './author-workspace.js';
import {activateView} from './interactions.js';
import {taskStatus} from './task-status.js';
import {escapeHtml as esc} from './ui-utilities.js';
import {icon} from './icons.js';

export type Step='source'|'rules'|'try';
export const stepOf=(view:ViewName):Step=>view==='author'?'source':view==='model'?'rules':'try';
const NEEDS_MODEL='Előbb készíts modellt a Kód lépésben.';

/** The applied author model's preview exercise id; there is at most one. */
export const authorPreviewId=(state:WorkbenchState):string|null=>state.previews.keys().next().value??null;
/** Whose scroll, focus and open details a render restores. Every admission (a rule edit, a refresh,
 * a rebuild) yields a new preview id, but it is still the one author project; a practice exercise
 * is its own identity. */
export const continuityKey=(state:WorkbenchState):string=>(state.mode==='author'?'author-project':state.active??'none')+':'+state.mode;
export function jsonPending(state:WorkbenchState):boolean {
 const model=authorPreviewId(state)?state.authorModel:undefined;
 return !!state.modelDraft&&(!model||state.modelDraft!==modelJson(model));
}
/** Why the steps after the source no longer show the latest author intent, or ''. */
export function staleReason(state:WorkbenchState):string {
 if(!authorPreviewId(state))return '';
 const base=state.authorBaseline;
 if(authorDraftPending(state))return base&&base.source===state.author.source&&base.language===state.author.language
  ?'A vizsgálati vagy az elemzési beállítások a modell készítése óta változtak; a szabályok és a próba még a korábbi beállításokkal készült modellt mutatják.'
  :'A referenciaforrás az utolsó modellkészítés óta módosult; a szabályok és a próba még a korábbi modellt mutatják.';
 return jsonPending(state)?'Az Elemzés és szabályok lépés JSON-jában nem alkalmazott módosítás van; a próba még az aktív modellt használja.':'';
}

/** `status`: the step's state in one word of one vocabulary, as text (colour only adds to it): Kész, Figyelem, Hiba,
 * Zárolt or Elavult (ADR-122). The source step speaks for the first gate, the Rules step for the task status card,
 * the Try step for the second gate. */
export interface StepState {step:Step;view:ViewName;number:number;label:string;hint:string;current:boolean;locked:string;stale:boolean;status:string;tone:''|'locked'|'stale'|'blocked'|'warning';}
/** The first gate's word on the source; only for the text it checked, so typing clears it. */
function sourceStatus(state:WorkbenchState):Pick<StepState,'status'|'tone'> {
 const record=state.sourceGate;
 if(!record||record.source!==state.author.source)return {status:'',tone:''};
 return record.gate.verdict==='blocked'?{status:'Hiba',tone:'blocked'}:record.gate.verdict==='inconclusive'?{status:'Figyelem',tone:'warning'}:{status:'Kész',tone:''};
}
/** The task status card's word on the applied model (ADR-122). */
function rulesStatus(state:WorkbenchState):Pick<StepState,'status'|'tone'> {
 const tone=taskStatus(state)?.tone;
 return tone==='error'?{status:'Hiba',tone:'blocked'}:tone==='warning'?{status:'Figyelem',tone:'warning'}:tone==='ok'?{status:'Kész',tone:''}:{status:'',tone:''};
}
/** The second gate's word on the applied draft: admitted with a warning (an unverified model, an undecided check). */
function tryStatus(state:WorkbenchState):Pick<StepState,'status'|'tone'> {
 const gate=state.authorInsight?.tryGate;
 return gate?.verdict==='inconclusive'&&gate.admitted?{status:'Figyelem',tone:'warning'}:gate&&!gate.admitted?{status:'Zárolt',tone:'blocked'}:{status:'',tone:''};
}
const STALE_EVIDENCE='A Próba lépés nem nyitható meg: a forrás vagy az elemzési beállítások a modell készítése óta változott; készítsd újra a modellt, vagy vesd el a változtatást.';
/** ADR-108 (E6): whether the author's Try step opens now. The draft brings the second gate's decision for the
 * source and policy it was made from; a source or setting changed since makes that decision stale. A draft
 * without one stays closed. Opening is navigation only: the server checks every preview again. */
export function tryAdmission(state:WorkbenchState):{ok:boolean;message:string} {
 if(!authorPreviewId(state))return {ok:false,message:NEEDS_MODEL};
 if(evidenceStale(state))return {ok:false,message:STALE_EVIDENCE};
 const gate=state.authorInsight?.tryGate;
 if(!gate)return {ok:false,message:'A Próba lépés nem nyitható meg: ehhez a modellhez nincs második kapus döntés; készítsd újra a modellt.'};
 return {ok:gate.admitted,message:gate.message};
}
export function flowSteps(state:WorkbenchState):StepState[] {
 const current=stepOf(state.view),locked=authorPreviewId(state)?'':NEEDS_MODEL,stale=!!staleReason(state);
 const later=(step:'rules'|'try'):Pick<StepState,'status'|'tone'>=>locked?{status:'Zárolt',tone:'locked'}:stale?{status:'Elavult',tone:'stale'}:step==='try'?tryStatus(state):rulesStatus(state);
 return [
  {step:'source',view:'author',number:1,label:'Kód',hint:'A helyes, olvasható referenciaforrás és a vizsgálata',current:current==='source',locked:'',stale:false,...sourceStatus(state)},
  {step:'rules',view:'model',number:2,label:'Elemzés és szabályok',hint:'A feladat állapota, az elemzési beállítások és a sorrendi szabályok',current:current==='rules',locked,stale,...later('rules')},
  {step:'try',view:'sort',number:3,label:'Próba és kiadás',hint:'Tanulói próba, tanulói adatok és exportálás',current:current==='try',locked,stale,...later('try')}
 ];
}
/** The author's stepper. `done`: a step behind the current one that is neither locked, stale nor refused. */
export function renderStepper(state:WorkbenchState):string {
 const steps=flowSteps(state),here=steps.findIndex(s=>s.current);
 return `<nav class="stepper" aria-label="A feladatkészítés lépései"><ol>${steps.map((s,i)=>{const done=i<here&&!s.locked&&!s.stale&&s.tone!=='blocked';return `<li><button type="button" data-step="${s.step}" class="step ${s.current?'current':''} ${done?'done':''} ${s.locked?'locked':''} ${s.stale?'stale':''} ${s.tone?'tone-'+s.tone:''}" ${s.current?'aria-current="step"':''} ${s.locked?`disabled aria-disabled="true" title="${esc(s.locked)}"`:`title="${esc(s.hint)}"`}><span class="step-number" aria-hidden="true">${done?icon('check'):String(s.number).padStart(2,'0')}</span><span class="step-text"><b>${s.label}</b><small data-step-status>${s.status}</small></span></button></li>`;}).join('')}</ol></nav>`;
}
/** Brings each step's word and tone up to date in place, after an input that does not redraw (typing in the source). */
export function refreshStepper(root:ParentNode,state:WorkbenchState):void {
 for(const s of flowSteps(state)){
  const button=root.querySelector<HTMLElement>(`[data-step="${s.step}"]`),word=button?.querySelector<HTMLElement>('[data-step-status]');
  if(!button||!word)continue;
  word.textContent=s.status;
  for(const tone of ['locked','stale','blocked','warning'] as const)button.classList.toggle('tone-'+tone,s.tone===tone);
 }
}
/** Why a view cannot be entered now, or ''. */
export function blockedReason(state:WorkbenchState,view:ViewName):string {
 if(state.mode==='practice'||state.learnerPreview)return view==='sort'||view==='edit'?'':'Ebben a nézetben csak a rendező és a megoldáskód érhető el.';
 return view==='author'||authorPreviewId(state)?'':NEEDS_MODEL;
}
/** Enters a view when allowed; entering the solution editor captures the current arrangement. */
export function enterView(state:WorkbenchState,attempt:AttemptSnapshot|undefined,formatted:string[],next:ViewName):boolean {
 if(blockedReason(state,next))return false;
 activateView(state,attempt,formatted,next);
 return state.view===next;
}
/** Switches mode; each mode keeps its own active exercise and returns to its own view. */
export function enterMode(state:WorkbenchState,mode:Mode):void {
 if(state.mode===mode)return;
 const views=state.modeViews??={};
 views[state.mode]=state.view;state.learnerPreview=false;state.mode=mode;
 if(mode==='practice'){
  const trusted=state.exercises.filter(exercise=>!state.previews.has(exercise.id));
  state.practiceActive=trusted.some(exercise=>exercise.id===state.practiceActive)?state.practiceActive:trusted[0]?.id??null;
  state.active=state.practiceActive??null;
 }else state.active=authorPreviewId(state);
 const back=views[mode]??(mode==='practice'?'sort':'author');
 state.view=blockedReason(state,back)?(mode==='practice'?'sort':'author'):back;
}
/** After a new author model is installed: where the author continues. */
export function landAfterAdmission(state:WorkbenchState,land:'rules'|'try'|'stay'):void {
 state.mode='author';state.active=authorPreviewId(state);
 if(land==='rules')state.view='model';
 else if(land==='try')state.view='sort';
 else if(blockedReason(state,state.view))state.view='model';
}
