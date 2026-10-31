/** ADR-048 (v25): a function-local let/var whose every write stores a primitive is a primitive
 * local; a statement on own objects may read and assign it, and its binding conflicts order it.
 * Positive and negative cases, JS and TS, each checked against the runtime oracle. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const box=['class Box {','  constructor(name) {','    this.name = name;','    this.log = [];','  }','  note(text) {','    this.log.push(text);','  }','}'];
const program=(id,body,language='javascript',classLines=box)=>({id,origin:'locals',language,probe:'run()',source:[...classLines,`function run()${language==='typescript'?': string':''} {`,"  const a = new Box('a');","  const b = new Box('b');","  const c = new Box('c');",'  const boxes = [a, b];',...body,'  return JSON.stringify([a, b, c, seen]);','}']});
const counting=['  let seen = 0;','  for (const entry of boxes) {','    if (seen > 0) {',"      entry.note('again');",'    }','    seen = seen + 1;','  }',"  c.note('c');"];
const fixtures={
 counting:program('locals-counting',counting),
 compound:program('locals-compound',['  let seen = 0;','  for (const entry of boxes) {','    seen += 2;',"    entry.note('n');",'  }',"  c.note('c');"]),
 objectValue:program('locals-object-value',['  let seen = 0;','  for (const entry of boxes) {','    seen = seen + 1;',"    entry.note('n');",'  }',"  c.note('c');",'  seen = boxes;']),
 reader:program('locals-reader',[...counting,'  const total = seen + 1;',"  c.note('t' + total);"]),
 typed:program('locals-typescript',counting,'typescript',['class Box {','  log: string[] = [];','  constructor(public name: string) {}','  note(text: string): void {','    this.log.push(text);','  }','}']),
};
/** The reference order with the one-row unit `row` moved directly before the row `anchor`. */
function moveBefore(fixture,row,anchor){
 const model=generate(fixture),order=model.lines.map(line=>line.id),at=code=>order.findIndex(id=>model.lines[id-1].code.trim()===code);
 const [moved]=order.splice(at(row),1);order.splice(at(anchor),0,moved);
 return createClassifier(fixture,model).classify(order);
}

test('the generation rule is v25, introduced by ADR-048 in the formal contract',async()=>{
 assert.equal(DEPENDENCY_POLICY,'scoped-effect-analysis-v25');
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v25` \| \[ADR-048\]/);
});

test('every primitive-local witness is sound and decided',()=>{
 for(const fixture of Object.values(fixtures)){
  const row=measureFixture(fixture,CORPUS_CAPS);
  assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],fixture.id);
 }
});

for(const [fixture,why] of [
 [fixtures.counting,'a loop counting in a primitive local'],
 [fixtures.compound,'a compound assignment of a primitive'],
 [fixtures.typed,'TypeScript'],
])test(`free: ${why} is an operation, so an independent object moves before it`,()=>{
 assert.equal(moveBefore(fixture,"c.note('c');",'for (const entry of boxes) {').kind,'accepted');
});

test('kept: the declaration precedes the loop, and a later reader follows it',()=>{
 assert.ok(['justified','gap'].includes(moveBefore(fixtures.reader,'const total = seen + 1;','for (const entry of boxes) {').kind));
 const model=generate(fixtures.reader),loop=model.lines.find(line=>line.code.trim()==='for (const entry of boxes) {'),declaration=model.lines.find(line=>line.code.trim()==='let seen = 0;');
 assert.ok(model.authoring.provenance.some(entry=>entry.before===declaration.id&&entry.after===loop.id),'the loop reads the declared local');
});

test('conservative: a local that is ever assigned an object is not primitive, so the loop stays unknown',()=>{
 const result=moveBefore(fixtures.objectValue,"c.note('c');",'for (const entry of boxes) {');
 assert.ok(['gap','justified'].includes(result.kind),JSON.stringify(result));
 assert.ok(result.causes.includes('ForOfStatement'),JSON.stringify(result));
});
