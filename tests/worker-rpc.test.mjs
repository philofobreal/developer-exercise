/** ADR-125 (NY-32): calls across the Local Demo's worker boundary. A call resolves with the operation's value; a thrown
 *  error crosses with its message and plain `details` (the author flow reads `error.details.gate`); an unknown operation
 *  fails; a worker that cannot start or dies fails every waiting and later call with one message instead of hanging. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {connect,serve} from '../public/app/worker-rpc.js';

/** Two connected ports, as a worker and its page have (Node's MessageChannel ports are EventTargets). */
function pair(){const {port1,port2}=new MessageChannel();port1.start();port2.start();return [port1,port2];}

test('a call resolves with the operation’s value, in order, with any arguments',async()=>{
 const [worker,page]=pair();
 serve(worker,{add:async(a,b)=>a+b,echo:value=>value});
 const call=connect(page,'nem indult el');
 assert.deepEqual(await Promise.all([call('add',2,3),call('echo',{lines:['a','b']}),call('add',1,1)]),[5,{lines:['a','b']},2]);
 worker.close();page.close();
});

test('a thrown error crosses with its message and details; an unknown operation fails',async()=>{
 const [worker,page]=pair();
 serve(worker,{refuse:()=>{throw Object.assign(Error('A modell nem készült el.'),{details:{gate:{verdict:'blocked'}}});},validationMode:'local-demo'});
 const call=connect(page,'nem indult el');
 await assert.rejects(call('refuse'),error=>error.message==='A modell nem készült el.'&&error.details.gate.verdict==='blocked');
 await assert.rejects(call('nincs'),/Ismeretlen művelet: nincs/);
 await assert.rejects(call('validationMode'),/Ismeretlen művelet/,'a non-function export is no operation');
 worker.close();page.close();
});

test('a worker that cannot start fails every waiting and later call with one message',async()=>{
 const [,page]=pair();
 const call=connect(page,'A Local Demo háttérszála nem indult el.');
 const waiting=call('getExercises');
 page.dispatchEvent(new Event('error'));
 await assert.rejects(waiting,/háttérszála nem indult el/);
 await assert.rejects(call('compileDraft',{}),/háttérszála nem indult el/);
 page.close();
});

test('the model JSON is serialized once per model object; a learner-data change makes a new model',async()=>{
 const {modelJson,setLearnerData}=await import('../public/app/author-workspace.js');
 const {jsonPending}=await import('../public/app/flow.js');
 const model={id:'author-preview',revision:1,schemaVersion:2,title:'T',description:'',language:'javascript',blocks:[],lines:[{id:1,code:'const a = 1;',dependencies:[],fixed:false,functionBlock:0,scopeId:null}]};
 assert.equal(modelJson(model),JSON.stringify(model,null,2));assert.equal(modelJson(model),modelJson(model));
 const state={exercises:[{...model}],active:'author-preview',previews:new Map([['author-preview','d']]),mode:'author',view:'model',author:{title:'T',description:'',language:'javascript',source:'const a = 1;',message:''},authorModel:model,modelDraft:JSON.stringify(model,null,2),modelMessage:''};
 assert.equal(jsonPending(state),false);
 setLearnerData(state,'title','Új');
 assert.notEqual(state.authorModel,model,'a new model object');assert.equal(model.title,'T','the old one is untouched');
 assert.equal(jsonPending(state),false,'the applied JSON follows');assert.equal(JSON.parse(state.modelDraft).title,'Új');
 state.modelDraft+=' ';assert.equal(jsonPending(state),true);
});
