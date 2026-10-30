/** ADR-021: the author rule panel's API and presentation. Rule edits go through the trusted
 * draft copy and the core (ADR-018), are re-qualified by the gate (ADR-017), never overwrite
 * a draft on refusal, and the panel exists only for the author's own draft. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {ExerciseCatalog,ServiceError} from '../src/server/catalog.mjs';
import {createApplication} from '../src/server/http.mjs';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {auditReference} from '../src/author/audit.mjs';
import {authorRuleSheet,refreshAuthorModel} from '../dist/author/engine.js';
import {explainConstraints,compileCodeLineExercise,validateSubmission,sourceTextDigest} from '../dist/index.js';
import {createRuleMarks,recordRuleRefusal,renderModelInsight,renderRulePanel,ruleEditBlocked,settleRuleSelection} from '../public/app/rule-panel.js';
import {authorRequest} from '../public/app/author-workspace.js';

// Lines: 1 open, 2 a, 3 b, 4 c (reads a), 5 g(b, c), 6 close. 2 → 4 is proven (binding input).
const source='function f() {\n  const a = 1;\n  const b = 2;\n  const c = a + 3;\n  g(b, c);\n}';
const grade=(model,order)=>{const compiled=compileCodeLineExercise(model);assert.ok(!compiled.status,compiled.message);const code=new Map(model.lines.map(line=>[line.id,line.code]));return validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:order.map(id=>code.get(id))}).status;};

test('rule sheet: every direct constraint once, without the quadratic closure',()=>{
 const model=generateCodeLineExercise({source,language:'javascript'},ts),sheet=authorRuleSheet(model),explanation=explainConstraints(model);
 const direct=explanation.lines.flatMap(line=>line.predecessors);
 assert.deepEqual(sheet.constraints,direct);
 assert.equal(new Set(sheet.constraints.map(c=>c.before+':'+c.after)).size,sheet.constraints.length);
 assert.equal(sheet.provenance,'complete');
 assert.ok(!('lines' in sheet)&&sheet.constraints.every(c=>!('ancestors' in c)));
});

test('server: an edit replaces the draft, is re-qualified and keeps the reference accepted',async()=>{
 const catalog=new ExerciseCatalog(new Map()),first=await catalog.createDraft({source,language:'javascript'});
 assert.equal(first.verification.status,'analysis-verified');
 assert.deepEqual(first.rules,authorRuleSheet(first.model));
 const added=await catalog.editDraft({draftId:first.draftId,edits:[{kind:'add-rule',before:2,after:3,note:'<img src=x onerror=alert(1)>'}]});
 assert.equal(added.ok,true);assert.notEqual(added.draftId,first.draftId);
 assert.equal(added.model.revision,first.model.revision+1);assert.equal(added.model.id,'author-'+added.draftId);
 assert.equal(added.verification.status,'author-modified');
 assert.deepEqual([added.effect.stricter,added.effect.looser],['yes','no']);
 assert.equal(grade(first.model,added.effect.stricterWitness),'accepted');assert.equal(grade(added.model,added.effect.stricterWitness),'rejected');
 const rule=added.rules.constraints.find(c=>c.before===2&&c.after===3);
 assert.deepEqual([rule.editability,rule.note],['pedagogical','<img src=x onerror=alert(1)>']);
 // The preview grades the edited revision; the replaced draft is gone, so editing never fills the limit.
 assert.equal(catalog.preview({draftId:added.draftId,lines:added.model.lines.map(line=>line.code)}).status,'accepted');
 assert.throws(()=>catalog.preview({draftId:first.draftId,lines:[]}),error=>error instanceof ServiceError&&error.statusCode===404);
 assert.equal(catalog.drafts.size,1);
});

test('server: a refused edit is a domain answer naming the acknowledgement, and the draft is untouched',async()=>{
 const catalog=new ExerciseCatalog(new Map()),first=await catalog.createDraft({source,language:'javascript'});
 const refused=await catalog.editDraft({draftId:first.draftId,edits:[{kind:'remove-rule',before:2,after:4}]});
 assert.deepEqual([refused.ok,refused.error,refused.acknowledge,refused.index],[false,'needs-acknowledgement','policy-override',0]);
 assert.equal(catalog.drafts.get(first.draftId).model,first.model,'the draft was not replaced');
 const hard=await catalog.editDraft({draftId:first.draftId,edits:[{kind:'remove-rule',before:1,after:6}]});
 assert.deepEqual([hard.ok,hard.error,hard.acknowledge],[false,'hard-constraint',undefined]);
 const relaxed=await catalog.editDraft({draftId:first.draftId,edits:[{kind:'remove-rule',before:2,after:4,acknowledge:'policy-override',note:'Didaktikai lazítás'}]});
 assert.equal(relaxed.verification.status,'unverified');
 assert.deepEqual(relaxed.rules.relaxations.map(({removed,...entry})=>entry),[{before:2,after:4,editability:'proven',note:'Didaktikai lazítás',sourceDigest:sourceTextDigest(first.model.lines)}]);
 assert.deepEqual(relaxed.rules.relaxations[0].removed.origins,['dependency'],'the record says what a restore brings back (ADR-024)');
 assert.equal(relaxed.effect.looser,'yes');
 await assert.rejects(catalog.editDraft({draftId:first.draftId,edits:[]}),error=>error.statusCode===404,'the relaxed draft replaced the original');
 await assert.rejects(catalog.editDraft({draftId:relaxed.draftId}),error=>error.statusCode===400);
 const invalid=await catalog.editDraft({draftId:relaxed.draftId,edits:[{kind:'teleport'}]});
 assert.deepEqual([invalid.ok,invalid.error],[false,'invalid-edit']);
});

test('HTTP: POST /api/author/rules reaches the catalog; a refusal is 200 with ok:false',async t=>{
 const catalog=new ExerciseCatalog(new Map()),server=createApplication({catalog,staticRoot:process.cwd()});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());
 const url=`http://127.0.0.1:${server.address().port}/api/author/`;
 const post=async(route,body)=>{const response=await fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
 const first=await post('compile',{source,language:'javascript'});
 assert.equal(first.status,200);assert.ok(first.body.rules.constraints.length>0);
 const refused=await post('rules',{draftId:first.body.draftId,edits:[{kind:'remove-rule',before:2,after:4}]});
 assert.deepEqual([refused.status,refused.body.ok,refused.body.acknowledge],[200,false,'policy-override']);
 const added=await post('rules',{draftId:first.body.draftId,edits:[{kind:'set-fixed',line:3,fixed:true}]});
 assert.deepEqual([added.status,added.body.ok,added.body.verification.status],[200,true,'author-modified']);
 assert.equal((await post('rules',{draftId:'missing',edits:[]})).status,404);
});

test('refresh re-derives under the recorded import emit',async()=>{
 const imports=["import { Shape } from './shape';","import { Size } from './size';",'export function make(shape: Shape, size: Size): number {','  return 1;','}'].join('\n');
 const ports={generate:input=>generateCodeLineExercise(input,ts),audit:model=>auditReference(model,ts)};
 for(const [importEmit,status] of [['elide-unused','accepted'],['verbatim','rejected']]){
  const model=generateCodeLineExercise({source:imports,language:'typescript',importEmit},ts);
  assert.equal(grade(model,[2,1,3,4,5]),status,importEmit);
  const {model:refreshed}=await refreshAuthorModel(model,ports);
  assert.equal(refreshed.authoring.evidence.environment.importEmit,importEmit);
  assert.equal(grade(refreshed,[2,1,3,4,5]),status,'refreshed '+importEmit);
 }
});

const panelState=async(overrides={})=>{
 const catalog=new ExerciseCatalog(new Map()),draft=await catalog.editDraft({draftId:(await catalog.createDraft({source,language:'javascript'})).draftId,edits:[{kind:'add-rule',before:2,after:3,note:'<script>alert(1)</script>'}]});
 return {previews:new Map([['p',draft.draftId]]),active:'p',authorModel:draft.model,modelDraft:JSON.stringify(draft.model,null,2),authorInsight:{rules:draft.rules,verification:draft.verification,audit:draft.audit,effect:draft.effect},ruleSelection:{line:3,message:''},...overrides};
};

test('panel: shows direct rules with reasons, escapes author text, offers only removable rules',async()=>{
 const state=await panelState(),html=renderRulePanel(state);
 assert.match(html,/data-rule-panel-line="3"/);
 assert.ok(!html.includes('<script>alert(1)</script>')&&html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'),'notes are escaped');
 assert.match(html,/data-rule-pair="2-3"/);assert.match(html,/Szerzői/);
 assert.match(html,/data-rule-edit="remove" data-before="2" data-after="3"/);
 assert.ok(!/data-rule-edit="remove" data-before="1" data-after="3"/.test(html),'a structural rule offers no removal');
 assert.match(html,/data-rule-effect/);assert.match(html,/Szerzői döntéssel módosított/);
 const marks=createRuleMarks(state);
 assert.deepEqual([1,2,3,4,5,6].map(marks),[' rule-before',' rule-before',' rule-selected','',' rule-after',' rule-after']);
});

test('panel: absent for learner preview, trusted exercises and a missing sheet',async()=>{
 for(const overrides of [{learnerPreview:true},{previews:new Map()},{authorInsight:{}}]){
  const state=await panelState(overrides);
  assert.equal(renderRulePanel(state),'');assert.equal(createRuleMarks(state)(3),'');
 }
 assert.match(renderRulePanel(await panelState({ruleSelection:undefined})),/data-rule-hint/);
});

test('panel state: refusals ask for the named acknowledgement; new drafts settle the selection; dirty JSON blocks',async()=>{
 const selection={line:4,message:''},edit={kind:'remove-rule',before:2,after:4};
 recordRuleRefusal(selection,{ok:false,error:'needs-acknowledgement',message:'Bizonyított szabály',index:0,acknowledge:'policy-override'},[edit]);
 assert.deepEqual(selection.pending,{edit,acknowledge:'policy-override',message:'Bizonyított szabály'});
 assert.match(renderRulePanel(await panelState({ruleSelection:selection})),/Policy-felülírás megerősítése/);
 recordRuleRefusal(selection,{ok:false,error:'cycle',message:'Kör',index:0},[{kind:'add-rule',before:5,after:2}]);
 assert.deepEqual([selection.pending,selection.message],[undefined,'Kör']);
 const state=await panelState();settleRuleSelection(state,true);assert.match(state.ruleSelection.message,/érvényes/);
 state.ruleSelection.line=99;settleRuleSelection(state,false);assert.equal(state.ruleSelection,undefined);
 const dirty=await panelState();assert.equal(ruleEditBlocked(dirty),'');dirty.modelDraft+=' ';assert.match(ruleEditBlocked(dirty),/nem alkalmazott JSON/);
});

test('insight: qualification, claims, audit and refresh report are shown and escaped',async()=>{
 const state=await panelState(),html=renderModelInsight({...state.authorInsight,audit:{semantics:'unverifiable',diagnostics:[{line:1,code:2307,message:"Cannot find module '<x>'",context:true}],unresolved:['<x>'],assumptions:[]},refresh:{authorRules:1,legacyEdges:0,supersededEdges:2,relaxations:[{before:2,after:4,outcome:'revoked'}],droppedNotes:1}});
 assert.match(html,/data-verification-status>Szerzői döntéssel módosított/);assert.match(html,/Publikálható/);
 assert.match(html,/projektkontextus/i);assert.ok(!html.includes("'<x>'")&&html.includes('&lt;x&gt;'));
 assert.match(html,/visszavonva/);assert.match(html,/1 megjegyzés elveszett/);
 assert.equal(renderModelInsight(undefined),'');
});

test('insight: a relaxation to confirm again shows why and its escaped note; an unchecked one says so (ADR-044)',async()=>{
 const state=await panelState(),html=renderModelInsight({...state.authorInsight,refresh:{authorRules:0,legacyEdges:0,supersededEdges:0,relaxations:[{before:2,after:4,outcome:'reconfirm',note:'<halott> kód'},{before:3,after:5,outcome:'unchecked'}],droppedNotes:0}});
 assert.match(html,/#2 → #4 lazítás: nincs alkalmazva: a forrás megváltozott a jóváhagyás óta/);
 assert.ok(html.includes('&lt;halott&gt; kód')&&!html.includes('<halott>'));
 assert.match(html,/#3 → #5 lazítás: újra alkalmazva, de régi lazítás/);
});

test('the import emit is sent only for TypeScript',()=>{
 const author={title:'T',description:'D',source:'x',message:'m',importEmit:'elide-unused'};
 assert.deepEqual(authorRequest({...author,language:'typescript'}),{title:'T',description:'D',language:'typescript',source:'x',importEmit:'elide-unused'});
 assert.deepEqual(authorRequest({...author,language:'javascript'}),{title:'T',description:'D',language:'javascript',source:'x'});
});
