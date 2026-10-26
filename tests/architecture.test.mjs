import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectModule} from '../dist-tools/architecture-rules.js';
for(const [file,source,rule] of [
 ['src/core/bad.ts',"import fs from 'node:fs';",'core-boundary'],
 ['src/core/bad.ts','document.body.textContent="bad";','core-platform'],
 ['src/workbench/bad.ts',"import {generateCodeLineExercise} from '../author/generator.mjs';",'presentation-boundary'],
 ['src/workbench/bad.ts','fetch("/api/evaluate");','presentation-policy'],
 ['src/author/bad.mjs',"import {readFile} from 'node:fs';",'author-boundary'],
 ['src/core/bad.ts','new Function("return 1");','no-execution'],
 ['src/workbench/bad.ts','const bad: any = 1;','strictness'],
 ['src/workbench/bad.ts','// @ts-nocheck\nconst bad = 1;','strictness'],
 ['src/server/bad.mjs',"import {createNodePythonParser} from '../python/node-parser.js';",'python-isolation'],
 ['src/python/browser-parser.ts',"import fs from 'node:fs';",'python-boundary'],
 ['src/python/runtime.ts','runtime.runPython(source);','python-source-data'],
 ['src/python/runtime.ts','runtime.runPythonAsync(source);','python-source-data'],
 ['src/python/runtime.ts','runtime.loadPackagesFromImports(source);','python-source-data']
])test('architecture gate rejects '+rule+' in '+file,()=>assert.ok(inspectModule(file,source).some(error=>error.rule===rule)));
test('architecture gate permits type-only core contract and local presentation modules',()=>{
 assert.deepEqual(inspectModule('src/workbench/good.ts',"import type {ValidationResult} from '../../dist/index.js';import {icon} from './icons.js';"),[]);
});
test('Python trusted bootstrap has the sole fixed runPython exception',()=>{
 assert.deepEqual(inspectModule('src/python/runtime.ts','runtime.runPython(PYTHON_AUDIT_BOOTSTRAP);'),[]);
 assert.ok(inspectModule('src/python/other.ts','runtime.runPython(PYTHON_AUDIT_BOOTSTRAP);').some(error=>error.rule==='python-source-data'));
});

test('typed author engine alone may call the shared compiler; other author algorithms retain their boundary',()=>{
 const source="import {compileCodeLineExerciseV3} from '../../dist/index.js';";
 assert.deepEqual(inspectModule('src/author/engine.ts',source),[]);
 assert.ok(inspectModule('src/author/another.ts',source).some(e=>e.rule==='author-boundary'));
 assert.ok(inspectModule('src/core/another.ts',"import {LanguageEngine} from '../author/engine.js';").some(e=>e.rule==='core-boundary'));
});

// ADR-011/013: the generator reaches only the typed, language-independent projection;
// only the language registry wires the JS/TS binding/effect analysis.
test('the generator may wire only the language-independent projection',()=>{
 assert.deepEqual(inspectModule('src/author/generator.mjs',"import {projectCodeLine} from '../../dist/author/code-line-projection.js';"),[]);
 for(const module of ['ordering-relations','type-member-ordering','statement-ordering','js-ts-ordering'])assert.ok(inspectModule('src/author/generator.mjs',`import {x} from '../../dist/author/${module}.js';`).some(error=>error.rule==='author-boundary'),module);
 assert.ok(inspectModule('src/author/another.mjs',"import {projectCodeLine} from '../../dist/author/code-line-projection.js';").some(error=>error.rule==='author-boundary'));
});

test('only the language registry may wire the JS/TS ordering analysis',()=>{
 const source="import {jsTsOrderingRelations} from '../../dist/author/js-ts-ordering.js';";
 assert.deepEqual(inspectModule('src/author/languages.mjs',source),[]);
 for(const file of ['src/author/generator.mjs','src/author/audit.mjs','src/author/dependency-analysis.mjs','src/author/another.mjs'])assert.ok(inspectModule(file,source).length,file);
 for(const module of ['type-member-ordering','statement-ordering'])assert.ok(inspectModule('src/author/languages.mjs',`import {x} from '../../dist/author/${module}.js';`).some(error=>error.rule==='author-boundary'),module);
 for(const file of ['src/author/statement-ordering.ts','src/author/type-member-ordering.ts','src/author/js-ts-ordering.ts','src/author/code-line-projection.ts'])assert.deepEqual(inspectModule(file,"import type ts from 'typescript';import {combineOrderingRelations} from './ordering-relations.js';"),[]);
});
