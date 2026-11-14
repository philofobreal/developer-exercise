/**
 * ADR-120 (U3): what an action can do now, decided in one place. The view draws from it (a disabled control stays
 * focusable with aria-disabled and carries its reason), the click guard refuses a disabled control before any handler
 * runs and shows the reason, and the handlers ask the same question as a last defence. Three answers:
 *  - hidden: never meaningful in this situation (the view leaves the control out);
 *  - disabled, with a reason: possible later, not now (the reason says what to do);
 *  - enabled.
 * ADR-154: where the server serves no authoring to this client (`state.authoring===false`), authoring and the tools
 * that run on the author service are hidden: the page is practice only.
 * One draft at a time: while the CodeLine JSON or the source/settings differ from the applied model, the visual rule
 * editor waits, so two drafts of one model never diverge.
 */
import type {AttemptSnapshot,WorkbenchState} from './contracts.js';
import {authorDraftPending,evidenceStale} from './author-workspace.js';
import {jsonPending} from './flow.js';
import {hasLocalSave} from './persistence.js';
import {escapeHtml} from './ui-utilities.js';

export type Availability={state:'enabled'}|{state:'disabled';reason:string}|{state:'hidden'};
const ACTIONS=['author-apply','author-check','authoring','format-solution','load-local','reset','rule-edit'] as const;
export type Action=typeof ACTIONS[number];
const isAction=(value:unknown):value is Action=>(ACTIONS as readonly unknown[]).includes(value);

const enabled:Availability={state:'enabled'};
const disabled=(reason:string):Availability=>({state:'disabled',reason});
/** What a request for authoring is told where it is not served (a link from the help page can still ask). */
export const AUTHORING_NOT_SERVED='A feladatkészítés ezen a szerveren nem érhető el. A gyakorlás használható.';

export function availability(state:WorkbenchState,action:Action,attempt?:AttemptSnapshot):Availability {
 switch(action){
  case 'author-apply':
   if(!state.author.source.trim())return disabled('Nincs forrás: írj be kódot, vagy nyiss meg egy példát vagy fájlt.');
   if(state.authorBaseline&&!authorDraftPending(state))return disabled('A modell naprakész: ebből a forrásból és ezekkel a beállításokkal készült.');
   return enabled;
  case 'author-check':
   return state.author.source.trim()?enabled:disabled('Nincs forrás: írj be kódot, vagy nyiss meg egy példát vagy fájlt.');
  case 'authoring':
  case 'format-solution':
   return state.authoring===false?{state:'hidden'}:enabled;
  case 'load-local':
   return hasLocalSave()?enabled:disabled('Ebben a böngészőben még nincs mentett munka. A Mentés a böngészőbe után nyitható meg.');
  case 'reset':
   return attempt&&attempt.answer.some(id=>id!==null)?enabled:disabled('A megoldás üres, nincs mit újrakezdeni.');
  case 'rule-edit':
   if(jsonPending(state))return disabled('A CodeLine JSON-ban alkalmazatlan módosítás van. Alkalmazd vagy vesd el, és utána szerkeszd itt a szabályokat.');
   if(evidenceStale(state))return disabled('A forrás vagy az elemzési beállítás megváltozott a modell óta. Készítsd újra a modellt, vagy vesd el a változtatásokat.');
   return enabled;
 }
}
/** The attributes that mark a control disabled with its reason (empty when it is enabled). */
export function disabledAttributes(answer:Availability):string {
 return answer.state==='disabled'?` aria-disabled="true" data-disabled-reason="${escapeHtml(answer.reason)}" title="${escapeHtml(answer.reason)}"`:'';
}
/** The reason a disabled answer gives, or '' (for the handlers' own last check). */
export const reasonOf=(answer:Availability):string=>answer.state==='disabled'?answer.reason:'';
/** The attributes for a control whose availability can change without a redraw (typing in the source editor, a save):
 *  its action name and its current answer. `refreshAvailability` keeps them current. */
export function availabilityAttributes(state:WorkbenchState,action:Action,attempt?:AttemptSnapshot):string {
 return ` data-availability="${action}"${disabledAttributes(availability(state,action,attempt))}`;
}
/** Updates every control marked with data-availability in place, after an input that does not redraw the view. */
export function refreshAvailability(root:ParentNode,state:WorkbenchState,attempt?:AttemptSnapshot):void {
 for(const control of root.querySelectorAll<HTMLElement>('[data-availability]')){
  const action=control.dataset.availability;if(!isAction(action))continue;
  const answer=availability(state,action,attempt);
  if(answer.state==='disabled'){control.setAttribute('aria-disabled','true');control.dataset.disabledReason=answer.reason;control.title=answer.reason;}
  else if(control.getAttribute('aria-disabled')==='true'){control.removeAttribute('aria-disabled');delete control.dataset.disabledReason;control.removeAttribute('title');}
 }
}
