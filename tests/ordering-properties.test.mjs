/** WP5 exhaustive, property-based and metamorphic ordering tests.
 * Runtime comparison happens ONLY on fixed fixtures and on seeded,
 * always-terminating generated programs; learners are never involved.
 * Categories are kept apart: soundness violation (accepted, policy says no),
 * completeness gap (policy says yes, rejected), oracle undecided, validator
 * indeterminate and parser/representation errors. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {bindingChecker} from '../dist/author/statement-ordering.js';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {corpus} from './fixtures/ordering-corpus.mjs';
import {createOracle,codesOf,neighbourhood,extensions,blockMoves,random,shrink} from './support/semantic-oracle.mjs';
import {witnessViolation,relabel,structure} from './support/model-invariants.mjs';
import {randomProgram,randomClassProgram,randomScriptProgram} from './support/random-programs.mjs';

const permutations=items=>items.length<2?[items]:items.flatMap((value,i)=>permutations(items.filter((_,j)=>i!==j)).map(rest=>[value,...rest]));
const generate=fixture=>generateCodeLineExercise({source:fixture.source.join('\n'),language:fixture.language},ts);
function compiled(model){const result=compileCodeLineExercise(model);assert.ok(!result.status,result.message);return result.compiled;}
const grade=(rules,model,lines,maxStates=200_000)=>validateSubmission(rules,{exerciseId:model.id,revision:model.revision,lines},{maxStates});

/** Checks every accepted order: witness contracts and policy oracle. Returns category counts. */
function classify(fixture,model,orders){
 const rules=compiled(model),judge=createOracle(fixture),reference=model.lines.map(line=>line.id);
 const counts={orders:0,accepted:0,gaps:0,justified:0,undecided:0,indeterminate:0},seen=new Set();
 const failing=order=>{const lines=codesOf(model,order);return grade(rules,model,lines).status==='accepted'&&judge(lines).ok===false;};
 for(const order of orders){
  const lines=codesOf(model,order),key=lines.join('\n');if(seen.has(key))continue;seen.add(key);counts.orders++;
  const report=grade(rules,model,lines),verdict=judge(lines);
  if(report.status==='indeterminate'){counts.indeterminate++;continue;}
  if(report.status==='accepted'){
   counts.accepted++;
   assert.equal(witnessViolation(model,lines,report),null,`${fixture.id}: witness breaks a model contract for ${order}`);
   assert.notEqual(verdict.ok,false,`${fixture.id}: SOUNDNESS violation (${verdict.reason}); minimal counterexample ${JSON.stringify(shrink(reference,order,failing))}\n${fixture.source.join('\n')}`);
   if(verdict.ok===null)counts.undecided++;
  }else if(verdict.ok===true)counts.gaps++;
  else if(verdict.ok===null)counts.undecided++;
  else counts.justified++;
 }
 return counts;
}

/* ------------------------- exhaustive Π(T) on small fixtures ------------------------- */
const small=[...corpus.values()].filter(fixture=>fixture.source.length<=7);
test('exhaustive: the small corpus set is the intended one',()=>assert.ok(small.length>=10,small.map(f=>f.id).join(',')));
for(const fixture of small)test('exhaustive Π(T): '+fixture.id,t=>{
 const model=generate(fixture),reference=model.lines.map(line=>line.id);
 assert.equal(grade(compiled(model),model,model.lines.map(line=>line.code)).status,'accepted','reference order');
 const counts=classify(fixture,model,permutations(reference));
 assert.equal(counts.indeterminate,0);assert.equal(counts.undecided,0);
 t.diagnostic(`${counts.orders} distinct permutations: ${counts.accepted} accepted, ${counts.gaps} completeness gaps, ${counts.justified} justified rejections`);
});

/* ------------------------- property-based: seeded random programs ------------------------- */
test('property: 30 seeded random programs — sampled linear extensions and every neighbour are sound',t=>{
 const totals={programs:0,orders:0,accepted:0,gaps:0};
 for(let seed=1;seed<=30;seed++){
  const fixture=randomProgram(seed),model=generate(fixture),rng=random(seed*7919);
  const sampled=Array.from({length:25},()=>extensions(model,{limit:1,rng})[0]);
  // Every sampled linear extension is a model-valid order and must be accepted.
  const rules=compiled(model);for(const order of sampled)assert.equal(grade(rules,model,codesOf(model,order)).status,'accepted',`seed ${seed} extension ${order}`);
  const counts=classify(fixture,model,[...sampled,...neighbourhood(model.lines.map(line=>line.id))]);
  assert.equal(counts.indeterminate,0,`seed ${seed}`);assert.equal(counts.undecided,0,`seed ${seed}`);
  totals.programs++;totals.orders+=counts.orders;totals.accepted+=counts.accepted;totals.gaps+=counts.gaps;
 }
 t.diagnostic(JSON.stringify(totals));
});

// WP6: multi-row calls and shared `} else {` boundaries next to hoisted helpers,
// the shapes in which ADR-008 position-free rows could enter a unit's interior.
test('property: 12 seeded extended programs (multi-row calls, shared else boundaries) are sound',t=>{
 const totals={programs:0,orders:0,accepted:0,gaps:0};
 for(let seed=1;seed<=12;seed++){
  const fixture=randomProgram(seed,{extended:true}),model=generate(fixture),rng=random(seed*104729);
  const sampled=Array.from({length:25},()=>extensions(model,{limit:1,rng})[0]);
  const counts=classify(fixture,model,[...sampled,...neighbourhood(model.lines.map(line=>line.id))]);
  assert.equal(counts.indeterminate,0,`seed ${seed}`);assert.equal(counts.undecided,0,`seed ${seed}`);
  totals.programs++;totals.orders+=counts.orders;totals.accepted+=counts.accepted;totals.gaps+=counts.gaps;
 }
 t.diagnostic(JSON.stringify(totals));
});

/* ---------- generative coverage: classes, script-level declarations, TypeScript ----------
 * The function-body generator above never produces classes, script globals or
 * TypeScript, where the reflective key-order rules (ADR-010) live. Each program
 * is checked on sampled linear extensions, the single-row neighbourhood and every
 * whole-unit block move (a multi-row member or statement moved as a whole). The
 * long campaign over many more seeds is tests/ordering-campaign.mjs. */
test('generative: every generated class and script reference runs, compiles and is accepted',()=>{
 for(const make of [randomClassProgram,randomScriptProgram])for(const language of ['javascript','typescript'])for(let seed=1;seed<=40;seed++){
  const fixture=make(seed,{language}),model=generate(fixture);
  createOracle(fixture);
  assert.equal(grade(compiled(model),model,model.lines.map(line=>line.code)).status,'accepted',fixture.id);
 }
});
const generative=[
 {name:'JavaScript class programs',make:seed=>randomClassProgram(seed,{language:'javascript'}),seeds:12},
 {name:'TypeScript class programs',make:seed=>randomClassProgram(seed,{language:'typescript'}),seeds:4,thin:4},
 {name:'JavaScript scripts',make:seed=>randomScriptProgram(seed,{language:'javascript'}),seeds:12},
 {name:'TypeScript scripts',make:seed=>randomScriptProgram(seed,{language:'typescript'}),seeds:8}];
for(const {name,make,seeds,thin=1} of generative)test(`generative: ${seeds} seeded ${name} — extensions, neighbours and block moves are sound`,t=>{
 const totals={programs:0,orders:0,accepted:0,gaps:0,blockMoves:0};
 for(let seed=1;seed<=seeds;seed++){
  const fixture=make(seed),model=generate(fixture),rng=random(seed*15485863),moves=blockMoves(model);
  const sampled=Array.from({length:25},()=>extensions(model,{limit:1,rng})[0]);
  const rules=compiled(model);for(const order of sampled)assert.equal(grade(rules,model,codesOf(model,order)).status,'accepted',`${fixture.id} extension ${order}`);
  // The TypeScript oracle transpiles every candidate twice: thin the single-row neighbourhood, never the block moves.
  const counts=classify(fixture,model,[...sampled,...neighbourhood(model.lines.map(line=>line.id)).filter((_,i)=>i%thin===0),...moves]);
  assert.equal(counts.indeterminate,0,fixture.id);assert.equal(counts.undecided,0,fixture.id);
  totals.programs++;totals.orders+=counts.orders;totals.accepted+=counts.accepted;totals.gaps+=counts.gaps;totals.blockMoves+=moves.length;
 }
 t.diagnostic(JSON.stringify(totals));
});
test('block moves express the multi-row member move behind the ADR-010 v7 accessor fix',()=>{
 const fixture=corpus.get('refl-ts-accessor-fields'),model=generate(fixture),orders=blockMoves(model).map(order=>order.join(','));
 // read() (rows 2–4) moved below `accessor level` (row 6): rejected and not equivalent.
 const methodAfterAccessor=[1,5,6,2,3,4,...Array.from({length:17},(_,i)=>7+i)];
 assert.ok(orders.includes(methodAfterAccessor.join(',')));
 assert.equal(grade(compiled(model),model,codesOf(model,methodAfterAccessor)).status,'rejected');
 assert.equal(createOracle(fixture)(codesOf(model,methodAfterAccessor)).ok,false);
});
test('oracle: nested classes get a runtime key snapshot after the probe ran',()=>{
 // Same key order, different descriptor: only the runtime snapshot of the nested class sees it.
 const fixture={id:'nested-descriptor',language:'javascript',probe:'evaluate()',source:['function evaluate() {','  class Local {','    get x() { return 1; }','    x() { return 2; }','  }','  return typeof Local;','}']};
 const judge=createOracle(fixture),swapped=[fixture.source[0],fixture.source[1],fixture.source[3],fixture.source[2],...fixture.source.slice(4)];
 assert.deepEqual(judge(swapped),{ok:false,reason:'reflection'});
 assert.deepEqual(createOracle(fixture,{policy:'call-only'})(swapped),{ok:true,reason:'equivalent'});
 const model=generate(fixture);assert.equal(grade(compiled(model),model,swapped).status,'rejected');
});

/* ------------------------- metamorphic relations ------------------------- */
const renamable=new Set([ts.SyntaxKind.VariableDeclaration,ts.SyntaxKind.Parameter,ts.SyntaxKind.FunctionDeclaration,ts.SyntaxKind.ClassDeclaration,ts.SyntaxKind.InterfaceDeclaration,ts.SyntaxKind.TypeAliasDeclaration,ts.SyntaxKind.EnumDeclaration,ts.SyntaxKind.BindingElement,ts.SyntaxKind.TypeParameter]);
/** Consistent alpha-renaming of every locally declared binding (members and properties untouched). */
function renameLocals(fixture){
 const text=fixture.source.join('\n'),typescript=fixture.language==='typescript';
 const file=ts.createSourceFile('reference.'+(typescript?'ts':'js'),text,ts.ScriptTarget.Latest,true,typescript?ts.ScriptKind.TS:ts.ScriptKind.JS),checker=bindingChecker(file,ts),edits=[];
 const local=symbol=>!!symbol?.declarations?.length&&symbol.declarations.every(declaration=>declaration.getSourceFile()===file&&renamable.has(declaration.kind));
 const visit=node=>{
  if(ts.isIdentifier(node)){
   if(ts.isShorthandPropertyAssignment(node.parent)&&node.parent.name===node){if(local(checker.getShorthandAssignmentValueSymbol(node.parent)))edits.push([node.getStart(file),node.end,`${node.text}: ${node.text}_m`]);}
   else if(local(checker.getSymbolAtLocation(node)))edits.push([node.getStart(file),node.end,node.text+'_m']);
  }
  ts.forEachChild(node,visit);
 };
 visit(file);
 let renamed=text;for(const [start,end,replacement] of edits.sort((a,b)=>b[0]-a[0]))renamed=renamed.slice(0,start)+replacement+renamed.slice(end);
 return {fixture:{...fixture,source:renamed.split('\n')},edits:edits.length};
}
const metamorphicSet=[...corpus.values(),...Array.from({length:10},(_,i)=>randomProgram(100+i))];
test('metamorphic: consistent renaming of local bindings never changes the generated ordering structure',t=>{
 let renamedIdentifiers=0;
 for(const fixture of metamorphicSet){
  const {fixture:renamed,edits}=renameLocals(fixture);renamedIdentifiers+=edits;
  assert.ok(edits>0||fixture.source.length<3,fixture.id);
  assert.equal(structure(generate(renamed)),structure(generate(fixture)),fixture.id);
 }
 t.diagnostic(`${metamorphicSet.length} fixtures, ${renamedIdentifiers} identifiers renamed`);
});
test('metamorphic: re-indenting the reference never changes the generated ordering structure',()=>{
 for(const fixture of metamorphicSet){
  const model=generate(fixture);if(model.lines.some(line=>line.normalization==='exact'))continue;
  for(const indent of [line=>line.trimStart(),line=>line.replace(/^( *)/,'$1$1    ')])assert.equal(structure(generate({...fixture,source:fixture.source.map(indent)})),structure(model),fixture.id);
 }
});
test('metamorphic: a bijective line-ID relabelling preserves every verdict and maps the witness',()=>{
 for(const fixture of metamorphicSet){
  const model=generate(fixture),rng=random(fixture.id.length*131),ids=model.lines.map(line=>line.id);
  const fresh=ids.map(id=>1000+id*7).sort(()=>rng()-0.5),map=new Map(ids.map((id,i)=>[id,fresh[i]]));
  const other=relabel(model,map),a=compiled(model),b=compiled(other);
  const orders=[ids,...extensions(model,{limit:1,rng:random(5)}),...neighbourhood(ids).filter((_,i)=>i%7===0).slice(0,40)];
  for(const order of orders){
   const lines=codesOf(model,order),left=grade(a,model,lines),right=grade(b,other,lines);
   assert.equal(right.status,left.status,`${fixture.id} ${order}`);
   if(left.accepted)assert.equal(witnessViolation(other,lines,right),null,fixture.id);
  }
 }
});
test('metamorphic: a small search budget only ever answers indeterminate or the full-budget verdict',t=>{
 let indeterminate=0,decided=0;
 for(const id of ['class-inventory-ts','class-accounts-ts','algo-bfs-js','ch-ts-hoisted-types']){
  const fixture=corpus.get(id),model=generate(fixture),rules=compiled(model),ids=model.lines.map(line=>line.id);
  for(const order of [...extensions(model,{limit:15,rng:random(11)}),...neighbourhood(ids).filter((_,i)=>i%11===0).slice(0,60)]){
   const lines=codesOf(model,order),tight=grade(rules,model,lines,25),full=grade(rules,model,lines);
   if(tight.status==='indeterminate'){indeterminate++;continue;}
   decided++;assert.equal(tight.status,full.status,`${id} ${order}`);
  }
 }
 t.diagnostic(`${decided} decided within 25 states, ${indeterminate} indeterminate (never counted as accepted or rejected)`);
});
