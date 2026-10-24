import test from 'node:test';
import assert from 'node:assert/strict';
import {beautifier,formatEditor,formatForIDE,ORIGINAL_BEAUTIFY_OPTIONS} from '../public/formatter.js';
import {LEGACY_SENTINEL} from '../public/formatting/legacy-beautifier.js';

test('Legacy JS Beautify 5-space config is forwarded, sentinel is a private formatting hint',()=>{
 const original=globalThis.window;let requests=[];
 try{
  globalThis.window={js_beautify:(text,options)=>{requests.push({text,options});return text;}};
  assert.equal(beautifier(),globalThis.window.js_beautify);
  assert.equal(formatEditor('let a=1'), 'let a=1');
  const lines=['function f() {','return 1;','}'];
  assert.deepEqual(formatForIDE(lines), ['function f() {','     return 1;','}']);
  assert.equal(requests[0].options.indent_size,5);
  assert.equal(requests[1].text.includes(LEGACY_SENTINEL),true);
  assert.deepEqual(formatForIDE(lines).map(x=>x.trim()),lines.map(x=>x.trim()));
 }finally{globalThis.window=original;}
});
test('Unavailable beautifier does NOT disable live lexical indentation',()=>{
 const old=globalThis.window;
 try{globalThis.window={};assert.equal(beautifier(),null);assert.equal(formatEditor('let x  =3'),'let x  =3');
   assert.deepEqual(formatForIDE(['function f() {','return 4;','}']),['function f() {','     return 4;','}']);
 }finally{globalThis.window=old;}
});
test('Even a beautifier split/merge never changes token counts or inner contents',()=>{
 const old=globalThis.window;
 try{
   const lines=['const result = call(','[...items]',');'];
   globalThis.window={js_beautify:()=>['const result = call(', '[', '...items', ']', ');'].join('\n')};
   const formatted=formatForIDE(lines);
   assert.equal(formatted.length,lines.length);
   assert.deepEqual(formatted.map(x=>x.trim()),lines.map(x=>x.trim()));
   assert.equal(formatted[1],'     [...items]');
 }finally{globalThis.window=old;}
});
test('TypeScript live indent does not call JS Beautify; it still re-indents',()=>{
 const old=globalThis.window;let calls=0;
 try{
  globalThis.window={js_beautify:()=>{calls++;throw Error('TS into JS Beautify');}};
  const lines=['private mergeUnique<T extends { id: string }>(items: T[]): T[] {','return items.filter(x => x.id);','}'];
  assert.deepEqual(formatForIDE(lines,{language:'typescript'}),[lines[0],'     '+lines[1],lines[2]]);
  assert.equal(calls,0);
 }finally{globalThis.window=old;}
});
test('Beautifier output cannot mutate tokens even with a matching marker count',()=>{
 const original=globalThis.window;
 try{
  globalThis.window={js_beautify:()=>`   BAD CODE${LEGACY_SENTINEL}\n     OTHER CODE${LEGACY_SENTINEL}\n`};
  const lines=['function f() {','return 1;'];
  assert.deepEqual(formatForIDE(lines).map(x=>x.trim()),lines.map(x=>x.trim()));
 }finally{globalThis.window=original;}
});
