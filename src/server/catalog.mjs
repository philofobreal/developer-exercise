/**
 * Deep server module: the only owner of trusted references and ephemeral drafts.
 * HTTP handlers do not know compilation details or mutable draft structures.
 */
import {randomUUID} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {generateCodeLineExercise,AuthoringError} from '../author/generator.mjs';
import {getLanguageAdapter} from '../author/languages.mjs';
import {auditReference} from '../author/audit.mjs';
import {compileCodeLineExercise,validateSubmission} from '../../dist/index.js';
import {refreshLegacyDependencies} from '../../dist/author/engine.js';
export class ServiceError extends Error{constructor(code,message){super(message);this.statusCode=code;}}
export class ExerciseCatalog{
  constructor(records){this.trusted=records;this.drafts=new Map();this.ts=null;}
  static async open(examplesDir){
    const records=new Map(),catalog=new ExerciseCatalog(records);
    for(const filename of (await readdir(examplesDir)).filter(x=>x.endsWith('.json')).sort()){
      const model=JSON.parse(await readFile(path.join(examplesDir,filename),'utf8'));
      const result=compileCodeLineExercise(model);
      if('status' in result)throw Error(`Invalid reference ${model.id}: ${result.message}`);
      auditReference(model,await catalog.parser());
      const self=validateSubmission(result.compiled,{exerciseId:model.id,revision:model.revision,lines:model.lines.map(x=>x.code)});
      if(!self.accepted)throw Error(`Reference ${model.id} inconsistent: ${self.message}`);
      if(records.has(model.id))throw Error(`Duplicate exercise ${model.id}`);
      records.set(model.id,{model,compiled:result.compiled});
    }
    if(!records.size)throw Error('No JSON exercises in examples/');
    return catalog;
  }
  list(){return [...this.trusted.values()].map(({model:d})=>({id:d.id,revision:d.revision,language:d.language,title:d.title,description:d.description,
    lines:d.lines.map(l=>({id:l.id,code:l.code,fixed:l.fixed,normalization:l.normalization??'indent',functionBlock:l.functionBlock}))}));}
  async parser(){return this.ts??=(await import('typescript')).default;}
  async format({source,language='typescript'}={}){return getLanguageAdapter(language).format(source,await this.parser());}
  prune(){const now=Date.now();for(const [key,value] of this.drafts)if(now-value.created>1_800_000)this.drafts.delete(key);}
  async createDraft(body){
    this.prune();if(this.drafts.size>=100)throw new ServiceError(429,'Too many active previews');
    if(body?.refreshDependencies!==undefined&&typeof body.refreshDependencies!=='boolean'||body?.refreshDependencies&&!body.model)throw new ServiceError(400,'A függőségfrissítéshez teljes modell és logikai refreshDependencies jelző kell.');
    let model;
    if(body?.model){
      if(typeof body.model!=='object'||Array.isArray(body.model))throw new ServiceError(400,'Invalid author model');
      model={...structuredClone(body.model),id:'draft',revision:1};
    }else model=generateCodeLineExercise(body??{},await this.parser());
    if(body?.refreshDependencies)try{const parser=await this.parser();model=await refreshLegacyDependencies(model,{generate:input=>generateCodeLineExercise(input,parser),audit:reference=>auditReference(reference,parser)});}catch(error){throw new ServiceError(422,error.message);}
    const draftId=randomUUID();model.id=`author-${draftId}`;
    const result=compileCodeLineExercise(model);
    if('status' in result)throw new ServiceError(422,result.message);
    auditReference(model,await this.parser());
    const self=validateSubmission(result.compiled,{exerciseId:model.id,revision:1,lines:model.lines.map(l=>l.code)},{maxStates:200_000});
    if(!self.accepted)throw new ServiceError(422,`A referencia nem érvényes: ${self.message}`);
    this.drafts.set(draftId,{created:Date.now(),model,compiled:result.compiled});
    return {draftId,model,previewOnly:true,mode:'preview-validation'};
  }
  preview(body){
    this.prune();if(typeof body?.draftId!=='string'||!Array.isArray(body?.lines)||body.lines.length>500)throw new ServiceError(400,'Invalid draft submission');
    const item=this.drafts.get(body.draftId);if(!item)throw new ServiceError(404,'Preview not found or expired');
    return validateSubmission(item.compiled,{exerciseId:item.model.id,revision:1,lines:body.lines},{maxStates:30_000});
  }
  evaluate(body){
    if(!body||typeof body.exerciseId!=='string'||!Array.isArray(body.lines)||body.lines.length>500)throw new ServiceError(400,'Invalid submission');
    const item=this.trusted.get(body.exerciseId);if(!item)throw new ServiceError(404,'Exercise not found');
    return validateSubmission(item.compiled,body,{maxStates:50_000});
  }
}
