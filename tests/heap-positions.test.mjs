/** ADR-071 (v37): a heap cell (an object's field, an array's elements) keeps each value with the
 * position of the list statement that wrote it, and a statement sees only the values written at
 * or before its own position. Every writer of a cell is ordered with each reader of it, so a
 * later write still runs after the reader in every accepted order. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const box=['class Box {','  constructor(label) {','    this.label = label;','    this.log = [];','  }','  attach(log) {','    this.log = log;','  }','  note(text) {','    this.log.push(text);','  }','  rename(text) {','    this.label = text;','  }','}'];
const program=(id,body)=>({id,origin:'adr-071',language:'javascript',probe:'run()',source:[...box,'function run() {',"  const a = new Box('a');","  const b = new Box('b');",'  const shared = [];',...body,'  return JSON.stringify([a, b, shared]);','}']});
/** The verdict for moving the row `code` (trimmed) to just before (or, with `after`, just after) the
 * row `target`: the first such row inside run(), so a `}` never names a method's closing row. */
function verdict(fixture,code,target,after=false){
 const model=generate(fixture),order=model.lines.map(line=>line.id),start=model.lines.findIndex(line=>line.code==='function run() {');
 const at=text=>order.findIndex(id=>id-1>start&&model.lines[id-1].code.trim()===text);
 const [moved]=order.splice(at(code),1);order.splice(at(target)+(after?1:0),0,moved);
 return createClassifier(fixture,model).classify(order).kind;
}
const clean=fixture=>{const row=measureFixture(fixture,CORPUS_CAPS);assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],fixture.id);};
const attachLater=["  shared.push('s0');","  a.note('n1');","  a.attach(shared);","  a.note('n2');"];

test('the generation rule is v37 or later, v37 introduced by ADR-071 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=37,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v37` \| \[ADR-071\]/);
});

test('a write of a later statement is not seen: a.note before a.attach does not touch shared',()=>{
 const fixture=program('adr071-before',attachLater);
 assert.equal(verdict(fixture,"a.note('n1');","shared.push('s0');"),'accepted');
 clean(fixture);
});

test('the reader and the later writer keep their order: a.attach cannot move before a.note',()=>{
 const fixture=program('adr071-writer',attachLater);
 assert.equal(verdict(fixture,'a.attach(shared);',"a.note('n1');"),'justified');
});

test('after the write the reader sees it: a.note after a.attach is ordered with shared.push',()=>{
 const fixture=program('adr071-after',attachLater);
 assert.equal(verdict(fixture,"shared.push('s0');","a.note('n2');",true),'justified');
});

test('a loop sees its own later writes: the second round notes into shared',()=>{
 const fixture=program('adr071-loop',["  shared.push('s0');","  for (const text of ['x', 'y']) {",'    a.note(text);','    a.attach(shared);','  }']);
 assert.equal(verdict(fixture,"shared.push('s0');",'}',true),'justified');
 clean(fixture);
});

test('a known value up to here selects the branch; a later rename stays ordered with the test',()=>{
 const fixture=program('adr071-branch',["  if (a.label === 'a') {","    b.note('t');",'  }',"  a.rename('r');","  shared.push('s0');"]);
 assert.equal(verdict(fixture,"a.rename('r');","if (a.label === 'a') {"),'justified');
 clean(fixture);
});
