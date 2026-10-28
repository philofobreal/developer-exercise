/** ADR-031 (v15): in the body of a constructor of a class without `extends`, `this` is an own object.
 * Independent writes commute; a read after a write, an escape of `this`, a program that lists keys,
 * a derived class and an operation on a parameter keep the order. Each verdict is checked against
 * the independent runtime oracle; the object-footprint suite also checks every accepted move. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {createOracle} from './support/semantic-oracle.mjs';
import {objectFixtures} from './fixtures/object-programs.mjs';

const prepare=id=>{
 const fixture=objectFixtures.get(id),model=generateCodeLineExercise({source:fixture.source.join('\n'),language:fixture.language},ts),{compiled}=compileCodeLineExercise(model);
 const judge=createOracle(fixture),reference=model.lines.map(line=>line.code);
 const swap=(a,b)=>{const lines=[...reference],i=lines.findIndex(line=>line.trim()===a),j=lines.findIndex(line=>line.trim()===b);assert.ok(i>=0&&j>=0,a+' / '+b);[lines[i],lines[j]]=[lines[j],lines[i]];return lines;};
 return {model,swap,check:(lines,accepted,why)=>{
  assert.equal(validateSubmission(compiled,{exerciseId:model.id,revision:model.revision,lines}).status,accepted?'accepted':'rejected',why);
  if(accepted)assert.notEqual(judge(lines).ok,false,'the oracle must agree: '+why);
 }};
};

test('independent constructor writes commute; the policy is v15',()=>{
 const c=prepare('ctor-independent-writes');
 assert.equal(c.model.authoring.dependencyPolicy,'scoped-effect-analysis-v16');
 c.check(c.swap('this.x = x;','this.y = y;'),true,'two fields of this');
 c.check(c.swap('this.x = x;',"this.label = 'p';"),true,'a parameter is only stored');
});

test('a read after a write keeps its order, an unrelated write does not',()=>{
 const c=prepare('ctor-read-after-write');
 c.check(c.swap('this.a = 1;','this.b = this.a + 1;'),false,'b reads a');
 c.check(c.swap('this.b = this.a + 1;','this.c = 3;'),true,'c is unrelated');
});

test('an escaped this, a key-listing program and a derived class stay ordered',()=>{
 const escape=prepare('ctor-escape');
 escape.check(escape.swap('this.b = 2;','this.c = 3;'),false,'register(this) hands this to unknown code');
 const listing=prepare('ctor-enumerates');
 listing.check(listing.swap('this.a = 1;','this.b = 2;'),false,'JSON.stringify sees the key order');
 const derived=prepare('ctor-derived');
 derived.check(derived.swap('this.a = 1;','this.b = 2;'),false,'a derived constructor is not analysed');
});

test('a method called on this: its field writes count, unrelated fields stay free',()=>{
 const c=prepare('ctor-method-call');
 c.check(c.swap('this.count = 0;','this.add(5);'),true,'add() touches items only');
 c.check(c.swap('this.items = [];','this.count = 0;'),true,'two fields');
 const moved=c.swap('this.items = [];','this.add(5);');
 c.check(moved,false,'add() needs the items array');
});

test('an operation on a parameter is unknown code; a guard that may throw is the only thrower',()=>{
 const sum=prepare('ctor-parameter-operation');
 sum.check(sum.swap('this.total = a + b;',"this.tag = 't';"),false,'a + b may run valueOf of an outside object');
 const guard=prepare('ctor-guard');
 // The guard spans rows; moving a single write above it is a one-thrower case (ADR-028).
 const lines=guard.model.lines.map(line=>line.code),from=lines.findIndex(line=>line.trim()==='this.extra = 1;'),to=lines.findIndex(line=>line.trim()==="if (value === '') {");
 const [row]=lines.splice(from,1);lines.splice(to,0,row);
 guard.check(lines,true,'the object is dead once the guard throws');
});

test('TypeScript: parameter properties, initialised and uninitialised fields',()=>{
 const c=prepare('ctor-ts-fields');
 c.check(c.swap('this.name = name;','this.balance = 10;'),true,'two different fields');
});
