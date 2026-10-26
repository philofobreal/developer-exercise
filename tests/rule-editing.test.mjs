/** ADR-018: typed author rule edits. Atomic admission, editability-based safety, honest
 * effect reports with validator-graded witnesses, requalification by the verification gate
 * and refresh that carries author rules over (epic 09.3). */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {editAuthorModel,refreshAuthorModel} from '../dist/author/engine.js';
import {auditReference} from '../src/author/audit.mjs';
import {applyRuleEdits,explainConstraints,compileCodeLineExercise,validateSubmission} from '../dist/index.js';

const generate=(source,language='javascript')=>generateCodeLineExercise({source:source.join('\n'),language},ts);
const ports={generate:input=>generateCodeLineExercise(input,ts),audit:model=>auditReference(model,ts)};
// Lines: 1 open, 2 a, 3 b, 4 c (reads a), 5 g(b, c), 6 close. 2 → 4 is proven (binding input).
const base=()=>generate(['function f() {','  const a = 1;','  const b = 2;','  const c = a + 3;','  g(b, c);','}']);
const ok=result=>{assert.ok(result.ok,result.message);return result.model;};
const grade=(model,order)=>{const compiled=compileCodeLineExercise(model);assert.ok(!compiled.status,compiled.message);const code=new Map(model.lines.map(line=>[line.id,line.code]));return validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines:order.map(id=>code.get(id))}).status;};
const direct=(model,before,after)=>explainConstraints(model).lines.find(line=>line.id===after).predecessors.find(item=>item.before===before);

test('adding a pedagogical rule tightens with a validator-graded witness and raises the revision',()=>{
 const model=base(),result=applyRuleEdits(model,[{kind:'add-rule',before:2,after:3,note:'Előbb a, aztán b.'}]);
 const edited=ok(result);
 assert.equal(edited.revision,model.revision+1);
 assert.deepEqual(edited.edges,[{before:2,after:3}]);
 assert.deepEqual(direct(edited,2,3).reasons,[{category:'author',code:'author-rule'}]);
 assert.equal(direct(edited,2,3).note,'Előbb a, aztán b.');
 assert.deepEqual([result.effect.stricter,result.effect.looser],['yes','no']);
 const witness=result.effect.stricterWitness;
 assert.equal(grade(model,witness),'accepted');
 assert.equal(grade(edited,witness),'rejected');
 assert.deepEqual(model.edges,[],'the input model is never mutated');
});

test('a cycle, a rule against the reference or an unknown line is rejected and changes nothing',()=>{
 const model=base(),snapshot=structuredClone(model);
 const cases=[[{kind:'add-rule',before:4,after:2},'cycle'],[{kind:'add-rule',before:3,after:2},'against-reference'],[{kind:'add-rule',before:2,after:99},'unknown-line'],[{kind:'set-fixed',line:2,fixed:'yes'},'invalid-edit'],[{kind:'explode'},'invalid-edit']];
 for(const [edit,error] of cases){const result=applyRuleEdits(model,[edit]);assert.equal(result.ok,false);assert.equal(result.error,error,JSON.stringify(edit));}
 const batch=applyRuleEdits(model,[{kind:'add-rule',before:2,after:3},{kind:'add-rule',before:3,after:2}]);
 assert.deepEqual([batch.ok,batch.error,batch.index],[false,'cycle',1],'a batch is all or nothing');
 assert.deepEqual(model,snapshot);
});

test('transitive consequences are named, not removable as direct rules',()=>{
 const model=base(),result=applyRuleEdits(model,[{kind:'remove-rule',before:1,after:6}]);
 assert.equal(result.ok,false);
 assert.equal(result.error,'hard-constraint','open → close is the block pair');
 const transitive=applyRuleEdits(model,[{kind:'remove-rule',before:2,after:5}]);
 assert.deepEqual([transitive.ok,transitive.error],[false,'transitive-only']);
 assert.equal(applyRuleEdits(model,[{kind:'remove-rule',before:2,after:3}]).error,'not-a-constraint');
});

test('removing a pedagogical rule is free and loosens; a redundant generated rule goes without acknowledgement',()=>{
 const tightened=ok(applyRuleEdits(base(),[{kind:'add-rule',before:2,after:3}]));
 const removed=applyRuleEdits(tightened,[{kind:'remove-rule',before:2,after:3}]);
 assert.deepEqual(ok(removed).edges,[]);
 assert.deepEqual([removed.effect.stricter,removed.effect.looser],['no','yes']);
 // Make 2 → 4 redundant with a rule 2 → 3 → 4, then drop the generated 2 → 4: the order set is unchanged.
 const chained=ok(applyRuleEdits(base(),[{kind:'add-rule',before:2,after:3},{kind:'add-rule',before:3,after:4}]));
 const dropped=applyRuleEdits(chained,[{kind:'remove-rule',before:2,after:4}]);
 const model=ok(dropped);
 assert.deepEqual([dropped.effect.stricter,dropped.effect.looser],['no','no']);
 assert.equal(model.authoring.relaxations,undefined,'nothing was relaxed');
});

test('relaxation safety: hard never, conservative only acknowledged, proven only as a policy override',()=>{
 const commented=generate(['function f() {','  const a = 1;','  // note','  const b = 2;','  return a + b;','}']);
 const conservative=direct(commented,3,4);
 assert.equal(conservative.editability,'conservative');
 assert.equal(applyRuleEdits(commented,[{kind:'remove-rule',before:3,after:4}]).error,'needs-acknowledgement');
 const relaxed=applyRuleEdits(commented,[{kind:'remove-rule',before:3,after:4,acknowledge:'unproven-relaxation',note:'A komment szabadon mozoghat.'}]);
 assert.deepEqual(ok(relaxed).authoring.relaxations,[{before:3,after:4,editability:'conservative',note:'A komment szabadon mozoghat.'}]);
 assert.equal(relaxed.effect.looser,'yes');
 const model=base();
 assert.equal(direct(model,2,4).editability,'proven');
 assert.equal(applyRuleEdits(model,[{kind:'remove-rule',before:2,after:4,acknowledge:'unproven-relaxation'}]).error,'needs-acknowledgement');
 const override=ok(applyRuleEdits(model,[{kind:'remove-rule',before:2,after:4,acknowledge:'policy-override'}]));
 assert.deepEqual(override.authoring.relaxations,[{before:2,after:4,editability:'proven'}]);
 const continued=generate(['function f() {','  const a = g(','    1);','  return a;','}']);
 assert.equal(applyRuleEdits(continued,[{kind:'remove-rule',before:2,after:3,acknowledge:'policy-override'}]).error,'hard-constraint');
});

test('unbound provenance makes every rule legacy: removal needs a policy override (ADR-015)',()=>{
 const model=base();model.lines[2].code='  const b = 9;';
 assert.equal(explainConstraints(model).provenance,'unbound');
 assert.equal(applyRuleEdits(model,[{kind:'remove-rule',before:2,after:4,acknowledge:'unproven-relaxation'}]).error,'needs-acknowledgement');
 assert.deepEqual(ok(applyRuleEdits(model,[{kind:'remove-rule',before:2,after:4,acknowledge:'policy-override'}])).authoring.relaxations,[{before:2,after:4,editability:'legacy'}]);
});

test('fixed slots and OR profiles: fixing tightens, a contradicting profile is allowed beside one that accepts the reference',()=>{
 const fixed=applyRuleEdits(base(),[{kind:'set-fixed',line:3,fixed:true}]);
 assert.deepEqual([fixed.effect.stricter,fixed.effect.looser],['yes','no']);
 const unfixed=applyRuleEdits(ok(fixed),[{kind:'set-fixed',line:3,fixed:false}]);
 assert.deepEqual([unfixed.effect.stricter,unfixed.effect.looser],['no','yes']);
 const profiled=applyRuleEdits(base(),[{kind:'add-profile',id:'a-first'},{kind:'add-profile-rule',profile:'a-first',before:2,after:3},{kind:'add-profile',id:'b-first'},{kind:'add-profile-rule',profile:'b-first',before:3,after:2}]);
 const model=ok(profiled);
 // a-first OR b-first admits exactly the old orders. Inclusion cannot show a split into OR
 // alternatives and no witness exists, so the report stays undecided rather than claiming either way.
 assert.deepEqual([profiled.effect.stricter,profiled.effect.looser],['maybe','no']);
 assert.equal(profiled.effect.stricterWitness,undefined);
 assert.equal(grade(model,[1,3,2,4,5,6]),'accepted');
 const narrowed=applyRuleEdits(model,[{kind:'remove-profile',id:'b-first'}]);
 assert.deepEqual([narrowed.effect.stricter,narrowed.effect.looser],['yes','no']);
 assert.equal(grade(ok(narrowed),narrowed.effect.stricterWitness),'rejected');
 assert.equal(applyRuleEdits(model,[{kind:'add-profile',id:'a-first'}]).error,'duplicate-profile');
 assert.equal(applyRuleEdits(model,[{kind:'remove-profile-rule',profile:'a-first',before:3,after:2}]).error,'not-a-constraint');
 assert.equal(applyRuleEdits(base(),[{kind:'add-profile-rule',profile:'none',before:2,after:3}]).error,'unknown-profile');
});

test('notes attach to direct constraints only, are bounded and can be removed',()=>{
 const noted=ok(applyRuleEdits(base(),[{kind:'set-note',before:2,after:4,note:'c az a értékét olvassa.'}]));
 assert.equal(direct(noted,2,4).note,'c az a értékét olvassa.');
 assert.equal(ok(applyRuleEdits(noted,[{kind:'set-note',before:2,after:4,note:''}])).authoring.ruleNotes,undefined);
 assert.equal(applyRuleEdits(base(),[{kind:'set-note',before:2,after:5,note:'x'}]).error,'not-a-constraint');
 assert.equal(applyRuleEdits(base(),[{kind:'set-note',before:2,after:4,note:'x'.repeat(501)}]).error,'invalid-edit');
 const effect=applyRuleEdits(base(),[{kind:'set-note',before:2,after:4,note:'x'}]).effect;
 assert.deepEqual([effect.stricter,effect.looser],['no','no']);
});

test('the gate requalifies every edit: author rules are author-modified, any relaxation unverified',async()=>{
 const tightened=await editAuthorModel(base(),[{kind:'add-rule',before:2,after:3}],ports);
 assert.equal(tightened.verification.status,'author-modified',tightened.verification.findings.join(' '));
 assert.equal(tightened.verification.checks.rederivation,'match');
 const relaxed=await editAuthorModel(base(),[{kind:'remove-rule',before:2,after:4,acknowledge:'policy-override'}],ports);
 assert.equal(relaxed.verification.checks.rederivation,'match','a recorded relaxation is not a hidden edit');
 assert.equal(relaxed.verification.status,'unverified');
 assert.equal(relaxed.verification.checks.relaxations.overrides,1);
 assert.equal(relaxed.verification.claims.find(item=>item.claim.startsWith('Az elfogadott sorrendek')).basis,'not-established');
 const failed=await editAuthorModel(base(),[{kind:'add-rule',before:4,after:2}],ports);
 assert.deepEqual([failed.result.ok,failed.verification],[false,undefined]);
});

test('refresh carries author rules, relaxations and notes over and reports what it could not',async()=>{
 const edited=ok(applyRuleEdits(base(),[
  {kind:'add-rule',before:2,after:3,note:'pedagógiai'},
  {kind:'remove-rule',before:2,after:4,acknowledge:'policy-override'},
  {kind:'set-note',before:4,after:5,note:'a hívás előtt'}]));
 // A stale generated edge of an earlier analysis, and an unexplained legacy edge.
 edited.edges.push({before:1,after:5},{before:2,after:5});edited.authoring.provenance.push({before:1,after:5,category:'conservative',code:'shared-boundary-lock'});
 assert.ok(!compileCodeLineExercise(edited).status);
 const {model,report}=await refreshAuthorModel(edited,ports);
 assert.deepEqual(report,{authorRules:1,legacyEdges:1,supersededEdges:1,relaxations:[{before:2,after:4,outcome:'reapplied'}],droppedNotes:0});
 assert.deepEqual(model.edges.map(edge=>[edge.before,edge.after]).sort(),[[2,3],[2,5]]);
 assert.ok(!model.lines[3].dependencies.includes(2),'the relaxation is reapplied');
 assert.deepEqual(model.authoring.ruleNotes,[{before:2,after:3,note:'pedagógiai'},{before:4,after:5,note:'a hívás előtt'}]);
 assert.equal(explainConstraints(model).provenance,'partial','the legacy edge stays unexplained');
});

test('refresh revokes a relaxation the regenerated analysis now proves, and says so',async()=>{
 const commented=generate(['function f() {','  const a = 1;','  // note','  const b = 2;','  return a + b;','}']);
 const relaxed=ok(applyRuleEdits(commented,[{kind:'remove-rule',before:3,after:4,acknowledge:'unproven-relaxation'}]));
 // Pretend the analysis had found the pair to be only conservative while it is now proven.
 const stronger=structuredClone(relaxed);stronger.authoring.relaxations=[{before:2,after:5,editability:'conservative'}];
 const {model,report}=await refreshAuthorModel(stronger,ports);
 assert.deepEqual(report.relaxations,[{before:2,after:5,outcome:'revoked'}]);
 assert.ok(model.lines[4].dependencies.includes(2));
 assert.equal(model.authoring.relaxations,undefined);
});

test('v2 compatibility: a legacy model edits, round-trips through JSON and stays admissible',()=>{
 const legacy=generate(['const a = 1;','const b = 2;','const c = a + b;']);
 delete legacy.authoring.provenance;delete legacy.authoring.evidence;
 const edited=ok(applyRuleEdits(legacy,[{kind:'set-fixed',line:1,fixed:true},{kind:'add-rule',before:1,after:2}]));
 const restored=JSON.parse(JSON.stringify(edited));
 assert.ok(!compileCodeLineExercise(restored).status);
 assert.deepEqual(restored,edited);
 assert.equal(explainConstraints(restored).provenance,'unbound','author provenance without evidence is not trusted');
});
