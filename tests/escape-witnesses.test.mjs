/** ADR-040 (proposed; plan phase 4, item 2a): witnesses for unknown calls with primitive
 * arguments inside method bodies. The pinned gaps of the `free` program are what item 2b-2c must
 * remove; the `bound` swaps are what the policy keeps and must stay rejected afterwards. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {escapePrograms} from './fixtures/escape-programs.mjs';
import {measureFixture,generate,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

/** The reference order with the rows of codes `first` and `second` exchanged. */
function swapped(model,first,second){
 const id=code=>model.lines.find(line=>line.code.trim()===code).id;
 const [x,y]=[id(first),id(second)];
 return model.lines.map(line=>line.id===x?y:line.id===y?x:line.id);
}

test('every escape witness is sound and decided today',()=>{
 for(const fixture of escapePrograms.values()){
  const row=measureFixture(fixture,CORPUS_CAPS);
  assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],fixture.id);
 }
});

test('pinned target: the free program loses equivalent orders to the unknown call in shout()',()=>{
 const row=measureFixture(escapePrograms.get('escape-free-shout-beside-writes'),CORPUS_CAPS);
 // v18: 11 gaps, 10 of them caused by the ExpressionStatement barrier. Items 2b-2c lower this.
 assert.deepEqual([row.completenessGaps,row.gapCauses.ExpressionStatement],[11,10]);
});

for(const [id,first,second,why] of [
 ['escape-bound-list-level-call',"record('start');",'a.add(1);','a list-level unknown call is external (policy P2)'],
 ['escape-bound-two-shouts','a.shout();','b.shout();','two external calls write the trace in order'],
 ['escape-bound-both-throw','a.check(-1);','a.shout();','both may throw'],
])test(`kept order: ${why}`,()=>{
 const fixture=escapePrograms.get(id),model=generate(fixture),result=createClassifier(fixture,model).classify(swapped(model,first,second));
 assert.equal(result.kind,'justified',JSON.stringify(result));
});
