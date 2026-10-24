/** Schema is the sole shape contract; generate a browser-safe standalone checker. */
import Ajv from 'ajv/dist/2020.js';
import standalone from 'ajv/dist/standalone/index.js';
import {readFile,writeFile} from 'node:fs/promises';
const ajv=new Ajv({code:{source:true,esm:true},strict:true,allErrors:false});
const schemas=await Promise.all(['schema.json','language-ir.schema.json','codeline-v3.schema.json'].map(async name=>JSON.parse(await readFile('docs/'+name,'utf8'))));
for(const schema of schemas)ajv.addSchema(schema);
let code=standalone(ajv,{validateV2:schemas[0].$id,validateIR:schemas[1].$id,validateV3:schemas[2].$id});
// Ajv's only runtime helper for these schemas counts Unicode code points. Inline
// the helper so the same generated checker runs in Node and static browsers.
code=code.replaceAll('require("ajv/dist/runtime/ucs2length").default','((value) => Array.from(value).length)');
if(/require\(/.test(code))throw Error('Unexpected standalone runtime dependency');
await writeFile('src/core/schema-check.ts','// @ts-nocheck\n// Generated from docs/schema.json, language-ir.schema.json and codeline-v3.schema.json by scripts/sync-schema.mjs. Do not edit.\n'+code+'\nexport default validateV2;\n');
