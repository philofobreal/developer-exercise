/** ADR-045 (v22): a key that a constructor's top-level `this.x = …` creates exists in every
 * constructed object, so a later write of it keeps the key order and is a write of that field
 * alone. During the object's own construction the write still creates the key. Positive and
 * negative cases, each checked against the runtime oracle (the probes list keys via JSON). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const program=(id,classLines,body,language='javascript')=>({id,origin:'constructor-keys',language,probe:'run()',source:[...classLines,'function run() {',"  const a = new Box('a');","  const b = new Box('b');",...body,'  return JSON.stringify([a, b]);','}']});
const box=['class Box {','  constructor(label) {','    this.label = label;','    this.count = 0;','  }','  bump() {','    this.count = this.count + 1;','  }','}'];
/** The reference order with the one-row unit `row` moved directly before the row `anchor`. */
function moveBefore(fixture,row,anchor){
 const model=generate(fixture),order=model.lines.map(line=>line.id),at=code=>order.findIndex(id=>model.lines[id-1].code.trim()===code);
 const [moved]=order.splice(at(row),1);order.splice(at(anchor),0,moved);
 return createClassifier(fixture,model).classify(order);
}
const fixtures={
 fields:program('keys-fields',box,["  b.label = 'x';",'  b.bump();']),
 calledFromConstructor:program('keys-called',['class Box {','  constructor(label) {','    this.label = label;','    this.reset();','    this.count = 0;','  }','  reset() {',"    this.extra = 'e';",'  }','}'],["  b.extra = 'x';",'  b.count = 1;']),
 earlyReturn:program('keys-return',['class Box {','  constructor(label) {','    this.label = label;','    if (label === \'z\') return;','    this.count = 0;','  }','}'],["  b.label = 'x';",'  b.count = 1;']),
 conditional:program('keys-conditional',['class Box {','  constructor(label) {','    this.label = label;',"    if (label === 'b') this.extra = 0;",'  }','}'],["  b.label = 'x';",'  b.extra = 1;']),
 accessor:program('keys-accessor',['class Box {','  constructor(label) {','    this.label = label;',"    this.tag = '';",'  }','  set tag(value) {','    this._tag = value;','  }','  get tag() {','    return this._tag;','  }','}'],["  b.label = 'x';","  b.tag = 't';"]),
 typed:program('keys-typescript',['class Box {','  label: string;','  count: number;','  constructor(label: string) {','    this.label = label;','    this.count = 0;','  }','}'],["  b.label = 'x';",'  b.count = 1;'],'typescript'),
};

test('v22 is introduced by ADR-045 in the formal contract and is at most the generation rule',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=22,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v22` \| \[ADR-045\]/);
});

test('every constructor-key witness is sound and decided',()=>{
 for(const fixture of Object.values(fixtures)){
  const row=measureFixture(fixture,CORPUS_CAPS);
  assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],fixture.id);
 }
});

for(const [fixture,row,anchor,why] of [
 [fixtures.fields,'b.bump();',"b.label = 'x';",'two fields the constructor created, after construction'],
 [fixtures.typed,'b.count = 1;',"b.label = 'x';",'TypeScript fields assigned in the constructor'],
])test(`free: ${why}`,()=>{
 assert.equal(moveBefore(fixture,row,anchor).kind,'accepted');
});

test('kept: the constructor body itself still creates its keys in order',()=>{
 const result=moveBefore(fixtures.fields,'this.count = 0;','this.label = label;');
 assert.equal(result.kind,'justified',JSON.stringify(result));
});

for(const [fixture,row,anchor,why] of [
 [fixtures.calledFromConstructor,'b.count = 1;',"b.extra = 'x';",'a key created by a method the constructor calls is not counted'],
 [fixtures.earlyReturn,'b.count = 1;',"b.label = 'x';",'a constructor with return may not create its keys'],
 [fixtures.conditional,'b.extra = 1;',"b.label = 'x';",'a conditional assignment may not create its key'],
 [fixtures.accessor,"b.tag = 't';","b.label = 'x';",'an accessor assignment creates no key of its name'],
])test(`still ordered: ${why}`,()=>{
 const result=moveBefore(fixture,row,anchor);
 assert.ok(['gap','justified'].includes(result.kind),JSON.stringify(result));
 assert.ok(result.causes.some(code=>code.startsWith('object-')),JSON.stringify(result));
});
