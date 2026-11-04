/** ADR-079 (v45): a TypeScript overload group (signatures, then the implementation) is one block: the
 * implementation's function block opens at the first signature. A sibling may cross the group but not
 * enter it; the signatures keep their order (overload resolution reads it); the body follows the
 * implementation's header. An existing model without the anchoring refreshes to it, and the
 * verification gate compares the block structure, so an unanchored model never passes as analysed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {DEPENDENCY_POLICY,generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {refreshAuthorModel,verifyAuthorModel} from '../dist/author/engine.js';
import {createReferenceAuditor} from '../dist/author/reference-audit.js';
import {auditReference} from '../src/author/audit.mjs';
import {measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const source=['class Format {','  show(value: string): string;','  show(value: number): string;','  show(value: string | number): string {','    return String(value);','  }','  twice(value: string): string { return value + value; }','}','function evaluate(): string[] {','  const format = new Format();',"  return [format.show(1), format.twice('a')];",'}'];
const fixture={id:'adr079-overloads',origin:'adr-079',language:'typescript',probe:'evaluate()',source};
const model=generateCodeLineExercise({source:source.join('\n'),language:'typescript'},ts);
const compiled=compileCodeLineExercise(model).compiled;
const grade=order=>validateSubmission(compiled,{exerciseId:model.id,revision:model.revision,lines:order.map(row=>source[row-1])}).status;
const reference=source.map((_,i)=>i+1);
const ports={generate:input=>generateCodeLineExercise(input,ts)};
const libraryDir=path.dirname(ts.getDefaultLibFilePath({}));
const auditor=createReferenceAuditor(ts,name=>{try{return readFileSync(path.join(libraryDir,name),'utf8');}catch{return undefined;}});
/** The model as v44 projected it: the function block opens at the implementation, the signatures are
 * siblings, and the group is sealed against the sibling member. */
function unanchored(sealed){
 const old=structuredClone(model),block=old.blocks.find(b=>b.kind==='function'&&b.openLineId===2);
 block.openLineId=4;
 for(const id of [3,4])old.lines[id-1].scopeId=block.parentScopeId;
 // The signatures belong to the class body again, outside the function.
 for(const id of [2,3])old.lines[id-1].functionBlock=0;
 if(sealed){const line=old.lines[6];line.dependencies=[...new Set([...line.dependencies,6])].sort((a,b)=>a-b);}
 return old;
}

test('the generation rule is v45 or later, v45 introduced by ADR-079 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=45,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v45` \| \[ADR-079\]/);
});

test('the function block opens at the first signature',()=>{
 const block=model.blocks.find(b=>b.kind==='function'&&b.closeLineId===6);
 assert.equal(block.openLineId,2);
 assert.deepEqual([3,4,5].map(id=>model.lines[id-1].scopeId),[block.id,block.id,block.id]);
 assert.equal(model.authoring.evidence.projectionLoss.pairs,0);
});

test('a sibling member crosses the whole group, but never enters it',()=>{
 assert.equal(grade([1,7,2,3,4,5,6,8,9,10,11,12]),'accepted','the sibling before the group');
 for(const at of [2,3,4,5]){const order=reference.filter(row=>row!==7);order.splice(at,0,7);assert.equal(grade(order),'rejected','inside the group at '+at);}
});

test('the body follows the header; the signatures keep their order, which only TypeScript sees',()=>{
 assert.equal(grade([1,2,3,5,4,6,7,8,9,10,11,12]),'rejected','the body before the header');
 const swapped=[1,3,2,4,5,6,7,8,9,10,11,12];
 assert.equal(grade(swapped),'rejected');
 const result=createClassifier(fixture,model).classify(swapped);
 assert.deepEqual([result.kind,result.reason],['intent','type'],'overload resolution reads the order; the emitted JavaScript does not');
 const row=measureFixture(fixture,CORPUS_CAPS);
 assert.deepEqual([row.unsound,row.gaps.length],[0,0]);
});

test('an unanchored model refreshes to the anchored block and keeps its IDs',async()=>{
 const old=unanchored(true),before=old.blocks.map(b=>b.id);
 const {model:refreshed}=await refreshAuthorModel(old,{...ports,audit:reference=>auditReference(reference,ts)});
 assert.deepEqual(refreshed.blocks.map(b=>b.id),before);
 assert.equal(refreshed.blocks.find(b=>b.kind==='function'&&b.closeLineId===6).openLineId,2);
 assert.deepEqual(refreshed.lines.map(line=>line.dependencies),model.lines.map(line=>line.dependencies));
});

test('the gate compares the structure: the same rules without the anchoring are not a match',async()=>{
 const audit=auditor.audit(source.join('\n'),'typescript').semantics;
 assert.equal((await verifyAuthorModel(model,ports,{audit})).checks.rederivation,'match');
 // Without the anchoring a sibling may enter the group although no rule seals it any more.
 const open=unanchored(false);
 assert.ok(!compileCodeLineExercise(open).status);
 assert.equal((await verifyAuthorModel(open,ports,{audit})).checks.rederivation,'differs');
});
