/** ADR-059 (v30, plan item 2d): a global read-only built-in called on own objects — Object.keys,
 * values, entries, JSON.stringify — is a modelled read of the whole object, not an escape. Before,
 * passing the object to the call made every operation on it a barrier. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {DEPENDENCY_POLICY,generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {createOracle} from './support/semantic-oracle.mjs';
import {measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';

const grade=(source,rows,options={})=>{
 const model=generateCodeLineExercise({source:source.join('\n'),language:'javascript',...options},ts),compiled=compileCodeLineExercise(model);
 assert.ok(!compiled.status,compiled.message);
 return validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:rows.map(row=>source[row-1])}).status;
};
const fixture=(id,source,extra={})=>({id,origin:'witness',language:'javascript',probe:'evaluate()',source,...extra});
const sound=(id,source,extra={})=>{const row=measureFixture(fixture(id,source,extra),CORPUS_CAPS);assert.equal(row.unsound,0,JSON.stringify(row.counterexamples));return row;};
const range=n=>Array.from({length:n},(_,i)=>i+1);
const swap=(n,a,b)=>range(n).map(row=>row===a?b:row===b?a:row);

test('the generation rule is v30 or later, v30 introduced by ADR-059 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=30,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v30` \| \[ADR-059\]/);
});

const entries=['function evaluate() {','  const totals = {};','  totals.apple = 3;','  totals.pear = 5;','  const lines = [];','  for (const [name, count] of Object.entries(totals)) {',"    lines.push(name + ': ' + count);",'  }','  return lines;','}'];
test('Object.entries reads the object: its key writes are free when key order does not count, ordered when it does',()=>{
 assert.equal(grade(entries,swap(10,3,4),{keyOrder:'ignored'}),'accepted');
 assert.equal(grade(entries,swap(10,3,4)),'rejected','the listing shows the creation order');
 // A write the listing reads stays before it, in either setting.
 assert.equal(grade(entries,[1,2,3,5,6,7,8,4,9,10],{keyOrder:'ignored'}),'rejected');
 assert.equal(createOracle(fixture('entries-late',entries,{keyOrder:'ignored'}))([1,2,3,5,6,7,8,4,9,10].map(row=>entries[row-1])).ok,false);
 sound('entries',entries);sound('entries-ignored',entries,{keyOrder:'ignored'});
});

test('Object.values hands out the stored own objects: a later write to one stays ordered after the read',()=>{
 const values=['function evaluate() {','  const inner = { n: 1 };','  const box = { item: inner };','  const seen = [];','  for (const value of Object.values(box)) {','    seen.push(value.n);','  }','  inner.n = 2;','  return seen;','}'];
 assert.equal(grade(values,[1,2,3,4,8,5,6,7,9,10]),'rejected');
 assert.equal(createOracle(fixture('values',values))([1,2,3,4,8,5,6,7,9,10].map(row=>values[row-1])).ok,false);
 // The empty log is independent of both objects.
 assert.equal(grade(values,[1,4,2,3,5,6,7,8,9,10]),'accepted');
 sound('values',values);
});

test('JSON.stringify reads everything it reaches and may throw; toJSON leaves the subset',()=>{
 const json=['function evaluate() {','  const point = { x: 1 };','  const log = [];','  point.y = 2;','  log.push(JSON.stringify(point));','  point.x = 3;','  return log;','}'];
 assert.equal(grade(json,swap(8,5,6)),'rejected','the write would change the text');
 assert.equal(grade(json,swap(8,3,4)),'accepted','the fresh log does not meet the point');
 sound('json',json);
 // Two key writes before the text: free when key order does not count, unless toJSON may run code.
 const keys=['function evaluate() {','  const point = { x: 1 };','  const log = [];','  point.y = 2;','  point.z = 3;','  log.push(JSON.stringify(point));','  return log;','}'];
 assert.equal(grade(keys,swap(8,4,5),{keyOrder:'ignored'}),'accepted');
 sound('json-keys',keys,{keyOrder:'ignored'});
 const custom=keys.map((line,i)=>i===1?'  const point = { x: 1, toJSON: 0 };':line);
 assert.equal(grade(custom,swap(8,4,5),{keyOrder:'ignored'}),'rejected','a toJSON field: not modelled, a barrier');
 sound('json-custom',custom,{keyOrder:'ignored'});
});

test('a shadowed Object is the program\'s own and stays unknown',()=>{
 const shadow=['function evaluate() {','  const Object = { keys: (o) => [o] };','  const box = {};','  const log = [];','  box.a = 1;','  box.b = 2;','  for (const key of Object.keys(box)) log.push(key);','  return log;','}'];
 assert.equal(grade(shadow,swap(9,5,6),{keyOrder:'ignored'}),'rejected');
 // The same program with the global Object: the two key writes are free.
 assert.equal(grade(shadow.filter((_,i)=>i!==1),swap(8,4,5),{keyOrder:'ignored'}),'accepted');
 sound('shadow',shadow,{keyOrder:'ignored'});
});
