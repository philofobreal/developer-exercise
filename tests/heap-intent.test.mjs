/** ADR-080: measurement of NY-19. An equivalent order the generator rejects keeps the reference's
 * intent (`heap`) when it behaves differently once every object the reference creates is observed at
 * the end: a write to an object that is later dropped counts as if it were observed, as policy A counts
 * code that never runs as if it ran (ADR-043, ADR-071). A rejection that no object state tells apart
 * stays a gap. Only the measurement changes; the generator does not. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {observedHeap,HEAP_HELPERS} from './support/heap-variant.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';
import {PROGRAM_KINDS} from './support/fixture-catalog.mjs';
import {corpus} from './fixtures/ordering-corpus.mjs';

test('the variant wraps every created object on its own rows and leaves destructuring targets alone',()=>{
 const rows=['const box = {items: [1]};','let a, b;','[a, b] = [box, new Map()];','({a} = {a: 2});','for (const [k] of [[1]]) a = k;'];
 const variant=observedHeap(rows,'javascript');
 assert.equal(variant.length,rows.length);
 assert.deepEqual(variant,['const box = __keep({items: __keep([1])});','let a, b;','[a, b] = __keep([box, __keep(new Map())]);','({a} = __keep({a: 2}));','for (const [k] of __keep([__keep([1])])) a = k;']);
 assert.equal(observedHeap(['const n = 1;'],'javascript'),null,'nothing created, no variant');
 assert.equal(HEAP_HELPERS.length,2);
});

test('NY-19: the writes to a dropped array keep their order as intent, not as a gap',()=>{
 for(const language of ['javascript','typescript']){
  const program=PROGRAM_KINDS.object(7,{language}),model=generate(program),classifier=createClassifier(program,model);
  const order=model.lines.map(line=>line.id),at=text=>order.findIndex(id=>model.lines[id-1].code.trim()===text);
  const [moved]=order.splice(at("a.note('n2');"),1);order.splice(at("a.note('n3');")+1,0,moved);
  assert.deepEqual([classifier.classify(order).kind,classifier.classify(order).reason],['intent','heap'],language);
 }
});

test('a rejection that no object state tells apart stays a gap',()=>{
 const program=corpus.get('wp6-sealed-continued-callback'),row=measureFixture(program,CORPUS_CAPS);
 assert.equal(row.gaps.length,1,'the seal of a `});` call (ADR-066) is still a gap');
 assert.equal(createClassifier(program,generate(program)).classify(row.gaps[0]).kind,'gap');
});
