import {markEditorDraft,markEditorApplied,reloadEditorFromArrangement,captureEditorRequest,adjacentMoveBoundary,dispatchWorkbenchAction,openWorkspaceHelp} from './app/interactions.js';
import {keepLearnerRules} from './app/learner-rules.js';
import {learnerLevel,refreshAuthorStatus,captureAuthorRequest,authorRequest,startFromExample,startFromHelp,replaceDraft,formatLoaded,undoReplace,revertAuthorDraft,admitAuthorModel,setLearnerData} from './app/author-workspace.js';
import {NEW_DRAFT_SETTINGS,setPreflightOption,settingsKey,settingsRequest} from './app/preflight-settings.js';
import {revealLine,article} from './app/ui-utilities.js';
import {readRuleEdit,readRuleKindEdits,recordRuleRefusal,ruleCount,settleRuleKind,settleRuleSelection} from './app/rule-panel.js';
import {availability,reasonOf,refreshAvailability} from './app/availability.js';
/** ADR-120: the rule editor's own last check (the view and the guard already refused a disabled control). */
const ruleEditBlocked=state=>reasonOf(availability(state,'rule-edit'));
import {connection,installRuleBoard,linkWith} from './app/rule-board.js';
import {authorPreviewId,blockedReason,enterMode,enterView,landAfterAdmission,refreshStepper,tryAdmission} from './app/flow.js';
/** App orchestration and event wiring; modes, steps and staleness live in the typed flow (ADR-022). */
import {readClipboard} from './app/clipboard.js';
import {trackActivity,setActivityAbort} from './app/activity.js';
import {helpTrial,helpTrialFromHash} from './app/help-topics.js';
import {cycleTheme,setTheme} from './app/theme.js';
import {toggleSurface} from './app/surface.js';
import {setCodeView} from './app/code-view.js';
import {installPreview} from './app/author-session.js';
import {parseImport,exportSession,readSession,restoreAttempt,downloadJSON,saveLocal,loadLocal} from './app/persistence.js';
import {createAttempt,createAttemptController} from './app/attempt.js';
import {createWorkbenchView} from './app/view.js';
import {practiceOrder} from './app/fields.js';
import {toggleTechnology} from './app/technology-filter.js';
import {createInsertionDrag} from './app/drag-insert.js';
import {createScrollMemory,syncEditors,handleEditorKey,copyToClipboard,escapeHtml} from './app/ui-utilities.js';
import {formatSource,getExercises,compileDraft,checkSource,editRules,previewDraft,resolvePolicy,evaluate,loadTypeScriptFixture,abortPending} from './app/api.js';
// ADR-132 (P2): after 10 s the progress chip offers to stop waiting; the API knows how (a request, or the Local Demo worker).
setActivityAbort(abortPending);
const root=document.querySelector('#app');
const state={exercises:[],active:null,attempts:new Map(),previews:new Map(),drag:null,mode:'author',view:'author',practiceActive:null,author:{...NEW_DRAFT_SETTINGS,title:'Saját kódrendezős feladat',description:'Rendezd sorba a kódsorokat.',language:'javascript',source:`function calculate() {\n     const a = 10;\n     const b = 20;\n     return a + b;\n}`,message:''},modelDraft:'',modelMessage:''};
const ex=()=>state.exercises.find(x=>x.id===state.active);
const at=()=>state.attempts.get(state.active);
const attempt=createAttemptController(ex,at);
const {text,formattedAnswer}=attempt;
const view=createWorkbenchView({root,state,ex,at,attempt,scroll:createScrollMemory(root),format:formatSource});
const render=()=>{view.render();ensurePolicy();};
function commit(msg=''){at().generation=(at().generation??0)+1;at().report=null;at().feedback=msg;delete state.feedbackFocus;render();}
/** The graded lines and the sorter slot of each, so a diagnostic position marks its row (ADR-026). */
const submitted=a=>({lines:a.answer.filter(x=>x!==null).map(text),slots:a.answer.flatMap((x,i)=>x===null?[]:[i])});
/** A message belongs to the surface the author is looking at. */
function notify(message){const a=at();if(a&&(state.mode==='practice'||state.learnerPreview||state.view==='sort'||state.view==='edit'))a.feedback=message;else if(state.view==='model'||state.sourceKind==='json')state.modelMessage=message;else state.author.message=message;render();}
function movePoolToBoundary(index,boundary){if(!attempt.insertFromPool(index,boundary))return commit('Nincs szabad megoldássor.');commit();}
function moveAnswerToBoundary(index,boundary){if(attempt.moveInAnswer(index,boundary))commit();}
const firstFreeBoundary=()=>{const i=at().answer.findIndex(x=>x===null);return i<0?at().answer.length:i;};
function remove(index){if(attempt.back(index))commit();}
function applyEditor(){const result=attempt.applyText(root.querySelector('#code-editor').value);if(!result.ok)return commit(result.message);markEditorApplied(at());state.view='sort';commit();}
/** ADR-108 (E7): the resolver's answer for the author's current request (locks, inactive options, refusals);
 * the latest request wins. */
let policyKey='';
function ensurePolicy(){
 const key=settingsKey(state.author);if(key===policyKey)return;policyKey=key;
 // ADR-136: the resolution arrives in the background; a menu the author opened meanwhile stays open.
 resolvePolicy({language:state.author.language,...settingsRequest(state.author)}).then(resolution=>{if(key===policyKey){state.authorPolicy=resolution;view.render({background:true});ensurePolicy();}},()=>{if(key===policyKey)policyKey='';});
}
/** A preview request with the second gate's evidence: the author's current source and analysis settings. */
const gateEvidence=body=>({...authorRequest(state.author),...learnerLevel(state),...body});
const entersTry=next=>state.mode==='author'&&!state.learnerPreview&&(next==='sort'||next==='edit')&&state.view!=='sort'&&state.view!=='edit';
async function go(next){
 // A refused Try lands on Rules, where the stale notice offers rebuilding or discarding the change.
 if(entersTry(next)){const gate=tryAdmission(state);if(!gate.ok){state.modelMessage=gate.message;if(state.view==='author')state.author.message=gate.message;if(state.view==='model'){render();return;}next='model';}}
 const a=at();if(!enterView(state,a,a?formattedAnswer():[],next)){notify(blockedReason(state,next)||'Ez a lépés most nem érhető el.');return;}render();
}
const steps={source:'author',rules:'model',try:'sort'};
/** Commit a newly compiled author model atomically and continue where the flow says (`land`).
 * Compatible attempts survive a dependency-only edit, so the new rules are observable at once. */
async function authorApply(body,{preserveAttempt=false,sessionImport,settingsOrigin,current=captureAuthorRequest(state),request=compileDraft,land='stay'}={}){
 delete state.boardStatus;
 // ADR-123: a rebuild of an applied model reports how many rules it changed.
 const rulesBefore=body.source!==undefined&&authorPreviewId(state)?ruleCount(state.authorInsight):undefined;
 // ADR-147: every author request carries the author's current choice of the learner's level beside its own body.
 let data;try{data=await request({...body,...learnerLevel(state)});}catch(error){if(!current())return;if(error?.details?.gate&&typeof body.source==='string')state.sourceGate={gate:error.details.gate,source:body.source};throw error;}
 if(!current())return;
 if(data.ok===false){if(state.ruleSelection)recordRuleRefusal(state.ruleSelection,data,body.edits);render();return data;}
 const restoredAttempt=sessionImport?restoreAttempt(sessionImport,data.model):undefined;
 const {compatible,model:m}=installPreview(state,data,{preserveAttempt,restoredAttempt});
 admitAuthorModel(state,m,body.source,{keepPending:!!body.edits,policy:data.policy,settingsOrigin});if(data.gate)state.sourceGate={gate:data.gate,source:state.authorBaseline.source};settleRuleSelection(state,!!body.edits);delete state.ruleConnect;
 const summary='A modell elkészült: '+m.lines.length+' sor, '+m.blocks.length+' blokk. '+(m.authoring?.dependencyHints?.length??0)+' deklaráció/használat jelzés. Az egyszerű const deklarációk kötésalapú függőségeket kapnak; teljes szemantikai bizonyítás nincs.'+(m.authoring?.omittedBlocks?' '+m.authoring.omittedBlocks+' közös sorhatárú blokk csak sorrendvédelemmel reprezentált.':'');
 const rebuilt=rulesBefore===undefined?'':` Újraelemzés: ${rulesBefore} → ${ruleCount(state.authorInsight)} nem szerkezeti szabály.`;
 state.modelMessage=body.source!==undefined?summary+rebuilt:compatible?'A módosított szabályok érvényesek. A kitöltés megmaradt; ellenőrizheted az új függőségekkel.':'A módosított modell érvényes. A kitöltést az új szerkezethez visszaállítottuk.';
 state.author.message=summary;
 // ADR-108 (E6): landing on Try (a session import) passes the second gate first; refused, it lands on Rules.
 if(land==='try'){const gate=tryAdmission(state);if(!gate.ok){land='rules';state.modelMessage=gate.message;}}
 landAfterAdmission(state,land);commit(state.modelMessage);
 if(compatible){const id=state.active,a=at(),generation=a.generation,{lines,slots}=submitted(a);let report;try{report={...await previewDraft(gateEvidence({draftId:data.draftId,lines})),slots};}catch(error){report={status:'indeterminate',message:error instanceof Error&&/^A Próba lépés|^A műveletet megszakítottad/.test(error.message)?error.message:'Az előnézet értékelése nem érhető el.',exploredStates:0};}if(state.active===id&&at()===a&&a.generation===generation){a.report=report;render();}}
 return data;
}
/** The link between the anchor and another line toggles (ADR-024): a direct link is removed (the
 * core asks for its acknowledgement where needed), a missing one is added in reference order, and
 * adding a removed generated link restores it. The panel stays on the anchor. */
async function toggleLink(anchor,line){
 const draftId=state.previews.get(state.active),link=linkWith(state,anchor,line),pair=link??(state.authorModel&&connection(state.authorModel,anchor,line));
 delete state.ruleConnect;
 if(!pair||!draftId){render();return;}
 state.ruleSelection={line:anchor,message:''};
 if(link?.removal==='impossible'){state.ruleSelection.message=`${article(link.before,true)} #${link.before} → #${link.after} szerkezeti kapcsolat (blokk vagy egység); nem szüntethető meg.`;render();return;}
 const blocked=ruleEditBlocked(state);if(blocked){state.ruleSelection.message=blocked;render();return;}
 await authorApply({draftId,edits:[{kind:link?'remove-rule':'add-rule',before:pair.before,after:pair.after}]},{preserveAttempt:true,request:editRules});
}

root.addEventListener('click',ev=>dispatchWorkbenchAction(ev,async b=>{const a=at();
 if(b.hasAttribute('data-export-model')){try{downloadJSON(parseImport(state.modelDraft),'codeline-model.json');}catch(err){state.modelMessage=err.message;render();}return;}
 if(b.hasAttribute('data-import-model')){root.querySelector('[data-model-file]').click();return;}
 if(b.hasAttribute('data-export-session')){downloadJSON(snapshot(),'codeline-session.json');return;}
 if(b.hasAttribute('data-import-session')){root.querySelector('[data-session-file]').click();return;}
 if(b.hasAttribute('data-save-local')){try{saveLocal(snapshot());refreshAvailability(root,state,at());commit('Munkamenet elmentve ebbe a böngészőbe.');}catch(err){commit(err.message);}return;}
 if(b.hasAttribute('data-load-local')){try{const session=loadLocal();if(!session)throw Error('Ebben a böngészőben nincs mentett munka.');await importSession(session);}catch(err){notify(err.message);}return;}
 if(b.hasAttribute('data-theme-cycle')){cycleTheme();render();root.querySelector('[data-theme-cycle]')?.focus({preventScroll:true});return;}
 // ADR-145: the narrow header's menu sets the theme by name and stays open (a background render keeps an open menu).
 if(b.hasAttribute('data-theme-set')){setTheme(b.dataset.themeSet);view.render({background:true});ensurePolicy();root.querySelector('[data-theme-set][aria-pressed="true"]')?.focus({preventScroll:true});return;}
 // ADR-106: the whole workbench or only the code workspace on the full surface; the code view.
 if(b.hasAttribute('data-fullscreen')||b.hasAttribute('data-focus')){const action=b.hasAttribute('data-focus')?'data-focus':'data-fullscreen';await toggleSurface(root,action==='data-focus'?'focus':'app',render);root.querySelector('['+action+']')?.focus({preventScroll:true});return;}
 if(b.hasAttribute('data-workspace-help')){openWorkspaceHelp(root);return;}
 // ADR-152: a technology label narrows the practice list to it; pressed again, it lets go.
 if(b.hasAttribute('data-technology')){const [id,version]=b.dataset.technology.split(' ');state.technologyFilter=toggleTechnology(state.technologyFilter,{id,version});render();return;}
 if(b.hasAttribute('data-set-code-view')){setCodeView(root,b.dataset.setCodeView);render();root.querySelector(`[data-set-code-view="${b.dataset.setCodeView}"]`)?.focus({preventScroll:true});return;}
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
  try{const source=await loadTypeScriptFixture();if(!current())return;const next=await formatLoaded({...state.author,source,language:'typescript',title:'CopyFieldUtilityService',description:'Mellékelt TypeScript service, 31 osztálytag',message:'A 31 metódusos TypeScript minta betöltve.'},formatSource);if(!current())return;replaceDraft(state,next);render();}catch(err){if(current()){state.author.message=err.message;render();}}return;
 }
 if(b.dataset.mode){enterMode(state,b.dataset.mode);render();root.querySelector(`[data-mode="${state.mode}"]`)?.focus({preventScroll:true});return;}
 if(b.dataset.step||b.dataset.goto){await go(steps[b.dataset.step??b.dataset.goto]);root.querySelector('#step-title')?.focus?.({preventScroll:true});return;}
 if(b.dataset.rulesView){state.rulesView=b.dataset.rulesView;render();return;}
 if(b.hasAttribute('data-open-json')){state.rulesView='json';await go('model');return;}
 if(b.dataset.sourceKind){state.sourceKind=b.dataset.sourceKind;render();return;}
 if(b.hasAttribute('data-author-undo')){undoReplace(state);render();root.querySelector('#author-editor')?.focus({preventScroll:true});return;}
 // ADR-135 (NY-31): „Kipróbálom” in a help bubble loads that example under that outcome's settings in the Kód step.
 if(b.hasAttribute('data-help-try')){const trial=helpTrial(b.dataset.helpTry,Number(b.dataset.helpOutcome));if(!trial)return;openHelpTrial(trial);return;}
 if(b.hasAttribute('data-edit-example')){const e=ex();if(!e)return;startFromExample(state,e);enterMode(state,'author');state.view='author';state.sourceKind='code';render();return;}
 if(b.hasAttribute('data-author-revert')){revertAuthorDraft(state);render();return;}
 // ADR-122: a finding's line is a source line wherever it is shown; from another step it opens the source there.
 if(b.hasAttribute('data-goto-line')){if(!root.querySelector('#author-editor')){state.sourceKind='code';await go(steps.source);}const editor=root.querySelector('#author-editor');if(editor)revealLine(editor,Number(b.dataset.gotoLine));return;}
 // ADR-122: „Megmutatom” on the fairness answer opens the rule kinds, where the conservative rules are listed and can be lifted.
 if(b.hasAttribute('data-show-rule-kinds')){if(state.rulesView==='json'){state.rulesView='visual';render();}const kinds=root.querySelector('[data-rule-kinds]');if(kinds){kinds.open=true;kinds.scrollIntoView({block:'start'});kinds.querySelector('summary')?.focus({preventScroll:true});}return;}
 if(b.dataset.feedbackGoto!==undefined){
  // Move to the rows a diagnostic names; the marks come from the graded report, not from a search here.
  state.feedbackFocus=+b.dataset.feedbackGoto;render();
  const row=root.querySelector('.solution-zone .code-row.diag-focus');row?.scrollIntoView({block:'nearest'});
  (row?.querySelector('.drag-handle:not([disabled])')??row?.querySelector('button'))?.focus({preventScroll:true});return;
 }
 if(b.dataset.rulePin){
  // A pin is one typed set-fixed edit; the open panel and the focus stay where they are.
  const line=+b.dataset.rulePin,draftId=state.previews.get(state.active),fixed=b.getAttribute('aria-pressed')!=='true',place=(state.authorModel?.lines.findIndex(item=>item.id===line)??-1)+1;
  if(!draftId)return;
  const blocked=ruleEditBlocked(state);if(blocked){state.boardStatus=blocked;render();return;}
  await authorApply({draftId,edits:[{kind:'set-fixed',line,fixed}]},{preserveAttempt:true,request:editRules});
  const done=state.authorModel?.lines.find(item=>item.id===line)?.fixed===fixed;
  state.boardStatus=done?(fixed?`${article(line,true)} #${line} sor rögzítve ${article(place)} ${place}. helyen.`:`${article(line,true)} #${line} sor rögzítése feloldva.`):'A rögzítés nem módosult.';
  render();root.querySelector(`[data-rule-pin="${line}"]`)?.focus({preventScroll:true});return;
 }
 if(b.dataset.ruleConnect){
  const line=+b.dataset.ruleConnect,anchor=state.ruleConnect;
  if(anchor===undefined){state.ruleConnect=line;state.ruleSelection={line,message:''};render();root.querySelector(`[data-rule-connect="${line}"]`)?.focus({preventScroll:true});return;}
  delete state.ruleConnect;
  if(anchor===line){render();root.querySelector(`[data-rule-connect="${line}"]`)?.focus({preventScroll:true});return;}
  await toggleLink(anchor,line);return;
 }
 // ADR-107: a row's link selects the line (marks and arcs) without opening the inspector; a rule-cause link outside a row asks to open the rule, so it opens it.
 if(b.hasAttribute('data-rule-panel-toggle')){state.rulePanelOpen=!state.rulePanelOpen;render();root.querySelector(state.rulePanelOpen?'.inspector-head [data-rule-panel-toggle]':'.inspector-toggle')?.focus({preventScroll:true});return;}
 if(b.dataset.ruleLine){const line=+b.dataset.ruleLine,row=b.closest('.code-row,.board-row');state.ruleSelection=row&&state.ruleSelection?.line===line?undefined:{line,message:''};if(!row)state.rulePanelOpen=true;render();if(!row)root.querySelector('#rule-panel-title')?.focus({preventScroll:true});return;}
 if(b.hasAttribute('data-rule-close')){const line=state.ruleSelection?.line;state.ruleSelection=undefined;render();root.querySelector(`:is(.board-row,.code-row) [data-rule-line="${line}"]`)?.focus({preventScroll:true});return;}
 // ADR-056: a rule kind is lifted as one confirmed batch; the typed panel module builds and settles it.
 if(b.dataset.ruleKind){state.ruleKind={code:b.dataset.ruleKind,message:''};render();root.querySelector('[data-rule-kind-note]')?.focus();return;}
 if(b.hasAttribute('data-rule-kind-cancel')){delete state.ruleKind;render();return;}
 if(b.dataset.ruleKindConfirm){const draftId=state.previews.get(state.active),blocked=ruleEditBlocked(state),edits=readRuleKindEdits(b,state);if(!draftId||!edits)return;if(blocked){settleRuleKind(state,{edited:false,refusal:blocked});render();return;}
  const data=await authorApply({draftId,edits},{preserveAttempt:true,request:editRules});settleRuleKind(state,data?.ok===false?{edited:false,refusal:data.message}:{edited:!!data,count:edits.length});render();return;}
 if(b.hasAttribute('data-rule-cancel')){if(state.ruleSelection){delete state.ruleSelection.pending;state.ruleSelection.message='Az eltávolítás elmaradt; a szabály megmaradt.';}render();return;}
 if(b.dataset.ruleEdit){const selection=state.ruleSelection,draftId=state.previews.get(state.active);if(!selection||!draftId)return;const blocked=ruleEditBlocked(state),edit=readRuleEdit(b,selection);if(blocked||!edit){selection.message=blocked||'Válaszd ki a szabály másik sorát.';render();return;}
  await authorApply({draftId,edits:[edit]},{preserveAttempt:true,request:editRules});return;}
 if(b.dataset.task){state.practiceActive=state.active=b.dataset.task;state.view='sort';render();return;}
 if(b.dataset.view){await go(b.dataset.view);return;}
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
 if(b.hasAttribute('data-author-check')){
  // ADR-113: the first gate alone; its findings go to the same list a build would fill.
  const editor=root.querySelector('#author-editor');if(editor)state.author.source=editor.value;
  const source=state.author.source,current=captureAuthorRequest(state);b.disabled=true;
  try{const {gate}=await checkSource(authorRequest(state.author));if(!current())return;state.sourceGate={gate,source};
   state.author.message=gate.verdict==='passed'?'A forrás vizsgálata: nem találtam hibát a bekapcsolt vizsgálatokkal. A Modell készítése ugyanezt a vizsgálatot futtatja.':gate.message;}
  catch(err){if(!current())return;if(err?.details?.gate)state.sourceGate={gate:err.details.gate,source};state.author.message=err.message;}
  render();return;}
 if(b.hasAttribute('data-author-apply')){const editor=root.querySelector('#author-editor');if(editor)state.author.source=editor.value;b.disabled=true;try{await authorApply(authorRequest(state.author),{land:'rules'});}catch(err){state.author.message=err.message;if(state.view!=='author')state.modelMessage=err.message;render();}return;}
 if(b.hasAttribute('data-model-apply')){state.modelDraft=root.querySelector('#model-editor').value;b.disabled=true;try{await authorApply({model:JSON.parse(state.modelDraft),...ownSettings()},{preserveAttempt:true,land:state.view==='author'?'rules':'stay'});}catch(err){state.modelMessage=err.message;render();}return;}
 if(b.hasAttribute('data-model-refresh')){state.modelDraft=root.querySelector('#model-editor').value;try{await authorApply({model:JSON.parse(state.modelDraft),refreshDependencies:true,...ownSettings()},{preserveAttempt:true});}catch(err){state.modelMessage=err.message;render();}return;}
 if(b.hasAttribute('data-check')){if(state.view!=='sort'){a.feedback='Előbb alkalmazd a szerkesztő változtatásait.';render();return;}
   const generation=a.generation;
   delete state.feedbackFocus;
   try{const preview=state.previews.get(state.active),{lines,slots}=submitted(a);
      // ADR-108 (E6): an author preview is evaluated only through the second gate; the request carries its evidence.
      const report=preview?await previewDraft(gateEvidence({draftId:preview,lines})):await evaluate({exerciseId:ex().id,revision:ex().revision,lines});if(at()===a&&a.generation===generation){a.report={...report,slots};
       // ADR-147: the first answer that brings the exercise's rules says so; the panel stays the learner's to open.
       if(keepLearnerRules(state,report))a.feedback='Mostantól megnézheted a sorok szabályait: „Sor szabályai” az eszközsávban, vagy a láncszem a sor végén.';}}
   catch(error){if(at()===a&&a.generation===generation)a.report={status:'indeterminate',message:error instanceof Error&&/^A Próba lépés|^A műveletet megszakítottad/.test(error.message)?error.message:'A validációs szerver nem érhető el.',exploredStates:0};}render();return;
 }
},error=>notify(error instanceof Error?error.message:'A művelet nem sikerült.')));
root.addEventListener('keydown',ev=>{if(ev.key!=='Escape'||!state.rulePanelOpen||ev.defaultPrevented||!(ev.target instanceof Element)||!ev.target.closest('.rule-inspector,.inspector-toggle')||ev.target.closest('input,textarea,select'))return;ev.preventDefault();state.rulePanelOpen=false;render();root.querySelector('.inspector-toggle')?.focus({preventScroll:true});});
root.addEventListener('input',ev=>{const el=ev.target; if(el.closest('.editor-frame'))syncEditors(root);if(el.id==='code-editor')markEditorDraft(at(),el.value);else if(el.id==='model-editor')state.modelDraft=el.value;else if(el.id==='author-editor')state.author.source=el.value;else if(el.dataset.author)state.author[el.dataset.author]=el.value;else if(el.dataset.learner)setLearnerData(state,el.dataset.learner,el.value);refreshAuthorStatus(root,state);refreshStepper(root,state);refreshAvailability(root,state,at());});
root.addEventListener('scroll',ev=>{if(ev.target.matches('.editor-frame textarea'))syncEditors(root);},true);
// ADR-121 (M4): the editors' keys (Tab/Shift+Tab on lines, Enter keeps the indentation, } steps back) in one place.
root.addEventListener('keydown',handleEditorKey);
// ADR-121 (M4): a whole source or CodeLine JSON pasted into an empty (or fully selected) editor is laid out at once; the
// source through the formatter (undoable as a load), the JSON by its own structure. The learner's code is never reformatted.
root.addEventListener('paste',ev=>{
 const el=ev.target;if(!(el instanceof HTMLTextAreaElement)||(el.id!=='author-editor'&&el.id!=='model-editor'))return;
 const whole=el.value.trim()===''||(el.selectionStart===0&&el.selectionEnd===el.value.length);if(!whole)return;
 setTimeout(async()=>{
  if(el.id==='model-editor'){try{const pretty=JSON.stringify(JSON.parse(el.value),null,2);if(pretty!==el.value){el.value=pretty;state.modelDraft=pretty;syncEditors(root);}}catch{}return;}
  const current=captureAuthorRequest(state);state.author.source=el.value;
  const next=await formatLoaded({...state.author,message:'Beillesztve.'},formatSource);
  if(current()&&next.source!==state.author.source){replaceDraft(state,next);render();}
 });
});
root.addEventListener('change',ev=>{
 // ADR-152: the technology filter may also take the older versions of the chosen technology.
 if(ev.target.matches('[data-technology-earlier]')){if(state.technologyFilter){state.technologyFilter={...state.technologyFilter,earlier:ev.target.checked};render();}return;}
 // M2: choosing an example loads it at once (undoable); there is no separate load button.
 if(ev.target.matches('[data-start-example]')){const e=state.exercises.find(x=>x.id===ev.target.value);if(!e)return;startFromExample(state,e);state.sourceKind='code';render();root.querySelector('.open-menu > summary')?.focus({preventScroll:true});return;}
 if(ev.target.dataset.author){state.author[ev.target.dataset.author]=ev.target.value;refreshAuthorStatus(root,state);if(ev.target.dataset.author==='language')render();}
 // ADR-123: the learner's title, description and level change the applied model in place; the heading follows.
 if(ev.target.dataset.learner&&setLearnerData(state,ev.target.dataset.learner,ev.target.value))render();
 if(ev.target.dataset.preflight&&setPreflightOption(state.author,ev.target.dataset.preflight,ev.target.value)){refreshAuthorStatus(root,state);render();}
 if(ev.target.matches('[data-board-all]')){state.boardAll=ev.target.checked;render();root.querySelector('[data-board-all]')?.focus({preventScroll:true});}
});
createInsertionDrag({root,
  onInsert:(d,boundary)=>d.from==='pool'?movePoolToBoundary(d.index,boundary):moveAnswerToBoundary(d.index,boundary),
  onReturn:index=>remove(index),
  // ADR-118: a picked row's actions show in the action bar (view.ts pickBar).
  onPick:info=>{state.rowPick=info&&(info.from==='pool'||info.from==='answer')&&info.id!==undefined?{list:info.from,id:info.id}:undefined;render();}
});
installRuleBoard(root,(from,to)=>{trackActivity('Szabály módosítása',toggleLink(from,to)).catch(err=>notify(err instanceof Error?err.message:'A kapcsolat módosítása nem sikerült.'));},()=>{delete state.ruleConnect;render();});

/** ADR-108 (E8): a model does not record the preflight options; the author's own JSON edit sends them along. */
const ownSettings=()=>{const policy=settingsRequest(state.author).policy;return policy?{policy}:{};};
/** A session records the applied model with the settings it was made under (session v2). */
const snapshot=()=>{const author=state.previews.has(state.active);return exportSession(ex(),at(),author?state.authorModel:undefined,author&&state.authorBaseline?settingsRequest(state.authorBaseline):undefined);};
async function importSession(session,{current=captureAuthorRequest(state)}={}){
 if(!current())return;
 // ADR-108 (E8): either session version; the model passes both gates again, with the recorded settings or, for an
 // older file, the model's own environment and start values (partial origin).
 const {author}=readSession(session);
 if(author){await authorApply({model:author.model,...(author.settings.policy?{policy:author.settings.policy}:{})},{sessionImport:session,settingsOrigin:author.origin,current,land:'try'});return;}
 const e=state.exercises.find(x=>x.id===session.exercise?.id&&x.revision===session.exercise?.revision&&!state.previews.has(x.id));
 if(!e)throw Error('A szerver által kiadott feladat/verzió nem található.');
 const restored=restoreAttempt(session,e);enterMode(state,'practice');state.practiceActive=state.active=e.id;state.attempts.set(e.id,restored);state.view='sort';render();
}
root.addEventListener('change',async ev=>{
 const input=ev.target;if(!input.matches('[data-model-file],[data-session-file]'))return;
 const current=captureAuthorRequest(state);
 try{const file=input.files[0];if(!file)return;if(file.size>1024*1024)throw Error('Legfeljebb 1 MiB importálható.');const data=parseImport(await file.text());
  if(!current())return;
  const model=input.hasAttribute('data-model-file');
  await trackActivity(model?'CodeLine JSON megnyitása':'Munkamenet megnyitása',model?authorApply({model:data},{current,land:'rules',settingsOrigin:'partial'}):importSession(data,{current}));
 }catch(err){if(current())notify(err.message);}
 finally{input.value='';}
});

/** ADR-135: a help example opens in the Kód step, the bubble closed, the focus on the loaded source. */
function openHelpTrial(trial){startFromHelp(state,trial);enterMode(state,'author');state.view='author';state.sourceKind='code';render();root.querySelector('#author-editor')?.focus({preventScroll:true});}
/** ADR-136: the policy for the starting draft is asked with the exercise list, so the first render already has it: no
 *  answer redraws the page under the reader's first click. A refusal leaves it to `ensurePolicy`, as before. */
async function startingPolicy(){const key=settingsKey(state.author);try{state.authorPolicy=await resolvePolicy({language:state.author.language,...settingsRequest(state.author)});policyKey=key;}catch{}}
async function init(){try{const [exercises]=await Promise.all([getExercises(),startingPolicy()]);state.exercises=practiceOrder(exercises);for(const e of state.exercises)state.attempts.set(e.id,createAttempt(e));if(!state.exercises.length)throw Error('Üres feladatlista.');state.practiceActive=state.exercises[0].id;render();
 // ADR-135: the help page's „Kipróbálom” opens the workbench at #kiprobalom=<topic>.<outcome>; the address is cleared after.
 const trial=helpTrialFromHash(location.hash);if(trial){history.replaceState(null,'',location.pathname+location.search);openHelpTrial(trial);}}catch(err){root.innerHTML=`<div class="loading" role="alert">${escapeHtml(err.message)}</div>`;}}
init();
