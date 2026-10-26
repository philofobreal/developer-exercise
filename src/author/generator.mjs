/** Language-independent CodeLine v2 projection (ADR-011): the adapter supplies the
 * AST-derived structure, whitespace and ordering relations; this module owns the
 * block/scope hierarchy, the physical-row limits and the mapping to line IDs. */
import {AuthoringError} from './errors.mjs';
import {getLanguageAdapter} from './languages.mjs';
import {reduceGeneratedDependencies,sealMultiRowUnits} from '../../dist/author/ordering-relations.js';
export {AuthoringError} from './errors.mjs';
export function generateCodeLineExercise({source,language='javascript',title='Saját feladat',description='Rendezd sorba a programkódot.'},ts){
 const adapter=getLanguageAdapter(language);
 if(typeof source!=='string'||source.length>50_000)throw new AuthoringError('Túl hosszú vagy hiányzó forráskód (maximum 50 KB).');
 const normalized=source.replace(/\r\n?/g,'\n').trimEnd();
 if(!normalized.trim()||/[\u2028\u2029]/.test(normalized))throw new AuthoringError('Üres forrás vagy nem támogatott sorhatár.');
 const ast=adapter.parse(normalized,ts),physical=normalized.split('\n'),exact=adapter.whitespace(ast,ts);
 const rows=physical.flatMap((code,line)=>code.trim()||exact.has(line)?[{code,line}]:[]);
 if(rows.length>500||rows.some(x=>x.code.length>2048))throw new AuthoringError('Legfeljebb 500 sor és soronként 2048 karakter támogatott.');
 const candidates=adapter.structure(ast,ts).filter(x=>x.start<x.end);
 const counts=new Map();for(const b of candidates)for(const line of [b.start,b.end])counts.set(line,(counts.get(line)??0)+1);
 const retained=[],omitted=[];
 for(const b of candidates.sort((a,b)=>a.start-b.start||b.end-a.end)){
  if(counts.get(b.start)>1||counts.get(b.end)>1||retained.length>=250)omitted.push(b);else retained.push({...b,id:'scope-'+(retained.length+1)});
 }
 let nextFunction=1;
 for(const b of retained){b.parent=retained.filter(x=>x.start<b.start&&x.end>b.end).at(-1)??null;if(b.kind==='function')b.functionBlock=nextFunction++;}
 const byPhysical=new Map(rows.map((x,i)=>[x.line,i+1]));
 const blocks=retained.map(b=>({id:b.id,kind:b.kind,parentScopeId:b.parent?.id??null,openLineId:byPhysical.get(b.start),closeLineId:byPhysical.get(b.end),...(b.kind==='function'?{functionBlock:b.functionBlock}:{})}));
 const lines=rows.map(({code,line},i)=>{
  const boundary=retained.find(b=>b.start===line||b.end===line);
  const scope=retained.filter(b=>b.start<line&&line<b.end).at(-1)??null;
  let owner=boundary?.kind==='function'?boundary:scope;
  while(owner&&owner.kind!=='function')owner=owner.parent;
  return {id:i+1,sourceLine:line+1,code,dependencies:i?[i]:[],fixed:false,functionBlock:owner?.functionBlock??0,scopeId:scope?.id??null,normalization:exact.has(line)?'exact':'indent'};
 });
 // Project the adapter's language-independent ordering relations onto line IDs.
 const ordering=adapter.orderingRelations?.(ast,ts),protectedById=new Map(),toIds=rows=>[...rows].map(row=>byPhysical.get(row)).filter(id=>id!==undefined);
 if(ordering){
  for(const entry of ordering.entries){const id=byPhysical.get(entry.row);if(id!==undefined)lines[id-1].dependencies=toIds(entry.after);}
  for(const [row,inputs] of ordering.protectedInputs){const id=byPhysical.get(row);if(id!==undefined)protectedById.set(id,new Set(toIds(inputs)));}
  const units=ordering.spans.map(unit=>({first:byPhysical.get(unit.first),last:byPhysical.get(unit.last)})).filter(unit=>unit.first!==undefined&&unit.last!==undefined);
  sealMultiRowUnits(lines,units,new Map(retained.map(b=>[byPhysical.get(b.start),b.id])));
 }
 reduceGeneratedDependencies(lines,protectedById);
 // A single row can close and open scopes (} else {). Preserve all unambiguous
 // ancestors/children and lock only each unrepresentable interval to source order.
 const edgeMap=new Map();
 for(const b of omitted){const ids=rows.flatMap((x,i)=>x.line>=b.start&&x.line<=b.end?[i+1]:[]);for(let i=1;i<ids.length;i++)edgeMap.set(ids[i-1]+':'+ids[i],{before:ids[i-1],after:ids[i]});}
 return {schemaVersion:2,id:'draft',revision:1,language,title:String(title).slice(0,140)||'Saját feladat',description:String(description).slice(0,500),lines,blocks,edges:[...edgeMap.values()],profiles:[],authoring:{strategy:'ast-hierarchy',reason:omitted.length?'shared-physical-boundaries':'',omittedBlocks:omitted.length,semanticEquivalenceProven:false,dependencyPolicy:'scoped-effect-analysis-v7',...(ordering?.note?{note:ordering.note}:{}),dependencyHints:adapter.analyzeDependencies?.(ast,ts)??[]}};
}
