/** WP5 corpus regression: the generator against the independent policy oracle.
 * Execution happens ONLY on the fixed fixtures of tests/fixtures/ordering-corpus.mjs.
 * Soundness is absolute: no accepted arrangement may violate the policy.
 * Completeness is pinned per fixture in ordering-baseline.json, so both a
 * regression (more gaps) and an improvement (fewer gaps) need a reviewed update
 * via `node tests/ordering-metrics.mjs --baseline`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {corpus} from './fixtures/ordering-corpus.mjs';
import {measureFixture,generate,CORPUS_CAPS,pinned} from './support/ordering-metrics.mjs';

const baseline=JSON.parse(await readFile(new URL('./fixtures/ordering-baseline.json',import.meta.url),'utf8'));

test('the pinned baseline covers exactly the corpus',()=>assert.deepEqual(Object.keys(baseline).sort(),[...corpus.keys()].sort()));
// Negative control: a deliberately unsound model (every ordering edge removed)
// must be caught, with a shrunk counterexample, so the suite cannot pass blindly.
for(const id of ['ch-aliasing','ch-unknown-calls','ch-ts-class-declarations'])test('negative control: an edge-free model of '+id+' is reported as unsound',()=>{
 const fixture=corpus.get(id),model=generate(fixture);
 for(const line of model.lines)line.dependencies=[];model.edges=[];
 const row=measureFixture(fixture,{...CORPUS_CAPS,model});
 assert.ok(row.unsound>0,'injected unsoundness was not detected');
 assert.ok(row.counterexamples.length>0&&row.counterexamples[0].order.length===model.lines.length);
});
for(const fixture of corpus.values())test(`korpusz (${fixture.origin}, ${fixture.language}): ${fixture.id}`,t=>{
 const row=measureFixture(fixture,CORPUS_CAPS);
 // Categories are reported separately; none may silently become "accepted" or "rejected".
 assert.equal(row.unsound,0,'SOUNDNESS: minimal counterexamples '+JSON.stringify(row.counterexamples));
 assert.equal(row.undecidedAccepted,0,'accepted but oracle undecided');
 assert.equal(row.undecided,0,'oracle undecided in the neighbourhood');
 assert.equal(row.indeterminate,0,'validator budget exhausted');
 assert.deepEqual(pinned(row),baseline[fixture.id],'completeness changed; review and run node tests/ordering-metrics.mjs --baseline');
 t.diagnostic(`${row.orders}${row.ordersExhaustive?'':' sampled'} accepted orders, ${row.accepted}/${row.neighbours} neighbours accepted, ${row.completenessGaps} completeness gaps`+(row.gaps.length?' e.g. '+JSON.stringify(row.gaps[0]):''));
});
