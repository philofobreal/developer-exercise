/** NY-49 (v58, ADR-150): TypeScript writes an exported member of a namespace onto the namespace object where the
 * declaration stands. An exported function used to be free to move like any hoisted function, so the model accepted
 * orders that change the creation order of the namespace's keys. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {generateCodeLineExercise,DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {compileCodeLineExercise,explainConstraints,validateSubmission} from '../dist/index.js';

const SOURCE=`namespace Timing {
  const base = 1;
  export const penalty = 2;
  export const bonus = 3;
  export function total(time: number, faults: number): number {
    return base * time + faults * penalty - bonus;
  }
  export interface Result {
    seconds: number;
  }
}
function evaluate(): number {
  return Timing.total(10, 1);
}`;
const generate=(source,options={})=>generateCodeLineExercise({source,language:'typescript',...options},ts);
/** Fixed test programs only: what a caller of the emitted script sees. */
const run=(lines,probe)=>JSON.stringify(vm.runInNewContext(ts.transpileModule(lines.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\n;'+probe));
const move=(lines,from,count,to)=>{const copy=[...lines],part=copy.splice(from-1,count);copy.splice(to-1,0,...part);return copy;};
const ordered=(model,before,after)=>explainConstraints({...model,id:'x'}).lines.find(line=>line.id===after).ancestors.includes(before);
const accepts=(model,lines)=>{const compiled=compileCodeLineExercise({...model,id:'x'});assert.ok(!('status' in compiled),compiled.message);return validateSubmission(compiled.compiled,{exerciseId:'x',revision:model.revision,lines}).status==='accepted';};

test('the defect: moving the exported function before an exported constant changes the namespace\'s key order',()=>{
 const lines=SOURCE.split('\n'),swapped=move(lines,5,3,3);
 assert.equal(swapped[2].trim().startsWith('export function total'),true);
 // The calls give the same result either way; only the creation order of the keys differs.
 assert.equal(run(lines,'evaluate()'),run(swapped,'evaluate()'));
 assert.equal(run(lines,'Object.keys(Timing)'),'["penalty","bonus","total"]');
 assert.equal(run(swapped,'Object.keys(Timing)'),'["total","penalty","bonus"]');
});

test('v58: the exported function keeps its place among the exported members; the model refuses the swap',()=>{
 assert.equal(DEPENDENCY_POLICY,'scoped-effect-analysis-v58');
 const model=generate(SOURCE),lines=SOURCE.split('\n');
 assert.equal(model.authoring.dependencyPolicy,'scoped-effect-analysis-v58');
 // Rows: 3 `export const penalty`, 4 `export const bonus`, 5 `export function total`.
 assert.ok(ordered(model,3,5)&&ordered(model,4,5),'both exported constants stay before the exported function');
 assert.ok(ordered(model,3,4));
 assert.equal(accepts(model,lines),true,'the reference');
 assert.equal(accepts(model,move(lines,5,3,3)),false,'the function before the constants');
 assert.equal(accepts(model,move(lines,5,3,4)),false,'the function between the constants');
 // The same with key order „Nem számít”: the emitted write may leave early, which keeps its place (ADR-019).
 const ignored=generate(SOURCE,{keyOrder:'ignored'});
 assert.equal(accepts(ignored,move(lines,5,3,3)),false);
 // A member that only declares a type adds no key and stays free.
 assert.equal(ordered(model,5,8)||ordered(model,8,5),false,'the interface is not ordered with the function');
 assert.equal(accepts(model,move(lines,8,3,2)),true,'the interface first');
 assert.equal(run(move(lines,8,3,2),'Object.keys(Timing)'),run(lines,'Object.keys(Timing)'));
});

test('what did not change: a function that is not exported, and a module\'s own exported function, are hoisted as before',()=>{
 const inner=`namespace Units {
  export const meter = 1;
  export const kilo = double(500);
  function double(value: number): number {
    return value * 2;
  }
}
function evaluate(): number[] {
  return [Units.meter, Units.kilo];
}`,model=generate(inner),lines=inner.split('\n');
 assert.equal(ordered(model,2,4)||ordered(model,4,2),false,'the private function is not ordered with the exported constant');
 assert.equal(accepts(model,move(lines,4,3,2)),true,'the private function first');
 assert.equal(run(move(lines,4,3,2),'[evaluate(),Object.keys(Units)]'),run(lines,'[evaluate(),Object.keys(Units)]'));
 const moduleFile=`export function first(): number {
  return 1;
}
export function second(): number {
  return first() + 1;
}`,moduleModel=generate(moduleFile);
 assert.equal(ordered(moduleModel,1,4)||ordered(moduleModel,4,1),false,'top-level exported functions of a module commute');
 // An exported function in an inner namespace is a member of that namespace.
 const nested=`namespace Outer {
  export namespace Inner {
    export const a = 1;
    export function b(): number {
      return a;
    }
  }
}`,nestedModel=generate(nested);
 assert.ok(ordered(nestedModel,3,4));
});
