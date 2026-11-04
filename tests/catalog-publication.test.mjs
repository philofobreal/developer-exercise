import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,copyFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {publicationRefusal} from '../dist/index.js';
import {refreshAuthorModel} from '../dist/author/engine.js';
import {generateCodeLineExercise,DEPENDENCY_POLICY} from '../src/author/generator.mjs';
import {auditReference} from '../src/author/audit.mjs';
/** ADR-027: what a trusted catalog serves is one typed rule; a refused model is skipped, never rewritten. */
test('publication rule: budget-undecided models never, unverified ones only under the legacy publishable policy',()=>{
 const v=(status,publishable)=>({status,publishable,checks:{},findings:[],claims:[]});
 assert.equal(publicationRefusal(v('analysis-verified',true)),null);
 assert.match(publicationRefusal(v('unverified',true)),/nem igazolt/,'ADR-089: the default is verified-only');
 assert.equal(publicationRefusal(v('unverified',true),'publishable'),null,'the legacy policy still serves them');
 assert.match(publicationRefusal(v('analysis-verified',false)),/keretben/);
 assert.match(publicationRefusal(v('unverified',true),'verified-only'),/nem igazolt/);
 for(const status of ['analysis-verified','conservative','author-modified'])assert.equal(publicationRefusal(v(status,true),'verified-only'),null,status);
});
// Every shipped example is refreshed (docs/peldak-migracioja.md, ADR-057, ADR-089). algo-bfs-js keeps its
// two fixed lines and profiles-js its two profiles, author decisions: author-modified.
const refreshed={'algo-bfs-js':'author-modified','algo-sort-search-js':'analysis-verified','class-accounts-ts':'analysis-verified','class-inventory-ts':'analysis-verified','fib-memo-js':'analysis-verified','profiles-js':'author-modified','stack-ts':'analysis-verified','word-count-js':'analysis-verified'};
const legacyDir=path.join('tests','fixtures','legacy-examples');
test('catalog: the default (verified-only) serves every shipped example and names its qualification',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'codeline-publication-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const examples=(await readdir('examples')).filter(name=>name.endsWith('.json')).sort();
 assert.deepEqual(examples.map(name=>name.replace(/\.json$/,'')),Object.keys(refreshed).sort());
 for(const name of examples)await copyFile(path.join('examples',name),path.join(dir,name));
 const served=await ExerciseCatalog.open(dir);
 assert.deepEqual(served.skipped,[]);
 for(const item of served.list())assert.equal(item.verification,refreshed[item.id],item.id);
 assert.equal(served.list().length,examples.length);
});
test('catalog: legacy models are skipped untouched by default and served, unverified, only under publishable',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'codeline-publication-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const legacy=(await readdir(legacyDir)).filter(name=>name.endsWith('.json')).sort();
 for(const name of legacy)await copyFile(path.join(legacyDir,name),path.join(dir,name));
 await copyFile(path.join('examples','class-inventory-ts.json'),path.join(dir,'class-inventory-ts.json'));
 const files=(await readdir(dir)).sort(),before=await Promise.all(files.map(name=>readFile(path.join(dir,name))));
 const strict=await ExerciseCatalog.open(dir);
 assert.deepEqual(strict.list().map(item=>item.id),['class-inventory-ts']);
 assert.equal(strict.skipped.length,legacy.length);
 assert.ok(strict.skipped.every(item=>item.status==='unverified'&&/nem igazolt/.test(item.reason)));
 const loose=await ExerciseCatalog.open(dir,{publication:'publishable'});
 assert.deepEqual(loose.skipped,[]);
 assert.equal(loose.list().filter(item=>item.verification==='unverified').length,legacy.length);
 const after=await Promise.all(files.map(name=>readFile(path.join(dir,name))));
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
  assert.equal(model.authoring.dependencyPolicy,DEPENDENCY_POLICY,id);
 }
});
test('verified-only still fails closed when only legacy models remain',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'codeline-publication-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 for(const name of (await readdir(legacyDir)).filter(name=>name.endsWith('.json')))await copyFile(path.join(legacyDir,name),path.join(dir,name));
 await assert.rejects(ExerciseCatalog.open(dir),/No publishable JSON exercises.*verified-only/);
});
