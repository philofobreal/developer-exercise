import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {listenApplication} from '../src/server/listen.mjs';
async function occupied(t){
 const server=createServer((req,res)=>res.end('other application'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));return server;
}
test('implicit-port fallback keeps the existing application and serves on another port',async t=>{
 const owner=await occupied(t),port=owner.address().port,server=createServer((req,res)=>res.end('ngDynamic')),retries=[];
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const address=await listenApplication(server,{port,allowFallback:true,onRetry:p=>retries.push(p)});
 assert.ok(address.port>port&&address.port<port+10);assert.equal(retries[0],port);
 assert.equal(await (await fetch(`http://127.0.0.1:${port}/`)).text(),'other application');
 assert.equal(await (await fetch(`http://127.0.0.1:${address.port}/`)).text(),'ngDynamic');
});
test('explicit occupied port fails without silently changing its configured address',async t=>{
 const owner=await occupied(t),server=createServer(),errors=server.listenerCount('error'),listening=server.listenerCount('listening');
 await assert.rejects(listenApplication(server,{port:owner.address().port}),{code:'EADDRINUSE'});
 assert.equal(server.listening,false);assert.equal(owner.listening,true);
 assert.equal(server.listenerCount('error'),errors);assert.equal(server.listenerCount('listening'),listening);
});
test('fallback attempts remain bounded',async t=>{
 const owner=await occupied(t),server=createServer();
 await assert.rejects(listenApplication(server,{port:owner.address().port,allowFallback:true,maxAttempts:1}),{code:'EADDRINUSE'});
});
test('invalid port is rejected before opening a listener',async()=>{
 for(const port of [NaN,-1,65536,1.5])await assert.rejects(listenApplication(createServer(),{port}),RangeError);
});
test('entrypoint reports explicit-port conflicts without an unhandled error stack',async t=>{
 const owner=await occupied(t),child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(owner.address().port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
 const timeout=setTimeout(()=>child.kill(),10000);t.after(()=>{clearTimeout(timeout);if(child.exitCode===null)child.kill();});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
 assert.equal(code,1);assert.match(stderr,/PORT/);assert.doesNotMatch(stderr,/Unhandled|node:events|throw er/);
});
