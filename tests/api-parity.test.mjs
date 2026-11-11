/** ADR-134 (NY-28): the Pages build serves `local-demo` under the name of `api` (ADR-125), so the two must offer the
 *  same operations: a name only one of them exports breaks the other build's page at load (an ES module import of a
 *  missing name fails), and the server build never loads `local-demo` to notice. */
import test from 'node:test';
import assert from 'node:assert/strict';

test('the server API and the Local Demo export the same operations, and name their own mode',async()=>{
 const server=await import('../public/app/api.js'),demo=await import('../public/app/local-demo.js');
 assert.deepEqual(Object.keys(server).sort(),Object.keys(demo).sort());
 for(const name of Object.keys(server))assert.equal(typeof demo[name],typeof server[name],name);
 assert.deepEqual([server.validationMode,demo.validationMode],['trusted-server','local-demo']);
});

test('every operation the page imports from the API exists in both',async()=>{
 const {readFile}=await import('node:fs/promises');
 const page=await readFile(new URL('../public/ui.js',import.meta.url),'utf8');
 const imported=page.match(/import \{([^}]*)\} from '\.\/app\/api\.js'/)?.[1].split(',').map(name=>name.trim()).filter(Boolean);
 assert.ok(imported?.length,'ui.js imports the API');
 const server=await import('../public/app/api.js'),demo=await import('../public/app/local-demo.js');
 for(const name of imported)assert.ok(name in server&&name in demo,name);
});
