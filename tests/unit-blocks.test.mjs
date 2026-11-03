/** ADR-066 (v33): a multi-row statement or member with a hole (a continuation row in the
 * unit's own scope) is a block in the v2 projection when a block can represent it, so the
 * validator itself keeps siblings out of it and no source-side order is needed. A unit whose
 * boundary row is another block's boundary stays sealed (ADR-009). A refresh adopts the added
 * unit blocks; the verification gate never matches a model that lacks one. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {DEPENDENCY_POLICY,generateCodeLineExercise} from '../src/author/generator.mjs';
import {reconcileDependencies} from '../dist/author/dependency-refresh.js';
import {verifyAuthorModel} from '../dist/author/engine.js';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const call=['function run() {','  record(',"    'a',",'    1,','  );','  function helper() {','    return 2;','  }','  return helper();','}'];
const callFixture={id:'unit-block-call',origin:'units',language:'javascript',probe:'run()',source:call};
// The last row closes the callback too: no block can open and close there (ADR-009 stays).
const closing={id:'unit-block-closing',origin:'units',language:'javascript',probe:'run()',source:['function run() {','  record(',"    'a',",'    function () {','      return 1;','    });','  function helper() {','    return 2;','  }','  return helper();','}']};
const member={id:'unit-block-member',origin:'units',language:'typescript',probe:'run()',source:['class Box {','  items: number[] = [','    1,','    2,','  ];','  size(): number {','    return this.items.length;','  }','}','function run() {','  return new Box().size();','}']};

const code=(model,id)=>model.lines[id-1].code.trim();
const unitBlocks=model=>model.blocks.filter(block=>block.kind==='block'&&!/[{]$/.test(code(model,block.openLineId)));
/** The line IDs in source order with the rows `from..to` (1-based, inclusive) moved before row `at`. */
function move(model,from,to,at){const order=model.lines.map(line=>line.id),moved=order.splice(from-1,to-from+1);order.splice(order.indexOf(at),0,...moved);return order;}
function grade(model,order){const compiled=compileCodeLineExercise(model);assert.ok(!compiled.status,compiled.message);return validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:order.map(id=>model.lines[id-1].code)});}

test('the generation rule is v33 or later, v33 introduced by ADR-066 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=33,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v33` \| \[ADR-066\]/);
});

test('a multi-row call is a block: a hoisted function moves across it, never into it',()=>{
 const model=generate(callFixture);
 assert.deepEqual(unitBlocks(model).map(block=>[code(model,block.openLineId),code(model,block.closeLineId)]),[['record(',');']]);
 assert.ok(!model.authoring.provenance.some(entry=>entry.code==='sealed-unit'));
 assert.equal(model.lines[5].dependencies.join(),'1','`function helper() {` follows only the function opener');
 const across=move(model,6,8,2);
 assert.equal(grade(model,across).status,'accepted');
 assert.equal(createClassifier(callFixture,model).classify(across).kind,'accepted');
 assert.equal(grade(model,move(model,6,8,4)).status,'rejected','inside the call is structurally impossible');
 const row=measureFixture(callFixture,CORPUS_CAPS);
 assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0]);
});

test('a unit whose last row also closes a block stays sealed by source side',()=>{
 const model=generate(closing);
 assert.deepEqual(unitBlocks(model),[]);
 assert.ok(model.authoring.provenance.some(entry=>entry.code==='sealed-unit'));
 assert.equal(grade(model,move(model,7,9,2)).status,'rejected');
 const row=measureFixture(closing,CORPUS_CAPS);
 assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0]);
});

test('a multi-row field initializer is a block in the class body: a method moves before it',()=>{
 const model=generate(member);
 assert.deepEqual(unitBlocks(model).map(block=>code(model,block.openLineId)),['items: number[] = [']);
 const order=move(model,6,8,2);
 assert.equal(grade(model,order).status,'accepted');
 assert.equal(createClassifier(member,model).classify(order).kind,'accepted');
 const row=measureFixture(member,CORPUS_CAPS);
 assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0]);
});

/** The same model as a v32 projection would structure it: no unit block, its rows in the parent. */
function withoutUnitBlocks(model){
 const lowered=structuredClone(model),units=new Set(unitBlocks(model).map(block=>block.id)),parent=new Map(model.blocks.map(block=>[block.id,block.parentScopeId]));
 const up=scope=>{while(scope!==null&&units.has(scope))scope=parent.get(scope);return scope;};
 lowered.blocks=lowered.blocks.filter(block=>!units.has(block.id)).map(block=>({...block,id:'old-'+block.id,parentScopeId:block.parentScopeId===null?null:'old-'+up(block.parentScopeId)}));
 for(const line of lowered.lines){const scope=up(line.scopeId);line.scopeId=scope===null?null:'old-'+scope;}
 return lowered;
}

test('a refresh adopts the added unit block and keeps every original block ID',()=>{
 const generated=generate(callFixture),original=withoutUnitBlocks(generated);
 const refreshed=reconcileDependencies(original,generated);
 assert.deepEqual(refreshed.blocks.map(block=>block.id).sort(),['old-scope-1','old-scope-2','unit-1']);
 assert.deepEqual(refreshed.lines.slice(1,5).map(line=>line.scopeId),['old-scope-1','unit-1','unit-1','old-scope-1']);
 assert.equal(grade(refreshed,move(refreshed,6,8,2)).status,'accepted');
 // Any other structural change is still refused.
 const moved=structuredClone(original);moved.blocks[1].closeLineId=9;
 assert.throws(()=>reconcileDependencies(moved,generated),/eltérő sor-\/blokkstruktúrát/);
});

test('the verification gate does not match a model that lacks a unit block',async()=>{
 const ports={generate:input=>generateCodeLineExercise(input,ts)},generated=generate(callFixture);
 assert.equal((await verifyAuthorModel(generated,ports)).checks.rederivation,'match');
 assert.equal((await verifyAuthorModel(withoutUnitBlocks(generated),ports)).checks.rederivation,'differs');
});
