/** All server validation and authoring traffic behind one small API. */
/** A refusal keeps its structured details (a gate decision, a policy resolution) on `error.details` (ADR-108). */
async function jsonRequest(url,body){const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error??`HTTP ${response.status}`),{details:{gate:data.gate,policy:data.policy}});return data;}
export const validationMode='trusted-server';
export const getExercises=async()=>{const r=await fetch('/api/exercises');if(!r.ok)throw new Error(`HTTP ${r.status}`);return (await r.json()).exercises;};
export const compileDraft=body=>jsonRequest('/api/author/compile',body);
/** ADR-108 (E7): the server's policy resolver for the language and settings (locks, inactive options, refusals);
 * a safe query, so GET: nothing is stored, and the source is never part of it. */
export const resolvePolicy=async settings=>{const response=await fetch('/api/author/policy?request='+encodeURIComponent(JSON.stringify(settings)));const data=await response.json();if(!response.ok)throw new Error(data.error??`HTTP ${response.status}`);return data;};
export const previewDraft=body=>jsonRequest('/api/author/preview',body);
/** Typed rule edits on the active draft (ADR-021); a refused edit answers `{ok:false,…}`. */
export const editRules=body=>jsonRequest('/api/author/rules',body);
export const evaluate=body=>jsonRequest('/api/evaluate',body);
export const loadTypeScriptFixture=async()=>{const r=await fetch('/samples/copy-field-utility.service.ts');if(!r.ok)throw Error('TS mintafájl nem elérhető');return r.text();};
export async function formatSource(source,language){
  return jsonRequest('/api/author/format',{source,language});
}
