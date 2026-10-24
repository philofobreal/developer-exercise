import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {getLanguageAdapter,registerLanguageAdapter,languageIds} from '../src/author/languages.mjs';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {createAttempt,createAttemptController} from '../public/app/attempt.js';
test('JavaScript syntax audit rejects TypeScript constructs and invalid grammar',()=>{
 for(const source of ['const a: number = 1;','interface X {}','return 1;','break;','const a = ;'])assert.throws(()=>getLanguageAdapter('javascript').parse(source,ts),/Szintaktikai/);
 for(const source of ['const a = /}/;','export const a = 1;','await Promise.resolve();'])assert.ok(getLanguageAdapter('javascript').parse(source,ts));
});
test('adapter supplies formatter, AST tokens, structure and safe whitespace policy',()=>{
 const a=getLanguageAdapter('typescript'),file=a.parse('function f<T>(x:T) {\n return x;\n}',ts);
 assert.ok(a.tokenize(file,ts).some(x=>x.text==='return'));assert.equal(a.structure(file,ts)[0].kind,'function');assert.equal(a.whitespace(file,ts).size,0);assert.match(a.format('const x:number=1;\n',ts).code,/number/);
});
test('new language adapter registration has no JS formatter requirement',()=>{
 const adapter={parse:x=>x,format:x=>({code:x}),tokenize:()=>[],structure:()=>[],whitespace:()=>new Set()};
 registerLanguageAdapter('test-language',adapter);assert.equal(getLanguageAdapter('test-language').format('  original').code,'  original');assert.ok(languageIds().includes('test-language'));assert.throws(()=>registerLanguageAdapter('test-language',adapter));assert.throws(()=>registerLanguageAdapter('incomplete',{}));
});
test('binding hints distinguish shadowed declarations without relaxing serial rules',()=>{
 const source='function f() {\n const x = 1;\n if (ok) {\n const x = 2;\n use(x);\n }\n return x;\n}';
 const model=generateCodeLineExercise({source,language:'javascript'},ts);
 const hints=model.authoring.dependencyHints.filter(x=>x.name==='x');assert.ok(hints.some(x=>x.declarationLine===4&&x.usageLine===5));assert.ok(hints.some(x=>x.declarationLine===2&&x.usageLine===7));assert.equal(model.authoring.semanticEquivalenceProven,false);assert.deepEqual(model.lines[4].dependencies,[4]);
});
test('editor roundtrip retains whitespace-only exact template rows',()=>{
 const e=generateCodeLineExercise({source:'const s = `a\n\n  b`;',language:'javascript'},ts),a=createAttempt(e),controller=createAttemptController(()=>e,()=>a);
 assert.equal(controller.applyText(e.lines.map(x=>x.code).join('\n')).ok,true);assert.equal(a.answer.filter(x=>x!==null).length,3);assert.equal(a.pool.length,0);
});
