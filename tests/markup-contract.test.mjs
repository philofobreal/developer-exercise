/** ADR-151 (NY-58, K5): the markup contract. The browser suites find elements by id and by data attribute; those
 * names are what any view adapter has to keep, so the suites are an adapter's acceptance tests. The contract
 * (docs/markup-contract.json) lists them, and this test keeps three things equal:
 *  - what the browser tests select is in the contract;
 *  - what the contract lists exists in the workbench's sources;
 *  - the contract's actions are exactly the data attributes the controller handles. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

const read=file=>readFile(new URL('../'+file,import.meta.url),'utf8');
const contract=JSON.parse(await read('docs/markup-contract.json'));
const kebab=name=>name.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()),camel=name=>name.replace(/-([a-z0-9])/g,(_,letter)=>letter.toUpperCase());
const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const workbench=(await readdir(new URL('../src/workbench/',import.meta.url))).filter(name=>name.endsWith('.ts')).sort().map(name=>'src/workbench/'+name);
const sources=Object.fromEntries(await Promise.all([...workbench,'public/ui.js','public/index.html'].map(async file=>[file,await read(file)])));
const everything=Object.values(sources).join('\n');
/** Every data attribute the sources write or read: `data-name` in markup and selectors, `dataset.name` in code. */
const attributes=new Set([...everything.matchAll(/data-([a-z][a-z0-9-]*)/g)].map(match=>match[1].replace(/-$/,'')).concat([...everything.matchAll(/\bdataset\.([a-zA-Z0-9]+)/g)].map(match=>kebab(match[1]))));
const suites=(await readdir(new URL('../tests/',import.meta.url))).filter(name=>/^browser.*\.py$/.test(name)).sort();
const tested=(await Promise.all(suites.map(name=>read('tests/'+name)))).join('\n');
const selected=new Set([...tested.matchAll(/data-([a-z][a-z0-9-]*)/g)].map(match=>match[1]));
const isId=name=>new RegExp('id="'+escape(name)+'"|#'+escape(name)+'\\b').test(everything);
const selectedIds=new Set([...tested.matchAll(/#([a-z][a-z0-9-]*)/g)].map(match=>match[1]).filter(isId));
/** A data attribute the controller handles: it selects by it or reads it from an element's dataset. */
const controller=sources['public/ui.js']+sources['src/workbench/interactions.ts'];
const handled=[...attributes].filter(name=>new RegExp('\\[data-'+escape(name)+'[\\]=~^$*|]|dataset\\.'+camel(name)+'\\b').test(controller)).sort();

test('the contract is well formed: sorted, unique, each name in one list',()=>{
 for(const list of ['ids','actions','markers','retired']){
  assert.ok(Array.isArray(contract[list]),list);
  assert.deepEqual(contract[list],[...new Set(contract[list])].sort(),list+' is sorted and unique');
  for(const name of contract[list])assert.match(name,/^[a-z][a-z0-9-]*$/,list+' '+name);
 }
 const data=[...contract.actions,...contract.markers,...contract.retired];
 assert.equal(new Set(data).size,data.length,'a data attribute stands in one list');
 assert.ok(contract.ids.length>=8&&contract.actions.length>=40&&contract.markers.length>=90,'the contract is not emptied');
});

test('what the browser tests select is in the contract, and nothing in the contract is unused',()=>{
 const listed=new Set([...contract.actions,...contract.markers,...contract.retired]);
 assert.deepEqual([...selected].filter(name=>!listed.has(name)).sort(),[],'a browser test selects a data attribute the contract does not list');
 assert.deepEqual([...selectedIds].filter(name=>!contract.ids.includes(name)).sort(),[],'a browser test selects an id the contract does not list');
 // A marker or an id nobody tests is not part of the contract; an action stays listed while the controller handles it.
 assert.deepEqual(contract.markers.filter(name=>!selected.has(name)),[],'a marker no browser test reads');
 assert.deepEqual(contract.retired.filter(name=>!selected.has(name)),[],'a retired name no browser test checks');
 assert.deepEqual(contract.ids.filter(name=>!selectedIds.has(name)),[],'an id no browser test selects');
});

test('what the contract lists exists in the sources; a retired name does not',()=>{
 assert.deepEqual([...contract.actions,...contract.markers].filter(name=>!attributes.has(name)),[],'listed, but the sources have no such data attribute');
 assert.deepEqual(contract.ids.filter(name=>!isId(name)),[],'listed, but the sources have no such id');
 assert.deepEqual(contract.retired.filter(name=>attributes.has(name)),[],'retired, but the sources still have it');
});

test('the actions are exactly the data attributes the controller handles',()=>{
 assert.deepEqual(contract.actions,handled);
 // The size of the adapter's own vocabulary, for the record: data attributes outside the contract.
 const internal=[...attributes].filter(name=>!contract.actions.includes(name)&&!contract.markers.includes(name));
 assert.ok(internal.length<60,'the adapter keeps '+internal.length+' data attributes to itself');
});
