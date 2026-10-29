/** ADR-038: the register of reason codes is complete, consistent with what the analysis emits,
 * and every code is evidenced: an arrangement rejected for that code alone whose behaviour the
 * oracle finds different, or, for a conservative code, a documented occurrence or over-strict
 * case; the two codes no fixed program can exercise are waived by name with a reason. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {REASON_CODES,reasonCode} from '../dist/author/reason-codes.js';
import {createClassifier} from './support/order-classification.mjs';
import {catalog,fixtureById} from './support/fixture-catalog.mjs';
import {reasonCodeWaivers} from './fixtures/reason-code-programs.mjs';

const evidence=JSON.parse(await readFile(new URL('./fixtures/reason-code-evidence.json',import.meta.url),'utf8'));
const generate=fixture=>generateCodeLineExercise({source:fixture.source.join('\n'),language:fixture.language},ts);

test('the register is well formed: unique kebab-case codes, known categories, existing ADRs',async()=>{
 const adrs=new Set((await readdir(new URL('../docs/adr/',import.meta.url))).map(name=>'ADR-'+name.slice(0,3)));
 assert.equal(new Set(REASON_CODES.map(entry=>entry.code)).size,REASON_CODES.length);
 for(const entry of REASON_CODES){
  assert.match(entry.code,/^[a-z]+(-[a-z]+)*$/,entry.code);
  assert.ok(['data','effect','structure','unit','policy','conservative','unknown'].includes(entry.category),entry.code);
  assert.ok(adrs.has(entry.adr),entry.code+' '+entry.adr);
  assert.ok(entry.meaning.length>8,entry.code);
 }
 // Syntax-kind barriers form one family; anything else is unregistered.
 assert.deepEqual([reasonCode('ExpressionStatement')?.category,reasonCode('DoStatement')?.category],['effect','effect']);
 for(const code of ['unknown-code','expressionStatement','Expression-Statement',''])assert.equal(reasonCode(code),undefined,code);
});

test('every code the analysis emits is registered with the same category, and none is unknown',async()=>{
 const programs=catalog();
 const directory=new URL('../public/samples/typescript/',import.meta.url);
 for(const sample of JSON.parse(await readFile(new URL('suite.json',directory),'utf8')))programs.push({id:sample.id,language:'typescript',source:(await readFile(new URL(sample.id+'.ts',directory),'utf8')).split('\n')});
 programs.push({id:'copy-field-utility',language:'typescript',source:(await readFile(new URL('./fixtures/copy-field-utility.service.ts',import.meta.url),'utf8')).split('\n')});
 const seen=new Map();
 for(const program of programs)for(const entry of generate(program).authoring?.provenance??[]){
  const registered=reasonCode(entry.code);
  assert.ok(registered,`${program.id}: unregistered code ${entry.code}`);
  assert.equal(entry.category,registered.category,`${program.id}: ${entry.code}`);
  assert.notEqual(entry.category,'unknown',`${program.id}: ${entry.code}`);
  seen.set(entry.code,(seen.get(entry.code)??0)+1);
 }
 assert.ok(seen.size>=35,`${seen.size} distinct codes observed`);
});

test('every registered code has evidence, and the evidence still holds',()=>{
 const expected=[...REASON_CODES.filter(entry=>entry.category!=='unknown').map(entry=>entry.code),'ExpressionStatement'].sort();
 assert.deepEqual(Object.keys(evidence).sort(),expected,'re-pin with node tests/reason-code-evidence.mjs --write and review');
 for(const [code,item] of Object.entries(evidence)){
  const category=reasonCode(code).category;
  if(item.kind==='waived'){
   assert.equal(item.why,reasonCodeWaivers[code],code+': only the named waivers are accepted');
   continue;
  }
  assert.ok(item.kind==='justified'||category==='conservative',`${code}: a ${category} code needs behavioural evidence, not ${item.kind}`);
  const fixture=fixtureById(item.fixture),model=generate(fixture);
  if(item.kind==='occurrence'){assert.ok(model.authoring.provenance.some(entry=>entry.code===code),code);continue;}
  const result=createClassifier(fixture,model).classify(item.order);
  assert.deepEqual([result.kind,result.causes],[item.kind,[code]],`${code} on ${item.fixture}`);
 }
});

test('the waivers name only codes without behavioural evidence and give a reason',()=>{
 for(const [code,why] of Object.entries(reasonCodeWaivers)){
  assert.ok(reasonCode(code),code);
  assert.ok(why.length>20,code);
  assert.equal(evidence[code]?.kind,'waived',code);
 }
});
