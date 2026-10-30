/** ADR-042 (v21): a labelled for…of, switch, if, try or expression statement on own objects is the
 * operation it labels, and a jump to an enclosing label of that statement is interpreted like an
 * unlabelled one. Positive and negative cases, JS and TS, each checked against the runtime oracle. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const box=['class Box {','  constructor(name) {','    this.name = name;','    this.log = [];','  }','  add(value) {','    this.log.push(value);','  }','}'];
const typedBox=['class Box {','  log: number[] = [];','  constructor(public name: string) {}','  add(value: number): void {','    this.log.push(value);','  }','}'];
const program=(id,source,language='javascript')=>({id,origin:'labelled',language,probe:'run()',source});
const run=(...body)=>['function run() {',"  const a = new Box('a');","  const b = new Box('b');","  const c = new Box('c');",'  const boxes = [a, b];',...body,'  return JSON.stringify([a, b, c]);','}'];
/** The reference order with the one-row unit `row` moved directly before the row `anchor`. */
function moveBefore(fixture,row,anchor){
 const model=generate(fixture),order=model.lines.map(line=>line.id),at=code=>order.findIndex(id=>model.lines[id-1].code.trim()===code);
 const [moved]=order.splice(at(row),1);order.splice(at(anchor),0,moved);
 return createClassifier(fixture,model).classify(order);
}

const breakOuter=program('labelled-break',[...box,...run('  outer: for (const entry of boxes) {','    entry.add(1);','    break outer;','  }','  c.add(2);')]);
const continueOuter=program('labelled-continue',[...box,...run('  outer: for (const entry of boxes) {','    for (const other of boxes) {','      other.add(1);','      continue outer;','    }','  }','  c.add(2);')]);
const labelledSwitch=program('labelled-switch',[...box,...run('  pick: switch (a.name) {',"    case 'a':",'      a.add(1);','      break pick;','    default:','      a.add(2);','  }','  b.add(3);')]);
const labelledRow=program('labelled-row',[...box,...run('  step: a.add(1);','  b.add(2);')]);
const typed=program('labelled-typescript',[...typedBox,'function run(): string {',"  const a = new Box('a');","  const b = new Box('b');","  const c = new Box('c');",'  const boxes = [a, b];','  outer: for (const entry of boxes) {','    entry.add(1);','    break outer;','  }','  c.add(2);','  return JSON.stringify([a, b, c]);','}'],'typescript');
const labelledBlock=program('labelled-block',[...box,...run('  outer: {','    a.add(1);','    break outer;','  }','  b.add(2);')]);
const whileLoop=program('labelled-while',[...box,...run('  outer: while (a.log.length < 2) {','    a.add(1);','  }','  b.add(2);')]);

test('v21 is introduced by ADR-042 in the formal contract and is at most the generation rule',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=21,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v21` \| \[ADR-042\]/);
});

test('every labelled witness is sound and decided',()=>{
 for(const fixture of [breakOuter,continueOuter,labelledSwitch,labelledRow,typed,labelledBlock,whileLoop]){
  const row=measureFixture(fixture,CORPUS_CAPS);
  assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],fixture.id);
 }
});

for(const [fixture,row,anchor,why] of [
 [breakOuter,'c.add(2);','outer: for (const entry of boxes) {','a labelled loop beside an operation on another object'],
 [continueOuter,'c.add(2);','outer: for (const entry of boxes) {','a continue to the outer label of a nested loop'],
 [labelledRow,'b.add(2);','step: a.add(1);','a labelled one-row operation'],
 [typed,'c.add(2);','outer: for (const entry of boxes) {','TypeScript'],
])test(`free: ${why}`,()=>{
 assert.equal(moveBefore(fixture,row,anchor).kind,'accepted');
});

test('a labelled switch left by a labelled break has exactly the constraints of the unlabelled one',()=>{
 const unlabelled=program('unlabelled-switch',labelledSwitch.source.map(line=>line.replace('pick: ','').replace('break pick;','break;')));
 const constraints=fixture=>generate(fixture).authoring.provenance.map(({before,after,code})=>[before,after,code]);
 assert.deepEqual(constraints(labelledSwitch),constraints(unlabelled));
});

test('ADR-046 (v23): a labelled while loop is a loop footprint too, free beside another object',()=>{
 assert.equal(moveBefore(whileLoop,'b.add(2);','outer: while (a.log.length < 2) {').kind,'accepted');
});

test('kept: the labelled loop writes what a later operation reads',()=>{
 const fixture=program('labelled-conflict',[...box,...run('  outer: for (const entry of boxes) {','    entry.add(1);','    break outer;','  }','  a.add(2);')]);
 const result=moveBefore(fixture,'a.add(2);','outer: for (const entry of boxes) {');
 assert.equal(result.kind,'justified',JSON.stringify(result));
 assert.ok(result.causes.every(code=>code.startsWith('object-')),JSON.stringify(result));
});

for(const [fixture,row,anchor,why] of [
 [labelledBlock,'b.add(2);','outer: {','a labelled multi-row block owns no compound rows'],
])test(`still a barrier: ${why}`,()=>{
 const result=moveBefore(fixture,row,anchor);
 assert.ok(result.kind==='gap'||result.kind==='justified',JSON.stringify(result));
 assert.ok(result.causes.includes('LabeledStatement'),JSON.stringify(result));
});
