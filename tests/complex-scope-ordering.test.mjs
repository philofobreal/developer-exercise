/** Differential execution is ONLY for these fixed, bounded test fixtures.
 * Learner evaluation never parses or runs code. Here a runtime probe is an
 * independent oracle: every accepted arrangement must behave like the
 * reference; every named rejection is classified as either justified (the
 * probe differs) or a documented conservative limit (the probe agrees). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script,createContext} from 'node:vm';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {auditReference} from '../src/author/audit.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {corpus} from './fixtures/ordering-corpus.mjs';

const permutations=items=>items.length<2?[items]:items.flatMap((value,i)=>permutations(items.filter((_,j)=>i!==j)).map(rest=>[value,...rest]));
const range=(from,to)=>Array.from({length:to-from+1},(_,i)=>from+i);
const swap=(order,a,b)=>order.map(id=>id===a?b:id===b?a:id);
const place=(order,slots,values)=>order.map(id=>slots.includes(id)?values[slots.indexOf(id)]:id);
function moveBefore(order,ids,target){ids=[].concat(ids);const rest=order.filter(id=>!ids.includes(id)),at=rest.indexOf(target);assert.ok(at>=0);return [...rest.slice(0,at),...ids,...rest.slice(at)];}
function moveAfter(order,ids,target){ids=[].concat(ids);const rest=order.filter(id=>!ids.includes(id)),at=rest.indexOf(target)+1;assert.ok(at>0);return [...rest.slice(0,at),...ids,...rest.slice(at)];}
function compile(model){const result=compileCodeLineExercise(model);assert.ok(!result.status,result.message);return result.compiled;}
function grade(compiled,lines){return validateSubmission(compiled,{exerciseId:compiled.definition.id,revision:compiled.definition.revision,lines},{maxStates:200_000});}
const codes=(model,order)=>order.map(id=>model.lines.find(line=>line.id===id).code);

// Runtime probe. TypeScript is transpiled with both class-field semantics.
function outcome(code,language,probe){
 // A timeout is confirmed with a longer budget so machine load cannot fake one.
 const attempt=(js,timeout)=>{try{return new Script('"use strict";\nfunction record(...args) { trace.push(args); }\n'+js+'\n;JSON.stringify('+probe+');',{filename:'fixed-fixture.js'}).runInContext(createContext({trace:[]}),{timeout});}
  catch(error){return 'throws:'+(error?.code==='ERR_SCRIPT_EXECUTION_TIMEOUT'?'timeout':error?.name);}};
 const run=js=>{const first=attempt(js,250);return first==='throws:timeout'?attempt(js,2000):first;};
 if(language!=='typescript')return run(code);
 return [false,true].map(define=>{
  const output=ts.transpileModule(code,{reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,useDefineForClassFields:define}});
  return output.diagnostics.length?'syntax-error':run(output.outputText);
 }).join(' | ');
}
function oracle(model,probe){
 const cache=new Map(),baseline=outcome(model.lines.map(line=>line.code).join('\n'),model.language,probe);
 assert.ok(!baseline.includes('throws:')&&!baseline.includes('syntax-error'),baseline);
 return lines=>{const key=lines.join('\n');if(!cache.has(key))cache.set(key,outcome(key,model.language,probe)===baseline);return cache.get(key);};
}

/* ---------------------------------------------------------------------------
 * Part 1 – named scope and ordering scenarios on GENERATED models.
 * status: what the application must answer today; equivalent: what the probe
 * says. accepted && !equivalent is forbidden in every case (soundness).
 * ------------------------------------------------------------------------- */
const record='({value: evaluate(), trace})';
const scenarios=[
 {name:'külső konstans és ciklusmag',language:'javascript',source:corpus.get('scope-outer-const-loop').source,
  variants:[
   ...permutations([2,3,4]).slice(1).map(p=>({name:'kezdeti deklarációk sorrendje '+p.join(','),order:o=>place(o,[2,3,4],p),status:'accepted',equivalent:true})),
   {name:'külső konstans (step) eggyel beljebb, a ciklusmagba a használat elé',order:o=>moveBefore(o,3,6),status:'rejected',equivalent:true},
   {name:'belső deklaráció (scaled) kiemelése a ciklus elé',order:o=>moveBefore(o,6,5),status:'rejected',equivalent:false},
   {name:'akkumulátor (let total) a ciklusmagba',order:o=>moveBefore(o,4,6),status:'rejected',equivalent:false},
   {name:'a ciklusfejben használt limit a ciklusmagba',order:o=>moveBefore(o,2,6),status:'rejected',equivalent:false},
   {name:'step a ciklus után (TDZ)',order:o=>moveAfter(o,3,8),status:'rejected',equivalent:false},
   {name:'használat a deklaráció előtt ugyanabban a scope-ban',order:o=>swap(o,6,7),status:'rejected',equivalent:false},
   {name:'return a ciklusmagba',order:o=>moveBefore(o,9,8),status:'rejected',equivalent:false}]},
 {name:'háromszintű blokkok és árnyékolás',language:'javascript',source:corpus.get('scope-three-levels-shadowing').source,probe:record,
  variants:[
   {name:'külső deklarációk cseréje',order:o=>swap(o,2,3),status:'accepted',equivalent:true},
   {name:'középső szint: árnyékoló label és offset cseréje',order:o=>swap(o,5,6),status:'accepted',equivalent:true},
   {name:'legbelső szint: scaled és shifted cseréje',order:o=>swap(o,8,9),status:'accepted',equivalent:true},
   {name:'a két label deklaráció cseréje a scope-ok között',order:o=>swap(o,3,5),status:'rejected',equivalent:false},
   {name:'offset kiemelése a külső scope-ba',order:o=>moveBefore(o,6,4),status:'rejected',equivalent:true},
   {name:'shifted egy szinttel kijjebb',order:o=>moveBefore(o,9,7),status:'rejected',equivalent:true},
   {name:'árnyékoló label egy szinttel beljebb',order:o=>moveBefore(o,5,8),status:'rejected',equivalent:true},
   {name:'base a legbelső blokkba',order:o=>moveBefore(o,2,8),status:'rejected',equivalent:false},
   {name:'árnyékoló label a külső scope-ba (duplikált deklaráció)',order:o=>moveBefore(o,5,4),status:'rejected',equivalent:false},
   {name:'record a deklarációk elé',order:o=>moveBefore(o,10,8),status:'rejected',equivalent:false}]},
 {name:'var és függvény-hoisting',language:'javascript',source:corpus.get('hoisting-var-function').source,
  variants:[
   {name:'belső függvénydeklaráció a használat elé',order:o=>moveBefore(o,range(6,8),2),status:'accepted',equivalent:true},
   {name:'return a hoistolt függvénydeklaráció elé',order:o=>moveBefore(o,9,6),status:'accepted',equivalent:true},
   {name:'var count a ciklus után',order:o=>moveBefore(o,2,9),status:'rejected',equivalent:false},
   {name:'var count a ciklusmagba',order:o=>moveBefore(o,2,4),status:'rejected',equivalent:false}]},
 // ADR-010: the probes also read the reflected key order (global object, prototype).
 {name:'felső szintű függvények',language:'javascript',source:corpus.get('top-level-functions').source,probe:"[evaluate(), Object.keys(globalThis).filter(key => ['double', 'evaluate'].includes(key))]",
  variants:[
   {name:'a két függvénydeklaráció cseréje',order:o=>moveBefore(o,range(4,6),1),status:'rejected',equivalent:false},
   {name:'a két függvénytörzs cseréje',order:o=>swap(o,2,5),status:'rejected',equivalent:false}]},
 {name:'closure és késleltetett olvasás',language:'javascript',source:corpus.get('closure-deferred-read').source,
  variants:[
   {name:'let count a closure definíciója után',order:o=>moveBefore(o,2,7),status:'accepted',equivalent:true},
   {name:'let count a closure törzsébe',order:o=>moveBefore(o,2,4),status:'rejected',equivalent:false},
   {name:'let count a return után',order:o=>moveAfter(o,2,7),status:'rejected',equivalent:false},
   {name:'hívás és return cseréje',order:o=>swap(o,11,12),status:'rejected',equivalent:false}]},
 {name:'else if lánc megosztott } else { határokkal',language:'javascript',source:corpus.get('else-if-shared-boundaries').source,
  variants:[
   {name:'konstansok cseréje',order:o=>swap(o,2,3),status:'accepted',equivalent:true},
   {name:'let label a konstansok elé',order:o=>moveBefore(o,4,2),status:'accepted',equivalent:true},
   {name:'két ág törzsének cseréje',order:o=>swap(o,6,8),status:'rejected',equivalent:false},
   {name:'big az else-if ágba',order:o=>moveBefore(o,2,8),status:'rejected',equivalent:false},
   {name:'let label az első ágba',order:o=>moveBefore(o,4,6),status:'rejected',equivalent:false}]},
 {name:'címkézett ciklusok, continue és break',language:'javascript',source:corpus.get('labelled-loops').source,
  variants:[
   {name:'a continue és break feltétel cseréje',order:o=>moveBefore(o,range(8,10),5),status:'rejected',equivalent:false},
   {name:'push a feltételek elé',order:o=>moveBefore(o,11,5),status:'rejected',equivalent:false},
   {name:'found a külső ciklusba',order:o=>moveBefore(o,2,4),status:'rejected',equivalent:false}]},
 {name:'try/catch/finally és switch',language:'javascript',source:corpus.get('try-finally-switch').source,
  variants:[
   {name:'catch és finally törzsének cseréje',order:o=>swap(o,10,12),status:'rejected',equivalent:false},
   {name:'push a típusellenőrzés elé',order:o=>moveBefore(o,8,5),status:'rejected',equivalent:false},
   {name:'break a case törzse elé',order:o=>swap(o,16,17),status:'rejected',equivalent:false},
   {name:'switch blokk a try elé',order:o=>moveBefore(o,range(14,20),4),status:'rejected',equivalent:false}]},
 {name:'destrukturálás, objektum és template literál',language:'javascript',source:corpus.get('destructuring-object-template').source,
  variants:[
   {name:'objektumliterál és primitív konstans cseréje',order:o=>swap(o,2,3),status:'accepted',equivalent:true},
   {name:'primitív konstans és destrukturálás cseréje',order:o=>swap(o,3,4),status:'rejected',equivalent:true},
   {name:'template a destrukturálás elé',order:o=>swap(o,4,5),status:'rejected',equivalent:false},
   {name:'scale a return után',order:o=>moveAfter(o,3,6),status:'rejected',equivalent:false}]},
 {name:'JavaScript osztály: mezők és metódusok',language:'javascript',source:corpus.get('js-class-fields-methods').source,probe:'[evaluate(), Object.getOwnPropertyNames(Counter.prototype)]',
  variants:[
   {name:'egymásra hivatkozó mezőinicializálók cseréje',order:o=>swap(o,2,3),status:'rejected',equivalent:false},
   {name:'metódusok cseréje',order:o=>moveBefore(o,range(8,10),4),status:'rejected',equivalent:false},
   {name:'metódus a mezők elé',order:o=>moveBefore(o,range(4,7),2),status:'accepted',equivalent:true},
   {name:'osztálydeklaráció a később hívott függvény után',order:o=>moveAfter(o,range(1,11),18),status:'accepted',equivalent:true},
   {name:'reset a második increment elé',order:o=>swap(o,15,16),status:'rejected',equivalent:false}]},
 {name:'TypeScript interface és típusliterál',language:'typescript',source:corpus.get('ts-interface-type-literal').source,
  variants:[
   ...permutations([2,3,4]).slice(1).map(p=>({name:'interface-tagok sorrendje '+p.join(','),order:o=>place(o,[2,3,4],p),status:'accepted',equivalent:true})),
   {name:'típusliterál tagjainak cseréje',order:o=>swap(o,7,8),status:'accepted',equivalent:true},
   {name:'interface és type alias cseréje',order:o=>moveBefore(o,range(6,9),1),status:'accepted',equivalent:true},
   {name:'függvény a típusdeklarációk elé',order:o=>moveBefore(o,range(10,14),1),status:'accepted',equivalent:true},
   {name:'tag áthelyezése a másik típusba',order:o=>moveBefore(o,3,8),status:'rejected',equivalent:true},
   {name:'egymásra hivatkozó konstansok cseréje',order:o=>swap(o,11,12),status:'rejected',equivalent:false}]},
 {name:'TypeScript enum',language:'typescript',source:corpus.get('ts-enum').source,
  variants:[
   {name:'automatikus értékű enum-tagok cseréje',order:o=>swap(o,2,3),status:'rejected',equivalent:false},
   {name:'függvény az enum elé',order:o=>moveBefore(o,range(6,8),1),status:'accepted',equivalent:true}]},
 {name:'TypeScript mezők, declare, paraméterproperty',language:'typescript',source:corpus.get('ts-fields-declare-parameter-property').source,
  variants:[
   {name:'egymásra hivatkozó mezők cseréje',order:o=>swap(o,2,3),status:'rejected',equivalent:false},
   {name:'declare mező a futásidejű mezők elé',order:o=>moveBefore(o,4,2),status:'accepted',equivalent:true},
   {name:'metódus a konstruktor elé',order:o=>moveBefore(o,range(6,8),5),status:'accepted',equivalent:true}]},
 {name:'TypeScript öröklés',language:'typescript',source:corpus.get('ts-inheritance').source,
  variants:[
   {name:'leszármazott osztály az ős elé',order:o=>moveBefore(o,range(7,14),1),status:'rejected',equivalent:false},
   {name:'felüldefiniált metódus a konstruktor elé',order:o=>moveBefore(o,range(11,13),8),status:'accepted',equivalent:true},
   {name:'ős metódusának törzse a leszármazottba',order:o=>swap(o,4,12),status:'rejected',equivalent:false}]},
 {name:'TypeScript metódus: külső deklaráció és ciklus',language:'typescript',source:corpus.get('ts-method-outer-declaration').source,
  variants:[
   {name:'típusannotált konstans és let cseréje',order:o=>swap(o,3,4),status:'accepted',equivalent:true},
   {name:'külső konstans eggyel beljebb, a ciklusmagba',order:o=>moveBefore(o,3,6),status:'rejected',equivalent:true},
   {name:'akkumulátor a ciklusmagba',order:o=>moveBefore(o,4,6),status:'rejected',equivalent:false}]},
];

const generated=scenario=>{
 const model=generateCodeLineExercise({source:scenario.source.join('\n'),language:scenario.language},ts);
 assert.equal(model.lines.length,scenario.source.length);auditReference(model,ts);return model;
};
const summary={accepted:0,justifiedRejections:0,conservativeRejections:[]};
for(const scenario of scenarios)test(`forgatókönyv (${scenario.language}): ${scenario.name}`,()=>{
 const model=generated(scenario),compiled=compile(model),equivalent=oracle(model,scenario.probe??'evaluate()'),reference=model.lines.map(line=>line.id);
 assert.equal(grade(compiled,codes(model,reference)).status,'accepted');
 for(const variant of scenario.variants){
  const order=variant.order(reference),lines=codes(model,order),label=JSON.stringify({scenario:scenario.name,variant:variant.name,order});
  assert.deepEqual([...order].sort((a,b)=>a-b),reference,label);assert.notDeepEqual(order,reference,label);
  const status=grade(compiled,lines).status,same=equivalent(lines);
  assert.ok(!(status==='accepted'&&!same),'UNSOUND acceptance '+label);
  assert.equal(same,variant.equivalent,'probe '+label);
  assert.equal(status,variant.status,'status '+label);
  if(status==='accepted')summary.accepted++;else if(same)summary.conservativeRejections.push(`${scenario.name}: ${variant.name}`);else summary.justifiedRejections++;
 }
});

/* ---------------------------------------------------------------------------
 * Part 2 – exhaustive local sweep: every single-row move and every pair swap of
 * each generated scenario model. No accepted arrangement may change behaviour.
 * ------------------------------------------------------------------------- */
function neighbourhood(reference){
 const orders=new Map(),add=order=>orders.set(order.join(','),order);
 for(const id of reference)for(let at=0;at<reference.length;at++){const rest=reference.filter(x=>x!==id);add([...rest.slice(0,at),id,...rest.slice(at)]);}
 for(let i=0;i<reference.length;i++)for(let j=i+1;j<reference.length;j++)add(swap(reference,reference[i],reference[j]));
 orders.delete(reference.join(','));return [...orders.values()];
}
function sweep(model,probe,t,count=true){
 const compiled=compile(model),equivalent=oracle(model,probe),reference=model.lines.map(line=>line.id);let accepted=0,conservative=0,total=0;
 const seen=new Set();
 for(const order of neighbourhood(reference)){
  const lines=codes(model,order),key=lines.join('\n');if(seen.has(key))continue;seen.add(key);total++;
  const status=grade(compiled,lines).status;assert.notEqual(status,'indeterminate',key);
  if(status==='accepted'){accepted++;assert.ok(equivalent(lines),'UNSOUND acceptance:\n'+key);}
  else if(count&&model.language==='javascript'&&equivalent(lines))conservative++;
 }
 t.diagnostic(`${model.id}: ${total} különböző szomszédos elrendezés, ${accepted} elfogadva (mind ekvivalens)`+(count&&model.language==='javascript'?`, ${conservative} ekvivalens de elutasított`:''));
 return {total,accepted};
}
test('teljes szomszédsági söprés: minden egy-soros áthelyezés és páros csere helyes a generált modelleken',t=>{
 for(const scenario of scenarios){const model=generated(scenario);model.id=scenario.name;sweep(model,scenario.probe??'evaluate()',t);}
});

/* ---------------------------------------------------------------------------
 * Part 3 – the shipped library examples (left-hand task list).
 * Linear extensions are enumerated independently of the validator: every one
 * must be accepted and runtime-equivalent; everything else nearby is rejected.
 * ------------------------------------------------------------------------- */
const library={
 'algo-bfs-js':{probe:'(() => { const grid = [[0, 0, 0, 0], [1, 1, 0, 1], [0, 0, 0, 0], [0, 1, 1, 0]]; return [shortestPath(grid, [0, 0], [3, 3]), shortestPath(grid, [0, 0], [2, 0]), shortestPath(grid, [3, 0], [0, 3]), shortestPath([[0, 1], [1, 0]], [0, 0], [1, 1]), shortestPath(grid, [2, 2], [2, 2]), shortestPath([[0, 0], [0, 0]], [0, 0], [5, 5])]; })()',extensions:960,
  scope:[
   {name:'directions eggyel beljebb, a while ciklusba',order:o=>moveBefore(o,4,8),status:'rejected',equivalent:true},
   {name:'rows két szinttel beljebb, a for ciklusba',order:o=>moveBefore(o,2,13),status:'rejected',equivalent:true},
   {name:'visited a while ciklusba (minden körben új halmaz)',order:o=>moveBefore(o,5,8),status:'rejected',equivalent:false},
   {name:'nextRow kiemelése a for ciklus elé',order:o=>moveBefore(o,13,12),status:'rejected',equivalent:false},
   {name:'deklarációk tetszőleges sorrendje',order:o=>place(o,[2,3,4,5,6],[6,4,2,5,3]),status:'accepted',equivalent:true},
   {name:'visited.add és queue.push cseréje',order:o=>swap(o,20,21),status:'accepted',equivalent:true},
   {name:'continue-ág és visited.add cseréje',order:o=>moveBefore(o,20,17),status:'rejected',equivalent:false}]},
 'algo-sort-search-js':{probe:'(() => { const input = [5, 2, 9, 1, 5, 6, -3]; const sorted = insertionSort(input); return [sorted, input, [-3, 1, 5, 6, 9, 4, 10].map((target) => binarySearch(sorted, target))]; })()',extensions:8,
  scope:[
   {name:'a két függvény sorrendje',order:o=>moveBefore(o,range(14,29),1),status:'accepted',equivalent:true},
   {name:'const current a belső while ciklusba',order:o=>moveBefore(o,4,7),status:'rejected',equivalent:false},
   {name:'let j a for ciklus elé (külső scope)',order:o=>moveBefore(o,5,3),status:'rejected',equivalent:false},
   {name:'low és high kezdőérték cseréje',order:o=>swap(o,15,16),status:'accepted',equivalent:true},
   {name:'else-ág és if-ág törzsének cseréje',order:o=>swap(o,23,25),status:'rejected',equivalent:false},
   {name:'mid kiemelése a while elé',order:o=>moveBefore(o,18,17),status:'rejected',equivalent:false}]},
 'class-inventory-ts':{probe:"(() => { const inventory = new Inventory(3); inventory.add({ sku: 'a', name: 'alma', quantity: 2, price: 100 }); inventory.add({ sku: 'b', name: 'barack', quantity: 5, price: 40 }); inventory.add({ sku: 'a', name: 'alma', quantity: 4, price: 100 }); inventory.add({ sku: 'c', name: 'citrom', quantity: 1, price: 70 }); return [inventory.totalValue(), inventory.lowStock(), Object.keys(inventory)]; })()",extensions:288,
  scope:[
   {name:'osztály az interface elé',order:o=>moveBefore(o,range(7,34),1),status:'accepted',equivalent:true},
   {name:'metódusok fordított sorrendje',order:o=>moveAfter(moveAfter(o,range(18,24),33),range(10,17),24),status:'accepted',equivalent:true},
   {name:'let total a for ciklusba',order:o=>moveBefore(o,19,21),status:'rejected',equivalent:false},
   {name:'const names a for ciklusba',order:o=>moveBefore(o,26,28),status:'rejected',equivalent:false},
   {name:'interface-tag az osztálytörzsbe',order:o=>moveBefore(o,5,8),status:'rejected',equivalent:false},
   {name:'korai return a feltétel után',order:o=>swap(o,13,14),status:'rejected',equivalent:false}]},
 'class-accounts-ts':{probe:"(() => { const account = new CreditAccount('Ana', 50); account.deposit(100); const results = [account.withdraw(120), account.withdraw(40), account.withdraw(5)]; account.deposit(7); return [results, account.statement(), Object.keys(account), account instanceof Account]; })()",extensions:192,
  scope:[
   {name:'leszármazott osztály az ős elé',order:o=>moveBefore(o,range(22,29),1),status:'rejected',equivalent:false},
   {name:'mezők cseréje',order:o=>swap(o,2,3),status:'rejected',equivalent:false},
   {name:'absztrakt metódus előre',order:o=>moveBefore(o,20,5),status:'accepted',equivalent:true},
   {name:'egyenleg és napló frissítésének cseréje',order:o=>swap(o,13,14),status:'accepted',equivalent:true},
   {name:'super hívás a konstruktoron kívül',order:o=>moveBefore(o,24,26),status:'rejected',equivalent:false},
   {name:'levonás a fedezetellenőrzés elé',order:o=>moveBefore(o,13,10),status:'rejected',equivalent:false}]},
};
function linearExtensions(model){
 const lines=model.lines,byId=new Map(lines.map(line=>[line.id,line])),openers=new Map(model.blocks.map(b=>[b.openLineId,b.id])),closers=new Map(model.blocks.map(b=>[b.closeLineId,b.id]));
 const before=new Map(lines.map(line=>[line.id,new Set(line.dependencies)]));for(const edge of model.edges??[])before.get(edge.after).add(edge.before);
 const results=new Map(),placed=new Set(),sequence=[],stack=[],pinned=new Map(lines.flatMap((line,i)=>line.fixed?[[i,line.id]]:[]));
 (function extend(){
  if(sequence.length===lines.length){if(!stack.length)results.set(codes(model,sequence).join('\n'),[...sequence]);return;}
  for(const line of lines){
   if(placed.has(line.id)||[...before.get(line.id)].some(id=>!placed.has(id)))continue;
   if(line.fixed?lines.indexOf(line)!==sequence.length:pinned.has(sequence.length))continue;
   const close=closers.get(line.id);if(close!==undefined&&stack.at(-1)!==close)continue;
   if(close!==undefined)stack.pop();
   if((stack.at(-1)??null)===line.scopeId){const open=openers.get(line.id);if(open!==undefined)stack.push(open);placed.add(line.id);sequence.push(line.id);extend();sequence.pop();placed.delete(line.id);if(open!==undefined)stack.pop();}
   if(close!==undefined)stack.push(close);
  }
 })();
 assert.ok(byId.size===lines.length);return [...results.values()];
}
for(const [id,spec] of Object.entries(library))test('bal oldali feladatkönyvtár: '+id,async t=>{
 const model=JSON.parse(await readFile(new URL(`../examples/${id}.json`,import.meta.url),'utf8'));
 auditReference(model,ts);const compiled=compile(model),equivalent=oracle(model,spec.probe),reference=model.lines.map(line=>line.id);
 const extensions=linearExtensions(model);assert.equal(extensions.length,spec.extensions);
 for(const order of extensions){const lines=codes(model,order);assert.equal(grade(compiled,lines).status,'accepted',JSON.stringify(order));assert.ok(equivalent(lines),'UNSOUND reference model:\n'+lines.join('\n'));}
 const allowed=new Set(extensions.map(order=>codes(model,order).join('\n')));
 for(const order of neighbourhood(reference)){const lines=codes(model,order);assert.equal(grade(compiled,lines).status,allowed.has(lines.join('\n'))?'accepted':'rejected',JSON.stringify(order));}
 for(const variant of spec.scope){
  const lines=codes(model,variant.order(reference)),label=JSON.stringify({id,variant:variant.name});
  assert.equal(equivalent(lines),variant.equivalent,'probe '+label);assert.equal(grade(compiled,lines).status,variant.status,'status '+label);
 }
 // The library model is author-tuned; it must stay at least as permissive as the generator and still sound.
 const generatedModel=generateCodeLineExercise({source:model.lines.map(line=>line.code).join('\n'),language:model.language},ts);generatedModel.id=id+' (generált)';
 const {accepted}=sweep(generatedModel,spec.probe,t,false);
 t.diagnostic(`${id}: ${extensions.length} engedélyezett teljes sorrend (generált modell szomszédságában ${accepted} elfogadott)`);
});

test('összesítés: soha nincs hibás elfogadás; a konzervatív elutasítások név szerint dokumentáltak',t=>{
 const expected=scenarios.flatMap(scenario=>scenario.variants.filter(v=>v.status==='rejected'&&v.equivalent).map(v=>`${scenario.name}: ${v.name}`));
 assert.deepEqual(summary.conservativeRejections.sort(),expected.sort());
 t.diagnostic(`${summary.accepted} elfogadott ekvivalens változat, ${summary.justifiedRejections} indokolt elutasítás, ${expected.length} ismert konzervatív korlát`);
 for(const item of expected)t.diagnostic('korlát: '+item);
});
