/** Generator-vs-oracle measurements on fixed corpus fixtures (author tooling). */
import ts from 'typescript';
import {performance} from 'node:perf_hooks';
import {generateCodeLineExercise} from '../../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../../dist/index.js';
import {createOracle,codesOf,neighbourhood,extensions,random,shrink} from './semantic-oracle.mjs';

const EXHAUSTIVE_LIMIT=5000,SAMPLES=300;
export function generate(fixture){return generateCodeLineExercise({source:fixture.source.join('\n'),language:fixture.language},ts);}
function edgeStats(model){
 const deps=new Map(model.lines.map(line=>[line.id,new Set(line.dependencies)]));
 for(const edge of model.edges??[])deps.get(edge.after).add(edge.before);
 const reach=new Map();
 const ancestors=id=>{if(reach.has(id))return reach.get(id);const all=new Set();for(const dep of deps.get(id))for(const x of [dep,...ancestors(dep)])all.add(x);reach.set(id,all);return all;};
 let total=0,redundant=0;
 for(const [id,set] of deps)for(const dep of set){total++;if([...set].some(other=>other!==dep&&ancestors(other).has(dep)))redundant++;}
 return {edges:total,redundant};
}
/** Classifies the generated model of one fixture against the policy oracle. */
export function measureFixture(fixture,{model=generate(fixture)}={}){
 const started=performance.now();for(let i=0;i<3;i++)generate(fixture);const generationMs=(performance.now()-started)/3;
 const compiled=compileCodeLineExercise(model);if(compiled.status)throw Error(fixture.id+': '+compiled.message);
 const judge=createOracle(fixture),reference=model.lines.map(line=>line.id);
 const grade=order=>validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:codesOf(model,order)},{maxStates:200_000});
 const result={id:fixture.id,origin:fixture.origin,language:fixture.language,rows:model.lines.length,...edgeStats(model),generationMs:+generationMs.toFixed(2),
  orders:0,ordersExhaustive:true,unsound:0,undecidedAccepted:0,neighbours:0,accepted:0,completenessGaps:0,justifiedRejections:0,undecided:0,indeterminate:0,states:0,counterexamples:[],gaps:[]};
 // A(M): exhaustive when small, otherwise a seeded random sample of linear extensions.
 let orders=extensions(model,{limit:EXHAUSTIVE_LIMIT+1});
 if(orders.length>EXHAUSTIVE_LIMIT){result.ordersExhaustive=false;const rng=random(0xC0DE);orders=Array.from({length:SAMPLES},()=>extensions(model,{limit:1,rng})[0]);}
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
