import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import fs from 'node:fs';
const raw=fs.readFileSync(new URL('./fixtures/copy-field-utility.service.ts',import.meta.url),'utf8');
function freePort(){return new Promise((resolve,reject)=>{const s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
async function response(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
test('HTTP: TS Beautify → Alkalmazás → Rendezés → Ellenőrzés; invalid TS',async t=>{
 const port=await freePort(),url=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:'ignore'});
 t.after(()=>child.kill('SIGTERM'));
 let ok=false;for(let i=0;i<60;i++){try{const r=await fetch(url+'/api/exercises');if(r.ok){ok=true;break}}catch{}await new Promise(r=>setTimeout(r,70));}assert.ok(ok,'Server did not start');
 const fmt=await response(url+'/api/author/format',{source:raw,language:'typescript'});
 assert.equal(fmt.status,200,JSON.stringify(fmt.body).slice(0,300));assert.equal(fmt.body.formatter,'typescript-language-service');
 assert.match(fmt.body.code,/class CopyFieldUtilityService/);
 const compiled=await response(url+'/api/author/compile',{source:fmt.body.code,language:'typescript',title:'Mellékelt TypeScript'});
 assert.equal(compiled.status,200,JSON.stringify(compiled.body).slice(0,300));
 assert.equal(compiled.body.model.lines.length,436);
 const preview=await response(url+'/api/author/preview',{draftId:compiled.body.draftId,lines:compiled.body.model.lines.map(x=>x.code)});
 assert.equal(preview.body.status,'accepted',JSON.stringify(preview.body));
 const changed=compiled.body.model.lines.map(x=>x.code);changed[0]='import { Invalid } from "elsewhere";';
 const rejected=await response(url+'/api/author/preview',{draftId:compiled.body.draftId,lines:changed});assert.equal(rejected.body.status,'rejected');
 const err=await response(url+'/api/author/format',{source:'class X { method(:) {} }',language:'typescript'});
 assert.equal(err.status,400);assert.match(err.body.error,/Szintaktikai hiba/);
});
