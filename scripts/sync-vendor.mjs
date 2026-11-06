import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
// Text is copied verbatim except for line endings: the repository is LF-only
// (.gitattributes), while some upstream packages ship CRLF notices.
const copyFile=async(from,to)=>writeFile(to,(await readFile(from,'utf8')).replace(/\r\n?/g,'\n'));
const root=path.dirname(require.resolve('js-beautify/package.json'));
await copyFile(path.join(root,'js/lib/beautify.js'),'public/vendor/beautify.js');
await copyFile(path.join(root,'LICENSE'),'public/vendor/LICENSE-js-beautify.txt');

import {mkdir} from 'node:fs/promises';
const acorn=path.dirname(require.resolve('acorn/package.json'));
await mkdir('src/author/vendor',{recursive:true});
await copyFile(path.join(acorn,'dist/acorn.mjs'),'src/author/vendor/acorn.mjs');
await copyFile(path.join(acorn,'LICENSE'),'src/author/vendor/LICENSE-acorn.txt');
await copyFile(path.join(acorn,'LICENSE'),'public/vendor/LICENSE-acorn.txt');

const typescript=path.dirname(require.resolve('typescript/package.json'));
await copyFile(path.join(typescript,'LICENSE.txt'),'public/vendor/LICENSE-typescript.txt');
await copyFile(path.join(typescript,'ThirdPartyNoticeText.txt'),'public/vendor/NOTICE-typescript.txt');
await copyFile(path.join(path.dirname(require.resolve('ajv/package.json')),'LICENSE'),'src/core/LICENSE-ajv.txt');

// ADR-104: the interface fonts are served from the site itself (the CSP allows no font origin but 'self').
// Variable woff2 files, latin and latin-ext subsets only (Hungarian ő and ű are latin-ext); OFL-1.1.
import {copyFile as copyBinary} from 'node:fs/promises';
await mkdir('public/vendor/fonts',{recursive:true});
for(const [pkg,file] of [['@fontsource-variable/inter','inter'],['@fontsource-variable/jetbrains-mono','jetbrains-mono']]){
 const dir=path.dirname(require.resolve(pkg+'/package.json'));
 for(const subset of ['latin','latin-ext'])await copyBinary(path.join(dir,'files',`${file}-${subset}-wght-normal.woff2`),`public/vendor/fonts/${file}-${subset}-wght-normal.woff2`);
 await copyFile(path.join(dir,'LICENSE'),`public/vendor/fonts/LICENSE-${file}.txt`);
}
