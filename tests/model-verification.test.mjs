/** ADR-017: the Model Verification Gate re-derives a model's rules, measures what the
 * projection loses and keeps checked, tested and not-established claims apart. It never
 * runs code and never changes a verdict. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {verifyAuthorModel} from '../dist/author/engine.js';
import {createReferenceAuditor} from '../dist/author/reference-audit.js';
import {verifyModel} from '../dist/index.js';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {corpus} from './fixtures/ordering-corpus.mjs';

const ports={generate:input=>generateCodeLineExercise(input,ts)};
const libraryDir=path.dirname(ts.getDefaultLibFilePath({}));
const auditor=createReferenceAuditor(ts,name=>{try{return readFileSync(path.join(libraryDir,name),'utf8');}catch{return undefined;}});
const generate=(source,language='javascript',options={})=>generateCodeLineExercise({source:source.join?.('\n')??source,language,...options},ts);
async function verify(model,options={}){
 const audit=auditor.audit(model.lines.map(line=>line.code).join('\n'),model.language).semantics;
 return verifyAuthorModel(model,ports,{audit,...options});
}
const claim=(result,prefix)=>result.claims.find(item=>item.claim.startsWith(prefix)).basis;

test('a fully analysed reference is analysis-verified and publishable, with soundness only tested',async()=>{
 const result=await verify(generate(['function f(n) {','  const a = n + 1;','  const b = n + 2;','  return a + b;','}']));
 assert.equal(result.status,'analysis-verified',result.findings.join(' '));
 assert.equal(result.publishable,true);
 assert.deepEqual([result.checks.rederivation,result.checks.provenance,result.checks.analyzer,result.checks.audit,result.checks.projectionLoss,result.checks.fallbacks.count],['match','complete','current','ok',0,0]);
 assert.equal(claim(result,'Minden kényszer oka'),'checked');
 assert.equal(claim(result,'Az elfogadott sorrendek'),'tested','a per-model soundness proof is not claimed');
 assert.equal(claim(result,'A kezelt esetekben'),'tested');
});

test('conservative fallbacks and projection loss lower the status to conservative and are named',async()=>{
 const commented=await verify(generate(['function f(n) {','  const a = n + 1;','  /*','   note','  */','  return a;','}']));
 assert.equal(commented.status,'conservative');
 assert.ok(commented.checks.fallbacks.codes['opaque-row']>0);
 const fixture=corpus.get('wp6-hoisted-into-continued-call');
 const lossy=await verify(generate(fixture.source,fixture.language));
 // v10 (ADR-019): `size` may also cross the continued call, which the closure pins as well.
 assert.equal(lossy.checks.projectionLoss,2);
 assert.equal(lossy.status,'conservative');
 assert.equal(claim(lossy,'A kezelt esetekben'),'not-established');
});

test('CopyFieldUtilityService: conservative, publishable, language unverifiable, closure-bound projection loss',async()=>{
 const model=generate(await readFile(new URL('./fixtures/copy-field-utility.service.ts',import.meta.url),'utf8'),'typescript');
 const result=await verify(model);
 assert.equal(result.status,'conservative');
 assert.equal(result.publishable,true);
 assert.deepEqual([result.checks.rederivation,result.checks.audit,result.checks.projectionLoss,result.checks.budget.probed,result.checks.budget.indeterminate],['match','unverifiable',3,100,0]);
 // ADR-019: the pure arrow `isSourceField` may cross the continued `isTargetField = (` unit, which the closure pins (ADR-009).
 assert.equal(claim(result,'A referencia nyelvileg'),'not-established');
});

test('hand edits, forged reasons and legacy models are unverified, never analysis results',async()=>{
 const model=generate(['function f(n) {','  const a = n + 1;','  const b = a + 2;','  return b;','}']);
 const edited=structuredClone(model);edited.lines[2].dependencies=[1];
 const forged=structuredClone(model);forged.authoring.provenance=forged.authoring.provenance.map(entry=>({...entry,category:'structure',code:'block-open'}));
 for(const [name,variant] of [['edited',edited],['forged',forged]]){
  const result=await verify(variant);
  assert.equal(result.checks.rederivation,'differs',name);
  assert.equal(result.status,'unverified',name);
  assert.equal(claim(result,'Minden kényszer oka'),'refuted',name);
  assert.equal(claim(result,'Az elfogadott sorrendek'),'not-established',name);
 }
 const legacy=JSON.parse(await readFile(new URL('./fixtures/evaluate-legacy-serial.model.json',import.meta.url),'utf8'));
 const result=await verify(legacy);
 assert.deepEqual([result.status,result.publishable,result.checks.provenance],['unverified',true,'absent']);
});

test('fixed slots and OR profiles are author narrowing, not analysis results',async()=>{
 const model=generate(['const a = 1;','const b = 2;','const c = 3;']);
 const fixed=structuredClone(model);fixed.lines[1].fixed=true;
 const profiled=structuredClone(model);profiled.profiles=[{id:'a-first',edges:[{before:1,after:3}]},{id:'c-first',edges:[{before:3,after:1}]}];
 for(const [name,variant,key] of [['fixed',fixed,'fixed'],['profiles',profiled,'profiles']]){
  const result=await verify(variant);
  assert.equal(result.status,'author-modified',name);
  assert.equal(result.checks[key]>0,true,name);
  assert.equal(result.checks.rederivation,'match',name);
  assert.equal(claim(result,'Az elfogadott sorrendek'),'tested',name);
 }
});

test('a language error makes the reference unverified; an exhausted budget blocks publication',async()=>{
 const typed=await verify(generate(['const a: number = 1;','const b: string = a;'],'typescript'));
 assert.equal(typed.checks.audit,'errors');
 assert.equal(typed.status,'unverified');
 assert.equal(claim(typed,'A referencia nyelvileg'),'refuted');
 const tight=await verify(generate(['const a = 1;','const b = 2;','const c = 3;','const d = 4;']),{maxStates:1});
 assert.equal(tight.publishable,false);
 assert.ok(tight.checks.budget.indeterminate>0||tight.checks.reference==='indeterminate');
});

test('the core gate alone never claims analysis without re-derivation',()=>{
 const result=verifyModel(generate(['const a = 1;','const b = 2;']));
 assert.equal(result.checks.rederivation,'not-run');
 assert.equal(result.status,'unverified');
 assert.ok(result.findings.some(finding=>finding.includes('nem vezettük le újra')));
 const broken=generate(['const a = 1;','const b = 2;']);broken.lines[0].dependencies=[2];broken.lines[1].dependencies=[1];
 assert.deepEqual([verifyModel(broken).checks.admission,verifyModel(broken).publishable],['failed',false]);
});

test('server admission returns the gate for drafts and records it for trusted references',async()=>{
 const catalog=await ExerciseCatalog.open(new URL('../examples/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
 for(const record of catalog.trusted.values())assert.ok(record.verification&&typeof record.verification.publishable==='boolean');
 const draft=await catalog.createDraft({source:'function f(n) {\n  const a = n + 1;\n  return a;\n}',language:'javascript'});
 assert.equal(draft.verification.status,'analysis-verified',draft.verification.findings.join(' '));
 const tampered=structuredClone(draft.model);tampered.lines[2].dependencies=[1];
 const imported=await catalog.createDraft({model:tampered});
 assert.equal(imported.verification.status,'unverified','the gate is recomputed, not taken from the request');
});
