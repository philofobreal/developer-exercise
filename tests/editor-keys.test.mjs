/** ADR-121 (M4): the code editor's keys as a pure function: Tab/Shift+Tab on lines, Enter keeps the indentation (and adds
 *  a unit after an opening bracket), a closing brace on an indentation-only line steps back. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {editorKey} from '../public/app/ui-utilities.js';

const apply=(value,start,end,key,shift=false,unit=5)=>{
 const change=editorKey(value,start,end,key,shift,unit);if(!change)return null;
 return {value:value.slice(0,change.from)+change.text+value.slice(change.to),start:change.start,end:change.end};
};

test('Enter keeps the line indentation and adds a unit after an opening bracket',()=>{
 const value='function f() {';assert.deepEqual(apply(value,value.length,value.length,'Enter'),{value:'function f() {\n     ',start:20,end:20});
 const inner='     return 1;';assert.equal(apply(inner,inner.length,inner.length,'Enter').value,'     return 1;\n     ');
 assert.equal(apply('const a = [',11,11,'Enter',false,2).value,'const a = [\n  ','the JSON unit is 2');
 assert.equal(apply('x',1,1,'Enter',true),null,'Shift+Enter is the browser\'s');
});

test('a closing brace on an indentation-only line steps back one unit; elsewhere it is typed as is',()=>{
 const value='if (a) {\n          ';assert.equal(apply(value,value.length,value.length,'}').value,'if (a) {\n     }');
 assert.equal(apply('x = {',5,5,'}'),null);
});

test('Tab inserts a unit at the caret; with a selection Tab and Shift+Tab indent or outdent whole lines',()=>{
 assert.equal(apply('ab',1,1,'Tab').value,'a     b');
 const lines='a\nb\nc',indented=apply(lines,0,3,'Tab');assert.equal(indented.value,'     a\n     b\nc');
 assert.equal(apply(indented.value,0,indented.end,'Tab',true).value,'a\nb\nc');
 assert.equal(apply('  a',0,0,'Tab',true).value,'a','Shift+Tab removes at most one unit, even a partial one');
});

test('other keys are left to the browser',()=>{for(const key of ['a','Backspace','ArrowUp'])assert.equal(editorKey('x',0,0,key,false,5),null);});
