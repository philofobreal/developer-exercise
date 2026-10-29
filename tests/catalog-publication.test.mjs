import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,copyFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {publicationRefusal} from '../dist/index.js';
import {refreshAuthorModel} from '../dist/author/engine.js';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {auditReference} from '../src/author/audit.mjs';
/** ADR-027: what a trusted catalog serves is one typed rule; a refused model is skipped, never rewritten. */
test('publication rule: budget-undecided models never, unverified ones only under the default policy',()=>{
 const v=(status,publishable)=>({status,publishable,checks:{},findings:[],claims:[]});
 assert.equal(publicationRefusal(v('analysis-verified',true)),null);
 assert.equal(publicationRefusal(v('unverified',true)),null,'the default keeps legacy models served, as before');
 assert.match(publicationRefusal(v('analysis-verified',false)),/keretben/);
 assert.match(publicationRefusal(v('unverified',true),'verified-only'),/nem igazolt/);
 for(const status of ['analysis-verified','conservative','author-modified'])assert.equal(publicationRefusal(v(status,true),'verified-only'),null,status);
});
// The one refreshed example (docs/peldak-migracioja.md); every other example is still a legacy model.
const refreshed={'class-inventory-ts':'analysis-verified'};
test('catalog: the default serves every example and names its qualification; verified-only skips the legacy ones untouched',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'codeline-publication-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const examples=(await readdir('examples')).filter(name=>name.endsWith('.json')).sort();
 for(const name of examples)await copyFile(path.join('examples',name),path.join(dir,name));
 const before=await Promise.all(examples.map(name=>readFile(path.join(dir,name))));
 const served=await ExerciseCatalog.open(dir);
 assert.equal(served.list().length,examples.length);assert.deepEqual(served.skipped,[]);
 for(const item of served.list())assert.equal(item.verification,refreshed[item.id]??'unverified',item.id);
 const strict=await ExerciseCatalog.open(dir,{publication:'verified-only'});
 assert.deepEqual(strict.list().map(item=>item.id),Object.keys(refreshed));
 assert.deepEqual(strict.skipped.map(item=>[item.id,item.status]).sort(),served.list().filter(item=>!refreshed[item.id]).map(item=>[item.id,'unverified']).sort());
 assert.ok(strict.skipped.every(item=>/nem igazolt/.test(item.reason)));
 const after=await Promise.all(examples.map(name=>readFile(path.join(dir,name))));
 assert.ok(after.every((bytes,i)=>bytes.equals(before[i])),'no model file is rewritten');
});
test('a refreshed example re-derives exactly: a further refresh changes nothing',async()=>{
 const ts=(await import('typescript')).default;
 const ports={generate:input=>generateCodeLineExercise(input,ts),audit:model=>auditReference(model,ts)};
 for(const id of Object.keys(refreshed)){
  const model=JSON.parse(await readFile(path.join('examples',id+'.json'),'utf8'));
  const {model:again,report}=await refreshAuthorModel(model,ports);
  assert.deepEqual(again,model,id);
  assert.deepEqual(report,{authorRules:0,legacyEdges:0,supersededEdges:0,relaxations:[],droppedNotes:0},id);
  assert.equal(model.authoring.dependencyPolicy,'scoped-effect-analysis-v17',id);
 }
});
test('verified-only still fails closed when only legacy models remain',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'codeline-publication-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 for(const name of (await readdir('examples')).filter(name=>name.endsWith('.json')&&!refreshed[name.replace(/\.json$/,'')]))await copyFile(path.join('examples',name),path.join(dir,name));
 await assert.rejects(ExerciseCatalog.open(dir,{publication:'verified-only'}),/No publishable JSON exercises.*verified-only/);
});
