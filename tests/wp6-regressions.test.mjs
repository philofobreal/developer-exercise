/** WP6 reproductions of the defects found after ADR-008, pinned at generator
 * level: each wrong order used to be accepted and is now rejected, and each
 * legal order the fix (or the corrected contract) admits is accepted. The
 * same fixtures run against the policy oracle in semantic-corpus.test.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {corpus} from './fixtures/ordering-corpus.mjs';
import {createOracle,codesOf} from './support/semantic-oracle.mjs';

const range=(from,to)=>Array.from({length:to-from+1},(_,i)=>from+i);
function verdicts(id,orders){
 const fixture=corpus.get(id),model=generateCodeLineExercise({source:fixture.source.join('\n'),language:fixture.language},ts);
 const compiled=compileCodeLineExercise(model);assert.ok(!compiled.status,compiled.message);
 const judge=createOracle(fixture);
 return orders.map(order=>{const lines=codesOf(model,order);return {model:validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines}).status,oracle:judge(lines).ok};});
}
const cases=[
 ['a hoisted function cannot enter a multi-row call','wp6-hoisted-into-continued-call',[[1,2,7,3,4,5,6,8]],[[1,2,3,4,7,5,6,8]]],
 ['a hoisted function cannot enter try/catch or if/else with shared boundaries','wp6-hoisted-into-shared-boundaries',[[1,2,3,14,...range(4,13),15],[...range(1,11),14,12,13,15]],[[...range(1,12),14,13,15]]],
 ['a free method cannot enter a multi-row field initialiser; free members stay free among themselves','wp6-member-into-continued-field',[[1,2,5,3,4,6,...range(7,11)]],[[1,2,3,4,6,5,...range(7,11)]]],
 ['overload signatures and their implementation stay adjacent','wp6-overload-groups',[[1,2,3,7,4,5,6,...range(8,16)],[...range(1,9),...range(13,16),10,11,12]],[]],
 ['a self-referential initializer is not pure','wp6-self-referential-initializer',[[1,2,3,4,5,7,6,...range(8,12)]],[]],
 ['an outer let/const read from another function context is not pure','wp6-outer-binding-before-initialization',[[...range(1,9),11,10,12,13]],[]],
 ['a binding declared in another case clause is not a guaranteed input','wp6-case-clause-binding',[[...range(1,10),12,11,...range(13,19)]],[]],
 ['never-written let/var are const-like coercion operands','wp6-unwritten-let-var',[],[[1,2,3,6,4,5,7,8],[1,2,3,4,6,5,7,8]]],
 ['a let written by a barrier stays a barrier coercion operand','wp6-written-let-coercion',[[...range(1,6),8,7,9,10]],[]],
 ['constructor with parameter properties and declare fields are position-free','ts-fields-declare-parameter-property',[],[[1,5,2,3,4,...range(6,13)],[1,4,2,3,5,...range(6,13)]]],
];
for(const [title,id,rejected,accepted] of cases)test('WP6: '+title,()=>{
 for(const [i,verdict] of verdicts(id,rejected).entries()){assert.equal(verdict.model,'rejected',`${id} ${rejected[i]}`);assert.equal(verdict.oracle,false,`oracle agrees: ${rejected[i]}`);}
 for(const [i,verdict] of verdicts(id,accepted).entries()){assert.equal(verdict.model,'accepted',`${id} ${accepted[i]}`);assert.equal(verdict.oracle,true,`oracle agrees: ${accepted[i]}`);}
});
