/** ADR-112: one projection draws the author's board and the learner's sorter. In the reference order it shows the
 *  formatted source exactly (nesting from the arrangement plus each row's own continuation indent); in any other
 *  order the nesting follows the arrangement, never the reference. The old Beautify override is gone: it put the
 *  properties of a returned object literal at column 0. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readdirSync,readFileSync} from 'node:fs';
import {formatForIDE,referenceLayout} from '../public/formatter.js';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {getLanguageAdapter} from '../src/author/languages.mjs';

const project=lines=>{const {indentSize,offsets}=referenceLayout(lines);return formatForIDE(lines.map((line,i)=>({code:line.code,normalization:line.normalization??'indent',offset:offsets[i]})),{indentSize});};
const model=(raw,language='javascript')=>{const source=getLanguageAdapter(language).format(raw,ts).code;return {source,model:generateCodeLineExercise({source,language},ts)};};

test('the reported case: declaration continuation and a returned object literal show as in the source',()=>{
 const {source,model:m}=model('function summarize(n) {\nlet r = 0,\nt = Infinity,\ni = -Infinity;\nfor (const u of n) r = r + u, t = u < t ? u : t, i = u > i ? u : i;\nconst u = n.length;\nreturn {\ncount: u,\nmean: r / u,\nrange: i - t\n}\n}');
 assert.deepEqual(project(m.lines),source.trimEnd().split('\n'));
 assert.deepEqual(project(m.lines).slice(1,4),['     let r = 0,','          t = Infinity,','          i = -Infinity;']);
 assert.deepEqual(project(m.lines).slice(7,10).map(line=>/^ */.exec(line)[0].length),[10,10,10],'the properties are not at column 0');
});

test('every shipped TypeScript sample model: the reference order projects to its own rows, in its own indent unit',()=>{
 const dir=new URL('../public/samples/typescript/',import.meta.url);
 for(const name of readdirSync(dir).filter(file=>file.endsWith('.model.json'))){
  const m=JSON.parse(readFileSync(new URL(name,dir),'utf8'));
  if(!m.lines.some(line=>/^ /.test(line.code)))continue;
  assert.deepEqual(project(m.lines),m.lines.map(line=>line.code.trimEnd()),name);
 }
});

test('another arrangement: nesting follows the rows, the continuation stays the row’s own',()=>{
 const {model:m}=model('function f() {\nlet r = 0,\nt = 1;\nif (r) {\nreturn t;\n}\n}');
 const {indentSize,offsets}=referenceLayout(m.lines);
 assert.equal(indentSize,5);assert.deepEqual(offsets,[0,0,1,0,0,0,0]);
 // `t = 1;` moved into the if block: one level deeper from the arrangement, plus its own continuation.
 const order=[0,1,3,2,4,5,6].map(i=>({code:m.lines[i].code,offset:offsets[i]}));
 assert.equal(formatForIDE(order)[3],'               t = 1;');
});
