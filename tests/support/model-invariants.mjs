/** Validator-independent checks of an accepted witness (CodeLine v2 models). */
const leading=/^[ \t]+/;
const normalize=(code,mode)=>mode==='exact'?code:code.replace(leading,'');

/** Returns null when the witness satisfies every declared model contract, else a reason. */
export function witnessViolation(model,lines,report){
 const tokens=report.matchedTokenIds;
 if(!Array.isArray(tokens)||tokens.length!==lines.length||lines.length!==model.lines.length)return 'witness-length';
 const byId=new Map(model.lines.map(line=>[line.id,line])),position=new Map();
 tokens.forEach((token,index)=>position.set(Number(String(token).replace(/^n:/,'')),index));
 if(position.size!==model.lines.length||[...position.keys()].some(id=>!byId.has(id)))return 'witness-not-bijective';
 for(const [id,index] of position){
  const line=byId.get(id),mode=line.normalization??'indent';
  if(normalize(lines[index],mode)!==normalize(line.code,mode))return `content ${id}@${index}`;
  if(line.fixed&&model.lines.indexOf(line)!==index)return `fixed ${id}`;
  for(const dep of line.dependencies)if(!(position.get(dep)<index))return `dependency ${dep}->${id}`;
 }
 for(const edge of model.edges??[])if(!(position.get(edge.before)<position.get(edge.after)))return `edge ${edge.before}->${edge.after}`;
 if(model.profiles?.length){
  const profile=model.profiles.find(p=>p.id===report.matchedProfile);
  if(!profile)return 'profile';
  for(const edge of profile.edges)if(!(position.get(edge.before)<position.get(edge.after)))return `profile-edge ${edge.before}->${edge.after}`;
 }
 const opens=new Map(model.blocks.map(b=>[b.openLineId,b.id])),closes=new Map(model.blocks.map(b=>[b.closeLineId,b.id])),stack=[];
 for(const token of tokens){
  const id=Number(String(token).replace(/^n:/,'')),line=byId.get(id),close=closes.get(id);
  if(close!==undefined){if(stack.at(-1)!==close)return `block-close ${id}`;stack.pop();}
  if((stack.at(-1)??null)!==line.scopeId)return `scope ${id}`;
  const open=opens.get(id);if(open!==undefined)stack.push(open);
 }
 return stack.length?'unclosed-block':null;
}

/** Applies a bijective ID relabelling to every reference inside a v2 model. */
export function relabel(model,map){
 const next=structuredClone(model),to=id=>map.get(id);
 for(const line of next.lines){line.id=to(line.id);line.dependencies=line.dependencies.map(to).sort((a,b)=>a-b);}
 for(const block of next.blocks){block.openLineId=to(block.openLineId);block.closeLineId=to(block.closeLineId);}
 for(const edge of next.edges??[]){edge.before=to(edge.before);edge.after=to(edge.after);}
 for(const profile of next.profiles??[])for(const edge of profile.edges){edge.before=to(edge.before);edge.after=to(edge.after);}
 return next;
}
/** The order-relevant projection of a generated model: names and IDs excluded. */
export const structure=model=>JSON.stringify({lines:model.lines.map(({dependencies,fixed,functionBlock,scopeId,normalization})=>({dependencies,fixed,functionBlock,scopeId,normalization})),blocks:model.blocks,edges:model.edges??[]});
