import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttempt,createAttemptController} from '../public/app/attempt.js';
import {parseImport,exportSession,restoreAttempt} from '../public/app/persistence.js';
import {createFieldRegistry} from '../public/fields.js';
import {installPreview} from '../public/app/author-session.js';
const e={id:'trusted',revision:1,lines:[{id:1,code:'function f() {',fixed:true},{id:2,code:'return 1;',fixed:false},{id:3,code:'}',fixed:true}]};
test('attempt export/import retains identities, never imports a report',()=>{
 const a=createAttempt(e);a.report={accepted:true};const saved=exportSession(e,a);saved.attempt.report={accepted:true};assert.equal(restoreAttempt(saved,e).report,null);assert.deepEqual(restoreAttempt(saved,e).answer,a.answer);assert.equal(saved.authorModel,undefined);
});
test('attempt import rejects duplicate/foreign/missing IDs and moved anchors',()=>{
 for(const mutate of [s=>s.attempt.pool=[2,2],s=>s.attempt.pool=[99],s=>s.attempt.pool=[],s=>s.attempt.answer=[null,1,3],s=>s.version=999]){const s=exportSession(e,createAttempt(e));mutate(s);assert.throws(()=>restoreAttempt(s,e));}
 assert.throws(()=>parseImport('x'.repeat(1024*1024+1)));assert.throws(()=>parseImport('{'));
});
test('pinned editor modifications fail atomically',()=>{
 const a=createAttempt(e),c=createAttemptController(()=>e,()=>a),before=structuredClone(a);assert.equal(c.applyText('bad\nreturn 1;\n}').ok,false);assert.deepEqual(a,before);
});
test('registry can render a concrete additional hierarchical field type without renderer edits',()=>{
 const r=createFieldRegistry().register('section',(n,render)=>n.children.map(render).join('')).register('note',n=>`<p>${n.text}</p>`);
 assert.equal(r.render([{id:'root',type:'section',children:['leaf']},{id:'leaf',type:'note',text:'hello'}],'root'),'<p>hello</p>');
 assert.throws(()=>r.register('note',()=>''));assert.throws(()=>r.render([{id:'root',type:'section',children:['root']}],'root'));
});
test('preview lifecycle retains compatible attempt, clears report and isolates reference list',()=>{
 const a=createAttempt(e),state={exercises:[e],active:e.id,attempts:new Map([[e.id,a]]),previews:new Map()};a.report={accepted:true};
 const model={...e,id:'author-1'};const result=installPreview(state,{draftId:'d',model},{preserveAttempt:true});assert.equal(result.compatible,true);assert.equal(state.attempts.get(model.id),a);assert.equal(a.report,null);assert.equal(state.exercises.length,2);state.modelDraft='{invalid';assert.deepEqual(state.authorModel,model);
});
