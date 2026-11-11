/** NY-28 (ADR-097): public/app is compiler output of src/workbench, except a shrinking, named list of
 * hand-written legacy modules (ADR-001 transitional boundary). A new hand-written module fails here;
 * migrating one removes it from the list. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';

const LEGACY=['pages-api'];
test('every public/app module has a TypeScript source, except the named legacy ones',async()=>{
 const app=(await readdir(new URL('../public/app/',import.meta.url))).filter(name=>name.endsWith('.js')).map(name=>name.slice(0,-3));
 const sources=new Set((await readdir(new URL('../src/workbench/',import.meta.url))).filter(name=>name.endsWith('.ts')&&!name.endsWith('.d.ts')).map(name=>name.slice(0,-3)));
 assert.deepEqual(app.filter(name=>!sources.has(name)).sort(),LEGACY,'a hand-written module was added, or a migrated one is still listed');
 for(const name of ['attempt','persistence','drag-insert'])assert.ok(sources.has(name),name+' is migrated (ADR-095, ADR-097)');
});
