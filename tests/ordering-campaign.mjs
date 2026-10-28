/** Manual long generative campaign (not part of check:all):
 *   node tests/ordering-campaign.mjs [--from=1] [--to=200] [--kinds=class,script,function,object]
 *        [--languages=javascript,typescript] [--output=campaign.json]
 * For every seeded program it grades sampled linear extensions, the single-row
 * neighbourhood and every whole-unit block move with the structural validator and
 * classifies them with the reflective oracle. Runtime comparison happens ONLY on
 * these fixed, always-terminating generated programs; learners are never involved.
 * A soundness violation is printed at once, minimised and with its source, so a
 * long run never loses it to output buffering. Exit code 1 if any was found. */
import {writeFile} from 'node:fs/promises';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {createOracle,codesOf,neighbourhood,extensions,blockMoves,random,shrink} from './support/semantic-oracle.mjs';
import {randomProgram,randomClassProgram,randomScriptProgram,randomObjectProgram} from './support/random-programs.mjs';

const option=(name,fallback)=>process.argv.find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const from=Number(option('from','1')),to=Number(option('to','200')),kinds=option('kinds','class,script,function,object').split(','),languages=option('languages','javascript,typescript').split(','),output=option('output',null);
const makers={class:randomClassProgram,script:randomScriptProgram,object:randomObjectProgram,function:(seed,{language})=>language==='javascript'?randomProgram(seed,{extended:seed%2===0}):null};
const rows=[];let violations=0;
for(const kind of kinds)for(const language of languages){
 const totals={kind,language,programs:0,orders:0,accepted:0,unsound:0,gaps:0,justified:0,undecided:0,indeterminate:0,blockMoves:0,ms:0};
 for(let seed=from;seed<=to;seed++){
  const fixture=makers[kind](seed,{language});if(!fixture)continue;
  const started=performance.now(),model=generateCodeLineExercise({source:fixture.source.join('\n'),language},ts),compiled=compileCodeLineExercise(model);
  if(compiled.status)throw Error(`${fixture.id}: ${compiled.message}`);
  const judge=createOracle(fixture),rng=random(seed*7919),reference=model.lines.map(line=>line.id);
  const grade=order=>validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:codesOf(model,order)},{maxStates:200_000}).status;
  const moves=blockMoves(model),orders=[...Array.from({length:25},()=>extensions(model,{limit:1,rng})[0]),...neighbourhood(reference),...moves],seen=new Set();
  totals.programs++;totals.blockMoves+=moves.length;
  for(const order of orders){
   const lines=codesOf(model,order),key=lines.join('\n');if(seen.has(key))continue;seen.add(key);totals.orders++;
   const status=grade(order),verdict=judge(lines);
   if(status==='indeterminate'){totals.indeterminate++;continue;}
   if(status==='accepted'){
    totals.accepted++;
    if(verdict.ok===false){
     totals.unsound++;violations++;
     const minimal=shrink(reference,order,candidate=>grade(candidate)==='accepted'&&judge(codesOf(model,candidate)).ok===false);
     console.log(`UNSOUND ${fixture.id} (${verdict.reason}) minimal order ${minimal.join(',')}\n${fixture.source.join('\n')}\n`);
    }else if(verdict.ok===null)totals.undecided++;
   }else if(verdict.ok===true)totals.gaps++;
   else if(verdict.ok===null)totals.undecided++;
   else totals.justified++;
  }
  totals.ms+=performance.now()-started;
 }
 totals.ms=Math.round(totals.ms);rows.push(totals);console.log(JSON.stringify(totals));
}
if(output)await writeFile(output,JSON.stringify({from,to,rows},null,1)+'\n');
process.exitCode=violations?1:0;
