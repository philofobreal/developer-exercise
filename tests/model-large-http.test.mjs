import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
const raw=readFileSync(new URL('./fixtures/copy-field-utility.service.ts',import.meta.url),'utf8');
const freePort=()=>new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const post=async (base,path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
test('HTTP accepts edited >64 KiB data models generated from the full 436-line TS fixture',async t=>{
 const port=await freePort(),base=`http://127.0.0.1:${port}`;
 const ps=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,HOST:'127.0.0.1',PORT:String(port)},stdio:'ignore'});
 t.after(()=>ps.kill('SIGTERM'));
 let online=false;for(let i=0;i<60;i++){try{if((await fetch(base+'/api/exercises')).ok){online=true;break;}}catch{}await new Promise(r=>setTimeout(r,80));}
 assert.ok(online,'server online');
 const formatted=await post(base,'/api/author/format',{source:raw,language:'typescript'});
 assert.equal(formatted.status,200);
 const created=await post(base,'/api/author/compile',{source:formatted.body.code,language:'typescript',title:'Large model'});
 assert.equal(created.status,200,JSON.stringify(created.body).slice(0,300));
 assert.equal(created.body.model.lines.length,436);
 const model=created.body.model;model.lines[1].dependencies=[model.lines[0].id];
 assert.ok(Buffer.byteLength(JSON.stringify({model}))>65536);
 const edited=await post(base,'/api/author/compile',{model});
 assert.equal(edited.status,200,JSON.stringify(edited.body).slice(0,300));
 assert.equal(edited.body.model.lines.length,436);
 const tested=await post(base,'/api/author/preview',{draftId:edited.body.draftId,lines:model.lines.map(l=>l.code)});
 assert.equal(tested.status,200);assert.equal(tested.body.status,'accepted');
});
