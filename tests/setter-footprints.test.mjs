/** ADR-077 (v43): in the [[Set]] class-field mode a field whose name matches a base setter runs that
 * setter. When the setter uses the instance only through plain `this.name` reads and writes (not
 * called, not in a nested function, no accessor of the chain), the field is ordered only with the loose
 * fields whose names the setter reads or writes, not with every loose field. Each verdict is checked
 * against the oracle in both class-field modes and in the ES2015 emit, where the setter really runs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const environments=['strict','es2015','sloppy'];
const fixture=(id,source,language='javascript')=>({id,origin:'adr-077',language,probe:'evaluate()',environments,source});
/** The verdict for moving the row `code` (trimmed) to just after the row `target`. */
function verdict(program,code,target){
 const model=generate(program),order=model.lines.map(line=>line.id),at=text=>order.findIndex(id=>model.lines[id-1].code.trim()===text);
 assert.ok(at(code)>=0&&at(target)>=0,code+' / '+target);
 const [moved]=order.splice(at(code),1);order.splice(at(target)+1,0,moved);
 return createClassifier(program,model).classify(order).kind;
}
const clean=program=>{const row=measureFixture(program,CORPUS_CAPS);assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],program.id);};
/** A base with a setter `f` whose body is `body`, and a derived class with the fields `fields`. */
const program=(id,body,fields,result='[a.f, a.g, a.h]',extra=[])=>fixture(id,[...extra,'class B {','  get f() {','    return this._f;','  }','  set f(value) {',...body.map(row=>'    '+row),'    this._f = value;','  }','}','class A extends B {',...fields.map(row=>'  '+row),'}','function evaluate() {','  const a = new A();','  return '+result+';','}']);

test('the generation rule is v43 or later, v43 introduced by ADR-077 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=43,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v43` \| \[ADR-077\]/);
});

test('the setter reads one field: the setter field meets only that field',()=>{
 const p=program('adr077-reads',["record('set', value, this.g);"],['g = 1;','f = 2;','h = 3;']);
 assert.equal(verdict(p,'h = 3;','g = 1;'),'accepted','h is untouched by the setter');
 assert.equal(verdict(p,'f = 2;','h = 3;'),'accepted');
 assert.equal(verdict(p,'g = 1;','f = 2;'),'justified','the setter reads g');
 clean(p);
});

test('a read meets no read: a copy of the field the setter reads commutes with it',()=>{
 const p=program('adr077-copy',["record('set', value, this.g);"],['g = 1;','h = this.g;','f = 2;']);
 assert.equal(verdict(p,'h = this.g;','f = 2;'),'accepted');
 clean(p);
});

test('TypeScript: a type-only wrapper around this is the same read',()=>{
 const p=fixture('adr077-ts',['class B {','  get f(): unknown {','    return (this as any)._f;','  }','  set f(value: unknown) {',"    record('set', value, (this as any).g);",'    (this as any)._f = value;','  }','}','class A extends B {','  g = 1;','  f = 2;','  h = 3;','}','function evaluate() {','  const a = new A();','  return [a.f, a.g, a.h];','}'],'typescript');
 assert.equal(verdict(p,'h = 3;','g = 1;'),'accepted');
 assert.equal(verdict(p,'g = 1;','f = 2;'),'justified');
 clean(p);
});

test('the setter writes a field: a later loose field of that name stays after it',()=>{
 const p=program('adr077-write',['this.h = value;'],['g = 1;','f = 2;','h = 3;']);
 assert.equal(verdict(p,'f = 2;','h = 3;'),'justified','the loose h would be overwritten');
 assert.equal(verdict(p,'g = 1;','f = 2;'),'accepted');
 clean(p);
});

test('compound and destructuring targets are writes too',()=>{
 const compound=program('adr077-compound',['this.h += 1;'],['g = 1;','f = 2;','h = 3;']);
 assert.equal(verdict(compound,'f = 2;','h = 3;'),'justified');
 clean(compound);
 const pattern=program('adr077-pattern',['[this.h] = [value];'],['g = 1;','f = 2;','h = 3;']);
 assert.equal(verdict(pattern,'f = 2;','h = 3;'),'justified');
 clean(pattern);
});

test('a method called on this may touch anything: the order is kept',()=>{
 const p=program('adr077-method',['this.peek();'],['g = 1;','f = 2;','h = 3;'],'[a.f, a.g, a.h]',[]);
 p.source.splice(p.source.indexOf('  set f(value) {'),0,'  peek() {',"    record('peek', this.h);",'  }');
 assert.equal(verdict(p,'f = 2;','h = 3;'),'justified');
 clean(p);
});

test('a closure over this escapes: the order is kept',()=>{
 const p=program('adr077-closure',['call(() => this.h);'],['g = 1;','f = 2;','h = 3;'],'[a.f, a.g, a.h]',['function call(fn) {',"  record('call', fn());",'}']);
 assert.equal(verdict(p,'f = 2;','h = 3;'),'justified');
 clean(p);
});

test('a base getter read by the setter runs code: the order is kept',()=>{
 const p=program('adr077-getter',["record('set', value, this.k);"],['g = 1;','f = 2;','h = 3;']);
 p.source.splice(p.source.indexOf('  set f(value) {'),0,'  get k() {','    return this.h;','  }');
 assert.equal(verdict(p,'f = 2;','h = 3;'),'justified');
 clean(p);
});
