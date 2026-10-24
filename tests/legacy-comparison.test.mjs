import test from 'node:test';
import assert from 'node:assert/strict';
import beautify from 'js-beautify';
import {formatForIDE} from '../public/formatter.js';
import {normalizeLine} from '../dist/normalize.js';
import {legacyIndentHints,ORIGINAL_BEAUTIFY_OPTIONS,LEGACY_SENTINEL} from '../public/formatting/legacy-beautifier.js';
test('real original Beautify options and marker algorithm remain supported',()=>{
 for(const rows of [['function f() {','return 1;','}'],['if (ok) {','go();','}'],['const f = () => {','return /}/;','};']]){
  const legacy=beautify.js(rows.map(x=>x.trim()+LEGACY_SENTINEL).join(''),ORIGINAL_BEAUTIFY_OPTIONS).split(LEGACY_SENTINEL).slice(0,-1);
  const hints=legacyIndentHints(rows,beautify.js);const actual=formatForIDE(rows,{beautify:beautify.js});
  assert.equal(actual.length,rows.length);assert.deepEqual(actual.map(x=>x.trimStart()),rows);
  if(hints)for(let i=0;i<rows.length;i++)if(hints[i]!==null)assert.equal(actual[i].match(/^ */)[0].length,legacy[i].replace(/^\n/,'').match(/^ */)[0].length);
 }
});
test('Beautify can override a lexically different valid prefix',()=>{
 const rows=['doSomething();'];const out=formatForIDE(rows,{beautify:()=>`          doSomething();${LEGACY_SENTINEL}\n`});
 assert.equal(out[0],'          doSomething();');
});
test('marker collisions, exceptions and multiline templates fall back without token changes',()=>{
 for(const fn of [()=>{throw Error('fail');},()=>'',()=>null])assert.deepEqual(formatForIDE(['function f() {','go();','}'],{beautify:fn}),['function f() {','     go();','}']);
 assert.equal(legacyIndentHints([LEGACY_SENTINEL],beautify.js),null);
 const rows=['const s = `','  payload','`;'];assert.equal(formatForIDE(rows,{beautify:beautify.js})[1],rows[1]);
});


test('live projection preserves non-ASCII leading whitespace under the validator normalization contract',()=>{
 for(const prefix of ['\u00a0','\u2003','\ufeff'])for(const options of [{language:'typescript'},{language:'javascript',beautify:null},{language:'javascript',beautify:beautify.js}]){
  const rows=['function f() {','\t  '+prefix+'const value = 1;   ','}'];
  const displayed=formatForIDE(rows,options);
  assert.deepEqual(displayed.map(line=>normalizeLine(line)),rows.map(line=>normalizeLine(line)));
 }
});
