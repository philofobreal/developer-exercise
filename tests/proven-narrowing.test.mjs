/** ADR-114: a model whose rules differ from the regeneration only by narrowing is `author-modified`, not
 *  `unverified`. Narrowing is proven, not assumed: the same block structure, every regenerated ordering
 *  implied by the model's own dependencies and edges at any distance, and no analysis reason the
 *  regeneration does not give. Any relaxation, structural change or forged analysis reason stays `differs`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {verifyAuthorModel} from '../dist/author/engine.js';
import {publicationRefusal,compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {ExerciseCatalog} from '../src/server/catalog.mjs';

const ports={generate:input=>generateCodeLineExercise(input,ts)};
const verify=model=>verifyAuthorModel(model,ports,{audit:'ok'});
const sample=name=>JSON.parse(readFileSync(new URL(`../public/samples/typescript/${name}`,import.meta.url),'utf8'));
/** `a`, `b` independent; `c` reads both: generated `c` after `a` and `b`, `a`/`b` free. */
const base=()=>generateCodeLineExercise({source:'const a = 1;\nconst b = 2;\nconst c = a + b;',language:'javascript'},ts);
const line=(model,id)=>model.lines.find(entry=>entry.id===id);
const accepts=(model,order)=>{const compiled=compileCodeLineExercise(model);return validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:order.map(id=>line(model,id).code)}).accepted;};
/** The author orders `a` before `b` (an author rule) and drops `c`'s now implied direct rule on `a`. */
function narrowed(){
 const model=base();
 assert.deepEqual(line(model,3).dependencies.sort(),[1,2],'the premise: c depends on a and b');
 line(model,2).dependencies=[1];
 model.authoring.provenance.push({before:1,after:2,category:'author',code:'author-rule'});
 line(model,3).dependencies=[2];
 model.authoring.provenance=model.authoring.provenance.filter(entry=>!(entry.before===1&&entry.after===3));
 return model;
}

test('the shipped values-only variant is a proven narrowing: author-modified and publishable under verified-only',async()=>{
 const result=await verify(sample('01-user-account.values-only.model.json'));
 assert.equal(result.checks.rederivation,'narrower');
 assert.equal(result.status,'author-modified',result.findings.join(' '));
 assert.equal(publicationRefusal(result,'verified-only'),null);
 assert.ok(result.findings.some(finding=>finding.includes('bizonyítottan csak szűkítenek')));
 const generated=await verify(sample('01-user-account.model.json'));
 assert.equal(generated.checks.rederivation,'match','the generated model is still an exact match, not a narrowing');
});

test('an author rule that makes a generated rule redundant: narrower, and only orders the generated model accepts',async()=>{
 const model=narrowed(),result=await verify(model);
 assert.equal(result.checks.rederivation,'narrower',result.findings.join(' '));
 assert.equal(result.status,'author-modified',result.findings.join(' '));
 assert.equal(result.claims.find(claim=>claim.claim.startsWith('Minden kényszer oka')).basis,'not-established','the author rule is not re-derived from the analysis');
 const generated=base();
 for(const order of [[1,2,3],[2,1,3],[1,3,2],[3,1,2]])if(accepts(model,order))assert.ok(accepts(generated,order),String(order));
 assert.equal(accepts(model,[2,1,3]),false,'the author rule narrows');
});

test('what stays unverified: a relaxation, a forged analysis reason, a changed block structure',async()=>{
 const relaxed=base();line(relaxed,3).dependencies=[2];relaxed.authoring.provenance=relaxed.authoring.provenance.filter(entry=>!(entry.before===1&&entry.after===3));
 const loose=await verify(relaxed);
 assert.equal(loose.checks.rederivation,'differs');assert.equal(loose.status,'unverified');
 assert.notEqual(publicationRefusal(loose,'verified-only'),null);

 const forged=narrowed();forged.authoring.provenance.find(entry=>entry.category==='author').category='proven';
 const forgedResult=await verify(forged);
 assert.equal(forgedResult.checks.rederivation,'differs','a narrowing rule passed off as analysis is not narrower');
 assert.equal(forgedResult.status,'unverified');

 const blockSource='function f() {\n  const a = 1;\n  return a;\n}\nconst b = 2;';
 const moved=generateCodeLineExercise({source:blockSource,language:'javascript'},ts);
 line(moved,5).scopeId=line(moved,2).scopeId;
 assert.equal((await verify(moved)).checks.rederivation,'differs','a line moved into another block is not a narrowing');
});

test('the second gate opens a proven narrowing even when undecided results block (Tilt)',async()=>{
 const catalog=new ExerciseCatalog(new Map());
 const narrowedDraft=await catalog.createDraft({model:narrowed(),policy:{unknownPolicy:'block'}});
 assert.equal(narrowedDraft.verification.status,'author-modified');
 assert.equal(narrowedDraft.tryGate.verdict,'passed',narrowedDraft.tryGate.message);
 const relaxed=base();line(relaxed,3).dependencies=[2];relaxed.authoring.provenance=relaxed.authoring.provenance.filter(entry=>!(entry.before===1&&entry.after===3));
 const relaxedDraft=await catalog.createDraft({model:relaxed,policy:{unknownPolicy:'block'}});
 assert.equal(relaxedDraft.verification.status,'unverified');
 assert.notEqual(relaxedDraft.tryGate.verdict,'passed');
});
