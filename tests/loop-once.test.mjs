/** ADR-070 (v36): a `for … of` over one own array literal whose body runs at most once (it ends
 * in a `break` that leaves the loop, and no `continue` returns to it) sees only the array's first
 * element, unless an unshift, pop or shift may have changed it. Every other loop keeps ADR-034:
 * the body may see every element. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const box=['class Box {','  constructor(label) {','    this.label = label;','  }','  rename(text) {','    this.label = text;','  }','}'];
const program=(id,loop,before=[])=>({id,origin:'adr-070',language:'javascript',probe:'run()',source:[...box,'function run() {',"  const a = new Box('a');","  const b = new Box('b');",'  const boxes = [a, b];',...before,...loop,"  b.rename('r2');",'  return JSON.stringify([a, b]);','}']});
/** The verdict for moving `b.rename('r2');` before the loop's first row. */
function verdict(fixture){
 const model=generate(fixture),order=model.lines.map(line=>line.id),at=code=>order.findIndex(id=>model.lines[id-1].code.trim()===code);
 const [moved]=order.splice(at("b.rename('r2');"),1);
 order.splice(at(fixture.source.find(line=>/^\s*(\w+: )?for \(/.test(line)).trim()),0,moved);
 return createClassifier(fixture,model).classify(order).kind;
}
const clean=fixture=>{const row=measureFixture(fixture,CORPUS_CAPS);assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],fixture.id);};

test('the generation rule is v36 or later, v36 introduced by ADR-070 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=36,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v36` \| \[ADR-070\]/);
});

const once={
 plain:['  for (const entry of boxes) {',"    entry.rename('r1');",'    break;','  }'],
 labelled:['  outer: for (const entry of boxes) {',"    entry.rename('r1');",'    break outer;','  }'],
 // A continue of an inner loop does not return to the outer one.
 innerContinue:['  for (const entry of boxes) {','    for (const other of [1]) {','      continue;','    }',"    entry.rename('r1');",'    break;','  }'],
};
for(const [name,loop] of Object.entries(once))test(`runs once, sees the first element only: ${name}`,()=>{
 const fixture=program('adr070-'+name,loop);
 assert.equal(verdict(fixture),'accepted');
 clean(fixture);
});

const every={
 conditionalBreak:['  for (const entry of boxes) {',"    entry.rename('r1');",'    if (entry === a) {','      break;','    }','  }'],
 continueFirst:['  for (const entry of boxes) {','    if (entry === a) {','      continue;','    }',"    entry.rename('r1');",'    break;','  }'],
};
for(const [name,loop] of Object.entries(every))test(`may run again, may see every element: ${name}`,()=>{
 const fixture=program('adr070-'+name,loop);
 assert.notEqual(verdict(fixture),'accepted');
 clean(fixture);
});

test('a shift before the loop gives the array another first element: it may see b',()=>{
 const fixture=program('adr070-shift',once.plain,['  boxes.shift();']);
 assert.equal(verdict(fixture),'justified','b is the first element after the shift, so the order matters');
 clean(fixture);
});
