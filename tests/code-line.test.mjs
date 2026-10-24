import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
const read=async id=>JSON.parse(await readFile(new URL(`../examples/${id}.json`,import.meta.url)));
const lines=ref=>ref.lines.map(l=>l.code);
const evalRef=(ref,submitted)=>{const a=compileCodeLineExercise(ref);assert.ok(!('status' in a),a.message);return validateSubmission(a.compiled,{exerciseId:ref.id,revision:ref.revision,lines:submitted});};
const expectStatus=(r,s)=>assert.equal(r.status,s,JSON.stringify(r));
test('all four v2 reference models compile and accept the original sequence',async()=>{
 for(const id of ['sum-js','sum-ts','dependencies-js','profiles-js']){const ref=await read(id);expectStatus(evalRef(ref,lines(ref)),'accepted');}
});
test('two equal closing braces swapped by identity produce same submitted source',async()=>{
 const ref=await read('sum-js');const original=lines(ref);const swapped=[...original];[swapped[4],swapped[6]]=[swapped[6],swapped[4]];assert.deepEqual(swapped,original);expectStatus(evalRef(ref,swapped),'accepted');
});
test('an actual brace / return misplacement is rejected',async()=>{
 const ref=await read('sum-js');const reordered=lines(ref);[reordered[4],reordered[5]]=[reordered[5],reordered[4]];expectStatus(evalRef(ref,reordered),'rejected');
});
test('declarations a,b are freely reorderable',async()=>{
 const ref=await read('dependencies-js');const x=lines(ref);[x[1],x[2]]=[x[2],x[1]];expectStatus(evalRef(ref,x),'accepted');
});
test('const c cannot be before both its dependencies',async()=>{
 const ref=await read('dependencies-js');const x=lines(ref);[x[1],x[3]]=[x[3],x[1]];expectStatus(evalRef(ref,x),'rejected');
});
test('unrelated note can occur before a/b',async()=>{
 const ref=await read('dependencies-js');const x=lines(ref);const [note]=x.splice(4,1);x.splice(1,0,note);expectStatus(evalRef(ref,x),'accepted');
});
test('fixed fn opener cannot be moved to another position',async()=>{
 const ref=await read('dependencies-js');const x=lines(ref);[x[0],x[1]]=[x[1],x[0]];expectStatus(evalRef(ref,x),'rejected');
});
test('fixed fn closer cannot be moved to another position',async()=>{
 const ref=await read('dependencies-js');const x=lines(ref);[x[5],x[6]]=[x[6],x[5]];expectStatus(evalRef(ref,x),'rejected');
});
test('profiles permit forward and reverse, but not mixed',async()=>{
 const ref=await read('profiles-js');const a=lines(ref),rev=[...a];[rev[1],rev[3]]=[rev[3],rev[1]];expectStatus(evalRef(ref,rev),'accepted');const mixed=[...a];[mixed[1],mixed[2]]=[mixed[2],mixed[1]];expectStatus(evalRef(ref,mixed),'rejected');
});
test('wrong functionBlock metadata is not accepted as a trusted reference',async()=>{
 const ref=await read('sum-js');ref.lines[3].functionBlock=0;const result=compileCodeLineExercise(ref);assert.equal(result.status,'invalid_reference');
});
test('dependency cycle is authoring error',async()=>{
 const ref=await read('dependencies-js');ref.lines[1].dependencies.push(4);const result=compileCodeLineExercise(ref);assert.equal(result.status,'invalid_reference');
});
test('duplicate id is invalid',async()=>{
 const ref=await read('sum-js');ref.lines[2].id=ref.lines[1].id;const result=compileCodeLineExercise(ref);assert.equal(result.status,'invalid_reference');
});
test('whitespace-leading indent ignored; line body changes rejected',async()=>{
 const ref=await read('dependencies-js');const x=lines(ref);x[2]='             '+x[2];expectStatus(evalRef(ref,x),'accepted');x[2]=x[2].replace('20','21');expectStatus(evalRef(ref,x),'rejected');
});
test('invalid unknown extra or missing lines are rejected',async()=>{
 const ref=await read('sum-js');expectStatus(evalRef(ref,lines(ref).slice(1)),'rejected');expectStatus(evalRef(ref,[...lines(ref),'{}']),'rejected');
});


test('v2 dependencies require every predecessor earlier, with arbitrary gaps and array order',()=>{
 const ref={schemaVersion:2,id:'dependency-distance',revision:1,language:'javascript',title:'Dependency distances',description:'',blocks:[],lines:[
  {id:10,code:'const a = 1;',dependencies:[]},
  {id:20,code:'const b = 2;',dependencies:[]},
  {id:30,code:'const x = 3;',dependencies:[]},
  {id:40,code:'const y = 4;',dependencies:[]},
  {id:50,code:'const c = a + b;',dependencies:[10,20]}
 ].map(line=>({...line,fixed:false,functionBlock:0,scopeId:null}))};
 const permutations=items=>items.length<=1?[items]:items.flatMap((item,i)=>permutations(items.filter((_,j)=>i!==j)).map(rest=>[item,...rest]));
 const orders=permutations(ref.lines);
 for(const dependencies of [[10,20],[20,10]]){
  ref.lines.at(-1).dependencies=dependencies;
  let accepted=0;
  for(const order of orders){
   const position=id=>order.findIndex(line=>line.id===id);
   const valid=position(10)<position(50)&&position(20)<position(50);
   expectStatus(evalRef(ref,order.map(line=>line.code)),valid?'accepted':'rejected');
   if(valid)accepted++;
  }
  assert.equal(orders.length,120);
  assert.equal(accepted,40);
 }
});


test('fixed means absolute position only: all 120 permutations agree with an independent position oracle',()=>{
 const ref={schemaVersion:2,id:'fixed-only',revision:1,language:'javascript',title:'Fixed slots',description:'',blocks:[],lines:[1,2,3,4,5].map(id=>({id,code:`const v${id} = ${id};`,dependencies:[],fixed:id===3,functionBlock:0,scopeId:null}))};
 const compiled=compileCodeLineExercise(ref);assert.ok(!compiled.status,compiled.message);
 const permutations=items=>items.length<=1?[items]:items.flatMap((item,i)=>permutations(items.filter((_,j)=>i!==j)).map(rest=>[item,...rest]));
 let accepted=0;
 for(const order of permutations(ref.lines)){
  const expected=order[2].id===3;const report=validateSubmission(compiled.compiled,{exerciseId:ref.id,revision:1,lines:order.map(line=>line.code)});
  expectStatus(report,expected?'accepted':'rejected');if(report.accepted)accepted++;
 }
 assert.equal(accepted,24);
});
