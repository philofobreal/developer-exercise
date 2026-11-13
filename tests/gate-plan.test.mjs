/** ADR-142: what the local gate runs for a change. The plan is conservative: the core, the author analysis, the oracle,
 * the examples, the toolchain and any path it does not know are checked with everything; only the presentation and the
 * documents are scoped to the unit tests that load or name a changed file. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {planGate} from '../dist-tools/gate-plan.js';

const deps=(name,files,directories=[])=>({test:name,files:new Set([name,...files]),directories});
const tests=[
 deps('tests/ui.test.mjs',['public/app/view.js','public/style.css']),
 deps('tests/engine.test.mjs',['dist/index.js','src/author/generator.mjs']),
 deps('tests/docs.test.mjs',[],['docs/adr/']),
 deps('tests/everything.test.mjs',[],['']),
];
const names=plan=>plan.unit.map(file=>file.replace('tests/','').replace('.test.mjs',''));

test('a presentation change runs the unit tests that load a changed file, and the browser suites',()=>{
 const plan=planGate(['src/workbench/view.ts','public/app/view.js'],tests);
 assert.equal(plan.full,false);assert.deepEqual(names(plan),['ui','everything']);assert.equal(plan.browser,true);
 assert.deepEqual(names(planGate(['public/style.css'],tests)),['ui','everything']);
});
test('a document change runs the tests that name its directory and skips the browser',()=>{
 const plan=planGate(['docs/adr/142-fast-deploy-and-local-gate.md','CHANGELOG.md'],tests);
 assert.equal(plan.full,false);assert.deepEqual(names(plan),['docs','everything']);assert.equal(plan.browser,false);
 assert.equal(planGate(['.github/workflows/ci.yml'],tests).browser,false);
});
test('a changed test runs itself; a browser test reaches the browser',()=>{
 assert.deepEqual(names(planGate(['tests/engine.test.mjs'],tests)),['engine','everything']);
 const plan=planGate(['tests/browser-workbench.playwright.py'],tests);assert.equal(plan.browser,true);assert.equal(plan.full,false);
});
test('the core, the author analysis, the server, generated output, the oracle, fixtures and examples are checked with everything',()=>{
 for(const file of ['src/core/validator.ts','src/author/generator.mjs','src/server/catalog.mjs','src/python/parser.ts','server.mjs','dist/index.js','examples/stack-ts.json','tests/support/semantic-oracle.mjs','tests/fixtures/task-programs.mjs']){
  const plan=planGate([file],tests);assert.equal(plan.full,true,file);assert.equal(plan.unit.length,tests.length,file);assert.equal(plan.browser,true,file);assert.match(plan.reason,/whole regression/,file);
 }
});
test('the toolchain and an unknown path are checked with everything; so is --full',()=>{
 for(const file of ['package.json','package-lock.json','tsconfig.workbench.json','scripts/gate.ts','.gitattributes','weird/file.txt','Makefile'])assert.equal(planGate([file],tests).full,true,file);
 // One wide file among scoped ones decides.
 assert.equal(planGate(['docs/x.md','public/style.css','src/core/validator.ts'],tests).full,true);
 const forced=planGate(['docs/x.md'],tests,{full:true});assert.equal(forced.full,true);assert.equal(forced.unit.length,tests.length);
});
test('no change runs no unit test and no browser suite (the verifiers always run)',()=>{
 const plan=planGate([],tests);assert.deepEqual(plan.unit,[]);assert.equal(plan.browser,false);assert.equal(plan.full,false);
});
