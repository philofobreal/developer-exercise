/** ADR-036: the witness search skips only branches without a solution or mirrored by an
 * earlier candidate. Evidence: an independent brute force on small random models (every
 * distinct submission), the frozen pre-ADR search on generated v2 and v3 models (same verdict,
 * same witness, never more states) and a stress suite of identical rows and blocks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {validateSubmission,compileCodeLineExercise,upgradeCodeLineExerciseV2,compileCodeLineExerciseV3} from '../dist/index.js';
import {matchContent} from '../dist/content-match.js';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {validateSubmissionBaseline} from './support/validator-baseline.mjs';
import {random,extensions,codesOf} from './support/semantic-oracle.mjs';

const submission=(def,lines)=>({exerciseId:def.id,revision:def.revision,lines});
const pick=(rng,items)=>items[Math.floor(rng()*items.length)];

/** Exists a bijection position → token with equal code, its fixed slot, a valid bracket
 * structure and every edge of one profile? Positions are filled left to right. */
function bruteForce(def,lines){
 const n=def.tokens.length,index=new Map(def.tokens.map((token,i)=>[token.id,i]));
 const opens=new Map(def.blocks.map(block=>[index.get(block.open),block.id])),closes=new Map(def.blocks.map(block=>[index.get(block.close),block.id]));
 const base=def.tokens.flatMap((token,i)=>(token.after??[]).map(before=>[index.get(before),i]));
 for(const edge of def.edges??[])base.push([index.get(edge.before),index.get(edge.after)]);
 const profiles=(def.profiles?.length?def.profiles:[{edges:[]}]).map(profile=>[...base,...profile.edges.map(edge=>[index.get(edge.before),index.get(edge.after)])]);
 return profiles.some(edges=>{
  const position=new Int32Array(n).fill(-1),stack=[];
  const place=at=>{
   if(at===n)return stack.length===0;
   for(let token=0;token<n;token++){
    const t=def.tokens[token];
    if(position[token]>=0||t.code!==lines[at]||t.fixedPosition!==undefined&&t.fixedPosition!==at)continue;
    if(edges.some(([before,after])=>after===token&&position[before]<0||before===token&&position[after]>=0))continue;
    const closing=closes.get(token),saved=[...stack];
    if(closing!==undefined){if(stack.at(-1)!==closing)continue;stack.pop();}
    if(t.scope!==(stack.at(-1)??null)){stack.splice(0,stack.length,...saved);continue;}
    if(opens.has(token))stack.push(opens.get(token));
    position[token]=at;
    if(place(at+1))return true;
    position[token]=-1;stack.splice(0,stack.length,...saved);
   }
   return false;
  };
  return place(0);
 });
}

/** A small definition with few distinct codes, so rows and whole blocks repeat. */
function randomDefinition(seed){
 const rng=random(seed),size=4+seed%4,tokens=[],blocks=[];
 const token=(code,scope)=>{const t={id:'t'+tokens.length,code,scope};tokens.push(t);return t;};
 const fill=(scope,depth,budget)=>{
  while(budget>0){
   if(depth<2&&budget>=2&&rng()<0.45){
    const inner=Math.floor(rng()*(budget-1)),block={id:'b'+blocks.length,open:token(pick(rng,['{','if (x) {']),scope).id,close:'',parent:scope};
    blocks.push(block);fill(block.id,depth+1,inner);block.close=token('}',scope).id;budget-=inner+2;
   }else{token(pick(rng,['a;','b;','a;']),scope);budget--;}
  }
 };
 fill(null,0,size);
 // Forward edges keep the reference valid; a second profile may contradict the first.
 for(let j=1;j<tokens.length;j++)for(let i=0;i<j;i++)if(rng()<0.12)(tokens[j].after??=[]).push(tokens[i].id);
 const def={schemaVersion:1,id:'random-'+seed,revision:1,language:'javascript',title:'',description:'',tokens,blocks};
 if(rng()<0.3){const k=Math.floor(rng()*tokens.length);tokens[k].fixedPosition=k;}
 if(rng()<0.3){
  const forward=[],backward=[];
  for(let j=1;j<tokens.length;j++)for(let i=0;i<j;i++)if(rng()<0.15)(rng()<0.5?forward:backward).push(i,j);
  def.profiles=[{id:'p',edges:pairs(forward,false)},{id:'q',edges:pairs(backward,true)}];
 }
 function pairs(list,reversed){const edges=[];for(let i=0;i<list.length;i+=2){const [a,b]=reversed?[list[i+1],list[i]]:[list[i],list[i+1]];edges.push({before:tokens[a].id,after:tokens[b].id});}return edges;}
 // The search must not rely on tokens listed in reference order.
 if(rng()<0.3)for(let i=tokens.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[tokens[i],tokens[j]]=[tokens[j],tokens[i]];}
 return def;
}
function distinctPermutations(items){
 const sorted=[...items].sort(),out=[],used=new Array(sorted.length).fill(false),current=[];
 const walk=()=>{
  if(current.length===sorted.length){out.push([...current]);return;}
  for(let i=0;i<sorted.length;i++){
   if(used[i]||i>0&&sorted[i]===sorted[i-1]&&!used[i-1])continue;
   used[i]=true;current.push(sorted[i]);walk();current.pop();used[i]=false;
  }
 };
 walk();return out;
}
/** Same verdict and witness as the frozen search wherever it decided, never more states. */
function assertNoWorse(compiled,lines,label,maxStates=50_000){
 const now=validateSubmission(compiled,submission(compiled.definition??compiled,lines),{maxStates});
 const old=validateSubmissionBaseline(compiled,submission(compiled.definition??compiled,lines),{maxStates});
 if(old.status!=='indeterminate'){
  assert.equal(now.status,old.status,label);
  assert.deepEqual([now.matchedProfile,now.matchedTokenIds],[old.matchedProfile,old.matchedTokenIds],label);
 }
 assert.ok(now.exploredStates<=old.exploredStates,`${label}: ${now.exploredStates} > ${old.exploredStates}`);
 return now;
}

test('exhaustive: on 200 small random models every distinct submission gets the brute-force verdict',()=>{
 let models=0,submissions=0,accepted=0,symmetric=0;
 for(let seed=1;seed<=200;seed++){
  const def=randomDefinition(seed),codes=def.tokens.map(token=>token.code);
  if(validateSubmission(def,submission(def,codes)).status==='invalid_reference')continue;
  models++;if(def.blocks.length>1&&new Set(def.blocks.map(block=>def.tokens.find(t=>t.id===block.open).code)).size<def.blocks.length)symmetric++;
  for(const lines of distinctPermutations(codes)){
   const expected=bruteForce(def,lines)?'accepted':'rejected',now=assertNoWorse(def,lines,`seed ${seed}: ${lines.join(' ')}`,1_000_000);
   assert.equal(now.status,expected,`seed ${seed}: ${lines.join(' ')}`);
   submissions++;if(expected==='accepted')accepted++;
  }
 }
 assert.ok(models>=180&&submissions>25_000&&accepted>500&&symmetric>30,JSON.stringify({models,submissions,accepted,symmetric}));
});

// Named edge cases, each checked against the brute force on every distinct submission.
const block=(id,open,body,scope=null)=>[{id:id+'o',code:open,scope},...body.map((code,i)=>({id:id+i,code,scope:id})),{id:id+'c',code:'}',scope}];
const blockDef=(id,open,parent=null)=>({id,open:id+'o',close:id+'c',parent});
const edgeCases={
 'identical blocks, an outside edge into one of them breaks the exchange':{tokens:[...block('x','{',['a;']),...block('y','{',['a;']),{id:'z',code:'z;',scope:null,after:['x0']}],blocks:[blockDef('x','{'),blockDef('y','{')]},
 'identical blocks, a fixed slot inside one of them':{tokens:[...block('x','{',['a;']),...block('y','{',['a;']),{id:'z',code:'z;',scope:null}].map(t=>t.id==='y0'?{...t,fixedPosition:4}:t),blocks:[blockDef('x','{'),blockDef('y','{')]},
 'identical blocks exchangeable in one profile only':{tokens:[...block('x','{',['a;']),...block('y','{',['a;']),{id:'z',code:'z;',scope:null}],blocks:[blockDef('x','{'),blockDef('y','{')],profiles:[{id:'free',edges:[]},{id:'pinned',edges:[{before:'y0',after:'z'},{before:'z',after:'x0'}]}]},
 'identical blocks with tokens listed out of reference order':{tokens:[...block('x','{',['a;','a;']),...block('y','{',['a;','a;'])].reverse(),blocks:[blockDef('x','{'),blockDef('y','{')]},
 'identical blocks nested in identical blocks':{tokens:[{id:'po',code:'{',scope:null},{id:'pio',code:'{',scope:'p'},{id:'pi0',code:'a;',scope:'pi'},{id:'pic',code:'}',scope:'p'},{id:'pc',code:'}',scope:null},{id:'qo',code:'{',scope:null},{id:'qio',code:'{',scope:'q'},{id:'qi0',code:'a;',scope:'qi'},{id:'qic',code:'}',scope:'q'},{id:'qc',code:'}',scope:null}],blocks:[blockDef('p','{'),{id:'pi',open:'pio',close:'pic',parent:'p'},blockDef('q','{'),{id:'qi',open:'qio',close:'qic',parent:'q'}]},
 // x = tokens 0,3,4 and y = 1,2,5: y's body row precedes x's, so mirroring y onto x would skip
 // a lower candidate; the class must be dropped to keep the first witness. Block z makes `{`
 // and `}` the wider choice, so the search places the body rows first.
 'identical blocks whose rows interleave in the token list':{tokens:['xo','yo','y0','x0','xc','yc','zo','z1','zc'].map(id=>({id,code:id[1]==='o'?'{':id[1]==='c'?'}':['a;','c;'][Number(id[1])],scope:id[1]==='o'||id[1]==='c'?null:id[0]})),blocks:[blockDef('x','{'),blockDef('y','{'),blockDef('z','{')]},
 'identical rows chained by edges, never exchangeable':{tokens:[{id:'a',code:'a;',scope:null},{id:'b',code:'a;',scope:null,after:['a']},{id:'c',code:'a;',scope:null,after:['b']},{id:'z',code:'z;',scope:null,after:['b']}],blocks:[]},
 'a block whose body mirrors a sibling row':{tokens:[{id:'r',code:'a;',scope:null},...block('x','{',['a;']),{id:'s',code:'a;',scope:null}],blocks:[blockDef('x','{')]},
};
for(const [name,shape] of Object.entries(edgeCases))test('edge case: '+name,()=>{
 const def={schemaVersion:1,id:'edge',revision:1,language:'javascript',title:'',description:'',...shape};
 assert.notEqual(validateSubmission(def,submission(def,def.tokens.map(t=>t.code))).status,'invalid_reference');
 let accepted=0;
 for(const lines of distinctPermutations(def.tokens.map(t=>t.code))){
  const now=assertNoWorse(def,lines,lines.join(' '),1_000_000);
  assert.equal(now.status,bruteForce(def,lines)?'accepted':'rejected',lines.join(' '));
  if(now.accepted)accepted++;
 }
 assert.ok(accepted>0);
});

const shapes={
 chainedBlocks:k=>['function run() {',...Array.from({length:k},()=>['  {','    record(1);','  }']).flat(),'}'],
 pureBlocks:k=>['function run() {',...Array.from({length:k},()=>['  {','    const x = 1;','  }']).flat(),'  return 0;','}'],
 nestedPure:k=>['function run() {',...Array.from({length:k},()=>['  {','    {','      const x = 1;','    }','  }']).flat(),'  return 0;','}'],
 sameBodyMethods:k=>['class Box {',...Array.from({length:k},(_,i)=>[`  m${i}() {`,'    const x = 1;','    return x;','  }']).flat(),'}'],
 arrayRows:k=>['const list = [',...Array.from({length:k},()=>'  0,'),'];','record(list);'],
 manyClosers:k=>['function run() {',...Array.from({length:k},(_,i)=>`  if (a${i}) {`),'    record(0);',...Array.from({length:k},()=>'  }'),'}'],
};
for(const [name,make] of Object.entries(shapes))test('stress: '+name+' decides every near-valid submission within the production budget',()=>{
 for(const k of name==='pureBlocks'?[8,40,165]:name==='sameBodyMethods'?[8,40,120]:[8,40]){
  const model=generateCodeLineExercise({source:make(k).join('\n'),language:'javascript'},ts),{compiled}=compileCodeLineExercise(model),n=model.lines.length,rng=random(k);
  assert.ok(n<=500,name+' '+n);
  for(const order of extensions(model,{limit:8,rng}))for(let r=0;r<10;r++){
   const lines=codesOf(model,order),a=Math.floor(rng()*n),b=Math.floor(rng()*n);
   if(r%2)[lines[a],lines[b]]=[lines[b],lines[a]];else lines.splice(b,0,...lines.splice(a,1));
   const result=validateSubmission(compiled,submission(model,lines),{maxStates:50_000});
   assert.notEqual(result.status,'indeterminate',`${name} k=${k}`);
   assert.ok(result.exploredStates<=4*n,`${name} k=${k}: ${result.exploredStates} states for ${n} rows`);
  }
 }
});

test('a cyclic profile in hand-built compiled rules has no solution: the closure never half-computes',()=>{
 // validateSubmission trusts an object shaped like CompiledRules without recompiling it.
 const definition={schemaVersion:1,id:'cyclic',revision:1,language:'javascript',title:'',description:'',tokens:[{id:'a',code:'a;',scope:null},{id:'b',code:'b;',scope:null},{id:'c',code:'c;',scope:null}],blocks:[]};
 const compiled={definition,profiles:[{id:'loop',edges:[{before:'a',after:'b'},{before:'b',after:'a'}]}]};
 for(const lines of [['a;','b;','c;'],['b;','a;','c;'],['c;','a;','b;']]){
  const result=validateSubmission(compiled,submission(definition,lines));
  assert.equal(result.status,'rejected',lines.join(' '));
  assert.equal(validateSubmissionBaseline(compiled,submission(definition,lines)).status,'rejected');
 }
 // A second, acyclic profile is still searched.
 const either={definition,profiles:[...compiled.profiles,{id:'plain',edges:[{before:'a',after:'b'}]}]};
 assert.deepEqual([validateSubmission(either,submission(definition,['a;','b;','c;'])).matchedProfile],['plain']);
});

test('prepared pruning is reused across calls on the same compiled rules without changing a verdict',()=>{
 const model=generateCodeLineExercise({source:shapes.pureBlocks(20).join('\n'),language:'javascript'},ts),{compiled}=compileCodeLineExercise(model);
 const reference=model.lines.map(line=>line.code),late=[...reference];[late[late.length-1],late[late.length-2]]=[late[late.length-2],late[late.length-1]];
 const runs=[reference,late,reference,late].map(lines=>validateSubmission(compiled,submission(model,lines)));
 assert.deepEqual(runs.map(run=>run.status),['accepted','rejected','accepted','rejected']);
 assert.deepEqual(runs[2],runs[0]);assert.deepEqual(runs[3],runs[1]);
});

test('every candidate list is ascending: the first-witness guarantee rests on it',()=>{
 for(let seed=1;seed<=200;seed++){
  const def=randomDefinition(seed),lines=distinctPermutations(def.tokens.map(token=>token.code))[0];
  for(const list of matchContent(def.tokens,lines).candidates)assert.deepEqual(list,[...list].sort((a,b)=>a-b),String(seed));
 }
});

test('the measured explosion is gone: k identical chained blocks with a late error are rejected in linear states',()=>{
 for(const k of [6,8,40]){
  const model=generateCodeLineExercise({source:shapes.chainedBlocks(k).join('\n'),language:'javascript'},ts),{compiled}=compileCodeLineExercise(model),lines=model.lines.map(line=>line.code),n=lines.length;
  [lines[n-2],lines[n-3]]=[lines[n-3],lines[n-2]];
  const result=validateSubmission(compiled,submission(model,lines),{maxStates:50_000});
  assert.equal(result.status,'rejected');
  assert.ok(result.exploredStates<=2*n,`k=${k}: ${result.exploredStates}`);
 }
});

test('generated v2 and upgraded v3 models: the frozen search verdict and witness are reproduced on near-valid submissions',async()=>{
 const directory=new URL('../public/samples/typescript/',import.meta.url);
 const suite=JSON.parse(await readFile(new URL('suite.json',directory),'utf8'));
 let checked=0;
 for(const example of suite){
  const source=await readFile(new URL(example.id+'.ts',directory),'utf8'),model=JSON.parse(await readFile(new URL(example.id+'.model.json',directory),'utf8'));
  const v2=compileCodeLineExercise(model).compiled,upgraded=compileCodeLineExerciseV3(upgradeCodeLineExerciseV2(model,source));
  assert.ok(!upgraded.status,upgraded.message);
  const rng=random(example.id.length),reference=model.lines.map(line=>line.code),n=reference.length;
  for(let r=0;r<30;r++){
   const lines=[...reference],a=Math.floor(rng()*n),b=Math.floor(rng()*n);
   if(r%2)[lines[a],lines[b]]=[lines[b],lines[a]];else lines.splice(b,0,...lines.splice(a,1));
   for(const compiled of [v2,upgraded.compiled]){assertNoWorse(compiled,lines,`${example.id} ${r}`);checked++;}
  }
 }
 assert.ok(checked>=1000,String(checked));
});
