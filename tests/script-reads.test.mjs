/** ADR-041 (v20): a script-level read of a never-written script-level `var`/`let` with a
 * primitive initializer is primitive when no script-level statement that may run code precedes
 * it. Positive and negative cases, each checked against the runtime oracle on the fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const program=(id,source,probe='evaluate()')=>({id,origin:'script-read',language:'javascript',probe,source});
const tail=['function evaluate() {','  return [a, b];','}'];
/** The reference order with the rows `let a …` and `let b …` exchanged. */
function swapAB(fixture){
 const model=generate(fixture),id=prefix=>model.lines.find(line=>line.code.trim().startsWith(prefix)).id,[x,y]=[id('let a'),id('let b')];
 return createClassifier(fixture,model).classify(model.lines.map(line=>line.id===x?y:line.id===y?x:line.id));
}

test('v20 is introduced by ADR-041 in the formal contract and is at most the generation rule',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=20,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v20` \| \[ADR-041\]/);
});

for(const [why,source] of [
 ['a never-written var',['var v = 2;','let a = v + 1;','let b = v * 3;',...tail]],
 ['a never-written let',['let w = 2;','let a = w + 1;','let b = w * 3;',...tail]],
 ['a chain of such reads',['var v = 2;','let u = v + 1;','let a = u + 1;','let b = u * 3;',...tail]],
 ['a hoisted function and a code-free class before the reads',['function f() {','  return 1;','}','class K {','  m() { return 2; }','}','var v = 2;','let a = v + 1;','let b = v * 3;',...tail]],
 ['an unknown call after the reads',['var v = 2;','let a = v + 1;','let b = v * 3;',"record('end');",...tail]],
])test(`free: ${why}`,()=>{
 assert.equal(swapAB(program('free',source)).kind,'accepted');
});

for(const [why,source] of [
 ['an unknown call before the reads',['var v = 2;',"record('x');",'let a = v + 1;','let b = v * 3;',...tail]],
 ['a write through the global object before the reads',['var v = 2;','globalThis.v = {n: 0, valueOf() { return ++this.n; }};','let a = v + 1;','let b = v * 3;',...tail]],
 ['a class with a static block before the reads',['var v = 2;','class K {','  static { record(1); }','}','let a = v + 1;','let b = v * 3;',...tail]],
 ['a var written by name elsewhere',['var v = 2;','let a = v + 1;','let b = v * 3;','function bump() {','  v++;','}',...tail]],
 ['a var declared twice',['var v = 2;','var v = 3;','let a = v + 1;','let b = v * 3;',...tail]],
])test(`ordered: ${why}`,()=>{
 const result=swapAB(program('ordered',source));
 assert.ok(result.kind==='gap'||result.kind==='justified',JSON.stringify(result));
 assert.ok(result.causes.includes('effectful-or-unknown-initializer'),JSON.stringify(result));
});

test('ordered: a read inside a function body still treats a script var as writable',()=>{
 const fixture=program('in-function',['var v = 2;','function evaluate() {','  let a = v + 1;','  let b = v * 3;','  return [a, b];','}']);
 const result=swapAB(fixture);
 assert.ok(result.kind==='gap'||result.kind==='justified',JSON.stringify(result));
});

test('the global-object write before the reads is observable: swapping is not equivalent',()=>{
 // valueOf counts its calls, so the reads see 1 and 2 in order; the oracle confirms the kept order.
 const result=swapAB(program('observable',['var v = 2;','globalThis.v = {n: 0, valueOf() { return ++this.n; }};','let a = v + 1;','let b = v * 3;',...tail]));
 assert.equal(result.kind,'justified');
});
