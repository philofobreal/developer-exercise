/** ADR-034 (v17): control flow at list level over own objects — if/else if chains, switch,
 * try/catch/finally and for…of over own arrays — gets a footprint, so it commutes with unrelated
 * statements. A loop's body that writes the iterated array, a try without catch around a possible
 * throw, a loop whose local changes per iteration and a labelled jump stay conservative. Each
 * verdict is checked against the runtime oracle; the object-footprint suite checks every
 * accepted single-row move of every fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {createOracle} from './support/semantic-oracle.mjs';
import {objectFixtures} from './fixtures/object-programs.mjs';

const generate=(source,language='javascript')=>generateCodeLineExercise({source,language},ts);
const prepare=id=>{
 const fixture=objectFixtures.get(id),model=generate(fixture.source.join('\n'),fixture.language),{compiled}=compileCodeLineExercise(model);
 const judge=createOracle(fixture),reference=model.lines.map(line=>line.code);
 /** The reference with the single row `row` moved directly before (or after) the row `anchor`. */
 const move=(row,anchor,after=false)=>{const lines=[...reference],from=lines.findIndex(line=>line.trim()===row);assert.ok(from>=0,row);const [x]=lines.splice(from,1);const to=lines.findIndex(line=>line.trim()===anchor);assert.ok(to>=0,anchor);lines.splice(after?to+1:to,0,x);return lines;};
 const reasons=row=>{const id=model.lines.find(line=>line.code.trim()===row).id;return model.authoring.provenance.filter(p=>p.after===id).map(p=>p.code);};
 return {model,move,reasons,check:(lines,accepted,why)=>{
  assert.equal(validateSubmission(compiled,{exerciseId:model.id,revision:model.revision,lines}).status,accepted?'accepted':'rejected',why);
  if(accepted)assert.notEqual(judge(lines).ok,false,'the oracle must agree: '+why);
 }};
};

test('an if/else if/else chain on one object commutes with another object; the policy is v17',()=>{
 const c=prepare('flow-else-if');
 assert.equal(c.model.authoring.dependencyPolicy,'scoped-effect-analysis-v17');
 c.check(c.move('second.activate();',"if (first.name === 'x') {"),true,'the chain only touches first');
 c.check(c.move('second.activate();',"const second = new Item('b');"),false,'a use before its declaration');
});

test('a switch with breaks and a default has a footprint: only the v2 unit seal orders it (JavaScript and TypeScript)',()=>{
 // The case rows form one multi-row unit without blocks of its own; CodeLine v2 seals such a unit
 // against its neighbours (ADR-009, a documented projection loss). No semantic reason remains.
 for(const [id,row,head] of [['flow-switch','second.activate();','switch (first.name) {'],['flow-switch-ts','second.level = 3;','switch (first.state) {']]){
  const c=prepare(id),after=c.model.lines.find(line=>line.code.trim()===row),unit=c.model.lines.find(line=>line.code.trim()===head);
  const between=c.model.authoring.provenance.filter(p=>p.after===after.id&&p.before>=unit.id).map(p=>p.code);
  assert.deepEqual([...new Set(between)],['sealed-unit'],id+': only the unit seal');
 }
});

test('try/catch catches the possible throw; try/finally does not',()=>{
 const c=prepare('flow-try'),lines=c.model.lines.map(line=>line.code);
 // Move the whole try/finally (5 rows) before the try/catch: the catch swallows its throw, so only one may throw.
 const start=lines.findIndex(line=>line.trim()==='second.check();')-1,[block]=[lines.splice(start,5)],at=lines.findIndex(line=>line.trim()==='first.check();')-1;
 assert.deepEqual(block.map(line=>line.trim()),['try {','second.check();','} finally {','second.note();','}']);
 lines.splice(at,0,...block);
 c.check(lines,true,'the try/catch cannot throw: only one possible thrower');
 // The last first.check() and the try/finally may both throw: they stay ordered.
 const last=c.model.lines.findLast(line=>line.code.trim()==='first.check();');
 assert.ok(c.model.authoring.provenance.some(p=>p.after===last.id&&p.code==='may-throw'));
 const swapped=c.model.lines.map(line=>line.code),from=swapped.lastIndexOf(last.code),[row]=swapped.splice(from,1);
 swapped.splice(swapped.findIndex(line=>line.trim()==='second.check();')-1,0,row);
 c.check(swapped,false,'two possible throws');
});

test('for…of over an own array: reads every element; the array writes and other objects order correctly',()=>{
 const c=prepare('flow-for-of');
 c.check(c.move("third.alias = 'C';",'for (const entry of items) {'),true,'third is not in the iterated array');
 c.check(c.move('items.push(third);','for (const entry of items) {'),false,'the loop reads the array the push writes');
});

test('a loop local that changes per iteration keeps no known value: the second-round throw counts',()=>{
 const c=prepare('flow-loop-known-value');
 assert.ok(c.reasons('second.fail();').includes('may-throw'),'run() may throw on its second iteration');
 const lines=c.move('second.fail();','first.run();');
 c.check(lines,false,'two possible throws: which message surfaces depends on the order');
});

test('conservative: a body writing the iterated array, a labelled jump and an early return stay barriers',()=>{
 const shapes={
  'writes the iterated array':['function f() {','  const list = [1];','  const other = [2];','  for (const entry of list) {','    if (list.length < 3) {','      list.push(entry);','    }','  }','  other.push(3);','  return [list, other];','}'],
  'labelled break':['function f() {','  const list = [1];','  const other = [2];','  outer: for (const entry of list) {','    break outer;','  }','  other.push(3);','  return [list, other];','}'],
  'early return':['function f() {','  const list = [1];','  const other = [2];','  for (const entry of list) {','    return entry;','  }','  other.push(3);','  return [list, other];','}']
 };
 for(const [name,source] of Object.entries(shapes)){
  const model=generate(source.join('\n')),push=model.lines.find(line=>line.code.trim()==='other.push(3);');
  const loop=model.lines.find(line=>/for \(const entry of list\)/.test(line.code));
  const ordered=model.authoring.provenance.some(p=>p.after===push.id&&p.before>=loop.id);
  assert.ok(ordered||push.dependencies.some(id=>id>=loop.id),name+': the loop stays ordered before the later write');
 }
});
