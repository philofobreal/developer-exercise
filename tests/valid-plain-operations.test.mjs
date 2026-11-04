/** ADR-099 (v51): NY-06. Under the `valid` input contract (valid plain data, ADR-050) four more forms
 * only read: a built-in function's spread argument (`Math.min(...values)`), an array method calling
 * back a concise read-only arrow (`values.reduce((sum, value) => sum + value, 0)`), the global
 * constants `Infinity` and `NaN`, an assignment of a local whose right side only reads, and a
 * `for…of` over a read-only value whose body only reads and writes locals. Each negative case breaks
 * one condition and stays ordered; every program is judged against the oracle under the same contract. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const probe='(() => [summarize([4, 8, 15, 16, 23, 42]), summarize([7]), summarize([-3, 0, 3])])()';
const program=(id,source,inputs='valid')=>({id,origin:'adr-099',language:'javascript',inputs,probe,source});
const loop=['function summarize(values) {','  let total = 0;','  let smallest = Infinity;','  let largest = -Infinity;','  for (const value of values) {','    total = total + value;','    smallest = value < smallest ? value : smallest;','    largest = value > largest ? value : largest;','  }','  const count = values.length;','  return { count, mean: total / count, range: largest - smallest };','}'];
const builtins=['function summarize(values) {','  const count = values.length;','  const total = values.reduce((sum, value) => sum + value, 0);','  const smallest = Math.min(...values);','  const largest = Math.max(...values);','  const mean = total / count;','  return { count, mean, range: largest - smallest };','}'];
/** The verdict for moving the row `code` (trimmed) to just before the row `target`. */
function verdict(fixture,code,target){
 const model=generate(fixture),order=model.lines.map(line=>line.id),at=text=>order.findIndex(id=>model.lines[id-1].code.trim()===text);
 assert.ok(at(code)>=0&&at(target)>=0,code+' / '+target);
 const [moved]=order.splice(at(code),1);order.splice(at(target),0,moved);
 return createClassifier(fixture,model).classify(order).kind;
}
const clean=fixture=>{const row=measureFixture(fixture,CORPUS_CAPS);assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],fixture.id);return row;};

test('the generation rule is v51 or later, v51 introduced by ADR-099 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=51,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v51` \| \[ADR-099\]/);
});

test('accumulators: -Infinity, the independent loop-body lines and the count before the loop are free; no gap',()=>{
 const fixture=program('adr099-loop',loop);
 assert.equal(verdict(fixture,'let largest = -Infinity;','let total = 0;'),'accepted');
 assert.equal(verdict(fixture,'largest = value > largest ? value : largest;','total = total + value;'),'accepted');
 assert.equal(verdict(fixture,'const count = values.length;','let total = 0;'),'accepted');
 assert.equal(clean(fixture).gaps.length,0);
});

test('built-ins: a spread argument and a read-only reduce callback are reads; no gap',()=>{
 const fixture=program('adr099-builtins',builtins);
 assert.equal(verdict(fixture,'const largest = Math.max(...values);','const count = values.length;'),'accepted');
 assert.equal(verdict(fixture,'const total = values.reduce((sum, value) => sum + value, 0);','const count = values.length;'),'accepted');
 assert.equal(clean(fixture).gaps.length,0);
});

test('the default contract is unchanged: the same programs stay ordered',()=>{
 assert.notEqual(verdict(program('adr099-loop-any',loop,'any'),'const count = values.length;','let total = 0;'),'accepted');
 assert.notEqual(verdict(program('adr099-builtins-any',builtins,'any'),'const largest = Math.max(...values);','const count = values.length;'),'accepted');
});

test('negative: a callback that writes, a block-bodied callback and a reduce without an initial value stay ordered',()=>{
 for(const [id,line] of [['writes','  const total = values.reduce((sum, value) => (seen = sum + value), 0);'],['block','  const total = values.reduce((sum, value) => { return sum + value; }, 0);'],['no-initial','  const total = values.reduce((sum, value) => sum + value);']]){
  const source=['function summarize(values) {','  let seen = 0;','  const count = values.length;',line,'  return [count, total, seen];','}'];
  const fixture=program('adr099-callback-'+id,source);
  assert.notEqual(verdict(fixture,line.trim(),'const count = values.length;'),'accepted',id);
  clean(fixture);
 }
});

test('negative: a loop with a jump, a loop writing an object, and a program with a generator stay ordered',()=>{
 const jump=['function summarize(values) {','  let total = 0;','  for (const value of values) {','    if (value < 0) {','      break;','    }','    total = total + value;','  }','  const count = values.length;','  return [count, total];','}'];
 assert.notEqual(verdict(program('adr099-jump',jump),'const count = values.length;','let total = 0;'),'accepted');
 const writes=['function summarize(values) {','  const seen = { last: 0 };','  for (const value of values) {','    seen.last = value;','  }','  const count = values.length;','  return [count, seen.last];','}'];
 assert.notEqual(verdict(program('adr099-object-write',writes),'const count = values.length;','for (const value of values) {'),'accepted');
 const generator=['function* each(list) {','  yield* list;','}','function summarize(values) {','  const count = values.length;','  const smallest = Math.min(...values);','  return [count, smallest, [...each(values)].length];','}'];
 assert.notEqual(verdict(program('adr099-generator',generator),'const smallest = Math.min(...values);','const count = values.length;'),'accepted');
 for(const [id,source] of [['adr099-jump',jump],['adr099-object-write',writes],['adr099-generator',generator]])clean(program(id,source));
});
