import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthorWorkspace,authorDraftPending,captureAuthorAdmission,captureAuthorRequest} from '../public/app/author-workspace.js';
import {reloadEditorFromArrangement,markEditorDraft} from '../public/app/interactions.js';
const first={id:'first',revision:1,title:'First',description:'First task',language:'javascript',lines:[{id:1,code:'const a = 1;'}]};
const second={...first,id:'second',title:'Second',language:'typescript',lines:[{id:1,code:'const b: number = 2;'}]};
const make=()=>({exercises:[first,second],active:null,previews:new Map(),view:'sort',author:{title:'unrelated',description:'',language:'javascript',source:'unrelated source',message:''},modelDraft:'',modelMessage:''});

test('reference workspace starts from the selected task and keeps drafts isolated by exercise/revision',()=>{
 const state=make(),workspace=createAuthorWorkspace(state);workspace.select(first);
 assert.equal(state.author.source,first.lines[0].code);assert.equal(authorDraftPending(state),false);
 state.author.source='unfinished first';state.modelDraft='{unfinished';assert.equal(authorDraftPending(state),true);
 workspace.select(second);assert.equal(state.author.source,second.lines[0].code);assert.equal(state.author.language,'typescript');assert.equal(state.modelDraft,'');assert.equal(state.authorModel,undefined);
 state.author.source='unfinished second';workspace.select(first);assert.equal(state.author.source,'unfinished first');assert.equal(state.modelDraft,'{unfinished');assert.equal(authorDraftPending(state),true);
 workspace.select({...first,revision:2});assert.equal(state.author.source,first.lines[0].code);assert.equal(authorDraftPending(state),false);
 workspace.select(second);assert.equal(state.author.source,'unfinished second');
});
test('admission establishes one shared reference baseline without regenerating edited JSON rules',()=>{
 const state=make(),workspace=createAuthorWorkspace(state);workspace.select(first);state.author.source='new source\n';workspace.save();
 const model={...first,id:'preview',schemaVersion:2,blocks:[],lines:first.lines.map(l=>({...l,dependencies:[],fixed:false,functionBlock:0,scopeId:null}))};
 state.exercises.unshift(model);state.active=model.id;state.authorModel=structuredClone(model);state.modelDraft=JSON.stringify(model);
 workspace.admit(model,'new source\n');assert.equal(authorDraftPending(state),false);assert.equal(state.author.source,'new source\n');assert.deepEqual(state.authorModel,model);
 workspace.select(second);workspace.select(model);assert.equal(state.author.source,'new source\n');assert.deepEqual(state.authorModel,model);
});
test('late source or JSON admission cannot replace newer edits or another task',()=>{
 for(const mutate of [s=>s.active='other',s=>s.author.source+='new',s=>s.author.title='new',s=>s.author.language='typescript',s=>s.modelDraft+='new']){
  const state=make();createAuthorWorkspace(state).select(first);const current=captureAuthorAdmission(state);assert.equal(current(),true);mutate(state);assert.equal(current(),false);
 }
});
test('author intent ordering begins before file I/O and invalidates earlier reads/responses and same-task roundtrips',()=>{
 const state=make(),workspace=createAuthorWorkspace(state);workspace.select(first);
 const oldFile=captureAuthorRequest(state),newFile=captureAuthorRequest(state);assert.equal(oldFile(),false);assert.equal(newFile(),true);
 workspace.select(second);workspace.select(first);assert.equal(newFile(),false);
 const read=captureAuthorRequest(state);state.author.source+='newer';assert.equal(read(),false);
 const request=captureAuthorRequest(state);workspace.admit({...first,schemaVersion:2,lines:[],blocks:[]});assert.equal(request(),false);
});
test('explicit solution reload discards only the editor draft, preserving arrangement, report and reference',()=>{
 const attempt={answer:[1,null,2],pool:[],draft:'',report:{status:'accepted'},feedback:'',generation:3};markEditorDraft(attempt,'unfinished');
 reloadEditorFromArrangement(attempt,['one','','two']);assert.equal(attempt.draft,'one\n\ntwo');assert.equal(attempt.editorDirty,false);assert.equal(attempt.editorGeneration,3);assert.deepEqual(attempt.answer,[1,null,2]);assert.equal(attempt.report.status,'accepted');
});
