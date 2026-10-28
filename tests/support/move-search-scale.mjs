/** ADR-030 manual measurement (not a test): diagnosis time by size for 60 random single moves and
 * for arrangements no single move repairs (the allowance-bound worst case).
 *   node tests/support/move-search-scale.mjs 13 31 64 123   (4k + 7 rows; MOVE_STATES overrides the allowance) */
import ts from 'typescript';
import {generateCodeLineExercise} from '../../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission,diagnoseSubmission} from '../../dist/index.js';
import {program} from './move-search-programs.mjs';
const rng=(()=>{let a=12345;return ()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};})();
const pct=(xs,p)=>{const s=[...xs].sort((a,b)=>a-b);return s.length?Math.round(s[Math.min(s.length-1,Math.floor(p*s.length))]):0;};
for(const k of process.argv.slice(2).map(Number)){
 const model=generateCodeLineExercise({source:program(k),language:'typescript'},ts),{compiled}=compileCodeLineExercise(model),ref=model.lines.map(l=>l.code),n=ref.length;
 const mv=(lines)=>{const out=[...lines],from=Math.floor(rng()*n),to=Math.floor(rng()*n),[x]=out.splice(from,1);out.splice(to,0,x);return out;};
 const typical=[],unexplained=[],worst=[],twoErrors=[];let found=0,tries=0,twoFound=0;
 while(typical.length<60&&tries++<5000){const lines=mv(ref),sub={exerciseId:model.id,revision:model.revision,lines};if(validateSubmission(compiled,sub).accepted)continue;const s=performance.now(),r=diagnoseSubmission(compiled,sub,process.env.MOVE_STATES?{moveSearchStates:Number(process.env.MOVE_STATES)}:{}),ms=performance.now()-s;typical.push(ms);if(!r.explained){unexplained.push(ms);if(r.diagnostics.some(d=>d.code==='single-move-repair'))found++;}}
 // ADR-033: two random moves; how often an unexplained one gets a verified one- or two-move repair.
 tries=0;while(twoErrors.length<30&&tries++<5000){const lines=mv(mv(ref)),sub={exerciseId:model.id,revision:model.revision,lines};if(validateSubmission(compiled,sub).accepted)continue;const s=performance.now(),r=diagnoseSubmission(compiled,sub,process.env.MOVE_STATES?{moveSearchStates:Number(process.env.MOVE_STATES)}:{}),ms=performance.now()-s;if(r.explained)continue;twoErrors.push(ms);if(r.diagnostics.some(d=>d.code.endsWith('move-repair')))twoFound++;}
 tries=0;while(worst.length<5&&tries++<3000){const lines=mv(mv(ref)),sub={exerciseId:model.id,revision:model.revision,lines};if(validateSubmission(compiled,sub).accepted)continue;const s=performance.now(),r=diagnoseSubmission(compiled,sub,process.env.MOVE_STATES?{moveSearchStates:Number(process.env.MOVE_STATES)}:{}),ms=performance.now()-s;if(!r.explained&&!r.diagnostics.some(d=>d.code.endsWith('move-repair')))worst.push(ms);}
 console.log(JSON.stringify({rows:n,sample:typical.length,typicalAvg:Math.round(typical.reduce((a,b)=>a+b,0)/typical.length),typicalP95:pct(typical,.95),unexplained:unexplained.length,withMove:found,unexplainedP95:pct(unexplained,.95),unexplainedMax:pct(unexplained,1),twoErrorUnexplained:twoErrors.length,twoErrorRepaired:twoFound,twoErrorP95:pct(twoErrors,.95),worstNoMoveCases:worst.length,worstNoMoveMax:pct(worst,1)}));
}
