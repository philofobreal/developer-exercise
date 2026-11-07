/** ADR-108 (E3): binding safety. An access to a let/const/class binding before its initialization is
 *  reported only when it is definite (unconditional path, reachable, same binding by symbol resolution,
 *  directly or through calls whose callee is certain); everywhere it cannot be sure it stays silent.
 *  Zero findings on every real program of the repository but the one deliberate TDZ fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {bindingSafety} from '../dist/author/preflight/binding-safety.js';
import {sourceGate} from '../dist/author/preflight/source-gate.js';
import {resolveAuthorPolicy} from '../dist/author/preflight/config-resolver.js';
import {createReferenceAuditor} from '../dist/author/reference-audit.js';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {catalog,PROGRAM_KINDS} from './support/fixture-catalog.mjs';

// [expected findings as 'code@line', source]; the plan's corpus (ADR-108, plan §9) and its counterexamples.
const CASES={
 'direct read':[['BS001@1'],'console.log(x);\nconst x = 1;'],
 'typeof is no exception':[['BS001@1'],'typeof x;\nlet x = 1;'],
 'var is hoisted (undefined, no error)':[[],'console.log(x);\nvar x = 1;'],
 'function declaration is hoisted':[[],'f();\nfunction f() {}'],
 'closure called after initialization':[[],'const f = () => x;\nconst x = 1;\nf();'],
 'closure called before initialization':[['BS002@2'],'const f = () => x;\nf();\nconst x = 1;'],
 'inner block shadowing':[['BS001@3'],'const x = 1;\n{\n  console.log(x);\n  let x = 2;\n}'],
 'let without initializer':[[],'let x;\nconsole.log(x);'],
 'class heritage before the class':[['BS001@1'],'class A extends B {}\nclass B {}'],
 'dead branch':[[],'if (false) {\n  console.log(x);\n}\nlet x = 1;'],
 'function defined, called after':[[],'function g() {\n  return x;\n}\nlet x = 1;\ng();'],
 'function declaration called before':[['BS002@4'],'function g() {\n  return x;\n}\ng();\nlet x = 1;'],
 'call inside a branch':[[],'const f = () => x;\nif (ready) f();\nconst x = 1;'],
 'callee reassigned':[[],'function g() { return x; }\ng = () => 0;\ng();\nlet x = 1;'],
 'call in a short-circuit tail':[[],'const f = () => x;\nready && f();\nconst x = 1;'],
 'short-circuit head':[['BS001@1'],'x && ready;\nconst x = 1;'],
 'inside try':[[],'try {\n  console.log(x);\n} catch (e) {}\nlet x = 1;'],
 'after an unconditional return':[[],'function h() {\n  return 1;\n  console.log(y);\n  let y = 2;\n}'],
 'self initializer':[['BS001@1'],'const x = x + 1;'],
 'earlier declarator':[['BS001@1'],'let a = b, b = 1;'],
 'later declarator':[[],'let b = 1, a = b;'],
 'immediately invoked':[['BS002@1'],'(() => x)();\nconst x = 1;'],
 'three calls deep':[['BS002@4'],'function a() { return b(); }\nfunction b() { return c(); }\nfunction c() { return z; }\na();\nconst z = 1;'],
 'conditional read in the callee':[[],'function a() { if (ok) return z; return 0; }\na();\nconst z = 1;'],
 'callee read after its return':[[],'function a() { return 0; z; }\na();\nconst z = 1;'],
 'parameter shadows':[[],'function a(z) { return z; }\na(1);\nconst z = 1;'],
 'optional call argument':[[],'const f = () => x;\nobj?.m(f());\nconst x = 1;'],
 'destructuring default':[[],'const {a = x} = obj;\nconst x = 1;'],
 'in a function body':[['BS001@2'],'function k() {\n  console.log(q);\n  const q = 1;\n}'],
 'method call (callee unknown)':[[],'const o = {m() { return x; }};\no.m();\nconst x = 1;'],
 'loop body':[[],'for (const i of list) {\n  console.log(x);\n}\nconst x = 1;'],
 'while condition runs once':[['BS001@1'],'while (x) {}\nlet x = 1;'],
 'write before initialization':[['BS001@1'],'x = 2;\nlet x = 1;'],
 'recursion has a fresh binding per call':[[],'function fib(n) {\n  if (n < 2) return n;\n  const v = fib(n - 1) + fib(n - 2);\n  return v;\n}\nfib(5);'],
};
test('the corpus: definite where certain, silent where not (35 cases)',()=>{
 for(const [name,[want,source]] of Object.entries(CASES)){
  const result=bindingSafety(ts,source,'javascript');
  assert.equal(result.completeness,'within-supported-scope',name);
  assert.deepEqual(result.findings.map(f=>`${f.code}@${f.line}`),want,name);
  assert.ok(result.findings.every(f=>f.certainty==='definite'&&f.origin==='runtime-order'&&/ReferenceError \(TDZ\)/.test(f.message)),name);
 }
 // TypeScript: type positions never count; the same rules hold.
 assert.deepEqual(bindingSafety(ts,'let v: typeof x;\nconst x = 1;','typescript').findings,[]);
 assert.deepEqual(bindingSafety(ts,'type A = B;\ntype B = string;','typescript').findings,[]);
 assert.deepEqual(bindingSafety(ts,'const f = (): number => x;\nf();\nconst x: number = 1;','typescript').findings.map(f=>f.code),['BS002']);
});

test('zero false positives on every real program of the repository (482); only the deliberate TDZ fixture is found',()=>{
 const sources=[];
 for(const f of catalog())sources.push({id:f.id,language:f.language??'javascript',source:Array.isArray(f.source)?f.source.join('\n'):f.source});
 for(const kind of Object.keys(PROGRAM_KINDS))for(const language of ['javascript','typescript'])for(let seed=1;seed<=12;seed++){const p=PROGRAM_KINDS[kind](seed,{language});if(p)sources.push({id:kind+'-'+seed,language,source:p.source.join('\n')});}
 for(const f of readdirSync('examples').filter(f=>f.endsWith('.json')&&f!=='manifest.json')){const m=JSON.parse(readFileSync('examples/'+f,'utf8'));if(m.lines)sources.push({id:f,language:m.language,source:m.lines.map(l=>l.code).join('\n')});}
 for(const f of readdirSync('public/samples/typescript').filter(f=>f.endsWith('.ts')))sources.push({id:f,language:'typescript',source:readFileSync('public/samples/typescript/'+f,'utf8')});
 assert.ok(sources.length>=400,String(sources.length));
 const flagged=sources.flatMap(s=>{const r=bindingSafety(ts,s.source,s.language==='typescript'?'typescript':'javascript');assert.equal(r.completeness,'within-supported-scope',s.id);return r.findings.map(f=>`${s.id}:${f.code}@${f.line}:${f.binding}`);});
 assert.deepEqual(flagged,['wp6-self-referential-initializer:BS001@7:broken'],'the fixture runs `const broken = broken;` on purpose (and catches the error)');
});

const dir=path.dirname(ts.getDefaultLibFilePath({}));
const auditor=createReferenceAuditor(ts,name=>{try{return readFileSync(path.join(dir,path.basename(name)),'utf8');}catch{return undefined;}});
test('the gate: a definite finding blocks in JavaScript, also without a standard library; TypeScript is not reported twice; a possible TDZ becomes definite',()=>{
 const js='const f = () => x;\nf();\nconst x = 1;',policy=resolveAuthorPolicy({language:'javascript'});
 const blocked=sourceGate(auditor.audit(js,'javascript'),policy,bindingSafety(ts,js,'javascript'));
 assert.equal(blocked.verdict,'blocked');assert.match(blocked.message,/futáskor biztosan hibát dob.*2\. sor/);
 const pages=sourceGate(createReferenceAuditor(ts).audit(js,'javascript'),policy,bindingSafety(ts,js,'javascript'));
 assert.equal(pages.verdict,'blocked','no standard library is needed (Pages)');
 const direct='console.log(x);\nconst x = 1;';
 const typed=sourceGate(auditor.audit(direct,'typescript'),resolveAuthorPolicy({language:'typescript'}),bindingSafety(ts,direct,'typescript'));
 assert.deepEqual(typed.diagnostics.map(d=>d.code),['TS2448'],'the compiler report stays, the binding finding is not repeated');
 const checked=resolveAuthorPolicy({language:'javascript',policy:{jsCheck:'on'}});
 const upgraded=sourceGate(auditor.audit(direct,'javascript',{jsCheck:'on'}),checked,bindingSafety(ts,direct,'javascript'));
 assert.equal(upgraded.verdict,'blocked');assert.deepEqual(upgraded.diagnostics.map(d=>`${d.code}:${d.certainty}`),['BS001:definite'],'the possible TS2448 gives way to the definite finding');
 const budget=sourceGate(auditor.audit('const a = 1;','javascript'),policy,{completeness:'budget-exceeded',findings:[]});
 assert.equal(budget.verdict,'inconclusive');assert.equal(budget.admitted,true);assert.match(budget.message,/költségkeret/);
 assert.equal(sourceGate(auditor.audit('const a = 1;','javascript'),resolveAuthorPolicy({language:'javascript',policy:{unknownPolicy:'block'}}),{completeness:'budget-exceeded',findings:[]}).admitted,false);
});

test('server: the closure called before initialization is refused at the call line; a correct order passes',async()=>{
 const catalog=new ExerciseCatalog(new Map());
 await assert.rejects(catalog.createDraft({source:'function run() {\n  const total = () => base * 2;\n  const result = total();\n  const base = 10;\n  return result;\n}',language:'javascript'}),error=>error.statusCode===422&&error.details.gate.diagnostics[0].code==='BS002'&&error.details.gate.diagnostics[0].line===3);
 const ok=await catalog.createDraft({source:'function run() {\n  const total = () => base * 2;\n  const base = 10;\n  return total();\n}',language:'javascript'});
 assert.equal(ok.gate.verdict,'passed');assert.ok(ok.gate.assumptions.includes('binding-safety'));
});
