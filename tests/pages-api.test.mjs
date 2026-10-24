import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

// Test the exact browser-ported modules from the generated GitHub Pages artifact.
test('Pages demo: exercises → local validation → author → edited model → validation',async()=>{
 const nativeFetch=globalThis.fetch,originalTS=globalThis.ts;
 const require=createRequire(import.meta.url);
 let ts;
 try{ts=require('typescript');}catch{ts=require(join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript/lib/typescript.js'));}
 globalThis.ts=ts;
 globalThis.fetch=async url=>{
   const pathname=fileURLToPath(url instanceof URL?url:new URL(url));
   try{return new Response(await readFile(pathname),{status:200});}
   catch{return new Response('Not found',{status:404});}
 };
 try{
   await stat(new URL('../_site/app/pages-api.js',import.meta.url));
   const api=await import('../_site/app/pages-api.js');
   const available=await api.getExercises();
   assert.equal(available.length,4);
   for(const e of available){
     const solution=e.lines.map(l=>l.code);
     assert.equal((await api.evaluate({exerciseId:e.id,revision:e.revision,lines:solution})).status,'accepted');
   }
   const js='function demo() {\nconst a = 10;\nconst b = 20;\nreturn a + b;\n}';
   const first=await api.compileDraft({source:js,language:'javascript',title:'User draft'});
   assert.equal(first.model.lines.length,5);
   assert.equal((await api.previewDraft({draftId:first.draftId,lines:first.model.lines.map(x=>x.code)})).status,'accepted');
   const changed=structuredClone(first.model);
   changed.lines[2].dependencies=[];
   changed.lines[3].dependencies=[2,3];
   const second=await api.compileDraft({model:changed});
   assert.equal(second.model.lines[2].dependencies.length,0);
   assert.equal((await api.previewDraft({draftId:second.draftId,lines:second.model.lines.map(x=>x.code)})).status,'accepted');
   const tsFmt=await api.formatSource('function typed(x:number):number{return x+1}', 'typescript');
   assert.match(tsFmt.code,/function typed\(/);
   assert.match(tsFmt.code,/number/);
   const fixture=await api.loadTypeScriptFixture();assert.ok(fixture.includes('CopyFieldUtilityService'));
 }finally{globalThis.fetch=nativeFetch;globalThis.ts=originalTS;}
});
