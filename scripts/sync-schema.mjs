/** Schema is the sole shape contract; generate a browser-safe standalone checker. */
import Ajv from 'ajv/dist/2020.js';
import standalone from 'ajv/dist/standalone/index.js';
import {readFile,writeFile} from 'node:fs/promises';
const schema=JSON.parse(await readFile('docs/schema.json','utf8'));
const ajv=new Ajv({code:{source:true,esm:true},strict:true,allErrors:false});
let code=standalone(ajv,ajv.compile(schema));
// Ajv's only runtime helper for this schema counts Unicode code points. Inline
// the helper so the same generated checker runs in Node and static browsers.
code=code.replaceAll('require("ajv/dist/runtime/ucs2length").default','((value) => Array.from(value).length)');
if(/require\(/.test(code))throw Error('Unexpected standalone runtime dependency');
await writeFile('src/core/schema-check.ts','// @ts-nocheck\n// Generated from docs/schema.json by scripts/sync-schema.mjs. Do not edit.\n'+code+'\n');
