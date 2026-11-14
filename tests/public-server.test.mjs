/** ADR-170: the server on a public address. Behind the operator's proxies the client is the forwarded address the last
 *  trusted proxy vouches for; the rate limit and the author gate both go by it, and the page can ask whether this
 *  client is served authoring. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {createApplication} from '../src/server/http.mjs';
import {authorRefusal} from '../dist/server/author-gate.js';
import {clientAddress,trustedProxyCount} from '../dist/server/client-address.js';

const call=(port,method,path,headers={},body)=>new Promise((resolve,reject)=>{
  const req=request({host:'127.0.0.1',port,path,method,headers:{'Content-Type':'application/json',...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text)}));});
  req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
});
async function serve(options,run){
  const server=createApplication({catalog:new ExerciseCatalog(new Map()),staticRoot:process.cwd(),...options});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{await run(server.address().port);}finally{await new Promise(resolve=>server.close(resolve));}
}
const from=(peer,forwarded)=>({socket:{remoteAddress:peer},headers:forwarded===undefined?{}:{'x-forwarded-for':forwarded}});

test('reached directly, the client is the socket peer and a forwarded header is only a claim',()=>{
 assert.equal(clientAddress(from('203.0.113.7','127.0.0.1')),'203.0.113.7');
 assert.equal(clientAddress(from('203.0.113.7')),'203.0.113.7');
});
test('behind trusted proxies the client is the entry the last trusted proxy appended',()=>{
 assert.equal(clientAddress(from('127.0.0.1','198.51.100.4'),1),'198.51.100.4');
 assert.equal(clientAddress(from('127.0.0.1','127.0.0.1, 198.51.100.4'),1),'198.51.100.4','what the client wrote to the left is ignored');
 assert.equal(clientAddress(from('10.0.0.2','6.6.6.6, 198.51.100.4, 10.0.0.1'),2),'198.51.100.4');
 assert.equal(clientAddress({socket:{remoteAddress:'10.0.0.2'},headers:{'x-forwarded-for':['6.6.6.6','198.51.100.4']}},1),'198.51.100.4','repeated headers are one list');
 assert.equal(clientAddress(from('10.0.0.9'),1),'10.0.0.9','a request that bypassed the proxy is its sender');
 assert.equal(clientAddress(from('10.0.0.9','198.51.100.4'),2),'10.0.0.9','a chain shorter than configured is not believed');
});
test('the proxy count is a small whole number or the server does not start',()=>{
 assert.equal(trustedProxyCount(undefined),0);assert.equal(trustedProxyCount(''),0);assert.equal(trustedProxyCount('2'),2);
 for(const bad of ['-1','1.5','yes','9','true'])assert.throws(()=>trustedProxyCount(bad),/CODELINE_TRUSTED_PROXIES/,bad);
});
test('a proxied visitor is not the local author, even when the proxy forwards a loopback host name',()=>{
 const req={socket:{remoteAddress:'127.0.0.1'},headers:{host:'127.0.0.1:5173','x-forwarded-for':'198.51.100.4'}};
 assert.equal(authorRefusal(req),null,'without the client address the proxy on loopback looks like the local author');
 assert.equal(authorRefusal(req,{client:clientAddress(req,1)})?.status,403);
});
test('the server tells the page whether this client is served authoring, and grants nothing by it',async()=>{
 await serve({},async port=>{
  assert.deepEqual((await call(port,'GET','/api/access')).body,{authoring:true},'the local author');
 });
 await serve({trustedProxies:1},async port=>{
  const visitor={'X-Forwarded-For':'198.51.100.4'};
  assert.deepEqual((await call(port,'GET','/api/access',visitor)).body,{authoring:false});
  assert.equal((await call(port,'POST','/api/author/format',visitor,{source:'let a = 1;',language:'typescript'})).status,403);
 });
 await serve({authorToken:'s3cret-token'},async port=>{
  assert.deepEqual((await call(port,'GET','/api/access')).body,{authoring:false},'the page sends no token');
  assert.deepEqual((await call(port,'GET','/api/access',{Authorization:'Bearer s3cret-token'})).body,{authoring:true});
 });
});
test('behind a proxy each visitor has their own request allowance',async()=>{
 await serve({trustedProxies:1},async port=>{
  const evaluate=address=>call(port,'POST','/api/evaluate',{'X-Forwarded-For':address},{exerciseId:'none',revision:1,lines:[]});
  let last;for(let i=0;i<121;i++)last=await evaluate('198.51.100.4');
  assert.equal(last.status,429,'one visitor over the limit');
  assert.notEqual((await evaluate('198.51.100.5')).status,429,'does not use up another visitor’s allowance');
  assert.equal((await evaluate('198.51.100.5, 198.51.100.4')).status,429,'a forged left entry does not reset the limit');
 });
});
