/** ADR-014: every generated dependency and edge carries its reason, the core explains
 * each line's constraints from the model alone, and provenance never changes grading. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {refreshLegacyDependencies} from '../dist/author/engine.js';
import {auditReference} from '../src/author/audit.mjs';
import {compileCodeLineExercise,validateSubmission,explainConstraints} from '../dist/index.js';
import {corpus} from './fixtures/ordering-corpus.mjs';
import {neighbourhood} from './support/semantic-oracle.mjs';

const generate=(source,language='javascript',options={})=>generateCodeLineExercise({source:source.join?.('\n')??source,language,...options},ts);
const reasons=(model,before,after)=>model.authoring.provenance.filter(entry=>entry.before===before&&entry.after===after).map(entry=>entry.category+'/'+entry.code);
const bySource=(model,row)=>model.lines.find(line=>line.sourceLine===row).id;
function explained(model){const result=explainConstraints(model);assert.ok(!('status' in result),result.message);return result;}

test('every generated dependency and edge has a known category, and provenance names nothing else',async()=>{
 const sources=[...[...corpus.values()].map(fixture=>[fixture.source,fixture.language]),[await readFile(new URL('./fixtures/copy-field-utility.service.ts',import.meta.url),'utf8'),'typescript']];
 for(const [source,language] of sources){
  const model=generate(source,language),result=explained(model);
  assert.equal(result.provenance,'complete');
  assert.equal(result.stale,0);
  assert.ok(model.authoring.provenance.every(entry=>entry.category!=='unknown'),model.authoring.provenance.filter(entry=>entry.category==='unknown').map(entry=>entry.code).join());
 }
});

test('statement reasons: binding inputs, RAW/WAR/WAW conflicts, barriers, comments and globals',()=>{
 const local=generate(['function f() {','  let a = 1;','  let b = 2;','  a = b;','  b = 3;','  a = 4;','  let c = a;','  g(c);','}']);
 assert.deepEqual(reasons(local,3,4),['data/binding-input','data/read-after-write'],'the declaration writes b, the assignment reads it');
 assert.deepEqual(reasons(local,4,5),['data/write-after-read']);
 assert.deepEqual(reasons(local,4,6),['data/write-after-write']);
 assert.ok(reasons(local,6,7).includes('data/read-after-write'));
 assert.ok(reasons(local,7,8).includes('effect/ExpressionStatement'));
 assert.deepEqual(reasons(local,8,9),['structure/block-close']);
 // v12 (ADR-025): a one-row comment is free; the rows of a multi-row comment stay ordered.
 const script=generate(['var a = 1;','// note','function g() {','  return a;','}']);
 assert.deepEqual(reasons(script,1,2),[]);
 assert.deepEqual(reasons(script,2,3),[]);
 assert.deepEqual(reasons(script,3,4),['structure/block-open']);
 const block=generate(['var a = 1;','/*','  note','*/','function g() {','  return a;','}']);
 assert.deepEqual(reasons(block,1,2),['conservative/opaque-row']);
 assert.deepEqual(reasons(block,4,5),['conservative/opaque-row']);
 assert.ok(reasons(block,1,5).length===0,'implied by the comment chain, removed by reduction');
 const globals=generate(['var a = 1;','function g() {','  return a;','}']);
 assert.deepEqual(reasons(globals,1,2),[],'v11: a function key is not observed');
 const listing=generate(['var a = 1;','function g() {','  return globalThis.a;','}']);
 assert.deepEqual(reasons(listing,1,2),['policy/script-global-order'],'the program reads the global object');
});

test('projection reasons: clause chains, continued rows and sealed units',()=>{
 const chain=generate(['function f(n) {','  let x;','  if (n) {','    x = 1;','  } else {','    x = 2;','  }','  return x;','}']);
 assert.deepEqual(reasons(chain,4,5),['structure/clause-segment']);
 assert.deepEqual(reasons(chain,3,5),['structure/clause-boundary'],'the segment row follows the declaration, not the opener');
 assert.deepEqual(reasons(chain,5,6),['structure/clause-separator']);
 const continued=generate(['function f() {','  const a = g(','    1);','  return a;','}']);
 assert.deepEqual(reasons(continued,2,3),['unit/continued-row']);
 const result=explained(chain),separator=result.lines.find(line=>line.id===5);
 assert.deepEqual(separator.predecessors.map(constraint=>[constraint.before,constraint.origins.join('+'),constraint.editability]),[[3,'dependency+block','hard'],[4,'dependency','hard']]);
});

test('class members: definitions, evaluation phases, reflected key order and erased runs',()=>{
 const model=generate(['class A {','  x = 1;','  y = 2;','  static s = 3;','  m() {}','  n() {}','}']);
 assert.deepEqual(reasons(model,2,3),['effect/class-evaluation-order']);
 assert.deepEqual(reasons(model,1,4),['structure/block-open'],'a static field shares no phase with instance fields');
 assert.deepEqual(reasons(model,1,5),['structure/block-open']);
 assert.deepEqual(reasons(model,5,6),[],'v11: the methods commute');
 const listing=generate(['class A {','  x = 1;','  y = 2;','  static s = 3;','  m() { return Reflect.ownKeys(A.prototype); }','  n() {}','}']);
 assert.deepEqual(reasons(listing,5,6),['policy/reflected-key-order'],'the program lists the prototype keys');
 const shape=generate(['interface I {','  a: number;','  b: string;','  m(): void;','}'],'typescript');
 assert.deepEqual(reasons(shape,3,4),['conservative/type-member-barrier']);
});

test('CopyFieldUtilityService: the edges of the acceptance rows carry their real reasons',async()=>{
 const model=generate(await readFile(new URL('./fixtures/copy-field-utility.service.ts',import.meta.url),'utf8'),'typescript');
 const at=row=>bySource(model,row),incoming=row=>model.authoring.provenance.filter(entry=>entry.after===at(row)).map(entry=>entry.category+'/'+entry.code);
 assert.deepEqual(incoming(6),['effect/module-import']);
 assert.deepEqual(incoming(248),['data/binding-input']);
 assert.deepEqual(incoming(249),['data/binding-input']);
 assert.deepEqual(incoming(306),['effect/ExpressionStatement']);
 assert.deepEqual(new Set(incoming(250)),new Set(['structure/clause-boundary','structure/clause-segment']));
 const result=explained(model),line=result.lines.find(item=>item.id===at(249));
 assert.ok(!line.ancestors.includes(at(248))&&!line.descendants.includes(at(248)),'248 and 249 are unordered');
 assert.ok(result.lines.find(item=>item.id===at(306)).ancestors.includes(at(305)));
});

test('legacy and imported models without provenance are explained as legacy, block membership stays hard',async()=>{
 const legacy=JSON.parse(await readFile(new URL('./fixtures/evaluate-legacy-serial.model.json',import.meta.url),'utf8'));
 assert.equal(legacy.authoring?.provenance,undefined);
 const result=explained(legacy);
 assert.equal(result.provenance,'absent');
 assert.equal(result.unexplained,legacy.lines.reduce((sum,line)=>sum+line.dependencies.length,0)+(legacy.edges?.length??0));
 for(const line of result.lines)for(const constraint of line.predecessors){
  const blockOnly=!constraint.origins.includes('dependency')&&!constraint.origins.includes('edge');
  assert.equal(constraint.editability,blockOnly||constraint.reasons.some(reason=>reason.category==='structure')?'hard':'legacy');
 }
});

test('editability follows the strongest reason; partial and stale provenance are reported, not trusted',()=>{
 const model=generate(['function f() {','  const a = 1;','  g(a);','}']);
 model.authoring.provenance=[
  {before:2,after:3,category:'author',code:'manual'},{before:2,after:3,category:'conservative',code:'kept'},
  {before:1,after:4,category:'data',code:'binding-input'}];
 const result=explained(model);
 const constraint=result.lines.find(line=>line.id===3).predecessors.find(item=>item.before===2);
 assert.equal(constraint.editability,'conservative');
 assert.equal(result.provenance,'partial');
 assert.equal(result.stale,1);
 assert.equal(result.unexplained,model.lines.reduce((sum,line)=>sum+line.dependencies.length,0)-1);
 const broken=structuredClone(model);broken.lines[2].dependencies=[4];broken.lines[3].dependencies=[3];
 assert.equal(explainConstraints(broken).status,'invalid_reference','an inadmissible model is never explained');
});

test('metamorphic: dropping or rewriting provenance changes neither admission nor any verdict',()=>{
 const model=generate(['function f(n) {','  let x = 0;','  let y = 1;','  if (n) {','    x = y;','  } else {','    y = 2;','  }','  return x + y;','}']);
 const variants=[model,{...model,authoring:{...model.authoring,provenance:undefined}},{...model,authoring:{...model.authoring,provenance:model.authoring.provenance.map(entry=>({...entry,category:'author',code:'rewritten'}))}}];
 const compiled=variants.map(variant=>compileCodeLineExercise(variant));
 for(const result of compiled)assert.ok(!result.status,result.message);
 assert.deepEqual(compiled[1].compiled,compiled[0].compiled);
 assert.deepEqual(compiled[2].compiled,compiled[0].compiled);
 const byId=new Map(model.lines.map(line=>[line.id,line.code]));
 for(const order of neighbourhood(model.lines.map(line=>line.id))){
  const verdicts=compiled.map(result=>validateSubmission(result.compiled,{exerciseId:model.id,revision:model.revision,lines:order.map(id=>byId.get(id))}).status);
  assert.equal(new Set(verdicts).size,1,String(order));
 }
});

test('schema: an unknown category, a malformed code or a non-integer line is rejected at admission',()=>{
 const model=generate(['const a = 1;','const b = 2;']);
 for(const entry of [{before:1,after:2,category:'proof',code:'x'},{before:1,after:2,category:'data',code:'has space'},{before:1.5,after:2,category:'data',code:'x'},{before:1,after:2,category:'data'}]){
  const result=compileCodeLineExercise({...model,authoring:{...model.authoring,provenance:[entry]}});
  assert.equal(result.status,'invalid_reference',JSON.stringify(entry));
 }
});

test('refresh maps regenerated provenance onto the original line IDs and drops stale reasons',async()=>{
 const base=generate(['function f() {','  const a = 1;','  const b = 2;','  return a + b;','}']);
 const offset=id=>id*10;
 const original={...structuredClone(base),lines:base.lines.map(line=>({...line,id:offset(line.id),dependencies:line.dependencies.map(offset)})),blocks:base.blocks.map(block=>({...block,openLineId:offset(block.openLineId),closeLineId:offset(block.closeLineId)})),authoring:{...base.authoring,provenance:[{before:10,after:20,category:'author',code:'stale'}]}};
 assert.ok(!compileCodeLineExercise(original).status);
 const refreshed=await refreshLegacyDependencies(original,{generate:input=>generateCodeLineExercise(input,ts),audit:model=>auditReference(model,ts)});
 assert.deepEqual(refreshed.authoring.provenance,base.authoring.provenance.map(entry=>({...entry,before:offset(entry.before),after:offset(entry.after)})));
 assert.equal(explained(refreshed).provenance,'complete');
});
