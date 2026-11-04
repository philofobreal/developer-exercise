/** How one generated model treats one arrangement, judged by the policy oracle (author
 * tooling; execution happens only on fixed fixtures). The one place that knows the
 * classification, why a rejection happened and whether the reference threw:
 *  - `unsound`: accepted, but the oracle sees a different behaviour;
 *  - `accepted`: accepted and equivalent (or undecided by the oracle: `undecided-accepted`);
 *  - `gap`: rejected although the oracle sees the same behaviour (incompleteness);
 *  - `intent` (ADR-043, policy A): rejected, the same behaviour, but the rejection keeps the
 *    reference's intent: every broken constraint touches a row the reference never executes, or
 *    the model accepts the order once the never-executed one-row statements of functions that do
 *    run are commented out (`dead-code`, ADR-072: its order counts as if that code ran), or a literal on a broken constraint's
 *    rows, replaced by another value, makes the order behave differently (`value`, ADR-067: the
 *    order counts as if that write or comparison used another value), or every broken constraint
 *    is a documented pedagogical rule the runtime cannot see (`policy`, ADR-068: `early-exit-order`,
 *    ADR-019's declaration that does not move behind a possible return, throw or break), or every
 *    broken constraint is a TypeScript type-level order the runtime cannot see (`type`, ADR-079:
 *    `overload-group`, the order and adjacency of overload signatures, which overload resolution
 *    and TS2389/TS2391 read; the emitted JavaScript erases them);
 *  - `justified`: rejected, and the behaviour differs;
 *  - `undecided`: rejected, oracle undecided; `indeterminate`: the validator's budget ran out.
 * A rejection's `causes` are the provenance codes of the direct constraints the order breaks,
 * or `scope` when it breaks none and only the lexical structure rejects it. */
import ts from 'typescript';
import {generateCodeLineExercise} from '../../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../../dist/index.js';
import {createOracle,codesOf} from './semantic-oracle.mjs';
import {literalsOf,valuesFor,replaced} from './literal-variants.mjs';

/** Reason codes of pedagogical rules that no run can tell apart (ADR-068). */
export const POLICY_INTENT=new Set(['early-exit-order']);
/** ADR-079: constraints that only TypeScript's type checker observes. */
export const TYPE_INTENT=new Set(['overload-group']);
/** At most this many variant verdicts per rejected order (ADR-067); none found is a gap. */
export const VALUE_VARIANTS=96;

export function createClassifier(fixture,model,{maxStates=200_000,policy='reflective',variants=VALUE_VARIANTS}={}){
 const compiled=compileCodeLineExercise(model);
 if(compiled.status)throw Error(fixture.id+': '+compiled.message);
 const judge=createOracle(fixture,{policy});
 const reasons=new Map();
 for(const entry of model.authoring?.provenance??[]){const key=entry.before+'>'+entry.after;reasons.set(key,[...reasons.get(key)??[],entry.code]);}
 const constraints=[...model.lines.flatMap(line=>line.dependencies.map(before=>[before,line.id])),...(model.edges??[]).map(edge=>[edge.before,edge.after])];
 const broken=order=>{const at=new Map(order.map((id,i)=>[id,i]));return constraints.filter(([before,after])=>at.get(before)>at.get(after));};
 function causes(order){
  const found=new Set();
  for(const [before,after] of broken(order))for(const code of reasons.get(before+'>'+after)??['unexplained'])found.add(code);
  return found.size?[...found].sort():['scope'];
 }
 // ADR-043: rows the reference never executes, by line id (sourceLine is 1-based).
 const row=new Map(model.lines.map((line,i)=>[line.id,(line.sourceLine??i+1)-1]));
 const dead=id=>!judge.executedRows().has(row.get(id));
 /** Policy A: an equivalent order rejected only for constraints that touch code the reference
  * never runs keeps the reference's intent, judged as if that code ran; not a gap. */
 const deadCode=pairs=>pairs.length>0&&pairs.every(([before,after])=>dead(before)||dead(after));
 // ADR-072: the same question when the constraints only exist because of code that never runs: the
 // model of the reference with every never-executed one-row expression statement commented out
 // (same rows, same options), built on first use; null when there is none or it does not generate.
 let withoutDead;const lineById=new Map(model.lines.map(line=>[line.id,line]));
 const deadFree=()=>{
  if(withoutDead!==undefined)return withoutDead;
  withoutDead=null;
  const rows=Array.isArray(fixture.source)?[...fixture.source]:fixture.source.split('\n'),executed=judge.executedRows();
  const file=ts.createSourceFile('variant.'+(fixture.language==='typescript'?'ts':'js'),rows.join('\n'),ts.ScriptTarget.Latest,true);
  let changed=false;
  // Only a branch, case or handler of code that did run counts as if it ran: the body of a function
  // that never runs has no position at which it would (its first statement did not execute).
  const line=node=>file.getLineAndCharacterOfPosition(node.getStart(file)).line;
  const ran=body=>!body||!ts.isBlock(body)||!body.statements.length||executed.has(line(body.statements[0]));
  const visit=(node,live)=>{
   if(ts.isFunctionLike(node)&&node.body){ts.forEachChild(node,child=>visit(child,live&&ran(node.body)));return;}
   if(ts.isExpressionStatement(node)){
    const at=line(node);
    if(live&&at===file.getLineAndCharacterOfPosition(node.end).line&&!executed.has(at)&&rows[at].trim()===node.getText(file)){rows[at]=rows[at].replace(/^(\s*)/,'$1// ');changed=true;}
    return;
   }
   ts.forEachChild(node,child=>visit(child,live));
  };
  visit(file,true);
  if(!changed)return withoutDead;
  try{
   const environment=model.authoring?.evidence?.environment??{};
   const variant=generateCodeLineExercise({source:rows.join('\n'),language:fixture.language,...environment.importEmit?{importEmit:environment.importEmit}:{},...environment.inputs?{inputs:environment.inputs}:{},...environment.keyOrder?{keyOrder:environment.keyOrder}:{},...environment.classFields==='define'?{classFields:'define'}:{}},ts),built=compileCodeLineExercise(variant);
   if(!built.status)withoutDead={variant,compiled:built.compiled,bySource:new Map(variant.lines.map(line=>[line.sourceLine,line]))};
  }catch{}
  return withoutDead;
 };
 const deadCaused=order=>{
  const free=deadFree();if(!free)return false;
  const lines=order.map(id=>free.bySource.get(lineById.get(id)?.sourceLine)?.code);
  if(lines.some(line=>line===undefined)||free.variant.lines.length!==model.lines.length)return false;
  return validateSubmission(free.compiled,{exerciseId:free.variant.id,revision:free.variant.revision,lines},{maxStates}).status==='accepted';
 };
 // ADR-067: one oracle per (literal, value), built on first use; null when the variant's own
 // reference fails (a throw, a timeout or a parse error), which then proves nothing.
 const source=Array.isArray(fixture.source)?fixture.source:fixture.source.split('\n'),literals=variants?literalsOf(source,fixture.language):[],oracles=new Map();
 const variantJudge=(literal,value)=>{
  const key=literals.indexOf(literal)+':'+typeof value+':'+String(value);
  if(!oracles.has(key)){let judged=null;try{judged=createOracle({...fixture,id:fixture.id+'~'+key,source:replaced(source,literal,value)},{policy});}catch{}oracles.set(key,judged);}
  return oracles.get(key);
 };
 const valueDependent=(order,pairs)=>{
  // The broken constraints' own rows first (that write or comparison with another value), then the
  // rows of the blocks they open or close (the branch or case that decides whether the code runs,
  // ADR-070: a `}` stands for its whole statement), then every other literal of the program.
  const ids=new Set(pairs.flat()),rows=new Set([...ids].map(id=>row.get(id))),inner=new Set();
  for(const block of model.blocks)if(ids.has(block.openLineId)||ids.has(block.closeLineId))for(let at=row.get(block.openLineId);at<=row.get(block.closeLineId);at++)inner.add(at);
  const tier=literal=>rows.has(literal.row)?0:inner.has(literal.row)?1:2;let budget=variants;
  const ranked=[...literals].sort((a,b)=>tier(a)-tier(b));
  for(const literal of ranked)for(const value of valuesFor(literal,literals)){
   if(budget--<=0)return false;
   const judged=variantJudge(literal,value);if(!judged)continue;
   const rowsOf=replaced(source,literal,value);
   if(judged(order.map(id=>rowsOf[row.get(id)])).ok===false)return {row:literal.row+1,literal:literal.value,value};
  }
  return null;
 };
 /** Why an equivalent rejected order keeps the reference's intent ({reason, witness?}), or null for a gap. */
 const intent=order=>{
  const pairs=broken(order);if(deadCode(pairs)||pairs.length&&deadCaused(order))return {reason:'dead-code'};
  if(pairs.length&&pairs.every(([before,after])=>(reasons.get(before+'>'+after)??[]).some(code=>POLICY_INTENT.has(code))))return {reason:'policy'};
  if(pairs.length&&pairs.every(([before,after])=>(reasons.get(before+'>'+after)??[]).some(code=>TYPE_INTENT.has(code))))return {reason:'type'};
  const witness=pairs.length?valueDependent(order,pairs):null;
  return witness?{reason:'value',witness}:null;
 };
 return {
  /** Whether the reference itself ended in a caught exception (the fixture's own probe convention). */
  referenceThrew:fixture.threw?.(judge.referenceValue)??false,
  policyVersion:model.authoring?.dependencyPolicy??'unknown',
  classify(order){
   const lines=codesOf(model,order),report=validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines},{maxStates});
   if(report.status==='indeterminate')return {kind:'indeterminate',states:report.exploredStates};
   const verdict=judge(lines);
   if(report.status==='accepted')return {kind:verdict.ok===false?'unsound':verdict.ok===null?'undecided-accepted':'accepted',reason:verdict.reason,states:report.exploredStates};
   const why=verdict.ok===true?intent(order):null;
   const kind=verdict.ok===true?(why?'intent':'gap'):verdict.ok===null?'undecided':'justified';
   return {kind,reason:why?.reason??verdict.reason,...(why?.witness?{witness:why.witness}:{}),states:report.exploredStates,causes:causes(order)};
  }
 };
}

const KINDS=['accepted','unsound','undecided-accepted','gap','intent','justified','undecided','indeterminate'];
/** Counts classifications per group and ranks the causes of the gaps. The gap rate is the share
 * of rejected orders among the equivalent ones: gaps / (accepted + gaps). The equivalent
 * rejection rate also counts the intent-keeping rejections, (gaps + intent) / (accepted + gaps +
 * intent): pinned beside the gap rate, a stricter generator cannot hide as intent (ADR-067). */
export function createTally(){
 const groups=new Map();
 return {
  /** One classified order of program `program` in `group` (e.g. kind, language, policy, throws). */
  add(group,program,result){
   const key=JSON.stringify(group);
   const row=groups.get(key)??{...group,programs:new Set(),orders:0,...Object.fromEntries(KINDS.map(kind=>[kind,0])),intentBy:{},gapCauses:{}};
   groups.set(key,row);
   row.programs.add(program);row.orders++;row[result.kind]++;
   if(result.kind==='intent')row.intentBy[result.reason]=(row.intentBy[result.reason]??0)+1;
   if(result.kind==='gap')for(const code of result.causes)row.gapCauses[code]=(row.gapCauses[code]??0)+1;
  },
  rows(){
   return [...groups.values()].map(({programs,gapCauses,...row})=>({...row,programs:programs.size,gapRate:row.accepted+row.gap?+(row.gap/(row.accepted+row.gap)).toFixed(4):0,
    equivalentRejectionRate:row.accepted+row.gap+row.intent?+((row.gap+row.intent)/(row.accepted+row.gap+row.intent)).toFixed(4):0,
    gapCauses:Object.fromEntries(Object.entries(gapCauses).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])))}));
  }
 };
}
