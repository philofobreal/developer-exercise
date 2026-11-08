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
