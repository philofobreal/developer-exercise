/** ADR-120 (U3): one owner decides what each action can do now: enabled, or disabled with a reason that says what to do.
 *  Every rule both ways. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {availability,disabledAttributes} from '../public/app/availability.js';
import {admitAuthorModel} from '../public/app/author-workspace.js';

const exercise={id:'first',revision:1,title:'First',description:'',language:'javascript',lines:[{id:1,code:'const a = 1;'}]};
const model={...exercise,id:'author-preview',schemaVersion:2,blocks:[],lines:[{id:1,code:'const a = 1;',dependencies:[],fixed:false,functionBlock:0,scopeId:null}]};
const make=()=>({exercises:[exercise],active:'author-preview',previews:new Map([['author-preview','draft-1']]),mode:'author',view:'author',author:{title:'First',description:'',language:'javascript',source:'',message:''},modelDraft:'',modelMessage:''});
const state=answer=>answer.state;

test('Modell készítése: no source, an up-to-date model, a changed draft',()=>{
 const s=make();assert.match(availability(s,'author-apply').reason,/Nincs forrás/);
 s.author.source='const a = 1;';assert.equal(state(availability(s,'author-apply')),'enabled');
 admitAuthorModel(s,model);s.authorModel=model;assert.match(availability(s,'author-apply').reason,/naprakész/);
 s.author.source+='\nconst b = 2;';assert.equal(state(availability(s,'author-apply')),'enabled');
});

test('Forrás vizsgálata needs a source; Mentett munka megnyitása needs a save',()=>{
 const s=make();assert.equal(state(availability(s,'author-check')),'disabled');
 s.author.source='x';assert.equal(state(availability(s,'author-check')),'enabled');
 assert.match(availability(s,'load-local').reason,/nincs mentett munka/,'no storage (as here) reads as no save');
});

test('Újrakezdés needs a placed line',()=>{
 const s=make();assert.match(availability(s,'reset',{answer:[null,null]}).reason,/üres/);
 assert.equal(state(availability(s,'reset',{answer:[null,1]})),'enabled');
});

test('one draft at a time: the rule editor waits for an unapplied JSON or a changed source',()=>{
 const s=make();s.author.source='const a = 1;';admitAuthorModel(s,model);s.authorModel=model;s.modelDraft=JSON.stringify(model,null,2);
 assert.equal(state(availability(s,'rule-edit')),'enabled');
 s.modelDraft+=' ';assert.match(availability(s,'rule-edit').reason,/CodeLine JSON/);
 s.modelDraft=JSON.stringify(model,null,2);s.author.source+='\n// changed';assert.match(availability(s,'rule-edit').reason,/forrás vagy az elemzési beállítás/);
});

test('a disabled answer becomes focusable aria-disabled attributes with an escaped reason',()=>{
 assert.equal(disabledAttributes({state:'enabled'}),'');
 const attributes=disabledAttributes({state:'disabled',reason:'a < b "c"'});
 assert.match(attributes,/aria-disabled="true"/);assert.match(attributes,/data-disabled-reason="a &lt; b &quot;c&quot;"/);assert.doesNotMatch(attributes,/\sdisabled[\s>=]/);
});

test('ADR-170: where authoring is not served it is hidden, and the author mode cannot be entered',async()=>{
 const {enterMode}=await import('../public/app/flow.js');
 const s={...make(),mode:'practice',view:'sort',active:'first',practiceActive:'first',previews:new Map()};
 assert.equal(state(availability(s,'authoring')),'enabled');assert.equal(state(availability(s,'format-solution')),'enabled');
 s.authoring=false;
 assert.equal(state(availability(s,'authoring')),'hidden');assert.equal(state(availability(s,'format-solution')),'hidden');
 enterMode(s,'author');assert.equal(s.mode,'practice');assert.equal(s.view,'sort');
 s.authoring=true;enterMode(s,'author');assert.equal(s.mode,'author');
});
