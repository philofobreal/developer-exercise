/** ADR-084 (v48): NY-01. The first iteration of a for…of over one own array literal is interpreted on
 * its own: it binds the first element, and the list-level locals the body reads at the literal they hold
 * when the loop starts (declared with it in the list, written only by the loop). A guard such as
 * `if (seen > 0)` then skips that iteration, and the loop does not write the first element. Each
 * negative case breaks one condition, and the oracle shows that the order then matters. A compound
 * assignment of a primitive (`seen += 1`) counts like `seen = seen + 1`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const box=['class Box {','  constructor() {','    this.log = [];','  }','  attach(log) {','    this.log = log;','  }','  note(text) {','    this.log.push(text);','  }','}'];
/** `before` rows come between `const boxes = …` and the loop. */
const program=(id,{boxes='[a, b]',before=[],after=[],step='seen = seen + 1;'}={})=>({id,origin:'adr-084',language:'javascript',probe:'run()',source:[...box,'function run() {','  const a = new Box();','  const b = new Box();','  const shared = [];',`  const boxes = ${boxes};`,...after,'  a.attach(shared);','  let seen = 0;',...before,'  for (const entry of boxes) {','    if (seen > 0) {',"      entry.note('again');",'    }',`    ${step}`,'  }','  return JSON.stringify([a.log, b.log, shared]);','}']});
/** The verdict for moving `a.attach(shared);` behind the loop, just before the `return`. */
function verdict(fixture){
 const model=generate(fixture),order=model.lines.map(line=>line.id),at=text=>order.findIndex(id=>model.lines[id-1].code.trim()===text);
 const [moved]=order.splice(at('a.attach(shared);'),1);order.splice(at('return JSON.stringify([a.log, b.log, shared]);'),0,moved);
 return createClassifier(fixture,model).classify(order).kind;
}
const clean=fixture=>{const row=measureFixture(fixture,CORPUS_CAPS);assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],fixture.id);};

test('the generation rule is v48 or later, v48 introduced by ADR-084 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=48,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v48` \| \[ADR-084\]/);
});

test('the guard skips the first iteration: the loop does not write the first element, so attach moves behind it',()=>{
 const fixture=program('adr084-free');
 assert.equal(verdict(fixture),'accepted');
 clean(fixture);
});

test('another statement writes the counter: its entry value is unknown, the order is kept',()=>{
 const fixture=program('adr084-written',{before:['  seen = 1;']});
 assert.equal(verdict(fixture),'justified','the first iteration writes a, into shared or into its own log');
 clean(fixture);
});

test('a closure writes the counter: its entry value is unknown, the order is kept',()=>{
 const fixture=program('adr084-closure',{before:['  const reset = () => {','    seen = 1;','  };','  reset();']});
 assert.equal(verdict(fixture),'justified');
 clean(fixture);
});

test('the array is written after its creation: the iterations are not the literal\'s, the order is kept',()=>{
 const fixture=program('adr084-pushed',{after:['  boxes.push(a);']});
 assert.equal(verdict(fixture),'justified','the third iteration writes a again');
 clean(fixture);
});

test('the first element comes again later in the literal: that iteration writes it, the order is kept',()=>{
 const fixture=program('adr084-repeated',{boxes:'[a, b, a]'});
 assert.equal(verdict(fixture),'justified');
 clean(fixture);
});

test('a compound assignment of a primitive counts like a plain one: attach moves behind the loop',()=>{
 const fixture=program('adr084-compound',{step:'seen += 1;'});
 assert.equal(verdict(fixture),'accepted');
 clean(fixture);
});

test('a compound assignment with an object operand may run its valueOf: the loop is unknown, the order is kept',()=>{
 const fixture=program('adr084-compound-object',{step:'seen += entry;'});
 assert.notEqual(verdict(fixture),'accepted');
 clean(fixture);
});
