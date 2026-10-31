/** ADR-047 (v24): a switch body is a block of its own, so its rows stay inside it by scope and the
 * switch is no longer sealed against every sibling. Positive and negative cases, each checked
 * against the runtime oracle. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const box=['class Box {','  constructor(name) {','    this.name = name;','    this.log = [];','  }','  add(value) {','    this.log.push(value);','  }','}'];
const program=(id,body,language='javascript')=>({id,origin:'switch',language,probe:'run()',source:[...box,`function run() {`,"  const a = new Box('a');","  const b = new Box('b');",...body,'  return JSON.stringify([a, b]);','}']});
const switched=program('switch-own',['  switch (a.name) {',"    case 'a':",'      a.add(1);','      break;','    default:','      a.add(2);','  }','  b.add(3);']);
/** The reference order with the one-row unit `row` moved directly before the row `anchor`. */
function moveBefore(fixture,row,anchor){
 const model=generate(fixture),order=model.lines.map(line=>line.id),at=code=>order.findIndex(id=>model.lines[id-1].code.trim()===code);
 const [moved]=order.splice(at(row),1);order.splice(at(anchor),0,moved);
 return createClassifier(fixture,model).classify(order);
}

test('v24 is introduced by ADR-047 in the formal contract and is at most the generation rule',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=24,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v24` \| \[ADR-047\]/);
});

test('the switch body is a block: its rows carry its scope, and nothing seals the switch',()=>{
 const model=generate(switched),open=model.lines.find(line=>line.code.trim()==='switch (a.name) {');
 const block=model.blocks.find(item=>item.openLineId===open.id);
 assert.ok(block,'the switch body is a retained block');
 for(const code of ["case 'a':",'a.add(1);','break;','default:','a.add(2);'])assert.equal(model.lines.find(line=>line.code.trim()===code).scopeId,block.id,code);
 assert.ok(!model.authoring.provenance.some(entry=>entry.code==='sealed-unit'));
});

test('every switch witness is sound and decided',()=>{
 const row=measureFixture(switched,CORPUS_CAPS);
 assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0]);
});

test('free: an operation on another object moves before the switch',()=>{
 assert.equal(moveBefore(switched,'b.add(3);','switch (a.name) {').kind,'accepted');
});

for(const [row,anchor,why] of [
 ['b.add(3);',"case 'a':",'a sibling cannot enter the switch body'],
 ['a.add(2);','default:','a row cannot leave its case clause'],
 ['a.add(1);','switch (a.name) {','a case row cannot leave the switch'],
])test(`rejected: ${why}`,()=>{
 assert.ok(['justified','gap'].includes(moveBefore(switched,row,anchor).kind));
});

test('TypeScript: the same switch body is a block',()=>{
 const typedBox=['class Box {','  log: number[] = [];','  constructor(public name: string) {}','  add(value: number): void {','    this.log.push(value);','  }','}'];
 const typed={id:'switch-typescript',origin:'switch',language:'typescript',probe:'run()',source:[...typedBox,'function run(): string {',"  const a = new Box('a');","  const b = new Box('b');",'  switch (a.name) {',"    case 'a':",'      a.add(1);','      break;','  }','  b.add(3);','  return JSON.stringify([a, b]);','}']};
 assert.equal(moveBefore(typed,'b.add(3);','switch (a.name) {').kind,'accepted');
});
