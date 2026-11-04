/** ADR-081: the oracle's `hostile` environment, the adversary of the default `any` input contract for a
 * script's globals. External code (`record`) replaces primitive top-level variables with objects that
 * observe, on every conversion, the values of all of them; the realm itself stays untampered. An order the generator keeps for this contract is then justified, not a
 * gap; the `valid` contract and modules promise no such code, so there the environment does not apply. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';
import {PROGRAM_KINDS} from './support/fixture-catalog.mjs';

const witness=environments=>({...PROGRAM_KINDS.script(2,{language:'javascript'}),environments});
/** The verdict for moving the row `code` (trimmed) to just before the row `target`. */
function verdict(program,code,target){
 const model=generate(program),order=model.lines.map(line=>line.id),at=text=>order.findIndex(id=>model.lines[id-1].code.trim()===text);
 const [moved]=order.splice(at(code),1);order.splice(at(target),0,moved);
 return createClassifier(program,model).classify(order).kind;
}

test('a conversion after external code observes the global writes: the kept order is justified',()=>{
 assert.equal(verdict(witness(['strict']),'var v5 = 6;','let l3 = v1 + 1;'),'gap','a benign record cannot tell');
 assert.equal(verdict(witness(['strict','hostile']),'var v5 = 6;','let l3 = v1 + 1;'),'justified');
});

test('the realm stays untampered: a var assignment runs no code, so the swap the generator frees is equivalent (ADR-082)',()=>{
 // No earlier script defines accessors for the program's names (the contract's environment); after
 // `l3 = v1 + 1` (always a primitive) no external code runs, so `c6 = l3 + 1` runs none either.
 assert.equal(verdict(witness(['strict','hostile']),'const c6 = l3 + 1;','var v5 = 6;'),'accepted');
 const row=measureFixture(witness(['strict','hostile']),CORPUS_CAPS);
 assert.deepEqual([row.unsound,row.gaps.length],[0,0]);
});

test('valid plain data promises no hostile external code: the swap is accepted and the environment is skipped',()=>{
 const program={...witness(['strict','hostile']),inputs:'valid'};
 assert.equal(verdict(program,'const c6 = l3 + 1;','var v5 = 6;'),'accepted');
 assert.equal(measureFixture(program,CORPUS_CAPS).unsound,0);
});

test('a module keeps its bindings: the hostile record only records, and nothing becomes unsound',()=>{
 const program={id:'adr081-module',origin:'adr-081',language:'typescript',probe:'evaluate()',environments:['strict','hostile'],source:['export let a = 1;',"record('x', a);",'export const b = a + 1;','export function evaluate(): number[] {','  return [a, b];','}']};
 const row=measureFixture(program,CORPUS_CAPS);
 assert.equal(row.unsound,0);
});
