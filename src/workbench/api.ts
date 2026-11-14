/**
 * All server validation and authoring traffic behind one small API (the trusted-server mode). The Pages build serves
 * `local-demo` under this module's name instead (ADR-125), with the same operations; `api-parity.test.mjs` holds the
 * two to the same exports. Hidden here: the routes, the JSON wire format, how a refusal keeps its structured details
 * (a gate decision, a policy resolution) on `error.details` (ADR-108), and how waiting stops (ADR-132).
 *
 * NY-28: migrated from hand-written JavaScript (ADR-134); the behaviour is unchanged. Responses stay `unknown`: the
 * page's orchestration (`ui.js`, ADR-001) reads them, and the server's own types do not cross the wire.
 */
/** Which mode answers: this module is the trusted server; the Pages build serves `local-demo` under this module's name. */
export const validationMode:'trusted-server'|'local-demo'='trusted-server';

/** ADR-132 (P2): every request in flight, so the page can stop waiting for them. The server finishes the computation it
 *  started (it runs synchronously and cannot be interrupted); its answer is discarded. */
const inFlight=new Set<AbortController>();
const STOPPED='A műveletet megszakítottad. A szerver a már elkezdett számítást befejezi, az eredményét eldobjuk.';
export function abortPending():void {for(const controller of inFlight)controller.abort();inFlight.clear();}

interface Refusal {error?:string;gate?:unknown;policy?:unknown;}
const refusal=(data:unknown):Refusal=>typeof data==='object'&&data!==null?data as Refusal:{};
async function jsonRequest(url:string,body:unknown):Promise<unknown> {
 const controller=new AbortController();inFlight.add(controller);
 try{
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
  const data:unknown=await response.json();
  if(!response.ok){const refused=refusal(data);throw Object.assign(new Error(refused.error??`HTTP ${response.status}`),{details:{gate:refused.gate,policy:refused.policy}});}
  return data;
 }catch(error){if(controller.signal.aborted)throw new Error(STOPPED);throw error;}
 finally{inFlight.delete(controller);}
}
export const getExercises=async():Promise<unknown>=>{const response=await fetch('/api/exercises');if(!response.ok)throw new Error(`HTTP ${response.status}`);return (refusal(await response.json()) as {exercises?:unknown}).exercises;};
/** ADR-151: whether the server serves authoring to this client. An unanswered question counts as no: the page then
 *  offers practice only, and nothing it shows would be refused. */
export const authorAccess=async():Promise<boolean>=>{try{const response=await fetch('/api/access');return response.ok&&(await response.json() as {authoring?:unknown}).authoring===true;}catch{return false;}};
export const compileDraft=(body:unknown):Promise<unknown>=>jsonRequest('/api/author/compile',body);
/** ADR-113: the first gate on the source only; no draft is made. */
export const checkSource=(body:unknown):Promise<unknown>=>jsonRequest('/api/author/check',body);
/** ADR-108 (E7): the server's policy resolver for the language and settings (locks, inactive options, refusals); a safe
 *  query, so GET: nothing is stored, and the source is never part of it. */
export const resolvePolicy=async(settings:unknown):Promise<unknown>=>{
 const response=await fetch('/api/author/policy?request='+encodeURIComponent(JSON.stringify(settings)));const data:unknown=await response.json();
 if(!response.ok)throw new Error(refusal(data).error??`HTTP ${response.status}`);
 return data;
};
export const previewDraft=(body:unknown):Promise<unknown>=>jsonRequest('/api/author/preview',body);
/** Typed rule edits on the active draft (ADR-021); a refused edit answers `{ok:false,…}`. */
export const editRules=(body:unknown):Promise<unknown>=>jsonRequest('/api/author/rules',body);
export const evaluate=(body:unknown):Promise<unknown>=>jsonRequest('/api/evaluate',body);
export const loadTypeScriptFixture=async():Promise<string>=>{const response=await fetch('/samples/copy-field-utility.service.ts');if(!response.ok)throw Error('TS mintafájl nem elérhető');return response.text();};
export const formatSource=(source:string,language:string):Promise<unknown>=>jsonRequest('/api/author/format',{source,language});
