/** Atomic frontend lifecycle for preview models and compatible attempts. */
import {createAttempt} from './attempt.js';
export function installPreview(state,data,{preserveAttempt=false,restoredAttempt}={}){
 const prior=state.exercises.find(x=>x.id===state.active),previous=state.attempts.get(state.active),m=data.model;
 const compatible=preserveAttempt&&prior&&previous&&prior.lines.length===m.lines.length&&prior.lines.every((l,i)=>{const n=m.lines[i];return l.id===n.id&&l.code===n.code&&l.fixed===n.fixed&&(l.normalization??'indent')===(n.normalization??'indent');});
 const attempt=restoredAttempt??(compatible?previous:createAttempt(m));attempt.report=null;attempt.feedback='';
 for(const id of state.previews.keys())state.attempts.delete(id);
 state.exercises=state.exercises.filter(x=>!state.previews.has(x.id));state.previews.clear();
 const item={id:m.id,revision:m.revision,language:m.language,title:m.title,description:m.description,lines:m.lines,previewOnly:true};
 state.exercises.unshift(item);state.previews.set(item.id,data.draftId);state.attempts.set(item.id,attempt);state.active=item.id;
 state.authorModel=structuredClone(m);
 // What the API reported with this draft (ADR-021); presentation data, never a rule source.
 state.authorInsight={rules:data.rules,verification:data.verification,audit:data.audit,refresh:data.refresh,effect:data.effect};
 state.modelDraft=JSON.stringify(m,null,2);
 return {compatible:!!compatible,model:m};
}
