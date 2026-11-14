import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {admit,gateBody} from './support/try-gate.mjs';

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
   // ADR-113: the demo fetches the standard library the server reads, so its language audit runs as the server's does.
   assert.equal(first.audit.semantics,'ok');
   assert.ok(first.audit.assumptions.includes('lib:lib.es2022.full.d.ts'));
   assert.deepEqual((await api.resolvePolicy({language:'javascript'})).unavailable,[],'with the library nothing is server-only');
   const checked=await api.checkSource({source:'console.log(x);\nconst x = 1;',language:'javascript'});
   assert.equal(checked.gate.verdict,'blocked');assert.equal(checked.gate.diagnostics[0].code,'BS001');
   const typed=await api.checkSource({source:'const n: number = "s";',language:'typescript'});
   assert.equal(typed.gate.verdict,'blocked','a language error is found here as on the server');assert.equal(typed.gate.diagnostics[0].code,'TS2322');
   assert.equal(first.verification.publishable,true);
   assert.equal(first.verification.checks.rederivation,'match','the static demo re-derives the rules locally (ADR-017)');
   // ADR-108 (E6): previews need the second gate; the demo refuses them before it.
   await assert.rejects(api.previewDraft({draftId:first.draftId,lines:[]}),/második kapun/);
   const gate=(await api.authorTransition(gateBody(first,js))).gate;
   assert.equal(gate.verdict,'passed','ADR-113: with the standard library both gates decide here as on the server');
   assert.equal((await api.previewDraft({draftId:first.draftId,lines:first.model.lines.map(x=>x.code)})).status,'accepted');
   await assert.rejects(api.authorTransition(gateBody(first,js+'\n// edited')),/forrás a modell készítése óta változott/);
   const changed=structuredClone(first.model);
   changed.lines[2].dependencies=[];
   changed.lines[3].dependencies=[2,3];
   const second=await api.compileDraft({model:changed});
   assert.equal(second.model.lines[2].dependencies.length,0);
   await admit(api,second);assert.equal((await api.previewDraft({draftId:second.draftId,lines:second.model.lines.map(x=>x.code)})).status,'accepted');
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
  await admit(api,first,'const v0 = 0;');assert.equal((await api.previewDraft({draftId:first.draftId,lines:first.model.lines.map(x=>x.code)})).status,'accepted');
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
  await admit(api,first);assert.equal((await api.previewDraft({draftId:first.draftId,lines})).status,'rejected');
  const second=await api.compileDraft({model:first.model,refreshDependencies:true});
  await admit(api,second);assert.equal((await api.previewDraft({draftId:second.draftId,lines})).status,'accepted');
  assert.equal((await api.previewDraft({draftId:first.draftId,lines})).status,'rejected');
  await assert.rejects(api.compileDraft({model,refreshDependencies:'yes'}));
 }finally{globalThis.ts=saved;}
});

test('Pages rule edits (ADR-021): the demo edits its own draft copy, re-qualifies it and refuses without overwriting',async()=>{
 const saved=globalThis.ts;globalThis.ts={...createRequire(import.meta.url)('typescript'),sys:undefined};
 try{
  const api=await import('../_site/app/pages-api.js');
  const first=await api.compileDraft({source:'function f() {\n  const a = 1;\n  const b = 2;\n  const c = a + 3;\n  g(b, c);\n}',language:'javascript'});
  assert.ok(first.rules.constraints.some(c=>c.before===2&&c.after===4&&c.editability==='proven'));
  const refused=await api.editRules({draftId:first.draftId,edits:[{kind:'remove-rule',before:2,after:4}]});
  assert.deepEqual([refused.ok,refused.acknowledge],[false,'policy-override']);
  const fixed=await api.editRules({draftId:first.draftId,edits:[{kind:'set-fixed',line:3,fixed:true}]});
  assert.deepEqual([fixed.ok,fixed.mode,fixed.verification.status,fixed.model.lines[2].fixed],[true,'local-demo','author-modified',true]);
  await admit(api,fixed,'function f() {\n  const a = 1;\n  const b = 2;\n  const c = a + 3;\n  g(b, c);\n}');assert.equal((await api.previewDraft({draftId:fixed.draftId,lines:fixed.model.lines.map(x=>x.code)})).status,'accepted');
  await assert.rejects(api.previewDraft({draftId:first.draftId,lines:[]}),/lejárt/,'the edited draft replaced its predecessor');
 }finally{globalThis.ts=saved;}
});

test('ADR-113: without the standard library (a failed fetch) the demo falls back to C16: not-run, block server-only',async()=>{
 const nativeFetch=globalThis.fetch,originalTS=globalThis.ts;
 const require=createRequire(import.meta.url);
 let ts;
 try{ts=require('typescript');}catch{ts=require(join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript/lib/typescript.js'));}
 globalThis.ts={...ts,sys:undefined};
 globalThis.fetch=async url=>{
  const pathname=fileURLToPath(url instanceof URL?url:new URL(url));
  if(pathname.endsWith('typescript-lib.json'))return new Response('Not found',{status:404});
  try{return new Response(await readFile(pathname),{status:200});}catch{return new Response('Not found',{status:404});}
 };
 try{
  // A fresh module instance, so the library is fetched (and fails) anew.
  const api=await import('../_site/app/pages-api.js?without-library');
  assert.deepEqual((await api.resolvePolicy({language:'javascript'})).unavailable.map(item=>item.path),['unknownPolicy','jsCheck']);
  const draft=await api.compileDraft({source:'function f() {\nconst a = 1;\nreturn a;\n}',language:'javascript',title:'T'});
  assert.equal(draft.audit.semantics,'not-run');assert.ok(draft.audit.assumptions.includes('no-standard-library'));
  await assert.rejects(api.checkSource({source:'const a = 1;',language:'javascript',policy:{unknownPolicy:'block'}}),/csak a szerveren választható/);
 }finally{globalThis.fetch=nativeFetch;globalThis.ts=originalTS;}
});

test('ADR-155 (T1.2): the exercises download side by side, and are admitted in the manifest\'s order',async()=>{
 const nativeFetch=globalThis.fetch,originalTS=globalThis.ts;
 globalThis.ts={...createRequire(import.meta.url)('typescript'),sys:undefined};
 const names=JSON.parse(await readFile(new URL('../_site/examples/manifest.json',import.meta.url),'utf8'));
 const example=url=>{const name=decodeURIComponent(String(url).split('/').pop());return String(url).includes('/examples/')&&names.includes(name)?name:null;};
 const read=async url=>{try{return new Response(await readFile(fileURLToPath(url instanceof URL?url:new URL(url))),{status:200});}catch{return new Response('Not found',{status:404});}};
 try{
  // The later an exercise stands in the manifest, the sooner its download answers; none answers before all were asked for.
  let asked=0,open=0,most=0;const answered=[];
  globalThis.fetch=async url=>{
   const name=example(url);if(!name)return read(url);
   asked++;open++;most=Math.max(most,open);
   await new Promise(resolve=>setTimeout(resolve,3*(names.length-names.indexOf(name))));
   assert.equal(asked,names.length,'every download was started before the first one answered');
   open--;answered.push(name);return read(url);
  };
  const api=await import('../_site/app/pages-api.js?side-by-side'),listed=await api.getExercises();
  assert.equal(most,names.length,'all the downloads were open at once');
  assert.deepEqual(answered,[...names].reverse(),'the downloads answered in the opposite order');
  assert.deepEqual(listed.map(exercise=>exercise.id+'.json'),names,'the list stands in the manifest\'s order');
  // Two exercises are missing; the later one answers first. The first of the manifest's order is the one named.
  const missing=[names[2],names[names.length-2]];
  globalThis.fetch=async url=>{
   const name=example(url);if(!name)return read(url);
   await new Promise(resolve=>setTimeout(resolve,3*(names.length-names.indexOf(name))));
   return missing.includes(name)?new Response('Not found',{status:404}):read(url);
  };
  const broken=await import('../_site/app/pages-api.js?side-by-side-missing');
  await assert.rejects(broken.getExercises(),error=>error.message==='Hiányzik egy referenciafeladat: '+missing[0]);
 }finally{globalThis.fetch=nativeFetch;globalThis.ts=originalTS;}
});
