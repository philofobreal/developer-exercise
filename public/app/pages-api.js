/** GitHub Pages static demo adapter. All evaluation is local and demonstrative.
 * This is NEVER an authoritative server-grade grading endpoint. */
import {compileCodeLineExercise,validateSubmission,diagnoseSubmission,channelFeedback,codeLineDiagnosticReasons} from '../dist/index.js';
import {generateCodeLineExercise,DEPENDENCY_POLICY} from '../author/generator.mjs';
import {getLanguageAdapter} from '../author/languages.mjs';
import {auditReference} from '../author/audit.mjs';
import {authorRuleSheet,editAuthorModel,refreshAuthorModel,verifyAuthorModel} from '../dist/author/engine.js';
import {createReferenceAuditor} from '../dist/author/reference-audit.js';
import {auditMode,generatorOptions,policyRefusal,recordedContract,resolveAuthorPolicy} from '../dist/author/preflight/config-resolver.js';
import {sourceGate} from '../dist/author/preflight/source-gate.js';
import {runtimeSafety} from '../dist/author/preflight/runtime-safety.js';
import {rulesGate,snapshotOf} from '../dist/author/preflight/rules-gate.js';

export const validationMode='local-demo';
const records = new Map();
const drafts = new Map();
let nextDraft = 1;
const MAX_DRAFTS = 25;
const MODEL_LIMIT = 500;

function assertSafeModel(model){
  const compiled=compileCodeLineExercise(model);
  if('status' in compiled)throw Error(compiled.message);
  const self=validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:model.lines.map(l=>l.code)},{maxStates:200_000});
  if(!self.accepted)throw Error('A referencia nem érvényes: '+self.message);
  return compiled.compiled;
}
function getTypeScript(){
  if(!globalThis.ts?.createSourceFile)throw Error('A TypeScript fordító még nem elérhető. Frissítsd az oldalt.');
  return globalThis.ts;
}
export async function getExercises(){
  const res=await fetch(new URL('../examples/manifest.json',import.meta.url));
  if(!res.ok)throw Error('Példafeladat-manifeszt nem tölthető be.');
  const names=await res.json();
  for(const name of names){
    const r=await fetch(new URL('../examples/'+encodeURIComponent(name),import.meta.url));
    if(!r.ok)throw Error('Hiányzik egy referenciafeladat: '+name);
    const model=await r.json();
    records.set(model.id,{model,compiled:assertSafeModel(model)});
  }
  return [...records.values()].map(({model:d})=>({
    id:d.id,revision:d.revision,language:d.language,title:d.title,description:d.description,...(d.level?{level:d.level}:{}),
    lines:d.lines.map(l=>({id:l.id,code:l.code,fixed:l.fixed,normalization:l.normalization??'indent',functionBlock:l.functionBlock}))
  }));
}
export async function compileDraft(body){
  if(body?.refreshDependencies!==undefined&&typeof body.refreshDependencies!=='boolean'||body?.refreshDependencies&&!body.model)throw Error('A függőségfrissítéshez teljes modell és logikai refreshDependencies jelző kell.');
  let model,refresh,policy;
  if(body?.model){
    if(typeof body.model!=='object'||Array.isArray(body.model))throw Error('A szerzői modell nem objektum.');
    model={...structuredClone(body.model),id:'draft',revision:1};
  }else{
    // ADR-108 (E1): the same policy resolution as the server, in the browser.
    policy=resolveAuthorPolicy(body??{});const refusal=policyRefusal(policy);if(refusal)throw Error(refusal);
    model=generateCodeLineExercise({...(body??{}),...generatorOptions(policy)},getTypeScript());
  }
  if(body?.refreshDependencies)({model,report:refresh}=await refreshAuthorModel(model,{generate:input=>generateCodeLineExercise(input,getTypeScript()),audit:reference=>auditReference(reference,getTypeScript())}));
  if(!model.lines?.length||model.lines.length>MODEL_LIMIT)throw Error('Túl sok kódsor.');
  const draftId='pages-'+nextDraft++;
  model={...model,id:'author-'+draftId,revision:1};
  const compiled=assertSafeModel(model);
  auditReference(model,getTypeScript());
  // ADR-108 (E5a): the same first gate as the server. Without a standard library the audit is not-run, so
  // the gate is inconclusive here: it lets the draft through only under the `warn` policy.
  // An imported model states its own source contract (plan §2.3): its recorded environment is the
    // requested policy, an assumption and never a proof (C27).
    policy??=resolveAuthorPolicy({language:model.language,...recordedContract(model),...(body?.policy!==undefined?{policy:body.policy}:{})});
  {const refusal=policyRefusal(policy);if(refusal)throw Error(refusal);}
  const reviewed=typeof body?.source==='string'&&!body?.model?body.source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n'):model.lines.map(l=>l.code).join('\n');
  const gate=sourceGate(createReferenceAuditor(getTypeScript()).audit(reviewed,model.language,auditMode(policy)),policy,runtimeSafety(getTypeScript(),reviewed,model.language==='typescript'?'typescript':'javascript',{objectState:policy.effective.objectState}));
  if(!gate.admitted)throw Object.assign(Error(gate.message),{details:{gate,policy}});
  if(drafts.size>=MAX_DRAFTS)drafts.delete(drafts.keys().next().value);
  // No standard library is shipped to the static demo: the language audit reports `not-run` (ADR-016).
  const audit=createReferenceAuditor(getTypeScript()).audit(model.lines.map(l=>l.code).join('\n'),model.language,auditMode(policy));
  const verification=await verifyAuthorModel(model,{generate:input=>generateCodeLineExercise(input,getTypeScript())},{audit:audit.semantics});
  drafts.set(draftId,{model,compiled,audit,verification,snapshot:snapshotOf(reviewed,policy,gate)});
  return {draftId,model,previewOnly:true,mode:'local-demo',audit,verification,rules:authorRuleSheet(model),...(refresh?{refresh}:{}),policy,gate};
}
/** Typed rule edits on the demo's own draft copy (ADR-018, ADR-021); a refused edit is `ok: false`. */
export async function editRules(body){
  const ref=drafts.get(body?.draftId);
  if(!ref||!Array.isArray(body.edits))throw Error('Érvénytelen vagy lejárt szerzői előnézet.');
  const {result,verification}=await editAuthorModel(ref.model,body.edits,{generate:input=>generateCodeLineExercise(input,getTypeScript())},{audit:ref.audit.semantics});
  if(!result.ok)return result;
  const draftId='pages-'+nextDraft++,model={...result.model,id:'author-'+draftId},compiled=assertSafeModel(model);
  drafts.delete(body.draftId);drafts.set(draftId,{model,compiled,audit:ref.audit,verification,snapshot:ref.snapshot});
  return {ok:true,draftId,model,previewOnly:true,mode:'local-demo',audit:ref.audit,verification,effect:result.effect,rules:authorRuleSheet(model),...(ref.snapshot?{policy:ref.snapshot.policy}:{})};
}
/** ADR-108 (E7): the same policy resolver as the server, for the settings block. */
export async function resolvePolicy(body){return resolveAuthorPolicy(body??{});}
/** ADR-108 (E6): the same second gate as the server, on the demo's own draft copy. */
export async function authorTransition(body){
  const ref=drafts.get(body?.draftId);
  if(!ref)throw Error('Érvénytelen vagy lejárt szerzői előnézet.');
  return {ok:true,draftId:body.draftId,gate:admit(ref,body)};
}
function admit(ref,body){
  const policy=resolveAuthorPolicy({...body,language:ref.model.language});{const refusal=policyRefusal(policy);if(refusal)throw Error(refusal);}
  const gate=rulesGate({snapshot:ref.snapshot,current:{source:body.source,policy},model:ref.model,verification:ref.verification,analyzer:`${DEPENDENCY_POLICY}+typescript-${getTypeScript().version}`});
  if(!gate.admitted)throw Error(gate.message);
  ref.tryProof=gate.proof;
  return gate;
}
export async function previewDraft(body){
  const ref=drafts.get(body?.draftId);
  if(!ref||!Array.isArray(body.lines))throw Error('Érvénytelen vagy lejárt szerzői előnézet.');
  // As on the server: a preview carrying the current source passes the second gate itself.
  if(!ref.tryProof&&typeof body.source==='string')admit(ref,body);
  if(!ref.tryProof)throw Error('A Próba lépés még nincs megnyitva ehhez a modellhez: előbb a második kapun (Szabályok → Próba) kell átmenni.');
  const report=diagnoseSubmission(ref.compiled,{exerciseId:ref.model.id,revision:ref.model.revision,lines:body.lines},{maxStates:30_000,reasons:ref.reasons??=codeLineDiagnosticReasons(ref.model)});
  return {...report.verdict,feedback:channelFeedback(report,'author-preview',ref.model.learnerFeedback)};
}
export async function evaluate(body){
  const ref=records.get(body?.exerciseId);
  if(!ref)throw Error('Ismeretlen referenciafeladat.');
  // ADR-027: the learner level is the exercise author's explicit choice, never provenance.
  const report=diagnoseSubmission(ref.compiled,body,{maxStates:50_000});
  return {...report.verdict,feedback:channelFeedback(report,'learner',ref.model.learnerFeedback)};
}
export async function loadTypeScriptFixture(){
  const res=await fetch(new URL('../samples/copy-field-utility.service.ts',import.meta.url));
  if(!res.ok)throw Error('A mellékelt TypeScript minta nem tölthető be.');
  return res.text();
}
export async function formatSource(source,language){
  return getLanguageAdapter(language).format(source,getTypeScript());
}
