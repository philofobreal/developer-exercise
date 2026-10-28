import test from 'node:test';
import assert from 'node:assert/strict';
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
 const preview=catalog.preview({draftId:draft.draftId,lines:swapped});
 assert.ok(preview.feedback.author.diagnostics.some(d=>d.rule&&d.certainty==='proven'),JSON.stringify(preview.feedback.author.diagnostics.map(d=>d.code)));
 assert.equal(preview.feedback.author.level,'provenance');assert.equal(preview.feedback.learner.level,'positions');
});
