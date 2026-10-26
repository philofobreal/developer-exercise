/** ADR-015: provenance is bound to the lines and the analysis it was derived from; drifted
 * or unbound provenance is ignored, and the binding never changes a verdict. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {refreshLegacyDependencies} from '../dist/author/engine.js';
import {auditReference} from '../src/author/audit.mjs';
import {inspectModule} from '../dist-tools/architecture-rules.js';
import {codeLineDigest,evidenceStatus,explainConstraints,compileCodeLineExercise,validateSubmission} from '../dist/index.js';

const generate=(source,language='javascript',options={})=>generateCodeLineExercise({source:source.join('\n'),language,...options},ts);
const ports={generate:input=>generateCodeLineExercise(input,ts),audit:model=>auditReference(model,ts)};
const explained=model=>{const result=explainConstraints(model);assert.ok(!('status' in result),result.message);return result;};
const sample=['function f(n) {','  const a = n + 1;','  const b = n + 2;','  return a + b;','}'];

test('a generated model carries evidence: line digest, analyser version and analysis environment',()=>{
 const js=generate(sample);
 assert.deepEqual(js.authoring.evidence,{sourceDigest:codeLineDigest(js.lines),analyzer:js.authoring.dependencyPolicy,environment:{typescript:ts.version,sourceKind:'script',classFields:'either'}});
 assert.match(js.authoring.evidence.sourceDigest,/^[0-9a-f]{16}$/);
 const module=generate(['import {x} from "./x";','export const a = x;'],'typescript',{importEmit:'elide-unused'});
 assert.deepEqual(module.authoring.evidence.environment,{typescript:ts.version,importEmit:'elide-unused',sourceKind:'module',classFields:'either'});
 assert.equal(generate(['const a = 1;'],'typescript').authoring.evidence.environment.importEmit,'verbatim','an unknown build is recorded as the conservative default');
 assert.equal(evidenceStatus(js),'current');
});

test('the digest covers line identity, text and scope, and nothing a rule edit touches',()=>{
 const model=generate(sample),digest=codeLineDigest(model.lines);
 const variant=change=>{const copy=structuredClone(model);change(copy);return codeLineDigest(copy.lines);};
 assert.notEqual(variant(copy=>{copy.lines[1].code='  const a = n + 9;';}),digest);
 assert.notEqual(variant(copy=>{copy.lines[1].id=99;}),digest);
 assert.notEqual(variant(copy=>{copy.lines[1].scopeId=null;}),digest);
 assert.notEqual(variant(copy=>{[copy.lines[1],copy.lines[2]]=[copy.lines[2],copy.lines[1]];}),digest);
 assert.equal(variant(copy=>{copy.lines[1].fixed=true;copy.lines[3].dependencies=[];copy.lines[1].normalization='exact';}),digest);
 assert.equal(codeLineDigest(model.lines),digest,'deterministic');
});

test('drifted, renumbered or unbound provenance is ignored and explains as legacy',()=>{
 const model=generate(sample);
 assert.equal(explained(model).provenance,'complete');
 const edited=structuredClone(model);edited.lines[1].code='  const a = n + 9;';
 const renumbered=structuredClone(model);renumbered.lines[4].id=50;renumbered.lines[4].dependencies=[4];renumbered.blocks[0].closeLineId=50;
 renumbered.authoring.provenance=renumbered.authoring.provenance.map(entry=>entry.after===5?{...entry,after:50}:entry);
 const detached=structuredClone(model);delete detached.authoring.evidence;
 for(const [name,variant] of [['edited',edited],['renumbered',renumbered],['detached',detached]]){
  assert.notEqual(evidenceStatus(variant),'current',name);
  const result=explained(variant);
  assert.equal(result.provenance,'unbound',name);
  for(const line of result.lines)for(const constraint of line.predecessors)if(!constraint.origins.includes('block'))assert.deepEqual(constraint.reasons,[{category:'unknown',code:'unbound-provenance'}],name);
 }
 const fixed=structuredClone(model);fixed.lines[1].fixed=false;fixed.lines[0].fixed=true;
 assert.equal(explained(fixed).provenance,'complete','fixed slots are not part of the binding');
});

test('binding never changes admission or a verdict',()=>{
 const model=generate(sample),stale=structuredClone(model);stale.authoring.evidence.sourceDigest='0000000000000000';
 const [a,b]=[model,stale].map(item=>compileCodeLineExercise(item));
 assert.ok(!a.status&&!b.status);
 assert.deepEqual(a.compiled,b.compiled);
 const lines=[0,2,1,3,4].map(i=>model.lines[i].code);
 assert.equal(validateSubmission(a.compiled,{exerciseId:model.id,revision:1,lines}).status,validateSubmission(b.compiled,{exerciseId:model.id,revision:1,lines}).status);
});

test('schema: a malformed digest, an unknown analyser or environment field is rejected',()=>{
 const model=generate(sample);
 for(const evidence of [{...model.authoring.evidence,sourceDigest:'xyz'},{...model.authoring.evidence,analyzer:'future-v99'},{...model.authoring.evidence,environment:{bundler:'webpack'}},{sourceDigest:model.authoring.evidence.sourceDigest,analyzer:model.authoring.evidence.analyzer}])
  assert.equal(compileCodeLineExercise({...model,authoring:{...model.authoring,evidence}}).status,'invalid_reference',JSON.stringify(evidence));
});

test('refresh rebinds the regenerated provenance to the original line IDs',async()=>{
 const base=generate(sample),offset=id=>id*10;
 const original={...structuredClone(base),lines:base.lines.map(line=>({...line,id:offset(line.id),dependencies:line.dependencies.map(offset)})),blocks:base.blocks.map(block=>({...block,openLineId:offset(block.openLineId),closeLineId:offset(block.closeLineId)}))};
 assert.equal(evidenceStatus(original),'stale','renumbering by hand unbinds');
 const refreshed=await refreshLegacyDependencies(original,ports);
 assert.equal(evidenceStatus(refreshed),'current');
 assert.equal(explained(refreshed).provenance,'complete');
 assert.equal(refreshed.authoring.evidence.analyzer,'scoped-effect-analysis-v9');
});

test('architecture: only the projection may call the core digest from typed author code',()=>{
 const source="import {codeLineDigest} from '../../dist/index.js';";
 assert.deepEqual(inspectModule('src/author/code-line-projection.ts',source),[]);
 for(const file of ['src/author/statement-ordering.ts','src/author/js-ts-ordering.ts','src/author/dependency-refresh.ts'])assert.ok(inspectModule(file,source).some(error=>error.rule==='author-boundary'),file);
});
