import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {auditReference} from '../src/author/audit.mjs';
const make=source=>generateCodeLineExercise({source,language:'typescript'},ts);
for(const source of [
 'class C {\n m<T>(\n x: T\n ): T {\n return x;\n }\n}',
 'function f() {\n if (ok) {\n yes();\n } else {\n no();\n }\n}',
 'function f() {\n try {\n run();\n } catch (e) {\n fail(e);\n } finally {\n cleanup();\n }\n}',
 'class C {\n m() {\n return items.map(x => {\n return /}/.test(x);\n });\n }\n}',
 'const object = {\n a: [\n { x: 1 }\n ]\n};'
])test('AST keeps representable hierarchy: '+source.split('\n')[0],()=>{
 const model=make(source);assert.ok(model.blocks.length);assert.equal(model.authoring.strategy,'ast-hierarchy');
 const result=compileCodeLineExercise(model);assert.ok(!result.status,result.message);
 assert.equal(validateSubmission(result.compiled,{exerciseId:model.id,revision:1,lines:model.lines.map(x=>x.code)}).status,'accepted');
});
test('author syntax audit rejects edited invalid source atomically',async()=>{
 const catalog=new ExerciseCatalog(new Map()),first=await catalog.createDraft({source:'const a = 1;'}),model=structuredClone(first.model);
 model.lines[0].code='const a = ;';await assert.rejects(catalog.createDraft({model}),/Szintaktikai/);
 assert.equal(catalog.drafts.size,1);assert.equal(catalog.preview({draftId:first.draftId,lines:['const a = 1;']}).status,'accepted');
});
test('multiline templates preserve blank payload rows and require exact normalization',()=>{
 const model=make('function f() {\n const s = `a\n\n  } b`;\n return s;\n}');
 assert.equal(model.lines[2].code,'');assert.equal(model.lines[2].normalization,'exact');auditReference(model,ts);
 model.lines[3].normalization='indent';assert.throws(()=>auditReference(model,ts),/exact/);
});
test('full service retains functions and scopes, never complete serial fallback',async()=>{
 const model=make(await readFile(new URL('./fixtures/copy-field-utility.service.ts',import.meta.url),'utf8'));
 assert.ok(model.blocks.length>20);assert.ok(model.lines.filter(x=>x.functionBlock>0).length>200);
});
