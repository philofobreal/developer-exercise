/** ADR-122 (M3): the teacher's task status. Three questions answered from the gate records and the qualification, one
 *  next step, the Rules step's word from the same answer, findings grouped by cause and numbered by source line. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {LONG_TASK_ROWS,renderTaskStatus,taskStatus} from '../public/app/task-status.js';
import {flowSteps} from '../public/app/flow.js';
import {groupFindings,renderFindingGroups,renderSourceDiagnostics} from '../public/app/preflight-settings.js';
import {renderModelInsight} from '../public/app/rule-panel.js';
import {admitAuthorModel} from '../public/app/author-workspace.js';

const SOURCE='const a = 1;\nconst b = 2;';
const checks=(over={})=>({admission:'ok',reference:'accepted',budget:{probed:1,indeterminate:0,maxStates:100},provenance:'complete',rederivation:'match',analyzer:'current',audit:'ok',fallbacks:{count:0,codes:{}},projectionLoss:null,authorRules:0,fixed:0,profiles:0,relaxations:{conservative:0,overrides:0},...over});
const verification=(status='analysis-verified',over={},publishable=true)=>({status,publishable,checks:checks(over),findings:[],claims:[]});
const passed={gate:'rules-to-try',verdict:'passed',admitted:true,reasons:[],message:''};
/** A state with an applied model of `rows` lines, made from SOURCE (what a successful admission leaves behind). */
function applied(rows=2,insight={}){
 const lines=Array.from({length:rows},(_,i)=>({id:i+1,code:`const v${i} = ${i};`,dependencies:[],fixed:false,functionBlock:0,scopeId:null,sourceLine:i+1}));
 const model={id:'author-preview',revision:1,schemaVersion:2,title:'T',description:'',language:'javascript',blocks:[],lines};
 const state={exercises:[model],active:'author-preview',previews:new Map([['author-preview','d']]),mode:'author',view:'model',author:{title:'T',description:'',language:'javascript',source:SOURCE,message:''},modelDraft:JSON.stringify(model,null,2),modelMessage:''};
 state.authorModel=structuredClone(model);admitAuthorModel(state,model,SOURCE);
 state.authorInsight={verification:verification(),tryGate:passed,...insight};
 return state;
}
const rulesWord=state=>flowSteps(state).find(step=>step.step==='rules').status;
const answer=(status,id)=>status.answers.find(item=>item.id===id);
const context=(line,module='m')=>({line,code:'TS2307',message:`Cannot find module '${module}'`,certainty:'unknown',origin:'environment'});

test('a verified, publishable, short task: three yes answers, the step is Kész, the next step is the try',()=>{
 const state=applied(),status=taskStatus(state);
 assert.equal(status.tone,'ok');assert.deepEqual(status.answers.map(item=>[item.id,item.tone]),[['fillable','ok'],['checkable','ok'],['fair','ok']]);
 assert.equal(answer(status,'fillable').text,'A referencia elfogadott; 2 sor.');
 assert.deepEqual(status.next,{text:'Próbáld ki tanulóként.',action:'try'});
 assert.equal(rulesWord(state),'Kész');
 const html=renderTaskStatus(state);
 assert.match(html,/data-task-answer="fair"><b class="task-question">Igazságos\?<\/b><span class="task-verdict"><span class="status-dot" aria-hidden="true"><\/span>Igen<\/span>/);
 assert.doesNotMatch(html,/data-show-rule-kinds|task-findings|Következő lépés/,'the next step is the action bar’s (ADR-123)');
});

test(`a task longer than ${LONG_TASK_ROWS} rows is a warning on Kitölthető?; ${LONG_TASK_ROWS} rows is not`,()=>{
 assert.equal(answer(taskStatus(applied(LONG_TASK_ROWS)),'fillable').tone,'ok');
 const long=taskStatus(applied(LONG_TASK_ROWS+1)),fillable=answer(long,'fillable');
 assert.equal(fillable.tone,'warning');assert.match(fillable.text,new RegExp(`^A referencia elfogadott\\. Hosszú feladat: ${LONG_TASK_ROWS+1} sor\\.`));
 assert.equal(long.tone,'warning');assert.equal(long.next.action,'try','a warning does not keep the teacher from the try');
});

test('a conservative model: Igazságos? Részben, naming its rule kinds in words, with Megmutatom; the step says Figyelem',()=>{
 const state=applied(2,{verification:verification('conservative',{fallbacks:{count:9,codes:{'opaque-row':4,'unclassified-member':5}},projectionLoss:325}),rules:{constraints:[],meanings:{'opaque-row':'elemzésből kimaradt sor','unclassified-member':'kiértékelési fázis nélküli osztálytag'},provenance:'complete',unexplained:0,stale:0,relaxations:[]}});
 const fair=answer(taskStatus(state),'fair');
 assert.equal(fair.tone,'warning');assert.equal(fair.action,'rule-kinds');
 assert.equal(fair.text,'Néhány helyes sorrendet is elutasíthat (9 óvatos szabály: elemzésből kimaradt sor, kiértékelési fázis nélküli osztálytag; 325 sorpárt a sorokra bontás köt sorrendbe, bár az elemzés szabadon hagyta).');
 assert.match(renderTaskStatus(state),/Részben<\/span><span class="task-text">Néhány[^<]*<\/span><button type="button" class="btn" data-show-rule-kinds>/);
 assert.equal(rulesWord(state),'Figyelem');
});

test('undecided findings of the model’s own source: one sentence on Kitölthető?, grouped by cause in the details; another text’s findings are not used',()=>{
 const state=applied(),diagnostics=Array.from({length:11},(_,i)=>context(i+1,'m'+i));
 state.sourceGate={source:SOURCE,gate:{gate:'source-to-rules',verdict:'inconclusive',admitted:true,completeness:'partial',message:'',diagnostics,policyFingerprint:'p',assumptions:[]}};
 const fillable=answer(taskStatus(state),'fillable');
 assert.equal(fillable.tone,'warning');
 assert.equal(fillable.text,'A referencia elfogadott. A forrás vizsgálata nem dőlt el teljesen: 11 sor a projekten kívüli modulra vagy névre hivatkozik, ezért a típusai nem ellenőrizhetők; a sorrend elemzését ez nem érinti.');
 const html=renderTaskStatus(state);
 assert.equal((html.match(/data-diagnostic-count="11"/g)??[]).length,1,'eleven findings of one cause are one row');
 assert.equal((html.match(/data-goto-line=/g)??[]).length,11,'each line still jumps to the source');
 state.sourceGate={...state.sourceGate,source:'const other = 1;'};
 assert.equal(answer(taskStatus(state),'fillable').tone,'ok');assert.doesNotMatch(renderTaskStatus(state),/task-findings/);
});

test('a refused second gate is an error whose next step is the source; a stale source has no status, the step says Elavult',()=>{
 const refused={...passed,verdict:'inconclusive',admitted:false,message:'A Próba lépés nem nyitható meg a „tilt” beállítás miatt: …'};
 const state=applied(2,{tryGate:refused}),status=taskStatus(state);
 assert.equal(status.tone,'error');assert.deepEqual(status.next,{text:refused.message,action:'source'});
 assert.equal(rulesWord(state),'Hiba');
 state.author.source+='\n';
 assert.equal(taskStatus(state),undefined);assert.equal(renderTaskStatus(state),'');assert.equal(rulesWord(state),'Elavult');
});

test('Ellenőrizhető? and the remaining qualifications each give one tone and one sentence',()=>{
 const undecided=taskStatus(applied(2,{verification:verification('conservative',{reference:'indeterminate'},false)}));
 assert.equal(answer(undecided,'checkable').tone,'warning');assert.match(answer(undecided,'checkable').text,/„Nem eldönthető” eredményt/);
 assert.equal(answer(undecided,'fillable').tone,'warning');
 const broken=taskStatus(applied(2,{verification:verification('conservative',{audit:'errors'},false)}));
 assert.equal(answer(broken,'checkable').tone,'error');assert.equal(broken.tone,'error');assert.equal(broken.next.action,'source');
 const rejected=taskStatus(applied(2,{verification:verification('unverified',{reference:'rejected'},false)}));
 assert.equal(answer(rejected,'fillable').tone,'error');assert.equal(answer(rejected,'checkable').tone,'error');
 const authored=answer(taskStatus(applied(2,{verification:verification('author-modified',{authorRules:2,fixed:1})})),'fair');
 assert.equal(authored.text,'A szerző döntése szerint (2 szűkítő szabály, 1 rögzített sor): ezt az elemzés nem igazolja.');
 assert.match(answer(taskStatus(applied(2,{verification:{...verification('unverified'),findings:['Nincs bizonyíték.']}})),'fair').text,/^Nem igazolt: Nincs bizonyíték\./);
});

test('the stepper speaks one vocabulary: Kész, Figyelem, Hiba, Zárolt, Elavult or nothing',()=>{
 const words=new Set(['','Kész','Figyelem','Hiba','Zárolt','Elavult']),seen=new Set();
 const record=state=>{for(const step of flowSteps(state)){assert.ok(words.has(step.status),`${step.step}: „${step.status}”`);seen.add(step.status);}};
 const fresh={exercises:[],active:null,previews:new Map(),mode:'author',view:'author',author:{title:'T',description:'',language:'javascript',source:SOURCE,message:''},modelDraft:'',modelMessage:''};
 record(fresh);
 for(const verdict of ['passed','inconclusive','blocked']){const state=applied();state.sourceGate={source:SOURCE,gate:{verdict,diagnostics:[]}};record(state);}
 record(applied(2,{tryGate:{...passed,verdict:'inconclusive'}}));record(applied(2,{tryGate:{...passed,admitted:false}}));
 const stale=applied();stale.author.source+='\n';record(stale);
 assert.deepEqual([...seen].sort(),[...words].sort(),'every word occurs');
});

test('findings group by cause, the surest first; a single finding keeps its row, a group folds its lines',()=>{
 const definite={line:9,code:'BS001',message:'b before its declaration',certainty:'definite',origin:'runtime-order'};
 const groups=groupFindings([context(3),definite,context(1)]);
 assert.deepEqual(groups.map(group=>group.map(item=>item.line)),[[9],[3,1]]);
 const html=renderFindingGroups([context(3),definite,context(1)]);
 assert.match(html,/<li class="diagnostic certainty-definite" data-diagnostic="BS001"><span class="diagnostic-kind">Biztos hiba<\/span><button type="button" class="diagnostic-line" data-goto-line="9"/);
 assert.match(html,/data-diagnostic-count="2"><span class="diagnostic-kind">Nem eldönthető<\/span><span class="diagnostic-count">2 sor<\/span><span class="diagnostic-message">Hiányzó projektkontextus/);
 const other=renderFindingGroups([{...definite,line:2},definite]);assert.match(other,/b before its declaration \(és még 1 hasonló\)/);
 assert.match(renderSourceDiagnostics({verdict:'inconclusive',diagnostics:[context(1)]},false),/<ol class="diagnostic-list">/);
});

test('the qualification numbers audit findings by source line, as the source step does',()=>{
 const state=applied();state.authorModel.lines[1].sourceLine=3;
 const audit={semantics:'unverifiable',diagnostics:[{line:2,code:2307,message:"Cannot find module 'x'",context:true,certainty:'unknown'}],unresolved:['x'],assumptions:[]};
 const html=renderModelInsight({...state.authorInsight,audit},state.authorModel);
 assert.match(html,/data-goto-line="3"[^>]*>3\. sor<\/button>/);assert.doesNotMatch(html,/data-goto-line="2"/);
 assert.match(renderModelInsight({...state.authorInsight,audit}),/data-goto-line="2"/,'without the model the row number stands');
});

test('ADR-123 (M5): the learner’s title, description and level change the applied model in place, with no stale step',async()=>{
 const {setLearnerData}=await import('../public/app/author-workspace.js');
 const {staleReason,tryAdmission}=await import('../public/app/flow.js');
 const state=applied();
 assert.equal(setLearnerData(state,'title','Új cím'),true);assert.equal(setLearnerData(state,'level','intermediate'),true);assert.equal(setLearnerData(state,'description','Rendezd!'),true);
 assert.equal(state.authorModel.title,'Új cím');assert.equal(state.authorModel.level,'intermediate');assert.equal(state.exercises[0].description,'Rendezd!');
 assert.equal(JSON.parse(state.modelDraft).title,'Új cím','the applied JSON follows');
 assert.equal(staleReason(state),'');assert.equal(tryAdmission(state).ok,true);assert.equal(taskStatus(state).tone,'ok');
 assert.equal(setLearnerData(state,'level',''),true);assert.equal('level' in state.authorModel,false);
 assert.equal(setLearnerData(state,'level','expert'),false);assert.equal(setLearnerData(state,'source','x'),false);assert.equal(state.author.source,SOURCE);
 state.modelDraft='{own unapplied JSON';setLearnerData(state,'title','Még újabb');assert.equal(state.modelDraft,'{own unapplied JSON','an unapplied JSON draft stays as typed');
});

test('ADR-123 (M5): a changed setting is named as such in the stale banner, a changed source as a source change',async()=>{
 const {staleReason}=await import('../public/app/flow.js');
 const state=applied();state.author.inputs='valid';
 assert.match(staleReason(state),/beállítások a modell készítése óta változtak/);
 delete state.author.inputs;state.author.source+='\n';assert.match(staleReason(state),/referenciaforrás/);
});
