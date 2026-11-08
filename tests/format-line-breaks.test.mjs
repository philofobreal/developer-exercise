/** ADR-111 (U2): the author formatter lays code out one statement, member or case per line with a block's closing
 *  brace on its own line, as the original ngDynamic formatter did; it breaks only between elements the parser already
 *  separated, keeps object literals, and never returns a changed syntax tree. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {formatTypedSource} from '../src/author/ts-format.mjs';

const format=(source,language='javascript')=>formatTypedSource(source,language,ts).code.trimEnd();

test('a one-line function and trailing closing braces are broken into rows',()=>{
 assert.equal(format('function f(a){const b=a+1;if(b>2){return b;}else{return 0;}}'),
  'function f(a) {\n     const b = a + 1;\n     if (b > 2) {\n          return b;\n     } else {\n          return 0;\n     }\n}');
 assert.equal(format('function g() {\n  const x = 1; const y = 2;\n  return x + y; }'),'function g() {\n     const x = 1;\n     const y = 2;\n     return x + y;\n}');
});

test('modern syntax, switch, classes, interfaces and enums: one element per row',()=>{
 assert.equal(format('obj?.a?.(1); x ??= 2;'),'obj?.a?.(1);\nx ??= 2;');
 assert.equal(format('switch (k) { case 1: a(); b(); break; default: c(); }'),'switch (k) {\n     case 1:\n          a();\n          b();\n          break;\n     default:\n          c();\n}');
 assert.equal(format('class A<T> { private x: Array<string> = []; get(): T | undefined { return this.y as T; } }','typescript'),
  'class A<T> {\n     private x: Array<string> = [];\n     get(): T | undefined {\n          return this.y as T;\n     }\n}');
 assert.equal(format('interface I { a: number; b?: string }\nenum E { A, B }','typescript'),'interface I {\n     a: number;\n     b?: string\n}\nenum E {\n     A,\n     B\n}');
 assert.equal(format('const v = <T,>(x: T) => x;','typescript'),'const v = <T,>(x: T) => x;','a TypeScript generic arrow is not torn apart');
});

test('what stays: object literals, literal text, comments with their statement, formatted code (idempotent)',()=>{
 assert.equal(format('const o = {a:1,b:[1,2]};'),'const o = { a: 1, b: [1, 2] };');
 const template='const s = `a;  b { }`;\nconst r = /a;{2}/g;';
 assert.equal(format(template),template,'no break inside a template or a regular expression');
 assert.equal(format('a(); /* note */ b(); // tail\nc();'),'a(); /* note */\nb(); // tail\nc();');
 for(const source of ['function f(a){const b=a+1;if(b>2){return b;}else{return 0;}}','class A { x = 1; m() { return this.x; } }']){
  const once=format(source);assert.equal(format(once),once,'formatting twice changes nothing');
 }
});

test('no line is ever inserted inside a statement: ASI-sensitive code keeps its meaning',()=>{
 // `b\n(c)` is one call expression: no break is added before `(c)`, only the continuation is indented.
 assert.equal(format('let a = b\n(c)'),'let a = b\n     (c)');
 const returned=format('function f() { return {a: 1}; }');
 assert.match(returned,/return \{ a: 1 \};/,'a returned object stays on the return line');
});
