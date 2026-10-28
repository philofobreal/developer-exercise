import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {createApplication} from '../src/server/http.mjs';
import {authorRefusal} from '../dist/server/author-gate.js';
/** ADR-027: the author API decides authorization on the server, from the request alone. */
const post=(port,path,headers={})=>new Promise((resolve,reject)=>{
  const req=request({host:'127.0.0.1',port,path,method:'POST',headers:{'Content-Type':'application/json',...headers}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(body)}));});
  req.on('error',reject);req.end(JSON.stringify({source:'let a = 1;',language:'typescript'}));
});
async function serve(options,run){
  const server=createApplication({catalog:new ExerciseCatalog(new Map()),staticRoot:process.cwd(),...options});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{await run(server.address().port);}finally{await new Promise(resolve=>server.close(resolve));}
}
test('without a token the author API serves only a loopback client that addresses a loopback host',async()=>{
 await serve({},async port=>{
  assert.equal((await post(port,'/api/author/format')).status,200,'the local author works as before');
  assert.equal((await post(port,'/api/author/format',{'Sec-Fetch-Site':'same-origin',Origin:`http://127.0.0.1:${port}`})).status,200,'the same-origin browser UI works');
  const rebinding=await post(port,'/api/author/format',{Host:'attacker.example'});
  assert.equal(rebinding.status,403,'a DNS-rebinding page reaching 127.0.0.1 under a foreign name is refused');
  assert.match(rebinding.body.error,/CODELINE_AUTHOR_TOKEN/);
  assert.equal((await post(port,'/api/author/compile',{'Sec-Fetch-Site':'cross-site'})).status,403,'a cross-site browser request is refused');
  assert.equal((await post(port,'/api/author/rules',{Origin:'http://attacker.example'})).status,403,'a foreign origin is refused');
  assert.equal((await post(port,'/api/author/format',{'X-Author':'1',Cookie:'author=1'})).status,200,'a UI flag neither grants nor removes anything');
 });
});
test('a remote client without a token is refused, whatever it claims',()=>{
 const req={socket:{remoteAddress:'203.0.113.7'},headers:{host:'localhost:5173',authorization:'Bearer guess'}};
 assert.equal(authorRefusal(req)?.status,403);
 assert.equal(authorRefusal({...req,socket:{remoteAddress:'::1'},headers:{host:'[::1]:5173'}}),null,'IPv6 loopback is local');
});
test('with a token the author API requires the bearer token, also on loopback',async()=>{
 await serve({authorToken:'s3cret-token'},async port=>{
  const missing=await post(port,'/api/author/format');
  assert.equal(missing.status,401);assert.match(missing.body.error,/hitelesítés/);
  assert.equal((await post(port,'/api/author/format',{Authorization:'Bearer wrong'})).status,401);
  assert.equal((await post(port,'/api/author/format',{Authorization:'Bearer s3cret-token'})).status,200);
  assert.equal((await post(port,'/api/author/format',{Authorization:'Bearer s3cret-token',Origin:'http://attacker.example'})).status,403,'the token does not lift the cross-site check');
 });
});
test('the learner endpoints stay open: the gate covers only the author API',async()=>{
 await serve({authorToken:'s3cret-token'},async port=>{
  const evaluated=await post(port,'/api/evaluate',{Host:'attacker.example'});
  assert.notEqual(evaluated.status,401);assert.notEqual(evaluated.status,403);
 });
});
