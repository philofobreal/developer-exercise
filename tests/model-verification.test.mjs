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
import {verifyModel,publicationRefusal,validateSubmission,compileCodeLineExercise} from '../dist/index.js';
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
/** ADR-036, restated: every adjacent swap, both ends for up to 100 repeated rows (by the
 * validator's content key), the reversed and the end-swapped order; a submission equal to the
 * reference or to an earlier probe is graded once. */
function expectedProbes(model){
 const lines=model.lines,text=order=>order.map(line=>line.code).join('\n'),seen=new Set([text(lines)]);let count=0;
 const add=order=>{const key=text(order);if(!seen.has(key)){seen.add(key);count++;}};
 for(let i=0;i+1<lines.length;i++){const order=[...lines];[order[i],order[i+1]]=[order[i+1],order[i]];add(order);}
 const groups=new Map();
 for(const line of lines){const mode=line.normalization??'indent',key=mode+'|'+(mode==='indent'?line.code.replace(/^[ \t]*/,''):line.code);groups.set(key,[...(groups.get(key)??[]),line]);}
 for(const group of [...groups.values()].filter(group=>group.length>1).slice(0,100)){add([group.at(-1),...lines.filter(line=>line!==group.at(-1))]);add([...lines.filter(line=>line!==group[0]),group[0]]);}
 add([...lines].reverse());if(lines.length>1)add([lines.at(-1),...lines.slice(1,-1),lines[0]]);
 return count;
}

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
 assert.deepEqual([result.checks.rederivation,result.checks.audit,result.checks.projectionLoss,result.checks.budget.probed,result.checks.budget.indeterminate],['match','unverifiable',3,expectedProbes(model),0]);
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
 assert.equal(typed.publishable,false,'ADR-035: a language error blocks publication');
 assert.equal(claim(typed,'A referencia nyelvileg'),'refuted');
 const tight=await verify(generate(['const a = 1;','const b = 2;','const c = 3;','const d = 4;']),{maxStates:1});
 assert.equal(tight.publishable,false);
 assert.ok(tight.checks.budget.indeterminate>0||tight.checks.reference==='indeterminate');
});

test('ADR-036: the gate grades every adjacent swap and the hard probes, each distinct submission once',async()=>{
 // Repeated rows: three `record(1);` copies inside three identical blocks, and `}` five times.
 const model=generate(['function run() {',...Array.from({length:3},()=>['  {','    record(1);','  }']).flat(),'}']);
 const result=await verify(model);
 assert.equal(result.checks.budget.probed,expectedProbes(model));
 assert.deepEqual([result.checks.budget.indeterminate,result.publishable],[0,true]);
 // Three rows: the end swap equals the reversed order.
 assert.equal((await verify(generate(['const a = 1;','const b = 2;','const c = 3;']))).checks.budget.probed,3);
 // Two equal rows: every probe equals the reference.
 assert.equal((await verify(generate(['record(1);','record(1);']))).checks.budget.probed,0);
 // The explicit sample size limits only the adjacent swaps: the hard probes still run.
 const hardOnly=(await verify(model,{neighbours:0})).checks.budget.probed;
 assert.ok(hardOnly>0&&hardOnly<result.checks.budget.probed,String(hardOnly));
});

test('ADR-036: repeated rows are the validator\'s equal content, not equal after trim()',()=>{
 const repeated=generate(['record(1);','const x = 2;','const y = 3;','record(1);']);
 // 3 swaps and the repeated row at either end; the reversal equals the middle swap and the end
 // swap equals the reference.
 assert.equal(verifyModel(repeated).checks.budget.probed,5);
 assert.equal(expectedProbes(repeated),5);
 // A trailing space is significant for the validator: no repetition, so 3 swaps, the reversal
 // and the end swap. Grouping by trim() would add both end moves (7).
 const spaced=structuredClone(repeated);spaced.lines[3].code='record(1); ';
 assert.equal(verifyModel(spaced).checks.budget.probed,5);
});

test('ADR-036: the gate stops at the first undecided probe and bounds the sum of all probes',async()=>{
 // Two OR profiles: the reference matches the first at once, a swap only after the first fails,
 // so the smallest budget that decides the reference leaves that probe undecided.
 const model=generate(['const a = 1;','const b = 2;','const c = 3;','const d = 4;']);
 model.profiles=[{id:'a-first',edges:[{before:1,after:2}]},{id:'b-first',edges:[{before:2,after:1}]}];
 let stopped;
 for(let maxStates=1;maxStates<=60&&!stopped;maxStates++){const result=verifyModel(model,{maxStates});if(result.checks.reference==='accepted'&&result.checks.budget.indeterminate)stopped=result;}
 assert.ok(stopped,'some budget decides the reference but not every probe');
 assert.equal(stopped.checks.budget.indeterminate,1);
 assert.ok(stopped.checks.budget.probed<expectedProbes(model),'later probes are skipped');
 assert.equal(stopped.publishable,false);
 assert.match(stopped.findings.find(text=>text.startsWith('Egy kapupróba')),/elmaradtak/);
 assert.equal(claim(stopped,'A szomszédos cserék'),'refuted');
 assert.match(publicationRefusal(stopped),/kapupróba/);
 // Sixty independent rows: each accepted swap costs about a full search, so the sum runs out.
 const flat=generate(['function run() {',...Array.from({length:60},(_,i)=>`  const v${i} = ${i};`),'  return 0;','}']);
 const states=validateSubmission(compileCodeLineExercise(flat).compiled,{exerciseId:flat.id,revision:flat.revision,lines:flat.lines.map(line=>line.code)}).exploredStates;
 const capped=verifyModel(flat,{maxStates:2*states});
 assert.equal(capped.checks.reference,'accepted');
 assert.equal(capped.publishable,false);
 assert.match(capped.findings.find(text=>text.startsWith('Egy kapupróba')),/összesített kerete/);
 assert.ok(capped.checks.budget.probed<expectedProbes(flat));
 // An undecided reference runs no probe and claims nothing about them.
 const starved=verifyModel(model,{maxStates:1});
 assert.deepEqual([starved.checks.reference,starved.checks.budget.probed,claim(starved,'A szomszédos cserék')],['indeterminate',0,'not-established']);
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
