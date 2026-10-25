import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {generateCodeLineExercise,AuthoringError} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
async function parser(){try{return (await import('typescript')).default;}catch{return (await import(pathToFileURL(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript/lib/typescript.js')).href)).default;}}
const ts=await parser();
const make=(code,language='javascript')=>generateCodeLineExercise({source:code,language},ts);
const check=(model,lines)=>{const compiled=compileCodeLineExercise(model);assert.equal('status' in compiled,false,compiled.message);return validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines});};
test('user authored JS source creates serial dependencies, function and nested block',()=>{
const m=make(`function sum(arr) {\n  let total = 0;\n  for (const x of arr) {\n    total += x;\n  }\n  return total;\n}`);
// The serial order is unchanged; return additionally lists its value input `let total` (ADR-008 retained read edge).
assert.equal(m.lines.length,7);assert.deepEqual(m.lines.map(x=>x.dependencies),[[],[1],[2],[3],[4],[2,5],[6]]);
assert.equal(m.blocks.length,2);assert.deepEqual(m.blocks.map(b=>b.kind),['function','block']);assert.equal(m.lines[3].scopeId,m.blocks[1].id);
assert.equal(check(m,m.lines.map(x=>x.code)).status,'accepted');
const swapped=m.lines.map(x=>x.code);[swapped[4],swapped[6]]=[swapped[6],swapped[4]];
assert.equal(check(m,swapped).status,'accepted');
const invalid=m.lines.map(x=>x.code);[invalid[1],invalid[3]]=[invalid[3],invalid[1]];
assert.equal(check(m,invalid).status,'rejected');
});
test('TS source with return object inline braces generates one function block',()=>{
const m=make(`function value(a: number): { x: number } {\n  const x = a * 2;\n  return { x };\n}`,'typescript');
assert.equal(m.blocks.length,1);assert.equal(m.lines[2].functionBlock,1);assert.equal(check(m,m.lines.map(x=>x.code)).status,'accepted');
});
test('arrow function block owner inferred via TS AST',()=>{
const m=make(`const f = (a) => {\n  return a + 1;\n};`);
assert.equal(m.blocks[0].kind,'function');assert.equal(m.lines[2].functionBlock,1);
assert.equal(check(m,m.lines.map(x=>x.code)).status,'accepted');
});
test('multi-line invalid and mixed brace boundaries fail closed',()=>{
assert.throws(()=>make('function o(){\n if (yes) { hi(); }\n } else {\n bye();\n}'),AuthoringError);
assert.throws(()=>make('function o(){\n'),AuthoringError);
});
test('generated strict model can be edited to permit independent lines',()=>{
const m=make(`function add() {\nconst a = 1;\nconst b = 2;\nreturn a + b;\n}`);
m.lines[2].dependencies=[1];m.lines[3].dependencies=[2,3];
const shuffled=m.lines.map(x=>x.code);[shuffled[1],shuffled[2]]=[shuffled[2],shuffled[1]];
assert.equal(check(m,shuffled).status,'accepted');
});

test('TS authoring preserves physical source indentation, used when rendering partial solutions',()=>{
 const sample=`function typed(a: number) {\n     const value: number = a + 1;\n     return value;\n}`;
 const model=make(sample,'typescript');
 assert.equal(model.lines[1].code,'     const value: number = a + 1;');
 assert.equal(model.lines[2].code,'     return value;');
 assert.equal(check(model,model.lines.map(x=>x.code)).status,'accepted');
});
