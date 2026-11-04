/** ADR-074 (NY-21): the campaign's `inherit` kind generates base classes with accessors that a derived
 * class's fields may meet. Its point is the hazard ADR-073 fixed: a base setter named like a derived
 * field with a literal initialiser, recording another derived field, whose order TypeScript's [[Set]]
 * field mode makes observable. v38 accepted 33 such orders in 3 of 12 TypeScript seeds; this file pins
 * that the kind keeps producing the shape and that the current rules accept none of them. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {PROGRAM_KINDS} from './support/fixture-catalog.mjs';
import {measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';

/** A base setter named like a derived field whose initialiser is a literal. */
const hazard=program=>{
 const source=program.source.join('\n'),setters=[...source.matchAll(/^  set (\w+)\(/gm)].map(match=>match[1]);
 return setters.some(name=>new RegExp(`^  ${name} = \\d+;$`,'m').test(source));
};

test('the generation rule is v40 or later, v40 introduced by ADR-074 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=40,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v40` \| \[ADR-074\]/);
});

test('the inherit kind is in the campaign and produces the setter hazard in most seeds',()=>{
 assert.ok(PROGRAM_KINDS.inherit,'the kind is registered');
 for(const language of ['javascript','typescript']){
  const seeds=Array.from({length:12},(_,index)=>PROGRAM_KINDS.inherit(index+1,{language}));
  assert.ok(seeds.filter(hazard).length>=6,`${language}: the hazard in at least half of the seeds`);
  assert.ok(seeds.every(program=>/^class Item\d+ extends Base\d+ \{$/m.test(program.source.join('\n'))),'every program inherits');
 }
});

test('a TypeScript hazard program: no accepted order behaves differently in either field mode',()=>{
 const program=PROGRAM_KINDS.inherit(1,{language:'typescript'});
 assert.ok(hazard(program),'seed 1 holds the hazard (v38 accepted 11 wrong orders here)');
 const row=measureFixture(program,CORPUS_CAPS);
 assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0]);
});
