/** ADR-046 (v23): while, do…while and for over own objects get footprints. A counting for with a
 * literal bound whose body leaves the counter alone ends; any other loop may hang, which orders it
 * like a throw. Positive and negative cases, JS and TS, each checked against the runtime oracle. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const box=['class Box {','  constructor(label) {','    this.label = label;','    this.count = 0;','  }','  bump() {','    this.count = this.count + 1;','  }','  double() {','    this.count = this.count * 2;','  }','  shout() {',"    record('shout', this.label);",'  }','}'];
const program=(id,body,language='javascript',classLines=box)=>({id,origin:'loops',language,probe:'run()',source:[...classLines,`function run()${language==='typescript'?': string':''} {`,"  const a = new Box('a');","  const b = new Box('b');",...body,'  return JSON.stringify([a, b]);','}']});
/** The reference order with the one-row unit `row` moved directly before the row `anchor`. */
function moveBefore(fixture,row,anchor){
 const model=generate(fixture),order=model.lines.map(line=>line.id),at=code=>order.findIndex(id=>model.lines[id-1].code.trim()===code);
 const [moved]=order.splice(at(row),1);order.splice(at(anchor),0,moved);
 return createClassifier(fixture,model).classify(order);
}
const fixtures={
 counted:program('loops-counted',['  for (let i = 0; i < 2; i++) {','    a.bump();','  }','  b.shout();']),
 descending:program('loops-descending',['  for (let i = 3; i > 0; i--) {','    a.bump();','  }','  b.shout();']),
 counterWritten:program('loops-counter-written',['  for (let i = 0; i < 2; i++) {','    a.bump();','    i = i + 0;','  }','  b.shout();']),
 whileLoop:program('loops-while',['  while (a.count < 3) {','    a.bump();','  }','  b.bump();','  b.shout();']),
 doLoop:program('loops-do',['  do {','    a.bump();','  } while (a.count < 2);','  b.bump();']),
 conflict:program('loops-conflict',['  while (a.count < 3) {','    a.bump();','  }','  a.double();','  b.bump();']),
 outerCounter:program('loops-outer-counter',['  let i = 0;','  for (i = 0; i < 2; i++) {','    a.bump();','  }','  b.bump();']),
 typed:program('loops-typescript',['  while (a.count < 3) {','    a.bump();','  }','  b.bump();'],'typescript',['class Box {','  count = 0;','  constructor(public label: string) {}','  bump(): void {','    this.count = this.count + 1;','  }','}']),
};

test('v23 is introduced by ADR-046 in the formal contract and is at most the generation rule',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=23,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v23` \| \[ADR-046\]/);
});

test('every loop witness is sound and decided',()=>{
 for(const fixture of Object.values(fixtures)){
  const row=measureFixture(fixture,CORPUS_CAPS);
  assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],fixture.id);
 }
});

for(const [fixture,row,anchor,why] of [
 [fixtures.counted,'b.shout();','for (let i = 0; i < 2; i++) {','a counting loop ends, so it commutes with an external call'],
 [fixtures.descending,'b.shout();','for (let i = 3; i > 0; i--) {','a descending counting loop ends too'],
 [fixtures.whileLoop,'b.bump();','while (a.count < 3) {','a while loop beside a non-throwing operation on another object'],
 [fixtures.doLoop,'b.bump();','do {','a do…while loop beside another object'],
 [fixtures.typed,'b.bump();','while (a.count < 3) {','TypeScript'],
])test(`free: ${why}`,()=>{
 assert.equal(moveBefore(fixture,row,anchor).kind,'accepted');
});

test('kept: the loop writes what a later operation reads',()=>{
 const result=moveBefore(fixtures.conflict,'a.double();','while (a.count < 3) {');
 assert.ok(['justified','gap'].includes(result.kind),JSON.stringify(result));
 assert.ok(result.causes.some(code=>code.startsWith('object-')),JSON.stringify(result));
});

for(const [fixture,row,anchor,why] of [
 [fixtures.whileLoop,'b.shout();','while (a.count < 3) {','a while loop is not shown to end'],
 [fixtures.counterWritten,'b.shout();','for (let i = 0; i < 2; i++) {','a body that writes the counter is not shown to end'],
])test(`conservative: ${why}, so it stays ordered with an external call`,()=>{
 // Both loops do end at run time: the oracle sees the same behaviour, so this is a measured gap.
 const result=moveBefore(fixture,row,anchor);
 assert.deepEqual([result.kind,result.causes],['gap',['may-throw']]);
});

test('still a barrier: a for whose head assigns an outer variable',()=>{
 const result=moveBefore(fixtures.outerCounter,'b.bump();','for (i = 0; i < 2; i++) {');
 assert.ok(['gap','justified'].includes(result.kind),JSON.stringify(result));
 assert.ok(result.causes.includes('ForStatement'),JSON.stringify(result));
});
