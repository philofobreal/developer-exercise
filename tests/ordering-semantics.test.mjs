/** Differential execution is ONLY for these fixed, bounded test fixtures. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script,createContext} from 'node:vm';
import {parse} from 'acorn';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {createOracle} from './support/semantic-oracle.mjs';
import {compileCodeLineExercise,compileDefinition,validateSubmission} from '../dist/index.js';
const source=(await readFile(new URL('./fixtures/evaluate-ordering.js',import.meta.url),'utf8')).replace(/\r\n?/g,'\n');
const reference=JSON.parse(await readFile(new URL('./fixtures/evaluate-ordering.model.json',import.meta.url),'utf8'));
const permute=a=>a.length<=1?[a]:a.flatMap((v,i)=>permute(a.filter((_,j)=>j!==i)).map(rest=>[v,...rest]));
function compile(model){const result=compileCodeLineExercise(model);assert.ok(!result.status,result.message);return result.compiled;}
function grade(compiled,lines){return validateSubmission(compiled,{exerciseId:compiled.definition.id,revision:compiled.definition.revision,lines},{maxStates:200000});}
// Independent Acorn AST oracle: lexical ownership and syntax must be unchanged;
// statement-list order is precisely what the exercise allows us to vary.
function shape(value,key=''){
 if(Array.isArray(value)){const items=value.map(x=>shape(x));return key==='body'?items.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))):items;}
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([name])=>!['start','end','raw'].includes(name)).map(([name,item])=>[name,shape(item,name)]));
 return value;
}
function syntaxShape(code){return JSON.stringify(shape(parse(code,{ecmaVersion:'latest',sourceType:'script'})));}
// Additional author contract: opaque calls/control transfers keep their order
// relative to sibling statements, even when this one execution cannot
// distinguish the rearrangement, except where the P2 policy proves that the
// effect cannot observe the move (ADR-019). The policy oracle decides that,
// separately from the runtime check below.
function execute(code){const context=createContext({trace:[]});return new Script('"use strict";function record(...args) { trace.push(args); }\n'+code+'\nJSON.stringify({value:evaluate(),trace});').runInContext(context,{timeout:1000});}
function oracle(baseline,code){try{return syntaxShape(code)===syntaxShape(baseline)&&execute(code)===execute(baseline);}catch(error){if(error?.code==='ERR_SCRIPT_EXECUTION_TIMEOUT')throw error;return false;}}

test('screenshot: all 5040 physical permutations agree with lexical ownership and actual JS evaluation',()=>{
 const generated=generateCodeLineExercise({source,language:'javascript'},ts),models=[compile(reference),compile(generated)];let accepted=0;
 const original=source.trimEnd().split('\n');
 for(const order of permute([0,1,2,3,4,5,6])){
  const lines=order.map(i=>original[i]),expected=oracle(source,lines.join('\n'));
  for(const model of models)assert.equal(grade(model,lines).status,expected?'accepted':'rejected',JSON.stringify({order,lines,expected}));
  if(expected)accepted++;
 }
 assert.equal(accepted,8);
});

test('generated screenshot dependencies identify c inputs and return inputs without synthetic serial predecessors',()=>{
 const model=generateCodeLineExercise({source,language:'javascript'},ts);
 assert.deepEqual(model.lines[4].dependencies,[3,4]);assert.deepEqual(model.lines[5].dependencies,[2,5]);
});

const nested='function evaluate() {\n const a = 10;\n const b = 20;\n {\n const note = "ready";\n const c = a + b;\n record(c, note);\n }\n return a + b;\n}';
test('nested block: independently reorder outer and inner declarations while resolving ancestor bindings',()=>{
 const model=generateCodeLineExercise({source:nested,language:'javascript'},ts),compiled=compile(model),original=nested.split('\n');
 for(const outer of [[1,2],[2,1]])for(const inner of [[4,5],[5,4]]){
  const order=[0,...outer,3,...inner,6,7,8,9],lines=order.map(i=>original[i]);assert.equal(oracle(nested,lines.join('\n')),true);assert.equal(grade(compiled,lines).status,'accepted');
 }
});

const threeLevels='function evaluate() {\n const a = 10;\n const b = 20;\n {\n const note = "outer";\n const sum = a + b;\n {\n const x = sum + 1;\n const y = sum + 2;\n const z = x + y;\n const label = "inner";\n record(z, label);\n }\n record(sum, note);\n }\n return a + b;\n}';
test('three lexical levels: all inner-statement permutations agree with an independent runtime oracle',()=>{
 const model=generateCodeLineExercise({source:threeLevels,language:'javascript'},ts),compiled=compile(model),original=threeLevels.split('\n');let accepted=0;
 for(const middle of [[4,5],[5,4]])for(const inner of permute([7,8,9,10,11])){
  const order=[0,1,2,3,...middle,6,...inner,12,13,14,15,16],lines=order.map(i=>original[i]),expected=oracle(threeLevels,lines.join('\n'));
  assert.equal(grade(compiled,lines).status,expected?'accepted':'rejected',JSON.stringify({order,expected}));if(expected)accepted++;
 }
 assert.equal(accepted,16);
});

test('nested scope: every single-row relocation rejects scope escape, early return and altered effects',()=>{
 const model=generateCodeLineExercise({source:threeLevels,language:'javascript'},ts),compiled=compile(model),original=threeLevels.split('\n');let cases=0;
 const policy=createOracle({id:'three-levels',language:'javascript',probe:'evaluate()',source:threeLevels});
 for(let from=0;from<original.length;from++)for(let to=0;to<original.length;to++){
  const lines=[...original],row=lines.splice(from,1)[0];lines.splice(to,0,row);const expected=oracle(threeLevels,lines.join('\n'));
  const actual=grade(compiled,lines);if(actual.accepted)assert.equal(expected,true,'accepted code must preserve JS result/effects');
  const permitted=expected&&policy(lines).ok===true;assert.equal(actual.status,permitted?'accepted':'rejected',JSON.stringify({from,to,expected,permitted,actual}));cases++;
 }
 assert.equal(cases,289);
});


test('partial scope contradiction rejects sibling blocks nested into each other before exhausting duplicate-brace search',()=>{
 const tokens=[{id:'fn-open',code:'function f() {',scope:null}],blocks=[{id:'fn',open:'fn-open',close:'fn-close',parent:null}];
 for(let i=0;i<9;i++){tokens.push({id:'open-'+i,code:`if (flag${i}) {`,scope:'fn'},{id:'close-'+i,code:'}',scope:'fn'});blocks.push({id:'block-'+i,open:'open-'+i,close:'close-'+i,parent:'fn'});}
 tokens.push({id:'fn-close',code:'}',scope:null});const definition={schemaVersion:1,id:'scope-pruning',revision:1,language:'javascript',title:'',description:'',tokens,blocks},compiled=compileDefinition(definition);assert.ok(!compiled.status);
 const valid=tokens.map(x=>x.code),invalid=[tokens[0].code,...tokens.filter(x=>x.id.startsWith('open-')).map(x=>x.code),...Array(10).fill('}')];
 assert.equal(grade(compiled,valid).status,'accepted');
 const report=validateSubmission(compiled,{exerciseId:definition.id,revision:1,lines:invalid},{maxStates:2000});assert.equal(report.status,'rejected');assert.ok(report.exploredStates<100);
});


for(const [name,body] of [
 ['primitive let declarations','let a = 10;\nlet b = 20;\nconst c = a + b;\nreturn c;'],
 ['read-write hazards','let value = 1;\nconst before = value;\nvalue = 2;\nreturn { before, value };'],
 ['compound assignment','let value = 1;\nvalue += 2;\nreturn value;'],
 ['observable calls','record("first");\nrecord("second");\nreturn 3;'],
 ['conditional branches','const a = 1;\nif (a) {\nrecord("then");\n}\nreturn a;']
])test('fixed JS differential fixture: '+name,()=>{
 const fixture='function evaluate() {\n'+body+'\n}',model=generateCodeLineExercise({source:fixture,language:'javascript'},ts),compiled=compile(model),original=fixture.split('\n');
 // Enumerate all body physical permutations, including grammar-breaking moves.
 for(const order of permute(Array.from({length:original.length-2},(_,i)=>i+1))){const lines=[original[0],...order.map(i=>original[i]),original.at(-1)],expected=oracle(fixture,lines.join('\n'));assert.equal(grade(compiled,lines).status,expected?'accepted':'rejected',JSON.stringify({name,order,expected}));}
});

test('dynamic with scope never receives speculative binding-based reorderings',()=>{
 const fixture='function evaluate() {\n const a = 1;\n with (object) {\n const x = a + 1;\n const y = a + 2;\n consume(x, y);\n }\n}';
 const m=generateCodeLineExercise({source:fixture,language:'javascript'},ts);assert.deepEqual(m.lines.map(x=>x.dependencies),[[],[1],[2],[3],[4],[5],[6],[7]]);
});

test('nested functions, shadowed variables, throws, loops and finally retain their control/effect regions',()=>{
 const fixtures=[
 'function evaluate() {\n const x = 1;\n {\n const x = 2;\n const y = x + 1;\n record(y);\n }\n return x;\n}',
 'function evaluate() {\n const a = 1;\n function inner() {\n const x = 2;\n const y = 3;\n return x + y;\n }\n return inner() + a;\n}',
 'function evaluate() {\n let total = 0;\n for (let i = 0; i < 2; i++) {\n const a = 1;\n const b = 2;\n total += a + b;\n }\n return total;\n}',
 'function evaluate() {\n try {\n record("try");\n throw 7;\n } catch (error) {\n record(error);\n } finally {\n record("finally");\n }\n return 1;\n}'
 ];
 for(const fixture of fixtures){const m=generateCodeLineExercise({source:fixture,language:'javascript'},ts),compiled=compile(m),original=fixture.split('\n');assert.equal(grade(compiled,original).status,'accepted');
  for(let from=0;from<original.length;from++)for(let to=0;to<original.length;to++){const lines=[...original],row=lines.splice(from,1)[0];lines.splice(to,0,row);const result=grade(compiled,lines);if(result.accepted)assert.equal(oracle(fixture,lines.join('\n')),true,JSON.stringify({fixture,from,to}));}
 }
});
