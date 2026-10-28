/** ADR-023 / E1: explainable validation. The validator stays the only judge; every proven
 * diagnostic must hold under every content-consistent assignment, and ambiguity falls back
 * to a general explanation (epic 06, regressions 09.4, metamorphic checks 09.5). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {examples,compileDefinition,compileCodeLineExercise,compileCodeLineExerciseV3,diagnoseSubmission,validateSubmission,moveLine,codeLineDiagnosticReasons,ruleKey,disclosureLevels,discloseReport} from '../dist/index.js';
import {suiteExercise,permutations} from './fixtures/language-ir.mjs';

const def=(tokens,extra={})=>({schemaVersion:1,id:'d',revision:1,language:'javascript',title:'',description:'',tokens,blocks:[],...extra});
const sub=(d,lines)=>({exerciseId:d.id,revision:d.revision,lines});
const diagnose=(d,lines,opts)=>diagnoseSubmission(d,sub(d,lines),opts);
const codes=r=>r.diagnostics.map(x=>x.code);
const proven=r=>r.diagnostics.filter(x=>x.certainty==='proven');

const chain=def([{id:'a',code:'const a = 1;',scope:null},{id:'b',code:'const b = a + 1;',scope:null,after:['a']},{id:'c',code:'log(b);',scope:null,after:['b']}]);

test('accepted: no diagnostics at all, and the report carries the verdict unchanged',()=>{
 const r=diagnose(chain,['const a = 1;','const b = a + 1;','log(b);']);
 assert.equal(r.verdict.status,'accepted');assert.deepEqual(r.diagnostics,[]);assert.equal(r.explained,true);
});

test('simple a → b violation: both lines named, rule cited, the fix is checked by the validator',()=>{
 const lines=['const b = a + 1;','const a = 1;','log(b);'];
 const r=diagnose(chain,lines);
 assert.equal(r.verdict.status,'rejected');assert.deepEqual(codes(r),['order-direct']);
 const [d]=r.diagnostics;
 assert.deepEqual([d.positions,d.positionScope,d.references,d.certainty],[[0,1],'all',['a','b'],'proven']);
 assert.deepEqual([d.rule.before,d.rule.after,d.rule.origins],['a','b',['dependency']]);
 assert.equal(d.fix.level,'verified');
 const fixed=moveLine(lines,new Set(),d.fix.move.from,d.fix.move.to);
 assert.equal(validateSubmission(chain,sub(chain,fixed)).status,'accepted','a verified fix is really accepted');
 assert.doesNotMatch(d.detail,/adatot|olvas|mellékhatás|futás/,'no semantic reason without provenance');
 assert.equal(d.disclosure,'rules');
});

test('transitive a → b → c: named only when no direct rule on the chain is proven, with the chain',()=>{
 const d=def([{id:'a',code:'x();',scope:null},{id:'b1',code:'y();',scope:null,after:['a']},{id:'b2',code:'y();',scope:null},{id:'c',code:'z();',scope:null,after:['b1']}]);
 const r=diagnose(d,['y();','z();','x();','y();']);
 assert.equal(r.verdict.status,'rejected');assert.deepEqual(codes(r),['order-transitive']);
 const [t]=r.diagnostics;
 assert.deepEqual([t.positions,t.references,t.rule.path],[[1,2],['a','c'],['a','b1','c']]);
 // With a forced middle line the direct violation explains it; the transitive pair is not repeated.
 const plain=diagnose(chain,['log(b);','const b = a + 1;','const a = 1;']);
 assert.deepEqual(codes(plain).sort(),['order-direct','order-direct']);
});

test('same content, different reference IDs: never names one of the identical lines',()=>{
 const d=def([{id:'x1',code:'x = 1;',scope:null},{id:'x2',code:'x = 1;',scope:null},{id:'u',code:'use(x);',scope:null,after:['x1']}]);
 const r=diagnose(d,['use(x);','x = 1;','x = 1;']);
 const [p]=r.diagnostics;
 assert.equal(p.certainty,'proven');assert.equal(p.positionScope,'some');
 assert.deepEqual(p.references,['u'],'only the unambiguous line has a proven identity');
 assert.ok(p.limits);assert.equal(p.fix.level,'guidance','no move is offered for an unidentified line');
});

test('several consistent bijections: a general explanation, no arbitrary culprit',()=>{
 const d=def([{id:'x1',code:'x = 1;',scope:null},{id:'x2',code:'x = 1;',scope:null},{id:'u',code:'use(x);',scope:null,after:['x1','x2']},{id:'e',code:'end();',scope:null}]);
 const r=diagnose(d,['x = 1;','use(x);','end();','x = 1;']);
 assert.equal(r.verdict.status,'rejected');
 assert.deepEqual(codes(r),['unexplained-rejection']);
 const [g]=r.diagnostics;
 assert.deepEqual([g.certainty,g.positions,g.references],['general',[],[]]);
 assert.match(g.detail,/azonos tartalmú/);assert.equal(r.explained,false);
});

test('OR profiles: a conflict in one profile is not a global proof; all profiles failing is',()=>{
 const tokens=[{id:'a',code:'a();',scope:null},{id:'b',code:'b();',scope:null},{id:'c',code:'c();',scope:null}];
 const d=def(tokens,{profiles:[{id:'p1',edges:[{before:'a',after:'b'}]},{id:'p2',edges:[{before:'c',after:'a'}]}]});
 assert.equal(diagnose(d,['b();','c();','a();']).verdict.status,'accepted');
 const r=diagnose(d,['b();','a();','c();']);
 assert.deepEqual(codes(r),['profile-conflict','profile-conflict']);
 assert.deepEqual(r.diagnostics.map(x=>x.rule.profile),['p1','p2']);
 // p1 fails provably, p2 fails only through ambiguity: no proven cause may be named.
 const amb=def([{id:'x1',code:'x = 1;',scope:null},{id:'x2',code:'x = 1;',scope:null},{id:'u',code:'use(x);',scope:null},{id:'e',code:'end();',scope:null}],
  {profiles:[{id:'p1',edges:[{before:'e',after:'u'}]},{id:'p2',edges:[{before:'x1',after:'u'},{before:'x2',after:'u'}]}]});
 const m=diagnose(amb,['x = 1;','use(x);','end();','x = 1;']);
 assert.equal(m.verdict.status,'rejected');assert.deepEqual(proven(m),[]);assert.deepEqual(codes(m),['unexplained-rejection']);
});

test('fixed slots: a fixed line moved away, and content that may stand only at its fixed slot',()=>{
 const model={schemaVersion:2,id:'f',revision:1,language:'javascript',title:'',description:'',blocks:[],lines:[
  {id:1,code:'start();',dependencies:[],fixed:true,functionBlock:0,scopeId:null},{id:2,code:'a();',dependencies:[],fixed:false,functionBlock:0,scopeId:null},{id:3,code:'b();',dependencies:[],fixed:false,functionBlock:0,scopeId:null}]};
 const {compiled}=compileCodeLineExercise(model);
 const r=diagnoseSubmission(compiled,{exerciseId:'f',revision:1,lines:['a();','start();','b();']});
 assert.deepEqual(codes(r),['fixed-position','fixed-position']);
 assert.deepEqual(r.diagnostics[0].references,['n:1']);assert.deepEqual(r.diagnostics.map(x=>x.positions),[[0],[1]]);
 assert.equal(moveLine(['s','a','b'],new Set([0]),0,2),null,'a fixed slot never moves');
 assert.deepEqual(moveLine(['s','a','b','c'],new Set([0]),3,1),['s','c','a','b'],'insert, shifting movable neighbours');
});

test('scope: a member outside its block, and a foreign line inside a block',()=>{
 const flex=examples[1];
 const out=diagnose(flex,["const name = 'Ada';",'function makeUser() {','const active = true;','return { name, active };','}']);
 assert.ok(out.diagnostics.some(x=>x.code==='scope-boundary'&&x.positions.includes(0)),JSON.stringify(out.diagnostics));
 const d=def([{id:'o',code:'function f() {',scope:null},{id:'m',code:'a();',scope:'f'},{id:'c',code:'}',scope:null},{id:'g',code:'b();',scope:null}],{blocks:[{id:'f',open:'o',close:'c',parent:null}]});
 const r=diagnose(d,['function f() {','b();','a();','}']);
 assert.deepEqual(codes(r),['scope-boundary']);assert.deepEqual(r.diagnostics[0].positions,[1]);assert.match(r.diagnostics[0].summary,/nem tartozhat/);
});

test('multiplicity: extra and missing content are named per content group, never per line',()=>{
 const r=diagnose(chain,['const a = 1;','const a = 1;','log(b);']);
 assert.equal(r.verdict.reason,'wrong_multiplicity');
 assert.deepEqual(codes(r).sort(),['extra-line','missing-line']);
 const extra=r.diagnostics.find(x=>x.code==='extra-line');assert.deepEqual([extra.positions,extra.positionScope],[[0,1],'some']);
 const short=diagnose(chain,['const a = 1;','log(b);']);
 assert.equal(short.verdict.reason,'wrong_length');assert.deepEqual(codes(short),['missing-line']);
 // One mixed group: two exact-whitespace tokens and an indent token. The '  x' line could be
 // any of them, but both 'x' lines need the single indent token, so no complete matching exists.
 const mixed=def([{id:'e1',code:'  x',scope:null,normalization:'exact'},{id:'e2',code:'  x',scope:null,normalization:'exact'},{id:'i',code:'x',scope:null}]);
 const m=diagnose(mixed,['  x','x','x']);
 assert.equal(m.verdict.status,'rejected');assert.deepEqual(codes(m),['wrong-multiplicity']);assert.equal(m.diagnostics[0].positionScope,'some');
 assert.equal(diagnose(mixed,['  x','  x','x']).verdict.status,'accepted');
 const starved=diagnose(mixed,['  x','x','x'],{maxSteps:14}); // runs out inside the matching
 assert.ok(!codes(starved).includes('wrong-multiplicity'),'an unfinished matching proves nothing');assert.equal(codes(starved).at(-1),'diagnostic-budget');
 // Different groups stay apart: an indent line never stands for an exact-whitespace token.
 const split=diagnose(def([{id:'e',code:'  x',scope:null,normalization:'exact'},{id:'i',code:'x',scope:null}]),['x','x']);
 assert.deepEqual(codes(split).sort(),['extra-line','missing-line']);
 const unknown=diagnose(chain,['const a = 1;','evil();','log(b);']);
 assert.ok(codes(unknown).includes('unknown-content'));assert.deepEqual(unknown.diagnostics.find(x=>x.code==='unknown-content').positions,[1]);
});

test('v3: a split multi-line unit and a line outside its container',()=>{
 const m=suiteExercise(),c=compileCodeLineExerciseV3(m).compiled,[h,a1,a2,a3,use,done]=m.ir.lines.map(l=>l.code);
 const split=diagnoseSubmission(c,{exerciseId:'fixture',revision:1,lines:[h,a1,use,a2,a3,done]});
 assert.equal(split.verdict.status,'rejected');assert.deepEqual(codes(split),['unit-split']);assert.deepEqual(split.diagnostics[0].positions,[1,3,4]);
 const outside=diagnoseSubmission(c,{exerciseId:'fixture',revision:1,lines:[h,a1,a2,a3,done,use]});
 assert.equal(outside.verdict.status,'rejected');assert.ok(codes(outside).includes('scope-boundary'),JSON.stringify(outside.diagnostics));
});

test('invalid reference and indeterminate: never blamed on the learner',()=>{
 const bad=diagnose({...chain,tokens:[]},['x']);
 assert.equal(bad.verdict.status,'invalid_reference');assert.deepEqual(codes(bad),['invalid-reference']);assert.equal(bad.diagnostics[0].severity,'notice');
 const sum=examples[0],lines=sum.tokens.map(t=>t.code);
 const open=diagnose(sum,lines,{maxStates:1});
 assert.equal(open.verdict.status,'indeterminate');assert.deepEqual(codes(open),['search-budget']);
 assert.ok(open.diagnostics.every(x=>x.severity==='notice'));
});

test('diagnostic budget: exhaustion keeps the verdict and claims no false certainty',()=>{
 const lines=['const b = a + 1;','const a = 1;','log(b);'];
 const r=diagnose(chain,lines,{maxSteps:3});
 assert.equal(r.budget.exhausted,true);assert.ok(r.budget.used<=r.budget.limit);
 assert.deepEqual(r.verdict,validateSubmission(chain,sub(chain,lines)));
 assert.equal(codes(r).at(-1),'diagnostic-budget');
 assert.ok(r.diagnostics.every(x=>x.code==='diagnostic-budget'||x.certainty==='proven'));
});

test('partial versus verified fix: removing one conflict is not presented as a full repair',()=>{
 const d=def([{id:'a',code:'a();',scope:null},{id:'b',code:'b();',scope:null,after:['a']},{id:'c',code:'c();',scope:null},{id:'e',code:'e();',scope:null,after:['c']}]);
 const r=diagnose(d,['b();','a();','e();','c();']);
 assert.deepEqual(codes(r),['order-direct','order-direct']);
 for(const x of r.diagnostics){assert.equal(x.fix.level,'partial');assert.match(x.fix.text,/más hiba/);}
});

test('provenance: a reason appears only from bound provenance, and it never changes the verdict',()=>{
 const model={schemaVersion:2,id:'p',revision:1,language:'javascript',title:'',description:'',blocks:[],lines:[
  {id:1,code:'a();',dependencies:[],fixed:false,functionBlock:0,scopeId:null},{id:2,code:'b();',dependencies:[1],fixed:false,functionBlock:0,scopeId:null}]};
 const {compiled}=compileCodeLineExercise(model);
 assert.equal(codeLineDiagnosticReasons(model).size,0,'a model without provenance has no reasons');
 const lines=['b();','a();'];
 const plain=diagnoseSubmission(compiled,sub(compiled.definition,lines));
 const reasons=new Map([[ruleKey('n:1','n:2'),['author']]]);
 const told=diagnoseSubmission(compiled,sub(compiled.definition,lines),{reasons});
 assert.deepEqual(told.verdict,plain.verdict);
 assert.deepEqual([plain.diagnostics[0].code,told.diagnostics[0].code],['order-direct','pedagogical-rule']);
 assert.match(told.diagnostics[0].detail,/feladat készítője/);assert.equal(told.diagnostics[0].disclosure,'provenance');
 assert.deepEqual(disclosureLevels,['verdict','positions','rules','provenance']);
});

/** Every content-consistent bijection of a small submission: the ground truth a proof must hold in. */
function bijections(d,lines){
 const keys=d.tokens.map(t=>t.normalization==='exact'?t.code:t.code.replace(/^[ \t]*/,''));
 const out=[],used=new Set(),assignment=[];
 (function walk(p){
  if(p===lines.length){out.push([...assignment]);return;}
  d.tokens.forEach((t,i)=>{if(used.has(i)||keys[i]!==lines[p].replace(/^[ \t]*/,''))return;if(t.fixedPosition!==undefined&&t.fixedPosition!==p)return;used.add(i);assignment[p]=t.id;walk(p+1);used.delete(i);});
 })(0);
 return out;
}

test('metamorphic: on every permutation of the examples the verdict is untouched and each proven rule conflict holds in every bijection',()=>{
 for(const d of examples){
  const all=d.tokens.map(t=>t.code);
  const orders=d.tokens.length<=7?[...permutations(all)]:Array.from({length:400},(_,k)=>{const a=[...all];let s=k+1;for(let i=a.length-1;i>0;i--){s=(s*48271)%2147483647;const j=s%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;});
  for(const lines of orders){
   const r=diagnose(d,lines),v=validateSubmission(d,sub(d,lines));
   assert.deepEqual(r.verdict,v);
   if(v.accepted){assert.deepEqual(r.diagnostics,[]);continue;}
   assert.ok(r.diagnostics.length,'a rejection is always explained, at least generally');
   const witnesses=bijections(d,lines);
   for(const x of proven(r)){
    if(x.rule&&!x.rule.profile){for(const w of witnesses)assert.ok(w.indexOf(x.rule.before)>w.indexOf(x.rule.after),`${d.id}: ${x.code} must hold in every bijection`);}
    for(const id of x.references)assert.ok(x.positions.some(p=>witnesses.every(w=>w[p]===id)),`${d.id}: ${id} must stand at one named position in every bijection`);
    if(x.fix?.level==='verified')assert.equal(validateSubmission(d,sub(d,moveLine(lines,new Set(),x.fix.move.from,x.fix.move.to))).status,'accepted');
   }
  }
 }
});

test('metamorphic: renaming token IDs changes neither the verdict nor the diagnostic codes and positions',()=>{
 const sum=examples[0],rename=id=>'r-'+id.split('').reverse().join('');
 const renamed={...sum,tokens:sum.tokens.map(t=>({...t,id:rename(t.id),...(t.after?{after:t.after.map(rename)}:{})})),blocks:sum.blocks.map(b=>({...b,open:rename(b.open),close:rename(b.close)}))};
 const lines=[sum.tokens[0].code,sum.tokens[2].code,sum.tokens[1].code,...sum.tokens.slice(3).map(t=>t.code)];
 const a=diagnose(sum,lines),b=diagnose(renamed,lines);
 assert.equal(a.verdict.status,b.verdict.status);
 assert.deepEqual(a.diagnostics.map(x=>[x.code,x.positions]),b.diagnostics.map(x=>[x.code,x.positions]));
});

test('500 lines: a chain and a heavily duplicated model stay inside the explicit budget',()=>{
 const n=500,tokens=Array.from({length:n},(_,i)=>({id:'t'+i,code:`s${i}();`,scope:null,...(i?{after:['t'+(i-1)]}:{})}));
 const big=def(tokens),compiled=compileDefinition(big),lines=tokens.map(t=>t.code);[lines[100],lines[400]]=[lines[400],lines[100]];
 let t0=performance.now();const r=diagnoseSubmission(compiled,sub(big,lines));const chainMs=performance.now()-t0;
 assert.equal(r.verdict.status,'rejected');assert.ok(r.diagnostics.length>=1&&r.diagnostics.length<=12);
 assert.ok(proven(r).length&&r.budget.used<=r.budget.limit,JSON.stringify(r.budget));
 const dup=def(Array.from({length:n},(_,i)=>({id:'d'+i,code:i%2?'x();':`y${i}();`,scope:null,...(i>1?{after:['d'+(i-2)]}:{})})));
 const dlines=dup.tokens.map(t=>t.code).reverse();
 t0=performance.now();const d=diagnoseSubmission(compileDefinition(dup),sub(dup,dlines),{maxSteps:2_000_000});const dupMs=performance.now()-t0;
 assert.notEqual(d.verdict.status,'accepted');assert.ok(d.budget.used<=d.budget.limit);
 assert.ok(d.diagnostics.length<=13);
 console.log(`diagnostics 500 lines: chain ${chainMs.toFixed(0)} ms (${r.budget.used} steps), duplicated ${dupMs.toFixed(0)} ms (${d.budget.used} steps, ${d.verdict.status})`);
 assert.ok(chainMs<5000&&dupMs<5000);
});

test('disclosure (ADR-026): a level withholds what it may not show, keeps a general line and never the verdict',()=>{
 const lines=['const b = a + 1;','const a = 1;','log(b);'],report=diagnose(chain,lines);
 const author=discloseReport(report,'provenance'),learner=discloseReport(report,'positions');
 assert.deepEqual(author.diagnostics,report.diagnostics);assert.equal(author.withheld,0);
 assert.equal(learner.withheld,1);assert.deepEqual(learner.diagnostics.map(d=>[d.code,d.certainty,d.disclosure]),[['withheld','general','verdict']]);
 assert.equal(learner.diagnostics[0].summary,report.verdict.message);assert.equal(learner.explained,false);
 assert.ok(!JSON.stringify(learner).includes('"rule"'),'no rule in the learner view');
 const unknown=discloseReport(diagnose(chain,['const a = 1;','evil();','log(b);']),'positions');
 assert.ok(unknown.diagnostics.some(d=>d.code==='unknown-content'),'a content mark is learner-visible');
 assert.deepEqual(discloseReport(diagnose(chain,['const a = 1;','const b = a + 1;','log(b);']),'verdict'),{level:'verdict',diagnostics:[],explained:true,withheld:0});
});
