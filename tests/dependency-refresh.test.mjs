import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {refreshLegacyDependencies} from '../dist/author/engine.js';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {auditReference} from '../src/author/audit.mjs';
import {compileCodeLineExercise, validateSubmission} from '../dist/index.js';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {permutations} from './fixtures/language-ir.mjs';

const original=JSON.parse(await readFile(new URL('./fixtures/evaluate-legacy-serial.model.json',import.meta.url),'utf8'));
const ports={generate:input=>generateCodeLineExercise(input,ts),audit:model=>auditReference(model,ts)};
const imageOrder=[1,3,5,2,4,6,7];
function grade(model, order=imageOrder) {
 const result=compileCodeLineExercise(model);assert.ok(!result.status,result.message);
 const byId=new Map(model.lines.map(line=>[line.id,line.code]));
 return validateSubmission(result.compiled,{exerciseId:model.id,revision:model.revision,lines:order.map(id=>byId.get(id))});
}
test('exact user snapshot stays serial on import; explicit refresh accepts b/note/a/c without weakening the validator',async()=>{
 const snapshot=structuredClone(original);
 assert.equal(grade(original).status,'rejected');
 const current=generateCodeLineExercise({source:original.lines.map(line=>line.code).join('\n')},ts);
 assert.equal(grade(current).status,'accepted');
 const refreshed=await refreshLegacyDependencies(original,ports);
 const downloadable=JSON.parse(await readFile(new URL('../docs/evaluate-legacy-serial.corrected.json',import.meta.url),'utf8'));
 assert.deepEqual(downloadable,{...refreshed,revision:2});
 assert.deepEqual(original,snapshot);
 assert.deepEqual(refreshed.lines.map(line=>line.dependencies),[[],[1],[1],[2,3],[1],[4,5],[6]]);
 assert.equal(refreshed.authoring.dependencyPolicy,'scoped-effect-analysis-v11');
 for(const [index,line] of refreshed.lines.entries())assert.deepEqual({...line,dependencies:[]},{...original.lines[index],dependencies:[]});
 assert.deepEqual(refreshed.blocks,original.blocks);assert.equal(grade(refreshed).status,'accepted');
 for(const order of [[1,3,4,2,5,6,7],[1,3,2,6,4,5,7],[1,3,2,4,6,5,7]])assert.equal(grade(refreshed,order).status,'rejected');
 let accepted=0;
 for(const order of permutations([1,2,3,4,5,6,7])){
  const at=id=>order.indexOf(id),expected=order[0]===1&&order.at(-1)===7&&at(2)<at(4)&&at(3)<at(4)&&at(4)<at(6)&&at(5)<at(6);
  assert.equal(grade(refreshed,order).accepted,expected,JSON.stringify(order));if(expected)accepted++;
 }
 assert.equal(accepted,8);
});
test('refresh maps arbitrary line/scope/function IDs, retains provenance/fixed/manual edges/profiles',async()=>{
 const model=structuredClone(original),mapping=new Map(model.lines.map((line,index)=>[line.id,100+index*7]));
 for(const line of model.lines){line.id=mapping.get(line.id);line.dependencies=line.dependencies.map(id=>mapping.get(id));line.functionBlock=99;if(line.scopeId)line.scopeId='custom-function';line.sourceLine=line.id;}
 model.lines[0].fixed=true;
 Object.assign(model.blocks[0],{id:'custom-function',functionBlock:99,openLineId:mapping.get(1),closeLineId:mapping.get(7)});
 model.edges=[{before:mapping.get(2),after:mapping.get(3)}];
 model.profiles=[{id:'custom',edges:[{before:mapping.get(4),after:mapping.get(5)}]}];
 const refreshed=await refreshLegacyDependencies(model,ports);
 assert.deepEqual(refreshed.lines[3].dependencies,[mapping.get(2),mapping.get(3)]);
 assert.deepEqual(refreshed.blocks,model.blocks);assert.deepEqual(refreshed.profiles,model.profiles);assert.deepEqual(refreshed.edges,model.edges);assert.equal(refreshed.lines[0].fixed,true);
 assert.equal(refreshed.authoring.dependencyHints[0].declarationLine,mapping.get(2));
 assert.equal(grade(refreshed,imageOrder.map(id=>mapping.get(id))).status,'rejected'); // manual edge still forbids b before a
});
test('structural/physical changes and malformed references fail before producing a replacement',async()=>{
 const snapshot=structuredClone(original);
 const weaker=structuredClone(original);weaker.blocks=[];for(const line of weaker.lines){line.functionBlock=0;line.scopeId=null;}
 await assert.rejects(refreshLegacyDependencies(weaker,ports),/struktúr/);
 const trailing=structuredClone(original);trailing.lines.at(-1).code+=' ';
 await assert.rejects(refreshLegacyDependencies(trailing,ports),/struktúr/);
 const invalid=structuredClone(original);invalid.lines[0].code='function broken( {';
 await assert.rejects(refreshLegacyDependencies(invalid,ports),/Szintaktikai/);
 assert.deepEqual(original,snapshot);
});
test('Node author catalog imports exactly; refresh is explicit, old preview remains usable',async()=>{
 const catalog=await ExerciseCatalog.open(fileURLToPath(new URL('../examples/',import.meta.url)));
 const first=await catalog.createDraft({model:original});
 assert.deepEqual(first.model.lines.map(line=>line.dependencies),original.lines.map(line=>line.dependencies));
 const lines=imageOrder.map(id=>original.lines.find(line=>line.id===id).code);
 assert.equal(catalog.preview({draftId:first.draftId,lines}).status,'rejected');
 const second=await catalog.createDraft({model:first.model,refreshDependencies:true});
 assert.equal(catalog.preview({draftId:second.draftId,lines}).status,'accepted');
 assert.equal(catalog.preview({draftId:first.draftId,lines}).status,'rejected');
 await assert.rejects(catalog.createDraft({model:original,refreshDependencies:'yes'}));
});
