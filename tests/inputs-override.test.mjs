/** ADR-126 (NY-29): when the `valid` input contract was asked for but the program can change what a read does, the
 *  analysis stays strict and now records why and where (`authoring.evidence.environment.inputsOverride`); the
 *  Elemzés és szabályok step shows it as asked → effective, with a link to the line. Explanation only: no rule changes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise} from '../dist/index.js';
import {renderInputsContract} from '../public/app/preflight-settings.js';

const override=(source,inputs='valid',language='javascript')=>generateCodeLineExercise({source,language,inputs},ts).authoring.evidence.environment.inputsOverride;

test('what takes the contract back is named with its line: a hook, a computed accessor, a name reached unspelled',()=>{
 assert.deepEqual(override('const p = new Proxy({}, {});\nconst a = p.x;'),{effective:'any',reason:'hook',line:1,text:'Proxy'});
 assert.deepEqual(override('const o = {};\nObject.defineProperty(o, "x", {get() { return 1; }});'),{effective:'any',reason:'hook',line:2,text:'defineProperty'});
 assert.deepEqual(override('const k = "x";\nclass A {\n  get [k]() { return 1; }\n}'),{effective:'any',reason:'computed-accessor',line:3});
 assert.deepEqual(override("const P = globalThis['Pro' + 'xy'];\nconst p = new P({}, {});\nconst a = p.x;"),{effective:'any',reason:'computed-name'});
});

test('nothing is recorded where the contract applies, or where it was not asked for',()=>{
 assert.equal(override('function f(o) {\n  return o.a + o.b;\n}'),undefined);
 assert.equal(override('const p = new Proxy({}, {});','any'),undefined);
});

test('the rules do not change: the override only explains the strict analysis it records',()=>{
 const source='const p = new Proxy({}, {});\nconst a = p.x;\nconst b = p.y;';
 const strict=generateCodeLineExercise({source,language:'javascript',inputs:'any'},ts),asked=generateCodeLineExercise({source,language:'javascript',inputs:'valid'},ts);
 assert.deepEqual(asked.lines.map(line=>line.dependencies),strict.lines.map(line=>line.dependencies));
 assert.equal(asked.authoring.evidence.environment.inputs,'valid','the request is still recorded as asked');
 const compiled=compileCodeLineExercise(asked);assert.ok(!('status' in compiled),'the schema admits the new field');
 const forged=structuredClone(asked);forged.authoring.evidence.environment.inputsOverride.extra=1;
 assert.ok('status' in compileCodeLineExercise(forged),'and nothing more in it');
});

test('the 436-line TypeScript sample: the contract is taken back by the type name `Function` (NY-34 records the imprecision)',()=>{
 const source=readFileSync(new URL('../public/samples/copy-field-utility.service.ts',import.meta.url),'utf8');
 const found=override(source,'valid','typescript');
 assert.equal(found.reason,'hook');assert.equal(found.text,'Function');
 assert.match(source.split('\n')[found.line-1],/func: Function/);
});

test('the Rules step says asked → effective, why, and links the line; without an override only the value',()=>{
 assert.equal(renderInputsContract({inputs:'valid'}),'<span data-inputs-contract>Bemenetek: <b>érvényes egyszerű adat</b></span>');
 assert.equal(renderInputsContract({inputs:'any'}),'<span data-inputs-contract>Bemenetek: <b>szigorú</b></span>');
 const hook=renderInputsContract({inputs:'valid',inputsOverride:{effective:'any',reason:'hook',line:7,text:'<Proxy>'}});
 assert.match(hook,/data-inputs-override="hook">Bemenetek: <b>érvényes egyszerű adat → szigorú lett<\/b>, mert <button type="button" class="diagnostic-line" data-goto-line="7"/);
 assert.ok(hook.includes('„&lt;Proxy&gt;”'),'the matched text is escaped');assert.match(hook,/data-help="inputs"/);
 assert.match(renderInputsContract({inputs:'valid',inputsOverride:{effective:'any',reason:'computed-name'}}),/mert a program nem kiírt néven ér el beépített API-t\./);
 assert.match(renderInputsContract({inputs:'valid',inputsOverride:{effective:'any',reason:'computed-accessor',line:3}}),/3\. sor<\/button>: számított nevű accessor/);
});
