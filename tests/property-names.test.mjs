/** ADR-052 (v27), ADR-053 (v28): a value read by a property name the source does not spell out
 * reaches an API. When the program uses such a value (calls, passes or stores it beyond its own
 * literals, or hands it to a caller that does), the names it may have count as named: a name that
 * folds to a constant (`'ke' + 'ys'` is `keys`) is judged by the name rules, any other name counts
 * as every API. Each witness first was an unsound acceptance: `Object['ke' + 'ys']` listed the
 * constructor's keys while v26 let the two writes swap. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {DEPENDENCY_POLICY,generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {unspelledNames} from '../dist/author/property-names.js';
import {observesKeyOrder,enumeratesKeys} from '../dist/author/js-ts-ordering.js';
import {measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createOracle} from './support/semantic-oracle.mjs';

const file=(source,name='x.js')=>ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true);
const reached=source=>unspelledNames(file(source),ts);
/** The program counts as listing keys: by a folded `keys` or by any name. */
const listing=source=>{const names=reached(source);return names==='any'||names.includes('keys');};
/** Neither key observation nor key listing follows from the source. */
const quiet=source=>!observesKeyOrder(file(source),ts)&&!enumeratesKeys(file(source),ts);
const box=['class Box {','  constructor() {','    this.a = 1;','    this.b = 2;','  }','}','function evaluate() {'];
const witnesses={
 call:["  const name = 'ke' + 'ys';",'  return Object[name](new Box());','}'],
 alias:["  const list = Object['ke' + 'ys'];",'  return list(new Box());','}'],
 callback:["  return [new Box()].map(Object['ke' + 'ys']);",'}'],
 invoker:["  const list = Object['ke' + 'ys'];",'  return list.call(null, new Box());','}'],
 stored:["  const table = [Object['ke' + 'ys']];",'  return table[0](new Box());','}'],
 returned:["  return pick(Object, 'ke' + 'ys')(new Box());",'}','function pick(owner, name) {','  return owner[name];','}'],
 destructured:["  const { ['ke' + 'ys']: list } = Object;",'  return list(new Box());','}'],
 logical:['  const fallback = () => [];',"  return (Object['ke' + 'ys'] || fallback)(new Box());",'}'],
 accumulated:["  let name = 'ke';","  name += 'ys';",'  return Object[name](new Box());','}'],
 identity:["  return Object['ke' + 'ys'].valueOf()(new Box());",'}'],
 object:["  const table = { list: Object['ke' + 'ys'] };",'  return table.list(new Box());','}'],
 helper:['  return pick()(new Box());','}','function pick() {',"  return Object['ke' + 'ys'];",'}'],
 template:["  const name = `ke${'ys'}`;",'  return Object[name](new Box());','}'],
 parameter:["  return list(Object, 'keys');",'}','function list(owner, name) {','  return owner[name](new Box());','}'],
 constructor:['  const make = ({}).constructor.constructor;',"  return make('box', 'return Object.ke' + 'ys(box)')(new Box());",'}'],
};

test('the generation rule is v27 or later, v27 introduced by ADR-052 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=27,DEPENDENCY_POLICY);
 const {readFile}=await import('node:fs/promises');
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v27` \| \[ADR-052\]/);
});

for(const [name,body] of Object.entries(witnesses))test(`witness ${name}: detected, the key writes stay ordered, sound against the oracle`,()=>{
 const source=[...box,...body];
 assert.equal(listing(source.join('\n')),true);
 const model=generateCodeLineExercise({source:source.join('\n'),language:'javascript'},ts),compiled=compileCodeLineExercise(model);
 assert.ok(!compiled.status,compiled.message);
 const swapped=[1,2,4,3,...source.slice(4).map((_,i)=>i+5)].map(row=>source[row-1]);
 assert.equal(validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:swapped}).status,'rejected');
 assert.equal(createOracle({id:'adr-052-'+name,language:'javascript',probe:'evaluate()',source})(swapped).ok,false,'the swap is observable');
 const row=measureFixture({id:'adr-052-'+name,origin:'witness',language:'javascript',probe:'evaluate()',source},CORPUS_CAPS);
 assert.equal(row.unsound,0,JSON.stringify(row.counterexamples));
});

test('a string handed to a timer is code built at run time',()=>{
 assert.equal(reached("setTimeout('record(1)', 0);"),'any');
 assert.equal(reached('setTimeout(code, 0);'),'any');
 assert.deepEqual(reached('setTimeout(() => record(1), 0);'),[]);
});

test('the generation rule is v28 or later, v28 introduced by ADR-053 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=28,DEPENDENCY_POLICY);
 const {readFile}=await import('node:fs/promises');
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v28` \| \[ADR-053\]/);
});

test('constant names fold: concatenation, template, literal choice; a growing or unknown name is any name',()=>{
 assert.deepEqual(reached("const f = Object['ke' + 'ys']; f(x);"),['keys']);
 assert.deepEqual(reached("const n = `ent${'ries'}`; Object[n](x);"),['entries']);
 assert.deepEqual(reached("const n = flag ? 'keys' : 'values'; Object[n](x);"),['keys','values']);
 assert.equal(reached("let n = 'a'; while (go()) { n += 'b'; } Object[n](x);"),'any');
 assert.equal(reached('function f(o, k) { o[k](); }'),'any');
 assert.equal(reached("Object['constr' + 'uctor'](x);"),'any','constructor leads to Function');
});

test('harmless: values only compared, computed, tested, kept in own literals or returned to the outside',()=>{
 for(const source of [
  'function f(grid, r, c) { return grid[r][c] === 1; }',
  'function f(m) { let s = 0; for (let i = 0; i < m.length; i++) { s += m[i]; } return s; }',
  'function f(words) { const counts = {}; for (const w of words) { counts[w] = (counts[w] || 0) + 1; } return counts; }',
  'function f(items, key) { const g = {}; for (const item of items) { const v = item[key]; if (!g[v]) { g[v] = []; } g[v].push(item.name); } return g; }',
  'function f(o, k) { return `${o[k]}:` + (typeof o[k]) + (o[k] ? 1 : 0); }',
  'function f(o, flag) { return o[flag ? "a" : "b"](); }',
  'function f(a, i) { return a[i + 1] - a[i - 1]; }',
  'function f(x) { return x.constructor === Array; }',
  'function f(o, k) { const v = o[k]; let t = 0; t += v; return t > 1; }',
  'function f(o, k) { return o[k]; }',
  'function f(o, k) { const box = { v: o[k] }; return [box, o[k]]; }',
  'function f(grid, s) { const first = grid[s[0]][s[1]]; return [first]; } function g() { return f([[1]], [0, 0]); }',
 ])assert.ok(quiet(source),source);
});

test('conservative: an unknown-named value that is passed, written into or called through a caller counts',()=>{
 for(const source of ['function f(o, k, out) { out.push(o[k]); }','function f(o, k) { g(o[k]); }','function f(o, k) { o[k].x = 1; }','function f(o, k) { return o[k]; } function g(o, k) { return f(o, k)(1); }','function f(o, k) { const t = [o[k]]; t.map(h); }',
  // Methods the language calls by itself: an iterator's next, a proxy trap, a class's then.
  'function f(o, k) { return { next() { return { value: o[k], done: false }; } }; } function g() { return f(1, 2); }',
  'function f(o, k) { return new Proxy({}, { get() { return o[k]; } }); }',
  'class Later { constructor(o, k) { this.o = o; this.k = k; } then(done) { return this.o[this.k]; } }'])assert.equal(reached(source),'any',source);
});

// The example of the Pages guide: the folded name is `keys`, which lists keys but changes no read,
// so the valid contract still applies (no note), while the two key writes stay ordered.
test('a folded key-listing name keeps the valid contract and orders the key writes',()=>{
 const source=[...box,...witnesses.alias];
 const model=generateCodeLineExercise({source:source.join('\n'),language:'javascript',inputs:'valid'},ts);
 assert.doesNotMatch(model.authoring.note??'',/nem alkalmazható/);
 const row=measureFixture({id:'adr-053-alias-valid',origin:'witness',inputs:'valid',language:'javascript',probe:'evaluate()',source},CORPUS_CAPS);
 assert.equal(row.unsound,0,JSON.stringify(row.counterexamples));
});

// A value read by an unknown name and only returned to the outside keeps the valid contract.
const grid=['function evaluate() {','  return measure([[1, 2], [3, 4]], [1, 0]);','}','function measure(grid, start) {','  const rows = grid.length;','  const cols = grid[0].length;','  const first = grid[start[0]][start[1]];','  return [rows, cols, first];','}'];
test('a value read by an unknown name and returned to the outside keeps the valid contract',()=>{
 const model=generateCodeLineExercise({source:grid.join('\n'),language:'javascript',inputs:'valid'},ts),compiled=compileCodeLineExercise(model);
 assert.doesNotMatch(model.authoring.note??'',/nem alkalmazható/);
 const swapped=[1,2,3,4,6,5,7,8,9].map(row=>grid[row-1]);
 assert.equal(validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:swapped}).status,'accepted');
 const row=measureFixture({id:'adr-053-grid',origin:'witness',inputs:'valid',language:'javascript',probe:'evaluate()',source:grid},CORPUS_CAPS);
 assert.equal(row.unsound,0,JSON.stringify(row.counterexamples));
});

// The input contract (ADR-050) rests on the program not changing what a read does; a getter
// installed through unspelled names would run on a read of a missing key.
const hooked=['function evaluate() {',"  const install = Object['define' + 'Property'];","  const target = Object['proto' + 'type'];","  install(target, 'p', { get() { record('p'); return 1; }, configurable: true });","  install(target, 'q', { get() { record('q'); return 2; }, configurable: true });",'  return pair({});','}','function pair(point) {','  const p = point.p;','  const q = point.q;','  return [p, q];','}'];
test('the valid contract does not apply when hooks are reached through unspelled names',()=>{
 const model=generateCodeLineExercise({source:hooked.join('\n'),language:'javascript',inputs:'valid'},ts);
 assert.match(model.authoring.note,/érvényes bemenet szerződése nem alkalmazható/);
 const row=measureFixture({id:'adr-052-hooked',origin:'witness',inputs:'valid',language:'javascript',probe:'evaluate()',source:hooked},CORPUS_CAPS);
 assert.equal(row.unsound,0,JSON.stringify(row.counterexamples));
});

test('the longest note (TypeScript class, valid contract not applicable) fits the schema',()=>{
 const source=['class Box {','  items: number[] = [];','}','function evaluate(): number {','  const p = new Proxy({ x: 1 }, {});','  return p.x;','}'];
 const model=generateCodeLineExercise({source:source.join('\n'),language:'typescript',inputs:'valid'},ts);
 assert.ok(model.authoring.note.length<=1000,String(model.authoring.note.length));
 const compiled=compileCodeLineExercise(model);
 assert.ok(!compiled.status,compiled.message);
});
