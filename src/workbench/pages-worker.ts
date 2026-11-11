/**
 * ADR-125 (NY-32): the Local Demo's engine in a module worker. The build's `vendor/typescript.mjs` is the shipped
 * compiler unchanged, ending with `globalThis.ts = ts`, which the engine reads when it is called; the engine itself is
 * the transitional `pages-api.js` (ADR-001), answering `local-demo`'s calls through worker-rpc. Only the Pages build
 * starts this worker.
 *
 * ADR-127 (P1): the compiler (9 MB, 1.6 MB compressed) loads with the first operation that reads source code, not
 * with the worker: listing and practising the shipped exercises, the policy settings and fetching the sample never
 * need it, so a learner never downloads it. A failed load is not remembered; the next author action tries again.
 */
import * as engine from './pages-api.js';
import {serve} from './worker-rpc.js';

const READS_SOURCE=new Set(['compileDraft','editRules','authorTransition','checkSource','formatSource']);
const FAILED='A TypeScript fordító nem töltődött be; ellenőrizd a hálózatot, és próbáld újra.';
let compiler:Promise<unknown>|undefined;
const loadCompiler=():Promise<unknown>=>compiler??=import('../vendor/typescript.mjs').catch(()=>{compiler=undefined;throw Error(FAILED);});
let loaded=false;
type Engine=(...args:never[])=>unknown;
/** ADR-132 (P2): the download is the stage worth naming (1.6 MB compressed, once per page). */
const withCompiler=(operation:Engine)=>async(report:(stage:string)=>void,...args:never[]):Promise<unknown>=>{
 if(!loaded){report('a TypeScript-fordító betöltése');await loadCompiler();loaded=true;report('');}
 return operation(...args);
};
const plain=(operation:Engine)=>(_report:(stage:string)=>void,...args:never[]):unknown=>operation(...args);

serve(self,Object.fromEntries(Object.entries(engine).map(([name,operation])=>[name,typeof operation!=='function'?operation:READS_SOURCE.has(name)?withCompiler(operation as Engine):plain(operation as Engine)])),{progress:true});
