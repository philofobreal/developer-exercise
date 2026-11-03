/** ADR-060 (v31): the textual key-observation patterns (ADR-020, ADR-029) no longer match names that
 * cannot reach a built-in or the global object: comments, the program's own declarations, references
 * to its own variables named like a property-only API, and properties of its own instances. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {DEPENDENCY_POLICY,generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {enumeratesKeys,observesKeyOrder} from '../dist/author/js-ts-ordering.js';
import {measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';

const file=source=>ts.createSourceFile('x.js',Array.isArray(source)?source.join('\n'):source,ts.ScriptTarget.Latest,true);
const lists=source=>enumeratesKeys(file(source),ts);
const reflects=source=>observesKeyOrder(file(source),ts);

test('the generation rule is v31 or later, v31 introduced by ADR-060 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=31,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v31` \| \[ADR-060\]/);
});

const ledger=['class Ledger {','  constructor(owner) {','    this.owner = owner;','    this.balance = 0;','    this.entries = [];','  }','  add(amount) {','    this.entries.push(amount);','  }','}','function evaluate() {',"  const ledger = new Ledger('Bea');",'  ledger.add(5);','  return [ledger.balance, ledger.entries];','}'];
test('a field, a local and a comment named like a key listing are the program\'s own',()=>{
 assert.equal(lists(ledger),false);
 assert.equal(lists(['function f() {','  const values = [];','  values.push(1);','  return values;','}']),false);
 assert.equal(lists(['// Object.keys would list them','function f(o) { return o.a; }']),false);
 assert.equal(lists(['const point = { keys: 1, entries: 2 };','function f() { return point.keys; }']),true,'point is a literal, not a class instance: its property stays textual');
 assert.equal(reflects(['class Box {','  constructor() { this.self = 1; this.frames = []; }','  size() { return this.frames.length; }','}']),false);
});

test('the swapped field writes of the ledger are accepted and sound',()=>{
 const model=generateCodeLineExercise({source:ledger.join('\n'),language:'javascript'},ts),compiled=compileCodeLineExercise(model);
 const swapped=[1,2,4,3,5,...ledger.slice(5).map((_,i)=>i+6)].map(row=>ledger[row-1]);
 assert.equal(validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:swapped}).status,'accepted');
 const row=measureFixture({id:'adr-060-ledger',origin:'witness',language:'javascript',probe:'evaluate()',source:ledger},CORPUS_CAPS);
 assert.equal(row.unsound,0,JSON.stringify(row.counterexamples));
});

test('everything that may reach the built-in still counts',()=>{
 assert.equal(lists(['function f(o) { return Object.entries(o); }']),true,'a property of Object');
 assert.equal(lists(["function f(o) { return o['entries']; }"]),true,'a string');
 assert.equal(lists(['function f(o) { const { entries } = o; return entries; }']),true,'a destructured property');
 assert.equal(lists(['function f(o) { return o.entries(); }']),true,'a property of an unknown value');
 assert.equal(lists(['function f(o) { with (o) { return entries(); } }']),true,'with');
 assert.equal(lists([...ledger,'Ledger.prototype.add.call(Object, 1);']),true,'a method rebound by call');
 assert.equal(lists([...ledger,'const add = new Ledger(1).add;']),true,'a method read without a call');
 const returning=ledger.map(line=>line==='    this.entries = [];'?'    this.entries = [];\n    return Object;':line);
 assert.equal(lists(returning),true,'a constructor that returns another object');
 assert.equal(lists(['class C { list() { return this.entries; } }','const entries = 1;','const c = new C();','function g() { const c = Object; return c.entries; }']),true,'a name declared twice');
});
