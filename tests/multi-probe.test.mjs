/** Plan 5.1: several probes per fixture and a parametric program kind. A fixed single input can
 * make an order look equivalent that differs on another input; the oracle now runs every probe
 * of a fixture in a fresh context and compares them one by one. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createOracle} from './support/semantic-oracle.mjs';
import {randomParameterProgram} from './support/random-programs.mjs';
import {measureCampaign} from './support/generative-metrics.mjs';

// Two operations on the own array conflict only when the branch runs: on limit 2 it does not.
const source=['function evaluate(data, limit) {','  const out = [];',"  out.push('first');",'  if (limit > 3) {','    out.pop();','  }','  return out;','}'];
const fixture=probes=>({id:'multi',origin:'witness',language:'javascript',source,probe:probes[0],probes});
const swapped=[1,2,4,5,6,3,7,8].map(row=>source[row-1]);
test('a second input shows what the first one hides',()=>{
 assert.equal(createOracle(fixture(['evaluate({}, 2)']))(swapped).ok,true,'on limit 2 the branch never runs');
 const judge=createOracle(fixture(['evaluate({}, 2)','evaluate({}, 10)']));
 assert.deepEqual(judge(swapped),{ok:false,reason:'runtime'});
 assert.deepEqual(judge.referenceValue,['first'],'the first probe gives the reference value');
});

test('the parametric kind: plain inputs under the valid contract, hostile ones too under any',()=>{
 const valid=randomParameterProgram(1,{inputs:'valid'}),any=randomParameterProgram(1,{inputs:'any'});
 // ADR-069: the ninth `any` probe is the deep hostile input.
 assert.equal(valid.probes.length,3);assert.equal(any.probes.length,9);
 assert.ok(any.probes.some(probe=>probe.includes('Symbol.toPrimitive')));
 assert.ok(any.probes.some(probe=>probe.includes('new Proxy'))&&any.probes.some(probe=>probe.includes('null'))&&any.probes.some(probe=>probe.includes('valueOf')));
 assert.ok(!valid.probes.some(probe=>probe.includes('new Proxy')||probe.includes('get a()')));
 assert.deepEqual(any.source,valid.source,'the same program');
});

test('parametric programs are sound under both input contracts',()=>{
 for(const inputs of ['any','valid']){
  const {violations,rows}=measureCampaign({from:1,to:2,kinds:['param'],inputs,samples:6,neighbours:60});
  assert.equal(violations,0,inputs);
  assert.ok(rows.every(row=>row.orders>0),inputs);
 }
});
