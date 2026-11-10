/**
 * ADR-125 (NY-32): calls across a worker boundary, as promises. One side `serve`s a set of async operations, the other
 * `connect`s and calls them by name. Hidden here: the message shape, the call numbering, how an error crosses (its
 * message and its plain `details`, as the author flow reads them: `error.details.gate`), and what happens when the
 * worker cannot start or dies (every waiting and later call fails with one clear message instead of hanging).
 */

/** The part of a worker (or of the worker's own global scope) this module needs. */
export interface MessagePortLike {
 postMessage(message:unknown):void;
 addEventListener(type:'message',listener:(event:MessageEvent<unknown>)=>void):void;
 addEventListener(type:'error',listener:(event:Event)=>void):void;
}
interface Request {id:number;op:string;args:unknown[];}
type Reply={id:number;ok:true;value:unknown}|{id:number;ok:false;message:string;details?:unknown};
type Operation=(...args:never[])=>unknown;

const isRequest=(value:unknown):value is Request=>typeof value==='object'&&value!==null&&typeof (value as Request).id==='number'&&typeof (value as Request).op==='string'&&Array.isArray((value as Request).args);
const isReply=(value:unknown):value is Reply=>typeof value==='object'&&value!==null&&typeof (value as Reply).id==='number'&&typeof (value as Reply).ok==='boolean';

/** Answers every request with the named operation's result; an unknown operation or a thrown error is a failed reply. */
export function serve(port:MessagePortLike,operations:Readonly<Record<string,unknown>>):void {
 port.addEventListener('message',async event=>{
  const request=event.data;if(!isRequest(request))return;
  const operation=operations[request.op];
  try{
   if(typeof operation!=='function')throw Error(`Ismeretlen művelet: ${request.op}`);
   const value=await (operation as Operation)(...(request.args as never[]));
   port.postMessage({id:request.id,ok:true,value} satisfies Reply);
  }catch(error){
   const details=typeof error==='object'&&error!==null&&'details' in error?(error as {details:unknown}).details:undefined;
   port.postMessage({id:request.id,ok:false,message:error instanceof Error?error.message:String(error),...(details===undefined?{}:{details})} satisfies Reply);
  }
 });
}

/** A caller of the operations `serve` answers on the other side. `failure` is the message every call gets once the
 *  other side cannot answer (it failed to start or crashed). */
export function connect(port:MessagePortLike,failure:string):(op:string,...args:unknown[])=>Promise<unknown> {
 const waiting=new Map<number,{resolve:(value:unknown)=>void;reject:(error:Error)=>void}>();
 let next=1,broken=false;
 const fail=():void=>{broken=true;for(const call of waiting.values())call.reject(Error(failure));waiting.clear();};
 port.addEventListener('error',fail);
 port.addEventListener('message',event=>{
  const reply=event.data;if(!isReply(reply))return;
  const call=waiting.get(reply.id);if(!call)return;waiting.delete(reply.id);
  if(reply.ok)call.resolve(reply.value);
  else call.reject(Object.assign(Error(reply.message),reply.details===undefined?{}:{details:reply.details}));
 });
 return (op,...args)=>broken?Promise.reject(Error(failure)):new Promise((resolve,reject)=>{
  const id=next++;waiting.set(id,{resolve,reject});port.postMessage({id,op,args} satisfies Request);
 });
}
