import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttempt,createAttemptController,insertBetweenSlots} from '../public/app/attempt.js';
const mk=(n,fixed=[])=>({language:'javascript',lines:Array.from({length:n},(_,i)=>({id:i+1,code:`const v${i} = ${i};`,fixed:fixed.includes(i),normalization:'indent'}))});
const setup=(n,fixed=[])=>{const e=mk(n,fixed),a=createAttempt(e),c=createAttemptController(()=>e,()=>a);return {e,a,c};};
test('Empty target: insertion at requested boundary leaves leading empty slots',()=>{
 const {a,c}=setup(5);
 assert.equal(c.insertFromPool(0,4),true);
 assert.deepEqual(a.answer,[null,null,null,null,1]);
 assert.deepEqual(a.pool,[2,3,4,5]);
});
test('Inserting from pool shifts neighbors, NEVER replaces a destination token',()=>{
 const {a,c}=setup(4);a.answer=[1,2,null,4];a.pool=[3];
 assert.equal(c.insertFromPool(0,1),true);
 assert.deepEqual(a.answer,[1,3,2,4]);assert.deepEqual(a.pool,[]);
});
test('Insertion uses nearest left gap when there is no free right slot',()=>{
 const {a,c}=setup(4);a.answer=[null,1,2,3];a.pool=[4];
 assert.equal(c.insertFromPool(0,3),true);
 assert.deepEqual(a.answer,[1,2,4,3]);
});
test('Moving a full row down/up shifts intervening neighbors rather than swapping endpoints',()=>{
 const {a,c}=setup(4);a.answer=[1,2,3,4];a.pool=[];
 assert.equal(c.moveInAnswer(0,3),true);
 assert.deepEqual(a.answer,[2,3,1,4]);
 assert.equal(c.moveInAnswer(3,1),true);
 assert.deepEqual(a.answer,[2,4,3,1]);
});
test('Top/bottom midpoint controls before/after target: moving down goes AFTER row',()=>{
 const {a,c}=setup(3);a.answer=[1,2,3];a.pool=[];
 assert.equal(c.moveInAnswer(1,3),true);
 assert.deepEqual(a.answer,[1,3,2]);
 assert.equal(c.moveInAnswer(2,0),true);
 assert.deepEqual(a.answer,[2,1,3]);
});
test('Fixed slots never shift when inserting/moving across them',()=>{
 const {a,c}=setup(6,[0,3,5]);
 assert.deepEqual(a.answer,[1,null,null,4,null,6]);
 for(const target of [3,1,4])assert.equal(c.insertFromPool(0,target),true);
 assert.deepEqual([a.answer[0],a.answer[3],a.answer[5]],[1,4,6]);
 assert.equal(c.moveInAnswer(1,5),true);
 assert.deepEqual([a.answer[0],a.answer[3],a.answer[5]],[1,4,6]);
 assert.equal(c.moveInAnswer(3,0),false);
});
test('Failed insertion is atomic: pool and answer are unchanged',()=>{
 const {a,c}=setup(3,[0]);a.answer=[1,2,3];a.pool=[99];
 const before=a.answer.slice(),pool=a.pool.slice();
 assert.equal(c.insertFromPool(0,2),false);
 assert.deepEqual(a.answer,before);assert.deepEqual(a.pool,pool);
});
test('Randomized moves preserve unique movable IDs and fixed anchors',()=>{
 const {a,c}=setup(12,[0,4,11]);
 for(let n=0;n<200;n++){
   const sourceIndex=a.pool.length?((n*7)%a.pool.length):-1;
   const boundary=(n*13)%13;
   if(sourceIndex>=0)c.insertFromPool(sourceIndex,boundary);
   else c.moveInAnswer([1,2,3,5,6,7,8,9,10][n%9],boundary);
   const ids=[...a.answer.filter(x=>x!==null),...a.pool].sort((x,y)=>x-y);
   assert.deepEqual(ids,Array.from({length:12},(_,i)=>i+1));
   assert.equal(a.answer[0],1);assert.equal(a.answer[4],5);assert.equal(a.answer[11],12);
 }
});
test('String and token identity remain untouched by insertion; formatting stays separate',()=>{
 const ex={language:'javascript',lines:['function f() {','let a = 2;','return a;','}'].map((code,i)=>({id:i+1,code,normalization:'indent',fixed:false}))};
 const at=createAttempt(ex),c=createAttemptController(()=>ex,()=>at);
 for(let i=0;i<4;i++)assert.equal(c.insertFromPool(0,i),true);
 assert.equal(c.moveInAnswer(0,2),true);
 assert.deepEqual(c.formattedAnswer().map(x=>x.trim()),['let a = 2;','function f() {','return a;','}']);
});

// ADR-155 (T1.3): the boundary a pointer means among the rows of a list, by the midpoint rule (ADR-095), found by a
// binary search over the rows' middles. The definition it must equal: the first row whose middle is below the pointer.
test('the boundary at a pointer: the first row whose middle is below it, the number of rows when none is',async()=>{
 const {boundaryAt}=await import('../public/app/drag-insert.js');
 const first=(middles,y)=>{const index=middles.findIndex(middle=>y<middle);return index<0?middles.length:index;};
 assert.equal(boundaryAt([],50),0,'an empty list has one boundary');
 const rows=[19,61,103,145];
 assert.deepEqual([0,18.9,19,19.1,60.9,61,102,103,144.9,145,1000].map(y=>boundaryAt(rows,y)),[0,0,1,1,1,2,2,3,3,4,4],'exactly on a middle is below it, as before');
 assert.equal(boundaryAt(rows,-5),0);
 // every boundary of lists of many sizes and uneven row heights, at, beside and between every middle
 let seed=42;const random=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
 for(const count of [1,2,3,7,8,9,64,482]){
  let top=8;const middles=Array.from({length:count},()=>{const height=30+Math.floor(random()*40),middle=top+height/2;top+=height+6;return middle;});
  const points=[-10,top+10,...middles.flatMap(middle=>[middle-.5,middle,middle+.5]),...Array.from({length:200},()=>random()*(top+20)-10)];
  for(const y of points)assert.equal(boundaryAt(middles,y),first(middles,y),`${count} rows, y=${y}`);
 }
});
