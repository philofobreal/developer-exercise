/** Fixed author fixtures only; learner evaluation never transpiles or runs code. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script,createContext} from 'node:vm';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {auditReference} from '../src/author/audit.mjs';
import {compileCodeLineExercise,validateSubmission,upgradeCodeLineExerciseV2,compileCodeLineExerciseV3} from '../dist/index.js';
import {refreshLegacyDependencies} from '../dist/author/engine.js';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const directory=new URL('../public/samples/typescript/',import.meta.url);
const examples=JSON.parse(await readFile(new URL('suite.json',directory),'utf8'));
const permutations=items=>items.length<2?[items]:items.flatMap((value,i)=>permutations(items.filter((_,j)=>i!==j)).map(rest=>[value,...rest]));
const codes=(model,order)=>order.map(id=>model.lines.find(line=>line.id===id).code);
const swap=(order,a,b)=>order.map(id=>id===a?b:id===b?a:id);
function compile(model){const result=compileCodeLineExercise(model);assert.ok(!result.status,result.message);return result.compiled;}
function grade(compiled,lines){return validateSubmission(compiled,{exerciseId:compiled.definition.id,revision:compiled.definition.revision,lines},{maxStates:200_000});}
function run(source,probe,define){
 const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,useDefineForClassFields:define}});
 return new Script(result.outputText+'\n'+probe+';', {filename:'fixed-ts-fixture.js'}).runInContext(createContext({}),{timeout:1000});
}
for(const example of examples)test('public TS matrix: '+example.id,async()=>{
 const source=await readFile(new URL(example.id+'.ts',directory),'utf8'),model=JSON.parse(await readFile(new URL(example.id+'.model.json',directory),'utf8'));
 auditReference(model,ts);const compiled=compile(model),order=model.lines.map(line=>line.id);
 assert.equal(grade(compiled,codes(model,order)).status,'accepted');
 for(const pair of example.acceptedSwaps)assert.equal(grade(compiled,codes(model,swap(order,...pair))).status,'accepted',JSON.stringify({example:example.id,pair}));
 for(const pair of example.rejectedSwaps)assert.equal(grade(compiled,codes(model,swap(order,...pair))).status,'rejected',JSON.stringify({example:example.id,pair}));
 for(const permuted of permutations(example.permutableIds)){
  const arranged=order.map(id=>example.permutableIds.includes(id)?permuted[example.permutableIds.indexOf(id)]:id);
  assert.equal(grade(compiled,codes(model,arranged)).status,'accepted');
 }
 const upgraded=upgradeCodeLineExerciseV2(model,source);assert.ok(!upgraded.status,upgraded.message);const v3=compileCodeLineExerciseV3(upgraded);assert.ok(!v3.status,v3.message);
 for(const pair of [...example.acceptedSwaps,...example.rejectedSwaps]){
  const lines=codes(model,swap(order,...pair));assert.equal(grade(v3.compiled,lines).status,grade(compiled,lines).status);
 }
 if(example.probe){
  for(const define of [false,true]){
   const baseline=run(source,example.probe,define);
   for(const pair of example.acceptedSwaps)assert.equal(run(codes(model,swap(order,...pair)).join('\n'),example.probe,define),baseline);
  }
 }
});

test('exact screenshot is syntactically valid but has a different observable property order',async()=>{
 const source=await readFile(new URL('01-user-account.ts',directory),'utf8');
 const model=generateCodeLineExercise({source,language:'typescript'},ts),compiled=compile(model);
 const order=[1,2,3,4,5,7,6,8,10,9,11,12,13],changed=codes(model,order);
 assert.equal(grade(compiled,changed).status,'rejected');
 assert.equal(model.authoring.dependencyPolicy,'scoped-effect-analysis-v4');
 assert.deepEqual(model.lines[1].dependencies,[1]);assert.deepEqual(model.lines[2].dependencies,[1]);assert.deepEqual(model.lines[3].dependencies,[2,3]);
 assert.ok(model.lines.every(line=>line.fixed===false));
 for(const define of [false,true]){
  const before=JSON.parse(run(source,examples[0].probe,define)),after=JSON.parse(run(changed.join('\n'),examples[0].probe,define));
  assert.equal(after.name,before.name);assert.equal(after.id,before.id);
  assert.deepEqual(before.keys,['name','id']);assert.deepEqual(after.keys,['id','name']);
 }
 // Content bijection ignores indentation on these rows and cannot distinguish
 // identical closing braces by client IDs. The oracle uses that same text contract.
 const key=lines=>JSON.stringify(lines.map(line=>line.replace(/^[ \t]+/,'')));
 const original=model.lines.map(line=>line.code),allowed=new Set([key(original),key(codes(model,swap(model.lines.map(line=>line.id),2,3)))]);
 for(let from=0;from<original.length;from++)for(let to=0;to<original.length;to++){
  const lines=[...original];lines.splice(to,0,lines.splice(from,1)[0]);
  assert.equal(grade(compiled,lines).accepted,allowed.has(key(lines)),JSON.stringify({from,to}));
 }
});

test('public references type-check; the explicitly labeled negative fixture reports TS2300',()=>{
 const paths=examples.map(example=>fileURLToPath(new URL(example.id+'.ts',directory)));
 const program=ts.createProgram(paths,{strict:true,noEmit:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleDetection:ts.ModuleDetectionKind.Force});
 const diagnostics=ts.getPreEmitDiagnostics(program);
 for(const [index,example] of examples.entries())assert.deepEqual([...new Set(diagnostics.filter(diagnostic=>diagnostic.file&&resolve(diagnostic.file.fileName)===paths[index]).map(diagnostic=>diagnostic.code))].sort(),example.semanticErrors??[],example.id);
 assert.ok(diagnostics.every(diagnostic=>diagnostic.file&&paths.includes(resolve(diagnostic.file.fileName))));
});

test('old serial import stays unchanged; explicit refresh unlocks only erased members',async()=>{
 const model=JSON.parse(await readFile(new URL('01-user-account.legacy.json',directory),'utf8'));
 const before=structuredClone(model),catalog=await ExerciseCatalog.open(fileURLToPath(new URL('../examples/',import.meta.url)));
 const first=await catalog.createDraft({model});assert.deepEqual(first.model.lines,model.lines);
 const swapped=codes(model,swap(model.lines.map(line=>line.id),2,3));assert.equal(catalog.preview({draftId:first.draftId,lines:swapped}).status,'rejected');
 const next=await refreshLegacyDependencies(model,{generate:input=>generateCodeLineExercise(input,ts),audit:model=>auditReference(model,ts)});
 assert.deepEqual(model,before);assert.equal(grade(compile(next),swapped).status,'accepted');
 assert.deepEqual(next.blocks,model.blocks);assert.equal(next.title,model.title);assert.ok(next.lines.every(line=>line.fixed===false));
});

test('whole independent member lists have exactly the expected full physical permutation language',()=>{
 for(const input of ['interface Small {\n a: number;\n b: string;\n c?: boolean;\n}', 'type Small = {\n a: number;\n b: string;\n c?: boolean;\n};','class Small {\n declare a: number;\n declare b: string;\n declare c: boolean;\n}']){
  const model=generateCodeLineExercise({source:input,language:'typescript'},ts),compiled=compile(model);let count=0;
  for(const order of permutations([1,2,3,4,5])){
   const expected=order[0]===1&&order.at(-1)===5,actual=grade(compiled,codes(model,order));assert.equal(actual.accepted,expected,JSON.stringify(order));if(actual.accepted)count++;
  }
  assert.equal(count,6);
 }
});

for(const [name,source,yes,no] of [
 ['trailing comment','interface X {\n a: number; // attached\n b: number;\n c: number;\n}',[[3,4]],[[2,3]]],
 ['multiline member','interface X {\n a:\n string;\n b: number;\n c: number;\n}',[[4,5]],[[2,4]]],
 ['shared row','interface X {\n a: number; b: number;\n c: number; d: number;\n}',[],[[2,3]]],
 ['numeric key barrier','interface X {\n 0: number;\n a: number;\n b: number;\n}',[[3,4]],[[2,3]]],
 ['computed method barrier','interface X {\n [Symbol.iterator](): Iterator<number>;\n a: number;\n b: number;\n}',[[3,4]],[[2,3]]],
 ['same decoded name','interface X {\n a: number;\n "a": number;\n b: number;\n}',[],[[2,4],[3,4]]],
 ['static declare stays conservative','class X {\n declare static a: number;\n declare static b: number;\n}',[],[[2,3]]],
 ['abstract fields stay conservative','abstract class X {\n abstract a: number;\n abstract b: number;\n}',[],[[2,3]]],
 ['decorated member stays attached','function tag(...args: unknown[]): void {}\nclass X {\n @tag\n declare a: number;\n declare b: number;\n declare c: number;\n}',[[5,6]],[[3,5],[4,5]]],
 ['readonly declare','class X {\n declare readonly a: number;\n declare readonly b: number;\n}',[[2,3]],[]],
 ['auto accessors','class X {\n accessor a = 1;\n accessor b = 2;\n}',[],[[2,3]]]
])test('mixed TS member edge: '+name,()=>{
 const model=generateCodeLineExercise({source,language:'typescript'},ts),compiled=compile(model),order=model.lines.map(line=>line.id);
 assert.equal(grade(compiled,codes(model,order)).status,'accepted');
 for(const pair of yes)assert.equal(grade(compiled,codes(model,swap(order,...pair))).status,'accepted');
 for(const pair of no)assert.equal(grade(compiled,codes(model,swap(order,...pair))).status,'rejected');
});

test('500-row member model keeps the compiler boundary and accepts a reverse member run',()=>{
 const source=['interface Large {',...Array.from({length:498},(_,i)=>` p${i}: number;`),'}'].join('\n');
 const model=generateCodeLineExercise({source,language:'typescript'},ts);assert.equal(model.lines.length,500);
 const order=[1,...Array.from({length:498},(_,i)=>i+2).reverse(),500];assert.equal(grade(compile(model),codes(model,order)).status,'accepted');
 assert.throws(()=>generateCodeLineExercise({source:source.replace('}', ' pExtra: number;\n}'),language:'typescript'},ts),/500/);
});

test('all eight interface/class/constructor combinations agree with both compiler modes',async()=>{
 const source=await readFile(new URL('01-user-account.ts',directory),'utf8'),model=generateCodeLineExercise({source,language:'typescript'},ts),compiled=compile(model);
 const authored=compile(JSON.parse(await readFile(new URL('01-user-account.values-only.model.json',directory),'utf8')));
 const reference=model.lines.map(line=>line.id),baselines=[false,true].map(define=>run(source,examples[0].probe,define));let accepted=0;
 for(const types of [false,true])for(const fields of [false,true])for(const writes of [false,true]){
  let order=reference;if(types)order=swap(order,2,3);if(fields)order=swap(order,6,7);if(writes)order=swap(order,9,10);
  const lines=codes(model,order),actuals=[false,true].map(define=>run(lines.join('\n'),examples[0].probe,define)),equivalent=actuals.every((value,index)=>value===baselines[index]);
  assert.equal(grade(compiled,lines).accepted,equivalent,JSON.stringify({types,fields,writes}));if(equivalent)accepted++;
  assert.equal(grade(authored,lines).status,'accepted');
  for(const value of actuals){const result=JSON.parse(value);assert.equal(result.name,'Murphy');assert.equal(result.id,1);}
 }
 assert.equal(accepted,2);
});

test('mixed type-member DAG keeps fixed slots, common edges, OR profiles, text bijection and budget',()=>{
 const model=generateCodeLineExercise({source:'interface Mixed {\n a: number;\n b: number;\n c: number;\n}',language:'typescript'},ts);
 model.lines[2].fixed=true;for(const line of model.lines)line.sourceLine=999;
 model.profiles=[{id:'a-first',edges:[{before:2,after:4}]},{id:'c-first',edges:[{before:4,after:2}]}];
 const compiled=compile(model),reversed=codes(model,[1,4,3,2,5]);
 assert.equal(grade(compiled,reversed).status,'accepted');
 assert.equal(grade(compiled,codes(model,[1,3,2,4,5])).status,'rejected');
 assert.equal(grade(compiled,codes(model,[1,4,3,4,5])).status,'rejected');
 assert.equal(grade(compiled,reversed.map(line=>'\t'+line.trimStart())).status,'accepted');
 assert.equal(grade(compiled,reversed.map(line=>'\u00a0'+line.trimStart())).status,'rejected');
 model.edges=[{before:2,after:3}];assert.equal(grade(compile(model),reversed).status,'rejected');
 model.edges=[{before:2,after:4}];assert.equal(compileCodeLineExercise(model).status,'invalid_reference'); // one OR branch is cyclic
 assert.equal(validateSubmission(compiled,{exerciseId:model.id,revision:model.revision,lines:reversed},{maxStates:1}).status,'indeterminate');
});
