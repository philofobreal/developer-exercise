import test from 'node:test';
import assert from 'node:assert/strict';
import {formatForIDE,deriveIndentation,ORIGINAL_BEAUTIFY_OPTIONS} from '../public/formatter.js';
const f=(input,language='javascript')=>formatForIDE(input,{language,beautify:null});
test('half-built function indents dynamically after each new drop',()=>{
  assert.deepEqual(f(['let sum = 0;','function f() {','for (let x of a) {','sum += x;', '}','return sum;', '}']),[
    'let sum = 0;','function f() {','     for (let x of a) {','          sum += x;','     }','     return sum;','}'
  ]);
});
test('TypeScript nested generic method and lambda: correct depth, no semantic edits',()=>{
  const inLines=['class X {','private mergeUnique<T extends { id: string }>(list: T[]): T[] {','return list.filter((item, index) => {','return item.id === String(index);','});','}','}'];
  const out=f(inLines,'typescript');
  assert.equal(out[1],'     '+inLines[1]);
  assert.equal(out[2],'          '+inLines[2]);
  assert.equal(out[3],'               '+inLines[3]);
  assert.equal(out[4],'          });');
  assert.equal(out[5],'     }');assert.equal(out[6],'}');
  assert.deepEqual(out.map(s=>s.trim()),inLines.map(s=>s.trim()));
});
test('multiple nested array/parentheses brackets are handled even if code is incomplete',()=>{
 const out=f(['function f() {','const data = merge(','[','...items,','other',' ]',');','}']);
 assert.equal(out[1],'     const data = merge(');
 assert.equal(out[2],'          [');
 assert.equal(out[3],'               ...items,');
 assert.equal(out[5],'          ]');
 assert.equal(out[6],'     );');
});
test('incorrectly ordered brace tokens reindent based on CURRENT sequence',()=>{
 const a=f(['}', 'function f() {', 'return 3;', '}']);
 assert.deepEqual(a,['}', 'function f() {','     return 3;', '}']);
});
test('literals and comments with braces do not change indent',()=>{
 const a=f(['function f() {', 'const msg = "{[()] }";', '// { fake', '/* { fake */', 'return msg;', '}']);
 assert.equal(a[4], '     return msg;');assert.equal(a[5],'}');
});
test('exact normalization never changes whitespace',()=>{
 const a=deriveIndentation([{code:'function f() {',normalization:'indent'},{code:'    template text',normalization:'exact'},{code:'}',normalization:'indent'}]);
 assert.equal(a[1],'    template text');
});
test('legacy callback may only alter leading whitespace, never token identity',()=>{
 const original=['function f() {','return 1;','}'];
 const bogus=()=> 'function f() {\n   HELLO WORLD\n}';
 assert.deepEqual(formatForIDE(original,{beautify:bogus}),f(original));
 assert.equal(ORIGINAL_BEAUTIFY_OPTIONS.indent_size,5);
});
