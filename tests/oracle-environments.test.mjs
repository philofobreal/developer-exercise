/** ADR-062: environment variants of the oracle (an ES2015 emit, sloppy mode where the reference does
 * not depend on strictness) and for…in in the canonical key order when key order does not count. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {createOracle} from './support/semantic-oracle.mjs';
import {corpus} from './fixtures/ordering-corpus.mjs';
import {measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {measureCampaign} from './support/generative-metrics.mjs';

const ALL=['strict','es2015','sloppy'];
const fixture=(id,source,extra={})=>({id,origin:'witness',language:'javascript',probe:'evaluate()',source,...extra});

const listing=['class Box {','  constructor() {','    this.b = 2;','    this.a = 1;','  }','}','function evaluate() {','  const names = [];','  for (const name in new Box()) names.push(name);','  return names;','}'];
const swapped=[1,2,4,3,5,6,7,8,9,10,11].map(row=>listing[row-1]);
test('for…in follows the canonical key order when key order does not count',()=>{
 for(const [keyOrder,status,ok] of [['observed','rejected',false],['ignored','accepted',true]]){
  const model=generateCodeLineExercise({source:listing.join('\n'),keyOrder},ts),compiled=compileCodeLineExercise(model).compiled;
  assert.equal(validateSubmission(compiled,{exerciseId:model.id,revision:model.revision,lines:swapped}).status,status,keyOrder);
  const judge=createOracle(fixture('for-in',listing,{keyOrder}));
  assert.equal(judge(swapped).ok,ok,keyOrder);
 }
 assert.deepEqual(createOracle(fixture('for-in',listing,{keyOrder:'ignored'})).referenceValue,['a','b']);
 // Inherited enumerable keys follow the own ones, each level in the canonical order.
 const inherited=['function evaluate() {','  const base = { z: 1, y: 2 };','  const item = Object.create(base);','  item.b = 3;','  item.a = 4;','  const names = [];','  for (const name in item) names.push(name);','  return names;','}'];
 assert.deepEqual(createOracle(fixture('for-in-inherited',inherited,{keyOrder:'ignored'})).referenceValue,['a','b','y','z']);
});

test('sloppy mode counts only where the reference does not depend on strictness',()=>{
 const depends=['function evaluate() {','  const probe = function () { return this === undefined; };','  return probe();','}'];
 assert.deepEqual(createOracle(fixture('strictness',depends,{environments:ALL})).environments,['strict','es2015']);
 assert.deepEqual(createOracle(fixture('plain',listing,{environments:ALL})).environments,ALL);
});

test('the corpus stays sound in every environment variant',()=>{
 const ids=['class-inventory-ts','task-ledger-js','keyorder-entries','algo-bfs-js','task-group-by-js-valid','js-class-fields-methods'].filter(id=>corpus.has(id));
 assert.ok(ids.length>=5);
 for(const id of ids){
  const row=measureFixture({probe:'evaluate()',...corpus.get(id),environments:ALL},CORPUS_CAPS);
  assert.equal(row.unsound,0,id+' '+JSON.stringify(row.counterexamples));
 }
});

test('generated programs stay sound in every environment variant',()=>{
 const {violations}=measureCampaign({from:1,to:1,samples:4,neighbours:30,environments:ALL});
 assert.equal(violations,0);
});
