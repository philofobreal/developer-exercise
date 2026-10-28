/** ADR-025 (v12): local object footprints. The master prompt's reference case and its
 * counter-examples: statements on provably different objects commute, a stored reference is
 * not a copy, and every real conflict (a shared object, a copy at storage time, store order,
 * a possible throw, unknown code, an alias, use before declaration) keeps its order. Each
 * verdict here is also checked against the independent runtime oracle on the fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {createOracle} from './support/semantic-oracle.mjs';
import {objectFixtures} from './fixtures/object-programs.mjs';

const prepare=fixture=>{
 const model=generateCodeLineExercise({source:fixture.source.join('\n'),language:fixture.language},ts),compiled=compileCodeLineExercise(model);
 assert.ok(!compiled.status,compiled.message);
 const index=new Map(model.lines.map((line,i)=>[line.code.trim(),i]));
 /** The reference order with `row` moved directly before (or after) `anchor`, both named by their text. */
 const move=(row,anchor,after=false)=>{const order=model.lines.map(line=>line.code),from=index.get(row);assert.ok(from!==undefined&&index.has(anchor),row+' / '+anchor);const [line]=order.splice(from,1);const to=order.findIndex(code=>code.trim()===anchor);order.splice(after?to+1:to,0,line);return order;};
 const grade=lines=>validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines},{maxStates:200_000}).status;
 const judge=createOracle(fixture);
 return {model,move,grade,judge};
};
/** Accepted exactly when expected, and the oracle agrees that behaviour is (or is not) kept. */
function expectOrder(context,lines,accepted,why){
 const status=context.grade(lines),verdict=context.judge(lines);
 assert.equal(status,accepted?'accepted':'rejected',why+'\n'+lines.join('\n'));
 if(accepted)assert.notEqual(verdict.ok,false,'the oracle must not see a behaviour change: '+why+' '+(verdict.reason??''));
}

test('prompt reference: a stored reference, a distinct object and the store order',()=>{
 const c=prepare(objectFixtures.get('prompt-store-alias'));
 assert.equal(c.model.authoring.dependencyPolicy,'scoped-effect-analysis-v15');
 expectOrder(c,c.move("store.add(first);","first.alias = 'A';"),true,'the store keeps the reference: the alias may follow the add');
 expectOrder(c,c.move("second.activate();","first.alias = 'A';"),true,'two distinct objects commute');
 expectOrder(c,c.move("const store = new Store();","const first = new Item('a');"),true,'independent constructions commute');
 expectOrder(c,c.move("store.add(second);","store.add(first);"),false,'the store order is observable');
 expectOrder(c,c.move("first.alias = 'A';","return store.list();",true),false,'nothing moves after the return');
 expectOrder(c,c.move("store.add(first);","const first = new Item('a');"),false,'a use before its declaration');
});

test('a store that copies at storage time orders the alias before the add',()=>{
 const c=prepare(objectFixtures.get('prompt-copying-store'));
 expectOrder(c,c.move("store.add(first);","first.alias = 'A';"),false,'the add reads the alias');
 expectOrder(c,c.move("second.activate();","first.alias = 'A';"),true,'still independent of the other object');
});

test('a shared log seen through two objects keeps their writes ordered',()=>{
 const c=prepare(objectFixtures.get('prompt-shared-log'));
 expectOrder(c,c.move("second.note('y');","first.note('x');"),false,'both write the same array');
 expectOrder(c,c.move("second.attach(log);","first.attach(log);"),true,'attaching writes only each logger');
 expectOrder(c,c.move("first.note('x');","first.attach(log);"),false,'a note needs its attached log');
});

test('independent arrays commute, writes to one array keep their order',()=>{
 const c=prepare(objectFixtures.get('prompt-two-arrays'));
 expectOrder(c,c.move("right.push(2);","left.push(1);"),true,'two arrays');
 expectOrder(c,c.move("left.push(3);","left.push(1);"),false,'one array');
});

test('conflicts stay: a possible throw, unknown code and an alias of the same object',()=>{
 const thrown=prepare(objectFixtures.get('prompt-throwing-setters'));
 expectOrder(thrown,thrown.move("second.rename('');","first.alias = '';"),false,'which exception surfaces depends on the order');
 const recorded=prepare(objectFixtures.get('prompt-unknown-call'));
 expectOrder(recorded,recorded.move("second.activate();","first.activate();"),false,'record() is unknown code with a visible trace');
 const aliased=prepare(objectFixtures.get('prompt-alias-binding'));
 expectOrder(aliased,aliased.move("same.alias = 'B';","first.alias = 'A';"),false,'two names, one object');
});

test('TypeScript: parameter properties and private fields behave the same',()=>{
 const c=prepare(objectFixtures.get('prompt-store-alias-ts'));
 expectOrder(c,c.move("store.add(first);","first.alias = 'A';"),true,'reference store in TypeScript');
 expectOrder(c,c.move("store.add(second);","store.add(first);"),false,'store order in TypeScript');
});

test('ADR-028: the runtime master prompt input — independent rows of one block are free',()=>{
 const c=prepare(objectFixtures.get('prompt-mini-fixture'));
 expectOrder(c,c.move("second.activate();",'first.alias = "A";'),true,'two objects; trim() on a string runs no unknown code');
 expectOrder(c,c.move('first.alias = "A";',"first.updateScore(nextScore);",true),true,'two fields of one object');
 expectOrder(c,c.move('first.alias = "A";',"return store.list();"),true,'the alias may cross the if/else on the other object');
 expectOrder(c,c.move("store.add(second);","return store.list();"),true,'the add does not read what the if/else writes');
 expectOrder(c,c.move("const bonus = 5;","const store = new Store<User>();"),true,'a pure constant');
 expectOrder(c,c.move("second.activate();","return store.list();"),false,'the if/else reads the state activate() writes');
 expectOrder(c,c.move("store.add(second);","store.add(first);"),false,'the store order is observable');
 expectOrder(c,c.move('first.alias = "A";',"return store.list();",true),false,'nothing moves after the return');
 expectOrder(c,c.move('first.alias = "A";','const first = new User("u1", "Anna");'),false,'a use before its declaration');
});

/** Every row's required predecessors: dependencies closed with block membership (open → member → close). */
function closedOrder(model){
 const within=(scope,block)=>{for(let s=scope;s;s=model.blocks.find(b=>b.id===s)?.parentScopeId)if(s===block.id)return true;return false;};
 const before=new Map(model.lines.map(line=>[line.id,new Set(line.dependencies)]));
 for(const block of model.blocks)for(const line of model.lines)if(line.id!==block.openLineId&&line.id!==block.closeLineId&&within(line.scopeId,block)){before.get(line.id).add(block.openLineId);before.get(block.closeLineId).add(line.id);}
 const closed=new Map(),walk=id=>{if(!closed.has(id)){const all=new Set();closed.set(id,all);for(const p of before.get(id)){all.add(p);walk(p).forEach(q=>all.add(q));}}return closed.get(id);};
 return Object.fromEntries(model.lines.map(line=>[line.id,[...walk(line.id)].sort((x,y)=>x-y)]));
}

test('ADR-028: the generator orders the master prompt input exactly as the hand-made runtime model',async()=>{
 const {readFile}=await import('node:fs/promises');
 const manual=JSON.parse(await readFile(new URL('../docs/runtime-prompt-mini-fixture.llm.json',import.meta.url),'utf8'));
 const c=prepare(objectFixtures.get('prompt-mini-fixture'));
 assert.deepEqual(c.model.lines.map(line=>line.code),manual.lines.map(line=>line.code));
 assert.deepEqual(closedOrder(c.model),closedOrder(manual),'neither stricter nor looser than the runtime analysis');
});

test('ADR-028: one possible throw commutes with a write that cannot throw; two throws do not',()=>{
 const c=prepare(objectFixtures.get('prompt-one-thrower'));
 expectOrder(c,c.move("second.activate();","first.alias = '';"),true,'second is unobservable once the setter throws');
 expectOrder(c,c.move("const second = new Item('b');","first.alias = '';",true),true,'a construction that cannot throw');
 const both=prepare(objectFixtures.get('prompt-throwing-setters'));
 expectOrder(both,both.move("second.rename('');","first.alias = '';"),false,'which exception surfaces depends on the order');
});

test('ADR-028: key-adding writes and receivers that may not be strings keep their order',()=>{
 const keys=prepare(objectFixtures.get('prompt-new-keys'));
 expectOrder(keys,keys.move("box.c = 3;","box.b = 2;"),false,'the key order is observable');
 // A number has no trim(): the setter is unknown code, so the old barrier order stays.
 const source=['class Item {',"  constructor() { this._alias = ''; this.active = false; }",'  set alias(value) {','    this._alias = value.trim();','  }','  activate() {','    this.active = true;','  }','}',
  'function build() {','  const first = new Item();','  const second = new Item();','  first.alias = 5;','  second.activate();','  return [first, second];','}'].join('\n');
 const model=generateCodeLineExercise({source,language:'javascript'},ts),{compiled}=compileCodeLineExercise(model),lines=model.lines.map(line=>line.code);
 const at=lines.findIndex(line=>line.trim()==='second.activate();'),[moved]=lines.splice(at,1);lines.splice(at-1,0,moved);
 assert.equal(validateSubmission(compiled,{exerciseId:model.id,revision:model.revision,lines}).status,'rejected','trim() on a number throws');
});

test('every fixture: the reference is accepted and every single-row move the model accepts keeps behaviour',()=>{
 for(const fixture of objectFixtures.values()){
  const c=prepare(fixture),reference=c.model.lines.map(line=>line.code);
  assert.equal(c.grade(reference),'accepted',fixture.id);
  for(let from=0;from<reference.length;from++)for(let to=0;to<reference.length;to++){
   if(from===to)continue;
   const order=[...reference],[line]=order.splice(from,1);order.splice(to,0,line);
   if(c.grade(order)==='accepted')assert.notEqual(c.judge(order).ok,false,`${fixture.id}: accepted move ${from}→${to} changes behaviour`);
  }
 }
});

test('generative: seeded object programs — every accepted neighbour and sampled order keeps behaviour',async()=>{
 const {randomObjectProgram}=await import('./support/random-programs.mjs');
 const {neighbourhood,extensions,random,codesOf}=await import('./support/semantic-oracle.mjs');
 const totals={programs:0,orders:0,accepted:0};
 for(const [language,seeds] of [['javascript',10],['typescript',3]])for(let seed=1;seed<=seeds;seed++){
  const fixture=randomObjectProgram(seed,{language}),c=prepare(fixture),reference=c.model.lines.map(line=>line.id),rng=random(seed*31);
  const orders=[...neighbourhood(reference),...Array.from({length:15},()=>extensions(c.model,{limit:1,rng})[0])],seen=new Set();
  totals.programs++;
  for(const order of orders){
   const lines=codesOf(c.model,order),key=lines.join('\n');if(seen.has(key))continue;seen.add(key);totals.orders++;
   if(c.grade(lines)!=='accepted')continue;
   totals.accepted++;
   const verdict=c.judge(lines);
   assert.notEqual(verdict.ok,false,`${fixture.id}: accepted order changes behaviour (${verdict.reason})\n${lines.join('\n')}`);
  }
 }
 assert.ok(totals.accepted>totals.programs,'the footprints do free some orders');
 console.log(JSON.stringify(totals));
});
