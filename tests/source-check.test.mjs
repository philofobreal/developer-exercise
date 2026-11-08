/** ADR-113: the first gate on a source, without making a model: the author checks the reference under the chosen
 *  settings in the Source step. Nothing is stored; a refused option is the same 422 as for a build; over HTTP it is
 *  an author route like the others. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {ExerciseCatalog} from '../src/server/catalog.mjs';

test('the first gate alone: findings with their certainty, no draft made, the settings applied',async()=>{
 const catalog=new ExerciseCatalog(new Map());
 const blocked=await catalog.checkSource({source:'console.log(x);\nconst x = 1;',language:'javascript'});
 assert.equal(blocked.gate.verdict,'blocked');assert.deepEqual(blocked.gate.diagnostics.map(d=>[d.line,d.code,d.certainty]),[[1,'BS001','definite']]);
 assert.equal((await catalog.checkSource({source:'function f() {\n  const a = 1;\n  return a;\n}',language:'javascript'})).gate.verdict,'passed');
 assert.equal(catalog.drafts.size,0,'a check stores nothing');
 const checked=await catalog.checkSource({source:'const n = 5;\nconsole.log(n.length);',language:'javascript',policy:{jsCheck:'on'}});
 assert.equal(checked.gate.verdict,'inconclusive');assert.equal(checked.policy.effective.jsCheck,'on');
 await assert.rejects(catalog.checkSource({source:'const a = 1;',language:'javascript',policy:{bindingSafety:'off'}}),error=>error.statusCode===422&&error.details.policy.conflicts[0].code==='C33');
 await assert.rejects(catalog.checkSource({language:'javascript'}),error=>error.statusCode===400);
});

test('HTTP: POST /api/author/check answers the gate and its policy',async t=>{
 const port=await new Promise((resolve,reject)=>{const s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const url=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:'ignore'});
 t.after(()=>child.kill('SIGTERM'));
 let ok=false;for(let i=0;i<60&&!ok;i++){try{ok=(await fetch(url+'/api/exercises')).ok;}catch{}if(!ok)await new Promise(r=>setTimeout(r,70));}
 assert.ok(ok,'Server did not start');
 const response=await fetch(url+'/api/author/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:'const n: number = "s";',language:'typescript'})});
 assert.equal(response.status,200);const body=await response.json();
 assert.equal(body.gate.verdict,'blocked');assert.equal(body.gate.diagnostics[0].code,'TS2322');assert.match(body.policy.fingerprint,/^p1-/);
});
