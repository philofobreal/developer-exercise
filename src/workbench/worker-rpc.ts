/**
 * ADR-125 (NY-32): calls across a worker boundary, as promises. One side `serve`s a set of async operations, the other
 * `connect`s and calls them by name. Hidden here: the message shape, the call numbering, how an error crosses (its
 * message and its plain `details`, as the author flow reads them: `error.details.gate`), and what happens when the
 * worker cannot start or dies (every waiting and later call fails with one clear message instead of hanging).
 * ADR-132 (P2): an operation served with `progress` receives a reporter as its first argument and may name its stage
 * while it runs; the caller's `onProgress` hears it. A caller may stop waiting (`cancel`): every waiting call fails with
 * the given message and the connection is closed. With nothing waiting, `cancel` does nothing and says so, so a caller
 * never tears down an idle worker (and the state it holds) for nothing.
 */

/** The part of a worker (or of the worker's own global scope) this module needs. */
export interface MessagePortLike {
 postMessage(message:unknown):void;
 addEventListener(type:'message',listener:(event:MessageEvent<unknown>)=>void):void;
 addEventListener(type:'error',listener:(event:Event)=>void):void;
}
interface Request {id:number;op:string;args:unknown[];}
type Reply={id:number;ok:true;value:unknown}|{id:number;ok:false;message:string;details?:unknown};
interface Progress {id:number;progress:string;}
type Operation=(...args:never[])=>unknown;

const isRequest=(value:unknown):value is Request=>typeof value==='object'&&value!==null&&typeof (value as Request).id==='number'&&typeof (value as Request).op==='string'&&Array.isArray((value as Request).args);
const isReply=(value:unknown):value is Reply=>typeof value==='object'&&value!==null&&typeof (value as Reply).id==='number'&&typeof (value as Reply).ok==='boolean';
const isProgress=(value:unknown):value is Progress=>typeof value==='object'&&value!==null&&typeof (value as Progress).id==='number'&&typeof (value as Progress).progress==='string';

/** Answers every request with the named operation's result; an unknown operation or a thrown error is a failed reply.
 *  With `progress`, each operation is called with a reporter of its stage first (an empty text clears it). */
export function serve(port:MessagePortLike,operations:Readonly<Record<string,unknown>>,options:{progress?:boolean}={}):void {
 port.addEventListener('message',async event=>{
  const request=event.data;if(!isRequest(request))return;
  const operation=operations[request.op];
  try{
   if(typeof operation!=='function')throw Error(`Ismeretlen művelet: ${request.op}`);
   const report=(progress:string):void=>{port.postMessage({id:request.id,progress} satisfies Progress);};
   const value=await (operation as Operation)(...((options.progress?[report,...request.args]:request.args) as never[]));
   port.postMessage({id:request.id,ok:true,value} satisfies Reply);
  }catch(error){
   const details=typeof error==='object'&&error!==null&&'details' in error?(error as {details:unknown}).details:undefined;
   port.postMessage({id:request.id,ok:false,message:error instanceof Error?error.message:String(error),...(details===undefined?{}:{details})} satisfies Reply);
  }
 });
}

/** Calls of the other side's operations; `cancel` stops waiting for all of them and closes the connection, or, with no
 *  call waiting, does nothing and returns false. */
export interface Connection {(op:string,...args:unknown[]):Promise<unknown>;cancel(message:string):boolean;}
/** A caller of the operations `serve` answers on the other side. `failure` is the message every call gets once the
 *  other side cannot answer (it failed to start or crashed); `onProgress` hears a waiting call's stage. */
export function connect(port:MessagePortLike,failure:string,onProgress?:(stage:string)=>void):Connection {
 const waiting=new Map<number,{resolve:(value:unknown)=>void;reject:(error:Error)=>void}>();
 let next=1,broken=false,closed=failure;
 const fail=(message:string):void=>{broken=true;closed=message;for(const call of waiting.values())call.reject(Error(message));waiting.clear();};
 port.addEventListener('error',()=>fail(failure));
 port.addEventListener('message',event=>{
  const reply=event.data;
  if(isProgress(reply)){if(waiting.has(reply.id))onProgress?.(reply.progress);return;}
  if(!isReply(reply))return;
  const call=waiting.get(reply.id);if(!call)return;waiting.delete(reply.id);
  if(reply.ok)call.resolve(reply.value);
  else call.reject(Object.assign(Error(reply.message),reply.details===undefined?{}:{details:reply.details}));
 });
 const call=(op:string,...args:unknown[]):Promise<unknown>=>broken?Promise.reject(Error(closed)):new Promise((resolve,reject)=>{
  const id=next++;waiting.set(id,{resolve,reject});port.postMessage({id,op,args} satisfies Request);
 });
 return Object.assign(call,{cancel:(message:string):boolean=>{if(broken||!waiting.size)return false;fail(message);return true;}});
}
