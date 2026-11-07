/** ADR-108 (E1): the author policy resolver. Requested values are kept, the effective policy is what the
 *  analysis runs with, presets lock with a reason, an option outside the language is inactive, a refused
 *  value is a blocking conflict (also over HTTP), and the fingerprint follows the effective policy only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {POLICY_SCHEMA,generatorOptions,policyRefusal,resolveAuthorPolicy} from '../dist/author/preflight/config-resolver.js';
import {generateCodeLineExercise} from '../src/author/generator.mjs';

test('an empty request keeps the historical fallback (any, observed, either, verbatim) and warns on unknowns',()=>{
 const r=resolveAuthorPolicy({language:'typescript'});
 assert.equal(r.schema,POLICY_SCHEMA);
 assert.deepEqual(r.effective,{inputs:'any',keyOrder:'observed',classFields:'either',importEmit:'verbatim',portability:'configured',unknownPolicy:'warn',tsDiagnostics:'baseline',jsCheck:'off',objectState:'local'});
 assert.deepEqual(r.requested,{});assert.deepEqual(r.locks,[]);assert.deepEqual(r.conflicts,[]);assert.equal(policyRefusal(r),'');
});

test('C01–C04: the conservative preset locks every source-contract option, keeps what was asked and says why',()=>{
 const r=resolveAuthorPolicy({language:'typescript',inputs:'valid',keyOrder:'ignored',classFields:'define',importEmit:'elide-unused',policy:{portability:'conservative'}});
 assert.deepEqual({inputs:r.effective.inputs,keyOrder:r.effective.keyOrder,classFields:r.effective.classFields,importEmit:r.effective.importEmit},{inputs:'any',keyOrder:'observed',classFields:'either',importEmit:'verbatim'});
 assert.deepEqual(r.locks.map(lock=>lock.rule),['C01','C02','C03','C04']);
 assert.deepEqual(r.locks.map(lock=>lock.requested),['valid','ignored','define','elide-unused']);
 assert.ok(r.locks.every(lock=>lock.reason.length>20));
 assert.equal(r.requested.inputs,'valid','the request is kept; switching the preset off restores it');
 const off=resolveAuthorPolicy({language:'typescript',inputs:'valid',policy:{portability:'configured'}});
 assert.equal(off.effective.inputs,'valid');assert.deepEqual(off.locks,[]);
 // No lock where the request already is the strict value.
 assert.deepEqual(resolveAuthorPolicy({language:'javascript',policy:{portability:'conservative'}}).locks,[]);
});

test('C12: the TypeScript import emit is inactive for JavaScript and never reaches the generator',()=>{
 const r=resolveAuthorPolicy({language:'javascript',importEmit:'elide-unused'});
 assert.deepEqual(r.inactive.map(note=>note.path),['importEmit']);assert.equal(r.requested.importEmit,'elide-unused');
 assert.equal('importEmit' in generatorOptions(r),false);assert.equal(generatorOptions(resolveAuthorPolicy({language:'typescript',importEmit:'elide-unused'})).importEmit,'elide-unused');
 assert.deepEqual(resolveAuthorPolicy({language:'javascript',policy:{portability:'conservative'}}).locks.filter(lock=>lock.path==='importEmit'),[],'no lock on an inactive option');
});

test('C33: an invalid value, an unknown or not yet implemented option and a malformed policy are blocking conflicts',()=>{
 const bad=[[{inputs:'strict'},'inputs'],[{keyOrder:7},'keyOrder'],[{policy:{unknownPolicy:'ignore'}},'unknownPolicy'],[{policy:{unknownPolicy:'require-ack'}},'unknownPolicy'],[{policy:{tsDiagnostics:'pedantic'}},'tsDiagnostics'],[{policy:{controlFlow:'interprocedural'}},'policy.controlFlow'],[{policy:{bindingSafety:'off'}},'policy.bindingSafety'],[{policy:[]},'policy']];
 for(const [request,path] of bad){const r=resolveAuthorPolicy({language:'javascript',...request});assert.ok(r.conflicts.some(c=>c.blocking&&c.path===path&&c.code==='C33'),JSON.stringify(request));assert.notEqual(policyRefusal(r),'');}
});

test('every combination resolves to a valid policy; conservative is always the strict contract; the fingerprint follows the effective policy',()=>{
 const seen=new Map();
 for(const language of ['javascript','typescript'])for(const inputs of ['any','valid'])for(const keyOrder of ['observed','ignored'])for(const classFields of ['either','define'])for(const importEmit of ['verbatim','elide-unused'])for(const portability of ['configured','conservative'])for(const unknownPolicy of ['warn','block']){
  const r=resolveAuthorPolicy({language,inputs,keyOrder,classFields,importEmit,policy:{portability,unknownPolicy}});
  assert.deepEqual(r.conflicts,[]);
  if(portability==='conservative')assert.deepEqual([r.effective.inputs,r.effective.keyOrder,r.effective.classFields],['any','observed','either']);
  else assert.deepEqual([r.effective.inputs,r.effective.keyOrder,r.effective.classFields],[inputs,keyOrder,classFields]);
  assert.match(r.fingerprint,/^p1-[0-9a-f]{16}$/);
  const key=JSON.stringify([language,generatorOptions(r),r.effective.portability,r.effective.unknownPolicy]);
  if(seen.has(key))assert.equal(seen.get(key),r.fingerprint);else seen.set(key,r.fingerprint);
 }
 assert.equal(new Set(seen.values()).size,seen.size,'different effective policies have different fingerprints');
 assert.equal(resolveAuthorPolicy({language:'javascript',importEmit:'elide-unused'}).fingerprint,resolveAuthorPolicy({language:'javascript'}).fingerprint,'an inactive option does not change the fingerprint');
});

test('the generator runs with the effective policy: a conservative request records the strict environment',()=>{
 const source='function f(o) {\n  const a = o.x;\n  const b = o.y;\n  return a + b;\n}';
 const r=resolveAuthorPolicy({language:'javascript',inputs:'valid',policy:{portability:'conservative'}});
 const model=generateCodeLineExercise({source,language:'javascript',...generatorOptions(r)},ts);
 assert.equal(model.authoring.evidence.environment.inputs??'any','any');
 const free=generateCodeLineExercise({source,language:'javascript',...generatorOptions(resolveAuthorPolicy({language:'javascript',inputs:'valid'}))},ts);
 assert.equal(free.authoring.evidence.environment.inputs,'valid');
});

test('HTTP: a refused option is a structured 422 with the resolution; an admitted draft returns its policy',async t=>{
 const port=await new Promise((resolve,reject)=>{const s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const url=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:'ignore'});
 t.after(()=>child.kill('SIGTERM'));
 let ok=false;for(let i=0;i<60&&!ok;i++){try{ok=(await fetch(url+'/api/exercises')).ok;}catch{}if(!ok)await new Promise(r=>setTimeout(r,70));}
 assert.ok(ok,'Server did not start');
 const post=body=>fetch(url+'/api/author/compile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const refused=await post({source:'const a = 1;',language:'javascript',policy:{bindingSafety:'off'}});
 assert.equal(refused.status,422);const answer=await refused.json();
 assert.match(answer.error,/bindingSafety/);assert.equal(answer.policy.conflicts[0].code,'C33');
 const admitted=await post({source:'const a = 1;\nconst b = 2;',language:'typescript',inputs:'valid',policy:{portability:'conservative'}});
 assert.equal(admitted.status,200);const draft=await admitted.json();
 assert.equal(draft.policy.effective.inputs,'any');assert.deepEqual(draft.policy.locks.map(lock=>lock.rule),['C01']);
});
