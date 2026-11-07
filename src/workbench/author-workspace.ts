/** The author's one reference project (ADR-022): the source draft, the baseline the applied
 * model was built from, and the guards that keep late responses from replacing newer work.
 * Practice attempts never read or change it. */
import type {AuthorDraft,ExerciseSummary,WorkbenchState} from './contracts.js';
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
/** The reference differs from the one the applied model was built from (or none was built yet). */
export function authorDraftPending(state:WorkbenchState):boolean {
 return !!state.authorBaseline&&!same(state.author,state.authorBaseline);
}
export function refreshAuthorStatus(root:HTMLElement,state:WorkbenchState):void {
 const pending=authorDraftPending(state),status=root.querySelector<HTMLElement>('[data-author-status]');
 if(status){status.textContent=!state.authorBaseline?'Még nem készült modell':pending?'Nem alkalmazott referencia':'A modell ebből a forrásból készült';status.classList.toggle('pending',pending);}
 const step=root.querySelector<HTMLElement>('[data-step="source"]');
 if(pending&&step&&!step.querySelector('.dirty-dot')){const dot=document.createElement('span');dot.className='dirty-dot';dot.setAttribute('aria-label','Nem alkalmazott referencia');step.append(dot);}
 else if(!pending)step?.querySelector('.dirty-dot')?.remove();
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
/** An example is a starting point: its reference becomes the unapplied draft. */
export function startFromExample(state:WorkbenchState,exercise:ExerciseSummary):void {
 nextRequest(state);
 state.author={...NEW_DRAFT_SETTINGS,title:exercise.title,description:exercise.description,...(exercise.level?{level:exercise.level}:{}),language:exercise.language,source:exercise.lines.map(line=>line.code).join('\n'),message:`A(z) „${exercise.title}” példa referenciája betöltve. A modell a Modell készítése gombbal készül el belőle.`};
}
/** Discards unapplied reference edits: the draft returns to what the applied model was built from. */
export function revertAuthorDraft(state:WorkbenchState):void {
 if(!state.authorBaseline)return;
 nextRequest(state);state.author={...state.authorBaseline,message:'A nem alkalmazott változtatásokat elvetettük.'};
}
/** Call only after installPreview succeeds: the admitted model becomes the reference baseline.
 * `keepPending`: a rule edit changes no line, so an unapplied reference draft stays pending. `policy`: the
 * resolution the draft was admitted under; its preflight options become the author's (ADR-108, E7). */
export function admitAuthorModel(state:WorkbenchState,model:CodeLineExercise,source?:string,{keepPending=false,policy}:{keepPending?:boolean;policy?:PolicyResolution}={}):void {
 nextRequest(state);
 const pending=keepPending&&authorDraftPending(state)?state.author:undefined,environment=model.authoring?.evidence?.environment,importEmit=environment?.importEmit,inputs=environment?.inputs,keyOrder=environment?.keyOrder,classFields=environment?.classFields;
 const author:AuthorDraft={title:model.title,description:model.description,...(model.level?{level:model.level}:{}),language:model.language,source:source??model.lines.map(l=>l.code).join('\n'),message:'',...(importEmit?{importEmit}:{}),...(inputs==='valid'?{inputs}:{}),...(keyOrder==='ignored'?{keyOrder}:{}),...(classFields==='define'?{classFields}:{})};
 const preflight=Object.fromEntries((['portability','unknownPolicy','tsDiagnostics','jsCheck','objectState'] as const).flatMap(path=>policy?.requested[path]?[[path,policy.requested[path]]]:[]));
 if(Object.keys(preflight).length)author.policy=preflight;
 state.author=pending??author;state.authorBaseline={...author};if(policy&&!pending)state.authorPolicy=policy;
}
