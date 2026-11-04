/** ADR-067: value perturbation in the measurement. Policy A (ADR-043) judges a write as if it
 * wrote another value and code after a certain throw as if it ran. A rejected order that runs
 * alike only because the fixture's values coincide is `intent` (reason `value`, with the
 * literal that shows the dependency); an order no single-literal variant tells apart stays a gap. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {corpus} from './fixtures/ordering-corpus.mjs';
import {createClassifier} from './support/order-classification.mjs';
import {literalsOf,valuesFor,replaced} from './support/literal-variants.mjs';

const fixture=(id,source,language='javascript')=>({id,origin:'value-intent',language,probe:'run()',source});
/** The verdict for moving the row `code` (trimmed) to just before the row `before`. */
function verdict(program,code,before){
 const model=generate(program),order=model.lines.map(line=>line.id),at=text=>order.findIndex(id=>model.lines[id-1].code.trim()===text);
 const [moved]=order.splice(at(code),1);order.splice(at(before),0,moved);
 return createClassifier(program,model).classify(order);
}

test('a write the switch does not notice keeps its order: intent by value, the case label as witness',()=>{
 const program=fixture('value-switch',['class Box {','  constructor(label) {','    this.label = label;',"    this.tag = '';",'  }','}','function run() {',"  const a = new Box('a');",'  const out = [];','  switch (a.tag) {',"    case 't1':","      out.push('one');",'      break;','    default:',"      out.push('other');",'  }',"  a.tag = 't8';",'  return JSON.stringify([a, out]);','}']);
 const result=verdict(program,"a.tag = 't8';",'switch (a.tag) {');
 assert.equal(result.kind,'intent');
 assert.equal(result.reason,'value');
 assert.deepEqual(result.witness,{row:17,literal:'t8',value:'t1'},'the decision value is tried first');
});

test('a write hidden only by a certain throw keeps its order: intent by value',()=>{
 const program=fixture('value-throw',['class Box {','  constructor(label) {','    this.label = label;','    this.count = 0;','  }','  rename(text) {',"    if (text === '') {","      throw new Error('empty');",'    }','    this.label = text;','  }','}','function run() {','  try {',"    const a = new Box('a');","    a.rename('');",'    return JSON.stringify(a);','  } catch (error) {',"    return 'caught ' + error.message;",'  }','}']);
 const result=verdict(program,'this.count = 0;','this.label = label;');
 assert.equal(result.kind,'intent');
 assert.equal(result.reason,'value');
});

test('an overload group is one block: no gap remains to explain (ADR-079)',()=>{
 // ADR-070 freed the former example (the for…of over-approximation); v45 (ADR-079) opens an overload
 // group's function block at its first signature, so the seal that left a gap no literal explains is gone.
 const program=corpus.get('wp6-overload-groups'),row=measureFixture(program,CORPUS_CAPS);
 assert.deepEqual([row.gaps.length,row.unsound],[0,0]);
});

test('literals: names, types, directives and module specifiers are not data; comparisons decide',()=>{
 const source=["'use strict';","import {x} from './m';",'type T = \'a\' | \'b\';','const o = {key: 1, \'quoted\': 2};','class C {',"  'named'() { return 3; }",'}',"if (o.key === 4) { o['k'] = 'v'; }",'const t = true;'];
 const found=literalsOf(source,'typescript').map(({row,kind,value,decides})=>[row,kind,value,decides]);
 assert.deepEqual(found,[[3,'number',1,false],[3,'number',2,false],[5,'number',3,false],[7,'number',4,true],[7,'string','v',false],[8,'boolean',true,false]]);
 const four=literalsOf(source,'typescript').find(literal=>literal.value===4);
 assert.deepEqual(valuesFor(four,literalsOf(source,'typescript')),[1,2,3,1004]);
 assert.equal(replaced(source,four,1)[7],"if (o.key === 1) { o['k'] = 'v'; }");
});
