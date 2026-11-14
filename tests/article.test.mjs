/** NY-41 (ADR-148): the Hungarian article before a number or a piece of code, as it is read aloud. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {article,withArticle} from '../dist/index.js';
import {article as numberArticle} from '../public/app/ui-utilities.js';

test('a number is read as a Hungarian numeral',()=>{
 const az=[1,5,50,51,59,500,555,599,1000,1001,1999,5000,5999,50000,500000,1000000,1500000,5000000];
 const a=[0,2,3,4,6,7,8,9,10,11,15,19,20,25,40,49,60,99,100,101,105,150,199,200,499,600,999,2000,4999,6000,9999,10000,15000,100000,2000000];
 for(const n of az)assert.equal(article(n),'az',String(n));
 for(const n of a)assert.equal(article(n),'a',String(n));
 assert.equal(article(5,true),'Az');assert.equal(article(4,true),'A');assert.equal(withArticle(5),'az 5');assert.equal(withArticle(4,true),'A 4');
});

test('the presentation\'s own article for numbers reads every number the same way',()=>{
 // The module boundaries give the presentation its own copy for numbers (ADR-141); this keeps the two in step.
 for(let n=0;n<=12000;n++)assert.equal(numberArticle(n),article(n),String(n));
 for(const n of [49999,50000,59999,99999,100000,499999,500000,999999,1000000,1999999,2000000,5000000,10000000])assert.equal(numberArticle(n),article(n),String(n));
 assert.equal(numberArticle(5,true),article(5,true));
});

test('a row or a list of rows is read from its first number',()=>{
 for(const [text,want] of [['1. sor','az'],['4. sor','a'],['5. sor','az'],['15. sor','a'],['50. sor','az'],['1., 3. sor','az'],['2., 5. sor','a'],['1000. sor','az']])assert.equal(article(text),want,text);
});

test('code is read from its first sounded character',()=>{
 const az=['„if (x) {”','„else {”','„await load();”','„items.push(1);”','„object.key = 1;”','„a = 1;”','„x++;”','„n = 0;”','„s”','„f(1)”','„i”','„= 3”','„&& ok”','„_items = [];”','„$element.hide();”','„5 + 1”','„undefined”','„update();”','„ősök”','„Element”','„y = 2”','„ árvíztűrő”'];
 const a=['„const a = 1;”','„return x;”','„function f() {”','„}”','„});”','„{”','„(a + b)”','„[1, 2]”','„let i = 0;”','„b = 2;”','„k”','„z”','„4 + 1”','„10”','„;”','„!ok”','„...rest”','„// megjegyzés”','„use(x);”','„user.name”','„useState(0)”','„unit = 1”','„utils.x()”','„using r = f();”','„\'use strict\';”','„"szöveg"”','„_private”','„”',''];
 for(const text of az)assert.equal(article(text),'az',text);
 for(const text of a)assert.equal(article(text),'a',text);
 assert.equal(withArticle('„if (x) {”',true),'Az „if (x) {”');assert.equal(withArticle('„return x;”'),'a „return x;”');
});

test('no message of the core or of the author analysis writes the article as „a(z)” any more',async()=>{
 const {readFile,readdir}=await import('node:fs/promises');
 const files=[];
 for(const dir of ['src/core','src/author','src/author/preflight','src/workbench','src/server'])for(const name of await readdir(new URL('../'+dir+'/',import.meta.url)))if(/\.(ts|mjs)$/.test(name)&&name!=='schema-check.ts')files.push(dir+'/'+name);
 files.push('public/ui.js');
 const left=[];
 for(const file of files){const text=await readFile(new URL('../'+file,import.meta.url),'utf8');for(const match of text.matchAll(/[Aa]\(z\)\s+[„$#]/g))left.push(file+': '+text.slice(match.index,match.index+50).replace(/\n/g,' '));}
 assert.deepEqual(left,[]);
});
