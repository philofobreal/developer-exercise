import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const ts=await (async()=>{try{return (await import('typescript')).default;}catch{return (await import(pathToFileURL(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript/lib/typescript.js')).href)).default;}})();
import {formatTypedSource} from '../src/author/ts-format.mjs';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
const raw=fs.readFileSync(new URL('./fixtures/copy-field-utility.service.ts',import.meta.url),'utf8');
const source=ts.createSourceFile('fixture.ts',raw,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
function parse(code){const f=ts.createSourceFile('fixture.ts',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);assert.equal(f.parseDiagnostics.length,0,f.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('\n'));return f;}
function namedMethods(code){const f=parse(code),items=[];const go=n=>{if(ts.isMethodDeclaration(n)||ts.isConstructorDeclaration(n)||ts.isGetAccessorDeclaration(n)||ts.isSetAccessorDeclaration(n)||ts.isPropertyDeclaration(n)&&n.initializer&&ts.isArrowFunction(n.initializer))items.push({name:n.name?.getText(f)||'constructor',code:n.getText(f)});ts.forEachChild(n,go);};go(f);return items;}
const methods=namedMethods(raw);
assert.equal(methods.length,31,'A mellékelt service 31 vizsgált osztálytagot tartalmaz.');
function getModel(code){const model=generateCodeLineExercise({source:code,language:'typescript'},ts);const compiled=compileCodeLineExercise(model);assert.equal('status' in compiled,false,compiled.message);const accepted=validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:model.lines.map(x=>x.code)},{maxStates:30000});assert.equal(accepted.status,'accepted',accepted.message);return {model,compiled:compiled.compiled};}
test('a teljes melléklet formázása megőrzi a 31 TS tagot és szintaktikailag érvényes',()=>{
const formatted=formatTypedSource(raw,'typescript',ts);assert.equal(formatted.formatter,'typescript-language-service');parse(formatted.code);
assert.deepEqual(namedMethods(formatted.code).map(x=>x.name),methods.map(x=>x.name));
assert.equal(formatTypedSource(formatted.code,'typescript',ts).code,formatted.code,'A TS formázás idempotens');
const {model,compiled}=getModel(formatted.code);assert.equal(model.lines.length,436);assert.equal(model.authoring?.strategy,'conservative-serial');
const changed=model.lines.map(x=>x.code);changed[0]='import { WHAT } from "other";';
assert.equal(validateSubmission(compiled,{exerciseId:model.id,revision:1,lines:changed}).status,'rejected');
});
for(const [index,entry] of methods.entries()){
 test(`TypeScript metódus ${String(index+1).padStart(2,'0')}/31: ${entry.name} – formázás → generálás → rendezés → validáció`,()=>{
   const snippet=`class TestFixture {\n${entry.code}\n}`;
   parse(snippet);
   const formatted=formatTypedSource(snippet,'typescript',ts).code;
   const after=parse(formatted);
   assert.equal(namedMethods(formatted).length,1,`Method not preserved: ${entry.name}`);
   assert.equal(namedMethods(formatted)[0].name,entry.name);
   assert.equal(formatTypedSource(formatted,'typescript',ts).code,formatted,'Not idempotent');
   const {model,compiled}=getModel(formatted);
   assert.ok(model.lines.length>0);
   const swapped=model.lines.map(x=>x.code);
   const different=swapped.findIndex((x,i)=>i>0&&x.trim()!==swapped[i-1].trim());
   if(different>0){[swapped[different],swapped[different-1]]=[swapped[different-1],swapped[different]];
     assert.equal(validateSubmission(compiled,{exerciseId:model.id,revision:1,lines:swapped}).status,'rejected',`Bad permutation accepted ${entry.name}`);
   }
 });
}
test('JS/TS formatting errors fail closed with line number',()=>{
assert.throws(()=>formatTypedSource('class X { call(: number) {} }','typescript',ts),/Szintaktikai hiba/);
assert.throws(()=>formatTypedSource('function broken( {','javascript',ts),/Szintaktikai hiba/);
});
test('TypeScript generics, object return types, signatures, callbacks survive formatter',()=>{
const targets=['copy','mergeUnique','removeCopiedFieldedItems','getChildFields','mapInteractionWithNewTargetIds'];
for(const target of targets){const method=methods.find(m=>m.name===target);assert.ok(method);
 const s=formatTypedSource(`class Example {\n${method.code}\n}`,'typescript',ts).code;
 assert.equal(namedMethods(s)[0].name,target);getModel(s);
}
});
test('Full TS file: no missing content due to discarded whitespace-only lines',()=>{
const model=getModel(raw).model;assert.equal(model.lines.length,raw.split('\n').filter(x=>x.trim()).length);
assert.ok(model.lines.some(x=>x.code.includes('copy(')));
assert.ok(model.lines.some(x=>x.code.includes('private mergeUnique<T')));
});
