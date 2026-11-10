/** The author's one reference project (ADR-022): the source draft, the baseline the applied
 * model was built from, and the guards that keep late responses from replacing newer work.
 * Practice attempts never read or change it. */
import type {AuthorDraft,ExerciseLevel,ExerciseSummary,SettingsOrigin,WorkbenchState} from './contracts.js';
import type {CodeLineExercise} from '../../dist/index.js';
import type {PolicyResolution} from '../../dist/author/preflight/config-resolver.js';
import {NEW_DRAFT_SETTINGS,settingsKey,settingsRequest} from './preflight-settings.js';

const same=(a:AuthorDraft,b:AuthorDraft):boolean=>a.source===b.source&&a.language===b.language&&a.title===b.title&&a.description===b.description&&(a.level||'')===(b.level||'')&&settingsKey(a)===settingsKey(b);
/** The generation request for the reference; the import emit is a TypeScript-only assumption (ADR-013),
 * the input contract (ADR-050), the key order (ADR-055) and the class-field mode (ADR-075) are choices of either language;
 * the preflight options (ADR-108) travel in `policy`, only where they differ from their start value. */
export function authorRequest(author:AuthorDraft):Omit<AuthorDraft,'message'> {
 const {title,description,level,language,source}=author;
 return {title,description,...(level?{level}:{}),language,source,...settingsRequest(author)};
}
/** ADR-108 (E6): the source or the analysis settings differ from those the applied model was made from, so
 * its gate decisions no longer speak for them (a title or level edit does not count). */
export function evidenceStale(state:WorkbenchState):boolean {
 const base=state.authorBaseline;
 return !!base&&(base.source!==state.author.source||settingsKey(base)!==settingsKey(state.author));
}
/** The reference differs from the one the applied model was built from (or none was built yet). */
export function authorDraftPending(state:WorkbenchState):boolean {
 return !!state.authorBaseline&&!same(state.author,state.authorBaseline);
}
export function refreshAuthorStatus(root:HTMLElement,state:WorkbenchState):void {
 const pending=authorDraftPending(state),status=root.querySelector<HTMLElement>('[data-author-status]');
 // A load can be undone only while the loaded draft is untouched (`canUndoReplace`).
 root.querySelector<HTMLElement>('[data-author-undo]')?.toggleAttribute('hidden',!canUndoReplace(state));
 if(status){status.textContent=!state.authorBaseline?'Még nem készült modell':pending?'Nem alkalmazott referencia':'A modell ebből a forrásból készült';status.classList.toggle('pending',pending);}
 const step=root.querySelector<HTMLElement>('[data-step="source"]');
 if(pending&&step&&!step.querySelector('.dirty-dot')){const dot=document.createElement('span');dot.className='dirty-dot';dot.setAttribute('aria-label','Nem alkalmazott referencia');step.append(dot);}
 else if(!pending)step?.querySelector('.dirty-dot')?.remove();
}
export type LearnerField='title'|'description'|'level';
const LEVELS:readonly ExerciseLevel[]=['beginner','intermediate','advanced'];
const isLevel=(value:string):value is ExerciseLevel=>(LEVELS as readonly string[]).includes(value);
/** ADR-123 (M5): the learner-facing text of the task (title, description, level) is set in the Próba és kiadás step and
 * changes the applied model in place. It is no evidence: the gates' fingerprints leave it out and grading never reads
 * it, so no reanalysis follows and no step turns stale. The draft, the applied baseline, the model, its listed preview
 * and an applied CodeLine JSON all change together; an unapplied JSON draft is the author's own and stays as typed.
 * An unknown field or level changes nothing (false). */
export function setLearnerData(state:WorkbenchState,field:string,value:string):boolean {
 if(field!=='title'&&field!=='description'&&field!=='level')return false;
 if(field==='level'&&value!==''&&!isLevel(value))return false;
 const model=state.authorModel,applied=!!model&&state.modelDraft===JSON.stringify(model,null,2);
 const targets:{title:string;description:string;level?:ExerciseLevel|''}[]=[state.author];
 if(state.authorBaseline)targets.push(state.authorBaseline);
 const listed=model?state.exercises.find(exercise=>exercise.id===model.id):undefined;
 if(model)targets.push(model);if(listed)targets.push(listed);
 for(const target of targets){
  if(field!=='level')target[field]=value;
  else if(isLevel(value))target.level=value;
  else delete target.level;
 }
 if(model&&applied)state.modelDraft=JSON.stringify(model,null,2);
 return true;
}
const nextRequest=(state:WorkbenchState):number=>state.authorRequestGeneration=(state.authorRequestGeneration??0)+1;
const previewId=(state:WorkbenchState):string|undefined=>state.previews.keys().next().value;
/** Capture at user intent, before file/clipboard/network I/O; the latest reference action wins. */
export function captureAuthorRequest(state:WorkbenchState):()=>boolean {
 const generation=nextRequest(state),current=captureAuthorAdmission(state);
 return ()=>generation===state.authorRequestGeneration&&current();
}
/** Async admission is for the captured reference and model, never newer text or another preview. */
export function captureAuthorAdmission(state:WorkbenchState):()=>boolean {
 const preview=previewId(state),author={...state.author},modelDraft=state.modelDraft;
 return ()=>previewId(state)===preview&&same(author,state.author)&&state.modelDraft===modelDraft;
}
/** Replaces the whole draft with a loaded starting point (an example, the TypeScript sample, a file), never
 * asking first: the draft it replaces can be brought back with `undoReplace` for as long as the author has not
 * changed the loaded one. The module keeps that point; callers only ask `canUndoReplace`. */
export function replaceDraft(state:WorkbenchState,next:AuthorDraft):void {
 nextRequest(state);
 const previous={...state.author};state.author=next;state.authorReplaced={previous,loaded:{...next}};
}
/** Whether the loaded draft is still untouched, so the one it replaced can come back. */
export function canUndoReplace(state:WorkbenchState):boolean {
 return !!state.authorReplaced&&same(state.author,state.authorReplaced.loaded);
}
/** ADR-121 (M4): a loaded starting point arrives formatted when its lines need laying out (one-line or badly broken code);
 * a source already broken into the formatter's lines keeps the author's own indentation. A source the formatter cannot read
 * arrives as it is, and the message says so. The caller then replaces the draft with it (replaceDraft), so one Undo brings
 * back what was there. */
export async function formatLoaded(next:AuthorDraft,format?:(source:string,language:string)=>Promise<{code:string}>):Promise<AuthorDraft> {
 if(!format||!next.source.trim())return next;
 try{
  const {code}=await format(next.source,next.language),lines=(text:string):string=>text.split('\n').map(line=>line.trim()).filter(Boolean).join('\n');
  return lines(code)===lines(next.source)?next:{...next,source:code,message:`${next.message} A forrást automatikusan formáztuk.`};
 }
 catch{return {...next,message:`${next.message} A forrás nem formázható (például szintaktikai hiba miatt), ezért változatlanul töltöttük be.`};}
}
/** Brings back the draft the last load replaced; a no-op once the loaded draft was changed. */
export function undoReplace(state:WorkbenchState):void {
 if(!canUndoReplace(state))return;
 nextRequest(state);state.author={...state.authorReplaced!.previous,message:'Visszaállítottuk a betöltés előtti forrást.'};delete state.authorReplaced;
}
/** An example is a starting point: its reference becomes the unapplied draft (undoable, `replaceDraft`). */
export function startFromExample(state:WorkbenchState,exercise:ExerciseSummary):void {
 replaceDraft(state,{...NEW_DRAFT_SETTINGS,title:exercise.title,description:exercise.description,...(exercise.level?{level:exercise.level}:{}),language:exercise.language,source:exercise.lines.map(line=>line.code).join('\n'),message:`A(z) „${exercise.title}” példa betöltve. A modell a Modell készítése gombbal készül el belőle.`});
}
/** Discards unapplied reference edits: the draft returns to what the applied model was built from. */
export function revertAuthorDraft(state:WorkbenchState):void {
 if(!state.authorBaseline)return;
 nextRequest(state);state.author={...state.authorBaseline,message:'A nem alkalmazott változtatásokat elvetettük.'};
}
/** Call only after installPreview succeeds: the admitted model becomes the reference baseline.
 * `keepPending`: a rule edit changes no line, so an unapplied reference draft stays pending. `policy`: the
 * resolution the draft was admitted under; its preflight options become the author's (ADR-108, E7).
 * `settingsOrigin` (E8): a model brought in from a file says where its settings come from; a model made from the
 * author's source carries the author's own choices (no origin); any other admission keeps the origin it had. */
export function admitAuthorModel(state:WorkbenchState,model:CodeLineExercise,source?:string,{keepPending=false,policy,settingsOrigin}:{keepPending?:boolean;policy?:PolicyResolution;settingsOrigin?:SettingsOrigin}={}):void {
 if(settingsOrigin)state.settingsOrigin=settingsOrigin;else if(source!==undefined)delete state.settingsOrigin;
 nextRequest(state);
 const pending=keepPending&&authorDraftPending(state)?state.author:undefined,environment=model.authoring?.evidence?.environment,importEmit=environment?.importEmit,inputs=environment?.inputs,keyOrder=environment?.keyOrder,classFields=environment?.classFields;
 const author:AuthorDraft={title:model.title,description:model.description,...(model.level?{level:model.level}:{}),language:model.language,source:source??model.lines.map(l=>l.code).join('\n'),message:'',...(importEmit?{importEmit}:{}),...(inputs==='valid'?{inputs}:{}),...(keyOrder==='ignored'?{keyOrder}:{}),...(classFields==='define'?{classFields}:{})};
 const preflight=Object.fromEntries((['portability','unknownPolicy','tsDiagnostics','jsCheck','objectState'] as const).flatMap(path=>policy?.requested[path]?[[path,policy.requested[path]]]:[]));
 if(Object.keys(preflight).length)author.policy=preflight;
 state.author=pending??author;state.authorBaseline={...author};if(policy&&!pending)state.authorPolicy=policy;
}
