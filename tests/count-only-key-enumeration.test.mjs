/** ADR-109: a key enumeration read only for its count does not order the key writes; everything else that may
 *  observe key order still does, and the observation always stays after the writes. Measured through the server's
 *  author path: generate, then evaluate two arrangements against the generated rules. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {ExerciseCatalog} from '../src/server/catalog.mjs';

const catalog=new ExerciseCatalog(new Map());
/** `const o = {}; o.a = 1; o.b = 2;` then `observation` (one line); returns how the two writes and the observation may move. */
async function freedom(observation,{keyOrder='observed',prelude=[]}={}){
 const source=['function f() {',...prelude.map(line=>'  '+line),'  const o = {};','  o.a = 1;','  o.b = 2;','  '+observation,'}'].join('\n');
 const draft=await catalog.createDraft({source,language:'javascript',keyOrder});
 const lines=draft.model.lines.map(line=>line.code),at=prelude.length+2,request={draftId:draft.draftId,source,keyOrder};
 const swapped=[...lines];[swapped[at],swapped[at+1]]=[swapped[at+1],swapped[at]];
 const early=[...lines];early.splice(at+1,0,early.splice(at+2,1)[0]);
 return {writes:catalog.preview({...request,lines:swapped}).status==='accepted'?'free':'ordered',observation:catalog.preview({...request,lines:early}).status==='accepted'?'before-write':'after-writes'};
}

test('what may observe key order keeps the writes ordered, under the observed setting',async()=>{
 for(const observation of [
  'return Object.keys(o)[0];','return Object.keys(o);','return Object.keys(o).join();','return Object.entries(o)[0];',
  'return JSON.stringify(o).length;','return [...Object.keys(o)].length;','for (const k in o) g(k);',
  'return Object.keys(o).length + Object.keys(o)[0];'
 ])assert.deepEqual(await freedom(observation),{writes:'ordered',observation:'after-writes'},observation);
});

test('an alias of the key list stays ordered: its uses are not followed',async()=>{
 const source='function f() {\n  const o = {};\n  o.a = 1;\n  o.b = 2;\n  const ks = Object.keys(o);\n  return ks.length;\n}';
 const draft=await catalog.createDraft({source,language:'javascript',keyOrder:'observed'});
 const lines=draft.model.lines.map(line=>line.code);[lines[2],lines[3]]=[lines[3],lines[2]];
 assert.equal(catalog.preview({draftId:draft.draftId,source,keyOrder:'observed',lines}).status,'rejected');
});

test('without any enumeration the writes are free and the read stays after them',async()=>{
 assert.deepEqual(await freedom('return o.a + o.b;'),{writes:'free',observation:'after-writes'});
});

test('a count read never moves before the writes it counts, in either setting',async()=>{
 for(const keyOrder of ['observed','ignored'])for(const observation of ['return Object.keys(o).length;','return Object.values(o).length;','return Object.entries(o).length;'])
  assert.equal((await freedom(observation,{keyOrder})).observation,'after-writes',`${keyOrder} ${observation}`);
});

test('ADR-109: a key listing read only for its count leaves the writes free, in either setting',async()=>{
 for(const keyOrder of ['observed','ignored'])for(const observation of ['return Object.keys(o).length;','return Object.values(o).length;','return Object.entries(o).length;','return Object.keys(o)?.length;','return Object.keys(o).length > 1;'])
  assert.deepEqual(await freedom(observation,{keyOrder}),{writes:'free',observation:'after-writes'},`${keyOrder} ${observation}`);
 assert.deepEqual(await freedom('return typeof Object === "function" && Object.keys(o).length;'),{writes:'free',observation:'after-writes'},'reading Object is no binding');
});

test('ADR-109: only where Object is the built-in; another enumeration in the program still orders',async()=>{
 const ordered={writes:'ordered',observation:'after-writes'};
 for(const prelude of [['const Object = {keys: x => [x]};'],['let Object = globalThis.Object;'],['Object = {keys: x => [x]};']])
  assert.deepEqual(await freedom('return Object.keys(o).length;',{prelude}),ordered,prelude[0]);
 assert.deepEqual(await freedom('return Object.keys(o).length + JSON.stringify(o).length;'),ordered,'stringify still observes');
 assert.deepEqual(await freedom('return Object.keys(o, 1).length;'),ordered,'not the one-argument listing');
 assert.deepEqual(await freedom('return Object.keys(...[o]).length;'),ordered,'a spread argument is a spread');
 const source='function f(o) {\n  const p = {};\n  p.a = 1;\n  p.b = 2;\n  return Object.keys(p).length;\n}\nfunction g(o) {\n  Object.keys = () => [];\n}';
 const draft=await catalog.createDraft({source,language:'javascript',keyOrder:'observed'});
 const lines=draft.model.lines.map(line=>line.code);[lines[2],lines[3]]=[lines[3],lines[2]];
 assert.equal(catalog.preview({draftId:draft.draftId,source,keyOrder:'observed',lines}).status,'rejected','a program that replaces Object.keys still enumerates');
});

test('ADR-109: TypeScript follows the same rule',async()=>{
 const source='function f(): number {\n  const o: Record<string, number> = {};\n  o.a = 1;\n  o.b = 2;\n  return Object.keys(o).length;\n}';
 const draft=await catalog.createDraft({source,language:'typescript',keyOrder:'observed'});
 const lines=draft.model.lines.map(line=>line.code);[lines[2],lines[3]]=[lines[3],lines[2]];
 assert.equal(catalog.preview({draftId:draft.draftId,source,language:'typescript',keyOrder:'observed',lines}).status,'accepted');
});

// Oracle-checked witnesses (author-analysis risk class): the fixed program runs, and every arrangement the rules
// accept must produce the reference's result; a swap that changes the result must stay rejected. The writes are
// constants, so only the key order is in question (reads of `data` are ordered by the input contract anyway).
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';
const probe='(() => { try { return JSON.stringify(evaluate({ a: 1, b: 2 })); } catch (error) { return "throws " + error.name; } })()';
const witness=(id,result)=>({id,origin:'adr-109',language:'javascript',keyOrder:'observed',probe,source:['function evaluate(data) {','  const o = {};','  o.a = 1;','  o.b = 2;',`  return ${result};`,'}']});
const swapWrites=fixture=>{const model=generate(fixture),order=model.lines.map(line=>line.id);[order[2],order[3]]=[order[3],order[2]];return createClassifier(fixture,model).classify(order).kind;};

test('ADR-109 oracle: the count witness accepts the swap and every accepted order runs alike',()=>{
 for(const result of ['Object.keys(o).length','Object.values(o).length','Object.entries(o).length']){
  const fixture=witness('adr109-'+result,result);
  assert.equal(swapWrites(fixture),'accepted',result);
  const row=measureFixture(fixture,CORPUS_CAPS);
  assert.deepEqual([row.unsound,row.undecidedAccepted,row.undecided,row.indeterminate,row.completenessGaps],[0,0,0,0,0],result);
 }
});

test('ADR-109 oracle: where the order shows in the result the swap is a justified rejection',()=>{
 for(const result of ['Object.keys(o)[0]','Object.keys(o).join()','JSON.stringify(o)']){
  const fixture=witness('adr109-neg-'+result,result);
  assert.equal(swapWrites(fixture),'justified',result);
  assert.equal(measureFixture(fixture,CORPUS_CAPS).unsound,0,result);
 }
});
