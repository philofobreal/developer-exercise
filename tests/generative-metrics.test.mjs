/** Plan phase 3: the generative campaign's mandatory metrics as a regression gate. Seeded
 * random programs (support/generative-metrics.mjs, quick configuration) are counted per kind ×
 * language × policy version × whether the reference threw. Soundness and decidability are
 * absolute; the gap rate (equivalent orders rejected) may not grow in any group. A lower rate
 * is an improvement: re-pin it with `node tests/ordering-campaign.mjs --baseline` and review. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {measureCampaign,QUICK} from './support/generative-metrics.mjs';
import {reasonCode} from '../dist/author/reason-codes.js';

const baseline=JSON.parse(await readFile(new URL('./fixtures/generative-baseline.json',import.meta.url),'utf8'));
const unsound=[];
const {rows}=measureCampaign({...QUICK,onUnsound:found=>unsound.push(found)});
const key=row=>[row.kind,row.language,row.policy,row.throws?'throws':'returns'].join(' ');

test('generative metrics: no accepted order behaves differently, every order is decided',()=>{
 assert.deepEqual(unsound.map(({id,reason,minimal})=>({id,reason,minimal})),[]);
 for(const row of rows)assert.deepEqual([row.unsound,row['undecided-accepted'],row.undecided,row.indeterminate],[0,0,0,0],key(row));
});

test('generative metrics: the pinned groups are exactly the measured ones, throwing references kept apart',()=>{
 assert.deepEqual(rows.map(key).sort(),Object.keys(baseline).sort(),'a new or vanished group needs a reviewed --baseline');
 assert.ok(rows.some(row=>row.throws),'at least one reference that throws is measured separately');
});

test('generative metrics: the gap rate grows in no group',t=>{
 for(const row of rows){
  const pinned=baseline[key(row)];
  assert.ok(row.gapRate<=pinned.gapRate,`${key(row)}: gap rate ${row.gapRate} > pinned ${pinned.gapRate}`);
  if(row.gapRate<pinned.gapRate)t.diagnostic(`${key(row)} improved: ${pinned.gapRate} → ${row.gapRate}; re-pin with --baseline`);
 }
});

test('generative metrics: every gap names its causes, each a registered reason code or the scope',()=>{
 for(const row of rows){
  const causes=Object.entries(row.gapCauses);
  if(row.gap)assert.ok(causes.reduce((sum,[,count])=>sum+count,0)>=row.gap,key(row));
  for(const [code] of causes)assert.ok(code==='scope'||reasonCode(code),`${key(row)}: unregistered cause ${code}`);
  assert.deepEqual(causes.map(([,count])=>count),causes.map(([,count])=>count).sort((a,b)=>b-a),'ranked by count');
 }
});
