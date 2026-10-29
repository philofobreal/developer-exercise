/** Manual: node tests/reason-code-evidence.mjs [--write]
 * Searches the catalogued programs for evidence of every registered reason code (ADR-038):
 * an arrangement rejected for this code alone whose behaviour differs (`justified`); for a
 * conservative code also one the oracle finds equivalent (`gap`, a documented over-strictness)
 * or, failing both, a model that emits it (`occurrence`). Prints what is missing.
 * --write pins tests/fixtures/reason-code-evidence.json, which reason-codes.test.mjs re-verifies;
 * review the diff. Execution happens only on the fixed and seeded programs. */
import {writeFile} from 'node:fs/promises';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {REASON_CODES} from '../dist/author/reason-codes.js';
import {neighbourhood,random} from './support/semantic-oracle.mjs';
import {createClassifier} from './support/order-classification.mjs';
import {catalog} from './support/fixture-catalog.mjs';
import {reasonCodeWaivers} from './fixtures/reason-code-programs.mjs';

const wanted=new Map(REASON_CODES.filter(entry=>entry.category!=='unknown').map(entry=>[entry.code,entry]));
// The syntax-kind family is evidenced by its most common member.
wanted.set('ExpressionStatement',{code:'ExpressionStatement',category:'effect'});
const evidence={};
const strength={justified:3,gap:2,occurrence:1};
for(const fixture of catalog()){
 if([...wanted.keys()].every(code=>evidence[code]?.kind==='justified'||wanted.get(code).category==='conservative'&&evidence[code]))break;
 let model;try{model=generateCodeLineExercise({source:fixture.source.join('\n'),language:fixture.language},ts);}catch{continue;}
 const emitted=new Set((model.authoring?.provenance??[]).map(entry=>entry.code));
 for(const code of emitted)if(wanted.has(code)&&!evidence[code])evidence[code]={kind:'occurrence',fixture:fixture.id};
 if(![...emitted].some(code=>wanted.has(code)&&(evidence[code]?.kind??'occurrence')!=='justified'))continue;
 let classifier;try{classifier=createClassifier(fixture,model);}catch{continue;}
 const rng=random(fixture.id.length),reference=model.lines.map(line=>line.id);
 let orders=neighbourhood(reference);if(orders.length>300)orders=Array.from({length:300},()=>orders[Math.floor(rng()*orders.length)]);
 for(const order of orders){
  const result=classifier.classify(order);
  if(!['justified','gap'].includes(result.kind)||result.causes.length!==1)continue;
  const [code]=result.causes;if(!wanted.has(code))continue;
  if(result.kind==='gap'&&wanted.get(code).category!=='conservative'&&evidence[code])continue;
  if((strength[evidence[code]?.kind]??0)<strength[result.kind])evidence[code]={kind:result.kind,fixture:fixture.id,order};
 }
}
for(const [code,why] of Object.entries(reasonCodeWaivers))if(evidence[code]?.kind!=='justified')evidence[code]={kind:'waived',why};
const missing=[...wanted.keys()].filter(code=>!evidence[code]);
const weak=[...wanted.keys()].filter(code=>evidence[code]&&wanted.get(code).category!=='conservative'&&evidence[code].kind!=='justified');
console.log(JSON.stringify(Object.fromEntries(Object.entries(evidence).map(([code,{kind,fixture,why}])=>[code,kind+' '+(fixture??why)])),null,1));
console.log('missing:',missing.join(', ')||'none');
console.log('without behavioural evidence:',weak.join(', ')||'none');
if(process.argv.includes('--write'))await writeFile(new URL('./fixtures/reason-code-evidence.json',import.meta.url),JSON.stringify(Object.fromEntries(Object.entries(evidence).sort(([a],[b])=>a.localeCompare(b))),null,1)+'\n');
