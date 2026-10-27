/** ADR-020: the creation order of method, accessor and top-level function keys counts
 * only when the program itself can list those keys. Instance fields keep their order. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {observesKeyOrder} from '../dist/author/js-ts-ordering.js';
import {createOracle} from './support/semantic-oracle.mjs';

function verdict(source,order,language='javascript'){
 const model=generateCodeLineExercise({source:source.join('\n'),language},ts),compiled=compileCodeLineExercise(model);
 assert.ok(!compiled.status,compiled.message);
 const lines=order.map(row=>source[row-1]);
 return {graded:validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines}).status,oracle:createOracle({id:'adr-020',language,probe:'evaluate()',source})(lines).ok};
}
const observes=(source,name='x.js')=>observesKeyOrder(ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true),ts);

test('detection: reflection APIs, the global object and script-level this; not this inside a function or a module',()=>{
 assert.equal(observes('function f() { return 1; }'),false);
 for(const source of ['const k = Object.getOwnPropertyNames(A.prototype);','Reflect.ownKeys(A);','Object.getOwnPropertyDescriptors(A);','globalThis.x = 1;','window.x;','const g = this;','const g = () => this;'])assert.equal(observes(source),true,source);
 assert.equal(observes('function f() { return this; }'),false);
 assert.equal(observes('class A { m() { return this; } }'),false);
 assert.equal(observes('export const g = this;','x.ts'),false,'module-level this is undefined');
});

const functions=['function double(value) {','  return value * 2;','}','function evaluate() {','  return double(21);','}'];
test('top-level functions commute unless the program lists the global keys',()=>{
 assert.deepEqual(verdict(functions,[4,5,6,1,2,3]),{graded:'accepted',oracle:true});
 const listing=[...functions.slice(0,4),'  return [double(21), Object.keys(globalThis).includes("double")];','}'];
 assert.deepEqual(verdict(listing,[4,5,6,1,2,3]),{graded:'rejected',oracle:false});
});

const methods=['class Counter {','  count = 0;','  label = "c";','  up() {','    this.count++;','  }','  down() {','    this.count--;','  }','}','function evaluate() {','  const counter = new Counter();','  counter.up();','  return [counter.count, Object.keys(counter)];','}'];
test('methods commute; instance fields keep their order (Object.keys sees it)',()=>{
 assert.deepEqual(verdict(methods,[1,2,3,7,8,9,4,5,6,10,11,12,13,14,15]),{graded:'accepted',oracle:true});
 assert.deepEqual(verdict(methods,[1,3,2,...Array.from({length:12},(_,i)=>i+4)]),{graded:'rejected',oracle:false});
});

const overloads=['class Format {','  show(value: string): string;','  show(value: number): string;','  show(value: string | number): string {','    return String(value);','  }','  twice(value: string): string {','    return value + value;','  }','}','function evaluate(): string {','  return new Format().twice(new Format().show(1));','}'];
test('a plain overload group is one method definition for the analysis; the closure keeps it whole (projection loss)',()=>{
 const model=generateCodeLineExercise({source:overloads.join('\n'),language:'typescript'},ts);
 const loss=model.authoring.evidence.projectionLoss;
 assert.ok(loss.pairs>0,'the analysis frees the group, the v2 projection pins the multi-row unit');
 // Inside the group the rows keep their order: swapping two signatures is rejected.
 assert.equal(verdict(overloads,[1,3,2,...Array.from({length:10},(_,i)=>i+4)],'typescript').graded,'rejected');
});
