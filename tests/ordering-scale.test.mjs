/** WP6 regression guard for large references (author tooling, never executed).
 * Deterministic bounds: every shape is accepted in reference order, the reduced
 * graph stays linear in the row count and the reference needs about one search
 * state per row. The time bound is deliberately loose (machine load); the exact
 * timings are reported by `node tests/ordering-metrics.mjs`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {largeReferences,measureLarge} from './support/ordering-metrics.mjs';

for(const [shape,source] of Object.entries(largeReferences()))test('large reference: '+shape,t=>{
 const row=measureLarge(shape,source,{repeats:1});
 assert.ok(row.rows>=495&&row.rows<=500,String(row.rows));
 assert.ok(row.edges<=2*row.rows,`edges ${row.edges}`);
 assert.equal(row.redundant,0);
 assert.ok(row.referenceStates<=row.rows+2,`states ${row.referenceStates}`);
 assert.ok(row.generationMs<5000,`generation ${row.generationMs} ms`);
 t.diagnostic(JSON.stringify(row));
});
