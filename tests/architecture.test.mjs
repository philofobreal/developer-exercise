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
 ['src/workbench/bad.ts','// @ts-nocheck\nconst bad = 1;','strictness']
])test('architecture gate rejects '+rule+' in '+file,()=>assert.ok(inspectModule(file,source).some(error=>error.rule===rule)));
test('architecture gate permits type-only core contract and local presentation modules',()=>{
 assert.deepEqual(inspectModule('src/workbench/good.ts',"import type {ValidationResult} from '../../dist/index.js';import {icon} from './icons.js';"),[]);
});
