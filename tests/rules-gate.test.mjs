/** ADR-108 (E6): the second author gate, Rules → Try. A preview needs it; it compares the author's current
 *  source and policy with the draft's first-gate snapshot (stale evidence blocks), requires the model to
 *  accept its own reference, keeps an unverified model (a relaxed proven rule) and an inconclusive first
 *  gate unknown, never passed; a rule edit makes a new draft that must pass again. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {rulesGate,snapshotOf} from '../dist/author/preflight/rules-gate.js';
import {resolveAuthorPolicy} from '../dist/author/preflight/config-resolver.js';
import {modelFingerprint} from '../dist/author/preflight/fingerprint.js';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {gateBody} from './support/try-gate.mjs';

const policy=(extra={})=>resolveAuthorPolicy({language:'javascript',...extra});
const passedGate={gate:'source-to-rules',verdict:'passed',admitted:true,completeness:'within-supported-scope',message:'',diagnostics:[],policyFingerprint:'',assumptions:[]};
const model={lines:[{id:1,code:'const a = 1;'}],blocks:[],edges:[],profiles:[]};
const verified={status:'analysis-verified',checks:{reference:'accepted'}};
const decide=({snapshot=snapshotOf('const a = 1;',policy(),passedGate),source='const a = 1;',current=policy(),verification=verified}={})=>rulesGate({snapshot,current:{source,policy:current},model,verification,analyzer:'test'});

test('the decision: stale or missing evidence and a rejected reference block; unknown follows the policy; passing names what was checked',()=>{
 const passed=decide();
 assert.equal(passed.verdict,'passed');assert.equal(passed.admitted,true);
 assert.deepEqual(Object.keys(passed.proof).sort(),['analyzer','modelFingerprint','policyFingerprint','sourceFingerprint','verification']);
 assert.equal(passed.proof.modelFingerprint,modelFingerprint(model));
 assert.equal(decide({source:'﻿const a = 1;'}).verdict,'passed','a byte order mark or CRLF is no change');
 assert.equal(decide({source:'const a = 1;\r\n'}).verdict,'blocked','an added line is a change');
 for(const [args,pattern] of [[{snapshot:null},/nincs első kapus/],[{source:'const a = 2;'},/forrás a modell készítése óta változott/],[{current:policy({inputs:'valid'})},/beállítások.*változtak/],[{verification:{status:'analysis-verified',checks:{reference:'rejected'}}},/nem fogadja el/],[{source:42},/Hiányzik/]]){
  const result=decide(args);assert.equal(result.verdict,'blocked',JSON.stringify(args));assert.match(result.message,pattern);assert.equal(result.proof,undefined);
 }
 const unverified={status:'unverified',checks:{reference:'accepted'},findings:['Egy bizonyított szabályt a szerző felülírt.']};
 const warned=decide({verification:unverified});
 assert.equal(warned.verdict,'inconclusive');assert.equal(warned.admitted,true);assert.match(warned.message,/nem igazolt.*felülírt/);
 const strict=policy({policy:{unknownPolicy:'block'}});
 assert.equal(decide({snapshot:snapshotOf('const a = 1;',strict,passedGate),current:strict,verification:unverified}).admitted,false);
 const firstInconclusive=decide({snapshot:snapshotOf('const a = 1;',policy(),{...passedGate,verdict:'inconclusive'})});
 assert.equal(firstInconclusive.verdict,'inconclusive');assert.match(firstInconclusive.message,/első kapu/);
 assert.equal(decide({verification:{status:'conservative',checks:{reference:'indeterminate'}}}).verdict,'inconclusive');
});

test('server: no preview before the gate; the gate opens it; a rule edit closes it again (C28); stale source and policy are refused',async()=>{
 const catalog=new ExerciseCatalog(new Map()),source='function f() {\n  const a = 1;\n  const b = 2;\n  const c = a + 3;\n  g(b, c);\n}';
 const first=await catalog.createDraft({source,language:'javascript',inputs:'valid'});
 const lines=first.model.lines.map(line=>line.code);
 assert.throws(()=>catalog.preview({draftId:first.draftId,lines}),error=>error.statusCode===409&&/második kapun/.test(error.message));
 await assert.rejects(catalog.transition(gateBody(first,source+'\n')),error=>error.statusCode===422&&error.details.gate.verdict==='blocked'&&/forrás/.test(error.message));
 await assert.rejects(catalog.transition({...gateBody(first,source),inputs:'any'}),error=>error.statusCode===422&&/beállítások/.test(error.message));
 const opened=await catalog.transition(gateBody(first,source));
 assert.equal(opened.gate.verdict,'passed');assert.equal(opened.gate.proof.policyFingerprint,first.policy.fingerprint);
 assert.equal(catalog.preview({draftId:first.draftId,lines}).status,'accepted');
 const edited=await catalog.editDraft({draftId:first.draftId,edits:[{kind:'set-fixed',line:3,fixed:true}]});
 assert.equal(edited.policy.fingerprint,first.policy.fingerprint,'the edit keeps the first gate’s policy');
 assert.throws(()=>catalog.preview({draftId:edited.draftId,lines}),error=>error.statusCode===409);
 const again=await catalog.transition(gateBody(edited,source));
 assert.notEqual(again.gate.proof.modelFingerprint,opened.gate.proof.modelFingerprint);
 assert.equal(catalog.preview({draftId:edited.draftId,lines}).status,'accepted');
});

test('server: a preview carrying the current source passes the second gate itself (one request per re-evaluation); stale evidence is refused',async()=>{
 const catalog=new ExerciseCatalog(new Map()),source='function f() {\n  const a = 1;\n  const b = 2;\n  g(a, b);\n}';
 const first=await catalog.createDraft({source,language:'javascript'}),lines=first.model.lines.map(line=>line.code);
 assert.throws(()=>catalog.preview({...gateBody(first,source+'\n'),lines}),error=>error.statusCode===422&&error.details.gate.verdict==='blocked');
 assert.throws(()=>catalog.preview({draftId:first.draftId,lines}),error=>error.statusCode===409,'the refused evidence admitted nothing');
 assert.equal(catalog.preview({...gateBody(first,source),lines}).status,'accepted');
 assert.equal(catalog.preview({draftId:first.draftId,lines}).status,'accepted','admitted once, the draft stays open');
});

test('every draft response carries the second gate for its own source and policy (tryGate), so opening Try needs no request',async()=>{
 for(const [unknownPolicy,admitted] of [['warn',true],['block',false]]){
  const catalog=new ExerciseCatalog(new Map()),source='function f() {\n  const a = 1;\n  const b = 2;\n  const c = a + 3;\n  g(b, c);\n}';
  const first=await catalog.createDraft({source,language:'javascript',policy:{unknownPolicy}});
  assert.equal(first.tryGate.verdict,'passed');assert.equal(first.tryGate.proof.policyFingerprint,first.policy.fingerprint);
  const relaxed=await catalog.editDraft({draftId:first.draftId,edits:[{kind:'remove-rule',before:2,after:4,acknowledge:'policy-override',note:'Didaktikai lazítás'}]});
  assert.equal(relaxed.tryGate.verdict,'inconclusive');assert.equal(relaxed.tryGate.admitted,admitted);
  // The same decision as the transition with the draft's own source.
  if(admitted)assert.deepEqual((await catalog.transition(gateBody(relaxed,source))).gate,relaxed.tryGate);
 }
});

test('server: a relaxed proven rule (C29) makes the model unverified: Try opens with a warning, or not at all under block',async()=>{
 const source='function f() {\n  const a = 1;\n  const b = 2;\n  const c = a + 3;\n  g(b, c);\n}';
 for(const [unknownPolicy,admitted] of [['warn',true],['block',false]]){
  const catalog=new ExerciseCatalog(new Map());
  const first=await catalog.createDraft({source,language:'javascript',policy:{unknownPolicy}});
  const relaxed=await catalog.editDraft({draftId:first.draftId,edits:[{kind:'remove-rule',before:2,after:4,acknowledge:'policy-override',note:'Didaktikai lazítás'}]});
  assert.equal(relaxed.verification.status,'unverified');
  if(admitted){const answer=await catalog.transition(gateBody(relaxed,source));assert.equal(answer.gate.verdict,'inconclusive');assert.match(answer.gate.message,/nem tekinthető teljesen ellenőrzöttnek/);}
  else await assert.rejects(catalog.transition(gateBody(relaxed,source)),error=>error.statusCode===422&&/„tilt”/.test(error.message));
 }
});

test('an imported model brings its recorded source contract: the client that adopted it passes the gate (regression)',async()=>{
 const catalog=new ExerciseCatalog(new Map()),source='function calc() {\n const a = 1;\n const b = 2;\n return a + b;\n}';
 const first=await catalog.createDraft({source,language:'javascript',inputs:'valid',keyOrder:'ignored',classFields:'define'});
 const imported=await catalog.createDraft({model:first.model});
 assert.deepEqual(imported.policy.requested,{inputs:'valid',keyOrder:'ignored',classFields:'define'});
 assert.equal(imported.policy.fingerprint,first.policy.fingerprint);
 // The workbench adopts the model's environment into the draft and sends it back with the rows as source.
 const answer=await catalog.transition({draftId:imported.draftId,source:imported.model.lines.map(line=>line.code).join('\n'),inputs:'valid',keyOrder:'ignored',classFields:'define'});
 assert.equal(answer.gate.verdict,'passed');
});
