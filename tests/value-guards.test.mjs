/** ADR-032 (v16): a guard decided by known arguments. Literal arguments flow into constructor and
 * method bodies; `!`, `===`, comparisons, `+`, `.length`, `typeof`, short circuits, conditionals and
 * template literals fold them, and an `if` with a known test runs only the selected branch. A guard
 * that never fires adds no possible throw; one that always fires still does; an unknown argument
 * keeps the guard a possible throw. Each verdict is checked against the runtime oracle. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateCodeLineExercise,DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {createOracle} from './support/semantic-oracle.mjs';
import {objectFixtures} from './fixtures/object-programs.mjs';

const prepare=id=>{
 const fixture=objectFixtures.get(id),model=generateCodeLineExercise({source:fixture.source.join('\n'),language:fixture.language},ts),{compiled}=compileCodeLineExercise(model);
 const judge=createOracle(fixture),reference=model.lines.map(line=>line.code);
 const swap=(a,b)=>{const lines=[...reference],i=lines.findIndex(line=>line.trim()===a),j=lines.findIndex(line=>line.trim()===b);assert.ok(i>=0&&j>=0,a+' / '+b);[lines[i],lines[j]]=[lines[j],lines[i]];return lines;};
 const reasons=(row)=>{const id=model.lines.find(line=>line.code.trim()===row).id;return model.authoring.provenance.filter(p=>p.after===id).map(p=>p.code);};
 return {model,swap,reasons,check:(lines,accepted,why)=>{
  assert.equal(validateSubmission(compiled,{exerciseId:model.id,revision:model.revision,lines}).status,accepted?'accepted':'rejected',why);
  if(accepted)assert.notEqual(judge(lines).ok,false,'the oracle must agree: '+why);
 }};
};

test('guards that literal arguments never fire add no possible throw; the policy is v16',()=>{
 const c=prepare('value-guards-never-throw');
 assert.equal(c.model.authoring.dependencyPolicy,DEPENDENCY_POLICY);
 c.check(c.swap("const first = new Account('a1', 5);","const second = new Account('b2', 0);"),true,'!id, limit < 0 and id.length > 8 are all false');
 c.check(c.swap("first.rename('A');","second.rename(`B${1}`);"),true,"value === '' is false for 'A' and for the template");
 assert.ok(!c.reasons("second.rename(`B${1}`);").includes('may-throw'),'no possible throw remains');
});

test('a guard a literal argument always fires is still a possible throw, and two of them stay ordered',()=>{
 const c=prepare('value-guards-throw');
 c.check(c.swap("const second = new Account('');","const third = new Account(0);"),false,"'' and 0 both throw: which message surfaces depends on the order");
 c.check(c.swap("const first = new Account('a1');","const second = new Account('');"),true,'a1 cannot throw: only one thrower');
});

test('an unknown argument or a field written twice keeps the guard a possible throw',()=>{
 const c=prepare('value-guards-unknown');
 c.check(c.swap('first.rename(b);','second.rename(b);'),false,'b may be empty: an unknown parameter keeps the calls ordered');
 // Each field holds 'x' or the set value (writes are merged per object): both checks may throw,
 // though second.check() never does at run time. A conservative, documented loss.
 const merged=prepare('value-guards-merged');
 merged.check(merged.swap('first.check();','second.check();'),false,'two possible throws');
 assert.ok(merged.reasons('second.check();').includes('may-throw'));
});
