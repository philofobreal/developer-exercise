/** ADR-075 (v41): the author states per exercise whether class fields may be created by assignment
 * (`either`, default: an ES2015 down-level emit or TypeScript with useDefineForClassFields false) or
 * only as standard JavaScript defines them (`define`). Under `define` a field runs no inherited setter,
 * so the base-chain rule of ADR-073/074 does not tie the loose fields. The oracle implements the same
 * setting independently: a `define` fixture runs only the [[Define]] mode, in every environment. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {DEPENDENCY_POLICY,generateCodeLineExercise} from '../src/author/generator.mjs';
import {refreshAuthorModel,verifyAuthorModel} from '../dist/author/engine.js';
import {createReferenceAuditor} from '../dist/author/reference-audit.js';
import {auditReference} from '../src/author/audit.mjs';
import {admitAuthorModel,authorRequest} from '../public/app/author-workspace.js';
import {generate,measureFixture,CORPUS_CAPS} from './support/ordering-metrics.mjs';
import {createClassifier} from './support/order-classification.mjs';

const environments=['strict','es2015','sloppy'];
const setter=language=>['class B {',language==='typescript'?'  set f5(value: number) {':'  set f5(value) {',language==='typescript'?"    record('set', (this as any).g);":"    record('set', this.g);",'  }','}','class A extends B {','  f5 = 6;','  g = 7;','}','function evaluate() {','  const a = new A();','  return [a.g, a.f5];','}'];
// NY-36 (v56, ADR-130): these classes are script globals, which a caller may instantiate and list; the mechanism here
// is what field code runs, checked where no one lists keys („Nem számít”).
const fixture=(language,classFields)=>({id:`adr075-${language}-${classFields??'either'}`,origin:'adr-075',language,probe:'evaluate()',environments,keyOrder:'ignored',source:setter(language),...(classFields?{classFields}:{})});
/** The verdict for moving the row `code` (trimmed) to just after the row `target`. */
function verdict(program,code,target){
 const model=generate(program),order=model.lines.map(line=>line.id),at=text=>order.findIndex(id=>model.lines[id-1].code.trim()===text);
 const [moved]=order.splice(at(code),1);order.splice(at(target)+1,0,moved);
 return createClassifier(program,model).classify(order).kind;
}
const clean=program=>{const row=measureFixture(program,CORPUS_CAPS);assert.deepEqual([row.unsound,row.undecided,row.undecidedAccepted,row.indeterminate],[0,0,0,0],program.id);};

test('the generation rule is v41 or later, v41 introduced by ADR-075 in the formal contract',async()=>{
 assert.ok(Number(DEPENDENCY_POLICY.split('-v')[1])>=41,DEPENDENCY_POLICY);
 const contract=await readFile(new URL('../docs/formal-ordering-contract.md',import.meta.url),'utf8');
 assert.match(contract,/\| `scoped-effect-analysis-v41` \| \[ADR-075\]/);
});

test('both modes (default): a base setter of the field name keeps the loose fields in order',()=>{
 for(const language of ['javascript','typescript']){
  const program=fixture(language);
  assert.equal(verdict(program,'f5 = 6;','g = 7;'),'justified',language);
  clean(program);
 }
});

test('standard [[Define]] only: the field shadows the base setter, so the loose fields commute',()=>{
 for(const language of ['javascript','typescript']){
  const program=fixture(language,'define');
  assert.equal(verdict(program,'f5 = 6;','g = 7;'),'accepted',language);
  clean(program);
 }
});

test('the oracle runs the setting independently: without it the define-only accepted swap differs in [[Set]]',()=>{
 // Without the setting the oracle also runs [[Set]], where the swap is observable: the classifier
 // sees the define-only accepted order against both modes and would report it unsound.
 const program=fixture('javascript','define'),model=generate(program);
 const order=model.lines.map(line=>line.id),at=text=>order.findIndex(id=>model.lines[id-1].code.trim()===text);
 const [moved]=order.splice(at('f5 = 6;'),1);order.splice(at('g = 7;')+1,0,moved);
 const {classFields,...either}=program;
 assert.equal(classFields,'define');
 assert.equal(createClassifier(either,model).classify(order).kind,'unsound','the swap differs in the [[Set]] mode');
});

test('the setting is part of the evidence, of the verification and of a refresh; an unknown value is refused',async()=>{
 // „Nem számít”: the class is a script global, so with „Számít” its fields keep their order in either mode (NY-36).
 const source=setter('javascript').join('\n'),either=generateCodeLineExercise({source,keyOrder:'ignored'},ts),define=generateCodeLineExercise({source,classFields:'define',keyOrder:'ignored'},ts);
 assert.equal(either.authoring.evidence.environment.classFields,'either');
 assert.equal(define.authoring.evidence.environment.classFields,'define');
 const libraryDir=path.dirname(ts.getDefaultLibFilePath({}));
 const auditor=createReferenceAuditor(ts,name=>{try{return readFileSync(path.join(libraryDir,name),'utf8');}catch{return undefined;}});
 const ports={generate:input=>generateCodeLineExercise(input,ts)},audit=auditor.audit(source,'javascript').semantics;
 assert.equal((await verifyAuthorModel(define,ports,{audit})).checks.rederivation,'match');
 // Claiming both modes for the freed pair is a hand edit: it no longer re-derives.
 const forged={...define,authoring:{...define.authoring,evidence:{...define.authoring.evidence,environment:{...define.authoring.evidence.environment,classFields:'either'}}}};
 assert.equal((await verifyAuthorModel(forged,ports,{audit})).checks.rederivation,'differs');
 const {model}=await refreshAuthorModel(define,{...ports,audit:reference=>auditReference(reference,ts)});
 assert.deepEqual(model.lines.map(line=>line.dependencies),define.lines.map(line=>line.dependencies));
 assert.equal(model.authoring.evidence.environment.classFields,'define');
 assert.throws(()=>generateCodeLineExercise({source,classFields:'assign'},ts),/osztálymező/);
});

test('the author request sends the setting only when chosen, and an admitted model restores it',()=>{
 const author={title:'T',description:'D',language:'javascript',source:'x',message:''};
 assert.deepEqual(authorRequest({...author,classFields:'either'}),{title:'T',description:'D',language:'javascript',source:'x'});
 assert.deepEqual(authorRequest({...author,classFields:'define'}),{title:'T',description:'D',language:'javascript',source:'x',classFields:'define'});
 const model=generateCodeLineExercise({source:setter('javascript').join('\n'),classFields:'define'},ts),state={author:{...author},previews:new Map(),modelDraft:'',modelMessage:''};
 admitAuthorModel(state,model);
 assert.equal(state.author.classFields,'define');assert.equal(state.authorBaseline.classFields,'define');
});
