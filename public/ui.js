import {markEditorDraft,markEditorApplied,reloadEditorFromArrangement,captureEditorRequest,adjacentMoveBoundary,dispatchWorkbenchAction} from './app/interactions.js';
import {refreshAuthorStatus,captureAuthorRequest,authorRequest,startFromExample,revertAuthorDraft,admitAuthorModel} from './app/author-workspace.js';
import {readRuleEdit,recordRuleRefusal,ruleEditBlocked,settleRuleSelection} from './app/rule-panel.js';
import {connection,installRuleBoard,linkWith} from './app/rule-board.js';
import {blockedReason,enterMode,enterView,landAfterAdmission} from './app/flow.js';
/** App orchestration and event wiring; modes, steps and staleness live in the typed flow (ADR-022). */
import {readClipboard} from './app/clipboard.js';
import {installPreview} from './app/author-session.js';
import {parseImport,exportSession,restoreAttempt,downloadJSON,saveLocal,loadLocal} from './app/persistence.js';
import {createAttempt,createAttemptController} from './app/attempt.js';
import {createWorkbenchView} from './app/view.js';
import {createInsertionDrag} from './app/drag-insert.js';
import {createScrollMemory,updateGutters,copyToClipboard,escapeHtml} from './app/ui-utilities.js';
import {formatSource,getExercises,compileDraft,editRules,previewDraft,evaluate,loadTypeScriptFixture} from './app/api.js';
const root=document.querySelector('#app');
const state={exercises:[],active:null,attempts:new Map(),previews:new Map(),drag:null,mode:'author',view:'author',practiceActive:null,author:{title:'Saját kódrendezős feladat',description:'Rendezd sorba a kódsorokat.',language:'javascript',source:`function calculate() {\n     const a = 10;\n     const b = 20;\n     return a + b;\n}`,message:''},modelDraft:'',modelMessage:''};
const ex=()=>state.exercises.find(x=>x.id===state.active);
const at=()=>state.attempts.get(state.active);
const attempt=createAttemptController(ex,at);
const {text,formattedAnswer}=attempt;
const view=createWorkbenchView({root,state,ex,at,attempt,scroll:createScrollMemory(root)});
const render=()=>view.render();
function commit(msg=''){at().generation=(at().generation??0)+1;at().report=null;at().feedback=msg;render();}
/** A message belongs to the surface the author is looking at. */
function notify(message){const a=at();if(a&&(state.mode==='practice'||state.learnerPreview||state.view==='sort'||state.view==='edit'))a.feedback=message;else if(state.view==='model'||state.sourceKind==='json')state.modelMessage=message;else state.author.message=message;render();}
function movePoolToBoundary(index,boundary){if(!attempt.insertFromPool(index,boundary))return commit('Nincs szabad megoldássor.');commit();}
function moveAnswerToBoundary(index,boundary){if(attempt.moveInAnswer(index,boundary))commit();}
const firstFreeBoundary=()=>{const i=at().answer.findIndex(x=>x===null);return i<0?at().answer.length:i;};
function remove(index){if(attempt.back(index))commit();}
function applyEditor(){const result=attempt.applyText(root.querySelector('#code-editor').value);if(!result.ok)return commit(result.message);markEditorApplied(at());state.view='sort';commit();}
function go(next){const a=at();if(!enterView(state,a,a?formattedAnswer():[],next)){notify(blockedReason(state,next)||'Ez a lépés most nem érhető el.');return;}render();}
const steps={source:'author',rules:'model',try:'sort'};
/** Commit a newly compiled author model atomically and continue where the flow says (`land`).
 * Compatible attempts survive a dependency-only edit, so the new rules are observable at once. */
async function authorApply(body,{preserveAttempt=false,sessionImport,current=captureAuthorRequest(state),request=compileDraft,land='stay'}={}){
 let data;try{data=await request(body);}catch(error){if(!current())return;throw error;}
 if(!current())return;
 if(data.ok===false){if(state.ruleSelection)recordRuleRefusal(state.ruleSelection,data,body.edits);render();return;}
 const restoredAttempt=sessionImport?restoreAttempt(sessionImport,data.model):undefined;
 const {compatible,model:m}=installPreview(state,data,{preserveAttempt,restoredAttempt});
 admitAuthorModel(state,m,body.source,{keepPending:!!body.edits});settleRuleSelection(state,!!body.edits);delete state.ruleConnect;
 const summary='A modell elkészült: '+m.lines.length+' sor, '+m.blocks.length+' blokk. '+(m.authoring?.dependencyHints?.length??0)+' deklaráció/használat jelzés. Az egyszerű const deklarációk kötésalapú függőségeket kapnak; teljes szemantikai bizonyítás nincs.'+(m.authoring?.omittedBlocks?' '+m.authoring.omittedBlocks+' közös sorhatárú blokk csak sorrendvédelemmel reprezentált.':'');
 state.modelMessage=body.source!==undefined?summary:compatible?'A módosított szabályok érvényesek. A kitöltés megmaradt; ellenőrizheted az új függőségekkel.':'A módosított modell érvényes. A kitöltést az új szerkezethez visszaállítottuk.';
 state.author.message=summary;
 landAfterAdmission(state,land);commit(state.modelMessage);
 if(compatible){const id=state.active,a=at(),generation=a.generation;let report;try{report=await previewDraft({draftId:data.draftId,lines:a.answer.filter(x=>x!==null).map(text)});}catch{report={status:'indeterminate',message:'Az előnézet értékelése nem érhető el.',exploredStates:0};}if(state.active===id&&at()===a&&a.generation===generation){a.report=report;render();}}
}
/** The link between the anchor and another line toggles (ADR-024): a direct link is removed (the
 * core asks for its acknowledgement where needed), a missing one is added in reference order, and
 * adding a removed generated link restores it. The panel stays on the anchor. */
async function toggleLink(anchor,line){
 const draftId=state.previews.get(state.active),link=linkWith(state,anchor,line),pair=link??(state.authorModel&&connection(state.authorModel,anchor,line));
 delete state.ruleConnect;
 if(!pair||!draftId){render();return;}
 state.ruleSelection={line:anchor,message:''};
 if(link?.editability==='hard'){state.ruleSelection.message=`A(z) #${link.before} → #${link.after} szerkezeti kapcsolat (blokk vagy egység); nem szüntethető meg.`;render();return;}
 const blocked=ruleEditBlocked(state);if(blocked){state.ruleSelection.message=blocked;render();return;}
 await authorApply({draftId,edits:[{kind:link?'remove-rule':'add-rule',before:pair.before,after:pair.after}]},{preserveAttempt:true,request:editRules});
}

root.addEventListener('click',ev=>dispatchWorkbenchAction(ev,async b=>{const a=at();
 if(b.hasAttribute('data-export-model')){try{downloadJSON(parseImport(state.modelDraft),'codeline-model.json');}catch(err){state.modelMessage=err.message;render();}return;}
 if(b.hasAttribute('data-import-model')){root.querySelector('[data-model-file]').click();return;}
 if(b.hasAttribute('data-export-session')){downloadJSON(snapshot(),'codeline-session.json');return;}
 if(b.hasAttribute('data-import-session')){root.querySelector('[data-session-file]').click();return;}
 if(b.hasAttribute('data-save-local')){try{saveLocal(snapshot());commit('Munkamenet helyben elmentve.');}catch(err){commit(err.message);}return;}
 if(b.hasAttribute('data-load-local')){try{const session=loadLocal();if(!session)throw Error('Nincs helyi mentés.');await importSession(session);}catch(err){notify(err.message);}return;}
 if(b.hasAttribute('data-fullscreen')){
   try{if(document.fullscreenElement===root)await document.exitFullscreen();else if(root.requestFullscreen)await root.requestFullscreen();else root.classList.toggle('ng-fullscreen');}
   catch{root.classList.toggle('ng-fullscreen');}
   return;
 }
 const pasteAction=['author','model','editor','solution'].find(action=>b.hasAttribute('data-paste-'+action));
 if(pasteAction){
  const current=pasteAction==='author'||pasteAction==='model'?captureAuthorRequest(state):()=>true;
  const id=state.active,oldView=state.view,generation=a?.generation;
  const selector={'author':'#author-editor','model':'#model-editor','editor':'#code-editor'}[pasteAction];
  const editor=selector?root.querySelector(selector):null,before=editor?.value;
  b.disabled=true;
  try{
   const value=await readClipboard({limit:pasteAction==='author'?50_000:1024*1024});
   if(!current())return;
   if(state.active!==id||state.view!==oldView||at()!==a)return;
   if(editor&&(!editor.isConnected||editor.value!==before))throw Error('A szerkesztő időközben módosult; kattints újra a Beillesztés gombra.');
   if(pasteAction==='solution'){
    if(a.generation!==generation)throw Error('A megoldás időközben módosult; próbáld újra a beillesztést.');
    const result=attempt.applyText(value);if(!result.ok)throw Error(result.message);
    commit('Megoldás beillesztve; ellenőrizheted.');return;
   }
   if(pasteAction==='author'){state.author.source=value;state.author.message='Forráskód beillesztve; még nincs alkalmazva.';}
   else if(pasteAction==='model'){state.modelDraft=value;state.modelMessage='JSON beillesztve; az aktív modell az alkalmazás után változik.';}
   else{markEditorDraft(a,value);a.feedback='Megoldás beillesztve a szerkesztőbe; még nincs alkalmazva.';}
   render();const next=root.querySelector(selector);next?.focus({preventScroll:true});next?.setSelectionRange(value.length,value.length);
  }catch(err){
   if(!current())return;
   if(state.active!==id||state.view!==oldView)return;
   if(pasteAction==='author')state.author.message=err.message;
   else if(pasteAction==='model')state.modelMessage=err.message;
   else a.feedback=err.message;
   render();root.querySelector('[data-paste-'+pasteAction+']')?.focus({preventScroll:true});
  }finally{if(b.isConnected)b.disabled=false;}
  return;
 }
 if(b.hasAttribute('data-copy-author')||b.hasAttribute('data-copy-editor')||b.hasAttribute('data-copy-model')||b.hasAttribute('data-copy-solution')||b.hasAttribute('data-copy-arrangement')||b.hasAttribute('data-copy-pool')){
   const value=b.hasAttribute('data-copy-author')?root.querySelector('#author-editor')?.value:
     b.hasAttribute('data-copy-editor')?root.querySelector('#code-editor')?.value:
     b.hasAttribute('data-copy-model')?root.querySelector('#model-editor')?.value:
     b.hasAttribute('data-copy-pool')?a.pool.map(text).join('\n'):formattedAnswer().join('\n');
   const copyAction=['author','model','editor','solution','arrangement','pool'].find(action=>b.hasAttribute('data-copy-'+action));
   const ok=await copyToClipboard(value??'');
   if(b.hasAttribute('data-copy-author'))state.author.message=ok?'Forráskód másolva.':'Másolás nem sikerült.';
   else if(b.hasAttribute('data-copy-model'))state.modelMessage=ok?'JSON másolva.':'Másolás nem sikerült.';
   else a.feedback=ok?'Kód másolva.':'Másolás nem sikerült.';
   render();root.querySelector('[data-copy-'+copyAction+']')?.focus({preventScroll:true});return;
 }
 if(b.hasAttribute('data-author-sample')){
  const current=captureAuthorRequest(state);
  try{const source=await loadTypeScriptFixture();if(!current())return;state.author.source=source;state.author.language='typescript';state.author.title='CopyFieldUtilityService';state.author.description='Mellékelt TypeScript service, 31 osztálytag';state.author.message='A 31 metódusos TypeScript minta betöltve.';render();}catch(err){if(current()){state.author.message=err.message;render();}}return;
 }
 if(b.dataset.mode){enterMode(state,b.dataset.mode);render();root.querySelector(`[data-mode="${state.mode}"]`)?.focus({preventScroll:true});return;}
 if(b.dataset.step||b.dataset.goto){go(steps[b.dataset.step??b.dataset.goto]);root.querySelector('#step-title')?.focus?.({preventScroll:true});return;}
 if(b.dataset.rulesView){state.rulesView=b.dataset.rulesView;render();return;}
 if(b.hasAttribute('data-open-json')){state.rulesView='json';go('model');return;}
 if(b.dataset.sourceKind){state.sourceKind=b.dataset.sourceKind;render();return;}
 if(b.hasAttribute('data-start-load')){const e=state.exercises.find(x=>x.id===root.querySelector('[data-start-example]')?.value);if(!e){state.author.message='Válassz egy példát a listából.';render();return;}startFromExample(state,e);state.sourceKind='code';render();return;}
 if(b.hasAttribute('data-edit-example')){const e=ex();if(!e)return;startFromExample(state,e);enterMode(state,'author');state.view='author';state.sourceKind='code';render();return;}
 if(b.hasAttribute('data-author-revert')){revertAuthorDraft(state);render();return;}
 if(b.dataset.ruleConnect){
  const line=+b.dataset.ruleConnect,anchor=state.ruleConnect;
  if(anchor===undefined){state.ruleConnect=line;state.ruleSelection={line,message:''};render();root.querySelector(`[data-rule-connect="${line}"]`)?.focus({preventScroll:true});return;}
  delete state.ruleConnect;
  if(anchor===line){render();root.querySelector(`[data-rule-connect="${line}"]`)?.focus({preventScroll:true});return;}
  await toggleLink(anchor,line);return;
 }
 if(b.dataset.ruleLine){const line=+b.dataset.ruleLine,row=b.closest('.code-row,.board-row');state.ruleSelection=row&&state.ruleSelection?.line===line?undefined:{line,message:''};render();if(!row)root.querySelector('#rule-panel-title')?.focus({preventScroll:true});return;}
 if(b.hasAttribute('data-rule-close')){const line=state.ruleSelection?.line;state.ruleSelection=undefined;render();root.querySelector(`:is(.board-row,.code-row) [data-rule-line="${line}"]`)?.focus({preventScroll:true});return;}
 if(b.hasAttribute('data-rule-cancel')){if(state.ruleSelection){delete state.ruleSelection.pending;state.ruleSelection.message='Az eltávolítás elmaradt; a szabály megmaradt.';}render();return;}
 if(b.dataset.ruleEdit){const selection=state.ruleSelection,draftId=state.previews.get(state.active);if(!selection||!draftId)return;const blocked=ruleEditBlocked(state),edit=readRuleEdit(b,selection);if(blocked||!edit){selection.message=blocked||'Válaszd ki a szabály másik sorát.';render();return;}
  await authorApply({draftId,edits:[edit]},{preserveAttempt:true,request:editRules});return;}
 if(b.dataset.task){state.practiceActive=state.active=b.dataset.task;state.view='sort';render();return;}
 if(b.dataset.view){go(b.dataset.view);return;}
 if(b.hasAttribute('data-reset')){state.attempts.set(state.active,createAttempt(ex()));render();return;}
 if(b.hasAttribute('data-all')){a.answer=ex().lines.map(x=>x.id);a.pool=[];a.custom=new Map();state.view='sort';commit();return;}
 if(b.hasAttribute('data-move')){movePoolToBoundary(+b.dataset.move,firstFreeBoundary());return;}
 if(b.hasAttribute('data-up')){moveAnswerToBoundary(+b.dataset.up,adjacentMoveBoundary(+b.dataset.up,-1,a.answer.length,attempt.fixed));return;}
 if(b.hasAttribute('data-down')){moveAnswerToBoundary(+b.dataset.down,adjacentMoveBoundary(+b.dataset.down,1,a.answer.length,attempt.fixed));return;}
 if(b.hasAttribute('data-remove')){remove(+b.dataset.remove);return;}
 if(b.hasAttribute('data-format')){
   const ed=root.querySelector('#code-editor');if(!ed)return;const current=captureEditorRequest(ed,state,a,at,()=>ex().language);
   try{const result=await formatSource(ed.value,ex().language);if(!current())return;ed.value=result.code;markEditorDraft(a,ed.value);a.feedback='Formázva: '+result.formatter;render();}
   catch(err){if(current()){a.feedback=err.message;render();}}return;
 }
 if(b.hasAttribute('data-apply')){applyEditor();return;}
 if(b.hasAttribute('data-editor-reload')){reloadEditorFromArrangement(a,formattedAnswer());a.feedback='A megoldáskódot a rendező aktuális állapotából töltöttük újra.';render();return;}
 if(b.hasAttribute('data-author-format')){
   const ed=root.querySelector('#author-editor');if(!ed)return;const editorCurrent=captureEditorRequest(ed,state,a,at,()=>state.author.language),requestCurrent=captureAuthorRequest(state),current=()=>editorCurrent()&&requestCurrent();
   try{const result=await formatSource(ed.value,state.author.language);if(!current())return;state.author.source=result.code;state.author.message=`Formázva: ${result.formatter} (${result.indentSize??5} szóköz).`;render();}
   catch(err){if(current()){state.author.message=err.message;render();}}return;
 }
 if(b.hasAttribute('data-author-apply')){const editor=root.querySelector('#author-editor');if(editor)state.author.source=editor.value;b.disabled=true;try{await authorApply(authorRequest(state.author),{land:'rules'});}catch(err){state.author.message=err.message;if(state.view!=='author')state.modelMessage=err.message;render();}return;}
 if(b.hasAttribute('data-model-apply')){state.modelDraft=root.querySelector('#model-editor').value;b.disabled=true;try{await authorApply({model:JSON.parse(state.modelDraft)},{preserveAttempt:true,land:state.view==='author'?'rules':'stay'});}catch(err){state.modelMessage=err.message;render();}return;}
 if(b.hasAttribute('data-model-refresh')){state.modelDraft=root.querySelector('#model-editor').value;try{await authorApply({model:JSON.parse(state.modelDraft),refreshDependencies:true},{preserveAttempt:true});}catch(err){state.modelMessage=err.message;render();}return;}
 if(b.hasAttribute('data-check')){if(state.view!=='sort'){a.feedback='Előbb alkalmazd a szerkesztő változtatásait.';render();return;}
   const generation=a.generation;
   try{const preview=state.previews.get(state.active);const lines=a.answer.filter(x=>x!==null).map(text);
      const report=preview?await previewDraft({draftId:preview,lines}):await evaluate({exerciseId:ex().id,revision:ex().revision,lines});if(at()===a&&a.generation===generation)a.report=report;}
   catch{if(at()===a&&a.generation===generation)a.report={status:'indeterminate',message:'A validációs szerver nem érhető el.',exploredStates:0};}render();return;
 }
},error=>notify(error instanceof Error?error.message:'A művelet nem sikerült.')));
root.addEventListener('input',ev=>{const el=ev.target; if(el.closest('.editor-frame'))updateGutters(root);if(el.id==='code-editor')markEditorDraft(at(),el.value);else if(el.id==='model-editor')state.modelDraft=el.value;else if(el.id==='author-editor')state.author.source=el.value;else if(el.dataset.author)state.author[el.dataset.author]=el.value;refreshAuthorStatus(root,state);});
root.addEventListener('scroll',ev=>{if(ev.target.matches('.editor-frame textarea'))updateGutters(root);},true);
root.addEventListener('keydown',ev=>{if(ev.key==='Tab'&&ev.target.matches('.editor-frame textarea')){ev.preventDefault();const el=ev.target,i=el.selectionStart,j=el.selectionEnd;el.setRangeText('     ',i,j,'end');el.dispatchEvent(new Event('input',{bubbles:true}));}});
root.addEventListener('change',ev=>{
 if(ev.target.dataset.author){state.author[ev.target.dataset.author]=ev.target.value;refreshAuthorStatus(root,state);if(ev.target.dataset.author==='language')render();}
 if(ev.target.matches('[data-board-all]')){state.boardAll=ev.target.checked;render();root.querySelector('[data-board-all]')?.focus({preventScroll:true});}
});
createInsertionDrag({root,
  onInsert:(d,boundary)=>d.from==='pool'?movePoolToBoundary(d.index,boundary):moveAnswerToBoundary(d.index,boundary),
  onReturn:index=>remove(index)
});
installRuleBoard(root,(from,to)=>{toggleLink(from,to).catch(err=>notify(err instanceof Error?err.message:'A kapcsolat módosítása nem sikerült.'));},()=>{delete state.ruleConnect;render();});

const snapshot=()=>exportSession(ex(),at(),state.previews.has(state.active)?state.authorModel:undefined);
async function importSession(session,{current=captureAuthorRequest(state)}={}){
 if(!current())return;
 if(session?.kind!=='ngdynamic-session'||session.version!==1)throw Error('Ismeretlen munkamenet-verzió.');
 if(session.authorModel){await authorApply({model:session.authorModel},{sessionImport:session,current,land:'try'});return;}
 const e=state.exercises.find(x=>x.id===session.exercise?.id&&x.revision===session.exercise?.revision&&!state.previews.has(x.id));
 if(!e)throw Error('A szerver által kiadott feladat/verzió nem található.');
 const restored=restoreAttempt(session,e);enterMode(state,'practice');state.practiceActive=state.active=e.id;state.attempts.set(e.id,restored);state.view='sort';render();
}
root.addEventListener('change',async ev=>{
 const input=ev.target;if(!input.matches('[data-model-file],[data-session-file]'))return;
 const current=captureAuthorRequest(state);
 try{const file=input.files[0];if(!file)return;if(file.size>1024*1024)throw Error('Legfeljebb 1 MiB importálható.');const data=parseImport(await file.text());
  if(!current())return;
  if(input.hasAttribute('data-model-file'))await authorApply({model:data},{current,land:'rules'});else await importSession(data,{current});
 }catch(err){if(current())notify(err.message);}
 finally{input.value='';}
});

async function init(){try{state.exercises=await getExercises();for(const e of state.exercises)state.attempts.set(e.id,createAttempt(e));if(!state.exercises.length)throw Error('Üres feladatlista.');state.practiceActive=state.exercises[0].id;render();}catch(err){root.innerHTML=`<div class="loading">${escapeHtml(err.message)}</div>`;}}
init();
