/** Reference publication audit. Never called for learner submissions. */
import {getLanguageAdapter} from './languages.mjs';
import {AuthoringError} from './errors.mjs';
export function auditReference(model,ts){
 const adapter=getLanguageAdapter(model.language),source=model.lines.map(x=>x.code).join('\n');
 const file=adapter.parse(source,ts),exact=adapter.whitespace(file,ts);
 for(const line of exact)if(model.lines[line]?.normalization!=='exact')throw new AuthoringError('A többsoros literál sorai exact normalizálást igényelnek.');
 return {syntaxValid:true,semanticEquivalenceProven:false};
}
