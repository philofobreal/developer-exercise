import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,copyFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {publicationRefusal} from '../dist/index.js';
/** ADR-027: what a trusted catalog serves is one typed rule; a refused model is skipped, never rewritten. */
test('publication rule: budget-undecided models never, unverified ones only under the default policy',()=>{
 const v=(status,publishable)=>({status,publishable,checks:{},findings:[],claims:[]});
 assert.equal(publicationRefusal(v('analysis-verified',true)),null);
 assert.equal(publicationRefusal(v('unverified',true)),null,'the default keeps legacy models served, as before');
 assert.match(publicationRefusal(v('analysis-verified',false)),/keretben/);
 assert.match(publicationRefusal(v('unverified',true),'verified-only'),/nem igazolt/);
 for(const status of ['analysis-verified','conservative','author-modified'])assert.equal(publicationRefusal(v(status,true),'verified-only'),null,status);
});
test('catalog: the default serves the legacy examples and names their qualification; verified-only skips them untouched',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'codeline-publication-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const examples=(await readdir('examples')).filter(name=>name.endsWith('.json')).sort();
 for(const name of examples)await copyFile(path.join('examples',name),path.join(dir,name));
 const before=await Promise.all(examples.map(name=>readFile(path.join(dir,name))));
 const served=await ExerciseCatalog.open(dir);
 assert.equal(served.list().length,examples.length);assert.deepEqual(served.skipped,[]);
 assert.ok(served.list().every(item=>item.verification==='unverified'),'every legacy example is listed as unverified');
 await assert.rejects(ExerciseCatalog.open(dir,{publication:'verified-only'}),/No publishable JSON exercises.*verified-only/,'nothing left to serve fails closed');
 const after=await Promise.all(examples.map(name=>readFile(path.join(dir,name))));
 assert.ok(after.every((bytes,i)=>bytes.equals(before[i])),'no model file is rewritten');
});
