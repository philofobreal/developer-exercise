/** ADR-072 (v38): a list statement that certainly overwrites a field whenever it completes normally
 * (straight-line code, or a for…of that visits every member of one own array literal) hides the
 * field's earlier values from later readers; a getter whose straight-line body returns keeps a known
 * value; a switch with a known discriminant runs from the selected clause on. Each negative case
 * is one where the stronger rule would accept an order that behaves differently. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const box=['class Box {','  constructor(label) {','    this.label = label;','    this.log = [];',"    this._tag = '';",'  }','  set tag(value) {','    this._tag = value;','  }','  get tag() {','    return this._tag;','  }','  attach(log) {','    this.log = log;','  }','  note(text) {','    this.log.push(text);','  }','}'];
const program=(id,body)=>({id,origin:'adr-072',language:'javascript',probe:'run()',source:[...box,'function run() {',"  const a = new Box('a');","  const b = new Box('b');",'  const shared = [];','  const boxes = [a, b];',...body,'  return JSON.stringify([a, b, shared]);','}']});
/** The verdict for moving the row `code` (trimmed) to just before the row `target`, both inside run(). */
function verdict(fixture,code,target){
 const model=generate(fixture),order=model.lines.map(line=>line.id),start=model.lines.findIndex(line=>line.code==='function run() {');
 const at=text=>order.findIndex(id=>id-1>start&&model.lines[id-1].code.trim()===text);
 const [moved]=order.splice(at(code),1);order.splice(at(target),0,moved);
 return createClassifier(fixture,model).classify(order).kind;
}
const clean=fixture=>{const row=measureFixture(fixture,CORPUS_CAPS);assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],fixture.id);};
const everyMember=['  for (const entry of boxes) {',"    entry.tag = 't5';",'  }'];
const selected=['  switch (b.tag) {',"    case 't7':",'      a.attach(shared);',"      a.note('c');",'      break;','    default:',"      b.note('d');",'  }'];

test('the generation rule is v38 or later, v38 introduced by ADR-072 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=38,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v38` \| \[ADR-072\]/);
});

test('a loop over every member overwrites the field: the case it rules out binds nothing',()=>{
 const fixture=program('adr072-every',[...everyMember,...selected,"  shared.push('s');"]);
 assert.equal(verdict(fixture,"shared.push('s');",'switch (b.tag) {'),'accepted');
 clean(fixture);
});

test('a getter returning the overwritten field keeps it known: the branch it rules out binds nothing',()=>{
 const fixture=program('adr072-getter',[...everyMember,"  if (b.tag === 't7') {",'    a.attach(shared);',"    a.note('c');",'  }',"  shared.push('s');"]);
 assert.equal(verdict(fixture,"shared.push('s');","if (b.tag === 't7') {"),'accepted');
 clean(fixture);
});

test('a break may stop the loop before b: its earlier value may select the case',()=>{
 const fixture=program('adr072-break',["  b.tag = 't7';",'  for (const entry of boxes) {',"    entry.tag = 't5';",'    if (entry === a) {','      break;','    }','  }',...selected,"  shared.push('s');"]);
 assert.equal(verdict(fixture,"shared.push('s');",'switch (b.tag) {'),'justified');
 clean(fixture);
});

test('a write in a branch is not certain: the earlier value may select the case',()=>{
 const fixture=program('adr072-branch',["  b.tag = 't7';",'  if (shared.length > 0) {',"    b.tag = 't5';",'  }',...selected,"  shared.push('s');"]);
 assert.equal(verdict(fixture,"shared.push('s');",'switch (b.tag) {'),'justified');
 clean(fixture);
});

test('a write in a try block is not certain: a throw before it would leave the earlier value',()=>{
 // Here nothing throws, so the order runs alike (value intent); the point is that it is not accepted.
 const fixture=program('adr072-try',["  b.tag = 't7';",'  try {',"    a.note('t');","    b.tag = 't5';",'  } catch (error) {','    shared.length;','  }',...selected,"  shared.push('s');"]);
 assert.notEqual(verdict(fixture,"shared.push('s');",'switch (b.tag) {'),'accepted');
 clean(fixture);
});

// Measurement (ADR-072, point 5): a constraint that only code the reference never runs creates.
const loud=[...box.slice(0,-1),'  shout() {',"    record('shout', this.label);",'  }','}'];
const guarded=(id,body)=>({id,origin:'adr-072',language:'javascript',probe:'run()',source:[...loud,'function run() {',"  const a = new Box('a');","  const c = new Box('c');",...body,'  return JSON.stringify([a, c]);','}']});
const classify=(fixture,code,target)=>{
 const model=generate(fixture),order=model.lines.map(line=>line.id),start=model.lines.findIndex(line=>line.code==='function run() {');
 const at=text=>order.findIndex(id=>id-1>start&&model.lines[id-1].code.trim()===text);
 const [moved]=order.splice(at(code),1);order.splice(at(target),0,moved);
 return createClassifier(fixture,model).classify(order);
};

test('a constraint only a catch that never runs creates keeps the intent: dead-code',()=>{
 const fixture=guarded('adr072-dead-catch',['  try {','    a.shout();','  } catch (error) {',"    c.note('n2');",'  }',"  c.note('n1');"]);
 const result=classify(fixture,"c.note('n1');",'try {');
 assert.deepEqual([result.kind,result.reason],['intent','dead-code'],JSON.stringify(result));
 clean(fixture);
});

test('a constraint live code creates is no dead-code intent: the dropped array of NY-19 is heap intent (ADR-080)',()=>{
 const fixture=program('adr072-live',["  a.note('n2');","  a.note('n3');",'  a.attach(shared);']);
 assert.equal(verdict(fixture,"a.note('n3');","a.note('n2');"),'intent');
});
