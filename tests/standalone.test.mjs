/** ADR-155: the standalone demonstration page. One file with a few finished exercises, the validator and the practice
 *  page. What derives rules from source code is not in it, and it checks exactly as the trusted server does. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {createPracticeApi} from '../dist/standalone/practice-api.js';
import {buildStandalone,DEFAULT_EXERCISES} from '../scripts/build-standalone.mjs';
import {inspectModule} from '../dist-tools/architecture-rules.js';

const built=await buildStandalone();
const html=await readFile(built.file,'utf8');
const catalog=await ExerciseCatalog.open(new URL('../examples/',import.meta.url).pathname);
const entries=DEFAULT_EXERCISES.map(id=>{const {authoring,...model}=catalog.trusted.get(id).model;return {summary:catalog.list().find(item=>item.id===id),model};});

test('the bundle holds the page, the practice engine and the core, and nothing that derives rules',()=>{
 assert.ok(built.inputs.includes('dist/standalone/practice-api.js')&&built.inputs.includes('dist/validator.js')&&built.inputs.includes('public/ui.js'));
 const forbidden=built.inputs.filter(file=>/^src\/author\/|^dist\/author\/|^dist\/server\/|^src\/server\/|node_modules\/typescript|\/pages-api\.js$|\/pages-worker\.js$|\/local-demo\.js$|\/api\.js$/.test(file));
 assert.deepEqual(forbidden,[],'author analysis, compiler, server or another API adapter in the bundle');
 assert.deepEqual(built.inputs.filter(file=>!/^(public|dist)\/|^standalone:/.test(file)),[],'an input from an unexpected place');
});
test('the page is one file: nothing is loaded from elsewhere, and no source map points back',()=>{
 assert.doesNotMatch(html,/<script[^>]*\ssrc=|<link\b|@import|sourceMappingURL/);
 assert.doesNotMatch(html,/url\((?!["']?(?:data:|#))/,'a reference to another file (a data URL or a fragment of this page is not one)');
 assert.match(html,/<title>CodeLineSorter – önálló bemutató<\/title>/);
 assert.ok(built.bytes<2*1024*1024,`the page is ${built.bytes} bytes`);
});
test('the shipped models leave behind how their rules were derived',()=>{
 assert.deepEqual(built.models.map(model=>model.id),DEFAULT_EXERCISES);
 assert.ok(catalog.trusted.get(DEFAULT_EXERCISES[0]).model.authoring,'the source model records its derivation');
 for(const model of built.models){
  assert.ok(!('authoring' in model),model.id);
  assert.ok(html.includes(JSON.stringify(model.title)),model.id+' is in the page');
  // The rules themselves stay: the validator needs them.
  assert.deepEqual(model.lines,catalog.trusted.get(model.id).model.lines,model.id);
 }
 for(const {model} of catalog.trusted.values())if(!DEFAULT_EXERCISES.includes(model.id))assert.ok(!html.includes(JSON.stringify(model.title)),model.id+' was not chosen');
 // The derivation records of the shipped exercises are nowhere in the page (the digest is unique to each).
 for(const id of DEFAULT_EXERCISES){const digest=JSON.stringify(catalog.trusted.get(id).model.authoring).match(/[0-9a-f]{16}/)?.[0];assert.ok(digest&&!html.includes(digest),id);}
});
test('an exercise the catalogue does not serve cannot be shipped',async()=>{
 await assert.rejects(buildStandalone(['no-such-exercise']),/No served exercise named no-such-exercise/);
 await buildStandalone();
});
test('the practice engine lists and checks exactly as the trusted server does',async()=>{
 const api=createPracticeApi(entries);
 assert.equal(api.validationMode,'local-demo');
 assert.deepEqual(await api.getExercises(),entries.map(entry=>entry.summary));
 for(const {model} of entries){
  const reference=model.lines.map(line=>line.code),free=model.lines.map((line,index)=>line.fixed?-1:index).filter(index=>index>=0);
  const moved=[...reference];[moved[free[0]],moved[free.at(-1)]]=[moved[free.at(-1)],moved[free[0]]];
  for(const lines of [reference,moved,reference.slice(1),[...reference].reverse()]){
   const body={exerciseId:model.id,revision:model.revision,lines};
   assert.deepEqual(await api.evaluate(body),catalog.evaluate(body),model.id);
  }
  assert.equal((await api.evaluate({exerciseId:model.id,revision:model.revision,lines:reference})).status,'accepted');
 }
 await assert.rejects(api.evaluate({exerciseId:'elsewhere',revision:1,lines:[]}),/Ismeretlen feladat/);
 await assert.rejects(api.evaluate(null),/Ismeretlen feladat/);
});
test('the practice engine serves no authoring and offers the server adapter’s operations',async()=>{
 const api=createPracticeApi(entries),server=await import('../public/app/api.js');
 assert.deepEqual(Object.keys(api).sort(),Object.keys(server).sort());
 assert.equal(await api.authorAccess(),false);
 for(const name of ['compileDraft','checkSource','resolvePolicy','previewDraft','editRules','formatSource','loadTypeScriptFixture'])await assert.rejects(api[name]({}),/nem érhető el/,name);
 assert.throws(()=>createPracticeApi([{summary:{id:'broken'},model:{id:'broken'}}]),/Invalid exercise broken/);
});
test('the practice engine may reach the core’s public interface and nothing else',()=>{
 const rules=source=>inspectModule('src/standalone/practice-api.ts',source).map(violation=>violation.rule);
 assert.deepEqual(rules("import {diagnoseSubmission} from '../../dist/index.js';"),[]);
 assert.ok(rules("import {authorRuleSheet} from '../../dist/author/engine.js';").includes('standalone-boundary'));
 assert.ok(rules("import {generateCodeLineExercise} from '../author/generator.mjs';").includes('standalone-boundary'));
 assert.ok(rules("import {placement} from '../../dist/placement.js';").includes('standalone-boundary'));
 assert.ok(rules("export const load=()=>fetch('/api/exercises');").includes('standalone-boundary'));
});
