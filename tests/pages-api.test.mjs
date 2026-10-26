import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat,readdir} from 'node:fs/promises';
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
 globalThis.ts={...ts,sys:undefined};
 globalThis.fetch=async url=>{
   const pathname=fileURLToPath(url instanceof URL?url:new URL(url));
   try{return new Response(await readFile(pathname),{status:200});}
   catch{return new Response('Not found',{status:404});}
 };
 try{
   await stat(new URL('../_site/app/pages-api.js',import.meta.url));
   const api=await import('../_site/app/pages-api.js');
   const available=await api.getExercises();
   const shipped=(await readdir(new URL('../examples/',import.meta.url))).filter(name=>name.endsWith('.json'));
   assert.deepEqual(available.map(e=>e.id+'.json').sort(),shipped.sort());
   for(const e of available){
     const solution=e.lines.map(l=>l.code);
     assert.equal((await api.evaluate({exerciseId:e.id,revision:e.revision,lines:solution})).status,'accepted');
   }
   const js='function demo() {\nconst a = 10;\nconst b = 20;\nreturn a + b;\n}';
   const first=await api.compileDraft({source:js,language:'javascript',title:'User draft'});
   assert.equal(first.model.lines.length,5);
   assert.equal(first.audit.semantics,'not-run','the static demo ships no standard library (ADR-016)');
   assert.ok(first.audit.assumptions.includes('no-standard-library'));
   assert.equal(first.verification.publishable,true);
   assert.equal(first.verification.checks.rederivation,'match','the static demo re-derives the rules locally (ADR-017)');
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

test('Pages failed import at full capacity preserves the last valid preview',async()=>{
 const saved=globalThis.ts;globalThis.ts={...createRequire(import.meta.url)('typescript'),sys:undefined};
 try{
  const api=await import('../_site/app/pages-api.js');let first;
  for(let i=0;i<25;i++){const draft=await api.compileDraft({source:`const v${i} = ${i};`,language:'javascript'});if(i===0)first=draft;}
  const invalid=structuredClone(first.model);invalid.lines[0].code='const a = ;';
  await assert.rejects(api.compileDraft({model:invalid}),/Szintaktikai/);
  assert.equal((await api.previewDraft({draftId:first.draftId,lines:first.model.lines.map(x=>x.code)})).status,'accepted');
 }finally{globalThis.ts=saved;}
});

test('Pages imports serial legacy rules exactly; dependency refresh requires explicit intent',async()=>{
 const saved=globalThis.ts;globalThis.ts={...createRequire(import.meta.url)('typescript'),sys:undefined};
 try{
  const api=await import('../_site/app/pages-api.js');
  const model=JSON.parse(await readFile(new URL('./fixtures/evaluate-legacy-serial.model.json',import.meta.url),'utf8'));
  const lines=[1,3,5,2,4,6,7].map(id=>model.lines.find(line=>line.id===id).code);
  const first=await api.compileDraft({model});
  assert.deepEqual(first.model.lines.map(line=>line.dependencies),model.lines.map(line=>line.dependencies));
  assert.equal((await api.previewDraft({draftId:first.draftId,lines})).status,'rejected');
  const second=await api.compileDraft({model:first.model,refreshDependencies:true});
  assert.equal((await api.previewDraft({draftId:second.draftId,lines})).status,'accepted');
  assert.equal((await api.previewDraft({draftId:first.draftId,lines})).status,'rejected');
  await assert.rejects(api.compileDraft({model,refreshDependencies:'yes'}));
 }finally{globalThis.ts=saved;}
});
