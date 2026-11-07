/** ADR-108 (E5a): the first author gate. A definite language error always blocks and keeps the previous
 *  draft; what the audit could not establish is inconclusive (never passed), let through only under the
 *  `warn` policy; the diagnostics carry the author's editor line numbers; every entry path is gated. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {sourceGate} from '../dist/author/preflight/source-gate.js';
import {resolveAuthorPolicy} from '../dist/author/preflight/config-resolver.js';

const policy=(unknownPolicy='warn')=>resolveAuthorPolicy({language:'typescript',policy:{unknownPolicy}});
const audit=(semantics,diagnostics=[],unresolved=[])=>({semantics,diagnostics,unresolved,assumptions:['single-file']});

test('the decision: definite blocks under every policy; unknown is inconclusive and follows the policy; only ok passes',()=>{
 for(const p of ['warn','block']){
  const blocked=sourceGate(audit('errors',[{line:3,code:2322,message:'Type mismatch',context:false,certainty:'definite'},{line:1,code:2307,message:"Cannot find module 'x'",context:true,certainty:'unknown'}]),policy(p));
  assert.equal(blocked.verdict,'blocked');assert.equal(blocked.admitted,false);
  assert.deepEqual(blocked.diagnostics.map(d=>[d.line,d.certainty]),[[1,'unknown'],[3,'definite']],'one list, in source order');assert.match(blocked.message,/3\. sor: Type mismatch \(TS2322\)/);
 }
 for(const semantics of ['unverifiable','not-run']){
  const warned=sourceGate(audit(semantics,[],['x']),policy('warn')),refused=sourceGate(audit(semantics,[],['x']),policy('block'));
  assert.equal(warned.verdict,'inconclusive');assert.equal(warned.admitted,true);assert.match(warned.message,/nem tekinthető ellenőrzöttnek/);
  assert.equal(refused.verdict,'inconclusive');assert.equal(refused.admitted,false);assert.match(refused.message,/nem jelenti, hogy a forrás hibás/);
  assert.equal(warned.completeness,semantics==='not-run'?'not-run':'partial');
 }
 const passed=sourceGate(audit('ok'),policy());assert.equal(passed.verdict,'passed');assert.equal(passed.message,'');assert.equal(passed.policyFingerprint,policy().fingerprint);
});

test('server: TypeScript compile errors (also TDZ) are refused at the source line the author sees; a JavaScript redeclaration earlier by the parser; the previous draft stays',async()=>{
 const catalog=new ExerciseCatalog(new Map());
 const good=await catalog.createDraft({source:'const a = 1;\nconst b = a + 1;',language:'typescript'});
 assert.equal(good.gate.verdict,'passed');assert.equal(good.policy.effective.unknownPolicy,'warn');
 const before=[...catalog.drafts.keys()];
 const refuse=async(body,line)=>{await assert.rejects(catalog.createDraft(body),error=>{assert.equal(error.statusCode,422);assert.equal(error.details.gate.verdict,'blocked');assert.equal(error.details.gate.diagnostics[0].line,line);assert.match(error.message,/a korábbi modell megmaradt/);return true;});};
 await refuse({source:'// header\n\nconst a: number = 1;\n\nconst b: string = a;',language:'typescript'},5);
 await refuse({source:'console.log(x);\nconst x = 1;',language:'typescript'},1);
 // A JavaScript redeclaration is refused even earlier, by the generator's parser (400, before the gate).
 await assert.rejects(catalog.createDraft({source:'let a = 1;\nlet a = 2;',language:'javascript'}),error=>error.name==='AuthoringError'&&/Szintaktikai hiba 2\. sor/.test(error.message));
 assert.deepEqual([...catalog.drafts.keys()],before,'a refused source creates no draft and removes none');
});

test('server: an unresolved import is inconclusive: admitted with a warning by default, refused under block',async()=>{
 const catalog=new ExerciseCatalog(new Map()),source="import {helper} from './helper';\nconst a = helper(1);\nconst b = a + 1;";
 const draft=await catalog.createDraft({source,language:'typescript'});
 assert.equal(draft.gate.verdict,'inconclusive');assert.equal(draft.gate.completeness,'partial');assert.match(draft.gate.message,/projektkontextus/);
 await assert.rejects(catalog.createDraft({source,language:'typescript',policy:{unknownPolicy:'block'}}),error=>error.statusCode===422&&/nem jelenti, hogy a forrás hibás/.test(error.message));
});

test('server: every entry path is gated: an imported model and a dependency refresh of a broken reference are refused',async()=>{
 const catalog=new ExerciseCatalog(new Map());
 const model=generateCodeLineExercise({source:'const a: number = 1;\nconst b: number = a;',language:'typescript'},ts);
 const broken=structuredClone(model);broken.lines[1].code='const b: string = a;';
 await assert.rejects(catalog.createDraft({model:broken}),error=>error.statusCode===422&&error.details.gate.verdict==='blocked');
 await assert.rejects(catalog.createDraft({model:broken,refreshDependencies:true}),error=>error.statusCode===422);
 const imported=await catalog.createDraft({model});assert.equal(imported.gate.verdict,'passed');
 await assert.rejects(catalog.createDraft({model,policy:{declarationOrder:'declaration-first'}}),error=>error.statusCode===422&&error.details.policy.conflicts[0].code==='C33');
});
