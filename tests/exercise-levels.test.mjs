/** ADR-101: an exercise's optional difficulty level (beginner, intermediate, advanced), an author
 * decision; the practice list groups the reference exercises by it, unclassified ones last. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileCodeLineExercise} from '../dist/index.js';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {createFieldRenderer,practiceOrder} from '../public/app/fields.js';

// The approved classification (2026-11-05): 6 beginner, 7 intermediate, 3 advanced.
const LEVELS={beginner:['celsius-js','even-odd-js','grade-ts','greeting-js','rectangle-js','vowels-js'],intermediate:['class-inventory-ts','fib-memo-js','profiles-js','stack-ts','stats-js','stats-reduce-js','word-count-js'],advanced:['algo-bfs-js','algo-sort-search-js','class-accounts-ts']};
test('the schema takes the three levels and an absent one, and refuses any other value',async()=>{
 const model=JSON.parse(await readFile(new URL('../examples/celsius-js.json',import.meta.url),'utf8'));
 for(const level of ['beginner','intermediate','advanced'])assert.ok(!('status' in compileCodeLineExercise({...model,level})),level);
 const {level,...unclassified}=model;assert.equal(level,'beginner');assert.ok(!('status' in compileCodeLineExercise(unclassified)));
 assert.equal(compileCodeLineExercise({...model,level:'expert'}).status,'invalid_reference');
});
test('the catalog serves every example with its approved level',async()=>{
 const catalog=await ExerciseCatalog.open(new URL('../examples/',import.meta.url).pathname);
 const byLevel={beginner:[],intermediate:[],advanced:[]};
 for(const item of catalog.list())byLevel[item.level].push(item.id);
 assert.deepEqual(byLevel,LEVELS);
});
test('the practice list groups by level in order, catalog order within a group, unclassified last',()=>{
 const item=(id,level)=>({id,revision:1,language:'javascript',title:id,description:'',lines:[],...(level?{level}:{})});
 const html=createFieldRenderer([item('z-adv','advanced'),item('b-beg','beginner'),item('none'),item('a-beg','beginner'),item('m-mid','intermediate')],value=>String(value),'');
 const headings=[...html.matchAll(/<h3 class="side-title">([^<]+)</g)].map(match=>match[1]);
 assert.deepEqual(headings,['Kezdő','Közepes','Haladó','Egyéb feladatok']);
 const order=[...html.matchAll(/data-task="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(order,['b-beg','a-beg','m-mid','z-adv','none']);
});

test('the practice order puts the first beginner exercise first, so practice opens on it',()=>{
 const item=(id,level)=>({id,...(level?{level}:{})});
 assert.deepEqual(practiceOrder([item('adv','advanced'),item('none'),item('beg1','beginner'),item('mid','intermediate'),item('beg2','beginner')]).map(x=>x.id),['beg1','beg2','mid','adv','none']);
});
