/** ADR-043 (policy A): code the reference never runs is ordered as if it ran. The oracle reports
 * which rows the fixed reference executes; a rejected order that the runtime cannot tell apart
 * but that breaks only constraints touching such rows is an `intent` rejection, not a gap. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {generate} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';
import {createOracle} from './support/semantic-oracle.mjs';
import {escapePrograms} from './fixtures/escape-programs.mjs';

const probe="(() => { try { return run(); } catch (error) { return 'throws ' + error.message; } })()";
const box=['class Box {','  constructor(label) {','    this.label = label;',"    this.tag = '';",'    this.log = [];','  }','  set(text) {','    this.tag = text;','  }','  add(value) {','    this.log.push(value);','  }','  flush() {',"    record('flush', this.log.join(','));",'  }','  rename(t) {',"    if (t === '') throw new Error('empty');",'    this.label = t;','  }','}'];
const thrown={id:'intent-after-throw',language:'javascript',probe,source:[...box,'function run() {',"  const a = new Box('a');","  const b = new Box('b');",'  a.add(1);','  b.add(2);',"  a.rename('');",'  b.add(3);','  b.flush();',"  b.set('x');",'  return JSON.stringify([a, b]);','}']};
const dead=fixture=>{const judge=createOracle(fixture);return fixture.source.flatMap((line,row)=>judge.executedRows().has(row)?[]:[line.trim()]);};
/** The reference order with the one-row unit `row` moved directly before the row `anchor`. */
function moveBefore(fixture,row,anchor){
 const model=generate(fixture),order=model.lines.map(line=>line.id),at=code=>order.findIndex(id=>model.lines[id-1].code.trim()===code);
 const [moved]=order.splice(at(row),1);order.splice(at(anchor),0,moved);
 return createClassifier(fixture,model).classify(order);
}

test('the oracle reports the rows after a sure throw and the bodies that never run as not executed',()=>{
 assert.deepEqual(dead(thrown),['this.tag = text;',"record('flush', this.log.join(','));",'this.label = t;','b.add(3);','b.flush();',"b.set('x');",'return JSON.stringify([a, b]);']);
});

test('an untaken branch and an unmatched case are not executed; a directive is not instrumented',()=>{
 const fixture={id:'intent-branches',language:'javascript',probe:'run(1)',source:['function run(n) {',"  'use strict';",'  let x = 0;','  if (n > 5) {','    x = 1;','  } else {','    x = 2;','  }','  switch (n) {','    case 3:','      x = 3;','      break;','    default:','      x += 10;','  }','  return x;','}']};
 assert.deepEqual(dead(fixture),['x = 1;','x = 3;','break;']);
});

test('TypeScript: erased declarations are not instrumented; the dead rows are found in both field modes',()=>{
 const fixture={id:'intent-typescript',language:'typescript',probe,source:['interface Named { name: string; }','class Box implements Named {','  log: number[] = [];','  constructor(public name: string) {}','  add(value: number): void {','    if (value < 0) throw new Error(\'negative\');','    this.log.push(value);','  }','}','function run(): string {',"  const a = new Box('a');",'  a.add(-1);','  a.add(2);','  return JSON.stringify(a);','}']};
 assert.deepEqual(dead(fixture),['this.log.push(value);','a.add(2);','return JSON.stringify(a);']);
});

test('policy A: an equivalent order that differs only in dead code is an intent rejection, not a gap',()=>{
 const result=moveBefore(thrown,'b.flush();','b.add(3);');
 assert.deepEqual([result.kind,result.causes],['intent',['object-read-after-write']]);
});

test('policy A leaves live code alone: free orders stay accepted, live over-strictness stays a gap',()=>{
 assert.equal(moveBefore(thrown,'b.add(2);','a.add(1);').kind,'accepted');
 // b.add(3) moved before the throw runs, but b is never observed once run() throws: equivalent.
 assert.equal(moveBefore(thrown,'b.add(3);',"a.rename('');").kind,'accepted');
 const fixture=escapePrograms.get('escape-bound-object-argument');
 assert.equal(moveBefore(fixture,'b.dump();','a.add(1);').kind,'gap');
});
