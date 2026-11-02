/** ADR-055 (v29): the author decides per exercise whether the creation order of object keys is part
 * of the exercise. `observed` (default) is unchanged; `ignored` frees every line pair that only key
 * order ties, as deep equality in test frameworks and JSON objects treat key order. The oracle
 * implements the same policy independently: listings return a canonical order at run time. */
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
import {admitAuthorModel,authorRequest} from '../public/app/author-workspace.js';
import {createOracle} from './support/semantic-oracle.mjs';
import {measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';

const box=['class Box {','  constructor() {','    this.a = 1;','    this.b = 2;','  }','}'];
const listing=[...box,'function evaluate() {',"  const list = Object['ke' + 'ys'];",'  return list(new Box());','}'];
const swapped=source=>[1,2,4,3,...source.slice(4).map((_,i)=>i+5)].map(row=>source[row-1]);
function grade(source,keyOrder,lines){
 const model=generateCodeLineExercise({source:source.join('\n'),language:'javascript',...(keyOrder?{keyOrder}:{})},ts),compiled=compileCodeLineExercise(model);
 assert.ok(!compiled.status,compiled.message);
 return validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines}).status;
}
const fixture=(id,source,keyOrder)=>({id,origin:'witness',language:'javascript',probe:'evaluate()',source,...(keyOrder?{keyOrder}:{})});

test('the generation rule is v29 or later, v29 introduced by ADR-055 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=29,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v29` \| \[ADR-055\]/);
});

test('key writes of a listing program: ordered when key order counts, free when the author ignores it',()=>{
 assert.equal(grade(listing,undefined,swapped(listing)),'rejected');
 assert.equal(grade(listing,'ignored',swapped(listing)),'accepted');
 assert.equal(createOracle(fixture('listing',listing))(swapped(listing)).ok,false,'key order counts: the output differs');
 assert.equal(createOracle(fixture('listing-ignored',listing,'ignored'))(swapped(listing)).ok,true,'canonical listings: the same output');
 for(const keyOrder of [undefined,'ignored'])assert.equal(measureFixture(fixture('listing-'+keyOrder,listing,keyOrder),CORPUS_CAPS).unsound,0);
});

test('serialised fields and listed methods are free too; values and the presence of keys still count',()=>{
 const json=[...box,'function evaluate() {','  return JSON.stringify(new Box());','}'];
 assert.equal(grade(json,undefined,swapped(json)),'rejected');assert.equal(grade(json,'ignored',swapped(json)),'accepted');
 // Counting keys observes which exist, not their order: still ordered.
 const count=['function evaluate() {','  const o = {};','  o.x = 1;','  const n = Object.keys(o).length;','  o.y = 2;','  return [n, Object.keys(o)];','}'];
 assert.equal(grade(count,'ignored',[1,2,3,5,4,6,7].map(row=>count[row-1])),'rejected');
 assert.equal(createOracle(fixture('count',count,'ignored'))([1,2,3,5,4,6,7].map(row=>count[row-1])).ok,false);
 // A value written to a key still orders its reads.
 const value=['function evaluate() {','  const o = {};','  o.x = 1;','  const seen = o.x;','  o.x = 2;','  return [seen, o.x];','}'];
 assert.equal(grade(value,'ignored',[1,2,3,5,4,6,7].map(row=>value[row-1])),'rejected');
 for(const [id,source] of [['json',json],['count',count],['value',value]])assert.equal(measureFixture(fixture(id,source,'ignored'),CORPUS_CAPS).unsound,0,id);
});

test('the setting is part of the evidence, of the verification and of a refresh; an unknown value is refused',async()=>{
 const source=listing.join('\n'),observed=generateCodeLineExercise({source},ts),ignored=generateCodeLineExercise({source,keyOrder:'ignored'},ts);
 assert.equal(observed.authoring.evidence.environment.keyOrder,undefined,'the default records nothing new');
 assert.equal(ignored.authoring.evidence.environment.keyOrder,'ignored');
 const libraryDir=path.dirname(ts.getDefaultLibFilePath({}));
 const auditor=createReferenceAuditor(ts,name=>{try{return readFileSync(path.join(libraryDir,name),'utf8');}catch{return undefined;}});
 const ports={generate:input=>generateCodeLineExercise(input,ts)},audit=auditor.audit(source,'javascript').semantics;
 assert.equal((await verifyAuthorModel(ignored,ports,{audit})).checks.rederivation,'match');
 // Dropping the recorded setting makes the freed pairs a hand edit: they no longer re-derive.
 const environment={...ignored.authoring.evidence.environment};delete environment.keyOrder;
 const forged={...ignored,authoring:{...ignored.authoring,evidence:{...ignored.authoring.evidence,environment}}};
 assert.equal((await verifyAuthorModel(forged,ports,{audit})).checks.rederivation,'differs');
 const {model}=await refreshAuthorModel(ignored,{...ports,audit:reference=>auditReference(reference,ts)});
 assert.deepEqual(model.lines.map(line=>line.dependencies),ignored.lines.map(line=>line.dependencies));
 assert.equal(model.authoring.evidence.environment.keyOrder,'ignored');
 assert.throws(()=>generateCodeLineExercise({source,keyOrder:'sometimes'},ts),/kulcssorrend/);
});

test('the author request sends the setting only when chosen, and an admitted model restores it',()=>{
 const author={title:'T',description:'D',language:'javascript',source:'x',message:''};
 assert.deepEqual(authorRequest({...author,keyOrder:'observed'}),{title:'T',description:'D',language:'javascript',source:'x'});
 assert.deepEqual(authorRequest({...author,keyOrder:'ignored'}),{title:'T',description:'D',language:'javascript',source:'x',keyOrder:'ignored'});
 const model=generateCodeLineExercise({source:listing.join('\n'),keyOrder:'ignored'},ts),state={author:{...author},previews:new Map(),modelDraft:'',modelMessage:''};
 admitAuthorModel(state,model);
 assert.equal(state.author.keyOrder,'ignored');assert.equal(state.authorBaseline.keyOrder,'ignored');
});
