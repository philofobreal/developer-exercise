/** ADR-013 import ordering. The evidence is TypeScript's own emit (transpileModule,
 * ES modules), independent of the generator's analysis: under each emit context an
 * import may move only if the emit drops it, and the imports the emit keeps (they
 * load modules, an observable effect) keep their relative order. Learner input is
 * never parsed or run; only fixed reference sources are compiled here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';

const copyField=await readFile(new URL('./fixtures/copy-field-utility.service.ts',import.meta.url),'utf8');
/** Module specifiers of the import declarations the emit keeps. */
function keptByEmit(source,importEmit){
 const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,verbatimModuleSyntax:importEmit==='verbatim'}}).outputText;
 const file=ts.createSourceFile('emit.js',output,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 return file.statements.filter(ts.isImportDeclaration).map(node=>node.moduleSpecifier.text);
}
function setup(source,importEmit,language='typescript'){
 const model=generateCodeLineExercise({source,language,importEmit},ts),compiled=compileCodeLineExercise(model);
 assert.ok(!compiled.status,compiled.message);
 const grade=order=>validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:order.map(id=>model.lines[id-1].code)},{maxStates:200_000}).status;
 const file=ts.createSourceFile('x.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 // Single-row import declarations: line ID and module specifier.
 const imports=file.statements.filter(node=>ts.isImportDeclaration(node)&&file.getLineAndCharacterOfPosition(node.getStart(file)).line===file.getLineAndCharacterOfPosition(node.end).line)
  .map(node=>({id:model.lines.find(line=>line.sourceLine===file.getLineAndCharacterOfPosition(node.getStart(file)).line+1).id,module:node.moduleSpecifier.text}));
 return {model,grade,imports};
}
/** Every pair swap of single-row imports: accepted exactly when the kept imports keep their order. */
function checkPairs(source,importEmit){
 const {model,grade,imports}=setup(source,importEmit),kept=new Set(keptByEmit(source,importEmit)),reference=model.lines.map(line=>line.id);
 let accepted=0,rejected=0;
 for(let i=0;i<imports.length;i++)for(let j=i+1;j<imports.length;j++){
  const order=[...reference],a=order.indexOf(imports[i].id),b=order.indexOf(imports[j].id);[order[a],order[b]]=[order[b],order[a]];
  const keptOrder=list=>list.filter(id=>imports.some(entry=>entry.id===id&&kept.has(entry.module)));
  const expected=keptOrder(order).join()===keptOrder(reference).join()?'accepted':'rejected';
  assert.equal(grade(order),expected,`${importEmit}: ${imports[i].module} <-> ${imports[j].module}`);
  expected==='accepted'?accepted++:rejected++;
 }
 return {accepted,rejected,kept:kept.size,imports:imports.length};
}

test('CopyFieldUtilityService: import swaps follow the TypeScript emit in both emit contexts',t=>{
 const verbatim=checkPairs(copyField,'verbatim'),elided=checkPairs(copyField,'elide-unused');
 // verbatimModuleSyntax keeps every import: all of them load a module, none may move.
 assert.equal(verbatim.kept,verbatim.imports+1);assert.equal(verbatim.accepted,0);
 // The default emit drops the type-only uses (lines 5–7 among them), which then commute.
 assert.ok(elided.accepted>0&&elided.rejected>0);
 t.diagnostic(JSON.stringify({verbatim,elided}));
});

test('CopyFieldUtilityService lines 5–7: free only when the emit drops them',()=>{
 for(const [importEmit,status] of [['verbatim','rejected'],['elide-unused','accepted']]){
  const {model,grade}=setup(copyField,importEmit),reference=model.lines.map(line=>line.id),at=row=>reference.indexOf(model.lines.find(line=>line.sourceLine===row).id);
  for(const [a,b] of [[5,6],[6,7],[5,7]]){const order=[...reference];[order[at(a)],order[at(b)]]=[order[at(b)],order[at(a)]];assert.equal(grade(order),status,`${importEmit} ${a}<->${b}`);}
 }
});

const crafted=[
 "import type { Shape } from './shape';",
 "import './polyfill';",
 "import { type Size } from './size';",
 "import { Builder } from './builder';",
 "import { Mixed, type Hidden } from './mixed';",
 "import { Unused } from './unused';",
 '',
 'export function make(shape: Shape, size: Size, hidden: Hidden): unknown {',
 '  return [new Builder(shape, size), Mixed, hidden];',
 '}'].join('\n');
test('crafted imports: type-only, specifier type, side effect, value, mixed and unused',t=>{
 const verbatim=checkPairs(crafted,'verbatim'),elided=checkPairs(crafted,'elide-unused');
 // Evidence for the expectations above, straight from the emit.
 assert.deepEqual(keptByEmit(crafted,'verbatim'),['./polyfill','./size','./builder','./mixed','./unused']);
 assert.deepEqual(keptByEmit(crafted,'elide-unused'),['./polyfill','./builder','./mixed']);
 t.diagnostic(JSON.stringify({verbatim,elided}));
});

test('decorated files keep every non-type import ordered (decorator metadata may reference types)',()=>{
 const source=["import { Injectable } from './di';","import { Shape } from './shape';","import { Size } from './size';",'','@Injectable()','export class Service {','  area(shape: Shape, size: Size): number { return 1; }','}'].join('\n');
 const {model,grade}=setup(source,'elide-unused');
 assert.equal(grade([1,3,2,...model.lines.slice(3).map(line=>line.id)]),'rejected');
});

test('JavaScript imports always load their module',()=>{
 const source=["import { a } from './a.js';","import { b } from './b.js';",'export const c = 1;'].join('\n');
 const model=generateCodeLineExercise({source,language:'javascript',importEmit:'elide-unused'},ts),compiled=compileCodeLineExercise(model);
 assert.equal(validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:[model.lines[1].code,model.lines[0].code,model.lines[2].code]}).status,'rejected');
});

test('an unknown import emit setting is refused',()=>{
 assert.throws(()=>generateCodeLineExercise({source:'const a = 1;',language:'typescript',importEmit:'guess'},ts),/import-emit/);
});
