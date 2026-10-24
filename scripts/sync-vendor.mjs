import {copyFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
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
