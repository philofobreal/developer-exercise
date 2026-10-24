/** Author-only publication audit, identical to server preview admission. */
import {readFile,readdir} from 'node:fs/promises';
import ts from 'typescript';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {auditReference} from '../src/author/audit.mjs';
let verified=0;
for(const name of (await readdir('examples')).filter(n=>n.endsWith('.json')).sort()){
 const model=JSON.parse(await readFile('examples/'+name,'utf8')),c=compileCodeLineExercise(model);
 if('status' in c)throw Error(name+': '+c.message);
 auditReference(model,ts);
 const check=validateSubmission(c.compiled,{exerciseId:model.id,revision:model.revision,lines:model.lines.map(x=>x.code)});
 if(!check.accepted)throw Error(name+': '+check.message);
 console.log(`✓ ${name}: schema, structure, original order and syntax verified`);verified++;
}
console.log(`${verified} exercises verified for publication.`);
