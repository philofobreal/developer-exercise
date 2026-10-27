import test from 'node:test';
import assert from 'node:assert/strict';
import {authorDraftPending,captureAuthorAdmission,captureAuthorRequest,startFromExample,revertAuthorDraft,admitAuthorModel} from '../public/app/author-workspace.js';
import {reloadEditorFromArrangement,markEditorDraft} from '../public/app/interactions.js';
const first={id:'first',revision:1,title:'First',description:'First task',language:'javascript',lines:[{id:1,code:'const a = 1;'}]};
const second={...first,id:'second',title:'Second',language:'typescript',lines:[{id:1,code:'const b: number = 2;'}]};
const make=()=>({exercises:[first,second],active:null,previews:new Map(),mode:'author',view:'author',author:{title:'unrelated',description:'',language:'javascript',source:'unrelated source',message:''},modelDraft:'',modelMessage:''});
const modelOf=(exercise,id='author-preview')=>({...exercise,id,schemaVersion:2,blocks:[],lines:exercise.lines.map(l=>({...l,dependencies:[],fixed:false,functionBlock:0,scopeId:null}))});

test('ADR-022: one author project; an example is an unapplied starting point, never a second workspace',()=>{
 const state=make();startFromExample(state,first);
 assert.equal(state.author.source,first.lines[0].code);assert.equal(state.author.title,'First');
 assert.equal(authorDraftPending(state),false,'nothing was built yet, so nothing is stale');
 admitAuthorModel(state,modelOf(first));assert.equal(authorDraftPending(state),false);
 startFromExample(state,second);assert.equal(state.author.language,'typescript');assert.equal(authorDraftPending(state),true,'the applied model no longer matches the draft');
 revertAuthorDraft(state);assert.equal(state.author.source,first.lines[0].code);assert.equal(authorDraftPending(state),false);
});
test('admission establishes the reference baseline; a rule edit keeps an unapplied reference draft',()=>{
 const state=make(),model=modelOf(first);admitAuthorModel(state,model,'new source\n');
 assert.equal(state.author.source,'new source\n');assert.equal(authorDraftPending(state),false);
 state.author.source='unapplied';admitAuthorModel(state,model,undefined,{keepPending:true});
 assert.equal(state.author.source,'unapplied');assert.equal(authorDraftPending(state),true);
 admitAuthorModel(state,model);assert.equal(state.author.source,first.lines[0].code,'a new model replaces the draft');
});
test('late source or JSON admission cannot replace newer edits or another preview',()=>{
 for(const mutate of [s=>s.previews.set('other','d'),s=>s.author.source+='new',s=>s.author.title='new',s=>s.author.language='typescript',s=>{s.author.importEmit='elide-unused';},s=>s.modelDraft+='new']){
  const state=make();startFromExample(state,first);const current=captureAuthorAdmission(state);assert.equal(current(),true);mutate(state);assert.equal(current(),false);
 }
 const state=make();const current=captureAuthorAdmission(state);state.mode='practice';state.active='first';state.view='sort';
 assert.equal(current(),true,'switching to practice does not cancel an author request');
});
test('author intent ordering begins before file I/O and invalidates earlier reads and responses',()=>{
 const state=make();startFromExample(state,first);
 const oldFile=captureAuthorRequest(state),newFile=captureAuthorRequest(state);assert.equal(oldFile(),false);assert.equal(newFile(),true);
 startFromExample(state,second);assert.equal(newFile(),false);
 const read=captureAuthorRequest(state);state.author.source+='newer';assert.equal(read(),false);
 const request=captureAuthorRequest(state);admitAuthorModel(state,modelOf(first));assert.equal(request(),false);
});
test('explicit solution reload discards only the editor draft, preserving arrangement, report and reference',()=>{
 const attempt={answer:[1,null,2],pool:[],draft:'',report:{status:'accepted'},feedback:'',generation:3};markEditorDraft(attempt,'unfinished');
 reloadEditorFromArrangement(attempt,['one','','two']);assert.equal(attempt.draft,'one\n\ntwo');assert.equal(attempt.editorDirty,false);assert.equal(attempt.editorGeneration,3);assert.deepEqual(attempt.answer,[1,null,2]);assert.equal(attempt.report.status,'accepted');
});
