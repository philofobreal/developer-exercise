import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveIndentation} from '../public/formatting/lexical-indenter.js';
const run=body=>deriveIndentation(['function f() {',...body,'next();','}']);
for(const expression of ['/}/','/[{}\\/]/g','/\\}\\//','/[/}]/','a / b / c','call() / 2','({ x: 2 }) / 2','/}/.test(text)']){
 test(`lexical delimiters are masked: ${expression}`,()=>{
  const lines=run([`const re = ${expression};`]);
  assert.equal(lines[2],'     next();');assert.equal(lines[3],'}');
 });
}
test('reported regex regression retains function and conditional depth',()=>{
 assert.deepEqual(deriveIndentation(['function test() {','const re = /}/;','if (ok) {','run();','}','}']),['function test() {','     const re = /}/;','     if (ok) {','          run();','     }','}']);
});
test('regex after control parenthesis, return, block and arrow',()=>{
 for(const row of ['if (ok) /}/.test(s);','return /}/;','if (ok) {} /}/.test(s);','const f = () => /}/;'])assert.equal(run([row])[2],'     next();');
});
test('division after a call and postfix update cannot swallow a later block',()=>{
 assert.deepEqual(deriveIndentation(['function f() {','let x = call() / 2;','x++ / 2;','if (x) {','go();','}','}']).map(x=>x.length-x.trimStart().length),[0,5,5,5,10,5,0]);
});
test('nested templates and interpolation isolate raw braces and format expressions',()=>{
 const rows=['function f() {','const s = `raw } ${','(() => {','return `nested ${/}/.test(s)}`;','})()','} tail`;','next();','}'];
 const out=deriveIndentation(rows);assert.equal(out[6],'     next();');assert.equal(out[7],'}');
 assert.deepEqual(out.map(x=>x.trimStart()),rows.map(x=>x.trimStart()));
});
test('multiline raw template whitespace and exact rows remain byte identical',()=>{
 const rows=['function f() {','const s = `','  } raw  ','\t${value}','  end`;','next();','}'];
 const out=deriveIndentation(rows);for(const i of [2,3,4])assert.equal(out[i],rows[i]);
 assert.equal(out[5],'     next();');
 assert.equal(deriveIndentation([{code:'  x',normalization:'exact'}])[0],'  x');
});
test('comments, continuations, types and incomplete regex are tolerant',()=>{
 const rows=['function f<T>() {','/* }','still { */','const a: {','x: number','} = {','x: 1','};','call(','[','/unterminated }','value',']',');','}'];
 const out=deriveIndentation(rows);assert.equal(out.length,rows.length);assert.equal(out.at(-1),'}');
 assert.equal(out[4],'          x: number');assert.equal(out[11],'               value');
 assert.deepEqual(out.map(x=>x.trimStart()),rows.map(x=>x.trimStart()));
});
test('invalid row shapes and indentation options fail safely',()=>{
 assert.throws(()=>deriveIndentation(['a\nb']),TypeError);
 assert.throws(()=>deriveIndentation(['a'],{indentSize:-1}),RangeError);
});

test('keyword properties and function expression values retain division context',()=>{
 for(const row of ['const x = obj.if(ok) / 2; if (ok) {','const x = function () {} / 2; if (ok) {','const x = async function () {} / 2; if (ok) {']){
  const out=deriveIndentation(['function outer() {',row,'run();','}','}']);assert.equal(out[2],'          run();',row);assert.equal(out[4],'}');
 }
});
