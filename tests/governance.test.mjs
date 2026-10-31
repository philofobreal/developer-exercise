/** ADR-049 (plan phase G): the machine-checkable part of the AI governance. Decisions stay
 * traceable: every ADR is well formed, every generation-rule label of the schema is the same in
 * the TypeScript type, has its own row in the formal contract with an existing ADR, and the
 * generator emits the newest one; the working agreement names the governance documents. What a
 * test cannot judge (design quality, pedagogy, approvals) is a review control in ai-governance.md. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {DEPENDENCY_POLICY} from '../src/author/generator.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const adrNames=(await readdir(new URL('../docs/adr/',import.meta.url))).filter(name=>name.endsWith('.md'));

test('every ADR is numbered once, titled with its number and states its status',async()=>{
 const numbers=adrNames.map(name=>name.slice(0,3));
 assert.ok(adrNames.every(name=>/^\d{3}-[a-z0-9-]+\.md$/.test(name)),'file names are NNN-slug.md');
 assert.equal(new Set(numbers).size,numbers.length,'numbers are unique');
 for(const name of adrNames){
  const text=await read('docs/adr/'+name);
  assert.ok(text.startsWith(`# ADR-${name.slice(0,3)} – `),name+': title');
  assert.match(text,/^Állapot:/m,name+': status line');
 }
});

test('the generation-rule labels agree across schema, type, contract and generator',async()=>{
 const label=/scoped-effect-analysis-v(\d+)/g,versions=text=>[...new Set([...text.matchAll(label)].map(match=>Number(match[1])))].sort((a,b)=>a-b);
 const schema=versions(await read('docs/schema.json')),type=versions((await read('src/core/code-line.ts')).split('\n').find(line=>line.startsWith('export type DependencyPolicy')));
 assert.deepEqual(type,schema,'the TypeScript union and the schema enum list the same versions');
 assert.equal(DEPENDENCY_POLICY,'scoped-effect-analysis-v'+schema.at(-1),'the generator emits the newest label');
 const contract=(await read('docs/formal-ordering-contract.md')).split('\n');
 assert.ok(contract.some(line=>line.includes(`új generáláskor \`${DEPENDENCY_POLICY}\``)),'the contract names the current label');
 for(const version of schema){
  const row=contract.find(line=>line.startsWith(`| \`scoped-effect-analysis-v${version}\` |`));
  assert.ok(row,`v${version}: a row of its own in the contract`);
  const adr=/\[ADR-(\d{3})\]\(adr\/(\d{3}-[a-z0-9-]+\.md)\)/.exec(row);
  assert.ok(adr&&adrNames.includes(adr[2])&&adr[2].startsWith(adr[1]),`v${version}: names an existing ADR`);
 }
});

test('the working agreement names the governance documents and its approval and attribution rules',async()=>{
 const agents=await read('AGENTS.md');
 for(const link of ['docs/ai-governance.md','docs/design-review.md','docs/architecture.md'])assert.ok(agents.includes(link),link);
 assert.match(agents,/Co-Authored-By/,'AI attribution');
 assert.match(agents,/push/i,'push needs approval');
});

test('the governance table gives every element an owner, an enforcement and evidence',async()=>{
 const text=await read('docs/ai-governance.md'),start=text.indexOf('## Governance-elemek');
 assert.ok(start>=0,'the element table exists');
 const section=text.slice(start).split('\n## ')[0],rows=section.split('\n').filter(line=>line.startsWith('| **'));
 assert.ok(rows.length>=6,'at least the six phase G elements');
 for(const row of rows){
  const cells=row.split('|').slice(1,-1).map(cell=>cell.trim());
  assert.equal(cells.length,4,row);
  assert.ok(cells.every(cell=>cell.length>3),row);
 }
});
