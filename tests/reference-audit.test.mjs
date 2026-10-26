/** ADR-016: the reference language audit beyond syntax. A single-file TypeScript program
 * with the standard library separates definite errors from what a missing project context
 * explains; without a library it says so instead of claiming success. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {createReferenceAuditor} from '../dist/author/reference-audit.js';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {generateCodeLineExercise} from '../src/author/generator.mjs';

const libraryDir=path.dirname(ts.getDefaultLibFilePath({}));
function library(){
 const requested=[];
 const port=name=>{requested.push(name);try{return readFileSync(path.join(libraryDir,name),'utf8');}catch{return undefined;}};
 return {port,requested};
}
const auditor=createReferenceAuditor(ts,library().port);

test('a definite language error is reported as errors with its line and code',()=>{
 const typed=auditor.audit('const a: number = 1;\nconst b: number = "x";','typescript');
 assert.equal(typed.semantics,'errors');
 assert.deepEqual(typed.diagnostics.map(item=>[item.line,item.code,item.context]),[[2,2322,false]]);
 const redeclared=auditor.audit('let a = 1;\nlet a = 2;','javascript');
 assert.equal(redeclared.semantics,'errors');
 assert.ok(redeclared.diagnostics.every(item=>item.code===2451));
 assert.ok(redeclared.assumptions.includes('javascript-binding-only'));
});

test('a clean single-file reference is ok; JavaScript is checked for binding errors only',()=>{
 assert.equal(auditor.audit('function f(n: number): number {\n  return n + 1;\n}\nconsole.log(f(1));','typescript').semantics,'ok');
 assert.equal(auditor.audit('function f() {\n  return undeclared();\n}','javascript').semantics,'ok','no checkJs inference noise');
});

test('an unresolved module or undeclared global is unverifiable, not correct and not an error',()=>{
 const imported=auditor.audit("import { x } from './missing';\nexport const y = x + 1;",'typescript');
 assert.equal(imported.semantics,'unverifiable');
 assert.deepEqual(imported.unresolved,['./missing']);
 const global=auditor.audit('const id = UUID();','typescript');
 assert.equal(global.semantics,'unverifiable');
 assert.deepEqual(global.diagnostics.map(item=>[item.code,item.context]),[[2304,true]]);
 const both=auditor.audit("import { x } from './missing';\nconst n: number = 'x';",'typescript');
 assert.equal(both.semantics,'errors','a definite error wins over missing context');
});

test('CopyFieldUtilityService: every import is outside the single file, so the reference is unverifiable',async()=>{
 const source=await readFile(new URL('./fixtures/copy-field-utility.service.ts',import.meta.url),'utf8');
 const result=auditor.audit(source,'typescript');
 assert.equal(result.semantics,'unverifiable');
 assert.equal(result.unresolved.length,11);
 assert.ok(result.unresolved.includes('../../asset/asset.interface')&&result.unresolved.includes('@nexius/core'));
 assert.ok(result.diagnostics.every(item=>item.context));
});

test('decorated files are checked in legacy decorator mode and say so',()=>{
 const result=auditor.audit('function log(target: unknown, key: string, index: number) {}\nclass A {\n  constructor(@log private readonly n: number) {}\n}','typescript');
 assert.equal(result.semantics,'ok');
 assert.ok(result.assumptions.includes('experimental-decorators'));
});

test('without a standard library the audit is not-run, never ok',()=>{
 const result=createReferenceAuditor(ts).audit('const a = 1;','typescript');
 assert.deepEqual(result,{semantics:'not-run',diagnostics:[],unresolved:[],assumptions:['single-file','target:es2022','module:esnext','non-strict','no-standard-library']});
});

test('the library port is asked only for standard library files, once each',()=>{
 const {port,requested}=library(),local=createReferenceAuditor(ts,port);
 local.audit('/// <reference path="../../../etc/passwd" />\n/// <reference lib="dom" />\nconst a = 1;','typescript');
 const first=requested.length;
 local.audit('const b = 2;','typescript');
 assert.ok(first>0&&requested.every(name=>/^lib\.[a-z0-9.]+\.d\.ts$/.test(name)),requested.join());
 assert.equal(requested.length,first,'parsed libraries are cached');
});

test('server admission reports the audit with every draft and recomputes it for imported models',async()=>{
 const catalog=new ExerciseCatalog(new Map());
 const draft=await catalog.createDraft({source:'const a: number = 1;\nconst b: string = a;',language:'typescript'});
 assert.equal(draft.audit.semantics,'errors');
 const imported=await catalog.createDraft({model:generateCodeLineExercise({source:'const a = 1;\nconst b = a + 1;',language:'typescript'},ts)});
 assert.equal(imported.audit.semantics,'ok');
 assert.equal(imported.model.authoring.audit,undefined,'the audit is reported, never stored in the model');
});
