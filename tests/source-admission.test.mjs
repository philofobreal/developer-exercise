/** ADR-103: three admission defects found by probing the author and attempt paths.
 *  1. A deeply nested or very long TypeScript source exhausted the recursive parser (`RangeError`), and
 *     the server answered with a misleading "TypeScript parser unavailable"; a lexical nesting budget,
 *     measured with the compiler's linear scanner before any parse, and a stack guard refuse it clearly.
 *  2. A leading byte order mark stayed in the first row's content.
 *  3. In the code view a trailing space or a no-break-space indentation made a typed row "not allowed". */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {AuthoringError} from '../src/author/errors.mjs';
import {MAX_NESTING,nestingExcess} from '../dist/author/source-nesting.js';
import {catalog,PROGRAM_KINDS} from './support/fixture-catalog.mjs';
import {createAttempt,createAttemptController} from '../public/app/attempt.js';

const nested=n=>'const x = '+'['.repeat(n)+']'.repeat(n)+';';
const refused=(source,language,pattern)=>assert.throws(()=>generateCodeLineExercise({source,language},ts),error=>error instanceof AuthoringError&&pattern.test(error.message),language+': '+source.slice(0,40));

test('the nesting scanner ignores brackets in strings, comments, regular expressions and template text',()=>{
 const depth=source=>{let limit=0;while(nestingExcess(source,ts,limit))limit++;return limit;};
 assert.equal(depth('const s = "(((((((";'),0);
 assert.equal(depth('// ((((((\n/* [[[[ */ const a = 1;'),0);
 assert.equal(depth('const r = /((((((/g;'),0);
 assert.equal(depth('const s = x.replace(/[[[[/, "");'),1);
 assert.equal(depth('const a = (b) / (c) / 2;'),1);
 assert.equal(depth('const t = `{{{{${x}}}}}`;'),1);
 assert.equal(depth('const t = `a ${ `b ${ `c ${d}` }` } e`;'),3);
 assert.deepEqual(nestingExcess(nested(MAX_NESTING),ts),null);
 assert.deepEqual(nestingExcess('let a;\n'+nested(MAX_NESTING+1),ts),{line:2});
});

test('every source of the repository stays far inside the nesting budget',()=>{
 const sources=[...catalog().map(f=>Array.isArray(f.source)?f.source.join('\n'):f.source)];
 for(const kind of Object.keys(PROGRAM_KINDS))for(const language of ['javascript','typescript'])for(let seed=1;seed<=12;seed++){const p=PROGRAM_KINDS[kind](seed,{language});if(p)sources.push(p.source.join('\n'));}
 for(const source of sources)assert.equal(nestingExcess(source,ts,16),null,source.slice(0,60));
});

test('too deep or too long sources are refused with an author error, in both languages, never a RangeError',()=>{
 for(const language of ['javascript','typescript']){
  for(const n of [MAX_NESTING+1,1000,3000])refused(nested(n),language,/Túl mély egymásba ágyazás a\(z\) 1\. sorban/);
  refused(Array.from({length:70},()=>'if (a) {').join('\n')+'\n'+Array.from({length:70},()=>'}').join('\n'),language,/65\. sorban/);
  refused('const y = 1'+' + 1'.repeat(10000)+';',language,/túl hosszú vagy túl összetett/);
 }
 assert.equal(generateCodeLineExercise({source:nested(MAX_NESTING),language:'typescript'},ts).lines.length,1);
});

test('a leading byte order mark is not part of the first row',()=>{
 const model=generateCodeLineExercise({source:'﻿const a = 1;\nconst b = 2;',language:'javascript'},ts);
 assert.equal(model.lines[0].code,'const a = 1;');
});

test('code view: trailing whitespace and no-break-space indentation match an indent row; an exact row stays exact',()=>{
 const model=generateCodeLineExercise({source:'function f() {\n  const s = `a\n   b`;\n  return s;\n}',language:'javascript'},ts);
 const exact=model.lines.find(line=>line.normalization==='exact');
 assert.ok(exact,'the template continuation row is exact');
 const typed=model.lines.map(line=>line.normalization==='exact'?line.code:line.code.replace(/^[ \t]*/,'  ')+'  ');
 const attempt=createAttempt(model),controller=createAttemptController(()=>model,()=>attempt);
 assert.equal(controller.applyText(typed.join('\n')).ok,true);
 assert.deepEqual(attempt.answer,model.lines.map(line=>line.id),'every row matched its reference row');
 assert.equal(attempt.custom.size,0);
 // The exact row does not tolerate a changed whitespace: it stays the learner's own text.
 const changed=model.lines.map(line=>line===exact?line.code+' ':line.code);
 const again=createAttempt(model),editor=createAttemptController(()=>model,()=>again);
 assert.equal(editor.applyText(changed.join('\n')).ok,true);
 assert.equal(again.custom.size,1);
});

test('HTTP: a too deep author source is a clear 400, not "parser unavailable"',async t=>{
 const port=await new Promise((resolve,reject)=>{const s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const url=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:'ignore'});
 t.after(()=>child.kill('SIGTERM'));
 let ok=false;for(let i=0;i<60&&!ok;i++){try{ok=(await fetch(url+'/api/exercises')).ok;}catch{}if(!ok)await new Promise(r=>setTimeout(r,70));}
 assert.ok(ok,'Server did not start');
 const r=await fetch(url+'/api/author/compile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:nested(2000),language:'typescript'})});
 assert.equal(r.status,400);
 assert.match((await r.json()).error,/Túl mély egymásba ágyazás/);
});
