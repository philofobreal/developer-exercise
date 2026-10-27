/** ADR-022: the workbench state machine. Two modes, three author steps, one active step;
 * steps after the source need an applied model and turn stale on unapplied reference or JSON edits. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {authorPreviewId,blockedReason,continuityKey,enterMode,enterView,flowSteps,jsonPending,landAfterAdmission,staleReason,stepOf} from '../public/app/flow.js';
import {admitAuthorModel} from '../public/app/author-workspace.js';
import {connection} from '../public/app/rule-board.js';

const trusted={id:'trusted',revision:1,title:'Trusted',description:'',language:'javascript',lines:[{id:1,code:'const a = 1;'}]};
const make=()=>({exercises:[trusted],active:null,previews:new Map(),mode:'author',view:'author',practiceActive:null,author:{title:'T',description:'',language:'javascript',source:'const a = 1;',message:''},modelDraft:'',modelMessage:''});
const attempt=()=>({answer:[1],pool:[],draft:'',report:null,feedback:'',generation:0});
/** What a successful admission leaves behind (installPreview + admitAuthorModel). */
function admit(state,land){
 const model={...trusted,id:'author-preview',schemaVersion:2,blocks:[],lines:[{id:1,code:'const a = 1;',dependencies:[],fixed:false,functionBlock:0,scopeId:null}]};
 state.previews.clear();state.previews.set(model.id,'draft-1');state.exercises=[{...model,previewOnly:true},trusted];state.authorModel=structuredClone(model);state.modelDraft=JSON.stringify(model,null,2);
 admitAuthorModel(state,model);landAfterAdmission(state,land);return model;
}

test('steps: rules and try are locked until a model is applied; the source is always open',()=>{
 const state=make();
 assert.deepEqual(flowSteps(state).map(s=>[s.step,!!s.locked,s.current]),[['source',false,true],['rules',true,false],['try',true,false]]);
 for(const view of ['model','sort','edit']){assert.match(blockedReason(state,view),/Forrás/);assert.equal(enterView(state,undefined,[],view),false);assert.equal(state.view,'author');}
 admit(state,'rules');
 assert.equal(state.view,'model');assert.equal(state.active,'author-preview');assert.equal(authorPreviewId(state),'author-preview');
 assert.deepEqual(flowSteps(state).map(s=>[s.step,!!s.locked,s.current]),[['source',false,false],['rules',false,true],['try',false,false]]);
 assert.equal(enterView(state,attempt(),['const a = 1;'],'edit'),true);assert.equal(stepOf(state.view),'try');
});

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

test('modes: practice shows only trusted exercises and the try views; each mode returns to its own view',()=>{
 const state=make();admit(state,'rules');
 enterMode(state,'practice');
 assert.deepEqual([state.mode,state.active,state.view],['practice','trusted','sort']);
 assert.match(blockedReason(state,'author'),/rendező/);assert.equal(enterView(state,attempt(),[],'model'),false);
 assert.equal(enterView(state,attempt(),['const a = 1;'],'edit'),true);
 enterMode(state,'author');assert.deepEqual([state.mode,state.active,state.view],['author','author-preview','model']);
 enterMode(state,'practice');assert.equal(state.view,'edit','practice returns to its own last view');
});

test('modes: without a model the author mode returns to the source; learner preview leaves it',()=>{
 const state=make();state.view='author';enterMode(state,'practice');state.modeViews.author='model';
 enterMode(state,'author');assert.equal(state.view,'author','a locked step is never restored');
 admit(state,'try');state.learnerPreview=true;
 assert.match(blockedReason(state,'model'),/rendező/);
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
 assert.match(renderTryRules(state),/data-try-rules/);
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
