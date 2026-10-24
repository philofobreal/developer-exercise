/** AUTHORING ONLY. JS/TS syntax check runs here, never for learner submissions. */
import {readFile,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
async function loadTS(){
 try{return (await import('typescript')).default;}catch{}
 try{const root=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();return (await import(pathToFileURL(path.join(root,'typescript/lib/typescript.js')).href)).default;}catch{}
 throw Error('The TypeScript compiler is required for author-side JS/TS syntax checks. Run npm install.');
}
const ts=await loadTS();
const dir=path.resolve('examples');let verified=0;
for(const name of (await readdir(dir)).filter(n=>n.endsWith('.json')).sort()){
 const ref=JSON.parse(await readFile(path.join(dir,name),'utf8'));
 const adapted=compileCodeLineExercise(ref);
 if('status' in adapted)throw Error(`${name}: ${adapted.message}`);
 const check=validateSubmission(adapted.compiled,{exerciseId:ref.id,revision:ref.revision,lines:ref.lines.map(t=>t.code)});
 if(check.status!=='accepted')throw Error(`${name}: the reference order fails its own contract (${check.message})`);
 if(ref.language==='javascript'||ref.language==='typescript'){
  const source=ref.lines.map(t=>t.code).join('\n');
  const kind=ref.language==='typescript'?ts.ScriptKind.TS:ts.ScriptKind.JS;
  const tree=ts.createSourceFile(`${ref.id}.${ref.language==='typescript'?'ts':'js'}`,source,ts.ScriptTarget.Latest,true,kind);
  if(tree.parseDiagnostics.length){
   const messages=tree.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n'));
   throw Error(`${name}: syntactic errors in original source: ${messages.join(' | ')}`);
  }
 }
 console.log(`✓ ${name}: valid model, original reference accepted, syntax parsed`);verified++;
}
console.log(`${verified} exercises verified for publication.`);
