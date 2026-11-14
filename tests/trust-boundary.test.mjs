import test from 'node:test';
import assert from 'node:assert/strict';
import {admit} from './support/try-gate.mjs';
import {readFile} from 'node:fs/promises';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {createApplication} from '../src/server/http.mjs';
import {compileCodeLineExercise} from '../dist/index.js';
const model=JSON.parse(await readFile(new URL('./fixtures/legacy-examples/sum-js.json',import.meta.url),'utf8'));
test('learner HTTP evaluation never parses code or accepts client grading rules',async t=>{
 const compiled=compileCodeLineExercise(model),catalog=new ExerciseCatalog(new Map([[model.id,{model,compiled:compiled.compiled}]]));
 catalog.parser=()=>{throw Error('Learner parsing forbidden');};
 const server=createApplication({catalog,staticRoot:new URL('../public',import.meta.url).pathname});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const post=async body=>(await fetch(`http://127.0.0.1:${server.address().port}/api/evaluate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
 const lines=model.lines.map(x=>x.code),body={exerciseId:model.id,revision:model.revision,lines};
 assert.equal((await post(body)).status,'accepted');
 const altered=[...lines];altered[1]='globalThis.executed = true;';
 const report=await post({...body,lines:altered,model:{...model,lines:altered.map((code,i)=>({...model.lines[i],code,dependencies:[]}))},profiles:[],dependencies:[]});
 assert.equal(report.status,'rejected');assert.equal(globalThis.executed,undefined);
 assert.equal((await post(body)).status,'accepted');
});

test('F1 disclosure (ADR-026): a trusted evaluation explains only up to positions, the author preview everything',async()=>{
 const compiled=compileCodeLineExercise(model),catalog=new ExerciseCatalog(new Map([[model.id,{model,compiled:compiled.compiled}]]));
 const lines=model.lines.map(x=>x.code),swapped=[...lines];
 // An ordering conflict between two unique lines: a rules-level diagnostic exists.
 const [i,j]=model.lines.flatMap((line,index)=>line.dependencies.length&&!model.lines.some((other,k)=>k!==index&&other.code.trim()===line.code.trim())?[index]:[]).slice(0,1).flatMap(index=>[model.lines.findIndex(line=>line.id===model.lines[index].dependencies[0]),index]);
 [swapped[i],swapped[j]]=[swapped[j],swapped[i]];
 const trusted=catalog.evaluate({exerciseId:model.id,revision:model.revision,lines:swapped});
 assert.equal(trusted.status,'rejected');
 assert.equal(trusted.feedback.author,undefined,'no author view for a learner');
 assert.deepEqual(Object.keys(trusted.feedback.learner).sort(),['diagnostics','explained','level','withheld']);
 assert.equal(trusted.feedback.learner.level,'positions');
 for(const diagnostic of trusted.feedback.learner.diagnostics){
  assert.ok(['verdict','positions'].includes(diagnostic.disclosure),diagnostic.code);
  assert.equal(diagnostic.rule,undefined,'no rule identities leak to the learner');
 }
 assert.ok(trusted.feedback.learner.withheld>0);
 assert.doesNotMatch(JSON.stringify(trusted),/"before"|"after"|"categories"|"origins"/,'the trusted graph never travels');
 // The author preview of the same model explains the conflict, naming the rule.
 const draft=await catalog.createDraft({model:structuredClone(model)});
 await admit(catalog,draft);const preview=catalog.preview({draftId:draft.draftId,lines:swapped});
 assert.ok(preview.feedback.author.diagnostics.some(d=>d.rule&&d.certainty==='proven'),JSON.stringify(preview.feedback.author.diagnostics.map(d=>d.code)));
 assert.equal(preview.feedback.author.level,'provenance');assert.equal(preview.feedback.learner.level,'positions');
 // ADR-027: an author who opts in raises the learner to the rules level: the violated pair, never why, never the rest of the graph.
 const opted={...structuredClone(model),learnerFeedback:'rules'},raisedCatalog=new ExerciseCatalog(new Map([[opted.id,{model:opted,compiled:compileCodeLineExercise(opted).compiled}]]));
 const raised=raisedCatalog.evaluate({exerciseId:opted.id,revision:opted.revision,lines:swapped}).feedback.learner;
 assert.equal(raised.level,'rules');
 const named=raised.diagnostics.filter(d=>d.rule);assert.ok(named.length>0);
 assert.ok(named.length<=compiled.compiled.definition.tokens.length,'only violated pairs, not the dependency graph');
 for(const d of named){assert.deepEqual(d.rule.categories,[]);assert.equal(d.reasons,undefined);}
 assert.doesNotMatch(JSON.stringify(raised),/"(data|effect|policy|conservative|author|structure)"/,'no provenance category travels');
});

test('ADR-147: where the author allows it an evaluation answer carries the direct rules as pairs; the listing never does',async t=>{
 const {explainConstraints}=await import('../dist/index.js');
 const opted={...structuredClone(model),learnerFeedback:'graph'},compiled=compileCodeLineExercise(opted),catalog=new ExerciseCatalog(new Map([[opted.id,{model:opted,compiled:compiled.compiled}]]));
 // Nothing of the rules reaches a learner before a check: the listing has the lines only.
 assert.doesNotMatch(JSON.stringify(catalog.list()),/"before"|"after"|"rules"|"dependencies"|"edges"|"learnerFeedback"/,'the listing carries no rule');
 const lines=opted.lines.map(x=>x.code),body={exerciseId:opted.id,revision:opted.revision,lines};
 const accepted=catalog.evaluate(body);assert.equal(accepted.status,'accepted');
 const direct=explainConstraints(opted).lines.flatMap(line=>line.predecessors),pair=c=>c.before+'>'+c.after;
 assert.ok(direct.length>0);
 assert.deepEqual(accepted.rules.constraints.map(pair).sort(),direct.map(pair).sort(),'every direct rule once, none of the closure');
 for(const rule of accepted.rules.constraints)assert.deepEqual(Object.keys(rule).sort(),['after','before','structural'],'a pair and whether it is structure, nothing else');
 assert.deepEqual(accepted.rules.constraints.map(rule=>rule.structural),direct.map(c=>c.removal==='impossible'));
 assert.deepEqual(Object.keys(accepted.rules),['constraints']);
 // A rejection: the violated pair is named, as at the `rules` level, and the sheet comes with it.
 const swapped=[...lines],after=opted.lines.findIndex((line,index)=>line.dependencies.length&&!opted.lines.some((other,k)=>k!==index&&other.code.trim()===line.code.trim())),before=opted.lines.findIndex(line=>line.id===opted.lines[after].dependencies[0]);
 [swapped[before],swapped[after]]=[swapped[after],swapped[before]];
 const rejected=catalog.evaluate({...body,lines:swapped});
 assert.equal(rejected.status,'rejected');assert.equal(rejected.feedback.learner.level,'rules');assert.equal(rejected.feedback.author,undefined);
 assert.ok(rejected.feedback.learner.diagnostics.some(d=>d.rule),'the violated pair is named');assert.deepEqual(rejected.rules,accepted.rules);
 for(const d of rejected.feedback.learner.diagnostics){assert.equal(d.reasons,undefined);if(d.rule)assert.deepEqual(d.rule.categories,[]);}
 assert.doesNotMatch(JSON.stringify(rejected),/"(data|effect|policy|conservative|author|structure)"|"reasons"|"note"|"meanings"|"provenance"/,'no reason, category or provenance travels');
 // Every other level, and an unknown stored value: no sheet.
 for(const level of [undefined,'positions','rules','everything','provenance']){
  const other={...structuredClone(model),...(level?{learnerFeedback:level}:{})},shelf=new ExerciseCatalog(new Map([[other.id,{model:other,compiled:compileCodeLineExercise(other).compiled}]]));
  for(const submitted of [lines,swapped])assert.equal('rules' in shelf.evaluate({...body,lines:submitted}),false,String(level));
 }
 // Over HTTP it is the same answer, and the listing stays bare.
 const server=createApplication({catalog,staticRoot:new URL('../public',import.meta.url).pathname});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url=`http://127.0.0.1:${server.address().port}/api/`;
 assert.doesNotMatch(await (await fetch(url+'exercises')).text(),/"before"|"after"|"rules"|"learnerFeedback"/);
 const posted=await (await fetch(url+'evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,learnerFeedback:'graph',rules:{constraints:[]}})})).json();
 assert.deepEqual(posted.rules,accepted.rules,'what the submission claims about rules changes nothing');
});

test('ADR-147: the learner\'s level is the author\'s choice on a draft and travels with the author\'s requests',async()=>{
 const {withLearnerFeedback}=await import('../dist/index.js');
 // The core's own rule: a known level other than the model's gives a new model; anything else gives the same object.
 const plain=structuredClone(model);
 assert.equal(withLearnerFeedback(plain,undefined),plain);assert.equal(withLearnerFeedback(plain,'positions'),plain);assert.equal(withLearnerFeedback(plain,'provenance'),plain);assert.equal(withLearnerFeedback(plain,{}),plain);
 const raised=withLearnerFeedback(plain,'graph');assert.notEqual(raised,plain);assert.equal(raised.learnerFeedback,'graph');assert.equal('learnerFeedback' in plain,false,'the given model is not changed');
 assert.equal(withLearnerFeedback(raised,'graph'),raised);assert.equal(withLearnerFeedback(raised,'rules').learnerFeedback,'rules');assert.equal('learnerFeedback' in withLearnerFeedback(raised,'positions'),false);
 // A draft made from source takes the level the request carries; an unknown one is `positions`.
 const source='function f() {\n  const a = 1;\n  const b = 2;\n  const c = a + 3;\n  g(b, c);\n}',catalog=new ExerciseCatalog(new Map());
 const draft=await catalog.createDraft({source,language:'javascript',learnerFeedback:'graph'});assert.equal(draft.model.learnerFeedback,'graph');
 assert.equal('learnerFeedback' in (await catalog.createDraft({source,language:'javascript',learnerFeedback:'everything'})).model,false);
 assert.equal('learnerFeedback' in (await catalog.createDraft({source,language:'javascript'})).model,false);
 await admit(catalog,draft);
 const lines=draft.model.lines.map(line=>line.code),preview=level=>catalog.preview({draftId:draft.draftId,lines,...(level?{learnerFeedback:level}:{})});
 // The preview shows the learner what the exercise would: the sheet beside the author's own feedback.
 const first=preview();assert.equal(first.status,'accepted');assert.ok(first.rules.constraints.length>0);assert.equal(first.feedback.author.level,'provenance');
 // The author lowers the level without re-analysis: the next preview carries it, and the sheet is gone.
 assert.equal('rules' in preview('rules'),false);assert.equal(preview('rules').feedback.learner.level,'rules');
 assert.equal('rules' in preview(),false,'the draft keeps the last choice');
 assert.equal(preview('positions').feedback.learner.level,'positions');
 assert.ok(preview('graph').rules.constraints.length>0);
 // A rule edit carries it too, and the edited draft keeps it.
 const lowered=await catalog.editDraft({draftId:draft.draftId,edits:[{kind:'set-fixed',line:draft.model.lines[0].id,fixed:true}],learnerFeedback:'rules'});
 assert.equal(lowered.ok,true);assert.equal(lowered.model.learnerFeedback,'rules');
 const kept=await catalog.editDraft({draftId:lowered.draftId,edits:[{kind:'set-fixed',line:draft.model.lines[0].id,fixed:false}]});
 assert.equal(kept.model.learnerFeedback,'rules','without a level in the request the draft keeps its own');
 // An applied model JSON states its own level; the request's does not override it.
 const applied=await catalog.createDraft({model:{...structuredClone(kept.model),learnerFeedback:'graph'},learnerFeedback:'positions'});
 assert.equal(applied.model.learnerFeedback,'graph');
});
