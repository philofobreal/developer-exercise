/** Generator-vs-oracle measurements on fixed corpus fixtures (author tooling). */
import ts from 'typescript';
import {performance} from 'node:perf_hooks';
import {generateCodeLineExercise} from '../../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../../dist/index.js';
import {statementOrdering} from '../../dist/author/statement-ordering.js';
import {createOracle,codesOf,neighbourhood,extensions,random,shrink} from './semantic-oracle.mjs';

/** Bounded settings used by semantic-corpus.test.mjs and its pinned baseline. */
export const CORPUS_CAPS={exhaustiveLimit:200,samples:100,repeats:0};
/** Cap-independent numbers pinned per fixture. */
export const pinned=row=>({neighbours:row.neighbours,accepted:row.accepted,completenessGaps:row.completenessGaps,justifiedRejections:row.justifiedRejections});
export function generate(fixture){return generateCodeLineExercise({source:fixture.source.join('\n'),language:fixture.language},ts);}
/** True when the statement analysis declines the whole reference (with, direct eval). */
function analysisDisabled(fixture){
 const typescript=fixture.language==='typescript',file=ts.createSourceFile('reference.'+(typescript?'ts':'js'),fixture.source.join('\n'),ts.ScriptTarget.Latest,true,typescript?ts.ScriptKind.TS:ts.ScriptKind.JS);
 return statementOrdering(file,ts).units.length===0;
}
export function edgeStats(model){
 const deps=new Map(model.lines.map(line=>[line.id,new Set(line.dependencies)]));
 for(const edge of model.edges??[])deps.get(edge.after).add(edge.before);
 const reach=new Map();
 const ancestors=id=>{if(reach.has(id))return reach.get(id);const all=new Set();for(const dep of deps.get(id))for(const x of [dep,...ancestors(dep)])all.add(x);reach.set(id,all);return all;};
 let total=0,redundant=0;
 for(const [id,set] of deps)for(const dep of set){total++;if([...set].some(other=>other!==dep&&ancestors(other).has(dep)))redundant++;}
 return {edges:total,redundant};
}
/** Classifies the generated model of one fixture against the policy oracle. */
export function measureFixture(fixture,{model=generate(fixture),exhaustiveLimit=10000,samples=300,repeats=3}={}){
 const started=performance.now();for(let i=0;i<repeats;i++)generate(fixture);const generationMs=repeats?(performance.now()-started)/repeats:0;
 const compiled=compileCodeLineExercise(model);if(compiled.status)throw Error(fixture.id+': '+compiled.message);
 const judge=createOracle(fixture),reference=model.lines.map(line=>line.id);
 const grade=order=>validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:codesOf(model,order)},{maxStates:200_000});
 const result={id:fixture.id,origin:fixture.origin,language:fixture.language,rows:model.lines.length,unsupported:analysisDisabled(fixture),...edgeStats(model),generationMs:+generationMs.toFixed(2),
  orders:0,ordersExhaustive:true,unsound:0,undecidedAccepted:0,neighbours:0,accepted:0,completenessGaps:0,justifiedRejections:0,undecided:0,indeterminate:0,states:0,counterexamples:[],gaps:[]};
 // A(M): exhaustive when small, otherwise a seeded random sample of linear extensions.
 let orders=extensions(model,{limit:exhaustiveLimit+1});
 if(orders.length>exhaustiveLimit){result.ordersExhaustive=false;const rng=random(0xC0DE);orders=Array.from({length:samples},()=>extensions(model,{limit:1,rng})[0]);}
 result.orders=orders.length;
 const unsound=order=>{const report=grade(order);return report.status==='accepted'&&judge(codesOf(model,order)).ok===false;};
 for(const order of orders){
  const report=grade(order);result.states+=report.exploredStates;
  if(report.status!=='accepted')throw Error(`${fixture.id}: validator rejects a linear extension ${order}`);
  const verdict=judge(codesOf(model,order));
  if(verdict.ok===false){result.unsound++;if(result.counterexamples.length<3)result.counterexamples.push({order:shrink(reference,order,unsound),reason:verdict.reason});}
  else if(verdict.ok===null)result.undecidedAccepted++;
 }
 // Local completeness: every single-row move and pair swap.
 const seen=new Set();
 for(const order of neighbourhood(reference)){
  const key=codesOf(model,order).join('\n');if(seen.has(key))continue;seen.add(key);result.neighbours++;
  const report=grade(order),verdict=judge(codesOf(model,order));
  if(report.status==='indeterminate'){result.indeterminate++;continue;}
  if(report.status==='accepted'){result.accepted++;if(verdict.ok===false){result.unsound++;if(result.counterexamples.length<3)result.counterexamples.push({order:shrink(reference,order,unsound),reason:verdict.reason});}}
  else if(verdict.ok===true){result.completenessGaps++;if(result.gaps.length<5)result.gaps.push(order);}
  else if(verdict.ok===null)result.undecided++;
  else result.justifiedRejections++;
 }
 return result;
}

/** Synthetic large references for the processing-time measurement; they are
 * generated and validated in reference order, never executed. Shapes cover a
 * flat pure list, blocks with barriers and hoisted helpers, class members and
 * multi-row continued statements. Every shape stays within the 500-row limit. */
export function largeReferences(rows=500){
 const fill=(head,group,tail)=>{const lines=[...head];for(let i=0;lines.length+group(i).length+tail.length<=rows;i++)lines.push(...group(i));return [...lines,...tail];};
 return {
  'flat-pure':fill(['function large() {'],i=>[`  const value${i} = ${i};`],['}']),
  'blocks-and-helpers':fill(['function large() {'],i=>[`  const a${i} = ${i};`,`  if (a${i} > 1) {`,`    record(a${i});`,'  }',`  function h${i}() { return ${i}; }`],['}']),
  'class-members':fill(['class Large {'],i=>[`  f${i} = ${i};`,`  m${i}() { return this.f${i}; }`],['}']),
  'continued-calls':fill(['function large() {'],i=>['  record(',`    ${i},`,'  );',`  function h${i}() { return ${i}; }`],['}']),
 };
}
/** Generation time (median of `repeats`), edge counts and reference-order validation cost. */
export function measureLarge(name,source,{repeats=5}={}){
 const fixture={id:name,language:'javascript',source},times=[];let model;
 for(let i=0;i<repeats;i++){const started=performance.now();model=generate(fixture);times.push(performance.now()-started);}
 const compiled=compileCodeLineExercise(model);if(compiled.status)throw Error(name+': '+compiled.message);
 const started=performance.now(),report=validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:model.lines.map(line=>line.code)},{maxStates:200_000});
 const validationMs=performance.now()-started;
 if(report.status!=='accepted')throw Error(name+': reference order '+report.status);
 return {shape:name,rows:model.lines.length,...edgeStats(model),generationMs:+times.sort((a,b)=>a-b)[Math.floor(times.length/2)].toFixed(1),referenceStates:report.exploredStates,validationMs:+validationMs.toFixed(1)};
}
