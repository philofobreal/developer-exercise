import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';
import {readFile} from 'node:fs/promises';
import {compileCodeLineExercise,compileDefinition,validateSubmission} from '../dist/index.js';
import shape from '../dist/schema-check.js';
const schema=JSON.parse(await readFile(new URL('../docs/schema.json',import.meta.url),'utf8'));
const ajv=new Ajv({strict:true}).compile(schema);
const base=JSON.parse(await readFile(new URL('../examples/sum-js.json',import.meta.url),'utf8'));
for(const [name,change] of Object.entries({
 duplicateDependency:m=>m.lines[1].dependencies=[1,1],
 extraProperty:m=>m.lines[0].surprise=true,
 badLanguage:m=>m.language='python',
 badNormalization:m=>m.lines[0].normalization='trim',
 malformedEdges:m=>m.edges={},
 malformedProfile:m=>m.profiles=[null],
 multiline:m=>m.lines[0].code='a\nb',
 invalidMetadata:m=>m.authoring={semanticEquivalenceProven:true},
 unsafeId:m=>m.lines[0].id=Number.MAX_SAFE_INTEGER+1,
 oversizedDescription:m=>m.description='x'.repeat(501)
}))test('schema and runtime agree on invalid '+name,()=>{
 const m=structuredClone(base);change(m);assert.equal(ajv(m),false);assert.equal(shape(m),false);assert.equal(compileCodeLineExercise(m).status,'invalid_reference');
});
test('generated checker matches Ajv for every example and Unicode boundaries',async()=>{
 for(const name of ['sum-js','sum-ts','dependencies-js','profiles-js']){const m=JSON.parse(await readFile(new URL('../examples/'+name+'.json',import.meta.url),'utf8'));assert.equal(ajv(m),true);assert.equal(shape(m),true);}
 for(let n=2047;n<=2049;n++){const m=structuredClone(base);m.lines[0].code='😀'.repeat(n);assert.equal(shape(m),ajv(m));assert.equal(compileCodeLineExercise(m).status==='invalid_reference',n>2048);}
});
test('reference integrity rejects dangling IDs, duplicate IDs, cycles and unknown scopes',()=>{
 for(const change of [m=>m.lines[1].dependencies=[99999],m=>m.lines[1].id=m.lines[0].id,m=>m.lines[0].dependencies=[m.lines.at(-1).id],m=>m.lines[1].scopeId='missing']){const m=structuredClone(base);change(m);assert.equal(compileCodeLineExercise(m).status,'invalid_reference');}
});
test('500 fixed rows compile with positional constraints and reject movement',()=>{
 const m={schemaVersion:2,id:'all-fixed',revision:1,language:'javascript',title:'',description:'',blocks:[],lines:Array.from({length:500},(_,i)=>({id:i+1,code:`const v${i} = ${i};`,dependencies:[],fixed:true,functionBlock:0,scopeId:null}))};
 const c=compileCodeLineExercise(m);assert.ok(!c.status,c.message);assert.equal(c.definition.edges.length,0);assert.ok(c.definition.tokens.every((token,index)=>token.fixedPosition===index));
 const lines=m.lines.map(x=>x.code);assert.equal(validateSubmission(c.compiled,{exerciseId:m.id,revision:1,lines}).status,'accepted');
 [lines[0],lines[1]]=[lines[1],lines[0]];assert.equal(validateSubmission(c.compiled,{exerciseId:m.id,revision:1,lines}).status,'rejected');
});
test('invalid search options retain a finite deterministic budget',()=>{
 const c=compileCodeLineExercise(base);assert.equal(validateSubmission(c.compiled,{exerciseId:base.id,revision:base.revision,lines:base.lines.map(x=>x.code)},{maxStates:NaN}).status,'accepted');
 assert.equal(validateSubmission(null,{}).status,'invalid_reference');
});


test('raw fixed positions reject invalid, out-of-range and colliding slots',()=>{
 const adapted=compileCodeLineExercise(base);assert.ok(!adapted.status);
 for(const fixedPosition of [-1,.5,NaN,Infinity,adapted.definition.tokens.length,'0',null]){
  const definition=structuredClone(adapted.definition);definition.tokens[0].fixedPosition=fixedPosition;assert.equal(compileDefinition(definition).status,'invalid_reference');
 }
 const collision=structuredClone(adapted.definition);collision.tokens[0].fixedPosition=0;collision.tokens[1].fixedPosition=0;assert.equal(compileDefinition(collision).status,'invalid_reference');
});

test('fixed duplicate text retains a content-valid positional witness',()=>{
 const definition={schemaVersion:1,id:'fixed-duplicates',revision:1,language:'javascript',title:'',description:'',blocks:[],tokens:[{id:'a',code:'same;',scope:null},{id:'pinned',code:'same;',scope:null,fixedPosition:1},{id:'b',code:'other;',scope:null}]};
 const compiled=compileDefinition(definition);assert.ok(!compiled.status);
 const report=validateSubmission(compiled,{exerciseId:definition.id,revision:1,lines:['other;','same;','same;']});assert.equal(report.status,'accepted');assert.equal(report.matchedTokenIds[1],'pinned');
 const moved=validateSubmission(compiled,{exerciseId:definition.id,revision:1,lines:['same;','other;','same;']});assert.equal(moved.status,'rejected');assert.equal(moved.reason,'rule_violation');assert.match(moved.message,/rögzített/);
});
