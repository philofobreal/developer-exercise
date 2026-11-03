/** ADR-068 (v34): a function declaration's own name binds in the context around it; duplicate
 * method definitions keep only their mutual order; static and `accessor` fields that run no code
 * are loose like instance fields (ADR-029); a pure declaration kept before a barrier that may leave
 * the list early carries its own pedagogical reason, `early-exit-order` (ADR-019). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const fixture=(id,source,language='javascript',probe='run()')=>({id,origin:'adr-068',language,probe,source});
const at=(model,code)=>model.lines.findIndex(line=>line.code.trim()===code);
/** Source order with the `rows` rows starting at the first row `from` (by code) moved before the first row `before`. */
function move(model,from,before,rows=1){
 const order=model.lines.map(line=>line.id),moved=order.splice(at(model,from),rows);
 order.splice(order.indexOf(model.lines[at(model,before)].id),0,...moved);return order;
}
const clean=program=>{const row=measureFixture(program,CORPUS_CAPS);assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],program.id);};

test('the generation rule is v34 or later, v34 introduced by ADR-068 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=34,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v34` \| \[ADR-068\]/);
});

const hoisted=['function run() {','  function helper(input) {',"    return [input, 'h'];",'  }',"  if (helper === helper) {","    record('seen', helper);",'  }','  const kind = typeof helper;','  return [kind];','}'];
test('a pure read of a hoisted function commutes with a barrier: its own name is no nested write',()=>{
 const program=fixture('adr068-function-name',hoisted),model=generate(program);
 const order=move(model,'const kind = typeof helper;','if (helper === helper) {');
 assert.equal(createClassifier(program,model).classify(order).kind,'accepted');
 clean(program);
});
test('a closure that writes the function binding still orders the read',()=>{
 const program=fixture('adr068-function-name-written',[...hoisted.slice(0,4),'  function reset() {','    helper = null;','  }',...hoisted.slice(4)]),model=generate(program);
 assert.equal(createClassifier(program,model).classify(move(model,'const kind = typeof helper;','if (helper === helper) {')).kind,'justified');
 clean(program);
});

const duplicates=['class Item {',"  first = record('first') ?? 1;",'  show() {',"    return 'one';",'  }','  show() {',"    return 'two';",'  }','}','function run() {','  return [new Item().first, new Item().show()];','}'];
test('duplicate methods are definitions: a field crosses them, they keep their own order',()=>{
 const program=fixture('adr068-duplicates',duplicates),model=generate(program),classifier=createClassifier(program,model);
 assert.equal(classifier.classify(move(model,'show() {',"first = record('first') ?? 1;",3)).kind,'accepted');
 // The second definition (rows 6–8) before the first: the later definition wins, so the result differs.
 const order=model.lines.map(line=>line.id),second=order.splice(5,3);order.splice(2,0,...second);
 assert.equal(classifier.classify(order).kind,'justified');
 assert.ok(model.authoring.provenance.some(entry=>entry.code==='duplicate-definition-order'));
 clean(program);
});

const statics=['function run() {','  class Local {',"    static accessor first = 'a';",'    static second = 2;',"    static accessor third = 'c';",'  }','  return [Local.first, Local.second, Local.third];','}'];
test('static and accessor fields that run no code commute unless keys are listed',()=>{
 const program=fixture('adr068-static-loose',statics,'typescript'),model=generate(program);
 assert.equal(createClassifier(program,model).classify(move(model,"static accessor third = 'c';","static accessor first = 'a';")).kind,'accepted');
 clean(program);
 const listed=fixture('adr068-static-listed',[...statics.slice(0,6),'  return Object.keys(Local);','}'],'typescript'),strict=generate(listed);
 assert.notEqual(createClassifier(listed,strict).classify(move(strict,'static second = 2;',"static accessor first = 'a';")).kind,'accepted');
 clean(listed);
});

test('a pure declaration before a possible early exit keeps a pedagogical reason, counted as intent',()=>{
 const program=fixture('adr068-early-exit',['class Box {','  constructor() {','    this.count = 0;','  }','}','function run() {','  const b = new Box();','  const shared = [];','  if (b.count > 0) {',"    throw new Error('stop');",'  }','  shared.push(1);','  return JSON.stringify([b, shared]);','}']),model=generate(program);
 assert.ok(model.authoring.provenance.some(entry=>entry.code==='early-exit-order'));
 const result=createClassifier(program,model).classify(move(model,'if (b.count > 0) {','const shared = [];',3));
 assert.deepEqual([result.kind,result.reason],['intent','policy']);
 clean(program);
});
