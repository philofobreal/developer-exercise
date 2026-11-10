/** ADR-078 (v44): the rest of the inherit gaps. A string-literal computed name is that key; a getter and
 * a setter beside fields of their name still form one property; a getter and a setter next to each other
 * in a same-key chain merge in either order; what an access runs on the instance is the getter or setter
 * the definitions leave last, analysed in turn (also for field initialisers); a private field is loose
 * even when the program lists keys. Every verdict is checked against the oracle in both class-field modes
 * and in the ES2015 emit, and every program has 0 unsound orders. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const environments=['strict','es2015','sloppy'];
// NY-36 (v56, ADR-130): these classes are script globals, which a caller may instantiate and list; the mechanism here
// is what field code runs, checked where no one lists keys („Nem számít”).
const fixture=(id,source,language='javascript')=>({id,origin:'adr-078',language,probe:'evaluate()',environments,keyOrder:'ignored',source});
/** The verdict for moving the row `code` (trimmed) to just after the row `target`; a one-row member moves whole. */
function verdict(program,code,target){
 const model=generate(program),order=model.lines.map(line=>line.id),at=text=>order.findIndex(id=>model.lines[id-1].code.trim()===text);
 assert.ok(at(code)>=0&&at(target)>=0,code+' / '+target);
 const [moved]=order.splice(at(code),1);order.splice(at(target)+1,0,moved);
 return createClassifier(program,model).classify(order).kind;
}
const clean=program=>{const row=measureFixture(program,CORPUS_CAPS);assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],program.id);};

test('the generation rule is v44 or later, v44 introduced by ADR-078 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=44,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v44` \| \[ADR-078\]/);
});

test('a string-literal computed name is a plain key; another computed key is still evaluated in order',()=>{
 const p=fixture('adr078-literal-key',['class A {',"  get ['k1']() { return 1; }","  get ['k2']() { return 2; }",'}','function evaluate() {','  const a = new A();',"  return [a['k1'], a['k2']];",'}']);
 assert.equal(verdict(p,"get ['k1']() { return 1; }","get ['k2']() { return 2; }"),'accepted');
 clean(p);
 const q=fixture('adr078-evaluated-key',['class A {',"  [record('k1') ?? 'k1']() { return 1; }","  [record('k2') ?? 'k2']() { return 2; }",'}','function evaluate() {','  const a = new A();',"  return [a.k1(), a.k2()];",'}']);
 assert.equal(verdict(q,"[record('k1') ?? 'k1']() { return 1; }","[record('k2') ?? 'k2']() { return 2; }"),'justified','the keys are evaluated in order');
 clean(q);
});

test('a getter and a setter beside a field of their name are one property; the field still runs the setter',()=>{
 const p=fixture('adr078-pair-field',['class A {','  get f() { return this._f; }',"  set f(value) { record('set', value, this.g); this._f = value; }",'  f = 1;','  g = 2;','}','function evaluate() {','  const a = new A();','  return [a.f, a.g];','}']);
 assert.equal(verdict(p,'get f() { return this._f; }',"set f(value) { record('set', value, this.g); this._f = value; }"),'accepted','the getter after the setter is the same property');
 assert.equal(verdict(p,'get f() { return this._f; }','g = 2;'),'accepted','a definition is installed before any field runs');
 assert.equal(verdict(p,'f = 1;','g = 2;'),'justified','[[Set]]: the own setter reads g');
 clean(p);
});

test('a getter and a setter next to each other in a same-key chain merge in either order; a later method replaces them',()=>{
 const p=fixture('adr078-chain',['class A {',"  get f() { return 'get'; }","  set f(value) { record('set', value); }","  f() { return 'method'; }",'}','function evaluate() {','  const a = new A();','  return [typeof a.f];','}']);
 assert.equal(verdict(p,"get f() { return 'get'; }","set f(value) { record('set', value); }"),'accepted');
 assert.equal(verdict(p,"f() { return 'method'; }","get f() { return 'get'; }"),'justified','the method no longer comes last');
 clean(p);
});

test('a getter read by an initialiser touches what the getter reads',()=>{
 const p=fixture('adr078-getter',['class B {','  get t() {','    return this.g ?? 0;','  }','}','class A extends B {','  f = this.t;','  g = 1;','  h = 2;','}','function evaluate() {','  const a = new A();','  return [a.f, a.g, a.h];','}']);
 assert.equal(verdict(p,'h = 2;','class A extends B {'),'accepted','the getter does not read h');
 assert.equal(verdict(p,'g = 1;','class A extends B {'),'justified','the getter reads g');
 clean(p);
 const q=fixture('adr078-getter-call',['class B {','  get t() {','    return this.peek();','  }','  peek() {',"    return this.h ?? 0;",'  }','}','class A extends B {','  f = this.t;','  g = 1;','  h = 2;','}','function evaluate() {','  const a = new A();','  return [a.f, a.g, a.h];','}']);
 assert.equal(verdict(q,'h = 2;','class A extends B {'),'justified','a method call on this may read anything');
 clean(q);
});

test('the definition left last decides what an assignment runs',()=>{
 const methodLast=fixture('adr078-method-last',['class B {','  get f() {','    return this._f;','  }','  set f(value) {',"    record('set', value, this.g);",'  }',"  f() { return 'm'; }",'}','class A extends B {','  f = 3;','  g = 4;','}','function evaluate() {','  const a = new A();','  return [a.f, a.g];','}']);
 assert.equal(verdict(methodLast,'f = 3;','g = 4;'),'accepted','the method is a data property: no setter runs');
 clean(methodLast);
 const setterLast=fixture('adr078-setter-last',['class B {',"  f() { return 'm'; }",'  get f() {','    return this._f;','  }','  set f(value) {',"    record('set', value, this.g);",'  }','}','class A extends B {','  f = 3;','  g = 4;','}','function evaluate() {','  const a = new A();','  return [a.f, a.g];','}']);
 assert.equal(verdict(setterLast,'f = 3;','g = 4;'),'justified','[[Set]]: the setter reads g');
 clean(setterLast);
});

test('a private field is loose although the program lists keys; public keys keep their order',()=>{
 // The program lists the keys: „Számít” is what this case is about.
 const p={...fixture('adr078-private',['class A {','  f0 = 4;','  #h = 7;','  f1 = 5;','  get h() {','    return this.#h;','  }','}','function evaluate() {','  const a = new A();','  return [a.h, JSON.stringify(a)];','}']),keyOrder:'observed'};
 assert.equal(verdict(p,'#h = 7;','f1 = 5;'),'accepted');
 assert.equal(verdict(p,'f0 = 4;','f1 = 5;'),'justified','JSON.stringify lists the public keys in order');
 clean(p);
});

test('reading an own private field before it exists throws: the read stays after it',()=>{
 const p=fixture('adr078-private-read',['class A {','  #h = 7;','  f = this.#h;','  g = 1;','}','function evaluate() {','  const a = new A();','  return [a.f, a.g];','}']);
 assert.equal(verdict(p,'#h = 7;','f = this.#h;'),'justified');
 assert.equal(verdict(p,'g = 1;','#h = 7;'),'accepted');
 clean(p);
});

/** ADR-083 (v47): an `accessor` field defines its get/set pair at class definition among the methods, in
 * member order; in a same-key chain it replaces what came before. Its initialiser stays with the fields. */
test('an accessor field is a member of its key\'s definition chain (ADR-083)',async()=>{
 const {readFile}=await import('node:fs/promises'),contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v47` \| \[ADR-083\]/);
 const p=fixture('adr083-accessor-chain',['class B {',"  get f(): unknown { return (this as any)._f ?? 'unset'; }","  set f(value: unknown) { record('set', value); (this as any)._f = value; }","  m(): string { return 'm'; }",'  accessor f = 3;','}','class A extends B {','  f = 4;','  g = 5;','}','function evaluate() {','  const a = new A();','  return [a.f, a.g, a.m()];','}'],'typescript');
 assert.equal(verdict(p,"get f(): unknown { return (this as any)._f ?? 'unset'; }","set f(value: unknown) { record('set', value); (this as any)._f = value; }"),'accepted','the halves merge in either order');
 assert.equal(verdict(p,"m(): string { return 'm'; }",'accessor f = 3;'),'accepted','another key is free of the chain');
 assert.equal(verdict(p,'accessor f = 3;','class B {'),'justified','[[Set]]: a.f = 4 then runs the explicit setter, which records');
 clean(p);
});
