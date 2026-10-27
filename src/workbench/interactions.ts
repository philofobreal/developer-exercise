/** Accessible navigation, draft continuity and action feedback share one UI policy. */
import type {AttemptSnapshot,ViewName,WorkbenchState} from './contracts.js';
import {captureAuthorRequest} from './author-workspace.js';
const views:readonly ViewName[]=['sort','edit','author','model'];
export function activateView(state:WorkbenchState,attempt:AttemptSnapshot|undefined,formatted:string[],next:ViewName):void {
 if(!views.includes(next))return;
 if(next==='edit'&&attempt&&!attempt.editorDirty){attempt.draft=formatted.join('\n');attempt.editorGeneration=attempt.generation;}
 state.view=next;
}
export function markEditorDraft(attempt:AttemptSnapshot,text:string):void {if(!attempt.editorDirty)attempt.editorGeneration=attempt.generation;attempt.draft=text;attempt.editorDirty=true;}
export function markEditorApplied(attempt:AttemptSnapshot):void {attempt.editorDirty=false;attempt.editorGeneration=attempt.generation;}
export function reloadEditorFromArrangement(attempt:AttemptSnapshot,formatted:string[]):void {attempt.draft=formatted.join('\n');markEditorApplied(attempt);}
/** A late formatter response must still belong to the same untouched draft. */
export function captureEditorRequest(editor:HTMLTextAreaElement,state:WorkbenchState,attempt:AttemptSnapshot|undefined,getAttempt:()=>AttemptSnapshot|undefined,language:()=>string):()=>boolean {
 const text=editor.value,active=state.active,view=state.view,generation=attempt?.generation,originalLanguage=language();
 return ()=>editor.isConnected&&editor.value===text&&state.active===active&&state.view===view&&getAttempt()===attempt&&attempt?.generation===generation&&language()===originalLanguage;
}
/** Row buttons target the adjacent movable slot, skipping fixed physical slots. */
export function adjacentMoveBoundary(position:number,direction:-1|1,length:number,isFixed:(position:number)=>boolean):number {
 for(let target=position+direction;target>=0&&target<length;target+=direction)if(!isFixed(target))return target+(direction===1?1:0);
 return position;
}
export function installWorkbenchKeyboard(root:HTMLElement):void {
 root.addEventListener('keydown',event=>{
  const target=event.target instanceof Element?event.target:null,tab=target?.closest<HTMLButtonElement>('[role="tab"]');
  if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
   const tabs=[...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')],index=tabs.indexOf(tab);
   const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
   event.preventDefault();tabs[next]?.focus();return;
  }
  if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!event.altKey){
   const active=root.dataset.renderedView;
   const selector=active==='author'?'.step-panel [data-author-apply],[data-model-apply]':active==='model'?'[data-model-apply]':active==='edit'?'[data-apply]':'[data-check]';
   event.preventDefault();root.querySelector<HTMLButtonElement>(selector)?.click();
  }
 });
}
const running=new WeakSet<HTMLButtonElement>();
export async function dispatchWorkbenchAction(event:MouseEvent,handler:(button:HTMLButtonElement)=>Promise<void>,onError?:(error:unknown)=>void):Promise<void>{
 const button=event.target instanceof Element?event.target.closest<HTMLButtonElement>('button'):null;if(!button||running.has(button))return;
 const busy=button.matches('[data-check],[data-author-apply],[data-model-apply],[data-model-refresh],[data-format],[data-author-format],[data-author-sample],[data-rule-edit],[data-rule-connect]');
 const original=button.innerHTML,disabled=button.disabled,hadFocus=document.activeElement===button,owner=button.closest<HTMLElement>('#app');
 const context=owner?{exercise:owner.dataset.renderedExercise,view:owner.dataset.renderedView}:undefined;
 const action=button.getAttributeNames().find(name=>name.startsWith('data-'));
 if(busy){running.add(button);button.disabled=true;button.setAttribute('aria-busy','true');button.textContent=button.hasAttribute('data-check')?'Ellenőrzés…':button.hasAttribute('data-author-apply')?'Előnézet készül…':'Feldolgozás…';}
 try{await handler(button);}catch(error){if(onError)onError(error);else throw error;}
 finally{if(busy){
  running.delete(button);if(button.isConnected){button.disabled=disabled;button.removeAttribute('aria-busy');button.innerHTML=original;}
  if(hadFocus&&action&&owner&&context&&context.exercise===owner.dataset.renderedExercise&&context.view===owner.dataset.renderedView&&document.activeElement===document.body)owner.querySelector<HTMLButtonElement>('['+action+']')?.focus({preventScroll:true});
 }}
}

/** Two author inputs converge on the same compiled preview; learner mode is UI isolation, not authorization. */
export function installAuthoringFlows(root:HTMLElement,state:WorkbenchState,render:()=>void):void {
 let returnView:ViewName='sort';
 root.addEventListener('input',event=>{
  const editor=event.target;if(!(editor instanceof HTMLTextAreaElement))return;
  if(editor.id==='code-editor'){
   const status=root.querySelector<HTMLElement>('[data-editor-status]');if(status){status.textContent='Nem alkalmazott változat';status.classList.add('pending');}
   const tab=root.querySelector<HTMLElement>('[data-view="edit"]');if(tab&&!tab.querySelector('.dirty-dot')){const dot=document.createElement('span');dot.className='dirty-dot';dot.setAttribute('aria-label','Nem alkalmazott változtatás');tab.append(dot);}
  }else if(editor.id==='model-editor'){
   const applied=state.previews.has(state.active??'')?state.authorModel:undefined,dirty=!!editor.value&&(!applied||editor.value!==JSON.stringify(applied,null,2));
   const status=root.querySelector<HTMLElement>('[data-model-status]');if(status){status.textContent=dirty?'Nem alkalmazott JSON':applied?'Aktív modell':'Új feladat JSON-ból';status.classList.toggle('pending',dirty);}
  }
 });

 root.addEventListener('click',event=>{
  if(!(event.target instanceof Element)||!event.target.closest('[data-preview-toggle]'))return;
  if(state.learnerPreview){state.learnerPreview=false;state.view=returnView;}
  else{returnView=state.view;state.learnerPreview=true;if(state.view!=='edit')state.view='sort';}
  render();root.querySelector<HTMLButtonElement>('[data-preview-toggle]')?.focus({preventScroll:true});
 });
 root.addEventListener('change',async event=>{
  const input=event.target;if(!(input instanceof HTMLInputElement)||!input.hasAttribute('data-source-file'))return;
  const file=input.files?.[0];if(!file)return;const current=captureAuthorRequest(state);
  try{
   if(file.size>200000)throw Error('A forrásfájl legfeljebb 200 KB lehet.');
   const source=(await file.text()).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
   if(source.length>50000)throw Error('Legfeljebb 50000 karakteres forrás tölthető be.');
   if(!current())return;
   state.author.source=source;if(/\.ts$/i.test(file.name))state.author.language='typescript';else if(/\.(mjs|js)$/i.test(file.name))state.author.language='javascript';
   state.author.message=`${file.name} betöltve. A forrás még nincs alkalmazva. A cím és leírás nem változik automatikusan; ellenőrizd őket.`;
  }catch(error){if(!current())return;state.author.message=error instanceof Error?error.message:'A forrásfájl nem olvasható.';}
  if(!state.learnerPreview&&state.view==='author')render();
 });
 root.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('[data-import-source]'))root.querySelector<HTMLInputElement>('[data-source-file]')?.click();});
}
