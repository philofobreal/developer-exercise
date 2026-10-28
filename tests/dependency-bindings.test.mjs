import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {auditReference} from '../src/author/audit.mjs';
import {renderDependencyTable,renderWitness} from '../public/app/dependency-view.js';
import {createOracle} from './support/semantic-oracle.mjs';
const generate=(source,language='javascript')=>generateCodeLineExercise({source,language},ts);
function check(model,order){const c=compileCodeLineExercise(model);assert.ok(!c.status,c.message);return validateSubmission(c.compiled,{exerciseId:model.id,revision:model.revision,lines:order.map(id=>model.lines.find(x=>x.id===id).code)});}
const source='function calculate() {\n const a = 10;\n const b = 20;\n const c = a + b;\n const other = 99;\n return c + other;\n}';
for(const language of ['javascript','typescript']){
 test(language+': generated declarations form a binding DAG and allow gaps after both predecessors',()=>{
  const m=generate(source,language);assert.deepEqual(m.lines[3].dependencies,[2,3]);assert.deepEqual(m.lines[4].dependencies,[1]);
  for(const order of [[1,2,5,3,4,6,7],[1,3,2,5,4,6,7],[1,5,3,2,4,6,7]]){
   const report=check(m,order);assert.equal(report.status,'accepted');assert.deepEqual(report.matchedTokenIds,order.map(id=>'n:'+id));
  }
  for(const order of [[1,2,4,3,5,6,7],[1,3,4,2,5,6,7]])assert.equal(check(m,order).status,'rejected');
 });
 test(language+': source line numbers are metadata, IDs survive renumbering and repeated source locations',()=>{
  const m=generate('\nfunction f() {\n\n const a = 1;\n const b = 2;\n const c = a + b;\n return c;\n}',language);
  assert.deepEqual(m.lines.map(x=>x.sourceLine),[2,4,5,6,7,8]);
  const ids=new Map(m.lines.map(x=>[x.id,100+x.id*7]));
  for(const line of m.lines){line.id=ids.get(line.id);line.dependencies=line.dependencies.map(x=>ids.get(x));line.sourceLine=999;}
  for(const block of m.blocks){block.openLineId=ids.get(block.openLineId);block.closeLineId=ids.get(block.closeLineId);}
  const order=[1,3,2,4,5,6].map(x=>ids.get(x));const report=check(m,order);assert.equal(report.status,'accepted');assert.deepEqual(report.matchedTokenIds,order.map(x=>'n:'+x));
 });
 test(language+': primitive islands cannot cross calls or move independent rows across a barrier',()=>{
  const m=generate('const a = 1;\nconst b = 2;\nconsume(a, b);\nconst x = 3;\nconst y = 4;\nconsume(x, y);',language);
  assert.equal(check(m,[2,1,3,5,4,6]).status,'accepted');
  for(const order of [[1,3,2,4,5,6],[1,2,4,3,5,6],[1,2,3,4,6,5]])assert.equal(check(m,order).status,'rejected');
 });
 test(language+': shadowed names are resolved to their own declaration',()=>{
  const m=generate('function f() {\n const a = 1;\n const b = 2;\n if (ready) {\n const a = 3;\n const b = 4;\n const c = a + b;\n use(c);\n }\n return a + b;\n}',language);
  assert.deepEqual(m.lines[6].dependencies,[5,6]);
  assert.equal(check(m,[1,3,2,4,6,5,7,8,9,10,11]).status,'accepted');
  assert.equal(check(m,[1,3,2,4,5,7,6,8,9,10,11]).status,'rejected');
 });
 test(language+': whole declaration island permutations agree with an independent dependency oracle',()=>{
  const m=generate(source,language),permute=a=>a.length<=1?[a]:a.flatMap((v,i)=>permute(a.filter((_,j)=>i!==j)).map(rest=>[v,...rest]));
  for(const order of permute([2,3,4,5]))assert.equal(check(m,[1,...order,6,7]).status,order.indexOf(2)<order.indexOf(4)&&order.indexOf(3)<order.indexOf(4)?'accepted':'rejected');
 });
}
for(const statement of ['const c = call();','const c = obj.value;','const c = ++a;','const c = new Thing();','const { c } = obj;','const c = unknown;','const c = a = 3;','const c = a[0];','const c = `value ${a}`;','const c = 1n;','const c = [...b];','const c = { [b]: 1 };','const c = { __proto__: null };','const c = a + 1;','let c = a * 2;','const c = { ...b };','class C extends a {}'])test('unsupported or effectful declaration remains a barrier: '+statement,()=>{
 const m=generate('let a = 1;\nconst b = 2;\n'+statement+'\nconst x = 3;\nconst y = 4;');
 assert.equal(check(m,[1,2,4,3,5]).status,'rejected');assert.equal(check(m,[1,2,3,5,4]).status,'accepted');
});
// ADR-008: allocations of fresh literals and binding reads cannot run user code
// or throw once their inputs exist. The swap is accepted AND an independent
// runtime/effect oracle confirms the arrangement (fixed fixture only).
// beforeB: c placed between a and b; first: c placed before a (TDZ unless the read is deferred).
for(const [statement,beforeB,first] of [['const c = [a];','accepted','rejected'],['const c = { a };','accepted','rejected'],['var c = 3;','accepted','accepted'],['let c = a;','accepted','rejected'],['const c = () => a;','accepted','accepted'],['const c = a !== b && typeof a === "number";','rejected','rejected']])test('effect-free declaration commutes with its independent neighbour: '+statement,()=>{
 const fixture={id:statement,language:'javascript',source:['let a = 1;','const b = 2;',statement,'const x = 3;','const y = 4;'],probe:'[a, b, typeof c === "function" ? c() : c, x, y]'};
 const m=generate(fixture.source.join(String.fromCharCode(10))),judge=createOracle(fixture);
 for(const [order,status] of [[[1,2,4,3,5],'accepted'],[[1,3,2,4,5],beforeB],[[3,1,2,4,5],first]]){
  assert.equal(check(m,order).status,status,JSON.stringify(order));
  if(status==='accepted')assert.equal(judge(order.map(id=>fixture.source[id-1])).ok,true,JSON.stringify(order));
 }
});
test('multiline expressions, inline comments, forward bindings and external bindings stay conservative',()=>{
 // v12 (ADR-025): a one-row comment is free, a multi-row comment keeps its place.
 const free=generate('const a = 1;\n// comment\nconst b = 2;'),order=free.lines.map(x=>x.id);[order[0],order[1]]=[order[1],order[0]];assert.equal(check(free,order).status,'accepted');
 for(const input of ['const a = 1;\n/*\n comment\n*/\nconst b = 2;','const a = 1;\nconst b = (\n 2\n);','const b = a + 1;\nconst a = 1;','const a = outer;\nconst b = a + 1;','const a = 1; // trailing comment\nconst b = 2;']){
  const m=generate(input);const original=m.lines.map(x=>x.id);assert.equal(check(m,original).status,'accepted');[original[0],original[1]]=[original[1],original[0]];assert.equal(check(m,original).status,'rejected');
 }
});
test('500 independent declarations produce a bounded graph and a valid reverse-order witness',()=>{
 const m=generate(Array.from({length:500},(_,i)=>`const v${i} = ${i};`).join('\n'));assert.ok(m.lines.every(x=>x.dependencies.length===0));assert.equal(check(m,m.lines.map(x=>x.id).reverse()).status,'accepted');
});
test('witness comes from reference content, ignores client IDs, and preserves identical-line multiplicity',()=>{
 const m={schemaVersion:2,id:'duplicate-content',revision:1,language:'javascript',title:'',description:'',blocks:[],lines:[{id:10,code:'noop();',dependencies:[]},{id:20,code:'noop();',dependencies:[10]},{id:30,code:'done();',dependencies:[20]}].map(x=>({...x,fixed:false,functionBlock:0,scopeId:null}))};
 const c=compileCodeLineExercise(m);const report=validateSubmission(c.compiled,{exerciseId:m.id,revision:1,lines:['noop();','noop();','done();'],matchedTokenIds:['n:30','n:20','n:10']});assert.equal(report.status,'accepted');assert.deepEqual(report.matchedTokenIds,['n:10','n:20','n:30']);
 assert.equal(validateSubmission(c.compiled,{exerciseId:m.id,revision:1,lines:['noop();','done();','done();']}).status,'rejected');
});
test('author dependency table and accepted witness identify IDs, source lines and escaped code',()=>{
 const m=generate(source),report=check(m,[1,3,2,5,4,6,7]);const table=renderDependencyTable(m),witness=renderWitness(report,m,m);assert.match(table,/#2, #3/);assert.match(witness,/data-witness-position="5"/);assert.match(witness,/#4/);assert.match(witness,/#2, #3/);
 m.lines[1].code='<script>alert(1)</script>';assert.doesNotMatch(renderDependencyTable(m),/<script>/);assert.match(renderDependencyTable(m),/&lt;script&gt;/);assert.equal(renderWitness({status:'rejected'},m,m),'');
});
test('source metadata has no authority over syntax audit or ordering',()=>{
 const m=generate(source);m.lines[3].sourceLine=1;m.lines[3].code='const c = ;';assert.throws(()=>auditReference(m,ts),/Szintaktikai/);
 for(const sourceLine of [0,-1,1.5,'4',50001]){const model=generate(source);model.lines[0].sourceLine=sourceLine;assert.equal(compileCodeLineExercise(model).status,'invalid_reference');}
});

test('TypeScript await using disposal declarations are order barriers, never const islands',()=>{
 const m=generate('async function f() {\n const a = 1;\n await using resource = null;\n const b = 2;\n const c = 3;\n return b + c;\n}','typescript');
 assert.equal(check(m,[1,2,3,5,4,6,7]).status,'accepted');
 for(const order of [[1,3,2,4,5,6,7],[1,2,4,3,5,6,7]])assert.equal(check(m,order).status,'rejected');
});
