import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
const catalog=await ExerciseCatalog.open(fileURLToPath(new URL('../examples/',import.meta.url)));
const input={language:'javascript',title:'Author edited dependency graph',description:'a/b independent',source:`function calc() {
  const a = 1;
  const b = 2;
  return a + b;
}`};
test('Model editing: author compile -> invalid permutation -> edited references -> accepted same submission',async()=>{
 const generated=await catalog.createDraft(input);const strict=structuredClone(generated.model);strict.lines[2].dependencies=[strict.lines[1].id];
 const first=await catalog.createDraft({model:strict});const model=first.model;
 assert.equal(model.lines.length,5);
 const altered=model.lines.map(l=>l.code);[altered[1],altered[2]]=[altered[2],altered[1]];
 assert.equal(catalog.preview({draftId:first.draftId,lines:altered}).status,'rejected');
 const a=model.lines.find(l=>l.code.includes('const a'));
 const b=model.lines.find(l=>l.code.includes('const b'));
 const ret=model.lines.find(l=>l.code.includes('return a'));
 b.dependencies=[model.lines[0].id];
 ret.dependencies=[a.id,b.id];
 const edited=await catalog.createDraft({model});
 assert.notEqual(edited.draftId,first.draftId);
 assert.equal(catalog.preview({draftId:edited.draftId,lines:altered}).status,'accepted');
 assert.equal(edited.model.lines.find(l=>l.id===b.id).dependencies.length,1);
});
test('Invalid cycle on edit is rejected atomically without mutating last active draft',async()=>{
 const original=await catalog.createDraft(input),working=structuredClone(original.model);
 working.lines[1].dependencies=[working.lines[2].id];
 working.lines[2].dependencies=[working.lines[1].id];
 await assert.rejects(catalog.createDraft({model:working}),/.*(?:Kör|kör|cycle|Ciklus|ciklus|Cyclic|cyclic|Hibás|Érvénytelen|szabály).*/);
 assert.equal(catalog.preview({draftId:original.draftId,lines:original.model.lines.map(x=>x.code)}).status,'accepted');
});
test('Editing fixed lines causes server to enforce their exact reference positions',async()=>{
 const first=await catalog.createDraft(input),model=structuredClone(first.model);
 const b=model.lines.find(l=>l.code.includes('const b'));
 // Required predecessors are loosened to make a and b otherwise interchangeable.
 b.dependencies=[model.lines[0].id];
 model.lines.find(l=>l.code.includes('return a')).dependencies=[2,3];
 b.fixed=true;
 const fixed=await catalog.createDraft({model});
 const reordered=fixed.model.lines.map(x=>x.code);[reordered[1],reordered[2]]=[reordered[2],reordered[1]];
 assert.equal(catalog.preview({draftId:fixed.draftId,lines:reordered}).status,'rejected');
});
