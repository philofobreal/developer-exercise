/** ADR-058: the oracle's reach witness records which key-listing, reflection and hook APIs the
 * program's own rows call at run time, independently of the generator's name and escape analysis
 * (ADR-052/053) and of the textual rules both share. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {createOracle} from './support/semantic-oracle.mjs';
import {measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';

const box=['class Box {','  constructor() {','    this.a = 1;','    this.b = 2;','  }','}'];
const swapped=source=>[1,2,4,3,...source.slice(4).map((_,i)=>i+5)].map(row=>source[row-1]);
const fixture=(id,source,extra={})=>({id,origin:'witness',language:'javascript',probe:'evaluate()',source,...extra});
const grade=(source,lines,options={})=>{
 const model=generateCodeLineExercise({source:source.join('\n'),language:'javascript',...options},ts),compiled=compileCodeLineExercise(model);
 assert.ok(!compiled.status,compiled.message);
 return validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines}).status;
};

// Copying keys listed through an unspelled name into an object: the textual rules see no key
// listing, so the oracle used to sort the result's keys and called the swap equivalent.
const copy=[...box,'function evaluate() {',"  const list = Object['ke' + 'ys'];",'  const out = {};','  for (const name of list(new Box())) out[name] = 1;','  return out;','}'];
test('a key listing reached through an unspelled name is seen at run time: the copied key order counts',()=>{
 assert.doesNotMatch(copy.join('\n'),/\bkeys\b/);
 const judge=createOracle(fixture('reach-copy',copy));
 assert.deepEqual(judge.reach,{enumerates:true,reflects:false,hooks:false});
 assert.equal(judge.facts.enumerated,true);
 assert.deepEqual(judge(swapped(copy)),{ok:false,reason:'runtime'});
 assert.equal(grade(copy,swapped(copy)),'rejected','the generator orders it too (ADR-053)');
 assert.equal(measureFixture(fixture('reach-copy',copy),CORPUS_CAPS).unsound,0);
});

test('reflection and code built at run time are seen whatever the spelling',()=>{
 const names=[...box,'function evaluate() {',"  const names = Object['getOwn' + 'PropertyNames'];",'  return names(Box.prototype);','}'];
 assert.equal(createOracle(fixture('reach-names',names)).reach.reflects,true);
 const built=[...box,'function evaluate() {','  const make = ({}).constructor.constructor;',"  return make('box', 'return Object.ke' + 'ys(box)')(new Box());",'}'];
 const judge=createOracle(fixture('reach-function',built));
 assert.equal(judge.reach.reflects,true);assert.equal(judge.facts.ordered,true);
 assert.equal(judge(swapped(built)).ok,false);
});

// ADR-050: a getter installed through unspelled names makes a read run code; the oracle then
// judges as for any input, even though the fixture asked for the valid contract.
const hooked=['function evaluate() {',"  const install = Object['define' + 'Property'];","  const target = Object['proto' + 'type'];","  install(target, 'p', { get() { record('p'); return 1; }, configurable: true });","  install(target, 'q', { get() { record('q'); return 2; }, configurable: true });",'  return pair({});','}','function pair(point) {','  const p = point.p;','  const q = point.q;','  return [p, q];','}'];
test('a hook reached through unspelled names voids the valid contract in the oracle as well',()=>{
 const judge=createOracle(fixture('reach-hooked',hooked,{inputs:'valid'}));
 assert.equal(judge.reach.hooks,true);assert.equal(judge.facts.inputs,'any');
 const reads=[1,2,3,4,5,6,7,8,10,9,11,12].map(row=>hooked[row-1]);
 // Under any input the two reads are external effects: P2 orders them before anything runs.
 assert.deepEqual(judge(reads),{ok:false,reason:'effect-order'});
 assert.equal(grade(hooked,reads,{inputs:'valid'}),'rejected');
});

test('the probe is an outside observer: its own key listing is not the program\'s',()=>{
 const judge=createOracle(fixture('reach-probe',box,{probe:'Object.keys(new Box()).sort()'}));
 assert.deepEqual(judge.reach,{enumerates:false,reflects:false,hooks:false});
 assert.equal(judge.facts.enumerated,false);
});

test('the witness changes nothing the program can see',()=>{
 const program=['function evaluate() {','  const local = 2;','  const direct = eval(\'local + 1\');','  const fn = (() => {}).constructor;',"  const proxy = new Proxy({ x: 1 }, {});",'  class List extends Array {}',"  return [direct, fn === Function, Object.keys.name, Object.keys.length, proxy.x, new List(3).length, typeof Symbol(), Symbol.iterator in [], new Function('return 4')() instanceof Object, (new Function('return 4'))()];",'}'];
 assert.equal(JSON.stringify(createOracle(fixture('reach-transparent',program)).referenceValue),JSON.stringify([3,true,'keys',1,1,3,'symbol',true,false,4]));
});

test('a call only a candidate makes is not missed',()=>{
 // The reference calls the plain function; the candidate calls the key listing first. When the
 // static checks pass, judge() hands such a candidate to an oracle that assumes every fact.
 const late=['function evaluate() {','  const o = { b: 1, a: 2 };','  let list = (x) => [];',"  const first = list(o).length;","  list = Object['ke' + 'ys'];",'  return first;','}'];
 const judge=createOracle(fixture('reach-late',late));
 assert.equal(judge.reach.enumerates,false);
 const early=[1,2,3,5,4,6,7].map(row=>late[row-1]);
 assert.equal(judge(early).ok,false);
});
