/** v54 (ADR-128): the property rows of a multi-row object literal of inert values are free of each other, unless the
 *  key order may be observed („Számít” and the object can leave its variable); the row without a trailing comma stays
 *  last. Every freedom is checked by the independent oracle on fixed fixtures (P1 shape with free properties, P3 run).
 *  Also NY-34: the input contract's hook check reads only the code that runs (runtimeText). */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {authorRuleSheet} from '../dist/author/engine.js';
import {runtimeText} from '../dist/author/input-contract.js';
import {measureFixture,generate} from './support/ordering-metrics.mjs';

const model=(source,language,keyOrder)=>generateCodeLineExercise({source,language,keyOrder},ts);
/** The status of the reference with rows (1-based) in `order`. */
function grade(m,order){
 const compiled=compileCodeLineExercise(m);assert.ok(!('status' in compiled));
 return validateSubmission(compiled.compiled,{exerciseId:m.id,revision:m.revision,lines:order.map(row=>m.lines[row-1].code)}).status;
}
const swapped=(length,a,b)=>Array.from({length},(_,i)=>i+1===a?b:i+1===b?a:i+1);
const rules=(m,row)=>authorRuleSheet(m).constraints.filter(rule=>rule.before===row||rule.after===row).map(rule=>`#${rule.before}->#${rule.after} ${rule.reasons.map(reason=>reason.code).join('+')} ${rule.removal}`);

const reported=['interface Person {','    name: string;','    age: number;','}','interface Employee {','    employeeId: number;','}','type Developer = Person & Employee;','const emp: Developer = {','    name: "Alice",','    age: 25,','    employeeId: 12345','};'];

test('the reported source: „Nem számít” frees name and age; the comma-less last row stays last',()=>{
 const m=model([...reported,'console.log(emp);'].join('\n'),'typescript','ignored');
 assert.equal(grade(m,swapped(14,10,11)),'accepted');
 assert.equal(grade(m,swapped(14,11,12)),'rejected','employeeId: 12345 has no comma');
 assert.deepEqual(rules(m,12).filter(rule=>/list-tail/.test(rule)),['#10->#12 list-tail impossible','#11->#12 list-tail impossible']);
 assert.ok(!rules(m,11).some(rule=>/continued-row/.test(rule)),'no row of the literal is a continued row any more');
});

test('the reported source: „Számít” with console.log keeps the order for the key order, a rule the author may lift',()=>{
 const m=model([...reported,'console.log(emp);'].join('\n'),'typescript','observed');
 assert.equal(grade(m,swapped(14,10,11)),'rejected');
 assert.ok(rules(m,11).includes('#10->#11 reflected-key-order policy-override'),rules(m,11).join('; '));
});

test('the reported source: with „Számít” the order is free only when the object never leaves its variable',()=>{
 // At the top level the binding is reachable from outside (an export, another script, a caller): the order stays.
 const top=model([...reported,'const next = emp.age + 1;'].join('\n'),'typescript','observed');
 assert.equal(grade(top,swapped(14,10,11)),'rejected');
 const inner=model(['function make(): number {',...reported.slice(8).map(row=>'  '+row),'  return emp.age + 1;','}'].join('\n'),'typescript','observed');
 assert.equal(grade(inner,swapped(inner.lines.length,3,4)),'accepted',inner.lines.map(line=>line.code).join('\n'));
});

test('the second report: three properties, each with a comma, an unused object: every order of them',()=>{
 const source="const valami = {\n     egy: 'egy',\n     kettő: 'egy',\n     három: 'egy',\n}";
 for(const language of ['javascript','typescript'])for(const keyOrder of ['observed','ignored']){
  const m=model(source,language,keyOrder);
  // „Nem számít” frees them; with „Számít” the top-level object keeps its key order (another script could list it).
  for(const order of [[1,3,2,4,5],[1,4,3,2,5],[1,3,4,2,5],[1,4,2,3,5]])assert.equal(grade(m,order),keyOrder==='ignored'?'accepted':'rejected',`${language} ${keyOrder} ${order}`);
  assert.equal(grade(m,[2,1,3,4,5]),'rejected','a property never leaves the literal');
 }
});

test('what stays as before: a value that runs code, a duplicate key, a shared row, a comment row',()=>{
 const cases=[
  ['const p = {\n  a: f(),\n  b: 2,\n};','a call'],
  ['const p = {\n  a: 1,\n  a: 2,\n};','a duplicate key (the later wins)'],
  ['const p = {\n  a: 1, b: 2,\n  c: 3,\n};','two properties on one row'],
  ['const p = {\n  a: 1,\n  // note\n  b: 2,\n};','a comment row'],
  ['const p = {\n  __proto__: null,\n  b: 2,\n};','__proto__'],
  ['const p = {\n  [k]: 1,\n  b: 2,\n};','a computed key'],
 ];
 for(const [source,why] of cases){
  const m=model('const k = "x";\nfunction f() { return 1; }\n'+source,'javascript','ignored'),row=m.lines.findIndex(line=>line.code.trim().startsWith('const p'))+2;
  assert.equal(grade(m,swapped(m.lines.length,row,row+1)),'rejected',why);
 }
});

// The oracle's fixtures: [id, language, source rows, probe] → expected [accepted neighbours] for observed and ignored.
const literal=rows=>['  const p = {',...rows,'  };'];
const fixtures=[
 ['stringify','javascript',['function make() {',...literal(['    name: "Alice",','    age: 25,','    id: 7']),'  return JSON.stringify(p);','}'],[0,1]],
 ['console-ts','typescript',['function make(): string {',...literal(['    name: "Alice",','    age: 25,','    id: 7,']),'  console.log(p);','  return "ok";','}'],[0,5]],
 ['contained','javascript',['function make() {',...literal(['    name: "Alice",','    age: 25,','    id: 7,']),'  return p.age + p.id;','}'],[5,5]],
 ['index-keys','javascript',['function make() {',...literal(['    2: "b",','    x: 1,','    1: "a",','    y: 2,']),'  return Object.keys(p).join();','}'],[7,12]],
 ['not-inert','javascript',['function make() {','  const log = [];','  const p = {','    a: log.push(1),','    b: log.push(2),','  };','  return [p, log];','}'],[0,0]],
 ['nested-inert','typescript',['function make() {',...literal(['    tags: ["a", "b"],','    pos: { x: 1, y: -2 },','    ok: true,']),'  return JSON.stringify(p);','}'],[0,5]],
 ['escapes-arg','javascript',['function make() {',...literal(['    a: 1,','    b: 2,']),'  return Object.keys(p).join() + show(p);','}','function show(x) {','  return JSON.stringify(x);','}'],[1,2]],
 ['contained-ts','typescript',['function make(): number {',...literal(['    a: 1,','    b: 2,','    c: 3,']),'  p.b = p.a + p.c;','  return p.b + p["c"];','}'],[5,5]],
 ['top-level','javascript',['const p = {','  a: 1,','  b: 2,','};','function make() {','  return p.a + p.b;','}'],[0,1],'JSON.stringify(p) + make()'],
 ['returned','javascript',['function make() {','  return {','    a: 1,','    b: "two",','  };','}'],[0,1],'JSON.stringify(make())'],
];
for(const [id,language,source,[observed,ignored],probe='make()'] of fixtures)test(`oracle: ${id} — no unsound order, the freed rows accepted`,()=>{
 for(const [keyOrder,expected] of [['observed',observed],['ignored',ignored]]){
  const fixture={id,language,source,probe,keyOrder},row=measureFixture(fixture,{model:generate(fixture),repeats:0});
  assert.equal(row.unsound,0,`${keyOrder}: ${JSON.stringify(row.counterexamples)}`);
  assert.equal(row.accepted,expected,`${keyOrder}: accepted neighbours`);
 }
});

test('NY-34: runtimeText blanks comments and type syntax at their own positions and keeps what runs',()=>{
 const source=['// Proxy here','interface I { f: Function; }','type T = typeof Symbol.iterator;','class A {}','class B extends A implements I { f = () => 1; }','declare const d: Reflect;','function g(x: Function, /* eval */ y = 1): number { return y; }','const h = Function;'].join('\n');
 const file=ts.createSourceFile('x.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),text=runtimeText(file,ts);
 assert.equal(text.length,source.length);assert.deepEqual(text.split('\n').length,source.split('\n').length);
 for(const gone of ['Proxy','interface','Symbol','implements','Reflect','x: Function','eval','number'])assert.ok(!text.includes(gone),gone);
 for(const kept of ['class B extends A','f = () => 1','function g(','y = 1','const h = Function;'])assert.ok(text.replace(/ +/g,' ').includes(kept),kept);
});

// v55 (NY-35, ADR-129): a value may read a variable the analysis proves to run no code and not to throw, and a literal
// may read one lexical binding not proven initialised. Each fixture: the oracle finds no unsound order, the pinned
// accepted neighbours, and under „Nem számít” the named pair of rows is free (true) or stays ordered (false).
const reads=[
 ['params','javascript','make(1, 2)',['function make(a, b) {',...literal(['    x: a,','    y: b,']),'  return p.x + p.y;','}'],[1,1],[3,4],true],
 ['shorthand-ts','typescript','make("Ada", 36)',['function make(name: string, age: number): string {',...literal(['    name,','    age,','    ok: true,']),'  return p.name + p.age;','}'],[5,5],[3,4],true],
 ['var-before-assignment','javascript','make()',['function make() {',...literal(['    a: v,','    b: 1,']),'  var v = 2;','  return [p.a, p.b];','}'],[1,1],[3,4],true],
 ['const-in-block','javascript','make(true)',['function make(flag) {','  const base = 5;','  const list = [1, 2];','  if (flag) {',...literal(['    x: base,','    y: [base, list],','    z: undefined,']).map(row=>'  '+row),'    return p.x + p.y[0];','  }','  return 0;','}'],[7,7],[6,7],true],
 ['destructured','javascript','make()',['function make() {','  const { q } = { q: 1 };',...literal(['    a: q,','    b: 1,']),'  return p.a + p.b;','}'],[1,1],[4,5],true],
 ['shadowed','javascript','make(3)',['const k = 1;','function make(k) {',...literal(['    a: k,','    b: 2,']),'  return p.a + p.b;','}'],[2,2],[4,5],true],
 // One binding that may meet its temporal dead zone: the same ReferenceError whatever the order.
 ['switch-zone','javascript','(() => { try { return make(2); } catch (e) { return e.name; } })()',['function make(n) {','  switch (n) {','    case 1:','      const a = 1;','    case 2:','      const p = {','        x: a,','        y: 2,','      };','      return p.x;','  }','}'],[2,2],[7,8],true],
 ['closure-one-zone','javascript','make()',['function make() {','  const get = () => ({','    a: x,','    b: 1,','    c: x,','  });','  let message = "";','  try {','    get();','  } catch (e) {','    message = e.message;','  }','  const x = 1;','  return [message, get().a];','}'],[2,7],[3,4],true],
 // Two such bindings: the order decides which error is thrown, and the oracle's run tells them apart.
 ['closure-two-zones','javascript','make()',['function make() {','  const get = () => ({','    a: x,','    b: y,','  });','  let message = "";','  try {','    get();','  } catch (e) {','    message = e.message;','  }','  const x = 1;','  const y = 2;','  return [message, get().a];','}'],[3,3],[3,4],false],
 // An undeclared name may be an accessor of the global object, whose getter runs.
 ['global-getter','javascript','make()',['Object.defineProperty(globalThis, "g1", { get() { record("g1"); return 1; }, configurable: true });','Object.defineProperty(globalThis, "g2", { get() { record("g2"); return 2; }, configurable: true });','function make() {',...literal(['    a: g1,','    b: g2,']),'  return p.a + p.b;','}'],[1,1],[5,6],false],
];
for(const [id,language,probe,source,[observed,ignored],[first,second],free] of reads)test(`NY-35 oracle: ${id} — rows ${first} and ${second} ${free?'free':'stay ordered'}, no unsound order`,()=>{
 for(const [keyOrder,expected] of [['observed',observed],['ignored',ignored]]){
  const fixture={id,language,source,probe,keyOrder},built=generate(fixture),row=measureFixture(fixture,{model:built,repeats:0});
  assert.equal(row.unsound,0,`${keyOrder}: ${JSON.stringify(row.counterexamples)}`);
  assert.equal(row.accepted,expected,`${keyOrder}: accepted neighbours`);
  if(keyOrder==='ignored')assert.equal(grade(built,swapped(built.lines.length,first,second)),free?'accepted':'rejected');
 }
});

test('NY-35: what still keeps the rows: an import, a catch parameter, a loop head read in its own head, eval, a block-level function',()=>{
 const cases=[
  ['import {v} from "./m.js";\nfunction f() {\n  const p = {\n    a: v,\n    b: 1,\n  };\n  return p.a;\n}',3,4],
  ['function f() {\n  try {\n    g();\n  } catch (e) {\n    const p = {\n      a: e,\n      b: 1,\n    };\n    return p.b;\n  }\n}',6,7],
  ['function f() {\n  for (const x of [{\n    a: x,\n    b: 1,\n  }]) {\n    return x;\n  }\n}',3,4],
  ['function f(s) {\n  const v = 1;\n  eval(s);\n  const p = {\n    a: v,\n    b: 1,\n  };\n  return p.a;\n}',5,6],
  ['function f() {\n  {\n    function h() {}\n  }\n  const p = {\n    a: h,\n    b: 1,\n  };\n  return p.b;\n}',6,7],
 ];
 for(const [source,first,second] of cases){
  const m=model(source,'javascript','ignored');
  assert.equal(grade(m,swapped(m.lines.length,first,second)),'rejected',source);
 }
});
