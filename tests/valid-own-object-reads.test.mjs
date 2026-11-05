/** ADR-102 (v52): the `param` gap. Under the `valid` input contract (valid plain data, ADR-050) a read unit
 * and a statement that only operates on the list's own objects commute, and a `const` that only reads
 * outside plain data is an outside value in the object footprints. Every way to reach an own object by
 * another name (an alias, a wrapper, a stored reference, a conditional, a callback, an inner part) keeps
 * the order; every program is judged against the oracle under the same contract. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const probe='(() => { try { return evaluate({ a: 1, b: "x", items: [1, 2, 3] }, 2); } catch (error) { return "throws " + error.name; } })()';
const program=(id,body,inputs='valid')=>({id,origin:'adr-102',language:'javascript',inputs,probe,source:['function evaluate(data, limit) {',...body,'}']});
/** The verdict for moving the row `code` (trimmed) to just before the row `target`. */
function verdict(fixture,code,target){
 const model=generate(fixture),order=model.lines.map(line=>line.id),at=text=>order.findIndex(id=>model.lines[id-1].code.trim()===text);
 assert.ok(at(code)>=0&&at(target)>=0,code+' / '+target);
 const [moved]=order.splice(at(code),1);order.splice(at(target),0,moved);
 return createClassifier(fixture,model).classify(order).kind;
}
const clean=fixture=>{const row=measureFixture(fixture,CORPUS_CAPS);assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],fixture.id);return row;};
const witness=['  const out = [];','  const c0 = data.a;','  const c1 = data.b + "1";','  let s2 = 0;','  for (const item of data.items) {','    s2 = s2 + item;','  }','  const c3 = Object.keys(data).length;','  out.push(c0);','  const c5 = Object.keys(data).length;','  return [c0, c1, s2, c3, c5, out];'];

test('the generation rule is v52 or later, v52 introduced by ADR-102 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=52,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v52` \| \[ADR-102\]/);
});

test('the campaign witness: a push onto an own array commutes with the reads of plain data; no gap',()=>{
 const fixture=program('adr102-witness',witness);
 assert.equal(verdict(fixture,'out.push(c0);','const c3 = Object.keys(data).length;'),'accepted');
 assert.equal(verdict(fixture,'out.push(c0);','for (const item of data.items) {'),'accepted');
 assert.equal(verdict(fixture,'const c5 = Object.keys(data).length;','out.push(c0);'),'accepted');
 assert.equal(clean(fixture).gaps.length,0);
});

test('the default contract is unchanged: the same program stays ordered',()=>{
 assert.notEqual(verdict(program('adr102-witness-any',witness,'any'),'out.push(c0);','const c3 = Object.keys(data).length;'),'accepted');
});

test('negative: an own object reached by another name keeps the order of its operation and the read',()=>{
 const cases={
  alias:[['  const out = [];','  const alias = out;','  const c0 = data.a;','  const n = alias.length;','  out.push(c0);','  return [n, out];'],'const n = alias.length;'],
  wrapper:[['  const out = [];','  const view = [out];','  const c0 = data.a;','  const n = view[0].length;','  out.push(c0);','  return [n, out];'],'const n = view[0].length;'],
  stored:[['  const out = [];','  data.keep = out;','  const c0 = data.a;','  const n = data.keep.length;','  out.push(c0);','  return [n, out];'],'const n = data.keep.length;'],
  conditional:[['  const out = [];','  const c0 = data.a;','  const pick = c0 ? out : data.items;','  const n = pick.length;','  out.push(c0);','  return [n, out];'],'const n = pick.length;'],
  callback:[['  const out = [];','  const c0 = data.a;','  const n = data.items.filter(v => v > out.length).length;','  out.push(c0);','  return [n, out];'],'const n = data.items.filter(v => v > out.length).length;'],
 };
 for(const [id,[body,read]] of Object.entries(cases)){
  const fixture=program('adr102-'+id,body);
  assert.notEqual(verdict(fixture,'out.push(c0);',read),'accepted',id);
  clean(fixture);
 }
 const inner=program('adr102-inner',['  const out = { list: [] };','  const inner = out.list;','  const c0 = data.a;','  const n = inner.length;','  out.list.push(c0);','  return [n, out];']);
 assert.notEqual(verdict(inner,'out.list.push(c0);','const n = inner.length;'),'accepted');
 clean(inner);
});
