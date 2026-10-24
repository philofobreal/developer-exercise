/** GitHub Pages static demo adapter. All evaluation is local and demonstrative.
 * This is NEVER an authoritative server-grade grading endpoint. */
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {generateCodeLineExercise} from '../author/generator.mjs';
import {formatTypedSource} from '../author/ts-format.mjs';
import {beautifier,formatEditor} from '../formatter.js';

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
    id:d.id,revision:d.revision,language:d.language,title:d.title,description:d.description,
    lines:d.lines.map(l=>({id:l.id,code:l.code,fixed:l.fixed,normalization:l.normalization??'indent',functionBlock:l.functionBlock}))
  }));
}
export async function compileDraft(body){
  if(drafts.size>=MAX_DRAFTS)drafts.delete(drafts.keys().next().value);
  let model;
  if(body?.model){
    if(typeof body.model!=='object'||Array.isArray(body.model))throw Error('A szerzői modell nem objektum.');
    model={...body.model,id:'draft',revision:1};
  }else model=generateCodeLineExercise(body??{},getTypeScript());
  if(!model.lines?.length||model.lines.length>MODEL_LIMIT)throw Error('Túl sok kódsor.');
  const draftId='pages-'+nextDraft++;
  model={...model,id:'author-'+draftId,revision:1};
  const compiled=assertSafeModel(model);
  drafts.set(draftId,{model,compiled});
  return {draftId,model,previewOnly:true,mode:'local-demo'};
}
export async function previewDraft(body){
  const ref=drafts.get(body?.draftId);
  if(!ref||!Array.isArray(body.lines))throw Error('Érvénytelen vagy lejárt szerzői előnézet.');
  return validateSubmission(ref.compiled,{exerciseId:ref.model.id,revision:ref.model.revision,lines:body.lines},{maxStates:30_000});
}
export async function evaluate(body){
  const ref=records.get(body?.exerciseId);
  if(!ref)throw Error('Ismeretlen referenciafeladat.');
  return validateSubmission(ref.compiled,body,{maxStates:50_000});
}
export async function loadTypeScriptFixture(){
  const res=await fetch(new URL('../samples/copy-field-utility.service.ts',import.meta.url));
  if(!res.ok)throw Error('A mellékelt TypeScript minta nem tölthető be.');
  return res.text();
}
export async function formatSource(source,language){
  if(language==='javascript'&&beautifier())return {code:formatEditor(source),formatter:'js-beautify',indentSize:5};
  return formatTypedSource(source,language,getTypeScript());
}
