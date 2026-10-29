/** The generative campaign as a reusable measurement (plan phase 3): seeded random programs
 * per kind and language, each arrangement classified by order-classification.mjs and counted
 * per kind × language × policy version × whether the reference threw. The long manual run
 * (ordering-campaign.mjs) and the pinned quick check (generative-metrics.test.mjs) share it. */
import ts from 'typescript';
import {generateCodeLineExercise} from '../../src/author/generator.mjs';
import {neighbourhood,extensions,blockMoves,random,shrink} from './semantic-oracle.mjs';
import {createClassifier,createTally} from './order-classification.mjs';
import {PROGRAM_KINDS,LANGUAGES} from './fixture-catalog.mjs';

/** The pinned quick configuration of generative-metrics.test.mjs and `--baseline`. */
export const QUICK={from:1,to:3,samples:6,neighbours:40};

/** Classifies sampled linear extensions, the single-row neighbourhood and every whole-unit block
 * move of each program (or a seeded sample of `neighbours` of each), each distinct submission
 * once. `onUnsound` receives a minimised order. */
export function measureCampaign({from=1,to=200,kinds=Object.keys(PROGRAM_KINDS),languages=LANGUAGES,samples=25,neighbours=Infinity,onUnsound=()=>{}}={}){
 const tally=createTally();let violations=0;
 for(const kind of kinds)for(const language of languages)for(let seed=from;seed<=to;seed++){
  const fixture=PROGRAM_KINDS[kind](seed,{language});if(!fixture)continue;
  const model=generateCodeLineExercise({source:fixture.source.join('\n'),language},ts),classifier=createClassifier(fixture,model);
  const group={kind,language,policy:classifier.policyVersion,throws:classifier.referenceThrew};
  const rng=random(seed*7919),reference=model.lines.map(line=>line.id),seen=new Set();
  const sample=orders=>orders.length>neighbours?Array.from({length:neighbours},()=>orders[Math.floor(rng()*orders.length)]):orders;
  for(const order of [...Array.from({length:samples},()=>extensions(model,{limit:1,rng})[0]),...sample(neighbourhood(reference)),...sample(blockMoves(model))]){
   const key=order.map(id=>model.lines.find(line=>line.id===id).code).join('\n');
   if(seen.has(key))continue;seen.add(key);
   const result=classifier.classify(order);
   tally.add(group,fixture.id,result);
   if(result.kind==='unsound'){violations++;onUnsound({id:fixture.id,reason:result.reason,source:fixture.source,minimal:shrink(reference,order,candidate=>classifier.classify(candidate).kind==='unsound')});}
  }
 }
 return {rows:tally.rows(),violations};
}
