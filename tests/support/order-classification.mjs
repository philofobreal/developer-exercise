/** How one generated model treats one arrangement, judged by the policy oracle (author
 * tooling; execution happens only on fixed fixtures). The one place that knows the
 * classification, why a rejection happened and whether the reference threw:
 *  - `unsound`: accepted, but the oracle sees a different behaviour;
 *  - `accepted`: accepted and equivalent (or undecided by the oracle: `undecided-accepted`);
 *  - `gap`: rejected although the oracle sees the same behaviour (incompleteness);
 *  - `justified`: rejected, and the behaviour differs;
 *  - `undecided`: rejected, oracle undecided; `indeterminate`: the validator's budget ran out.
 * A rejection's `causes` are the provenance codes of the direct constraints the order breaks,
 * or `scope` when it breaks none and only the lexical structure rejects it. */
import {compileCodeLineExercise,validateSubmission} from '../../dist/index.js';
import {createOracle,codesOf} from './semantic-oracle.mjs';

export function createClassifier(fixture,model,{maxStates=200_000,policy='reflective'}={}){
 const compiled=compileCodeLineExercise(model);
 if(compiled.status)throw Error(fixture.id+': '+compiled.message);
 const judge=createOracle(fixture,{policy});
 const reasons=new Map();
 for(const entry of model.authoring?.provenance??[]){const key=entry.before+'>'+entry.after;reasons.set(key,[...reasons.get(key)??[],entry.code]);}
 const constraints=[...model.lines.flatMap(line=>line.dependencies.map(before=>[before,line.id])),...(model.edges??[]).map(edge=>[edge.before,edge.after])];
 function causes(order){
  const at=new Map(order.map((id,i)=>[id,i])),found=new Set();
  for(const [before,after] of constraints)if(at.get(before)>at.get(after))for(const code of reasons.get(before+'>'+after)??['unexplained'])found.add(code);
  return found.size?[...found].sort():['scope'];
 }
 return {
  /** Whether the reference itself ended in a caught exception (the fixture's own probe convention). */
  referenceThrew:fixture.threw?.(judge.referenceValue)??false,
  policyVersion:model.authoring?.dependencyPolicy??'unknown',
  classify(order){
   const lines=codesOf(model,order),report=validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines},{maxStates});
   if(report.status==='indeterminate')return {kind:'indeterminate',states:report.exploredStates};
   const verdict=judge(lines);
   if(report.status==='accepted')return {kind:verdict.ok===false?'unsound':verdict.ok===null?'undecided-accepted':'accepted',reason:verdict.reason,states:report.exploredStates};
   const kind=verdict.ok===true?'gap':verdict.ok===null?'undecided':'justified';
   return {kind,reason:verdict.reason,states:report.exploredStates,causes:causes(order)};
  }
 };
}

const KINDS=['accepted','unsound','undecided-accepted','gap','justified','undecided','indeterminate'];
/** Counts classifications per group and ranks the causes of the gaps. The gap rate is the share
 * of rejected orders among the equivalent ones: gaps / (accepted + gaps). */
export function createTally(){
 const groups=new Map();
 return {
  /** One classified order of program `program` in `group` (e.g. kind, language, policy, throws). */
  add(group,program,result){
   const key=JSON.stringify(group);
   const row=groups.get(key)??{...group,programs:new Set(),orders:0,...Object.fromEntries(KINDS.map(kind=>[kind,0])),gapCauses:{}};
   groups.set(key,row);
   row.programs.add(program);row.orders++;row[result.kind]++;
   if(result.kind==='gap')for(const code of result.causes)row.gapCauses[code]=(row.gapCauses[code]??0)+1;
  },
  rows(){
   return [...groups.values()].map(({programs,gapCauses,...row})=>({...row,programs:programs.size,gapRate:row.accepted+row.gap?+(row.gap/(row.accepted+row.gap)).toFixed(4):0,
    gapCauses:Object.fromEntries(Object.entries(gapCauses).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])))}));
  }
 };
}
