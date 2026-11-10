/** NY-36 (v56, ADR-130): with key order „Számít” a key order is part of the behaviour whenever anyone can list the keys
 *  — the program or a caller. The oracle compares the key order of what a probe receives; each witness lets a caller
 *  list an object's keys (unsound until v55) or keeps the object inside (its freedom stays). */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {objectReach} from '../dist/author/object-reach.js';
import {measureFixture,generate} from './support/ordering-metrics.mjs';

// [id, language, probe, source, accepted neighbours with „Számít”]
const witnesses=[
 ['fields-returned','javascript','JSON.stringify(make())',['class Point {','  x = 1;','  y = 2;','}','function make() {','  return new Point();','}'],1],
 ['fields-returned-ts','typescript','JSON.stringify(make())',['class Point {','  x: number = 1;','  y: number = 2;','}','function make(): Point {','  return new Point();','}'],1],
 ['global-class-caller','javascript','[make(), JSON.stringify(new Point())]',['class Point {','  x = 1;','  y = 2;','}','function make() {','  const p = new Point();','  return p.x + p.y;','}'],1],
 ['ctor-writes','javascript','JSON.stringify(make())',['class Point {','  constructor() {','    this.x = 1;','    this.y = 2;','  }','}','function make() {','  return new Point();','}'],3],
 ['object-writes-returned','javascript','JSON.stringify(make())',['function make() {','  const o = {};','  o.a = 1;','  o.b = 2;','  return o;','}'],0],
 // The object never leaves: its order stays free.
 ['object-writes-local','javascript','make()',['function make() {','  const o = {};','  o.a = 1;','  o.b = 2;','  return o.a + o.b;','}'],1],
 ['class-in-function','javascript','make()',['function make() {','  class Point {','    x = 1;','    y = 2;','    sum() {','      return this.x + this.y;','    }','  }','  const p = new Point();','  return p.sum();','}'],6],
 ['accessor-field-ts','typescript','JSON.stringify(make())',['class Gauge {',"  label = 'g';",'  accessor level = 1;','}','function make(): Gauge {','  return new Gauge();','}'],2],
];
for(const [id,language,probe,source,accepted] of witnesses)test(`oracle: ${id} — no order a caller can tell apart is accepted`,()=>{
 const fixture={id,language,source,probe,keyOrder:'observed'},row=measureFixture(fixture,{model:generate(fixture),repeats:0});
 assert.equal(row.unsound,0,JSON.stringify(row.counterexamples));
 assert.equal(row.accepted,accepted,'accepted neighbours');
 assert.equal(row.completenessGaps,0,'no order the oracle finds equal is rejected');
});

const reachOf=(text,kind=ts.ScriptKind.JS)=>{const file=ts.createSourceFile('x.'+(kind===ts.ScriptKind.TS?'ts':'js'),text,ts.ScriptTarget.Latest,true,kind);return {file,reach:objectReach(file,ts)};};
const classNamed=(file,name)=>{let found;const visit=node=>{if(ts.isClassDeclaration(node)&&node.name?.text===name)found=node;ts.forEachChild(node,visit);};visit(file);return found;};
test('objectReach: which classes keep their instances inside',()=>{
 const inside='function f() {\n  class A {\n    x = 1;\n    get() { return this.x; }\n  }\n  const a = new A();\n  return a.get();\n}';
 const cases=[
  [inside,'A',true,'a class in a function, its instance read through its own method'],
  ['class A { x = 1; }\nfunction f() { const a = new A(); return a.x; }','A',false,'a script\'s top-level class is a global a caller may instantiate'],
  ['class A { x = 1; }\nexport function f() { const a = new A(); return a.x; }','A',true,'a module\'s class that is not exported'],
  ['export class A { x = 1; }','A',false,'an exported class'],
  ['class A { x = 1; me() { return this; } }\nexport function f() { const a = new A(); return a.x; }','A',false,'a method returns this'],
  ['class A { x = 1; }\nexport function f() { const a = new A(); return a; }','A',false,'the instance is returned'],
  ['class A { x = 1; }\nexport function f() { const a = new A(); g(a); return 1; }\nfunction g(v) {}','A',false,'the instance is passed on'],
  ['class B { y = 2; read() { return this.y; } }\nclass A extends B { x = 1; }\nexport function f() { const a = new A(); return a.read() + a.x; }','B',true,'a base whose only subclass keeps its instances'],
  ['class B { y = 2; }\nclass A extends B { x = 1; }\nexport function f() { return new A(); }','B',false,'a base whose subclass instance is returned'],
  ['class A { x = 1; }\nexport function f() { const a = new A(); return eval("a"); }','A',false,'eval'],
 ];
 for(const [text,name,stays,why] of cases){const {file,reach}=reachOf(text);assert.equal(reach.instancesStay(classNamed(file,name)),stays,why);}
});
test('objectReach: a type annotation is not a reference; a literal stays only in a local variable used through members',()=>{
 const {file,reach}=reachOf('class P { x = 1; }\nexport function f(): number { const p: P = new P(); return p.x; }',ts.ScriptKind.TS);
 assert.equal(reach.instancesStay(classNamed(file,'P')),true);
 const literal=(text)=>{const {file,reach}=reachOf(text);let found;const visit=node=>{if(ts.isObjectLiteralExpression(node)&&!found)found=node;ts.forEachChild(node,visit);};visit(file);return reach.literalStays(found);};
 assert.equal(literal('function f() { const o = {\n a: 1,\n b: 2,\n }; return o.a; }'),true);
 assert.equal(literal('function f() { const o = {\n a: 1,\n b: 2,\n }; return o; }'),false);
 assert.equal(literal('const o = {\n a: 1,\n b: 2,\n};'),false,'a top-level binding');
});
