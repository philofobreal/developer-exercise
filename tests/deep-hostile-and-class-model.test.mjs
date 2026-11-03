/** ADR-069 (v35): the parametric programs get a deep hostile input (every read, write, key listing,
 * iteration and conversion recorded, conversions numbered), and the own-object model accepts
 * classes with numeric method names and duplicate methods, where the later definition is the one
 * a call runs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';
import {PROGRAM_KINDS} from './support/fixture-catalog.mjs';

const fixture=(id,source)=>({id,origin:'adr-069',language:'javascript',probe:'run()',source});
const at=(model,code)=>model.lines.findIndex(line=>line.code.trim()===code);
/** Source order with the rows `first` and `second` (by code) swapped. */
function swap(model,first,second){const order=model.lines.map(line=>line.id),i=at(model,first),j=at(model,second);[order[i],order[j]]=[order[j],order[i]];return order;}
const clean=program=>{const row=measureFixture(program,CORPUS_CAPS);assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],program.id);};

test('the generation rule is v35 or later, v35 introduced by ADR-069 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=35,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v35` \| \[ADR-069\]/);
});

test('the deep hostile input shows the order of two conversions the any contract keeps',()=>{
 const program=PROGRAM_KINDS.param(6,{language:'javascript'}),model=generate(program);
 assert.ok(program.probes.some(probe=>probe.includes('Symbol.toPrimitive')),'the deep probe is generated');
 const result=createClassifier(program,model).classify(swap(model,'const c2 = c0 + c1;',"const c3 = data.b + '3';"));
 assert.equal(result.kind,'justified',JSON.stringify(result));
 assert.equal(PROGRAM_KINDS.param(6,{language:'javascript',inputs:'valid'}).probes.some(probe=>probe.includes('Symbol.toPrimitive')),false,'the valid contract promises plain data');
});

test('a class with a numeric method name and duplicate methods is an own object again',()=>{
 const program=fixture('adr069-own-classes',['class Item {',"  0() { return 'i0'; }",'}','function run() {','  class Local {',"    d() { return 'first'; }","    static g = record('g') ?? 3;","    d() { return 'second'; }",'  }','  const item = new Item();','  const local = new Local();','  return [item[0](), local.d(), Local.g];','}']);
 const model=generate(program);
 assert.equal(createClassifier(program,model).classify(swap(model,'const item = new Item();','const local = new Local();')).kind,'accepted');
 clean(program);
});

test('a call runs the later of two same-named methods: its write orders the read',()=>{
 const program=fixture('adr069-later-method',['class Box {','  constructor() {','    this.n = 0;','  }','  bump() {','  }','  bump() {','    this.n = this.n + 1;','  }','}','function run() {','  const a = new Box();','  a.bump();','  const seen = a.n;','  return [seen, a.n];','}']);
 const model=generate(program);
 assert.equal(createClassifier(program,model).classify(swap(model,'a.bump();','const seen = a.n;')).kind,'justified');
 clean(program);
});
