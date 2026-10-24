/** Reference working copies belong to exercises; learner arrangements stay in the attempt. */
import type {AuthorDraft,ExerciseSummary,WorkbenchState} from './contracts.js';
import type {CodeLineExercise} from '../../dist/index.js';

const same=(a:AuthorDraft,b:AuthorDraft):boolean=>a.source===b.source&&a.language===b.language&&a.title===b.title&&a.description===b.description;
export function authorDraftPending(state:WorkbenchState):boolean {
 return !!state.authorBaseline&&!same(state.author,state.authorBaseline);
}
export function refreshAuthorStatus(root:HTMLElement,state:WorkbenchState):void {
 const pending=authorDraftPending(state),status=root.querySelector<HTMLElement>('[data-author-status]');
 if(status){status.textContent=pending?'Nem alkalmazott referencia':'A feladat referenciaforrása';status.classList.toggle('pending',pending);}
 const tab=root.querySelector<HTMLElement>('[data-view="author"]');
 if(pending&&tab&&!tab.querySelector('.dirty-dot')){const dot=document.createElement('span');dot.className='dirty-dot';dot.setAttribute('aria-label','Nem alkalmazott referencia');tab.append(dot);}
 else if(!pending)tab?.querySelector('.dirty-dot')?.remove();
}
interface Workspace {author:AuthorDraft;baseline:AuthorDraft;modelDraft:string;modelMessage:string;authorModel?:CodeLineExercise;}
export function createAuthorWorkspace(state:WorkbenchState){
 const drafts=new Map<string,Workspace>();let current:string|null=null;
 const key=(exercise:Pick<ExerciseSummary,'id'|'revision'>):string=>JSON.stringify([exercise.id,exercise.revision]);
 const save=():void=>{if(current)drafts.set(current,structuredClone({author:state.author,baseline:state.authorBaseline??state.author,modelDraft:state.modelDraft,modelMessage:state.modelMessage,authorModel:state.authorModel}));};
 function select(exercise:ExerciseSummary):void {
  save();current=key(exercise);
  let workspace=drafts.get(current);
  if(!workspace){
   const author:AuthorDraft={title:exercise.title,description:exercise.description,language:exercise.language,source:exercise.lines.map(l=>l.code).join('\n'),message:''};
   workspace={author,baseline:{...author},modelDraft:'',modelMessage:''};
  }
  const copy=structuredClone(workspace);
  state.author=copy.author;state.authorBaseline=copy.baseline;state.modelDraft=copy.modelDraft;state.modelMessage=copy.modelMessage;state.authorModel=copy.authorModel;state.active=exercise.id;
 }
 /** Call only after installPreview succeeds; save() must precede that atomic admission. */
 function admit(model:CodeLineExercise,source?:string):void {
  const author:AuthorDraft={title:model.title,description:model.description,language:model.language,source:source??model.lines.map(l=>l.code).join('\n'),message:''};
  state.author=author;state.authorBaseline={...author};current=key(model);save();
  const activeKeys=new Set(state.exercises.map(key));for(const oldKey of drafts.keys())if(!activeKeys.has(oldKey))drafts.delete(oldKey);
 }
 return {select,save,admit};
}
/** Async admission is for the captured reference, never newer text or a different task. */
export function captureAuthorAdmission(state:WorkbenchState):()=>boolean {
 const active=state.active,author={...state.author},modelDraft=state.modelDraft;
 return ()=>state.active===active&&same(author,state.author)&&state.modelDraft===modelDraft;
}
