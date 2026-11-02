/** ADR-050 (v26): the input contract. Under `valid` (valid plain-data inputs) a declaration or a
 * branch that only reads object state, converts, spreads or calls a listed built-in is a read unit:
 * it commutes with pure and other read units and keeps its order against everything that may
 * write. `any` (the default) is unchanged. Positive and negative witnesses, JS and TS, each checked
 * against the runtime oracle under the same contract. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {DEPENDENCY_POLICY,generateCodeLineExercise} from '../src/author/generator.mjs';
import {refreshAuthorModel,verifyAuthorModel} from '../dist/author/engine.js';
import {createReferenceAuditor} from '../dist/author/reference-audit.js';
import {auditReference} from '../src/author/audit.mjs';
import {corpus} from './fixtures/ordering-corpus.mjs';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const fixture=id=>corpus.get(id);
/** The same fixture without the contract (the default `any`). */
const strict=item=>{const {inputs,...rest}=item;return {...rest,id:item.id+'-any'};};
/** The reference order with the one-row unit `row` moved directly before the row `anchor`. */
function moveBefore(item,row,anchor){
 const model=generate(item),order=model.lines.map(line=>line.id),at=code=>order.findIndex(id=>model.lines[id-1].code.trim()===code);
 assert.ok(at(row)>=0&&at(anchor)>=0,row+' / '+anchor);
 const [moved]=order.splice(at(row),1);order.splice(at(anchor),0,moved);
 return createClassifier(item,model).classify(order);
}
const rejected=result=>['justified','gap','intent'].includes(result.kind);

test('the generation rule is v26, introduced by ADR-050 in the formal contract',async()=>{
 assert.equal(DEPENDENCY_POLICY,'scoped-effect-analysis-v26');
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v26` \| \[ADR-050\]/);
});

// The valid variants of the examples are pinned with the rest of the corpus (semantic-corpus.test.mjs).
test('every dedicated contract fixture is sound, decided and without a completeness gap',()=>{
 const contract=[...corpus.values()].filter(item=>item.origin==='contract'&&!item.id.endsWith('-valid'));
 assert.ok(contract.length>=6);
 for(const item of contract){
  const row=measureFixture(item,CORPUS_CAPS);
  assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate,row.completenessGaps],[0,0,0,0,0],item.id+' '+JSON.stringify(row.gapCauses));
 }
});

for(const [id,row,anchor,why] of [
 ['contract-grid-reads','const cols = grid[0].length;','const rows = grid.length;','two property reads of an input'],
 ['contract-grid-reads',"const key = start.join(',');",'const rows = grid.length;','a built-in method that neither calls back nor writes'],
 ['contract-grid-reads','const first = grid[start[0]][start[1]];','const cols = grid[0].length;','an element read with a read key'],
 ['contract-ts-destructure','const dy = second.y - by;','const dx = first.x + by;','reads of destructured names (TypeScript)'],
 ['contract-ts-this-reads','const limit = this.limit;','const count = this.items.length;','reads through this (TypeScript)'],
])test(`free under valid, kept under any: ${why}`,()=>{
 assert.equal(moveBefore(fixture(id),row,anchor).kind,'accepted');
 assert.ok(rejected(moveBefore(strict(fixture(id)),row,anchor)),'the default contract keeps the order');
});

test('kept under valid: a read keeps its order against a write it may observe, and the oracle sees the difference',()=>{
 const result=moveBefore(fixture('contract-read-write'),'const after = box.count;','box.count = before + 10;');
 assert.equal(result.kind,'justified',JSON.stringify(result));
 // A read the write cannot observe still keeps its order: the analysis does not compare object paths.
 assert.ok(rejected(moveBefore(fixture('contract-read-write'),'const size = box.items.length;','box.count = before + 10;')));
});

test('kept under valid: a read of a name the program defines as an accessor runs that accessor',()=>{
 const result=moveBefore(fixture('contract-program-getter'),'const b = counter.next * 10;','const a = counter.next;');
 assert.equal(result.kind,'justified',JSON.stringify(result));
 // A plain read keeps its order against the accessor too: the accessor's code may write what it reads.
 assert.equal(moveBefore(fixture('contract-program-getter'),'const s = shape.size;','const a = counter.next;').kind,'justified');
});

test('unavailable: a program that can change property access keeps the strict analysis and says so',()=>{
 const item=fixture('contract-proxy-fallback'),model=generate(item);
 assert.match(model.authoring.note,/érvényes bemenet szerződése nem alkalmazható/);
 assert.equal(model.authoring.evidence.environment.inputs,'valid','the requested contract is recorded');
 const result=moveBefore(item,'const y = point.y;','const x = point.x;');
 assert.equal(result.kind,'justified',JSON.stringify(result));
});

test('a method name the program defines is never taken for a built-in',()=>{
 const source=['class Path {','  join(separator) {',"    record('join');",'    return separator;','  }','}','function run(items, path) {','  const size = items.length;',"  const text = path.join('/');",'  return [size, text];','}'];
 const model=generateCodeLineExercise({source:source.join('\n'),inputs:'valid'},ts);
 const text=model.lines.find(line=>line.code.includes("path.join('/')")),size=model.lines.find(line=>line.code.includes('items.length'));
 assert.ok(model.authoring.provenance.some(entry=>entry.before===size.id&&entry.after===text.id&&entry.code==='effectful-or-unknown-initializer'));
});

test('destructured names are binding reads in every contract (v26)',()=>{
 const source=['function run(pair) {','  const [a, b] = pair;','  const left = a;','  const right = b;','  return [left, right];','}'];
 const model=generateCodeLineExercise({source:source.join('\n')},ts),row=code=>model.lines.find(line=>line.code.trim()===code).id;
 const right=model.lines.find(line=>line.id===row('const right = b;'));
 assert.ok(!right.dependencies.includes(row('const left = a;')),'the two reads commute');
 assert.ok(right.dependencies.includes(row('const [a, b] = pair;')),'each read follows the destructuring declaration');
});

test('the contract is part of the evidence, of the verification and of a refresh',async()=>{
 const source=['function measure(grid) {','  const rows = grid.length;','  const cols = grid[0].length;','  return rows * cols;','}'].join('\n');
 const strictModel=generateCodeLineExercise({source},ts),valid=generateCodeLineExercise({source,inputs:'valid'},ts);
 assert.equal(strictModel.authoring.evidence.environment.inputs,undefined,'the default records nothing new');
 assert.equal(valid.authoring.evidence.environment.inputs,'valid');
 assert.notDeepEqual(valid.lines.map(line=>line.dependencies),strictModel.lines.map(line=>line.dependencies));
 const libraryDir=path.dirname(ts.getDefaultLibFilePath({}));
 const auditor=createReferenceAuditor(ts,name=>{try{return readFileSync(path.join(libraryDir,name),'utf8');}catch{return undefined;}});
 const ports={generate:input=>generateCodeLineExercise(input,ts)},audit=auditor.audit(source,'javascript').semantics;
 assert.equal((await verifyAuthorModel(valid,ports,{audit})).checks.rederivation,'match');
 // Dropping the recorded contract makes the constraints a hand edit: they no longer re-derive.
 const environment={...valid.authoring.evidence.environment};delete environment.inputs;
 const forged={...valid,authoring:{...valid.authoring,evidence:{...valid.authoring.evidence,environment}}};
 assert.equal((await verifyAuthorModel(forged,ports,{audit})).checks.rederivation,'differs');
 const {model}=await refreshAuthorModel(valid,{...ports,audit:reference=>auditReference(reference,ts)});
 assert.deepEqual(model.lines.map(line=>line.dependencies),valid.lines.map(line=>line.dependencies));
 assert.equal(model.authoring.evidence.environment.inputs,'valid');
});

test('an unknown contract is refused',()=>{
 assert.throws(()=>generateCodeLineExercise({source:'const a = 1;',inputs:'trusted'},ts),/bemeneti szerződés/);
});
