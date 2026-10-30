/** ADR-040 (v19): unknown calls with primitive arguments inside method bodies. The `free`
 * programs lose no equivalent order to the call any more (v18: 11 gaps, 10 of them the
 * ExpressionStatement barrier, on the first program); the kept orders stay rejected for the
 * named reason, and calls outside the rule stay unknown. Every verdict is checked against the
 * runtime oracle on the fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {escapePrograms} from './fixtures/escape-programs.mjs';
import {measureFixture,generate,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

/** The reference order with the rows of codes `first` and `second` exchanged. */
function swapped(model,first,second){
 const id=code=>model.lines.find(line=>line.code.trim()===code).id;
 const [x,y]=[id(first),id(second)];
 return model.lines.map(line=>line.id===x?y:line.id===y?x:line.id);
}
const classify=(id,first,second)=>{const fixture=escapePrograms.get(id),model=generate(fixture);return createClassifier(fixture,model).classify(swapped(model,first,second));};

test('v19 is introduced by ADR-040 in the formal contract and is at most the generation rule',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=19,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v19` \| \[ADR-040\]/);
});

test('every escape witness is sound and decided',()=>{
 for(const fixture of escapePrograms.values()){
  const row=measureFixture(fixture,CORPUS_CAPS);
  assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],fixture.id);
 }
});

test('free programs lose no equivalent order to the external call',()=>{
 for(const fixture of [...escapePrograms.values()].filter(fixture=>fixture.free)){
  const row=measureFixture(fixture,CORPUS_CAPS);
  assert.equal(row.gapCauses.ExpressionStatement,undefined,fixture.id);
  assert.ok(row.accepted>1,fixture.id);
 }
 // The pinned v18 target: 11 gaps, 10 of them the ExpressionStatement barrier.
 assert.equal(measureFixture(escapePrograms.get('escape-free-shout-beside-writes'),CORPUS_CAPS).completenessGaps,0);
});

for(const [id,first,second,why] of [
 ['escape-free-shout-beside-writes','a.add(1);','b.shout();','a write of another object'],
 ['escape-free-shout-beside-writes','b.shout();','b.add(2);','another field of the same object'],
 ['escape-free-constructor-records',"const b = new Tag('b');",'a.add(1);','a recording construction beside another object'],
 ['escape-free-callback-records','b.flush();','a.add(1);','a recording callback beside another object'],
 ['escape-free-caught-external','a.add(1);','b.safeShout();','a caught external call beside a non-throwing write'],
 ['escape-free-ambient-typescript','a.add(1);','b.shout();','an ambient TypeScript function'],
 ['escape-free-caught-beside-local-write','a.safeShout();','x = k;','a caught external call beside a write that reads a function local'],
])test(`free order: ${why}`,()=>{
 assert.equal(classify(id,first,second).kind,'accepted');
});

for(const [id,first,second,causes,why] of [
 ['escape-bound-list-level-call',"record('start');",'a.add(1);',['ExpressionStatement'],'a list-level unknown call is external (policy P2)'],
 ['escape-bound-two-shouts','a.shout();','b.shout();',['external-call-order'],'two external calls write the trace in order'],
 ['escape-free-constructor-records',"const a = new Tag('a');","const b = new Tag('b');",['external-call-order'],'two recording constructions'],
 ['escape-bound-both-throw','a.check(-1);','a.shout();',['may-throw'],'an external call and a throw'],
 ['escape-free-caught-external','b.safeShout();','a.check(-1);',['may-throw'],'a caught external call may still not return before a throw'],
 ['escape-free-callback-records','b.add(5);','b.flush();',['object-read-after-write'],'the callback reads what the write adds'],
])test(`kept order: ${why}`,()=>{
 const result=classify(id,first,second);
 assert.deepEqual([result.kind,result.causes],['justified',causes],JSON.stringify(result));
});

for(const [id,call,cause,why] of [
 ['escape-bound-eval','b.evalShout();','source-order','direct eval sees the method scope'],
 ['escape-bound-object-argument','b.dump();','ExpressionStatement','an object argument escapes (item 2d)'],
 ['escape-bound-declared-callee','b.noted();','ExpressionStatement','a callee the program declares'],
 ['escape-bound-shadowed-callee','b.call(1);','ExpressionStatement','a parameter shadows the global name'],
])test(`still unknown: ${why}`,()=>{
 // Conservative, not wrong: the order is equivalent, and v19 still rejects it.
 assert.deepEqual(Object.entries(classify(id,'a.add(1);',call)).filter(([key])=>key==='kind'||key==='causes'),[['kind','gap'],['causes',[cause]]]);
});

test('kept order: a caught external call may write a script binding a local write reads',()=>{
 const fixture=escapePrograms.get('escape-free-caught-beside-local-write'),model=generate(fixture),order=model.lines.map(line=>line.id);
 const at=code=>model.lines.findIndex(line=>line.code.trim()===code),[row]=order.splice(at('y = g;'),1);
 order.splice(at('a.safeShout();'),0,row);
 // The oracle's record() writes no binding, so this conservative order is a gap, never unsound.
 const result=createClassifier(fixture,model).classify(order);
 assert.deepEqual([result.kind,result.causes],['gap',['external-call-order']]);
});
