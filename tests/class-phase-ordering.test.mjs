/** ADR-012: class evaluation phases and accessor pairs. Each case grades a
 * reordering with the real structural validator and compares it with the
 * reflective oracle (independent parser, vm execution of FIXED fixtures only;
 * TypeScript in both class-field modes). Learners are never involved. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {createOracle,codesOf,blockMoves} from './support/semantic-oracle.mjs';

const range=(from,to)=>Array.from({length:to-from+1},(_,i)=>from+i);
/** Every listed order: [order, expected status, expected oracle verdict]. */
function check(fixture,cases){
 const model=generateCodeLineExercise({source:fixture.source.join('\n'),language:fixture.language},ts),compiled=compileCodeLineExercise(model);
 assert.ok(!compiled.status,compiled.message);
 const judge=createOracle({...fixture,probe:'evaluate()'}),grade=order=>validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:codesOf(model,order)},{maxStates:200_000}).status;
 assert.equal(grade(model.lines.map(line=>line.id)),'accepted');
 for(const [name,order,status,equivalent] of cases){
  assert.equal(grade(order),status,`${fixture.id}: ${name}`);
  assert.equal(judge(codesOf(model,order)).ok,equivalent,`${fixture.id}: ${name} (oracle)`);
 }
 // Soundness over every whole-unit move of the fixture.
 for(const order of blockMoves(model))if(grade(order)==='accepted')assert.notEqual(judge(codesOf(model,order)).ok,false,`${fixture.id}: SOUNDNESS ${order}`);
}

for(const language of ['javascript','typescript'])test(`R1 accessor pair (${language}): one key at the earlier half, free relative to fields`,()=>{
 const typed=language==='typescript';
 check({id:'pair-'+language,language,source:['class Box {',"  size = record('size') ?? 1;",`  get label()${typed?': string':''} { return 'b' + this.size; }`,`  set label(value${typed?': string':''}) { record('label', value); }`,`  area()${typed?': number':''} { return this.size * 2; }`,'}','function evaluate() {',"  const box = new Box();","  box.label = 'n';",'  return [box.label, box.area()];','}']},[
  ['getter and setter swapped',[1,2,4,3,...range(5,11)],'accepted',true],
  ['pair above the field',[1,3,4,2,...range(5,11)],'accepted',true],
  ['method above the pair changes the prototype key order',[1,2,5,3,4,...range(6,11)],'rejected',false],
  // Conservative: the key stays at the getter, but both halves must precede the next key.
  ['setter below the method',[1,2,3,5,4,...range(6,11)],'rejected',true]]);
});

for(const language of ['javascript','typescript'])test(`R2 static and instance phases (${language}): free relative to each other, ordered within`,()=>{
 check({id:'phase-'+language,language,source:['class Counter {',"  count = record('count') ?? 0;","  static created = record('created') ?? 0;",'  step = this.count + 1;','  static sample = new Counter();','  static unit = Counter.created + 1;','}','function evaluate() {','  const counter = new Counter();','  return [counter.step, Counter.unit, Counter.sample.step, Object.keys(counter)];','}']},[
  ['static field above the instance field',[1,3,2,...range(4,11)],'accepted',true],
  // The instance initialisers run inside `new Counter()` of the static phase, whatever their position.
  ['instance fields below the instance-creating static field',[1,3,5,2,4,6,...range(7,11)],'accepted',true],
  ['instance fields after all statics',[1,3,5,6,2,4,...range(7,11)],'accepted',true],
  ['instance fields swapped',[1,4,3,2,...range(5,11)],'rejected',false],
  ['static fields swapped',[1,2,5,4,3,6,...range(7,11)],'rejected',false]]);
});

for(const language of ['javascript','typescript'])test(`R3 computed method keys (${language}): evaluated before every initialiser`,()=>{
 const typed=language==='typescript';
 check({id:'computed-'+language,language,source:['class Keys {',"  value = record('value') ?? 1;",`  [record('first') ?? 'one']()${typed?': string':''} { return 'a'; }`,"  static total = record('total') ?? 2;",`  [record('second') ?? 'two']()${typed?': string':''} { return 'b'; }`,'}','function evaluate() {','  const keys = new Keys();',"  return [keys.value, keys.one(), keys.two(), Keys.total];",'}']},[
  ['computed method above the instance field',[1,3,2,...range(4,10)],'accepted',true],
  ['static field above both computed methods',[1,2,4,3,5,...range(6,10)],'accepted',true],
  ['computed keys swapped',[1,2,5,4,3,...range(6,10)],'rejected',false]]);
});
