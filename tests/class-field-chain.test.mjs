/** ADR-073 (v39): TypeScript's [[Set]] class-field mode assigns a field, which runs a setter of that
 * name on the prototype chain; a loose field is free only when no base can define its name. A field
 * that copies an earlier own data field (`f7 = this.f5`) runs no code either and follows only that
 * field. A default parameter is evaluated when its argument is missing, so a class whose constructor
 * has one stays in the object model. Each verdict is checked against the oracle, which runs both
 * class-field modes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const fixture=(id,source,probe='evaluate()')=>({id,origin:'adr-073',language:'typescript',probe,source});
/** The verdict for moving the row `code` (trimmed) to just after the row `target`. */
function verdict(program,code,target){
 const model=generate(program),order=model.lines.map(line=>line.id),at=text=>order.findIndex(id=>model.lines[id-1].code.trim()===text);
 const [moved]=order.splice(at(code),1);order.splice(at(target)+1,0,moved);
 return createClassifier(program,model).classify(order).kind;
}
const clean=program=>{const row=measureFixture(program,CORPUS_CAPS);assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],program.id);};
const evaluate=['function evaluate() {','  const a = new A();','  return [a.g, a.f5];','}'];

test('the generation rule is v39 or later, v39 introduced by ADR-073 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=39,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v39` \| \[ADR-073\]/);
});

test('a base setter of the field name runs on assignment: the loose fields keep their order',()=>{
 const program=fixture('adr073-setter',['class B {','  set f5(value: number) {',"    record('set', (this as any).g);",'  }','}','class A extends B {','  f5 = 6;','  g = 7;','}',...evaluate]);
 assert.equal(verdict(program,'f5 = 6;','g = 7;'),'justified');
 clean(program);
});

test('no base defines the names: the loose fields commute',()=>{
 const program=fixture('adr073-free',['class B {','  h = 1;','}','class A extends B {','  f5 = 6;','  g = 7;','}',...evaluate]);
 assert.equal(verdict(program,'f5 = 6;','g = 7;'),'accepted');
 clean(program);
});

test('a base method, field or computed method is a writable data property: the loose fields commute',()=>{
 const program=fixture('adr073-data',['class B {','  f5(): number {','    return 1;','  }','  g = 2;',"  [record('k') ?? 'k'](): string {","    return 'k';",'  }','}','class A extends B {','  f5 = 6;','  g = 7;','}',...evaluate]);
 assert.equal(verdict(program,'f5 = 6;','g = 7;'),'accepted');
 clean(program);
});

test('a copy of an earlier own data field follows only that field',()=>{
 const program=fixture('adr073-copy',['class A {','  #h = 4;','  f5 = 6;','  f7 = this.f5;','  get h(): number {','    return this.#h;','  }','}','function evaluate() {','  const a = new A();','  return [a.f7, a.h];','}']);
 assert.equal(verdict(program,'#h = 4;','f7 = this.f5;'),'accepted');
 assert.equal(verdict(program,'f5 = 6;','f7 = this.f5;'),'justified','before f5 the copy reads undefined');
 clean(program);
});

test('a base accessor of the copied name may run code: the copy keeps its order',()=>{
 const program=fixture('adr073-copy-accessor',['class B {','  get f5(): number {',"    return (this as any).g ?? 0;",'  }','  set f5(value: number) {','  }','}','class A extends B {','  g = 7;','  f5 = 6;','  f7 = this.f5;','}','function evaluate() {','  const a = new A();','  return [a.f7];','}']);
 assert.notEqual(verdict(program,'g = 7;','f7 = this.f5;'),'accepted');
 clean(program);
});

test('a default parameter keeps the class in the object model: two such objects commute',()=>{
 const program=fixture('adr073-default',['class Item {','  log: string[] = [];','  constructor(readonly c: number = 4) {','  }','  note(text: string): void {','    this.log.push(text + this.c);','  }','}','function evaluate() {','  const a = new Item();','  const b = new Item(2);',"  a.note('x');","  b.note('y');",'  return [a, b];','}']);
 assert.equal(verdict(program,"a.note('x');","b.note('y');"),'accepted');
 clean(program);
});
