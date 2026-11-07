/** ADR-108 (E9): the plan's minimal corpus (§9), end to end through the server's first and second gate.
 *
 * Every case states what the gate does today, measured, not hoped. Where the plan asks for an analysis that does not
 * exist (deviation 2: no option without an analyzer), the case pins today's language-faithful answer and says so;
 * where another test file owns the behaviour, the case names it instead of repeating it.
 *  - Definite errors block (0 false positives is the rule: a definite finding must be a real error on every run).
 *  - Unknown is never passed: a missing project context or a check that cannot decide is inconclusive.
 *
 * The cases another file owns: 13 class-field modes (tests/class-field-mode-setting.test.mjs, ADR-075); 15 a relaxed
 * rule re-qualifies the second gate and 16 stale source or settings is refused at both gates (tests/rules-gate.test.mjs,
 * tests/workbench-flow.test.mjs); 17 an invalid model, a v1 session, Pages without a standard library
 * (tests/session-v2.test.mjs, tests/author-policy.test.mjs C16, tests/source-gate.test.mjs not-run); 19 a late response
 * never replaces newer work (tests/author-workspace.test.mjs); 20 every API path enforces the same policy
 * (tests/author-policy.test.mjs HTTP 422, tests/rules-gate.test.mjs).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {ExerciseCatalog} from '../src/server/catalog.mjs';

const catalog=new ExerciseCatalog(new Map());
/** The first gate's answer for a source: refused with its finding codes, or admitted with its verdicts. */
async function gate(source,language='javascript',policy={},extra={}){
 try{const draft=await catalog.createDraft({source,language,policy,...extra});return {admitted:true,verdict:draft.gate.verdict,codes:draft.gate.diagnostics.map(d=>`${d.code}:${d.certainty}`),tryGate:draft.tryGate.verdict,draft};}
 catch(error){if(error.statusCode!==422)throw error;return {admitted:false,verdict:error.details?.gate?.verdict,codes:(error.details?.gate?.diagnostics??[]).map(d=>`${d.code}:${d.certainty}`),message:error.message};}
}
const blocked=(result,code)=>{assert.equal(result.admitted,false);assert.equal(result.verdict,'blocked');assert.ok(result.codes.includes(`${code}:definite`),JSON.stringify(result.codes));};
const passed=result=>{assert.equal(result.admitted,true);assert.equal(result.verdict,'passed',JSON.stringify(result.codes));assert.equal(result.tryGate,'passed');};

test('1, 2: an access before initialization is a definite error, typeof included; typeof of an undeclared name is not',async()=>{
 blocked(await gate('console.log(x);\nconst x = 1;'),'BS001');
 blocked(await gate('typeof x;\nlet x = 1;'),'BS001');
 passed(await gate('const t = typeof undeclared;\nconst u = t;'));
 // With checkJs the unknown global is an unresolved name: undecided, never passed and never a TDZ error.
 const checked=await gate('const t = typeof undeclared;\nconst u = t;','javascript',{jsCheck:'on'});
 assert.equal(checked.verdict,'inconclusive');assert.deepEqual(checked.codes,['TS2304:unknown']);
});

test('3, 4: var before its declaration and a call before a function declaration run as the language says (no style option yet)',async()=>{
 // The plan's optional quality warning (3) and declaration-first mode (4) have no analyzer (ADR-108, deviation 2).
 passed(await gate('console.log(x);\nvar x = 1;'));
 passed(await gate('f();\nfunction f() {}'));
});

test('5, 6, 7, 8: closures, shadowing, a declared undefined and class order',async()=>{
 passed(await gate('const f = () => x;\nconst x = 1;\nf();'));
 blocked(await gate('const f = () => x;\nf();\nconst x = 1;'),'BS002');
 blocked(await gate('const x = 1;\n{\n  console.log(x);\n  let x = 2;\n}'),'BS001');
 passed(await gate('let x;\nconsole.log(x);'));
 blocked(await gate('class A extends B {}\nclass B {}'),'BS001');
});

test('9, 10, 14: TypeScript types, a missing project context and the two language audits',async()=>{
 passed(await gate('type A = B;\ntype B = string;\nconst a: A = "s";','typescript'));
 for(const policy of [{},{tsDiagnostics:'strict'}]){
  const imported=await gate('import {helper} from "./lib";\nconst a = helper(1);\nconsole.log(a);','typescript',policy);
  assert.equal(imported.verdict,'inconclusive','a missing module is undecided, not an error');assert.deepEqual(imported.codes,['TS2307:unknown']);assert.equal(imported.tryGate,'inconclusive');
 }
 blocked(await gate('const n: number = "s";\nconsole.log(n);','typescript'),'TS2322');
 passed(await gate('const n = 5;\nconsole.log(n.length);'));
 const checked=await gate('const n = 5;\nconsole.log(n.length);','javascript',{jsCheck:'on'});
 assert.equal(checked.verdict,'inconclusive');assert.deepEqual(checked.codes,['TS2339:possible'],'what only checkJs reports is possible');
});

test('11, 12: key order and a Proxy under valid inputs, as the rules decide them',async()=>{
 const swap=(result,i,j)=>{const lines=result.draft.model.lines.map(line=>line.code);[lines[i],lines[j]]=[lines[j],lines[i]];return catalog.preview({draftId:result.draft.draftId,source:result.draft.model.lines.map(line=>line.code).join('\n'),...result.request,lines}).status;};
 const run=async(source,request)=>({...(await gate(source,'javascript',{},request)),request});
 const keys='function f() {\n  const o = {};\n  o.a = 1;\n  o.b = 2;\n  return Object.keys(o);\n}';
 assert.equal(swap(await run(keys,{keyOrder:'observed'}),2,3),'rejected');
 assert.equal(swap(await run(keys,{keyOrder:'ignored'}),2,3),'accepted');
 // Known precision gap (plan §9.11): the length alone does not depend on key order, but the rules still order the
 // writes. Over-strict, never unsafe: a correct arrangement is never accepted wrongly. Recorded in ADR-108.
 assert.equal(swap(await run(keys.replace('Object.keys(o);','Object.keys(o).length;'),{keyOrder:'observed'}),2,3),'rejected');
 const reads='function f(o) {\n  const a = o.x;\n  const b = o.y;\n  return a + b;\n}';
 assert.equal(swap(await run(reads,{inputs:'valid'}),1,2),'accepted');
 assert.equal(swap(await run(reads,{inputs:'any'}),1,2),'rejected');
 assert.equal(swap(await run(reads.replace('return a + b;','return new Proxy(o, {}) && a + b;'),{inputs:'valid'}),1,2),'rejected','a Proxy in the program keeps reads ordered');
});

test('18: recursion, a conditional initialization and a loop that ends are no errors',async()=>{
 passed(await gate('function f(n) {\n  return n ? f(n - 1) : 0;\n}\nconsole.log(f(3));'));
 passed(await gate('let x;\nif (Math.random() > 0.5) x = 1;\nconsole.log(x);'));
 passed(await gate('while (true) {\n  break;\n}\nconst a = 1;'));
});
