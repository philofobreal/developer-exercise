/** ADR-010 reproductions: reflectable property order of classes and of the
 * script global object. Each case builds the CodeLine model, grades the
 * reordering with the real structural validator and compares reference and
 * reordering with an observation written independently of the generator and
 * of the oracle (vm execution of FIXED fixtures only). TypeScript cases keep
 * parser diagnostics, full type checking and emitted behaviour apart. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Script,createContext} from 'node:vm';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {corpus} from './fixtures/ordering-corpus.mjs';
import {createOracle,codesOf,random} from './support/semantic-oracle.mjs';

const generate=fixture=>generateCodeLineExercise({source:fixture.source.join('\n'),language:fixture.language},ts);
function grader(model){const result=compileCodeLineExercise(model);assert.ok(!result.status,result.message);return order=>validateSubmission(result.compiled,{exerciseId:model.id,revision:model.revision,lines:codesOf(model,order)},{maxStates:200_000}).status;}
/** Evaluates `expression` after the code; TS is emitted with the given class-field mode. */
function observe(code,language,expression,define=true){
 const js=language==='typescript'?ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,useDefineForClassFields:define}}).outputText:code;
 const context=createContext({trace:[]});
 new Script('"use strict";\nfunction record(...args) { trace.push(args); }\n'+js+`\n;var __observed=JSON.stringify(${expression});`).runInContext(context,{timeout:2000});
 return JSON.parse(context.__observed);
}
/** Parser diagnostics, full strict type check against the ES2022 lib, nothing emitted. */
function typeCheck(code){
 const options={strict:true,noEmit:true,target:ts.ScriptTarget.ES2022,lib:['lib.es2022.d.ts'],types:[]},host=ts.createCompilerHost(options),read=host.getSourceFile;
 host.getSourceFile=(name,version,...rest)=>name==='fixture.ts'?ts.createSourceFile(name,code,version,true,ts.ScriptKind.TS):read.call(host,name,version,...rest);
 const fileExists=host.fileExists;host.fileExists=name=>name==='fixture.ts'||fileExists.call(host,name);
 const program=ts.createProgram(['fixture.ts'],options,host),file=program.getSourceFile('fixture.ts');
 return {parser:file.parseDiagnostics.length,semantic:program.getSemanticDiagnostics(file).map(d=>'TS'+d.code)};
}
const range=(from,to)=>Array.from({length:to-from+1},(_,i)=>from+i);

test('JS reproduction: swapping two method definitions keeps every call result but changes Object.getOwnPropertyNames(prototype)',()=>{
 const fixture=corpus.get('refl-explicit-property-names'),model=generate(fixture),grade=grader(model);
 const reference=range(1,model.lines.length),swapped=[1,5,6,7,2,3,4,...range(8,model.lines.length)];
 const before=codesOf(model,reference).join('\n'),after=codesOf(model,swapped).join('\n');
 // The reordering is syntactically valid and every direct call agrees …
 assert.deepEqual(observe(after,'javascript','[new Example().first(), new Example().second()]'),observe(before,'javascript','[new Example().first(), new Example().second()]'));
 // … but the prototype's own property order differs.
 assert.deepEqual(observe(before,'javascript','Object.getOwnPropertyNames(Example.prototype)'),['constructor','first','second']);
 assert.deepEqual(observe(after,'javascript','Object.getOwnPropertyNames(Example.prototype)'),['constructor','second','first']);
 assert.equal(grade(reference),'accepted');
 assert.equal(grade(swapped),'rejected','the structural validator must reject the reflected reordering');
 // The call-only policy (pre-ADR-010) sees equivalence when no probe reflects; the reflective one does not.
 const callsOnly={...fixture,probe:'[new Example().first(), new Example().second()]'};
 assert.deepEqual(createOracle(callsOnly,{policy:'call-only'})(codesOf(model,swapped)),{ok:true,reason:'equivalent'});
 assert.deepEqual(createOracle(callsOnly)(codesOf(model,swapped)),{ok:false,reason:'reflection'});
});

test('TS reproduction: parser, full type check and both emit modes; only the reflected order differs',()=>{
 const source=['class Example {','  first(): number {','    return 1;','  }','  second(): number {','    return 2;','  }','}','function evaluate(): Array<number | string[]> {','  const example = new Example();','  return [example.first(), example.second()];','}'];
 const fixture={id:'refl-ts-minimal',language:'typescript',source},model=generate(fixture),grade=grader(model);
 const reference=range(1,12),swapped=[1,5,6,7,2,3,4,...range(8,12)];
 const before=codesOf(model,reference).join('\n'),after=codesOf(model,swapped).join('\n');
 for(const code of [before,after])assert.deepEqual(typeCheck(code),{parser:0,semantic:[]});
 for(const define of [false,true]){
  assert.deepEqual(observe(after,'typescript','evaluate()',define),observe(before,'typescript','evaluate()',define));
  assert.deepEqual(observe(before,'typescript','Reflect.ownKeys(Example.prototype)',define),['constructor','first','second']);
  assert.deepEqual(observe(after,'typescript','Reflect.ownKeys(Example.prototype)',define),['constructor','second','first']);
 }
 assert.equal(grade(reference),'accepted');assert.equal(grade(swapped),'rejected');
});

test('script globals: function and var order is reflected by Object.keys(globalThis); const is not',()=>{
 const fixture=corpus.get('refl-script-globals'),model=generate(fixture),grade=grader(model);
 const keys="Object.keys(globalThis).filter(k => ['alpha', 'beta', 'one', 'two', 'local'].includes(k))";
 const reference=range(1,12);
 assert.deepEqual(observe(fixture.source.join('\n'),'javascript',keys),['alpha','beta','one','two']);
 const functionsSwapped=[4,5,6,1,2,3,...range(7,12)],varsSwapped=[1,2,3,4,5,6,8,7,...range(9,12)],constMoved=[9,...range(1,8),...range(10,12)];
 assert.deepEqual(observe(codesOf(model,functionsSwapped).join('\n'),'javascript',keys),['beta','alpha','one','two']);
 assert.deepEqual(observe(codesOf(model,varsSwapped).join('\n'),'javascript',keys),['alpha','beta','two','one']);
 assert.equal(grade(functionsSwapped),'rejected');assert.equal(grade(varsSwapped),'rejected');
 // A script-level const is a global lexical binding, not a global-object property.
 assert.deepEqual(observe(codesOf(model,constMoved).join('\n'),'javascript',keys),['alpha','beta','one','two']);
 assert.equal(grade(constMoved),'accepted');
});

/** Member blocks of every class, from an AST walk independent of the generator (rows are 1-based IDs here). */
function memberBlocks(fixture){
 const file=ts.createSourceFile('x.ts',fixture.source.join('\n'),ts.ScriptTarget.Latest,true,fixture.language==='typescript'?ts.ScriptKind.TS:ts.ScriptKind.JS),line=pos=>file.getLineAndCharacterOfPosition(pos).line+1,classes=[];
 const visit=node=>{if(ts.isClassLike(node))classes.push({open:line(node.getStart(file)),close:line(node.end-1),members:node.members.map(m=>range(line(m.getStart(file)),line(m.end-1)))});ts.forEachChild(node,visit);};
 visit(file);return classes;
}
const permutations=items=>items.length<2?[items]:items.flatMap((value,i)=>permutations(items.filter((_,j)=>i!==j)).map(rest=>[value,...rest]));
for(const [id,exact] of [['refl-prototype-and-static-methods',true],['refl-index-private-accessor-duplicate',false],['refl-ts-erased-and-overloads',true],['class-accounts-ts',false],['class-inventory-ts',true]])test('member-block permutations are sound under the reflective oracle: '+id,t=>{
 const fixture=corpus.get(id),model=generate(fixture),grade=grader(model),judge=createOracle(fixture),rng=random(id.length*7919);
 let accepted=0,equivalent=0,checked=0;
 for(const block of memberBlocks(fixture)){
  const all=block.members.length<=6?permutations(block.members):Array.from({length:300},()=>[...block.members].sort(()=>rng()-0.5));
  for(const members of all){
   const order=[...range(1,block.open),...members.flat(),...range(block.close,model.lines.length)];
   const status=grade(order),verdict=judge(codesOf(model,order));checked++;
   if(status==='accepted'){accepted++;assert.equal(verdict.ok,true,`SOUNDNESS ${id}: ${order} (${verdict.reason})`);}
   if(verdict.ok===true)equivalent++;
  }
 }
 if(exact)assert.equal(accepted,equivalent,'every reflectively equivalent member order is accepted');
 t.diagnostic(`${checked} member orders, ${accepted} accepted, ${equivalent} equivalent under the reflective policy`);
});
