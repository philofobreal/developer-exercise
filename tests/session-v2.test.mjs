/** ADR-108 (E8): session v2 records the author's analysis settings beside the model; version 1 is still read and
 *  its settings are partial; a file is never trusted: an option or value the controls do not offer refuses it, and
 *  the model passes both gates again under the recorded (or fallback) policy, never with an earlier verdict. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {exportSession,readSession,restoreAttempt} from '../public/app/persistence.js';
import {createAttempt} from '../public/app/attempt.js';
import {readSettings} from '../public/app/preflight-settings.js';
import {ExerciseCatalog} from '../src/server/catalog.mjs';

const exercise={id:'author-x',revision:1,lines:[{id:1,code:'const a = 1;'},{id:2,code:'const b = 2;'}]};
const model={schemaVersion:2,id:'author-x',revision:1,language:'javascript',title:'T',description:'',lines:exercise.lines.map(line=>({...line,dependencies:[],fixed:false,functionBlock:0,scopeId:null})),blocks:[]};

test('version 2 records the settings the applied model was made under; reading it gives them back as recorded',()=>{
 const settings={inputs:'valid',keyOrder:'ignored',classFields:'define',policy:{unknownPolicy:'block',objectState:'off'}};
 const file=exportSession(exercise,createAttempt(exercise),model,settings);
 assert.equal(file.version,2);assert.deepEqual(file.authorSettings,settings);
 const read=readSession(JSON.parse(JSON.stringify(file)));
 assert.equal(read.author.origin,'recorded');assert.deepEqual(read.author.settings,settings);
 assert.equal(restoreAttempt(file,exercise).answer.length,2);
 assert.equal('authorSettings' in exportSession(exercise,createAttempt(exercise),undefined,settings),false,'no settings without an author model');
});

test('version 1 (and a v2 file without settings) is read: the settings are partial, never assumed recorded (C34)',()=>{
 const v1={...exportSession(exercise,createAttempt(exercise),model),version:1};
 const read=readSession(v1);assert.equal(read.author.origin,'partial');assert.deepEqual(read.author.settings,{});
 assert.equal(restoreAttempt(v1,exercise).answer.length,2,'a v1 attempt is restored as before');
 assert.equal(readSession(exportSession(exercise,createAttempt(exercise),model)).author.origin,'partial');
 assert.equal(readSession({...v1,authorModel:undefined}).author,undefined,'a practice session has no author part');
 assert.throws(()=>readSession({...v1,version:3}),/Ismeretlen munkamenet-verzió/);
});

test('an untrusted settings record refuses the import instead of being dropped',()=>{
 for(const [bad,what] of [[{policy:{unknownPolicy:'require-ack'}},/unknownPolicy=require-ack/],[{policy:{bindingSafety:'off'}},/bindingSafety/],[{strict:true},/strict/],[{policy:{inputs:'valid'}},/policy\.inputs/],[{inputs:7},/inputs=7/],[[],/nem objektum/]])
  assert.throws(()=>readSettings(bad),what,JSON.stringify(bad));
 assert.throws(()=>readSession({...exportSession(exercise,createAttempt(exercise),model),authorSettings:{policy:{tsDiagnostics:'pedantic'}}}),/tsDiagnostics=pedantic/);
});

test('server: an imported model runs both gates again under the recorded settings, so the session’s choice holds',async()=>{
 const catalog=new ExerciseCatalog(new Map()),source='function f() {\n  const a = 1;\n  const b = 2;\n  const c = a + 3;\n  g(b, c);\n}';
 const first=await catalog.createDraft({source,language:'javascript',inputs:'valid',policy:{unknownPolicy:'block'}});
 const recorded=await catalog.createDraft({model:first.model,policy:{unknownPolicy:'block'}});
 assert.equal(recorded.policy.fingerprint,first.policy.fingerprint,'the recorded settings resolve to the same policy');
 assert.equal(recorded.gate.gate,'source-to-rules');assert.equal(recorded.tryGate.gate,'rules-to-try');
 const partial=await catalog.createDraft({model:first.model});
 assert.notEqual(partial.policy.fingerprint,first.policy.fingerprint,'without them the start values apply');
 assert.equal(partial.policy.effective.unknownPolicy,'warn');assert.equal(partial.policy.effective.inputs,'valid','the model’s recorded environment still applies');
});
