/** The Pages demo publishes exactly what the trusted catalog serves (ADR-035): the same gate, the
 * same policy, the same refusals. A refused model is not copied; its source file is untouched. */
import {copyFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
export async function publishExamples(examplesDir,outDir,{publication='publishable'}={}){
 const catalog=await ExerciseCatalog.open(examplesDir,{publication});
 const served=[...catalog.trusted.values()].map(({model,file,verification})=>({file,id:model.id,status:verification.status})).sort((a,b)=>a.file.localeCompare(b.file));
 const skipped=catalog.skipped.map(({id,file,status,reason})=>({file,id,status,reason}));
 await mkdir(outDir,{recursive:true});
 for(const {file} of served)await copyFile(path.join(examplesDir,file),path.join(outDir,file));
 await writeFile(path.join(outDir,'manifest.json'),JSON.stringify(served.map(item=>item.file),null,2)+'\n');
 await writeFile(path.join(outDir,'publication.json'),JSON.stringify({policy:publication,served,skipped},null,2)+'\n');
 return {served,skipped};
}
