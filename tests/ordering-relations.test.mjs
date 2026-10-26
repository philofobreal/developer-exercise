/** ADR-011: the language-independent ordering contract between a language
 * adapter and the CodeLine v2 projection. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {combineOrderingRelations,sealMultiRowUnits,reduceGeneratedDependencies} from '../dist/author/ordering-relations.js';
import {statementOrdering} from '../dist/author/statement-ordering.js';
import {typeMemberOrdering} from '../dist/author/type-member-ordering.js';
import {registerLanguageAdapter} from '../src/author/languages.mjs';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {corpus} from './fixtures/ordering-corpus.mjs';

test('combination is a conjunction: predecessor sets, protected inputs and spans are unions',()=>{
 const combined=combineOrderingRelations([
  {entries:[{row:3,after:[1]}],protectedInputs:new Map([[3,new Set([1])]]),spans:[{first:1,last:2}],note:'a'},
  {entries:[{row:3,after:[2]},{row:5,after:[4]}],protectedInputs:new Map([[3,new Set([0])]]),spans:[{first:4,last:4}],note:''},
  {entries:[],protectedInputs:new Map(),spans:[],note:'b'}]);
 assert.deepEqual(combined.entries,[{row:3,after:[1,2]},{row:5,after:[4]}]);
 assert.deepEqual([...combined.protectedInputs.get(3)].sort(),[0,1]);
 assert.deepEqual(combined.spans,[{first:1,last:2},{first:4,last:4}]);
 assert.equal(combined.note,'a b');
});

test('sealing keeps same-scope siblings out of a unit with an interior hole, not out of a retained block',()=>{
 // Lines 2–4: a continued statement (no block); lines 5–7: a unit whose interior is a retained block.
 const lines=[1,2,3,4,5,6,7,8].map(id=>({id,scopeId:[6].includes(id)?'inner':'outer',dependencies:[]}));
 sealMultiRowUnits(lines,[{first:2,last:4},{first:5,last:7},{first:8,last:8},{first:1,last:1}],new Map([[5,'inner']]));
 assert.deepEqual(lines.map(line=>line.dependencies),[[],[1],[],[],[4],[],[],[4]]);
});

test('reduction drops only implied synthetic edges and keeps protected value inputs',()=>{
 const lines=[{id:1,dependencies:[]},{id:2,dependencies:[1]},{id:3,dependencies:[1,2]},{id:4,dependencies:[1,3]}];
 reduceGeneratedDependencies(lines,new Map([[4,new Set([1])]]));
 assert.deepEqual(lines.map(line=>line.dependencies),[[],[1],[2],[1,3]]);
});

test('JS/TS statement and member analyses constrain disjoint rows on the whole corpus',()=>{
 for(const fixture of corpus.values()){
  const file=ts.createSourceFile('x.'+(fixture.language==='typescript'?'ts':'js'),fixture.source.join('\n'),ts.ScriptTarget.Latest,true,fixture.language==='typescript'?ts.ScriptKind.TS:ts.ScriptKind.JS);
  const statementRows=new Set(statementOrdering(file,ts).entries.map(entry=>entry.row));
  for(const entry of typeMemberOrdering(file,ts).entries)assert.ok(!statementRows.has(entry.row),`${fixture.id}: row ${entry.row}`);
 }
});

test('the projection is language-independent: a non-TypeScript adapter supplies relations only',()=>{
 // A toy line language: `{`/`}` delimit blocks, `@k` lines are free among themselves.
 registerLanguageAdapter('wp7-line-language',{
  parse:source=>source.split('\n'),format:source=>source,tokenize:rows=>rows.map(text=>({kind:0,text})),
  whitespace:()=>new Set(),
  structure:rows=>{const out=[],open=[];rows.forEach((row,i)=>{if(row.trim().endsWith('{'))open.push(i);if(row.trim()==='}')out.push({start:open.pop(),end:i,kind:'block'});});return out;},
  orderingRelations:rows=>{
   const free=new Set(rows.flatMap((row,i)=>row.includes('@')?[i]:[])),entries=[];let previous=0;
   rows.forEach((row,i)=>{if(!i)return;if(free.has(i))entries.push({row:i,after:[0]});else{entries.push({row:i,after:[previous,...[...free].filter(f=>f<i)]});previous=i;}});
   return {entries,protectedInputs:new Map(),spans:rows.map((_,i)=>({first:i,last:i})),note:'toy'};
  }
 });
 const model=generateCodeLineExercise({source:'begin {\n  @a\n  @b\n  end\n}',language:'wp7-line-language'},null);
 assert.equal(model.authoring.note,'toy');assert.equal(model.blocks.length,1);
 assert.deepEqual(model.lines.map(line=>line.dependencies),[[],[1],[1],[2,3],[4]]);
 // The v2 schema names only JS/TS (other languages use IR v3); the validator itself never looks at the label.
 const compiled=compileCodeLineExercise({...model,language:'javascript'});assert.ok(!compiled.status,compiled.message);
 const grade=order=>validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:order.map(id=>model.lines[id-1].code)}).status;
 assert.equal(grade([1,3,2,4,5]),'accepted');
 assert.equal(grade([1,4,2,3,5]),'rejected');
});
