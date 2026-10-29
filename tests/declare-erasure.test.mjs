/** ADR-039 (v18): an ambient `declare` variable statement is erased by every TypeScript emit,
 * so a uniquely named, row-owning one is position-free like an interface; a destructuring or a
 * row-sharing one stays conservative. The oracle confirms soundness on a fixed fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {generateCodeLineExercise,DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';

const generate=source=>generateCodeLineExercise({source:source.join('\n'),language:'typescript'},ts);
const codes=model=>[...new Set(model.authoring.provenance.map(entry=>entry.code))].sort();
const free=(model,row)=>model.lines[row-1].dependencies.length===0&&!model.lines.some(line=>line.dependencies.includes(row));

test('the generation rule is v18 and the formal contract names it as the current label',async()=>{
 assert.equal(DEPENDENCY_POLICY,'scoped-effect-analysis-v18');
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/új generáláskor `scoped-effect-analysis-v18`/);
 assert.match(contract,/\| `scoped-effect-analysis-v18` \| \[ADR-039\]/);
});

test('declare const, let and var, several declarators and an exported one are position-free',()=>{
 for(const [label,source] of [
  ['const',['declare const d: number;','var v = 1;','var w = v + 1;']],
  ['let and var',['declare let l: number;','declare var x: string;','var v = 1;']],
  ['several declarators',['declare const a: number, b: string;','var v = 1;']],
  ['exported',['export declare const e: number;','export const v = 1;']],
 ]){
  const model=generate(source);
  assert.ok(!codes(model).includes('erased-declaration-shape'),label);
  for(const line of model.lines)if(/^(export )?declare /.test(line.code))assert.ok(free(model,line.id),label+': '+line.code);
 }
});

test('a multi-row declare with an object type owns its rows like an interface',()=>{
 const model=generate(['declare const d: {','  a: number;','};','var v = 1;']);
 assert.ok(!codes(model).includes('erased-declaration-shape'));
 assert.deepEqual(model.lines[3].dependencies,[],'the next statement does not follow the declaration');
 assert.deepEqual(model.lines[1].dependencies,[1],'the type literal stays one unit');
});

test('destructuring or row-sharing declares stay conservative',()=>{
 const destructured=generate(['declare const { x }: { x: number };','var v = 1;']);
 assert.ok(codes(destructured).includes('erased-declaration-shape'));
 assert.deepEqual(destructured.lines[1].dependencies,[1]);
 const shared=generate(['declare const d: {','  a: number;','}; var v = 1;','var w = 2;']);
 assert.ok(!free(shared,1),'a declaration that shares its closing row with code is not free');
});

test('oracle: every accepted arrangement of a fixture with ambient declarations behaves the same',()=>{
 const fixture={id:'declare-erasure',language:'typescript',probe:'evaluate()',source:[
  'declare const config: { debug: boolean };','declare let counter: number;','interface Box {','  size: number;','}',
  'function evaluate(): string[] {','  const box: Box = { size: 2 };','  return [typeof config, typeof counter, String(box.size)];','}']};
 const row=measureFixture(fixture,CORPUS_CAPS);
 assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0]);
 assert.equal(row.completenessGaps,0,'no equivalent neighbour is rejected: '+JSON.stringify(row.gaps));
 assert.ok(row.accepted>0,'the declarations move freely among the top-level rows');
});
