/** ADR-030: blocks whose boundary lines have interchangeable content (`}`) still prove a misplaced
 * line, and an otherwise unexplained rejection gets a verified single move. Every proven block
 * claim is re-checked by brute force over all content-consistent assignments with well-formed
 * blocks; every suggested move is re-checked by the validator. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {compileCodeLineExercise,diagnoseSubmission,validateSubmission,moveLine,discloseReport,channelFeedback} from '../dist/index.js';
import {objectFixtures} from './fixtures/object-programs.mjs';
import {program} from './support/move-search-programs.mjs';

const def=(tokens,blocks=[])=>({schemaVersion:1,id:'d',revision:1,language:'javascript',title:'',description:'',tokens,blocks});
const sub=(d,lines)=>({exerciseId:d.id,revision:d.revision,lines});
const moved=(lines,from,to)=>{const out=[...lines],[x]=out.splice(from,1);out.splice(to,0,x);return out;};
const mini=()=>{const m=generateCodeLineExercise({source:objectFixtures.get('prompt-mini-fixture').source.join('\n'),language:'typescript'},ts);return {model:m,compiled:compileCodeLineExercise(m).compiled,reference:m.lines.map(line=>line.code)};};

test('the reported case: a field moved into a setter body is proven to be in the wrong block',()=>{
 const {model,compiled,reference}=mini(),lines=moved(reference,4,6);
 assert.equal(lines[6].trim(),'score = 0;');assert.equal(lines[5].trim(),'set alias(value: string) {');
 const r=diagnoseSubmission(compiled,sub(model,lines));
 assert.equal(r.explained,true);
 const [d]=r.diagnostics;
 assert.deepEqual([d.code,d.certainty,d.positions,d.positionScope,d.references],['scope-boundary','proven',[6],'all',['n:5']]);
 assert.match(d.detail,/set alias\(value: string\) \{/);assert.match(d.evidence,/nyitó sora után zárul/);
});

test('a method body line moved into another method (all closers are `}`) is proven too',()=>{
 const m=generateCodeLineExercise({source:program(6),language:'typescript'},ts),compiled=compileCodeLineExercise(m).compiled,reference=m.lines.map(line=>line.code);
 const from=reference.findIndex(line=>line.includes('+ 1;')),to=reference.findIndex(line=>line.includes('+ 4;'));
 const r=diagnoseSubmission(compiled,sub(m,moved(reference,from,to)));
 assert.equal(r.verdict.status,'rejected');assert.equal(r.explained,true);
 assert.ok(r.diagnostics.some(d=>d.code==='scope-boundary'&&d.certainty==='proven'&&d.summary.includes('nem tartozhat ebbe a blokkba')));
});

test('a block member moved before its opener is proven outside the block',()=>{
 const d=def([{id:'o',code:'function f() {',scope:null},{id:'a',code:'a();',scope:'f'},{id:'c',code:'}',scope:null},{id:'p',code:'function g() {',scope:null},{id:'b',code:'b();',scope:'g'},{id:'q',code:'}',scope:null}],[{id:'f',open:'o',close:'c',parent:null},{id:'g',open:'p',close:'q',parent:null}]);
 const r=diagnoseSubmission(d,sub(d,['a();','function f() {','}','function g() {','b();','}']));
 assert.equal(r.explained,true);
 assert.ok(r.diagnostics.some(x=>x.code==='scope-boundary'&&x.positions[0]===0&&x.summary.includes('kívül áll')));
});

test('reversed boundaries: no block claim is made from a closer that precedes its opener',()=>{
 const d=def([{id:'o',code:'function f() {',scope:null},{id:'a',code:'a();',scope:'f'},{id:'c',code:'}',scope:null},{id:'z',code:'z();',scope:null}],[{id:'f',open:'o',close:'c',parent:null}]);
 const r=diagnoseSubmission(d,sub(d,['}','function f() {','a();','z();']));
 assert.equal(r.verdict.status,'rejected');
 // The reversed boundaries are the proven cause; the bounds make no one-line block claim about a().
 assert.ok(r.diagnostics.some(x=>x.rule&&x.rule.before==='o'&&x.rule.after==='c'&&x.certainty==='proven'));
 assert.ok(!r.diagnostics.some(x=>x.code==='scope-boundary'&&!x.rule&&(x.references.includes('a')||x.references.includes('z'))),'no reading of f is well formed, so nothing is claimed to be inside it');
});

// Brute force: every content-consistent assignment whose blocks open before they close.
function assignments(d,lines,wellFormed=true){
 const groups=new Map();d.tokens.forEach(t=>{const key=t.code.trim();groups.set(key,[...groups.get(key)??[],t.id]);});
 const slots=new Map();lines.forEach((line,p)=>{const key=line.trim();slots.set(key,[...slots.get(key)??[],p]);});
 const perms=items=>items.length<2?[items]:items.flatMap((x,i)=>perms(items.filter((_,j)=>j!==i)).map(rest=>[x,...rest]));
 let out=[new Map()];
 for(const [key,ids] of groups){const places=slots.get(key)??[];if(places.length!==ids.length)return [];out=out.flatMap(a=>perms(ids).map(order=>{const b=new Map(a);order.forEach((id,i)=>b.set(id,places[i]));return b;}));}
 return wellFormed?out.filter(a=>d.blocks.every(b=>a.get(b.open)<a.get(b.close))):out;
}
/** Whether token `id` stands inside its own block and inside no block it does not belong to. */
function placed(d,a,id){
 const token=d.tokens.find(t=>t.id===id),p=a.get(id),parent=new Map(d.blocks.map(b=>[b.id,b.parent]));
 const member=(scope,block)=>{for(let s=scope;s;s=parent.get(s)??null)if(s===block)return true;return false;};
 return d.blocks.every(b=>{if(b.open===id||b.close===id)return true;const inside=p>a.get(b.open)&&p<a.get(b.close);return inside===member(token.scope,b.id);});
}
const shapes=[
 def([{id:'o1',code:'function f() {',scope:null},{id:'a',code:'a();',scope:'f'},{id:'c1',code:'}',scope:null},{id:'o2',code:'function g() {',scope:null},{id:'b',code:'b();',scope:'g'},{id:'c2',code:'}',scope:null},{id:'z',code:'z();',scope:null}],
  [{id:'f',open:'o1',close:'c1',parent:null},{id:'g',open:'o2',close:'c2',parent:null}]),
 def([{id:'o1',code:'function f() {',scope:null},{id:'o2',code:'if (x) {',scope:'f'},{id:'a',code:'a();',scope:'i'},{id:'c2',code:'}',scope:'f'},{id:'b',code:'b();',scope:'f'},{id:'c1',code:'}',scope:null},{id:'z',code:'z();',scope:null}],
  [{id:'f',open:'o1',close:'c1',parent:null},{id:'i',open:'o2',close:'c2',parent:'f'}])
];
test('soundness by brute force: every proven block claim holds in every well-formed assignment',()=>{
 let claims=0,moves=0;
 for(const d of shapes){
  const reference=d.tokens.map(t=>t.code),n=reference.length;
  for(let f=0;f<n;f++)for(let t=0;t<n;t++)for(let g=0;g<n;g++)for(let u=0;u<n;u++){
   if(f===t)continue;const lines=g===u?moved(reference,f,t):moved(moved(reference,f,t),g,u);
   const r=diagnoseSubmission(d,sub(d,lines));if(r.verdict.status!=='rejected')continue;
   const all=assignments(d,lines),every=assignments(d,lines,false);
   for(const x of r.diagnostics){
    // A rule diagnostic: its rule is broken in every content-consistent assignment.
    if(x.rule&&x.certainty==='proven')assert.ok(every.every(a=>a.get(x.rule.before)>a.get(x.rule.after)),JSON.stringify({lines,diagnostic:x.summary}));
    // A block claim on one line: misplaced in every assignment whose blocks are well formed.
    if(x.code==='scope-boundary'&&!x.rule){claims++;const [id]=x.references,[p]=x.positions;assert.ok(all.every(a=>a.get(id)===p&&!placed(d,a,id)),JSON.stringify({lines,diagnostic:x.summary}));}
    // ADR-033: every suggested move sequence, applied in order, is accepted.
    if(x.code.endsWith('move-repair')){moves++;let fixed=lines;for(const m of x.fix.moves)fixed=moveLine(fixed,new Set(),m.from,m.to);assert.equal(validateSubmission(d,sub(d,fixed)).status,'accepted',JSON.stringify(lines));assert.equal(r.explained,false);assert.deepEqual(x.references,[]);}
   }
  }
 }
 assert.ok(claims>20&&moves>10,JSON.stringify({claims,moves}));
});

test('every rejected single move of the mini model is explained or gets a verified move',()=>{
 const {model,compiled,reference}=mini(),n=reference.length;let rejected=0,proven=0;
 for(let f=0;f<n;f++)for(let t=0;t<n;t+=3){
  if(f===t)continue;const lines=moved(reference,f,t);
  const r=diagnoseSubmission(compiled,sub(model,lines));if(r.verdict.status!=='rejected')continue;rejected++;
  if(r.explained){proven++;continue;}
  const m=r.diagnostics.find(d=>d.code==='single-move-repair');
  assert.ok(m,JSON.stringify({f,t}));
  assert.equal(validateSubmission(compiled,sub(model,moveLine(lines,new Set(),m.fix.move.from,m.fix.move.to))).status,'accepted');
 }
 assert.ok(proven/rejected>0.8,`${proven}/${rejected} proven`);
});

test('no single move: no suggestion, no budget notice, and the search stays bounded',()=>{
 const d=def([{id:'x1',code:'x = 1;',scope:null},{id:'x2',code:'x = 1;',scope:null},{id:'u',code:'use(x);',scope:null,after:['x1','x2']},{id:'v',code:'v();',scope:null},{id:'w',code:'w();',scope:null,after:['v']},{id:'e',code:'end();',scope:null,after:['u','w']}],[]);
 const lines=['x = 1;','use(x);','x = 1;','end();','w();','v();'];
 const r=diagnoseSubmission(d,sub(d,lines));
 assert.equal(r.verdict.status,'rejected');
 assert.ok(!r.diagnostics.some(x=>x.code==='single-move-repair'||x.code==='diagnostic-budget'),JSON.stringify(r.diagnostics.map(x=>x.code)));
 // An exhausted allowance only drops the suggestion.
 const tiny=diagnoseSubmission(d,sub(d,['x = 1;','use(x);','end();','x = 1;','v();','w();']),{moveSearchStates:1});
 assert.ok(!tiny.diagnostics.some(x=>x.code==='single-move-repair'));
});

test('fixed slots: the suggested move never takes or leaves a fixed slot',()=>{
 const d=def([{id:'x1',code:'x = 1;',scope:null},{id:'k',code:'keep();',scope:null,fixedPosition:1},{id:'x2',code:'x = 1;',scope:null},{id:'u',code:'use(x);',scope:null,after:['x1','x2']},{id:'e',code:'end();',scope:null}]);
 const lines=['x = 1;','keep();','use(x);','end();','x = 1;'];
 const r=diagnoseSubmission(d,sub(d,lines)),m=r.diagnostics.find(x=>x.code==='single-move-repair');
 assert.ok(m);assert.ok(m.fix.move.from!==1&&m.fix.move.to!==1);
 assert.equal(validateSubmission(d,sub(d,moveLine(lines,new Set([1]),m.fix.move.from,m.fix.move.to))).status,'accepted');
});

test('disclosure: the learner sees which line may move, the target only from the rules level',()=>{
 const d=def([{id:'x1',code:'x = 1;',scope:null},{id:'x2',code:'x = 1;',scope:null},{id:'u',code:'use(x);',scope:null,after:['x1','x2']},{id:'e',code:'end();',scope:null}]);
 const report=diagnoseSubmission(d,sub(d,['x = 1;','use(x);','end();','x = 1;']));
 const at=level=>discloseReport(report,level).diagnostics.find(x=>x.code==='single-move-repair');
 assert.equal(at('verdict'),undefined);
 assert.ok(at('positions'));assert.equal(at('positions').fix,undefined);
 assert.equal(at('rules').fix.level,'verified');assert.equal(at('provenance').fix.level,'verified');
 const {author,learner}=channelFeedback(report,'author-preview');
 assert.ok(author.diagnostics.find(x=>x.code==='single-move-repair').fix);assert.equal(learner.diagnostics.find(x=>x.code==='single-move-repair').fix,undefined);
});

test('performance: at the 500-row limit a diagnosis without any single-move fix stays bounded',()=>{
 const m=generateCodeLineExercise({source:program(123),language:'typescript'},ts),compiled=compileCodeLineExercise(m).compiled,reference=m.lines.map(line=>line.code);
 assert.equal(reference.length,499);
 // Two closing braces moved far apart: no single move repairs both.
 const lines=moved(moved(reference,4,60),300,120);
 const start=performance.now(),r=diagnoseSubmission(compiled,sub(m,lines)),ms=performance.now()-start;
 assert.equal(r.verdict.status,'rejected');
 // Measured about 0.12 s locally; the budget leaves headroom for a loaded CI machine.
 assert.ok(ms<2000,`${Math.round(ms)} ms`);
});

// ADR-033: two independent ambiguous errors; no single move repairs them, two do.
const twoGroups=def([{id:'x1',code:'x = 1;',scope:null},{id:'x2',code:'x = 1;',scope:null},{id:'u',code:'use(x);',scope:null,after:['x1','x2']},{id:'y1',code:'y = 1;',scope:null},{id:'y2',code:'y = 1;',scope:null},{id:'v',code:'use(y);',scope:null,after:['y1','y2']}]);
const twoErrors=['x = 1;','use(x);','x = 1;','y = 1;','use(y);','y = 1;'];

test('two moves: a verified sequence when no single move is accepted, naming no culprit',()=>{
 const r=diagnoseSubmission(twoGroups,sub(twoGroups,twoErrors));
 assert.equal(r.explained,false);
 assert.deepEqual(r.diagnostics.map(x=>x.code),['unexplained-rejection','two-move-repair']);
 const m=r.diagnostics[1];
 assert.deepEqual([m.certainty,m.severity,m.references,m.positionScope,m.positions.length,m.fix.moves.length],['general','notice',[],'some',2,2]);
 assert.deepEqual(m.fix.move,m.fix.moves[0]);
 for(const single of [0,1,2,3,4,5])for(let to=0;to<6;to++)if(to!==single)assert.equal(validateSubmission(twoGroups,sub(twoGroups,moveLine(twoErrors,new Set(),single,to))).accepted,false,'no single move repairs it');
 let fixed=twoErrors;for(const step of m.fix.moves)fixed=moveLine(fixed,new Set(),step.from,step.to);
 assert.equal(validateSubmission(twoGroups,sub(twoGroups,fixed)).status,'accepted');
});

test('two moves: a single move keeps its one-element sequence, and the disclosure rule covers both',()=>{
 const one=def([{id:'x1',code:'x = 1;',scope:null},{id:'x2',code:'x = 1;',scope:null},{id:'u',code:'use(x);',scope:null,after:['x1','x2']},{id:'e',code:'end();',scope:null}]);
 const s=diagnoseSubmission(one,sub(one,['x = 1;','use(x);','end();','x = 1;'])).diagnostics.find(x=>x.code==='single-move-repair');
 assert.deepEqual(s.fix.moves,[s.fix.move]);
 const report=diagnoseSubmission(twoGroups,sub(twoGroups,twoErrors)),at=level=>discloseReport(report,level).diagnostics.find(x=>x.code==='two-move-repair');
 assert.equal(at('verdict'),undefined);assert.ok(at('positions'));assert.equal(at('positions').fix,undefined);
 assert.equal(at('rules').fix.moves.length,2);
});

test('two moves: fixed slots are never moved, and an exhausted allowance only drops the suggestion',()=>{
 const pinned=def([...twoGroups.tokens.slice(0,3),{id:'k',code:'keep();',scope:null,fixedPosition:3},...twoGroups.tokens.slice(3)]);
 const lines=['x = 1;','use(x);','x = 1;','keep();','y = 1;','use(y);','y = 1;'];
 const m=diagnoseSubmission(pinned,sub(pinned,lines)).diagnostics.find(x=>x.code==='two-move-repair');
 assert.ok(m);
 let fixed=lines;for(const step of m.fix.moves){assert.ok(step.from!==3&&step.to!==3);fixed=moveLine(fixed,new Set([3]),step.from,step.to);}
 assert.equal(validateSubmission(pinned,sub(pinned,fixed)).status,'accepted');
 const tiny=diagnoseSubmission(twoGroups,sub(twoGroups,twoErrors),{moveSearchStates:1});
 assert.ok(!tiny.diagnostics.some(x=>x.code.endsWith('move-repair')||x.code==='diagnostic-budget'));
});
