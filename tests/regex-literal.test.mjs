/** ADR-086 (v49): a regular expression literal is a pure initialiser. It creates a fresh RegExp with the
 * intrinsic constructor, runs no program code, and never throws at run time (an invalid pattern is an
 * early SyntaxError). Its declaration then commutes with a barrier it is not read by; a closure that
 * reads the binding still keeps it ordered (the binding may not be initialised yet). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';
import {catalog} from './support/fixture-catalog.mjs';

const fixture=(id,source)=>({id,origin:'adr-086',language:'javascript',probe:'evaluate()',source});
/** The verdict for moving the row `code` (trimmed) to just before the row `target`. */
function verdict(program,code,target){
 const model=generate(program),order=model.lines.map(line=>line.id),at=text=>order.findIndex(id=>model.lines[id-1].code.trim()===text);
 const [moved]=order.splice(at(code),1);order.splice(at(target),0,moved);
 return createClassifier(program,model).classify(order).kind;
}

test('the generation rule is v49 or later, v49 introduced by ADR-086 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=49,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v49` \| \[ADR-086\]/);
});

test('a regex literal declaration commutes with a barrier that does not read it',()=>{
 const program=catalog().find(entry=>entry.id==='cov-optional-delete-regex');
 assert.equal(verdict(program,'const pattern = /a+b/g;','delete config.extra;'),'accepted');
 const row=measureFixture(program,CORPUS_CAPS);
 assert.deepEqual([row.unsound,row.gaps.length],[0,0]);
});

test('a closure that reads the binding keeps the declaration after the call that may run it',()=>{
 const program=fixture('adr086-closure',['function evaluate() {','  const read = () => pattern.source;','  let first;','  try {','    first = read();','  } catch (error) {',"    first = 'uninitialised';",'  }','  const pattern = /a/;','  return [first, read()];','}']);
 assert.equal(verdict(program,'const pattern = /a/;','try {'),'justified');
 assert.equal(measureFixture(program,CORPUS_CAPS).unsound,0);
});
