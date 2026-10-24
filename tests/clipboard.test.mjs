import test from 'node:test';
import assert from 'node:assert/strict';
import {readClipboard,copyToClipboard} from '../public/app/clipboard.js';
test('clipboard reads plain text verbatim, including exact whitespace and markup',async()=>{
 const value='  <script>not executable</script>\n\t payload  ';assert.equal(await readClipboard({clipboard:{readText:async()=>value}}),value);
});
test('clipboard read denial gives actionable feedback',async()=>{
 await assert.rejects(readClipboard({clipboard:{readText:async()=>{throw Error('NotAllowedError');}}}),/Ctrl\+V/);
 await assert.rejects(readClipboard({clipboard:{}}),/Ctrl\+V/);
});
test('clipboard empty and oversized values are rejected before state changes',async()=>{
 await assert.rejects(readClipboard({clipboard:{readText:async()=>''}}),/üres/);
 await assert.rejects(readClipboard({limit:5,clipboard:{readText:async()=>'123456'}}),/hosszú/);
});
test('clipboard write forwards exact text through the secure API',async()=>{
 let got;assert.equal(await copyToClipboard('  exact ',{clipboard:{writeText:async x=>{got=x;}}}),true);assert.equal(got,'  exact ');
});
test('copy fallback removes its temporary element and restores focus',async()=>{
 const calls=[],doc={activeElement:{focus:()=>calls.push('focus')},createElement:()=>({style:{},select:()=>calls.push('select'),remove:()=>calls.push('remove')}),body:{appendChild:()=>calls.push('append')},execCommand:()=>true};
 assert.equal(await copyToClipboard('text',{clipboard:{writeText:async()=>{throw Error('denied');}},document:doc}),true);assert.deepEqual(calls,['append','select','remove','focus']);
});
test('unavailable copy mechanisms report failure without throwing',async()=>{
 assert.equal(await copyToClipboard('text',{clipboard:{},document:undefined}),false);
});

test('clipboard platform line endings normalize without changing literal row whitespace',async()=>{
 assert.equal(await readClipboard({clipboard:{readText:async()=>"  a  \r\n\tb\r\n"}}),'  a  \n\tb\n');
});
