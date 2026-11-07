/** ADR-108 (E9–E10): the preflight's shadow run and cost, reproducible.
 *
 * Shadow run: every shipped model (the catalogue in examples/ and the TypeScript sample models) goes through the
 * server's first and second gate as an imported model, under the start policy and under the stricter choices an
 * author can make (the language's stricter diagnostics, unknown → block). Nothing is changed; the output lists what
 * each policy would refuse or leave undecided.
 * Cost: the first gate alone (language audit + runtime safety + decision) on the 500-row budget sources
 * (tests/support/author-budget-probe.mjs), with a standard library (server) and without one (Local Demo), p50/p95.
 *
 * Usage: npm run build && node scripts/preflight-measure.mjs [--runs=N]   (prints JSON)
 */
import ts from 'typescript';
import path from 'node:path';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {createReferenceAuditor} from '../dist/author/reference-audit.js';
import {resolveAuthorPolicy,auditMode} from '../dist/author/preflight/config-resolver.js';
import {sourceGate} from '../dist/author/preflight/source-gate.js';
import {runtimeSafety} from '../dist/author/preflight/runtime-safety.js';
import {budgetCases} from '../tests/support/author-budget-probe.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const runs=Number(process.argv.find(arg=>arg.startsWith('--runs='))?.slice(7)??15);
const json=file=>JSON.parse(readFileSync(file,'utf8'));
const models=[
 ...readdirSync(path.join(root,'examples')).filter(name=>name.endsWith('.json')).map(name=>['examples/'+name,json(path.join(root,'examples',name))]),
 ...readdirSync(path.join(root,'public/samples/typescript')).filter(name=>name.endsWith('.model.json')).map(name=>['samples/typescript/'+name,json(path.join(root,'public/samples/typescript',name))])
];

const policies=language=>({start:{},strictDiagnostics:language==='typescript'?{tsDiagnostics:'strict'}:{jsCheck:'on'},block:{unknownPolicy:'block'}});
const shadow=[];
for(const [file,model] of models)for(const [name,policy] of Object.entries(policies(model.language))){
 // A catalogue holds at most 100 drafts; each model gets its own.
 const catalog=new ExerciseCatalog(new Map()),started=performance.now();
 try{
  const draft=await catalog.createDraft({model,policy});
  shadow.push({file,policy:name,admitted:true,first:draft.gate.verdict,second:draft.tryGate.verdict,why:draft.tryGate.reasons,codes:draft.gate.diagnostics.map(d=>`${d.code}:${d.certainty}`),ms:Math.round(performance.now()-started)});
 }catch(error){
  shadow.push({file,policy:name,admitted:false,first:error.details?.gate?.verdict??'refused',second:null,codes:(error.details?.gate?.diagnostics??[]).map(d=>`${d.code}:${d.certainty}`),message:String(error.message).slice(0,160),ms:Math.round(performance.now()-started)});
 }
}

// The server reads the standard library next to the compiler; the Local Demo ships none.
const libDir=path.dirname(ts.getDefaultLibFilePath({}));
const withLib=createReferenceAuditor(ts,name=>{try{return readFileSync(path.join(libDir,path.basename(name)),'utf8');}catch{return undefined;}});
const withoutLib=createReferenceAuditor(ts);
const quantile=(values,q)=>{const sorted=[...values].sort((a,b)=>a-b);return Math.round(sorted[Math.min(sorted.length-1,Math.floor(q*sorted.length))]*10)/10;};
const cost=[];
for(const [name,make] of Object.entries(budgetCases)){
 const source=make(),language='typescript',policy=resolveAuthorPolicy({language});
 for(const [where,auditor] of [['server',withLib],['local-demo',withoutLib]]){
  const times=[];let verdict='';
  for(let i=0;i<runs+2;i++){
   const started=performance.now();
   const gate=sourceGate(auditor.audit(source,language,auditMode(policy)),policy,runtimeSafety(ts,source,language,{objectState:policy.effective.objectState}));
   if(i>=2)times.push(performance.now()-started);verdict=gate.verdict;
  }
  cost.push({source:name,rows:source.split('\n').length,kiB:Math.round(Buffer.byteLength(source)/102.4)/10,where,verdict,p50:quantile(times,.5),p95:quantile(times,.95),runs});
 }
}

const summary={};
for(const row of shadow){const key=`${row.policy}: ${row.admitted?row.first:'refused'}`;summary[key]=(summary[key]??0)+1;}
console.log(JSON.stringify({models:models.length,summary,deviations:shadow.filter(row=>!row.admitted||row.first!=='passed'||row.second!=='passed'),cost},null,1));
