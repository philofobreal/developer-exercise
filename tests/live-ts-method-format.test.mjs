import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {formatForIDE} from '../public/formatter.js';
import {createAttempt,createAttemptController} from '../public/app/attempt.js';
import {formatTypedSource} from '../src/author/ts-format.mjs';
const ts=await (async()=>{try{return (await import('typescript')).default;}catch{return (await import(pathToFileURL(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript/lib/typescript.js')).href)).default;}})();
const raw=fs.readFileSync(new URL('./fixtures/copy-field-utility.service.ts',import.meta.url),'utf8');
function methods(code){const root=ts.createSourceFile('service.ts',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);const output=[];
const walk=x=>{if(ts.isMethodDeclaration(x)||ts.isConstructorDeclaration(x)||ts.isGetAccessorDeclaration(x)||ts.isSetAccessorDeclaration(x)||ts.isPropertyDeclaration(x)&&x.initializer&&ts.isArrowFunction(x.initializer))output.push(x.getText(root));ts.forEachChild(x,walk);};walk(root);return output;}
const methodFixtures=methods(raw);
assert.equal(methodFixtures.length,31);
for(let i=0;i<methodFixtures.length;i++){
 const code=methodFixtures[i];
 test(`live indent TS method ${i+1}/31: source unchanged after every permutation`,()=>{
    const body=formatTypedSource('class Fixture {\n'+code+'\n}','typescript',ts).code;
    const lines=body.split('\n').filter(x=>x.trim());
    const result=formatForIDE(lines,{language:'typescript',beautify:()=>{throw Error('JS beautifier called for TS');}});
    assert.equal(result.length,lines.length);
    assert.deepEqual(result.map(x=>x.trim()),lines.map(x=>x.trim()));
    const partial=formatForIDE(lines.slice(0,Math.ceil(lines.length/2)).reverse(),{language:'typescript'});
    assert.deepEqual(partial.map(x=>x.trim()),lines.slice(0,Math.ceil(lines.length/2)).reverse().map(x=>x.trim()));
    assert.ok(result.every(x=>!/[\r\n]/.test(x)));
 });
}
test('Full 436-line formatted TS fixture dynamically re-indents with zero token loss',()=>{
 const body=formatTypedSource(raw,'typescript',ts).code;
 const rows=body.split('\n').filter(x=>x.trim());assert.equal(rows.length,436);
 const projected=formatForIDE(rows,{language:'typescript'});
 assert.deepEqual(projected.map(x=>x.trim()),rows.map(x=>x.trim()));
 assert.ok(projected.some(x=>x.startsWith('     ')));
});
test('Moving initial declaration above function makes declaration unindented; reconstructing restores',()=>{
 const code=['function f() {','const a = 1;','return a;','}'];
 const e={language:'javascript',lines:code.map((line,i)=>({id:i+1,code:line,fixed:false}))};
 const a=createAttempt(e),ctl=createAttemptController(()=>e,()=>a);
 for(let i=0;i<4;i++)assert.equal(ctl.intoSolution(0,i),true);
 assert.deepEqual(ctl.formattedAnswer().map(x=>x.trim()),code);
 assert.equal(ctl.formattedAnswer()[1],'     const a = 1;');
 ctl.swap(0,1);
 assert.equal(ctl.formattedAnswer()[0],'const a = 1;');
 assert.equal(ctl.formattedAnswer()[1],'function f() {');
 assert.equal(ctl.formattedAnswer()[2],'     return a;');
});
test('Editor commit retains blank target slots and does not change stable IDs',()=>{
 const code=['function f() {','return 1;','}'];const ex={language:'javascript',lines:code.map((s,i)=>({id:i+1,code:s,normalization:'indent',fixed:false}))};
 const a=createAttempt(ex),ops=createAttemptController(()=>ex,()=>a);
 assert.deepEqual(ops.applyText('function f() {\n\n}'),{ok:true});
 assert.deepEqual(a.answer,[1,null,3]);
 assert.deepEqual(a.pool,[2]);
});
