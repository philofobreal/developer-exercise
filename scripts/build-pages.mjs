/** Prepare a GitHub Pages static demonstrator, retaining the original Node project. */
import {cp,copyFile,mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {publishExamples} from './publish-examples.mjs';
import {publicationPolicy,publicationNotice} from '../src/server/catalog.mjs';
const require=createRequire(import.meta.url);
const root=process.cwd(),out=path.join(root,'_site');
await rm(out,{recursive:true,force:true});
await cp(path.join(root,'public'),out,{recursive:true});
const distRoot=path.join(root,'dist');
// The isolated Python parser is a test/library slice until product integration (ADR-005).
await cp(distRoot,path.join(out,'dist'),{recursive:true,filter:source=>path.relative(distRoot,source).split(path.sep)[0]!=='python'});
await cp(path.join(root,'src/author'),path.join(out,'author'),{recursive:true});
// Source generator is two directories below the root; the static author folder is one.
// Only the explicit typed-author wiring (ADR-011) is re-rooted.
for(const [file,modules] of [['generator.mjs',['code-line-projection.js']],['languages.mjs',['js-ts-ordering.js','source-nesting.js']]]){
 const target=path.join(out,'author',file);let text=await readFile(target,'utf8');
 for(const module of modules){if(!text.includes('../../dist/author/'+module))throw Error(`Typed author packaging path changed: ${file} -> ${module}`);text=text.replace('../../dist/author/'+module,'../dist/author/'+module);}
 await writeFile(target,text);
}
// Only models the trusted catalog would serve, under the same policy (ADR-035).
const publication=publicationPolicy(process.env.CODELINE_PUBLICATION);
if(publicationNotice(publication))console.warn(publicationNotice(publication));
const {served,skipped}=await publishExamples(path.join(root,'examples'),path.join(out,'examples'),{publication,curriculumFile:path.join(root,'curriculum','curriculum.json')});
for(const {file,status,reason} of skipped)console.warn(`Kihagyott feladat (${publication}): ${file} [${status}] – ${reason}`);
await writeFile(path.join(out,'.nojekyll'),'');
await copyFile(path.join(root,'docs/schema.json'),path.join(out,'schema.json'));
await copyFile(path.join(root,'docs/language-ir.schema.json'),path.join(out,'language-ir-v1.schema.json'));
await copyFile(path.join(root,'docs/codeline-v3.schema.json'),path.join(out,'codeline-v3.schema.json'));
await copyFile(path.join(root,'src/core/LICENSE-ajv.txt'),path.join(out,'vendor/LICENSE-ajv.txt'));
const tsSource=require.resolve('typescript/lib/typescript.js');
await mkdir(path.join(out,'vendor'),{recursive:true});
// ADR-125 (NY-32): the compiler runs in the Local Demo's worker, as a module: the shipped file unchanged, its global
// handed on (`globalThis.ts`), so the worker imports it and the main thread never parses it.
await writeFile(path.join(out,'vendor','typescript.mjs'),readFileSync(tsSource,'utf8')+'\nglobalThis.ts = ts;\n');
await copyFile(path.join(path.dirname(path.dirname(tsSource)),'LICENSE.txt'),path.join(out,'vendor','LICENSE-typescript.txt'));
// ADR-113: the standard library the server's language audit reads (lib.es2022.full.d.ts and what it references),
// so the Local Demo audits as the server does. Fetched once, on the first author action.
{
 const libDir=path.dirname(tsSource),library={};
 const visit=name=>{const file=`lib.${name}.d.ts`;if(Object.hasOwn(library,file))return;const text=readFileSync(path.join(libDir,file),'utf8');library[file]=text;for(const match of text.matchAll(/<reference lib="([^"]+)"/g))visit(match[1]);};
 visit('es2022.full');
 // ADR-149: the newest library, by which the technology label dates what a source uses.
 visit('esnext');
 await writeFile(path.join(out,'vendor','typescript-lib.json'),JSON.stringify(library));
}
let index=await readFile(path.join(out,'index.html'),'utf8');
index=index.replaceAll('href="/','href="./').replaceAll('src="/','src="./');
index=index.replace('<title>CodeLineSorter</title>','<title>CodeLineSorter – GitHub Pages demo</title>');
await writeFile(path.join(out,'index.html'),index);
let api=await readFile(path.join(out,'app/api.js'),'utf8');
api="export * from './local-demo.js';\n";
await writeFile(path.join(out,'app/api.js'),api);
// The pure author and validator modules are browser-safe ESM. A Node backend is NOT deployed.
console.log('GitHub Pages demo created:',out,'reference exercises:',served.length);
