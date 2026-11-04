/** ADR-063: the oracle reads a TypeScript script a second time, through its ES2022 emit with native
 * class fields, parsed by Acorn and judged by the JavaScript P1/P2 checks. A candidate counts as
 * equivalent only when both readings agree. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createOracle,neighbourhood} from './support/semantic-oracle.mjs';
import {corpus} from './fixtures/ordering-corpus.mjs';
import {catalog} from './support/fixture-catalog.mjs';
import ts from 'typescript';

const fixture=(id,source)=>({id,origin:'witness',language:'typescript',probe:'evaluate()',source});
test('a script is read through its emit too; a module keeps the TypeScript reading',()=>{
 assert.equal(createOracle(fixture('script',['function evaluate(): number {','  const x: number = 1;','  return x;','}'])).emittedReading,true);
 assert.equal(createOracle(fixture('module',['export function evaluate(): number {','  return 1;','}'])).emittedReading,false);
});

// NY-07 (closed as an accepted limit): a module keeps only the TypeScript reading. That narrows A1
// for exactly one fixture today; a second module fixture reopens the item (docs/nyitott-tetelek.md).
test('only one fixture is a module, so the module reading stays an accepted limit',()=>{
 const modules=catalog().filter(fixture=>ts.isExternalModule(ts.createSourceFile('fixture.'+(fixture.language==='typescript'?'ts':'js'),fixture.source.join('\n'),ts.ScriptTarget.Latest,true))).map(fixture=>fixture.id);
 assert.deepEqual(modules,['prompt-mini-fixture'],'a new module fixture: reopen NY-07 (a second, emitted reading of modules)');
});

test('the two readings agree on every neighbouring order of the TypeScript corpus fixtures',()=>{
 const ids=[...corpus.values()].filter(item=>item.language==='typescript').map(item=>item.id).slice(0,12);
 let orders=0;
 for(const id of ids){
  const item={probe:'evaluate()',...corpus.get(id)},source=Array.isArray(item.source)?item.source:item.source.split('\n'),judge=createOracle(item);
  if(!judge.emittedReading)continue;
  for(const order of neighbourhood(source.map((_,i)=>i))){orders++;assert.notEqual(judge(order.map(i=>source[i])).reason,'emitted-order',id+' '+order);}
 }
 assert.ok(orders>500,String(orders));
});
