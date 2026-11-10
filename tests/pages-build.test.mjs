import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat,access,readdir} from 'node:fs/promises';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
const file=p=>new URL('../_site/'+p,import.meta.url);
test('Pages artifact has relative entrypoints and a local compiler for the worker, not the page',async()=>{
 const html=await readFile(file('index.html'),'utf8');
 assert.match(html,/src="\.\/ui\.js"/);
 // ADR-125: the compiler is the worker's; the page never loads it.
 assert.doesNotMatch(html,/vendor\/typescript\.m?js/);
 assert.doesNotMatch(html,/src="\/|href="\//);
 assert.ok((await stat(file('vendor/typescript.mjs'))).size>1000000);
 assert.match(await readFile(file('vendor/typescript.mjs'),'utf8'),/\nglobalThis\.ts = ts;\n$/);
 // ADR-127: the worker loads the compiler on demand, with the first operation that reads source, never at its start.
 {const worker=await readFile(file('app/pages-worker.js'),'utf8');assert.doesNotMatch(worker,/^import '\.\.\/vendor\/typescript\.mjs'/m);assert.match(worker,/import\('\.\.\/vendor\/typescript\.mjs'\)/);assert.match(worker,/import \* as engine from '\.\/pages-api\.js';/);}
 assert.ok((await stat(file('dist/validator.js'))).size>1000);
 assert.ok((await stat(file('author/generator.mjs'))).size>1000);
 // ADR-011/013 wiring, re-rooted for the one-level-shallower static author folder.
 assert.match(await readFile(file('author/generator.mjs'),'utf8'),/\.\.\/dist\/author\/code-line-projection\.js/);
 assert.match(await readFile(file('author/languages.mjs'),'utf8'),/\.\.\/dist\/author\/js-ts-ordering\.js/);
 for(const module of ['code-line-projection','ordering-relations','js-ts-ordering','statement-ordering','type-member-ordering'])assert.ok((await stat(file(`dist/author/${module}.js`))).size>500,module);
 const samples=JSON.parse(await readFile(file('samples/typescript/suite.json'),'utf8'));
 assert.equal(samples.length,24);
 for(const example of samples)await stat(file('samples/typescript/'+example.id+'.model.json'));
});
test('Python author-probe infrastructure and WASM are not published as a product feature',async()=>{
 for(const target of ['dist/python','vendor/python','node_modules']) await assert.rejects(access(file(target)),{code:'ENOENT'});
});
test('Browser uses static API and original business modules',async()=>{
 const api=await readFile(file('app/api.js'),'utf8');
 const pagesApi=await readFile(file('app/pages-api.js'),'utf8');
 // ADR-125: the page's API is the worker client; the engine behind it is pages-api.
 assert.equal(api,"export * from './local-demo.js';\n");assert.match(await readFile(file('app/local-demo.js'),'utf8'),/pages-worker\.js/);
 assert.match(pagesApi,/validateSubmission/);
 assert.doesNotMatch(pagesApi,/\/api\/evaluate|\/api\/author/);
 // ADR-035: the manifest lists exactly what the catalog gate served; every example is accounted for.
 const names=JSON.parse(await readFile(file('examples/manifest.json'),'utf8'));
 const publication=JSON.parse(await readFile(file('examples/publication.json'),'utf8'));
 assert.deepEqual(names,publication.served.map(item=>item.file));
 assert.deepEqual([...names,...publication.skipped.map(item=>item.file)].sort(),(await readdir(new URL('../examples/',import.meta.url))).filter(name=>name.endsWith('.json')).sort());
 for(const {file:skipped} of publication.skipped)await assert.rejects(access(file('examples/'+skipped)),{code:'ENOENT'},skipped);
 for(const n of names){
   const model=JSON.parse(await readFile(file('examples/'+n),'utf8'));
   const compiled=compileCodeLineExercise(model);
   assert.ok(!('status' in compiled),n+' '+compiled.message);
   assert.equal(validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:model.lines.map(l=>l.code)}).status,'accepted');
 }
});
