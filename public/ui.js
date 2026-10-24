/** App orchestration and event wiring; business policy lives in attempts and API. */
import {createAttempt,createAttemptController} from './app/attempt.js';
import {createWorkbenchView} from './app/view.js';
import {createInsertionDrag} from './app/drag-insert.js';
import {createScrollMemory,updateGutters,copyToClipboard,escapeHtml} from './app/ui-utilities.js';
import {formatSource,getExercises,compileDraft,previewDraft,evaluate,loadTypeScriptFixture} from './app/api.js';
const root=document.querySelector('#app');
const state={exercises:[],active:null,attempts:new Map(),previews:new Map(),drag:null,view:'sort',author:{title:'Saját kódrendezős feladat',description:'Rendezd sorba a kódsorokat.',language:'javascript',source:`function calculate() {\n     const a = 10;\n     const b = 20;\n     return a + b;\n}`,message:''},modelDraft:'',modelMessage:''};
const ex=()=>state.exercises.find(x=>x.id===state.active);
const at=()=>state.attempts.get(state.active);
const attempt=createAttemptController(ex,at);
const {text,formattedAnswer}=attempt;
const view=createWorkbenchView({root,state,ex,at,attempt,scroll:createScrollMemory(root)});
const render=()=>view.render();
function commit(msg=''){at().report=null;at().feedback=msg;render();}
function movePoolToBoundary(index,boundary){if(!attempt.insertFromPool(index,boundary))return commit('Nincs szabad megoldássor.');commit();}
function moveAnswerToBoundary(index,boundary){if(attempt.moveInAnswer(index,boundary))commit();}
const firstFreeBoundary=()=>{const i=at().answer.findIndex(x=>x===null);return i<0?at().answer.length:i;};
function remove(index){if(attempt.back(index))commit();}
function applyEditor(){const result=attempt.applyText(root.querySelector('#code-editor').value);if(!result.ok)return commit(result.message);state.view='sort';commit();}
/** Commit a newly compiled author model atomically. Compatible attempts survive a
 * dependency-only edit, so the learner can immediately observe the new rules. */
async function authorApply(body,{preserveAttempt=false}={}){
 const prior=ex(),previousAttempt=at();
 const data=await compileDraft(body),m=data.model;
 const compatible=preserveAttempt&&prior&&previousAttempt&&
   prior.lines.length===m.lines.length&&prior.lines.every((line,i)=>{
     const next=m.lines[i];return line.id===next.id&&line.code===next.code&&line.fixed===next.fixed&&line.normalization===next.normalization;
   });
 const restored=compatible?previousAttempt:createAttempt(m);
 restored.report=null;restored.feedback='';
 for(const id of state.previews.keys())state.attempts.delete(id);
 state.exercises=state.exercises.filter(x=>!state.previews.has(x.id));
 state.previews.clear();
 const item={id:m.id,revision:m.revision,language:m.language,title:m.title,description:m.description,lines:m.lines};
 state.exercises.unshift(item);state.previews.set(item.id,data.draftId);
 state.attempts.set(item.id,restored);state.active=item.id;
 state.modelDraft=JSON.stringify(m,null,2);
 state.modelMessage=compatible?'A módosított szabályok érvényesek. A kitöltés megmaradt; ellenőrizheted az új függőségekkel.':'A módosított modell érvényes. A kitöltést az új szerkezethez visszaállítottuk.';
 state.author.message='A modell elkészült: '+m.lines.length+' sor, '+m.blocks.length+' blokk.';
 state.view='sort';commit(preserveAttempt?state.modelMessage:state.author.message);
}

root.addEventListener('click',async ev=>{const b=ev.target.closest('button');if(!b)return;const a=at();
 if(b.hasAttribute('data-fullscreen')){
   try{if(document.fullscreenElement===root)await document.exitFullscreen();else if(root.requestFullscreen)await root.requestFullscreen();else root.classList.toggle('ng-fullscreen');}
   catch{root.classList.toggle('ng-fullscreen');}
   return;
 }
 if(b.hasAttribute('data-copy-author')||b.hasAttribute('data-copy-editor')||b.hasAttribute('data-copy-model')||b.hasAttribute('data-copy-solution')){
   const value=b.hasAttribute('data-copy-author')?root.querySelector('#author-editor')?.value:
     b.hasAttribute('data-copy-editor')?root.querySelector('#code-editor')?.value:
     b.hasAttribute('data-copy-model')?root.querySelector('#model-editor')?.value:
     formattedAnswer().join('\n');
   const ok=await copyToClipboard(value??'');
   if(b.hasAttribute('data-copy-author'))state.author.message=ok?'Forráskód másolva.':'Másolás nem sikerült.';
   else if(b.hasAttribute('data-copy-model'))state.modelMessage=ok?'JSON másolva.':'Másolás nem sikerült.';
   else a.feedback=ok?'Kód másolva.':'Másolás nem sikerült.';
   render();return;
 }
 if(b.hasAttribute('data-author-sample')){
  try{state.author.source=await loadTypeScriptFixture();state.author.language='typescript';state.author.title='CopyFieldUtilityService';state.author.description='Mellékelt TypeScript service, 31 osztálytag';state.author.message='A 31 metódusos TypeScript minta betöltve.';render();}catch(err){state.author.message=err.message;render();}return;
 }
 if(b.dataset.task){state.active=b.dataset.task;state.view='sort';render();return;}
 if(b.dataset.view){if(b.dataset.view==='edit'){a.draft=formattedAnswer().join('\n');}state.view=b.dataset.view;render();return;}
 if(b.hasAttribute('data-reset')){state.attempts.set(state.active,createAttempt(ex()));render();return;}
 if(b.hasAttribute('data-all')){a.answer=ex().lines.map(x=>x.id);a.pool=[];a.custom=new Map();state.view='sort';commit();return;}
 if(b.hasAttribute('data-move')){movePoolToBoundary(+b.dataset.move,firstFreeBoundary());return;}
 if(b.hasAttribute('data-up')){moveAnswerToBoundary(+b.dataset.up,+b.dataset.up-1);return;}
 if(b.hasAttribute('data-down')){moveAnswerToBoundary(+b.dataset.down,+b.dataset.down+2);return;}
 if(b.hasAttribute('data-remove')){remove(+b.dataset.remove);return;}
 if(b.hasAttribute('data-format')){
   const ed=root.querySelector('#code-editor');if(!ed)return;
   try{const result=await formatSource(ed.value,ex().language);ed.value=result.code;a.draft=ed.value;a.feedback='Formázva: '+result.formatter;updateGutters(root);}
   catch(err){a.feedback=err.message;render();}return;
 }
 if(b.hasAttribute('data-apply')){applyEditor();return;}
 if(b.hasAttribute('data-author-format')){
   const ed=root.querySelector('#author-editor');if(!ed)return;
   try{const result=await formatSource(ed.value,state.author.language);state.author.source=result.code;state.author.message=`Formázva: ${result.formatter} (${result.indentSize??5} szóköz).`;render();}
   catch(err){state.author.message=err.message;render();}return;
 }
 if(b.hasAttribute('data-author-apply')){state.author.source=root.querySelector('#author-editor').value;b.disabled=true;try{await authorApply({...state.author,source:state.author.source});}catch(err){state.author.message=err.message;render();}return;}
 if(b.hasAttribute('data-model-apply')){state.modelDraft=root.querySelector('#model-editor').value;b.disabled=true;try{await authorApply({model:JSON.parse(state.modelDraft)},{preserveAttempt:true});}catch(err){state.modelMessage=err.message;render();}return;}
 if(b.hasAttribute('data-check')){if(state.view!=='sort'){a.feedback='Előbb alkalmazd a szerkesztő változtatásait.';render();return;}
   try{const preview=state.previews.get(state.active);const lines=a.answer.filter(x=>x!==null).map(text);
      a.report=preview?await previewDraft({draftId:preview,lines}):await evaluate({exerciseId:ex().id,revision:ex().revision,lines});}
   catch{a.report={status:'indeterminate',message:'A validációs szerver nem érhető el.',exploredStates:0};}render();return;
 }
});
root.addEventListener('input',ev=>{const el=ev.target; if(el.closest('.editor-frame'))updateGutters(root);if(el.id==='code-editor')at().draft=el.value;else if(el.id==='model-editor')state.modelDraft=el.value;else if(el.dataset.author)state.author[el.dataset.author]=el.value;});
root.addEventListener('scroll',ev=>{if(ev.target.matches('.editor-frame textarea'))updateGutters(root);},true);
root.addEventListener('keydown',ev=>{if(ev.key==='Tab'&&ev.target.matches('.editor-frame textarea')){ev.preventDefault();const el=ev.target,i=el.selectionStart,j=el.selectionEnd;el.setRangeText('     ',i,j,'end');el.dispatchEvent(new Event('input',{bubbles:true}));}});
root.addEventListener('change',ev=>{if(ev.target.dataset.author)state.author[ev.target.dataset.author]=ev.target.value;});
createInsertionDrag({root,
  onInsert:(d,boundary)=>d.from==='pool'?movePoolToBoundary(d.index,boundary):moveAnswerToBoundary(d.index,boundary),
  onReturn:index=>remove(index)
});
async function init(){try{state.exercises=await getExercises();for(const e of state.exercises)state.attempts.set(e.id,createAttempt(e));state.active=state.exercises[0]?.id;if(!state.active)throw Error('Üres feladatlista.');render();}catch(err){root.innerHTML=`<div class="loading">${escapeHtml(err.message)}</div>`;}}
init();
