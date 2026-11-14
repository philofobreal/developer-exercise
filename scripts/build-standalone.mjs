/** Builds the standalone demonstration page (ADR-155): one HTML file that runs from a disk or any static host, with a
 * few finished exercises, the validator and the practice page, and nothing that derives rules from source code.
 *
 *   npm run build:standalone                     the default selection
 *   npm run build:standalone -- stack-ts grade-ts   exactly these exercises
 *
 * Hidden here: how the page becomes one file (bundling, inlining styles, fonts and the classic scripts), which fields
 * of a model stay behind, and where the practice engine takes the server adapter's place. The record of what went
 * into the bundle is written beside the page (`inputs.json`), and `tests/standalone.test.mjs` reads it. */
import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {build,transform} from 'esbuild';
import {ExerciseCatalog,publicationPolicy} from '../src/server/catalog.mjs';
import {createPracticeApi} from '../dist/standalone/practice-api.js';

/** The default selection: one exercise of each level and both languages, small enough to present. */
export const DEFAULT_EXERCISES=['celsius-js','grade-ts','fib-memo-js','stack-ts','algo-bfs-js'];
/** What a shipped model leaves behind: how its rules were derived (strategy, provenance, evidence, hints). The
 * validator reads none of it. */
const stripped=({authoring,...model})=>model;
const root=process.cwd(),out=path.join(root,'_standalone'),read=file=>readFile(path.join(root,file),'utf8');
/** Inline code must not end its own element. */
const inline=code=>code.replaceAll('</script','<\\/script').replaceAll('</style','<\\/style');

export async function buildStandalone(ids=DEFAULT_EXERCISES){
 // The same catalogue and publication policy as the server: an exercise it would not serve is not shipped either.
 const catalog=await ExerciseCatalog.open(path.join(root,'examples'),{publication:publicationPolicy(process.env.CODELINE_PUBLICATION)});
 const summaries=new Map(catalog.list().map(summary=>[summary.id,summary]));
 const entries=ids.map(id=>{
  const record=catalog.trusted.get(id),summary=summaries.get(id);
  if(!record||!summary)throw Error(`No served exercise named ${id}. Served: ${[...summaries.keys()].join(', ')}`);
  return {summary,model:stripped(record.model)};
 });
 // The page imports the server adapter by name; the bundle gives it the practice engine over the shipped exercises
 // instead, with the same operations.
 const operations=Object.keys(createPracticeApi([]));
 const adapter=`import {createPracticeApi} from ${JSON.stringify(path.join(root,'dist/standalone/practice-api.js'))};
const api=createPracticeApi(${JSON.stringify(entries)});
${operations.map(name=>`export const ${name}=api.${name};`).join('\n')}`;
 const practiceEngine={name:'practice-engine',setup(bundle){
  bundle.onResolve({filter:/(^|\/)api\.js$/},args=>path.resolve(args.resolveDir,args.path)===path.join(root,'public/app/api.js')?{path:'practice-engine',namespace:'standalone'}:null);
  bundle.onLoad({filter:/.*/,namespace:'standalone'},()=>({contents:adapter,resolveDir:root,loader:'js'}));
 }};
 const options={bundle:true,minify:true,write:false,legalComments:'none',charset:'utf8',target:'es2022',logLevel:'silent',absWorkingDir:root};
 const script=await build({...options,entryPoints:['public/ui.js'],format:'esm',metafile:true,plugins:[practiceEngine]});
 const style=await build({...options,entryPoints:['public/style.css'],loader:{'.woff2':'dataurl'}});
 const minified=async(file,loader)=>(await transform(await read(file),{loader,minify:true,legalComments:'none',charset:'utf8'})).code;
 const classic=file=>minified(file,'js').then(code=>`<script>${inline(code)}</script>`);
 const notices=(await Promise.all(['public/vendor/LICENSE-prism.txt','public/vendor/LICENSE-js-beautify.txt','public/vendor/fonts/LICENSE-inter.txt','public/vendor/fonts/LICENSE-jetbrains-mono.txt','src/core/LICENSE-ajv.txt']
  .map(async file=>`${path.basename(file)}\n\n${(await read(file)).trim()}`))).join('\n\n----\n\n').replaceAll('--','- -');
 const html=`<!doctype html>
<html lang="hu">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="darkreader-lock">${await classic('public/app/theme-boot.js')}<title>CodeLineSorter – önálló bemutató</title>
<style>${inline(await minified('public/vendor/prism.css','css'))}${inline(style.outputFiles[0].text)}
/* The help page is a separate document and is not part of this file: its links are left out; the bubbles stay. */
.help-link{display:none}</style></head>
<body><div id="app"><div class="loading" data-busy role="status">Feladatmodell betöltése…</div></div>
${(await Promise.all(['beautify.js','prism-core.js','prism-clike.js','prism-javascript.js','prism-typescript.js'].map(file=>classic('public/vendor/'+file)))).join('\n')}
<script type="module">${inline(script.outputFiles[0].text)}</script>
<!-- Third-party notices

${notices}
-->
</body></html>
`;
 await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
 await writeFile(path.join(out,'codelinesorter.html'),html);
 const inputs=Object.keys(script.metafile.inputs).sort();
 await writeFile(path.join(out,'inputs.json'),JSON.stringify({exercises:ids,inputs},null,1)+'\n');
 return {file:path.join(out,'codelinesorter.html'),bytes:Buffer.byteLength(html),exercises:ids,inputs,models:entries.map(entry=>entry.model)};
}
if(import.meta.url===new URL(process.argv[1],'file://').href||process.argv[1]===new URL(import.meta.url).pathname){
 const chosen=process.argv.slice(2);
 const result=await buildStandalone(chosen.length?chosen:DEFAULT_EXERCISES);
 console.log(`Standalone demo created: ${result.file} (${Math.round(result.bytes/1024)} KiB), exercises: ${result.exercises.join(', ')}`);
}
