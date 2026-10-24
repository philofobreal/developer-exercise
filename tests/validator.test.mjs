import test from 'node:test';
import assert from 'node:assert/strict';
import {examples,validateSubmission,compileDefinition,isModelError} from '../dist/index.js';
const sum=examples[0],flex=examples[1],ts=examples[2];
const submission=(exercise, ids)=>({exerciseId:exercise.id,revision:exercise.revision,lines:ids.map(id=>exercise.tokens.find(t=>t.id===id)?.code??id)});
const check=(ex,ids,opts)=>validateSubmission(ex,submission(ex,ids),opts);
const ids=ex=>ex.tokens.map(t=>t.id);
const clone=v=>JSON.parse(JSON.stringify(v));

test('Models compile: block hierarchy, type annotations, DAG',()=>{
  for(const e of examples) assert.equal(isModelError(compileDefinition(e)),false,e.id);
});
test('Reference examples are all accepted',()=>{
  for(const e of examples)assert.equal(check(e,ids(e)).status,'accepted',e.id);
});
test('Same-content closing braces can swap identities without false rejection',()=>{
  const out=ids(sum),i=out.indexOf('loop-close'),j=out.indexOf('fn-close');[out[i],out[j]]=[out[j],out[i]];
  // Identical original strings appear at unchanged positions; submission has NO token IDs.
  assert.deepEqual(submission(sum,out).lines,submission(sum,ids(sum)).lines);
  assert.equal(check(sum,out).status,'accepted');
});
test('A dependency requires both predecessors, not just one',()=>{
  const original=ids(flex),a=[original[0],original[1],original[3],original[2],original[4]];
  assert.equal(check(flex,a).status,'rejected');
});
test('Unrelated declarations may switch places',()=>{
  const original=ids(flex);[original[1],original[2]]=[original[2],original[1]];
  assert.equal(check(flex,original).status,'accepted');
});
test('Actual scope moves, e.g. return inside a loop, fail',()=>{
  const o=ids(sum),bad=['fn-open','sum-init','loop-open','accumulate','return','loop-close','fn-close'];
  assert.equal(check(sum,bad).status,'rejected');
});
test('Missing and extra lines are rejected',()=>{
 assert.equal(check(sum,ids(sum).slice(0,-1)).reason,'wrong_length');
 const o=ids(sum);o[3]='not-defined';assert.equal(check(sum,o).reason,'unknown_content');
});
test('Multiplicity of identical lines is enforced',()=>{
 const o=ids(sum);o[o.indexOf('return')]='loop-close';
 assert.equal(check(sum,o).reason,'wrong_multiplicity');
});
test('JS / TS code is never executed: malicious code is just invalid text',()=>{
 globalThis.__maliciousCodeDidRun=false;
 const o=ids(sum);o[1]='globalThis.__maliciousCodeDidRun = true;';
 assert.equal(check(sum,o).status,'rejected');
 assert.equal(globalThis.__maliciousCodeDidRun,false);
 delete globalThis.__maliciousCodeDidRun;
});
test('Indentation normalization and trailing whitespace protection',()=>{
 const s=submission(sum,ids(sum));s.lines=s.lines.map(x=>'        '+x);
 assert.equal(validateSubmission(sum,s).status,'accepted');
 s.lines[1]=s.lines[1]+'  ';
 assert.equal(validateSubmission(sum,s).status,'rejected');
});
test('Exact whitespace mode protects template text',()=>{
 const ex=clone(flex);ex.tokens[1].code='    World';ex.tokens[1].normalization='exact';
 const order=ids(ex);const s=submission(ex,order);assert.equal(validateSubmission(ex,s).status,'accepted');
 s.lines[1]=' World';assert.equal(validateSubmission(ex,s).reason,'unknown_content');
});
test('Circular dependencies invalid at publish time',()=>{
 const ex=clone(flex);ex.tokens.find(x=>x.id==='name').after=['return'];
 const compiled=compileDefinition(ex);assert.equal(compiled.status,'invalid_reference');
});
test('Invalid block scopes and block cycles rejected',()=>{
 const ex=clone(sum);ex.tokens[4].scope='loop';
 assert.equal(compileDefinition(ex).status,'invalid_reference');
 const ex2=clone(ts);ex2.blocks[1].parent='inner';
 assert.equal(compileDefinition(ex2).status,'invalid_reference');
});
test('Alternative edge profiles: OR across profiles',()=>{
 const ex={schemaVersion:1,id:'alts',revision:1,language:'javascript',title:'alts',description:'',
  tokens:[{id:'a',code:'A;',scope:null},{id:'b',code:'B;',scope:null},{id:'c',code:'C;',scope:null}],blocks:[],
  profiles:[{id:'forward',edges:[{before:'a',after:'b'},{before:'b',after:'c'}]},{id:'backward',edges:[{before:'c',after:'b'},{before:'b',after:'a'}]}]
 };
 assert.equal(check(ex,['a','b','c']).status,'accepted');
 assert.equal(check(ex,['c','b','a']).status,'accepted');
 assert.equal(check(ex,['b','a','c']).status,'rejected');
});
test('Hard state budget returns indeterminate, NOT rejected',()=>{
 const ex=clone(sum);
 const r=check(ex,ids(ex),{maxStates:1});
 assert.equal(r.status,'indeterminate');
});
test('All equal-content lines have valid witness, despite many permutations',()=>{
 const ex={schemaVersion:1,id:'eq',revision:1,language:'javascript',title:'x',description:'',blocks:[],tokens:[
 {id:'x',code:'same',scope:null},{id:'y',code:'same',scope:null},{id:'z',code:'same',scope:null}]};
 assert.equal(check(ex,['z','x','y']).status,'accepted');
});
test('Two independent chains have all valid interleavings',()=>{
 const ex={schemaVersion:1,id:'chains',revision:1,language:'javascript',title:'x',description:'',blocks:[],tokens:[
 {id:'a',code:'A;',scope:null},{id:'c',code:'C;',scope:null,after:['a']},{id:'b',code:'B;',scope:null},{id:'d',code:'D;',scope:null,after:['b']}]};
 for(const order of [['a','b','c','d'],['b','a','d','c'],['a','c','b','d'],['b','d','a','c']])assert.equal(check(ex,order).status,'accepted');
 assert.equal(check(ex,['c','a','b','d']).status,'rejected');
});
test('A broken actual nesting cannot be legitimized by identical closing braces',()=>{
 const ex=clone(sum);
 const order=['fn-open','sum-init','loop-open','loop-close','accumulate','return','fn-close'];
 assert.equal(check(ex,order).status,'rejected');
});
test('Wrong exercise revision cannot validate against another model',()=>{
 const s=submission(sum,ids(sum));s.revision++;
 assert.equal(validateSubmission(sum,s).status,'rejected');
});

test('Exhaustive 4-token permutations agree with an independent bijection oracle',()=>{
 const code=['A;','B;','A;','C;'];
 const permute=a=>a.length<=1?[a]:a.flatMap((v,i)=>permute(a.filter((_,j)=>i!==j)).map(rest=>[v,...rest]));
 const all=permute([0,1,2,3]);
 let checked=0;
 for(let mask=0;mask<64;mask++){
  const edges=[];let bit=0;
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){if(mask&(1<<bit))edges.push({before:String(i),after:String(j)});bit++;}
  const ex={schemaVersion:1,id:'oracle',revision:1,language:'javascript',title:'x',description:'',blocks:[],
    tokens:code.map((s,i)=>({id:String(i),code:s,scope:null})),edges};
  for(const order of all){
   const words=order.map(i=>code[i]);
   const witness=all.some(p=>p.every((tok,pos)=>code[tok]===words[pos])&&edges.every(e=>p.indexOf(Number(e.before))<p.indexOf(Number(e.after))));
   const r=validateSubmission(ex,{exerciseId:ex.id,revision:1,lines:words},{maxStates:100000});
   assert.equal(r.status,witness?'accepted':'rejected',JSON.stringify({mask,order,words,r}));checked++;
  }
 }
 assert.equal(checked,1536);
});

test('Runtime reference validation rejects malformed before/after arrays and empty references',()=>{
 const ex=clone(sum);ex.tokens[0].after='test';assert.equal(compileDefinition(ex).status,'invalid_reference');
 const other=clone(sum);other.tokens=[];assert.equal(compileDefinition(other).status,'invalid_reference');
});
