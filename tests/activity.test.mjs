/** ADR-127 (P1): the progress indicator's timing, on a fake clock. Quick work shows nothing; shown work stays at least
 *  600 ms, then its line fills (350 ms) and it fades (250 ms); seconds count from 3 s; operations share one slot.
 *  ADR-132 (P2): the work may name its stage; after 10 s of waiting a registered way to stop is offered. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVITY_TIMING,createActivity,trackActivity} from '../public/app/activity.js';

function fakeClock(){
 let now=0,next=1;const timers=new Map();
 return {
  now:()=>now,set:(callback,ms)=>{const id=next++;timers.set(id,{at:now+ms,callback});return id;},clear:id=>{timers.delete(id);},
  /** Runs every timer due within `ms`, in time order, as a browser would. */
  advance(ms){const end=now+ms;for(;;){const due=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;timers.delete(due[0]);now=due[1].at;due[1].callback();}now=end;},
  pending:()=>timers.size,
 };
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
 const clock=fakeClock(),views=[];const activity=createActivity(clock,view=>views.push({...view,at:clock.now()}));
 return {clock,views,activity,phases:()=>views.map(view=>`${view.phase}@${view.at}`)};
}

test('the timing is the documented one',()=>{
 assert.deepEqual({...ACTIVITY_TIMING},{delay:400,minimum:600,settle:350,leave:250,countAfter:3000,abortAfter:10000});
});

test('work done within 400 ms shows nothing and leaves no timer behind',async()=>{
 const {clock,views,activity}=harness(),work=deferred();
 activity.track('Formázás',work.promise);clock.advance(399);work.resolve('ok');await settle();clock.advance(2000);
 assert.deepEqual(views,[]);assert.equal(clock.pending(),0);
});

test('shown work stays 600 ms even when it ends at once, then fills and fades',async()=>{
 const {clock,activity,phases,views}=harness(),work=deferred();
 activity.track('Modell készítése',work.promise);clock.advance(400);
 assert.deepEqual(views.at(-1),{phase:'running',label:'Modell készítése',at:400});
 clock.advance(50);work.resolve();await settle();clock.advance(2000);
 assert.deepEqual(phases(),['running@400','settling@1000','leaving@1350','hidden@1600']);assert.equal(clock.pending(),0);
});

test('long work ends with the wind-down right away, once the 600 ms are over',async()=>{
 const {clock,activity,phases}=harness(),work=deferred();
 activity.track('Ellenőrzés',work.promise);clock.advance(1500);work.resolve();await settle();clock.advance(1000);
 assert.deepEqual(phases(),['running@400','settling@1500','leaving@1850','hidden@2100']);
});

test('the seconds count from 3 s, once a second',async()=>{
 const {clock,activity,views}=harness(),work=deferred();
 activity.track('Modell készítése',work.promise);clock.advance(5500);
 assert.deepEqual(views.map(view=>[view.at,view.seconds]),[[400,undefined],[3000,3],[4000,4],[5000,5]]);
 work.resolve();await settle();clock.advance(1000);
});

test('a failed operation winds down the same way and its error reaches the caller',async()=>{
 const {clock,activity,phases}=harness(),work=deferred();
 const tracked=activity.track('JSON alkalmazása',work.promise);clock.advance(700);work.reject(Error('hibás JSON'));
 await assert.rejects(tracked,/hibás JSON/);clock.advance(1000);
 assert.deepEqual(phases(),['running@400','settling@1000','leaving@1350','hidden@1600']);
});

test('one slot: the latest operation is named, and the slot winds down after the last one',async()=>{
 const {clock,activity,views,phases}=harness(),first=deferred(),second=deferred(),button={};
 activity.track('Modell készítése',first.promise);clock.advance(500);
 activity.track('Szabály módosítása',second.promise,button);
 assert.equal(views.at(-1).label,'Szabály módosítása');assert.equal(views.at(-1).source,button);
 first.resolve();await settle();clock.advance(400);
 assert.equal(views.at(-1).phase,'running','still running for the second operation');
 second.resolve();await settle();clock.advance(1000);
 assert.deepEqual(phases().slice(-3),['settling@1000','leaving@1350','hidden@1600'],'the 600 ms count from the showing at 400 ms');
});

test('work that starts during the wind-down brings the indicator back without a second delay',async()=>{
 const {clock,activity,views}=harness(),first=deferred(),second=deferred();
 activity.track('Forrás vizsgálata',first.promise);clock.advance(1000);first.resolve();await settle();clock.advance(100);
 assert.equal(views.at(-1).phase,'settling');
 activity.track('Modell készítése',second.promise);
 assert.deepEqual(views.at(-1),{phase:'running',label:'Modell készítése',at:1100});
 second.resolve();await settle();clock.advance(1000);assert.equal(views.at(-1).phase,'hidden');
});

test('outside a page the work is returned untouched',async()=>{
 const work=Promise.resolve(7);assert.equal(trackActivity('x',work),work);assert.equal(await work,7);
});

test('a stage is shown after the name while the work runs, and cleared',async()=>{
 const {clock,activity,views}=harness(),work=deferred();
 activity.track('Modell készítése',work.promise);activity.detail('a TypeScript-fordító betöltése');
 assert.equal(views.length,0,'a stage before the 400 ms shows nothing yet');
 clock.advance(400);assert.equal(views.at(-1).detail,'a TypeScript-fordító betöltése');
 activity.detail();assert.equal(views.at(-1).detail,undefined);assert.equal(views.at(-1).phase,'running');
 activity.detail('x');activity.detail('x');assert.equal(views.filter(view=>view.detail==='x').length,1,'the same stage draws once');
 work.resolve();await settle();clock.advance(1000);
});

test('Megszakítás is offered exactly at 10 s of waiting, only when the page registered a way to stop',async()=>{
 const plain=harness(),plainWork=deferred();
 plain.activity.track('Modell készítése',plainWork.promise);plain.clock.advance(12_000);
 assert.ok(plain.views.every(view=>!view.abortable),'without a registered abort nothing is offered');
 plainWork.resolve();await settle();plain.clock.advance(1000);
 const {clock,activity,views}=harness(),work=deferred();let stopped=0;
 activity.abortWith(()=>{stopped++;});
 activity.track('Modell készítése',work.promise);clock.advance(9_999);
 assert.ok(views.every(view=>!view.abortable));
 clock.advance(1);assert.deepEqual([views.at(-1).abortable,views.at(-1).at],[true,10_000]);
 work.reject(Error('A műveletet megszakítottad.'));await settle();clock.advance(1000);
 assert.equal(views.at(-1).phase,'hidden');assert.equal(stopped,0,'the slot itself never calls it');
});

test('the 10 s count from the oldest waiting work, also when a newer operation is named',async()=>{
 const {clock,activity,views}=harness(),first=deferred(),second=deferred();
 activity.abortWith(()=>{});
 activity.track('Modell készítése',first.promise);clock.advance(9_000);
 activity.track('Szabály módosítása',second.promise);clock.advance(1_000);
 assert.deepEqual([views.at(-1).label,views.at(-1).abortable,views.at(-1).at],['Szabály módosítása',true,10_000]);
 first.resolve();second.resolve();await settle();clock.advance(1000);
});

test('registering the way to stop while the work already lasts 10 s offers it at once',async()=>{
 const {clock,activity,views}=harness(),work=deferred();
 activity.track('Ellenőrzés',work.promise);clock.advance(11_000);
 activity.abortWith(()=>{});assert.equal(views.at(-1).abortable,true);
 work.resolve();await settle();clock.advance(1000);
});
