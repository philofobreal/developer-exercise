// The stylesheet as a text: what a unit test can tell before a browser opens it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sheet=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
// comments and strings may hold braces and sizes that are not rules
const rules=sheet.replace(/\/\*[\s\S]*?\*\//g,'').replace(/'[^'\n]*'|"[^"\n]*"/g,"''");

test('every block of the stylesheet is closed (one open @media swallowed the rest of the sheet, ADR-143 D4b)',()=>{
 let depth=0,deepest=0;
 for(const character of rules){
  if(character==='{')deepest=Math.max(deepest,++depth);
  if(character==='}')assert.ok(--depth>=0,'a block is closed that was not opened');
 }
 assert.equal(depth,0,'a block is left open');
 assert.ok(deepest<=4,`blocks nest ${deepest} deep: an unclosed block before a rule looks like this`);
});

test('nothing to read is set under 12 px (ADR-143 D4b)',()=>{
 const small=[...rules.matchAll(/font(?:-size)?:[^;}]*?\b(\d+(?:\.\d+)?)px/g)].filter(([,size])=>Number(size)<12).map(([text])=>text);
 assert.deepEqual(small,[]);
});

test('code has one size: the --code-fs token, 13 px and 12 px on a narrow screen (ADR-143 D4b)',()=>{
 assert.match(rules,/--code-fs:13px\}/);
 assert.match(rules,/@media\(max-width:650px\) \{:root \{--code-fs:12px\}\}/);
 for(const selector of ['#app .code-text','.editor-frame textarea','.editor-gutter','.editor-highlight','.help-code','.rule-code']){
  const body=rules.match(new RegExp(selector.replace(/[.#]/g,'\\$&')+' \\{([^}]*)\\}'))?.[1]??'';
  assert.match(body,/font:var\(--code-fs\)\//,`${selector} takes the code's size from the token`);
 }
});
