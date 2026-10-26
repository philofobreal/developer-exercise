/** ADR-013 end to end: local read/write conflicts and clause chains (`} else {`,
 * `} catch {`, `} finally {`). Every case is generated from the full reference,
 * compiled, graded by the real validator and, for runnable fixtures, judged by the
 * independent oracle (fixed fixtures only; learner input is never run). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {createOracle,codesOf,blockMoves,neighbourhood} from './support/semantic-oracle.mjs';

function setup(source,language='javascript'){
 const model=generateCodeLineExercise({source:source.join?.('\n')??source,language},ts),compiled=compileCodeLineExercise(model);
 assert.ok(!compiled.status,compiled.message);
 const grade=order=>validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:codesOf(model,order)},{maxStates:200_000}).status;
 const reference=model.lines.map(line=>line.id);
 const swapRows=(a,b)=>{const order=[...reference],at=row=>order.indexOf(model.lines.find(line=>line.sourceLine===row).id),i=at(a),j=at(b);[order[i],order[j]]=[order[j],order[i]];return order;};
 return {model,grade,reference,swapRows};
}
/** Soundness over every single-row move, pair swap and whole-unit move. */
function sound(fixture,model,grade){
 const judge=createOracle({...fixture,probe:'evaluate()'});
 let accepted=0;
 for(const order of [...neighbourhood(model.lines.map(line=>line.id)),...blockMoves(model)])if(grade(order)==='accepted'){accepted++;assert.notEqual(judge(codesOf(model,order)).ok,false,`${fixture.id}: SOUNDNESS ${order}`);}
 return accepted;
}

test('CopyFieldUtilityService: the two assignments of the if branch commute in the generated model; UUID() calls do not',async()=>{
 const source=await readFile(new URL('./fixtures/copy-field-utility.service.ts',import.meta.url),'utf8');
 const {model,grade,reference,swapRows}=setup(source,'typescript');
 assert.equal(grade(reference),'accepted');
 const code=row=>model.lines.find(line=>line.sourceLine===row).code.trim();
 assert.deepEqual([247,248,249,250].map(code),['if (this.isExistingTestFieldOnPage) {','processedLearningContentFields = processedFields;','processedTestField = [];','} else {']);
 assert.equal(grade(swapRows(248,249)),'accepted','independent local writes in one clause');
 assert.deepEqual([305,306].map(code),['copiedField.id = UUID();','copiedField.parentId = UUID();']);
 assert.equal(grade(swapRows(305,306)),'rejected','two UUID() values may land on different properties');
 assert.equal(grade(swapRows(251,252)),'rejected','calls keep their order');
 assert.equal(grade(swapRows(249,251)),'rejected','a row never crosses into the other clause');
 // The four if/else pairs are clause chains now: no omitted block, no serial lock.
 assert.equal(model.authoring.omittedBlocks,0);assert.equal(model.edges.length,0);
});

const cases=[
 {id:'independent-local-writes',source:['function evaluate() {','  let a = 0;','  let b = 0;','  a = 1;','  b = 2;','  return [a, b];','}'],swaps:[[4,5,'accepted',true],[2,4,'rejected',false]]},
 {id:'raw-local-writes',source:['function evaluate() {','  let a = 0;','  let b = 0;','  a = 1;','  b = a;','  return [a, b];','}'],swaps:[[4,5,'rejected',false]]},
 {id:'war-local-writes',source:['function evaluate() {','  let a = 1;','  let b = 0;','  b = a;','  a = 2;','  return [a, b];','}'],swaps:[[4,5,'rejected',false]]},
 {id:'waw-local-writes',source:['function evaluate() {','  let a = 0;','  a = 1;','  a = 2;','  return a;','}'],swaps:[[3,4,'rejected',false]]},
 {id:'write-across-call',source:['function evaluate() {','  let a = 0;','  const read = () => a;','  a = 1;','  record(read());','  return a;','}'],swaps:[[4,5,'rejected',false]]},
 {id:'effectful-right-side',source:['function evaluate() {','  let a = 0;','  let b = 0;',"  a = record('a');","  b = record('b');",'  return [a, b];','}'],swaps:[[4,5,'rejected',false]]},
 {id:'outer-function-binding',source:['let shared = 0;','function evaluate() {','  let mine = 0;','  shared = 1;','  mine = 2;','  return [shared, mine];','}'],swaps:[[4,5,'rejected',null]]},
 {id:'else-chain',source:['function evaluate() {','  const results = [];','  for (const n of [1, 5, 50]) {','    let label;','    let size;','    if (n > 10) {',"      label = 'big';",'      size = 3;','    } else if (n > 2) {',"      label = 'mid';",'      size = 2;','    } else {',"      label = 'small';",'      size = 1;','    }','    results.push([label, size]);','  }','  return results;','}'],swaps:[[7,8,'accepted',true],[10,11,'accepted',true],[13,14,'accepted',true],[8,10,'rejected',false],[11,13,'rejected',false]]},
 {id:'try-catch-finally-chain',source:['function evaluate() {','  let a = 0;','  let b = 0;','  try {','    a = 1;','    b = 2;',"    record('try');",'  } catch (error) {','    a = 3;','    b = 4;','  } finally {','    a = a + 0;','    b = 5;','  }','  return [a, b];','}'],swaps:[[5,6,'accepted',true],[9,10,'accepted',true],[6,9,'rejected',false],[10,12,'rejected',false]]}
];
for(const fixture of cases)test(`local writes and clause chains: ${fixture.id}`,t=>{
 const {model,grade,reference,swapRows}=setup(fixture.source),judge=createOracle({...fixture,language:'javascript',probe:'evaluate()'});
 assert.equal(grade(reference),'accepted');
 for(const [a,b,status,equivalent] of fixture.swaps){
  const order=swapRows(a,b);
  assert.equal(grade(order),status,`${fixture.id} ${a}<->${b}`);
  if(equivalent!==null)assert.equal(judge(codesOf(model,order)).ok,equivalent,`${fixture.id} ${a}<->${b} (oracle)`);
 }
 t.diagnostic(`${sound({...fixture,language:'javascript'},model,grade)} accepted neighbours and block moves, all sound`);
});
