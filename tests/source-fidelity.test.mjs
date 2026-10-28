/** G1: source fidelity across the whole round trip — source → model → IDE projection → grading →
 * editor text → session export/import → model JSON. Whitespace is part of a row only where the row
 * is `exact`; an `indent` row's indentation is a presentation choice (formatter.js). */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {createAttempt,createAttemptController} from '../public/app/attempt.js';
import {exportSession,restoreAttempt,parseImport} from '../public/app/persistence.js';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
const root='public/samples/typescript/';
const suite=JSON.parse(await readFile(root+'suite.json','utf8'));
const sources=[
 ...await Promise.all(suite.map(async e=>[e.id,'typescript',await readFile(root+e.id+'.ts','utf8')])),
 ['template with blank and trailing whitespace','javascript','const s = `a\n\n  b\t `;\nlog(s);'],
 ['tab indentation','javascript','function f() {\n\tconst a = 1;\n\treturn a;\n}'],
 ['line continuation in a string','javascript','const s = "a\\\n  b";\nlog(s);'],
 ['unicode and CRLF-free blank lines','typescript','const név: string = "ő";\n\nconsole.log(név);\n']];
const grade=(compiled,model,lines)=>validateSubmission(compiled,{exerciseId:model.id,revision:model.revision,lines});
for(const [id,language,source] of sources)test(`source fidelity: ${id}`,()=>{
 const model=generateCodeLineExercise({source,language},ts),codes=model.lines.map(line=>line.code);
 // Source → model: every row verbatim and in order; only blank lines outside exact rows are dropped.
 let k=0;
 for(const line of source.replace(/\n+$/,'').split('\n')){if(codes[k]===line)k++;else assert.equal(line.trim(),'',`a non-blank source line is lost or changed: ${JSON.stringify(line)}`);}
 assert.equal(k,codes.length,'the model has no row the source lacks');
 // Model → IDE projection: exact rows verbatim, indent rows differ at most in leading whitespace.
 const attempt=createAttempt(model),controller=createAttemptController(()=>model,()=>attempt);
 assert.equal(controller.applyText(codes.join('\n')).ok,true);
 const shown=controller.formattedAnswer();
 model.lines.forEach((line,i)=>line.normalization==='exact'?assert.equal(shown[i],line.code,'exact row verbatim'):assert.equal(shown[i].replace(/^[ \t]+/,''),line.code.replace(/^[ \t]+/,''),'indent row: only indentation may change'));
 // Projection → grading: what the learner sees is graded as the reference.
 const {compiled}=compileCodeLineExercise(model);
 assert.equal(grade(compiled,model,shown).accepted,true,'the displayed rows are accepted');
 // Projection → editor text → attempt: the same arrangement comes back.
 const again=createAttempt(model),editor=createAttemptController(()=>model,()=>again);
 assert.equal(editor.applyText(shown.join('\n')).ok,true);assert.deepEqual(again.answer,attempt.answer);
 // Session export → JSON → import: identical arrangement and identical text.
 const restored=restoreAttempt(parseImport(JSON.stringify(exportSession(model,attempt))),model),reader=createAttemptController(()=>model,()=>restored);
 assert.deepEqual([restored.answer,restored.pool,[...restored.custom]],[attempt.answer,attempt.pool,[...attempt.custom]]);
 assert.deepEqual(reader.formattedAnswer(),shown);
 // Model → JSON → model: admitted to the same compiled definition, and the reference stays accepted.
 const reread=compileCodeLineExercise(JSON.parse(JSON.stringify(model)));
 assert.deepEqual(reread.compiled.definition,compiled.definition);
 assert.equal(grade(reread.compiled,model,codes).accepted,true);
});
