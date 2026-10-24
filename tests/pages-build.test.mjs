import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
const file=p=>new URL('../_site/'+p,import.meta.url);
test('Pages artifact has relative entrypoints and local compiler',async()=>{
 const html=await readFile(file('index.html'),'utf8');
 assert.match(html,/src="\.\/ui\.js"/);
 assert.match(html,/src="\.\/vendor\/typescript\.js"/);
 assert.doesNotMatch(html,/src="\/|href="\//);
 assert.ok((await stat(file('vendor/typescript.js'))).size>1000000);
 assert.ok((await stat(file('dist/validator.js'))).size>1000);
 assert.ok((await stat(file('author/generator.mjs'))).size>1000);
});
test('Browser uses static API and original business modules',async()=>{
 const api=await readFile(file('app/api.js'),'utf8');
 const pagesApi=await readFile(file('app/pages-api.js'),'utf8');
 assert.match(api,/pages-api\.js/);
 assert.match(pagesApi,/validateSubmission/);
 assert.doesNotMatch(pagesApi,/\/api\/evaluate|\/api\/author/);
 const names=JSON.parse(await readFile(file('examples/manifest.json'),'utf8'));
 assert.equal(names.length,4);
 for(const n of names){
   const model=JSON.parse(await readFile(file('examples/'+n),'utf8'));
   const compiled=compileCodeLineExercise(model);
   assert.ok(!('status' in compiled),n+' '+compiled.message);
   assert.equal(validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:model.lines.map(l=>l.code)}).status,'accepted');
 }
});
