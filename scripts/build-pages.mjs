/** Prepare a GitHub Pages static demonstrator, retaining the original Node project. */
import {cp,copyFile,mkdir,readdir,rm,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root=process.cwd(),out=path.join(root,'_site');
await rm(out,{recursive:true,force:true});
await cp(path.join(root,'public'),out,{recursive:true});
await cp(path.join(root,'dist'),path.join(out,'dist'),{recursive:true});
await cp(path.join(root,'src/author'),path.join(out,'author'),{recursive:true});
await cp(path.join(root,'examples'),path.join(out,'examples'),{recursive:true});
const names=(await readdir(path.join(root,'examples'))).filter(n=>n.endsWith('.json')).sort();
await writeFile(path.join(out,'examples','manifest.json'),JSON.stringify(names,null,2)+'\n');
await writeFile(path.join(out,'.nojekyll'),'');
await copyFile(path.join(root,'docs/schema.json'),path.join(out,'schema.json'));
await copyFile(path.join(root,'docs/language-ir.schema.json'),path.join(out,'language-ir-v1.schema.json'));
await copyFile(path.join(root,'docs/codeline-v3.schema.json'),path.join(out,'codeline-v3.schema.json'));
await copyFile(path.join(root,'src/core/LICENSE-ajv.txt'),path.join(out,'vendor/LICENSE-ajv.txt'));
const tsSource=require.resolve('typescript/lib/typescript.js');
await mkdir(path.join(out,'vendor'),{recursive:true});
await copyFile(tsSource,path.join(out,'vendor','typescript.js'));
await copyFile(path.join(path.dirname(path.dirname(tsSource)),'LICENSE.txt'),path.join(out,'vendor','LICENSE-typescript.txt'));
let index=await readFile(path.join(out,'index.html'),'utf8');
index=index.replaceAll('href="/','href="./').replaceAll('src="/','src="./');
index=index.replace('<title>ngDynamic – CodeLine v7 – TypeScript editor</title>','<title>ngDynamic CodeLine v7 – GitHub Pages demo</title>');
index=index.replace('<script type="module" src="./ui.js"></script>',
  '<script src="./vendor/typescript.js"></script>\n<script type="module" src="./ui.js"></script>');
await writeFile(path.join(out,'index.html'),index);
let api=await readFile(path.join(out,'app/api.js'),'utf8');
api="export * from './pages-api.js';\n";
await writeFile(path.join(out,'app/api.js'),api);
// The pure author and validator modules are browser-safe ESM. A Node backend is NOT deployed.
console.log('GitHub Pages demo created:',out,'reference exercises:',names.length);
