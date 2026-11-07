/** ADR-108 (E4): must-execute flow and local object state. A statement continues the flow only when it
 *  has no way out; both branches of an if/else and the first pass of a loop that certainly runs once
 *  count; a local binding whose value is known from its declaration (null, undefined, a non-callable
 *  literal) is reported when it is certainly dereferenced or called before any write. Silent elsewhere;
 *  zero false positives on the repository's real programs; `objectState: off` turns the second part off. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {runtimeSafety} from '../dist/author/preflight/runtime-safety.js';
import {sourceGate} from '../dist/author/preflight/source-gate.js';
import {resolveAuthorPolicy} from '../dist/author/preflight/config-resolver.js';
import {createReferenceAuditor} from '../dist/author/reference-audit.js';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {catalog,PROGRAM_KINDS} from './support/fixture-catalog.mjs';

const CASES={
 // E3 corrections: an early exit on some path makes what follows uncertain.
 'early return in the callee':[[],'function a() { if (c) return 0; return z; }\na();\nconst z = 1;'],
 'early exit in a nested block':[[],'function f() {\n  {\n    if (c) return;\n    console.log(x);\n  }\n  let x = 1;\n}'],
 // Must-execute joins.
 'both branches read':[['BS001@2'],'if (c) {\n  console.log(x);\n} else {\n  use(x);\n}\nlet x = 1;'],
 'one branch reads':[[],'if (c) {\n  console.log(x);\n}\nlet x = 1;'],
 'then reads, else does not':[[],'if (c) console.log(x); else other();\nlet x = 1;'],
 'do runs once':[['BS001@2'],'do {\n  console.log(x);\n} while (c);\nlet x = 1;'],
 'while (true) runs once':[['BS001@2'],'while (true) {\n  console.log(x);\n  break;\n}\nlet x = 1;'],
 'while (true) after a possible break':[[],'while (true) {\n  if (c) break;\n  console.log(x);\n}\nlet x = 1;'],
 'while (condition) may not run':[[],'while (c) {\n  console.log(x);\n}\nlet x = 1;'],
 'a call on both branches':[['BS002@2'],'const f = () => x;\nif (c) f(); else f();\nconst x = 1;'],
 // Local object state.
 'let without value, member read':[['OS001@2'],'let o;\nconsole.log(o.name);'],
 'null called':[['OS001@2'],'const fn = null;\nfn();'],
 'undefined destructured':[['OS001@2'],'const v = undefined;\nconst {a} = v;'],
 'void iterated':[['OS001@2'],'const list = void 0;\nfor (const item of list) {}'],
 'null spread into an array':[['OS001@2'],'const xs = null;\nconst ys = [...xs];'],
 'null spread into an object (no error)':[[],'const xs = null;\nconst ys = {...xs};'],
 'optional chaining':[[],'const o = null;\nconsole.log(o?.name);'],
 'guarded':[[],'let o = null;\nif (o) console.log(o.x);'],
 'written first':[[],'let o;\no = {name: 1};\nconsole.log(o.name);'],
 'written on a branch':[[],'let o;\nif (c) o = {};\nconsole.log(o.x);'],
 'read before the write':[['OS001@2'],'let o;\nconsole.log(o.x);\no = {};'],
 'a closure writes it':[[],'let o;\nconst init = () => { o = {}; };\ninit();\nconsole.log(o.x);'],
 'read in an uncalled function':[[],'const o = null;\nfunction f() { return o.x; }'],
 'number called':[['OS002@2'],'const n = 5;\nn();'],
 'object constructed':[['OS002@2'],'const config = {a: 1};\nnew config();'],
 'number method (no error)':[[],'const n = 5;\nconsole.log(n.toFixed(2));'],
 'shadowed undefined':[[],'function f(undefined) { const v = undefined; return v.x; }'],
 'written in a loop':[[],'let current = null;\nfor (const n of nodes) { current = n; }\nconsole.log(current.value);'],
 'inside try':[[],'const o = null;\ntry { o.x; } catch (e) {}'],
 'null on both branches':[['OS001@2'],'const o = null;\nif (c) { o.a; } else { o.b; }'],
 'parameter default':[[],'function f(o = null) { return o.x; }'],
};
test('the E4 corpus: definite where certain, silent where not (31 cases)',()=>{
 for(const [name,[want,source]] of Object.entries(CASES)){
  const result=runtimeSafety(ts,source,'javascript',{objectState:'local'});
  assert.equal(result.completeness,'within-supported-scope',name);
  assert.deepEqual(result.findings.map(f=>`${f.code}@${f.line}`),want,name);
 }
 assert.match(runtimeSafety(ts,'if (c) {\n  a(x);\n} else {\n  b(x);\n}\nlet x = 1;','javascript',{objectState:'local'}).findings[0].message,/minden ágon \(2\., 4\. sor\)/);
 assert.match(runtimeSafety(ts,'let o;\nconsole.log(o.name);','javascript',{objectState:'local'}).findings[0].message,/biztosan undefined \(1\. sor\).*„o\.name”.*TypeError/);
});

test('objectState off turns the object-state part off; the binding part always runs',()=>{
 assert.deepEqual(runtimeSafety(ts,'let o;\nconsole.log(o.name);','javascript',{objectState:'off'}).findings,[]);
 assert.deepEqual(runtimeSafety(ts,'console.log(x);\nconst x = 1;','javascript',{objectState:'off'}).findings.map(f=>f.code),['BS001']);
 assert.notEqual(resolveAuthorPolicy({language:'javascript',policy:{objectState:'off'}}).fingerprint,resolveAuthorPolicy({language:'javascript'}).fingerprint);
 assert.equal(resolveAuthorPolicy({language:'javascript'}).effective.objectState,'local','the plan’s default');
});

test('zero false positives on every real program of the repository with both analyses',()=>{
 const sources=[];
 for(const f of catalog())sources.push({id:f.id,language:f.language??'javascript',source:Array.isArray(f.source)?f.source.join('\n'):f.source});
 for(const kind of Object.keys(PROGRAM_KINDS))for(const language of ['javascript','typescript'])for(let seed=1;seed<=12;seed++){const p=PROGRAM_KINDS[kind](seed,{language});if(p)sources.push({id:kind+'-'+seed,language,source:p.source.join('\n')});}
 for(const f of readdirSync('examples').filter(f=>f.endsWith('.json')&&f!=='manifest.json')){const m=JSON.parse(readFileSync('examples/'+f,'utf8'));if(m.lines)sources.push({id:f,language:m.language,source:m.lines.map(l=>l.code).join('\n')});}
 for(const f of readdirSync('public/samples/typescript').filter(f=>f.endsWith('.ts')))sources.push({id:f,language:'typescript',source:readFileSync('public/samples/typescript/'+f,'utf8')});
 const flagged=sources.flatMap(s=>{const r=runtimeSafety(ts,s.source,s.language==='typescript'?'typescript':'javascript',{objectState:'local'});assert.equal(r.completeness,'within-supported-scope',s.id);return r.findings.map(f=>`${s.id}:${f.code}@${f.line}`);});
 assert.deepEqual(flagged,['wp6-self-referential-initializer:BS001@7']);
});

const dir=path.dirname(ts.getDefaultLibFilePath({}));
const auditor=createReferenceAuditor(ts,name=>{try{return readFileSync(path.join(dir,path.basename(name)),'utf8');}catch{return undefined;}});
test('the gate: an object-state finding blocks (also on Pages); a compiler report on the same line stays the only one',()=>{
 const js='let o;\nconsole.log(o.name);',policy=resolveAuthorPolicy({language:'javascript'});
 const blocked=sourceGate(auditor.audit(js,'javascript'),policy,runtimeSafety(ts,js,'javascript',{objectState:'local'}));
 assert.equal(blocked.verdict,'blocked');assert.match(blocked.message,/null\/undefined vagy nem hívható/);
 assert.equal(sourceGate(createReferenceAuditor(ts).audit(js,'javascript'),policy,runtimeSafety(ts,js,'javascript',{objectState:'local'})).verdict,'blocked','Pages');
 const typed='const n = 5;\nn();';
 const once=sourceGate(auditor.audit(typed,'typescript'),resolveAuthorPolicy({language:'typescript'}),runtimeSafety(ts,typed,'typescript',{objectState:'local'}));
 assert.equal(once.verdict,'blocked');assert.deepEqual(once.diagnostics.map(d=>d.code),['TS2349']);
});

test('server: the default policy refuses a certain null dereference at its line; objectState off admits it',async()=>{
 const catalog=new ExerciseCatalog(new Map()),source='function run() {\n  let found;\n  const label = found.name;\n  return label;\n}';
 await assert.rejects(catalog.createDraft({source,language:'javascript'}),error=>error.statusCode===422&&error.details.gate.diagnostics[0].code==='OS001'&&error.details.gate.diagnostics[0].line===3);
 const off=await catalog.createDraft({source,language:'javascript',policy:{objectState:'off'}});
 assert.equal(off.gate.verdict,'passed');assert.equal(off.policy.effective.objectState,'off');
});
