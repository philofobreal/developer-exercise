/** ADR-035: a language error blocks publication under every policy, and the server, the model
 * check and the Pages build serve exactly what one gate admits. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {ExerciseCatalog,publicationPolicy} from '../src/server/catalog.mjs';
import {publishExamples} from '../scripts/publish-examples.mjs';
import {verifyModel,publicationRefusal} from '../dist/index.js';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const generate=(source,language,id)=>({...generateCodeLineExercise({source:source.join('\n'),language,title:id},ts),id});
// A type error the syntax audit admits: only the semantic audit finds it.
const typed=()=>generate(['const label: string = 42;','console.log(label);'],'typescript','typed');
const clean=()=>generate(['function f(n) {','  const a = n + 1;','  const b = n + 2;','  return a + b;','}'],'javascript','clean');
async function folder(t,models){
 const dir=await mkdtemp(path.join(tmpdir(),'codeline-gate-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 for(const [file,model] of Object.entries(models))await writeFile(path.join(dir,file),JSON.stringify(model,null,2));
 return dir;
}
const snapshot=async dir=>Object.fromEntries(await Promise.all((await readdir(dir)).filter(name=>name.endsWith('.json')).sort().map(async name=>[name,await readFile(path.join(dir,name),'utf8')])));

test('only a definite language error blocks publication; missing context or no audit lowers claims only',()=>{
 const model=clean();
 for(const [audit,publishable] of [['ok',true],['unverifiable',true],['not-run',true],['errors',false]]){
  const result=verifyModel(model,{audit,rederivation:'match'});
  assert.equal(result.publishable,publishable,audit);
  assert.equal(result.checks.reference,'accepted',audit);
  assert.equal(result.findings.includes('Nyelvi hibás referencia nem publikálható.'),!publishable,audit);
 }
 // The reference and its swaps are decided: the language error alone is the refusal.
 const refused=verifyModel(model,{audit:'errors',rederivation:'match'});
 assert.equal(refused.checks.budget.indeterminate,0);
 assert.equal(refused.claims.find(item=>item.claim.startsWith('A referencia nyelvileg')).basis,'refuted');
});

test('the refusal names the language error first, under both policies, even beside a budget failure',()=>{
 const v=(audit,publishable,status='analysis-verified')=>({status,publishable,checks:{audit},findings:[],claims:[]});
 for(const policy of ['publishable','verified-only']){
  assert.match(publicationRefusal(v('errors',false),policy),/nyelvi hibát/,policy);
  // A hand-made verification that claims publishability cannot smuggle a language error past the rule.
  assert.match(publicationRefusal(v('errors',true),policy),/nyelvi hibát/,policy);
  for(const audit of ['ok','unverifiable','not-run'])assert.equal(publicationRefusal(v(audit,true),policy),null,policy+' '+audit);
 }
 assert.match(publicationRefusal(v('ok',false)),/keretben/);
});

test('the publication policy is read strictly: a misspelt value fails instead of serving more',()=>{
 assert.equal(publicationPolicy(undefined),'publishable');
 assert.equal(publicationPolicy(''),'publishable');
 assert.equal(publicationPolicy('publishable'),'publishable');
 assert.equal(publicationPolicy('verified-only'),'verified-only');
 for(const value of ['verified_only','Verified-Only',' verified-only','strict'])assert.throws(()=>publicationPolicy(value),/Unknown CODELINE_PUBLICATION/,value);
});

test('catalog: a type-error reference is skipped under the default policy too; a clean generated model is served under both',async t=>{
 const dir=await folder(t,{'typed.json':typed(),'clean.json':clean()});
 const before=await snapshot(dir);
 for(const publication of ['publishable','verified-only']){
  const catalog=await ExerciseCatalog.open(dir,{publication});
  assert.deepEqual(catalog.list().map(item=>[item.id,item.verification]),[['clean','analysis-verified']],publication);
  assert.deepEqual(catalog.skipped.map(({id,file,status})=>[id,file,status]),[['typed','typed.json','unverified']],publication);
  assert.match(catalog.skipped[0].reason,/nyelvi hibát/,publication);
  assert.equal(catalog.trusted.get('clean').file,'clean.json');
 }
 assert.deepEqual(await snapshot(dir),before,'no model file is rewritten');
});

test('catalog fails closed when the only reference has a language error',async t=>{
 const dir=await folder(t,{'typed.json':typed()});
 await assert.rejects(ExerciseCatalog.open(dir),/No publishable JSON exercises.*publishable/);
});

test('Pages publication copies and lists only what the catalog serves, and records why the rest was refused',async t=>{
 const dir=await folder(t,{'typed.json':typed(),'clean.json':clean()});
 const out=path.join(dir,'site');
 const before=await snapshot(dir);
 const result=await publishExamples(dir,out);
 assert.deepEqual(result.served,[{file:'clean.json',id:'clean',status:'analysis-verified'}]);
 assert.deepEqual((await readdir(out)).sort(),['clean.json','manifest.json','publication.json']);
 assert.deepEqual(JSON.parse(await readFile(path.join(out,'manifest.json'),'utf8')),['clean.json']);
 const record=JSON.parse(await readFile(path.join(out,'publication.json'),'utf8'));
 assert.equal(record.policy,'publishable');
 assert.deepEqual(record.skipped.map(({file,status})=>[file,status]),[['typed.json','unverified']]);
 assert.match(record.skipped[0].reason,/nyelvi hibát/);
 assert.equal(await readFile(path.join(out,'clean.json'),'utf8'),before['clean.json'],'a served model is copied byte for byte');
 assert.deepEqual(await snapshot(dir),before,'the source models are untouched');
});

test('Pages publication under verified-only refuses legacy unverified models with the same reason as the server',async t=>{
 const legacy=JSON.parse(await readFile(path.join(root,'examples','algo-bfs-js.json'),'utf8'));
 const dir=await folder(t,{'legacy.json':legacy,'clean.json':clean()});
 const {served,skipped}=await publishExamples(dir,path.join(dir,'site'),{publication:'verified-only'});
 assert.deepEqual(served.map(item=>item.file),['clean.json']);
 assert.deepEqual(skipped.map(({file,status})=>[file,status]),[['legacy.json','unverified']]);
 assert.match(skipped[0].reason,/nem igazolt/);
});

test('verify-models runs the same gate: a refused example fails the check, a clean folder passes, a bad policy fails',async t=>{
 const run=(dir,env={})=>spawnSync(process.execPath,[path.join(root,'scripts','verify-models.mjs'),dir],{cwd:root,encoding:'utf8',env:{...process.env,CODELINE_PUBLICATION:'',...env}});
 const mixed=await folder(t,{'typed.json':typed(),'clean.json':clean()});
 const refused=run(mixed);
 assert.equal(refused.status,1,refused.stdout+refused.stderr);
 assert.match(refused.stderr,/typed\.json \[unverified\]: A referencia nyelvi hibát tartalmaz/);
 assert.match(refused.stdout,/clean\.json: admitted.*analysis-verified/);
 const passing=await folder(t,{'clean.json':clean()});
 const ok=run(passing);
 assert.equal(ok.status,0,ok.stdout+ok.stderr);
 assert.match(ok.stdout,/1 exercises verified for publication \(publishable\)/);
 const misspelt=run(passing,{CODELINE_PUBLICATION:'verified_only'});
 assert.notEqual(misspelt.status,0);
 assert.match(misspelt.stderr,/Unknown CODELINE_PUBLICATION/);
 const empty=run(await folder(t,{'typed.json':typed()}));
 assert.equal(empty.status,1);
 assert.match(empty.stderr,/No publishable JSON exercises/);
});
