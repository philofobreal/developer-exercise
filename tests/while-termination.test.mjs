/** ADR-064 (v32): `while (x.f < K)` over an own object ends when f is always a number and every
 * iteration grows it by a positive step, directly or through a method; it then commutes with an
 * external call or a possible throw. Every other shape keeps ADR-046: it may hang. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const methods=['  bump() {','    this.count = this.count + 1;','  }','  reset() {','    this.count = 0;','  }','  shout() {',"    record('shout', this.label);",'  }'];
const box=(extra=[])=>['class Box {','  constructor(label) {','    this.label = label;','    this.count = 0;','  }',...methods,...extra,'}'];
const program=(id,loop,classLines=box())=>({id,origin:'loops',language:'javascript',probe:'run()',source:[...classLines,'function run() {',"  const a = new Box('a');","  const b = new Box('b');",...loop,'  b.shout();','  return JSON.stringify([a, b]);','}']});
/** The verdict for moving `b.shout();` before the loop's first row. */
function swap(fixture){
 const model=generate(fixture),order=model.lines.map(line=>line.id),at=code=>order.findIndex(id=>model.lines[id-1].code.trim()===code);
 const [moved]=order.splice(at('b.shout();'),1);order.splice(at(fixture.source.find(line=>/^\s*(while|do)\b/.test(line)).trim()),0,moved);
 return createClassifier(fixture,model).classify(order);
}

test('the generation rule is v32 or later, v32 introduced by ADR-064 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=32,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v32` \| \[ADR-064\]/);
});

const ends={
 method:program('while-method',['  while (a.count < 3) {','    a.bump();','  }']),
 direct:program('while-direct',['  while (a.count <= 4) {','    a.count += 2;','  }']),
 increment:program('while-increment',['  while (3 > a.count) {','    a.count++;','  }']),
 doWhile:program('while-do',['  do {','    a.bump();','  } while (a.count < 2);']),
 // A reset elsewhere keeps the field a number; the loop never calls it.
 unrelatedWrite:program('while-unrelated-write',['  while (a.count < 3) {',"    a.label = a.label + '!';",'    a.bump();','  }']),
 resetOutside:program('while-reset-outside',['  a.reset();','  while (a.count < 3) {','    a.bump();','  }']),
};
for(const [name,fixture] of Object.entries(ends))test(`ends: ${name}`,()=>{
 assert.equal(swap(fixture).kind,'accepted');
 const row=measureFixture(fixture,CORPUS_CAPS);
 assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],fixture.id);
});

const hangs={
 resetInside:program('while-reset-inside',['  while (a.count < 3) {','    a.bump();','    if (a.count > 100) {','      a.reset();','    }','  }']),
 stepUnknown:program('while-step-unknown',['  while (a.count < 3) {','    a.add(1);','  }'],box(['  add(step) {','    this.count += step;','  }'])),
 branch:program('while-branch',['  while (a.count < 3) {',"    if (a.label === 'a') {",'      a.bump();','    }','  }']),
 shrinking:program('while-shrinking',['  while (a.count < 3) {','    a.count = a.count - 1;','    a.bump();','    a.bump();','  }']),
 stringField:program('while-string-field',['  while (a.count < 3) {','    a.bump();','  }'],box(['  label2() {',"    this.count = 'x';",'  }'])),
 computed:program('while-computed',["  a['count'] = 0;",'  while (a.count < 3) {','    a.bump();','  }']),
};
for(const [name,fixture] of Object.entries(hangs))test(`not shown to end: ${name}`,()=>{
 const result=swap(fixture);
 assert.notEqual(result.kind,'accepted',JSON.stringify(result));
 assert.equal(measureFixture(fixture,CORPUS_CAPS).unsound,0,fixture.id);
});
