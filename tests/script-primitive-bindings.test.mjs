/** ADR-082 (v46): a script-level binding the program never writes holds what its declaration stored
 * until code runs again. Code before the declaration cannot change it (a `let` is still uninitialised,
 * a `var` declaration's assignment overwrites), and pure units and barriers of the script list keep
 * their order. An initialiser of a converting operator (`v1 + 1`) stores a primitive whatever its
 * evaluation runs. So `const c6 = l3 + 1` runs no code when no code-running statement stands between
 * `let l3 = v1 + 1` and it, and it no longer follows a global write it does not read. The oracle's
 * hostile environment (ADR-081) checks each verdict against external code that writes the globals. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const fixture=(id,source)=>({id,origin:'adr-082',language:'javascript',probe:'evaluate()',environments:['strict','hostile'],source});
/** The verdict for moving the row `code` (trimmed) to just before the row `target`. */
function verdict(program,code,target){
 const model=generate(program),order=model.lines.map(line=>line.id),at=text=>order.findIndex(id=>model.lines[id-1].code.trim()===text);
 const [moved]=order.splice(at(code),1);order.splice(at(target),0,moved);
 return createClassifier(program,model).classify(order).kind;
}
const clean=program=>{const row=measureFixture(program,CORPUS_CAPS);assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],program.id);return row;};
const tail=['function evaluate() {','  return [v1, l3, v5, c6];','}'];

test('the generation rule is v46 or later, v46 introduced by ADR-082 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=46,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v46` \| \[ADR-082\]/);
});

test('no code runs between the declaration and the read: the read runs none, and commutes with a global write',()=>{
 const program=fixture('adr082-free',['var v1 = 2;',"record('r', 3);",'let l3 = v1 + 1;','var v5 = 6;','const c6 = l3 + 1;',...tail]);
 assert.equal(verdict(program,'const c6 = l3 + 1;','var v5 = 6;'),'accepted');
 assert.equal(clean(program).gaps.length,0);
});

test('external code between the declaration and the read may replace the binding: the order is kept',()=>{
 const program=fixture('adr082-barrier',['var v1 = 2;','let l3 = v1 + 1;',"record('r', 3);",'var v5 = 6;','const c6 = l3 + 1;',...tail]);
 assert.equal(verdict(program,'const c6 = l3 + 1;','var v5 = 6;'),'justified','the hostile record replaced l3, whose conversion observes v5');
 clean(program);
});

test('a binding the program writes again is not the declaration\'s value',()=>{
 const program=fixture('adr082-written',['var v1 = 2;','let l3 = v1 + 1;','var v5 = 6;','const c6 = l3 + 1;','l3 = v1;',...tail]);
 clean(program);
});
