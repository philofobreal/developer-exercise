import test from 'node:test';
import assert from 'node:assert/strict';
import beautify from 'js-beautify';
import {formatForIDE} from '../public/formatter.js';
import {normalizeLine} from '../dist/normalize.js';
test('ADR-112: the projection never takes Beautify hints; a Beautify passed in changes nothing',()=>{
 for(const rows of [['function f() {','return 1;','}'],['if (ok) {','go();','}'],['const f = () => {','return /}/;','};'],['function g() {','return {','a: 1','};','}']]){
  const plain=formatForIDE(rows);
  for(const fn of [beautify.js,()=>{throw Error('fail');},()=>'          everything shifted',()=>null])assert.deepEqual(formatForIDE(rows,{beautify:fn}),plain);
  assert.deepEqual(plain.map(x=>x.trimStart()),rows);
 }
 assert.deepEqual(formatForIDE(['function g() {','return {','a: 1','};','}']),['function g() {','     return {','          a: 1','     };','}'],'a returned object literal is indented');
});

test('live projection preserves non-ASCII leading whitespace under the validator normalization contract',()=>{
 for(const prefix of ['\u00a0','\u2003','\ufeff'])for(const options of [{language:'typescript'},{language:'javascript',beautify:null},{language:'javascript',beautify:beautify.js}]){
  const rows=['function f() {','\t  '+prefix+'const value = 1;   ','}'];
  const displayed=formatForIDE(rows,options);
  assert.deepEqual(displayed.map(line=>normalizeLine(line)),rows.map(line=>normalizeLine(line)));
 }
});
