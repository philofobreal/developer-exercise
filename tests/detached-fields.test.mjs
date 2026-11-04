/** ADR-076 (v42): a field initialiser that runs code (`f1 = record('f1') ?? 7`) but cannot name the
 * instance under construction cannot observe which loose fields exist yet, unless the instance escaped
 * before it ran. Such a detached field stays ordered with the other code of the class, not with the
 * loose fields. Each negative case lets the instance escape in a different way, and the oracle (both
 * class-field modes, and the ES2015 emit where the case needs it) shows that the order then matters. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const environments=['strict','es2015','sloppy'];
const fixture=(id,language,source,extra={})=>({id,origin:'adr-076',language,probe:'evaluate()',environments,source,...extra});
/** The verdict for moving the row `code` (trimmed) to just after the row `target`. */
function verdict(program,code,target){
 const model=generate(program),order=model.lines.map(line=>line.id),at=text=>order.findIndex(id=>model.lines[id-1].code.trim()===text);
 assert.ok(at(code)>=0&&at(target)>=0,code+' / '+target);
 const [moved]=order.splice(at(code),1);order.splice(at(target)+1,0,moved);
 return createClassifier(program,model).classify(order).kind;
}
const clean=program=>{const row=measureFixture(program,CORPUS_CAPS);assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],program.id);};
const evaluate=['function evaluate() {','  const a = new A();','  return [a.f0, a.f1, a.f2];','}'];

test('the generation rule is v42 or later, v42 introduced by ADR-076 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=42,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v42` \| \[ADR-076\]/);
});

test('an initialiser that cannot name the instance commutes with the loose fields, in both languages',()=>{
 for(const language of ['javascript','typescript']){
  const program=fixture('adr076-detached-'+language,language,['class B {','}','class A extends B {','  f0 = 1;',"  f1 = record('f1') ?? 7;",'  f2 = 3;','}',...evaluate]);
  assert.equal(verdict(program,'f0 = 1;',"f1 = record('f1') ?? 7;"),'accepted',language);
  assert.equal(verdict(program,"f1 = record('f1') ?? 7;",'f2 = 3;'),'accepted',language);
  clean(program);
 }
});

test('a base constructor lets the instance escape: the order is kept',()=>{
 const program=fixture('adr076-base-constructor','javascript',['let seen = null;','class B {','  constructor() {','    seen = this;','  }','}','class A extends B {','  f0 = 1;',"  f1 = record('f1', seen.f2) ?? 7;",'  f2 = 3;','}',...evaluate]);
 assert.equal(verdict(program,"f1 = record('f1', seen.f2) ?? 7;",'f2 = 3;'),'justified');
 clean(program);
});

test('an earlier own field lets the instance escape: the order is kept',()=>{
 const program=fixture('adr076-earlier-field','javascript',['let seen = null;','function keep(o) {','  seen = o;','  return 0;','}','class A {','  f0 = keep(this);',"  f1 = record('f1', seen.f2) ?? 7;",'  f2 = 3;','}',...evaluate]);
 assert.equal(verdict(program,"f1 = record('f1', seen.f2) ?? 7;",'f2 = 3;'),'justified');
 clean(program);
});

test('a closure over this names the instance: the order is kept',()=>{
 const program=fixture('adr076-closure','javascript',['function call(fn) {','  return fn();','}','class A {','  f0 = 1;','  f1 = call(() => this.f2) ?? 7;','  f2 = 3;','}',...evaluate]);
 assert.equal(verdict(program,'f1 = call(() => this.f2) ?? 7;','f2 = 3;'),'justified');
 clean(program);
});

test('[[Set]]: a base field assignment runs an own setter; only the define setting frees the order',()=>{
 const source=['let seen = null;','class B {','  g = 1;','}','class A extends B {','  set g(value) {','    seen = this;','  }','  f0 = 1;',"  f1 = record('f1', seen && seen.f2) ?? 7;",'  f2 = 3;','}',...evaluate];
 const either=fixture('adr076-set-either','javascript',source),define=fixture('adr076-set-define','javascript',source,{classFields:'define'});
 assert.equal(verdict(either,"f1 = record('f1', seen && seen.f2) ?? 7;",'f2 = 3;'),'justified','the ES2015 emit assigns g and runs the setter');
 assert.equal(verdict(define,"f1 = record('f1', seen && seen.f2) ?? 7;",'f2 = 3;'),'accepted');
 clean(either);clean(define);
});

test('a TypeScript parameter property is an assignment that may run a base setter: the order is kept',()=>{
 const program=fixture('adr076-parameter-property','typescript',['let seen: any = null;','class B {','  set c(value: number) {','    seen = this;','  }','}','class A extends B {','  f0 = 1;',"  f1 = record('f1', seen && seen.f2) ?? 7;",'  f2 = 3;','  constructor(public c: number = 1) {','    super();','  }','}',...evaluate]);
 assert.equal(verdict(program,"f1 = record('f1', seen && seen.f2) ?? 7;",'f2 = 3;'),'justified');
 clean(program);
});
