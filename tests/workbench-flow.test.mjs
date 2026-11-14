/** ADR-022: the workbench state machine. Two modes, three author steps, one active step;
 * steps after the source need an applied model and turn stale on unapplied reference or JSON edits. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {authorPreviewId,blockedReason,continuityKey,enterMode,enterView,flowSteps,jsonPending,landAfterAdmission,staleReason,stepOf,tryAdmission} from '../public/app/flow.js';
import {admitAuthorModel} from '../public/app/author-workspace.js';
import {connection} from '../public/app/rule-board.js';
/** ADR-133: the solution editor (view `edit`) is switched off on the page; its behaviour is still tested with the
 *  developer key on. */
function withViewSwitches(run){
 const stored=new Map([['ngdynamic.view-switches.v1','on']]);
 globalThis.localStorage={getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,String(value)),removeItem:key=>stored.delete(key)};
 try{return run();}finally{delete globalThis.localStorage;}
}

const trusted={id:'trusted',revision:1,title:'Trusted',description:'',language:'javascript',lines:[{id:1,code:'const a = 1;'}]};
const make=()=>({exercises:[trusted],active:null,previews:new Map(),mode:'author',view:'author',practiceActive:null,author:{title:'T',description:'',language:'javascript',source:'const a = 1;',message:''},modelDraft:'',modelMessage:''});
const attempt=()=>({answer:[1],pool:[],draft:'',report:null,feedback:'',generation:0});
/** What a successful admission leaves behind (installPreview + admitAuthorModel). */
function admit(state,land){
 const model={...trusted,id:'author-preview',schemaVersion:2,blocks:[],lines:[{id:1,code:'const a = 1;',dependencies:[],fixed:false,functionBlock:0,scopeId:null}]};
 state.previews.clear();state.previews.set(model.id,'draft-1');state.exercises=[{...model,previewOnly:true},trusted];state.authorModel=structuredClone(model);state.modelDraft=JSON.stringify(model,null,2);
 admitAuthorModel(state,model);landAfterAdmission(state,land);return model;
}

test('steps: rules and try are locked until a model is applied; the source is always open',()=>withViewSwitches(()=>{
 const state=make();
 assert.deepEqual(flowSteps(state).map(s=>[s.step,!!s.locked,s.current]),[['source',false,true],['rules',true,false],['try',true,false]]);
 for(const view of ['model','sort','edit']){assert.match(blockedReason(state,view),/Kód lépésben/);assert.equal(enterView(state,undefined,[],view),false);assert.equal(state.view,'author');}
 admit(state,'rules');
 assert.equal(state.view,'model');assert.equal(state.active,'author-preview');assert.equal(authorPreviewId(state),'author-preview');
 assert.deepEqual(flowSteps(state).map(s=>[s.step,!!s.locked,s.current]),[['source',false,false],['rules',false,true],['try',false,false]]);
 assert.equal(enterView(state,attempt(),['const a = 1;'],'edit'),true);assert.equal(stepOf(state.view),'try');
}));

test('staleness: a reference edit after the model marks the later steps; reverting or rebuilding clears it',()=>{
 const state=make();admit(state,'rules');
 assert.equal(staleReason(state),'');
 state.author.source='const a = 2;';
 assert.match(staleReason(state),/referenciaforrás/);assert.ok(flowSteps(state).filter(s=>s.step!=='source').every(s=>s.stale));
 state.author.source='const a = 1;';assert.equal(staleReason(state),'');
 state.modelDraft+=' ';assert.ok(jsonPending(state));assert.match(staleReason(state),/JSON/);
 admit(state,'stay');assert.equal(staleReason(state),'','a new admission rewrites the JSON from the model');
 assert.equal(state.view,'model','stay keeps the rules step');
});

test('modes: practice shows only trusted exercises and the try views; each mode returns to its own view',()=>withViewSwitches(()=>{
 const state=make();admit(state,'rules');
 enterMode(state,'practice');
 assert.deepEqual([state.mode,state.active,state.view],['practice','trusted','sort']);
 assert.match(blockedReason(state,'author'),/megoldás rendezése/);assert.equal(enterView(state,attempt(),[],'model'),false);
 assert.equal(enterView(state,attempt(),['const a = 1;'],'edit'),true);
 enterMode(state,'author');assert.deepEqual([state.mode,state.active,state.view],['author','author-preview','model']);
 enterMode(state,'practice');assert.equal(state.view,'edit','practice returns to its own last view');
}));

test('modes: without a model the author mode returns to the source; learner preview leaves it',()=>{
 const state=make();state.view='author';enterMode(state,'practice');state.modeViews.author='model';
 enterMode(state,'author');assert.equal(state.view,'author','a locked step is never restored');
 admit(state,'try');state.learnerPreview=true;
 assert.match(blockedReason(state,'model'),/megoldás rendezése/);
 enterMode(state,'practice');assert.equal(state.learnerPreview,false);
});

test('admission landing: source build goes to rules, session import to try, edits stay',()=>{
 const state=make();admit(state,'rules');assert.equal(state.view,'model');
 state.view='author';admit(state,'stay');assert.equal(state.view,'author');
 admit(state,'try');assert.equal(state.view,'sort');
 state.mode='practice';state.active='trusted';admit(state,'stay');
 assert.deepEqual([state.mode,state.active],['author','author-preview'],'an author admission always shows the author project');
});

test('rule board: a connection follows the reference order whichever way it was drawn',()=>{
 const model={lines:[{id:10},{id:20},{id:30}]};
 assert.deepEqual(connection(model,30,10),{before:10,after:30});
 assert.deepEqual(connection(model,10,20),{before:10,after:20});
 assert.equal(connection(model,20,20),null);assert.equal(connection(model,20,99),null);
});

test('try step: rule controls and the rule bar exist only for the author preview, never in practice or learner preview',async()=>{
 const {renderTryRules,tryRowRuleControls}=await import('../public/app/rule-board.js');
 const state=make();const model=admit(state,'try');
 state.authorInsight={rules:{provenance:'complete',unexplained:0,stale:0,relaxations:[],constraints:[]}};
 assert.match(tryRowRuleControls(state,1),/data-rule-line="1"[\s\S]*data-rule-connect="1"/);
 // ADR-107: the inspector head (legend and the draw-all switch); the arcs' marker sits on the lists themselves.
 assert.match(renderTryRules(state),/data-board-all/);
 assert.equal(tryRowRuleControls(state,'edited_1'),'','an edited learner line has no reference identity');
 state.learnerPreview=true;assert.equal(tryRowRuleControls(state,1),'');assert.equal(renderTryRules(state),'');
 state.learnerPreview=false;enterMode(state,'practice');assert.equal(tryRowRuleControls(state,1),'');assert.equal(renderTryRules(state),'');
 assert.ok(model);
});

test('continuity: every admission is the same author project; practice exercises are their own identity',()=>{
 const state=make();admit(state,'try');const first=continuityKey(state);
 state.previews.clear();state.previews.set('author-draft-2','draft-2');state.exercises[0]={...state.exercises[0],id:'author-draft-2'};state.active='author-draft-2';
 assert.equal(continuityKey(state),first,'a rule edit or refresh installs a new preview id, not a new scroll identity');
 enterMode(state,'practice');assert.equal(continuityKey(state),'trusted:practice');assert.notEqual(continuityKey(state),first);
});

test('ADR-155 (T1.7): one owner says whether the CodeLine JSON is applied, for the state and for the text as it is typed',async()=>{
 const {modelDraftStatus,modelJson}=await import('../public/app/author-workspace.js');
 const state=make();
 // nothing applied: an empty editor is a new exercise, anything typed is unapplied
 assert.deepEqual(modelDraftStatus(state),{pending:false,label:'Új feladat JSON-ból'});assert.equal(jsonPending(state),false);
 assert.deepEqual(modelDraftStatus(state,'{'),{pending:true,label:'Nem alkalmazott JSON'});
 admit(state,'rules');
 assert.equal(state.modelDraft,modelJson(state.authorModel));
 assert.deepEqual(modelDraftStatus(state),{pending:false,label:'Aktív modell'});assert.equal(jsonPending(state),false);
 // the editor's text while it is typed: the state has not followed yet, the answer already has
 assert.deepEqual(modelDraftStatus(state,state.modelDraft+' '),{pending:true,label:'Nem alkalmazott JSON'});assert.equal(jsonPending(state),false);
 assert.deepEqual(modelDraftStatus(state,state.modelDraft),{pending:false,label:'Aktív modell'});
 assert.deepEqual(modelDraftStatus(state,''),{pending:false,label:'Aktív modell'},'an emptied editor is not a draft');
 state.modelDraft+=' ';assert.deepEqual(modelDraftStatus(state),{pending:true,label:'Nem alkalmazott JSON'});assert.equal(jsonPending(state),true);
 // the applied model is the author's preview, whichever exercise is in front (practice shows another)
 state.modelDraft=modelJson(state.authorModel);enterMode(state,'practice');assert.deepEqual(modelDraftStatus(state),{pending:false,label:'Aktív modell'});
});

test('ADR-155 (T1.1): a drawing asks once whether the rules can be edited, however many rows it draws',async()=>{
 const {renderRuleBoard,createRowRuleControls,tryRowRuleControls}=await import('../public/app/rule-board.js');
 const state=make();admit(state,'try');
 const line=id=>({id,code:`const v${id} = ${id};`,dependencies:[],fixed:false,functionBlock:0,scopeId:null});
 state.authorModel={...state.authorModel,lines:Array.from({length:60},(_,i)=>line(i+1))};state.modelDraft=JSON.stringify(state.authorModel,null,2);
 state.authorInsight={rules:{provenance:'complete',unexplained:0,stale:0,relaxations:[],constraints:[]}};
 // The question reads the JSON draft (is it applied?): its reads count the questions.
 let draft=state.modelDraft,asked=0;Object.defineProperty(state,'modelDraft',{get(){asked++;return draft;},set(value){draft=value;},configurable:true});
 const board=renderRuleBoard(state,code=>code),perQuestion=(()=>{asked=0;tryRowRuleControls(state,1);return asked;})();
 assert.ok(perQuestion>=1,'the question reads the draft');
 asked=0;const drawn=renderRuleBoard(state,code=>code);
 assert.equal((drawn.match(/data-rule-connect=/g)??[]).length,60);assert.equal((drawn.match(/data-rule-pin=/g)??[]).length,60);
 assert.equal(asked,perQuestion,'the board of 60 rows asks once');assert.equal(drawn,board);
 asked=0;const controls=createRowRuleControls(state),rows=Array.from({length:60},(_,i)=>controls(i+1));
 assert.equal(asked,perQuestion,'the sorter\'s 60 rows ask once');
 // The one answer reaches every row: with an unapplied JSON draft every gated control is disabled, with its reason.
 draft=draft+' ';
 const paused=renderRuleBoard(state,code=>code);assert.equal((paused.match(/aria-disabled="true" data-disabled-reason="A CodeLine JSON-ban alkalmazatlan módosítás van/g)??[]).length,120);
 const pausedRows=Array.from({length:3},(_,i)=>createRowRuleControls(state)(i+1));assert.ok(pausedRows.every(row=>/data-rule-connect="\d+"[^>]*|aria-disabled="true"/.test(row)&&row.includes('aria-disabled="true"')));
 assert.ok(rows.every(row=>!row.includes('aria-disabled')),'and enabled while the draft is the applied model');
 assert.equal(controls('blank'),'');
});

test('link toggle (ADR-024): with an anchor every row shows its direct link as a coloured check, a lock or an empty circle',async()=>{
 const {connectButton,linkWith}=await import('../public/app/rule-board.js');
 const state=make();admit(state,'try');
 // The core states each constraint's removal requirement (ADR-065).
 const removal={hard:'impossible',proven:'policy-override',pedagogical:'none'};
 const c=(before,after,editability)=>({before,after,editability,removal:removal[editability],origins:['dependency'],reasons:[]});
 state.authorInsight={rules:{provenance:'complete',unexplained:0,stale:0,relaxations:[],constraints:[c(1,4,'hard'),c(2,4,'proven'),c(4,5,'pedagogical')]}};
 assert.match(connectButton(state,4),/aria-pressed="false"/);assert.doesNotMatch(connectButton(state,4),/data-link/,'no anchor: a plain circle');
 state.ruleConnect=4;
 const kind=id=>connectButton(state,id).match(/data-link="(\w+)"/)?.[1];
 assert.deepEqual([4,1,2,5,3].map(kind),['anchor','before','before','after','none']);
 assert.match(connectButton(state,1),/link-locked[\s\S]*nem szüntethető meg/);
 assert.match(connectButton(state,2),/aria-pressed="true"[\s\S]*megnyomva megszünteted/);
 assert.match(connectButton(state,3),/aria-pressed="false"[\s\S]*létrehozása/);
 assert.equal(linkWith(state,4,5).after,5);assert.equal(linkWith(state,5,4).before,4,'a link is found from either end');assert.equal(linkWith(state,4,3),undefined);
});

test('pin toggle: a board row pins the line at its reference place and says so for screen readers',async()=>{
 const {pinButton}=await import('../public/app/rule-board.js');
 assert.match(pinButton(3,2,false),/data-rule-pin="3" aria-pressed="false" aria-label="A #3 sor rögzítése a 3\. helyen"/);
 assert.match(pinButton(3,2,true),/aria-pressed="true" aria-label="A #3 sor rögzítésének feloldása \(most a 3\. helyen rögzített\)"/);
 assert.match(pinButton(3,2,true),/class="icon"[\s\S]*pin-head/,'the pin icon, filled by CSS when pressed');
});

test('ADR-108 (E6): Try opens on the draft’s own second-gate decision, without a request; a changed source or setting makes it stale, a title does not',()=>{
 const state=make();assert.match(tryAdmission(state).message,/Előbb készíts modellt/);
 admit(state,'rules');
 assert.equal(tryAdmission(state).ok,false,'a draft without a decision stays closed');
 const passed={gate:'rules-to-try',verdict:'passed',admitted:true,reasons:[],message:''};
 state.authorInsight={tryGate:passed};assert.deepEqual(tryAdmission(state),{ok:true,message:''});
 state.author.title='Új cím';assert.equal(tryAdmission(state).ok,true,'a title is not evidence');state.author.title=state.authorBaseline.title;
 state.author.source+='\n';assert.match(tryAdmission(state).message,/a modell készítése óta változott/);
 state.author.source=state.authorBaseline.source;state.author.policy={unknownPolicy:'block'};assert.equal(tryAdmission(state).ok,false,'a setting is evidence');
 delete state.author.policy;
 state.authorInsight={tryGate:{...passed,verdict:'inconclusive',message:'Továbbléphetsz a Próbára, de…'}};
 assert.deepEqual(tryAdmission(state),{ok:true,message:'Továbbléphetsz a Próbára, de…'});
 assert.equal(flowSteps(state).find(step=>step.step==='try').status,'Figyelem');
 state.authorInsight={tryGate:{...passed,verdict:'inconclusive',admitted:false,message:'A Próba lépés nem nyitható meg a „tilt” beállítás miatt'}};
 assert.equal(tryAdmission(state).ok,false);assert.equal(flowSteps(state).find(step=>step.step==='try').status,'Zárolt');
});

test('ADR-133: with the view switches off (the shipped page) the solution editor is never entered; the sorter stays',()=>{
 const state=make();admit(state,'try');
 assert.equal(enterView(state,attempt(),['const a = 1;'],'edit'),false);assert.equal(state.view,'sort');
 enterMode(state,'practice');assert.equal(enterView(state,attempt(),['const a = 1;'],'edit'),false);assert.equal(state.view,'sort');
});
