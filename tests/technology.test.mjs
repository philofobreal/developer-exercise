/** ADR-149: the technologies an exercise is made of, each with a version. The label is measured by the author
 * analysis (the newest language and library element the reference uses), kept in the model, served with the
 * listing, and never read by the validator. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {compileCodeLineExercise,compareVersions,newerVersion,technologiesProblem} from '../dist/index.js';
import {createTechnologyProfiler} from '../dist/author/technology-profile.js';
import {ExerciseCatalog} from '../src/server/catalog.mjs';

const libraryDirectory=path.dirname(ts.getDefaultLibFilePath({}));
const library=name=>{try{return readFileSync(path.join(libraryDirectory,path.basename(name)),'utf8');}catch{return undefined;}};
const profiler=createTechnologyProfiler(ts,library);
const versions=(source,language)=>Object.fromEntries(profiler.profile(source,language).map(technology=>[technology.id,technology.version]));
const example=async id=>JSON.parse(await readFile(new URL(`../examples/${id}.json`,import.meta.url),'utf8'));

test('versions order by their numeric parts',()=>{
 assert.ok(compareVersions('2015','2020')<0);assert.ok(compareVersions('2020','5')>0);
 assert.ok(compareVersions('4.9','4.10')<0,'4.10 is newer than 4.9');assert.ok(compareVersions('5.0','4.9')>0);
 assert.equal(compareVersions('5','5.0'),0);assert.equal(compareVersions('7.8','7.8.0'),0);assert.ok(compareVersions('7.8.2','7.8')>0);
 assert.equal(newerVersion('4.9','5.2'),'5.2');assert.equal(newerVersion('2020','2015'),'2020');assert.equal(newerVersion('5','5.0'),'5','the first of two equal versions');
});

test('the model takes a well-formed label and refuses a malformed one; the validator does not read it',async()=>{
 const model=await example('celsius-js'),{technologies,...plain}=model;
 assert.deepEqual(technologies,[{id:'ecmascript',version:'2015'}]);
 const admitted=label=>!('status' in compileCodeLineExercise({...plain,...(label===undefined?{}:{technologies:label})}));
 assert.ok(admitted(undefined),'the label is optional');assert.ok(admitted([]));
 assert.ok(admitted([{id:'ecmascript',version:'2020'},{id:'typescript',version:'5.8'}]));assert.ok(admitted([{id:'typescript',version:'5.8.3'}]));
 for(const refused of [[{id:'ecmascript',version:'ES2020'}],[{id:'ecmascript',version:''}],[{id:'ecmascript',version:'2020.'}],[{id:'ecmascript',version:'1.2.3.4'}],[{id:'python',version:'3'}],[{id:'ecmascript'}],[{version:'5'}],
  [{id:'ecmascript',version:'5',note:'x'}],'ES2020',[{id:'ecmascript',version:2020}],Array.from({length:9},()=>({id:'ecmascript',version:'5'}))])assert.equal(admitted(refused),false,JSON.stringify(refused));
 const twice=compileCodeLineExercise({...plain,technologies:[{id:'ecmascript',version:'5'},{id:'ecmascript',version:'2015'}]});
 assert.equal(twice.status,'invalid_reference');assert.match(twice.message,/csak egyszer/);
 assert.equal(technologiesProblem(undefined),undefined);assert.equal(technologiesProblem([{id:'ecmascript',version:'5'},{id:'typescript',version:'1.0'}]),undefined);
 // The same rules with and without the label, and with another label.
 const rules=value=>JSON.stringify(compileCodeLineExercise(value).compiled);
 assert.equal(rules(model),rules(plain));assert.equal(rules({...plain,technologies:[{id:'ecmascript',version:'2025'}]}),rules(plain));
});

// [source, edition]: the edition of the newest element, by syntax.
const SYNTAX=[
 ['var a = 1;','5'],['function f(a) { return a + 1; }','5'],['var o = {get a() { return 1; }};','5'],
 ['let a = 1;','2015'],['const a = 1;','2015'],['var f = () => 1;','2015'],['class A {}','2015'],['var A = class {};','2015'],['var s = `x`;','2015'],['var s = `x${a}`;','2015'],['var s = tag`x`;','2015'],
 ['var {a} = o;','2015'],['var [a] = xs;','2015'],['function f(a = 1) {}','2015'],['function f(...a) {}','2015'],['var x = [...xs];','2015'],['f(...xs);','2015'],['for (var x of xs) {}','2015'],
 ['function* g() { yield 1; }','2015'],['var o = {[k]: 1};','2015'],['var o = {a};','2015'],['var o = {m() {}};','2015'],['export default 1;','2015'],['import x from "m";','2015'],['export var a = 1;','2015'],
 ['export { a } from "m";','2015'],['function F() { return new.target; }','2015'],['var n = 0b11;','2015'],['var n = 0o17;','2015'],['var r = /a/u;','2015'],['var r = /a/y;','2015'],['[a, b] = [b, a];','2015'],['({a} = o);','2015'],
 ['var p = 2 ** 3;','2016'],['p **= 2;','2016'],
 ['async function f() {}','2017'],['async function f() { await g(); }','2017'],['var f = async function () {};','2017'],['var o = {async m() {}};','2017'],
 ['var o = {...p};','2018'],['var {a, ...rest} = o;','2018'],['async function f() { for await (var x of xs) {} }','2018'],['async function* g() {}','2018'],['var r = /(?<y>a)/;','2018'],['var r = /(?<=a)b/;','2018'],
 ['var r = /(?<!a)b/;','2018'],['var r = /a/s;','2018'],['var r = /\\p{L}/u;','2018'],
 ['try { f(); } catch { g(); }','2019'],
 ['var c = a?.b;','2020'],['var c = a?.[0];','2020'],['var c = a?.();','2020'],['var c = a ?? b;','2020'],['var n = 10n;','2020'],['var m = import("m");','2020'],['var u = import.meta.url;','2020'],['export * as ns from "m";','2020'],
 ['a ??= 1;','2021'],['a ||= 1;','2021'],['a &&= 1;','2021'],['var n = 1_000;','2021'],
 ['class A { x = 1; }','2022'],['class A { static x = 1; }','2022'],['class A { #x = 1; }','2022'],['class A { #m() {} }','2022'],['class A { static { f(); } }','2022'],['var v = await p;\nexport {};','2022'],['var r = /a/d;','2022'],
 ['var r = /[\\p{L}--\\p{N}]/v;','2024'],
 ['import d from "./d.json" with { type: "json" };','2025'],['var r = /(?i:a)b/;','2025'],['var r = /(?-i:a)b/;','2025'],
 // What looks like a newer element and is not.
 ['var r = /(?:a)b/;','5'],['var r = /\\(?<a/;','5'],['var s = "a ?? b";','5'],['var s = "`x`";','5'],['var o = {async: 1, await: 2};','5'],['var n = 0x1f;','5'],['try { f(); } catch (e) { g(); }','5']
];
test('the edition of JavaScript syntax, element by element',()=>{
 for(const [source,edition] of SYNTAX)assert.deepEqual(versions(source,'javascript'),{ecmascript:edition},source);
 // The same without a standard library: the syntax needs none.
 const bare=createTechnologyProfiler(ts);
 for(const [source,edition] of SYNTAX)if(edition!=='5'||!source.includes('globalThis'))assert.deepEqual(bare.profile(source,'javascript'),[{id:'ecmascript',version:edition}],'without a library: '+source);
});

// [source, edition]: the edition of the newest standard library element, where the checker knows the receiver.
const LIBRARY=[
 ['var n = [1, 2].indexOf(2);','5'],['var k = Object.keys({a: 1});','5'],['var s = JSON.stringify([1].map(function (x) { return x; }));','5'],['var d = new Date().getTime();','5'],
 ['var m = new Map();','2015'],['var s = new Set([1]);','2015'],['var p = Promise.resolve(1);','2015'],['var s = Symbol.iterator;','2015'],['var a = Array.from("ab");','2015'],['var b = "ab".startsWith("a");','2015'],
 ['var o = Object.assign({}, {a: 1});','2015'],['var i = Number.isInteger(1);','2015'],['var f = [1].find(function (x) { return x; });','2015'],
 ['var i = [1].includes(1);','2016'],
 ['var e = Object.entries({a: 1});','2017'],['var v = Object.values({a: 1});','2017'],['var s = "a".padStart(3);','2017'],
 ['var p = Promise.resolve(1).finally(function () {});','2018'],
 ['var f = [[1]].flat();','2019'],['var f = [1].flatMap(function (x) { return [x]; });','2019'],['var o = Object.fromEntries([]);','2019'],['var t = " a".trimStart();','2019'],
 ['var s = Promise.allSettled([]);','2020'],['var m = "a".matchAll(/a/g);','2020'],['var g = globalThis;','2020'],
 ['var r = "a".replaceAll("a", "b");','2021'],['var p = Promise.any([]);','2021'],
 ['var l = [1].at(-1);','2022'],['var h = Object.hasOwn({}, "a");','2022'],
 ['var s = [2, 1].toSorted();','2023'],['var s = [2, 1].toReversed();','2023'],['var w = [1].with(0, 2);','2023'],['var l = [1].findLast(function (x) { return x; });','2023'],
 ['var g = Object.groupBy([1], function (x) { return x; });','2024'],['var g = Map.groupBy([1], function (x) { return x; });','2024'],['var w = Promise.withResolvers();','2024'],
 ['var u = new Set([1]).union(new Set([2]));','2025'],['var t = [1].values().take(1);','2025'],['var p = Promise.try(function () { return 1; });','2025'],
 ['var a = Array.fromAsync([1]);','2026']
];
test('the edition of a standard library element is the edition of the file that declares it',()=>{
 for(const [source,edition] of LIBRARY)assert.deepEqual(versions(source,'javascript'),{ecmascript:edition},source);
 // The same calls in TypeScript.
 for(const [source,edition] of LIBRARY)assert.equal(versions(source,'typescript').ecmascript,edition,'typescript: '+source);
 // A name that is a type in an old library file and a value in a newer one is dated by its use.
 assert.deepEqual(versions('var p = new Promise(function (resolve) { resolve(1); });','javascript'),{ecmascript:'2015'});
 assert.deepEqual(versions('var s = Symbol("a");','javascript'),{ecmascript:'2015'});
 assert.equal(versions('declare var p: Promise<number>;','typescript').ecmascript,'5','the type alone is in the oldest library');
 // A type names its library file too.
 assert.equal(versions('var m: Map<string, number>;','typescript').ecmascript,'2015');assert.equal(versions('var a: Array<number>;','typescript').ecmascript,'5');
});

test('what the source declares itself is not the library\'s; an untyped receiver is dated by the member\'s name',()=>{
 // A name of its own: a function called Map, an object with an `at`, a class with a `toSorted`.
 assert.deepEqual(versions('function Map() {}\nvar m = new Map();','javascript'),{ecmascript:'5'});
 assert.deepEqual(versions('var o = {at: function () { return 1; }};\nvar v = o.at();','javascript'),{ecmascript:'5'});
 assert.deepEqual(versions('class Board { toSorted() { return 1; } }\nvar v = new Board().toSorted();','javascript'),{ecmascript:'2015'},'the class dates it, not the method');
 // An untyped parameter: the checker cannot follow, the member's name decides, by the oldest edition that has one.
 assert.deepEqual(versions('function f(xs) { return xs.toSorted(); }','javascript'),{ecmascript:'2023'});
 assert.deepEqual(versions('function f(xs) { return xs.map(function (x) { return x; }); }','javascript'),{ecmascript:'5'});
 assert.deepEqual(versions('function f(xs) { return xs.includes(1); }','javascript'),{ecmascript:'2015'},'String.prototype.includes is older than the array\'s');
 assert.deepEqual(versions('function f(xs) { return xs.flatMap(function (x) { return [x]; }).at(-1); }','javascript'),{ecmascript:'2022'});
 assert.deepEqual(versions('function f(x) { return x.somethingOfItsOwn(); }','javascript'),{ecmascript:'5'});
 // A receiver the checker knows has no such member: the name alone dates nothing.
 assert.deepEqual(versions('var n = 5;\nvar s = n.toSorted;','javascript'),{ecmascript:'5'});
 // Decorator metadata is in no edition: it does not date the code beyond what `Symbol` does.
 assert.deepEqual(versions('var m = Symbol.metadata;','javascript'),{ecmascript:'2015'});
 // …unless the source gives its own objects a member of that name.
 assert.deepEqual(versions('var board = {toSorted: function () { return 1; }};\nfunction f(b) { return b.toSorted(); }','javascript'),{ecmascript:'5'});
 assert.deepEqual(versions('function Board() { this.at = function () { return 1; }; }\nfunction f(b) { return b.at(0); }','javascript'),{ecmascript:'5'});
 // Without a standard library only the syntax is measured: a lower bound.
 const bare=createTechnologyProfiler(ts);
 assert.deepEqual(bare.profile('var s = [2, 1].toSorted();','javascript'),[{id:'ecmascript',version:'5'}]);
 assert.deepEqual(createTechnologyProfiler(ts,()=>undefined).profile('const s = [2, 1].toSorted();','javascript'),[{id:'ecmascript',version:'2015'}]);
});

// [source, release, edition]: the release of the newest TypeScript element; the edition where the row needs one above 5.
const TYPESCRIPT=[
 ['var a: number = 1;','1.0'],['interface A { a: number }','1.0'],['enum E { A }','1.0'],['namespace N { var a = 1; }','1.0'],['function f<T>(x: T): T { return x; }','1.0'],['function f(a?: number): void {}','1.0'],
 ['var t: [number, string];','1.3'],['class A { protected a = 1; }','1.3','2015'],
 ['var u: number | string;','1.4'],['type A = number;','1.4'],
 ['function d(t: Function) {}\n@d\nclass A {}','1.5','2015'],
 ['abstract class A {}','1.6','2015'],['var i: A & B;','1.6'],['function f(x: {}): x is string { return true; }','1.6'],
 ['var l: "a";','1.8'],
 ['var l: 1;','2.0'],['var l: true;','2.0'],['var n: never;','2.0'],['var v = a!;','2.0'],['class A { readonly a = 1; }','2.0','2015'],
 ['var k: keyof A;','2.1'],['type M = { [K in "a"]: number };','2.1'],['var x: A["a"];','2.1'],['var p: Partial<A>;','2.1'],['var r: Record<string, number>;','2.1'],
 ['var o: object;','2.2'],
 ['class A { a!: number; }','2.7','2015'],['declare const s: unique symbol;','2.7','2015'],
 ['type C<T> = T extends string ? 1 : 2;','2.8'],['type E<T> = T extends (infer U)[] ? U : never;','2.8'],['var r: ReturnType<typeof f>;','2.8'],['var q: Required<A>;','2.8'],
 ['var u: unknown;','3.0'],['type T = [number, ...string[]];','3.0'],['type T = [number, string?];','3.0'],
 ['var p: Parameters<typeof f>;','3.1'],['var b: bigint;','3.2'],
 ['var c = [1] as const;','3.4'],['var r: readonly number[];','3.4'],['var o: Omit<A, "a">;','3.5'],
 ['function f(x: {}): asserts x is string {}','3.7'],
 ['import type { A } from "m";','3.8'],['export type { A } from "m";','3.8'],
 ['type T = [first: number];','4.0'],
 ['type T = `a${string}`;','4.1'],['type M<T> = { [K in keyof T as string]: T[K] };','4.1'],['var u: Uppercase<"a">;','4.1'],
 ['class A { m() {} }\nclass B extends A { override m() {} }','4.3','2015'],
 ['import { type A } from "m";','4.5','2015'],['var a: Awaited<P>;','4.5'],
 ['interface P<out T> { get(): T }','4.7'],
 ['var s = { a: 1 } satisfies object;','4.9'],['class A { accessor a = 1; }','4.9','2015'],
 ['function f<const T>(x: T): T { return x; }','5.0'],
 ['function f() { using x = g(); }','5.2','2026'],
 ['function f<T>(x: NoInfer<T>) {}','5.4'],
 // A name of its own is not the library's utility type.
 ['type Partial<T> = T;\nvar p: Partial<number>;','1.4'],['interface NoInfer<T> { value: T }\nvar n: NoInfer<number>;','1.0'],
 ['function f() { type Omit<T> = T; var o: Omit<number>; }','1.4'],['function f<Awaited>(x: Awaited): Awaited { return x; }','1.0']
];
test('the release of TypeScript syntax and utility types, element by element',()=>{
 for(const [source,release,edition='5'] of TYPESCRIPT)assert.deepEqual(versions(source,'typescript'),{ecmascript:edition,typescript:release},source);
 // A field of a TypeScript class is TypeScript's own, older than the standard's; a #private name is the standard's.
 assert.deepEqual(versions('class A { a = 1; }','typescript'),{ecmascript:'2015',typescript:'1.0'});
 assert.deepEqual(versions('class A { #a = 1; }','typescript'),{ecmascript:'2022',typescript:'1.0'});
 // `export` inside a namespace is TypeScript's; a type-only import or export needs no module support.
 assert.deepEqual(versions('namespace N { export var a = 1; }','typescript'),{ecmascript:'5',typescript:'1.0'});
 // The newest element decides, in each language on its own.
 assert.deepEqual(versions('type A = number;\nvar s = { a: 1 } satisfies object;\nvar c = a ?? b;','typescript'),{ecmascript:'2020',typescript:'4.9'});
 // A JavaScript source has no TypeScript label.
 assert.deepEqual(profiler.profile('var a = 1;','javascript'),[{id:'ecmascript',version:'5'}]);
});

test('every shipped exercise carries the label its own rows measure',async()=>{
 const files=(await readdir(new URL('../examples/',import.meta.url))).filter(name=>name.endsWith('.json')).sort();
 assert.equal(files.length,16);
 const labels={};
 for(const file of files){
  const model=JSON.parse(await readFile(new URL('../examples/'+file,import.meta.url),'utf8'));
  assert.deepEqual(model.technologies,profiler.profile(model.lines.map(line=>line.code).join('\n'),model.language),file+': the label is what the measurement gives');
  labels[model.id]=model.technologies.map(technology=>technology.id+' '+technology.version).join(', ');
 }
 // The measured state of the catalog (2026-11-14); a change here is a change of an exercise or of the table.
 assert.deepEqual(labels,{'algo-bfs-js':'ecmascript 2015','algo-sort-search-js':'ecmascript 2015','celsius-js':'ecmascript 2015','class-accounts-ts':'ecmascript 2015, typescript 2.0',
  'class-inventory-ts':'ecmascript 2018, typescript 2.0','even-odd-js':'ecmascript 2015','fib-memo-js':'ecmascript 2015','grade-ts':'ecmascript 5, typescript 1.0','greeting-js':'ecmascript 2015','profiles-js':'ecmascript 2015',
  'rectangle-js':'ecmascript 2015','stack-ts':'ecmascript 2015, typescript 2.0','stats-js':'ecmascript 2015','stats-reduce-js':'ecmascript 2015','vowels-js':'ecmascript 2015','word-count-js':'ecmascript 2020'});
});

test('the catalog serves the label with the listing; a draft is measured, an imported label is never kept',async()=>{
 const catalog=await ExerciseCatalog.open(new URL('../examples/',import.meta.url).pathname);
 const listed=Object.fromEntries(catalog.list().map(item=>[item.id,item.technologies]));
 assert.deepEqual(listed['word-count-js'],[{id:'ecmascript',version:'2020'}]);assert.deepEqual(listed['grade-ts'],[{id:'ecmascript',version:'5'},{id:'typescript',version:'1.0'}]);
 assert.ok(Object.values(listed).every(Array.isArray),'every shipped exercise is labelled');
 // From source: the measurement, whatever the request says.
 const source='function total(prices) {\n  const fees = prices.map(price => price * 2);\n  const sum = fees.reduce((a, b) => a + b, 0);\n  return sum ?? 0;\n}';
 const draft=await catalog.createDraft({source,language:'javascript',technologies:[{id:'ecmascript',version:'5'}]});
 assert.deepEqual(draft.model.technologies,[{id:'ecmascript',version:'2020'}]);
 const typed=await catalog.createDraft({source:'function size(value: unknown): number {\n  const text = String(value);\n  return text.length;\n}',language:'typescript'});
 assert.deepEqual(typed.model.technologies,[{id:'ecmascript',version:'2015'},{id:'typescript',version:'3.0'}]);
 // An imported model: its label is measured again from its rows, a false one does not survive, a missing one is given.
 const model=await example('word-count-js');
 const forged=await catalog.createDraft({model:{...model,technologies:[{id:'ecmascript',version:'5'},{id:'typescript',version:'5.8'}]}});
 assert.deepEqual(forged.model.technologies,[{id:'ecmascript',version:'2020'}]);
 const {technologies,...unlabelled}=model;
 assert.deepEqual((await catalog.createDraft({model:unlabelled})).model.technologies,technologies);
 // A learner's exercise list never carries a label the catalog did not hold.
 const bare=new ExerciseCatalog(new Map([[unlabelled.id,{model:unlabelled,compiled:compileCodeLineExercise(unlabelled).compiled}]]));
 assert.equal('technologies' in bare.list()[0],false);
});

// The exact browser-ported modules from the generated GitHub Pages artifact.
test('the Local Demo serves and measures the label as the server does; without the library it measures the syntax',async()=>{
 const nativeFetch=globalThis.fetch,originalTS=globalThis.ts;
 globalThis.ts={...ts,sys:undefined};
 let withLibrary=true;
 globalThis.fetch=async url=>{
  const pathname=fileURLToPath(url instanceof URL?url:new URL(url));
  if(!withLibrary&&pathname.endsWith('typescript-lib.json'))return new Response('Not found',{status:404});
  try{return new Response(await readFile(pathname),{status:200});}catch{return new Response('Not found',{status:404});}
 };
 try{
  const bundled=JSON.parse(await readFile(new URL('../_site/vendor/typescript-lib.json',import.meta.url),'utf8'));
  assert.ok('lib.esnext.d.ts' in bundled&&'lib.es2023.array.d.ts' in bundled&&'lib.es2022.full.d.ts' in bundled,'the bundle holds the newest library beside the audit\'s');
  const api=await import('../_site/app/pages-api.js?technology');
  const listed=Object.fromEntries((await api.getExercises()).map(item=>[item.id,item.technologies]));
  assert.deepEqual(listed['word-count-js'],[{id:'ecmascript',version:'2020'}]);assert.equal(Object.keys(listed).length,16);assert.ok(Object.values(listed).every(Array.isArray));
  const source='function rank(times) {\n  const sorted = [3, 1, 2].toSorted();\n  const last = sorted.at(-1);\n  return [sorted, last, times];\n}';
  const draft=await api.compileDraft({source,language:'javascript',technologies:[{id:'ecmascript',version:'5'}]});
  assert.deepEqual(draft.model.technologies,[{id:'ecmascript',version:'2023'}]);
  const model=await example('grade-ts');
  assert.deepEqual((await api.compileDraft({model:{...model,technologies:[{id:'ecmascript',version:'2025'}]}})).model.technologies,model.technologies);
  // A failed fetch of the library: the syntax alone is measured, a lower bound.
  withLibrary=false;
  const offline=await import('../_site/app/pages-api.js?technology-offline');
  assert.deepEqual((await offline.compileDraft({source,language:'javascript'})).model.technologies,[{id:'ecmascript',version:'2015'}]);
 }finally{globalThis.fetch=nativeFetch;globalThis.ts=originalTS;}
});
