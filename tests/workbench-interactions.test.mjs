import test from 'node:test';
import assert from 'node:assert/strict';
import {activateView,markEditorDraft,markEditorApplied,captureEditorRequest,adjacentMoveBoundary} from '../public/app/interactions.js';
const make=()=>({answer:[],pool:[],draft:'',report:null,feedback:'',generation:0});
test('draft survives view changes and arrangement changes until explicitly applied',()=>{
 const state={view:'sort'},attempt=make();activateView(state,attempt,['original'],'edit');assert.equal(attempt.draft,'original');markEditorDraft(attempt,'unfinished edit');activateView(state,attempt,['original'],'author');attempt.generation++;
 activateView(state,attempt,['new arrangement'],'edit');assert.equal(attempt.draft,'unfinished edit');assert.equal(attempt.editorDirty,true);assert.equal(attempt.editorGeneration,0);
 markEditorApplied(attempt);activateView(state,attempt,['new arrangement'],'edit');assert.equal(attempt.draft,'new arrangement');assert.equal(attempt.editorDirty,false);
});
test('invalid view name cannot change active presentation or discard a draft',()=>{
 const state={view:'sort'},attempt=make();markEditorDraft(attempt,'draft');activateView(state,attempt,['changed'],'unknown');assert.equal(state.view,'sort');assert.equal(attempt.draft,'draft');
});


test('late editor work is discarded after text, language, view, exercise, generation or owner changes',()=>{
 for(const change of [x=>x.editor.value='newer',x=>x.language='typescript',x=>x.state.view='sort',x=>x.state.active='other',x=>x.attempt.generation++,x=>x.activeAttempt=make(),x=>x.editor.isConnected=false]){
  const x={editor:{value:'source',isConnected:true},state:{active:'first',view:'author'},attempt:make(),language:'javascript'};x.activeAttempt=x.attempt;
  const current=captureEditorRequest(x.editor,x.state,x.attempt,()=>x.activeAttempt,()=>x.language);assert.equal(current(),true);change(x);assert.equal(current(),false);
 }
});


test('row buttons skip fixed slots without inventing a second insertion algorithm',()=>{
 const fixed=i=>i===2;
 assert.equal(adjacentMoveBoundary(1,1,5,fixed),4);assert.equal(adjacentMoveBoundary(3,-1,5,fixed),1);
 assert.equal(adjacentMoveBoundary(0,1,5,fixed),2);assert.equal(adjacentMoveBoundary(4,-1,5,fixed),3);
 assert.equal(adjacentMoveBoundary(0,-1,5,fixed),0);assert.equal(adjacentMoveBoundary(4,1,5,fixed),4);
 assert.equal(adjacentMoveBoundary(0,1,5,()=>true),0);
});
