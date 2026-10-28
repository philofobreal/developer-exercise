/** G1.4: the author analysis has an explicit time and memory budget at the input limit
 * (500 rows, generator.mjs). Each case runs in a fresh process so the heap figure is its own.
 * Measured 2026-10-28: service-436 0.13 s / 14 MiB, objects-500 1.27 s / 111 MiB, flat-500
 * 0.74 s / 85 MiB. The budget leaves headroom for loaded CI and stays within the server's
 * 10 s request timeout (http.mjs). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {budgetCases} from './support/author-budget-probe.mjs';
const BUDGET={ms:10_000,heapMiB:400};
for(const name of Object.keys(budgetCases))test(`author analysis budget: ${name}`,()=>{
 const output=execFileSync(process.execPath,['--expose-gc','tests/support/author-budget-probe.mjs',name],{encoding:'utf8',timeout:60_000});
 const result=JSON.parse(output.trim().split('\n').at(-1));
 console.log(`author budget ${name}: ${result.lines} rows, ${result.ms} ms, +${result.heapMiB} MiB heap`);
 assert.ok(result.lines>=436);
 assert.ok(result.ms<=BUDGET.ms,`${result.ms} ms exceeds ${BUDGET.ms} ms`);
 assert.ok(result.heapMiB<=BUDGET.heapMiB,`${result.heapMiB} MiB exceeds ${BUDGET.heapMiB} MiB`);
});
