/** ADR-019: a pure declaration and an effect barrier of one function-level list
 * commute when no code the barrier can run observes their order. Every case is
 * checked against the generator, the independent policy oracle and a runtime run. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {createOracle} from './support/semantic-oracle.mjs';

function verdicts(source,order,probe='evaluate()'){
 const model=generateCodeLineExercise({source:source.join('\n'),language:'javascript'},ts);
 const compiled=compileCodeLineExercise(model);assert.ok(!compiled.status,compiled.message);
 const lines=order.map(row=>source[row-1]);
 const graded=validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines}).status;
 return {graded,policy:createOracle({id:'adr-019',language:'javascript',probe,source})(lines)};
}
const swap=(length,a,b)=>Array.from({length},(_,i)=>i+1).map(row=>row===a?b:row===b?a:row);
/** Moves `row` to just after `after` (a whole block when `after` is its closing row). */
const moveAfter=(length,row,after)=>{const rest=Array.from({length},(_,i)=>i+1).filter(r=>r!==row);rest.splice(rest.indexOf(after)+1,0,row);return rest;};
const expectOrder=(source,order,status)=>{
 const {graded,policy}=verdicts(source,order);
 assert.equal(graded,status,`generator ${order}`);
 assert.equal(policy.ok===true,status==='accepted',`oracle ${order}: ${policy.reason}`);
};
const expectPair=(source,a,b,status)=>expectOrder(source,swap(source.length,a,b),status);

const binarySearch=['function binarySearch(sorted, target) {','  let low = 0;','  let high = sorted.length - 1;','  while (low <= high) {','    const mid = Math.floor((low + high) / 2);','    if (sorted[mid] === target) {','      return mid;','    }','    if (sorted[mid] < target) {','      low = mid + 1;','    } else {','      high = mid - 1;','    }','  }','  return -1;','}','function evaluate() {','  return [[1, 3, 5, 7], []].map(list => [binarySearch(list, 5), binarySearch(list, 2)]);','}'];
test('a literal declaration crosses a property-reading declaration (binary search low/high)',()=>expectPair(binarySearch,2,3,'accepted'));
test('a counter read stays primitive: i - 1 crosses an element read (insertion sort current/j)',()=>{
 const sort=['function evaluate() {','  const values = [3, 1, 2];','  for (let i = 1; i < values.length; i++) {','    const current = values[i];','    let j = i - 1;','    while (j >= 0 && values[j] > current) {','      values[j + 1] = values[j];','      j--;','    }','    values[j + 1] = current;','  }','  return values;','}'];
 expectPair(sort,4,5,'accepted');
});
test('the barrier reading or declaring a binding keeps the order',()=>{
 expectPair(['function evaluate() {','  const a = 1;','  record(a);','  return a;','}'],2,3,'rejected');
 expectPair(['function evaluate() {','  const read = record(2);','  const sum = read + 1;','  return sum;','}'],2,3,'rejected');
});
test('a binding written by the barrier is not read across it',()=>{
 expectPair(['function evaluate() {','  let n = 1;','  const before = n === 1;','  n = record(n);','  return [before, n];','}'],3,4,'rejected');
});
test('a closure that captures the declared binding keeps the order',()=>{
 expectPair(['function evaluate() {','  const show = () => label;','  const label = "x";','  record(show);','  return label;','}'],3,4,'rejected');
});
test('a closure that writes a read binding keeps the order',()=>{
 expectPair(['function evaluate() {','  let n = 1;','  const bump = () => { n = 2; };','  const copy = n;','  bump();','  return copy;','}'],4,5,'rejected');
});
test('control transfer, var, arguments and the script level keep the order',()=>{
 const early=['function evaluate(flag) {','  const a = 1;','  if (flag) {','    return 0;','  }','  return a;','}'];
 expectOrder(early,moveAfter(early.length,2,5),'rejected');
 expectPair(['function evaluate() {','  var v = 1;','  record(0);','  return v;','}'],2,3,'rejected');
 expectPair(['function evaluate() {','  const a = 1;','  record(arguments.length);','  return a;','}'],2,3,'rejected');
 const script=['const a = 1;','record(0);','function evaluate() {','  return a;','}'];
 const {graded}=verdicts(script,[2,1,3,4,5]);assert.equal(graded,'rejected');
});
test('a shadowing name inside the barrier keeps the order (name-based, like the oracle)',()=>{
 const shadow=['function evaluate() {','  const label = "outer";','  {','    const label = "inner";','    record(label);','  }','  return label;','}'];
 expectOrder(shadow,moveAfter(shadow.length,2,6),'rejected');
});
test('an effect-free statement still commutes with a barrier that loops internally',()=>{
 const loop=['function evaluate() {','  const items = [1, 2];','  const tag = "t";','  for (const item of items) {','    if (item > 1) {','      break;','    }','    record(item);','  }','  return tag;','}'];
 expectOrder(loop,moveAfter(loop.length,3,9),'accepted');
});
