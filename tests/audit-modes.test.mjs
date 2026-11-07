/** ADR-108 (E2): the parameterised language audit. TypeScript `strict` reports the strict family as
 *  definite compile errors; JavaScript `checkJs` adds possible findings only (the program still runs),
 *  while what the binding-and-grammar pass reports stays definite; without a library both are not-run.
 *  The options are language-bound (C14, C15), enter the policy fingerprint and reach the first gate. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {createReferenceAuditor} from '../dist/author/reference-audit.js';
import {auditMode,resolveAuthorPolicy} from '../dist/author/preflight/config-resolver.js';
import {sourceGate} from '../dist/author/preflight/source-gate.js';
import {ExerciseCatalog} from '../src/server/catalog.mjs';

const dir=path.dirname(ts.getDefaultLibFilePath({}));
const auditor=createReferenceAuditor(ts,name=>{try{return readFileSync(path.join(dir,path.basename(name)),'utf8');}catch{return undefined;}});
const codes=result=>result.diagnostics.map(d=>`${d.code}:${d.certainty}`);

test('TypeScript strict: implicit any and null into string are definite compile errors only under strict',()=>{
 for(const source of ['function f(a) { return a; }','let s: string = null;']){
  const baseline=auditor.audit(source,'typescript'),strict=auditor.audit(source,'typescript',{tsDiagnostics:'strict'});
  assert.equal(baseline.semantics,'ok',source);assert.ok(baseline.assumptions.includes('non-strict'));
  assert.equal(strict.semantics,'errors',source);assert.ok(strict.assumptions.includes('strict'));
  assert.ok(strict.diagnostics.every(d=>d.certainty==='definite'));
 }
 assert.deepEqual(codes(auditor.audit('function f(a) { return a; }','typescript',{tsDiagnostics:'strict'})),['7006:definite']);
 assert.ok(!auditor.audit('let s = null;','javascript',{tsDiagnostics:'strict'}).assumptions.includes('strict'),'a TypeScript option does not reach JavaScript');
});

test('JavaScript checkJs: what only the type check finds is possible; binding errors stay definite; TDZ is possible',()=>{
 // (`o.b = 2` would be no example: JavaScript declares an expando property there, even under checkJs.)
 const object='const n = 1;\nconst m = n.length;';
 assert.deepEqual(codes(auditor.audit(object,'javascript')),[]);
 const checked=auditor.audit(object,'javascript',{jsCheck:'on'});
 assert.equal(checked.semantics,'ok');assert.deepEqual(codes(checked),['2339:possible']);assert.ok(checked.assumptions.includes('javascript-check-js'));
 for(const source of ['console.log(x);\nconst x = 1;','if (false) { console.log(x); }\nlet x = 1;'])assert.deepEqual(codes(auditor.audit(source,'javascript',{jsCheck:'on'})),['2448:possible'],source);
 const redeclared='let a = 1;\nvar a = 2;';
 assert.equal(auditor.audit(redeclared,'javascript').semantics,'errors');
 const both=auditor.audit(redeclared,'javascript',{jsCheck:'on'});
 assert.equal(both.semantics,'errors');assert.ok(both.diagnostics.every(d=>d.certainty==='definite'),JSON.stringify(codes(both)));
});

test('without a standard library every mode is not-run, never ok',()=>{
 for(const [language,mode] of [['typescript',{tsDiagnostics:'strict'}],['javascript',{jsCheck:'on'}]])
  assert.equal(createReferenceAuditor(ts).audit('const a = 1;',language,mode).semantics,'not-run');
});

test('C14/C15: each option belongs to its language; it changes the fingerprint and the audit mode only there',()=>{
 const js=resolveAuthorPolicy({language:'javascript',policy:{tsDiagnostics:'strict',jsCheck:'on'}});
 assert.deepEqual(js.inactive.map(note=>note.path),['tsDiagnostics']);assert.deepEqual(auditMode(js),{jsCheck:'on'});
 const tsr=resolveAuthorPolicy({language:'typescript',policy:{tsDiagnostics:'strict',jsCheck:'on'}});
 assert.deepEqual(tsr.inactive.map(note=>note.path),['jsCheck']);assert.deepEqual(auditMode(tsr),{tsDiagnostics:'strict'});
 assert.notEqual(tsr.fingerprint,resolveAuthorPolicy({language:'typescript'}).fingerprint);
 assert.equal(resolveAuthorPolicy({language:'typescript',policy:{jsCheck:'on'}}).fingerprint,resolveAuthorPolicy({language:'typescript'}).fingerprint);
});

test('the gate: a possible finding is inconclusive (warn lets through, block stops); a strict error blocks',()=>{
 const object='const n = 1;\nconst m = n.length;';
 const warn=resolveAuthorPolicy({language:'javascript',policy:{jsCheck:'on'}}),block=resolveAuthorPolicy({language:'javascript',policy:{jsCheck:'on',unknownPolicy:'block'}});
 const passing=sourceGate(auditor.audit(object,'javascript',auditMode(warn)),warn);
 assert.equal(passing.verdict,'inconclusive');assert.equal(passing.admitted,true);assert.match(passing.message,/lehetséges hibát.*2\. sor.*TS2339/);
 assert.equal(sourceGate(auditor.audit(object,'javascript',auditMode(block)),block).admitted,false);
 const strict=resolveAuthorPolicy({language:'typescript',policy:{tsDiagnostics:'strict'}});
 assert.equal(sourceGate(auditor.audit('function f(a) { return a; }','typescript',auditMode(strict)),strict).verdict,'blocked');
});

test('server: the chosen mode decides admission at the source line; the response names it',async()=>{
 const catalog=new ExerciseCatalog(new Map()),typed='function f(a) {\n  const b = a;\n  return b;\n}';
 const baseline=await catalog.createDraft({source:typed,language:'typescript'});
 assert.equal(baseline.gate.verdict,'passed');assert.ok(baseline.gate.assumptions.includes('non-strict'));
 await assert.rejects(catalog.createDraft({source:typed,language:'typescript',policy:{tsDiagnostics:'strict'}}),error=>error.statusCode===422&&error.details.gate.diagnostics[0].line===1&&/TS7006/.test(error.message));
 const untyped='function f() {\n  const n = 1;\n  const m = n.length;\n  return m;\n}';
 const warned=await catalog.createDraft({source:untyped,language:'javascript',policy:{jsCheck:'on'}});
 assert.equal(warned.gate.verdict,'inconclusive');assert.equal(warned.gate.diagnostics[0].line,3);assert.equal(warned.policy.effective.jsCheck,'on');
 await assert.rejects(catalog.createDraft({source:untyped,language:'javascript',policy:{jsCheck:'on',unknownPolicy:'block'}}),error=>error.statusCode===422);
});
