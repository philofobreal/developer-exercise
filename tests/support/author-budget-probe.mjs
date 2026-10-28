/** Measures one author analysis in a fresh process (G1.4): wall time and peak heap growth.
 * Usage: node --expose-gc tests/support/author-budget-probe.mjs <case>; prints one JSON line. */
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {generateCodeLineExercise} from '../../src/author/generator.mjs';
import {getLanguageAdapter} from '../../src/author/languages.mjs';
const range=n=>Array.from({length:n},(_,i)=>i);
export const budgetCases={
 // The real 436-line service fixture, formatted as the author flow does.
 'service-436':()=>getLanguageAdapter('typescript').format(readFileSync(new URL('../fixtures/copy-field-utility.service.ts',import.meta.url),'utf8'),ts).code,
 // 498 statements in one function on shared local objects: the footprint analysis' worst shape.
 'objects-500':()=>['function f() {',' class Box { v = 0; set(x: number) { this.v = x; return this; } get() { return this.v; } }',...range(496).map(i=>i%4===0?` const b${i} = new Box();`:i%4===1?` b${i-1}.set(${i});`:i%4===2?` log(b${i-2}.get());`:` b${i-3}.v = b${i-3}.get() + ${i};`),'}'].join('\n'),
 // 498 independent declarations followed by uses: a wide, shallow dependency graph.
 'flat-500':()=>[...range(250).map(i=>`const v${i} = ${i};`),...range(250).map(i=>`log(v${i}, v${(i*7)%250});`)].join('\n')
};
if(process.argv[2]){
 const source=budgetCases[process.argv[2]]();global.gc?.();
 const base=process.memoryUsage().heapUsed;let peak=base;
 const timer=setInterval(()=>{peak=Math.max(peak,process.memoryUsage().heapUsed);},5);
 const start=performance.now(),model=generateCodeLineExercise({source,language:'typescript'},ts),ms=performance.now()-start;
 clearInterval(timer);peak=Math.max(peak,process.memoryUsage().heapUsed);
 console.log(JSON.stringify({lines:model.lines.length,ms:Math.round(ms),heapMiB:Math.round((peak-base)/2**20),rssMiB:Math.round(process.memoryUsage().rss/2**20)}));
}
