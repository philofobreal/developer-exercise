/** Transport layer. Holds no reference validation logic. */
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {ServiceError} from './catalog.mjs';
import {AuthoringError} from '../author/generator.mjs';
const mime={'.txt':'text/plain; charset=utf-8','.ts':'text/plain; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.map':'application/json; charset=utf-8'};
const headers={
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function readJson(req,limit){const parts=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>limit)throw new ServiceError(413,'Payload too large');parts.push(chunk);}
  try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new ServiceError(400,'Invalid JSON');}}
export function createApplication({catalog,staticRoot}){
  const rate=new Map();
  const server=createServer(async(req,res)=>{
    for(const [name,value] of Object.entries(headers))res.setHeader(name,value);
    const ip=req.socket.remoteAddress??'',now=Date.now(),counter=rate.get(ip)??{since:now,count:0};
    if(now-counter.since>60_000){counter.since=now;counter.count=0;}
    rate.set(ip,counter);if(++counter.count>120)return json(res,429,{error:'Too many requests'});
    if(rate.size>2000)for(const [key,v] of rate)if(now-v.since>60_000)rate.delete(key);
    let route;
    try{route=decodeURIComponent(new URL(req.url??'/',`http://${req.headers.host||'localhost'}`).pathname);}
    catch{return json(res,400,{error:'Malformed URL'});}
    try{
      if(req.method==='GET'&&route==='/api/exercises')return json(res,200,{exercises:catalog.list()});
      if(req.method==='POST'&&route==='/api/evaluate')return json(res,200,catalog.evaluate(await readJson(req,1024*1024)));
      if(req.method==='POST'&&route.startsWith('/api/author/')){
        // A 436-line TypeScript service generates a >64KiB CodeLine JSON model.
        // Keep payload bounded, but do not prevent editing the documented 500-line models.
        const body=await readJson(req,1024*1024);
        if(route==='/api/author/format')return json(res,200,await catalog.format(body));
        if(route==='/api/author/compile')return json(res,200,await catalog.createDraft(body));
        if(route==='/api/author/preview')return json(res,200,catalog.preview(body));
      }
      if(req.method!=='GET'||route.startsWith('/api/'))return json(res,404,{error:'Not found'});
      const target=path.resolve(staticRoot,'.'+(route==='/'?'/index.html':route));
      if(!target.startsWith(staticRoot+path.sep))return json(res,403,{error:'Forbidden'});
      try{
        if(!(await stat(target)).isFile())return json(res,404,{error:'Not found'});
        const ext=path.extname(target);if(!Object.hasOwn(mime,ext))return json(res,403,{error:'File type not allowed'});
        res.writeHead(200,{'Content-Type':mime[ext],'Cache-Control':'no-store'});res.end(await readFile(target));
      }catch{return json(res,404,{error:'Not found'});}
    }catch(error){
      if(error instanceof ServiceError)return json(res,error.statusCode,{error:error.message});
      if(error instanceof AuthoringError)return json(res,400,{error:error.message});
      return json(res,400,{error:'Érvénytelen kérés vagy nem elérhető TypeScript parser.'});
    }
  });
  server.requestTimeout=10_000;
  return server;
}
