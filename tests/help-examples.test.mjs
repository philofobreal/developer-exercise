/** ADR-124 (H1–H3): the help is tested like code. Every example of the help runs through the real engine: an order
 *  example through the generator and the validator under the settings the policy resolver makes effective, a check
 *  example through the first gate. The help page carries every topic at its own anchor, the reason-code table is the
 *  registry, a setting's hint is the help's text, and the ⓘ bubble links to the page at its topic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {generateCodeLineExercise} from '../src/author/generator.mjs';
import {ExerciseCatalog} from '../src/server/catalog.mjs';
import {compileCodeLineExercise,validateSubmission} from '../dist/index.js';
import {resolveAuthorPolicy} from '../dist/author/preflight/config-resolver.js';
import {REASON_CODES} from '../dist/author/reason-codes.js';
import {BUBBLE_EXAMPLE_LINES,helpHref,helpSummary,helpTopics,renderExample,renderHelpPage,renderInfo} from '../public/app/help-topics.js';
import {renderPreflightSettings} from '../public/app/preflight-settings.js';
import {article,escapeHtml} from '../public/app/ui-utilities.js';
// ADR-135: the page is built with the vendored Prism (scripts/build-help.mjs); rendering here uses the same, so the
// shipped page can be compared with this source's build.
for(const grammar of ['prism-core','prism-clike','prism-javascript','prism-typescript'])await import(`../public/vendor/${grammar}.js`);

const TOP=['inputs','keyOrder','classFields','importEmit'];
/** The request as the workbench sends it: the environment at the top, the rest under `policy` (ADR-108). */
const request=(language,settings)=>({language,...Object.fromEntries(Object.entries(settings).filter(([key])=>TOP.includes(key))),policy:Object.fromEntries(Object.entries(settings).filter(([key])=>!TOP.includes(key)))});

const examples=helpTopics().filter(topic=>topic.example);
test('the help has the nine settings, each with an example',()=>{
 for(const id of ['tsDiagnostics','jsCheck','objectState','unknownPolicy','inputs','keyOrder','classFields','importEmit','portability'])assert.ok(examples.some(topic=>topic.id===id),id);
});

for(const topic of examples.filter(entry=>entry.example.kind==='order')){
 test(`order example „${topic.title}”: every outcome holds in the real engine`,()=>{
  const {language,source,swap:[first,second],outcomes}=topic.example;
  for(const outcome of outcomes){
   const policy=resolveAuthorPolicy(request(language,outcome.settings));
   assert.deepEqual(policy.conflicts.filter(conflict=>conflict.blocking),[],`${topic.id}: ${outcome.label} is a valid request`);
   const {importEmit,inputs,keyOrder,classFields}=policy.effective;
   const model=generateCodeLineExercise({source,language,...(language==='typescript'?{importEmit}:{}),inputs,keyOrder,classFields},ts);
   const compiled=compileCodeLineExercise(model);assert.ok(!('status' in compiled),topic.id);
   const lines=model.lines.map(line=>line.code);assert.ok(lines.length>=second,`${topic.id}: rows ${first} and ${second} exist`);
   [lines[first-1],lines[second-1]]=[lines[second-1],lines[first-1]];
   const verdict=validateSubmission(compiled.compiled,{exerciseId:model.id,revision:model.revision,lines});
   assert.equal(verdict.accepted,outcome.accepted,`${topic.id}: ${outcome.label} → ${verdict.status}`);
  }
 });
}

const catalog=new ExerciseCatalog(new Map());
for(const topic of examples.filter(entry=>entry.example.kind==='check')){
 test(`check example „${topic.title}”: every outcome holds at the first gate`,async()=>{
  const {language,source,outcomes}=topic.example;
  for(const outcome of outcomes){
   const {gate}=await catalog.checkSource({source,...request(language,outcome.settings)});
   assert.equal(gate.verdict,outcome.verdict,`${topic.id}: ${outcome.label}`);assert.equal(gate.admitted,outcome.admitted,`${topic.id}: ${outcome.label} admitted`);
   assert.deepEqual(gate.diagnostics.map(item=>item.code),outcome.finding?[outcome.finding]:[],`${topic.id}: ${outcome.label} findings`);
  }
 });
}

test('the page: every topic at its anchor in the contents and the body, the reason codes from the registry, the search script',()=>{
 const html=renderHelpPage(REASON_CODES);
 for(const topic of helpTopics()){
  assert.match(html,new RegExp(`<section class="help-topic" id="${topic.id}" data-help-topic>`),topic.id);
  assert.match(html,new RegExp(`data-help-entry="${topic.id}"><a href="#${topic.id}">`),topic.id);
 }
 for(const code of REASON_CODES)assert.ok(html.includes(`<code>${code.code}</code>`),code.code);
 assert.match(html,/<script type="module" src="..\/app\/help-search.js"><\/script>/);assert.doesNotMatch(html,/<script>(?!<\/script>)/,'no inline script (CSP)');
 assert.equal(readFileSync(new URL('../public/help/index.html',import.meta.url),'utf8'),html,'the shipped page is the build of this source');
});

test('one text: a setting’s hint is its help summary; the bubble links to the page at the topic in a new tab',()=>{
 const author={title:'T',description:'',language:'javascript',source:'',message:''};
 const html=renderPreflightSettings(author,undefined,'source')+renderPreflightSettings(author,undefined,'analysis');
 for(const id of ['jsCheck','objectState','unknownPolicy','inputs','keyOrder','classFields','portability']){
  assert.ok(html.includes(`id="preflight-${id}-hint">${escapeHtml(helpSummary(id))}</small>`),id);assert.ok(helpSummary(id).length>20,id);
  assert.match(html,new RegExp(`<span class="toggletip" data-help="${id}"><button type="button" class="info-button" data-info="${id}"`),id);
 }
 const bubble=renderInfo('keyOrder','Objektumkulcsok sorrendje');
 assert.match(bubble,/aria-label="Súgó: Objektumkulcsok sorrendje"/);
 assert.ok(bubble.includes(`href="${helpHref('keyOrder')}" target="_blank" rel="noopener"`));
 // ADR-141 (T2): the key-order example (10 lines) is the help page's; the bubble says its sentence and links to it.
 assert.ok(bubble.includes(helpSummary('keyOrder').slice(0,40)),'a bubble without its example says its sentence');
 assert.match(bubble,/>Példa és kipróbálás a súgóban<svg/);assert.doesNotMatch(bubble,/help-code/);
 const inputs=renderInfo('inputs','Bemenetek',{withSummary:false});
 assert.match(inputs,/A 2\. és 3\. sor cseréje:<ul><li><span class="help-outcome"><b>Szigorú:<\/b> elutasítva<\/span><button type="button" class="btn help-try" data-help-try="inputs" data-help-outcome="0" aria-label="Kipróbálom a Kód lépésben: Szigorú">Kipróbálom a Kód lépésben<\/button><\/li><li><span class="help-outcome"><b>Érvényes egyszerű adat:<\/b> elfogadva<\/span><button[^>]*data-help-outcome="1"[^>]*>Kipróbálom a Kód lépésben<\/button><\/li><\/ul><p class="help-try-note">A „Kipróbálom” a mostani forrást és beállításokat lecseréli; visszavonható\.<\/p>/);
 assert.equal(renderInfo('nincs-ilyen','x'),'');
});

test('markup: a bubble never stands inside a paragraph, where its blocks would close it and leave the bubble outside its wrapper (ADR-141)',async()=>{
 const {renderTaskStatus}=await import('../public/app/task-status.js');
 const {renderModelInsight,renderRuleKinds}=await import('../public/app/rule-panel.js');
 const {renderFindingGroups,renderSourceDiagnostics}=await import('../public/app/preflight-settings.js');
 const context=line=>({line,code:'TS2307',message:'Cannot find module',certainty:'unknown',origin:'environment'});
 const author={title:'T',description:'',language:'typescript',source:'',message:''};
 const html=[renderPreflightSettings(author,undefined,'source'),renderPreflightSettings(author,undefined,'analysis'),renderFindingGroups([context(1),context(2)]),renderSourceDiagnostics({verdict:'inconclusive',diagnostics:[context(1),context(2)]},false)].join('');
 assert.ok(html.includes('<span class="toggletip"'),'the markup holds bubbles');
 // An open <p> that a bubble follows before it closes (the bubble's own <p> lines close at once).
 assert.doesNotMatch(html,/<p(?:\s[^>]*)?>(?:(?!<\/p>).)*<span class="toggletip"/s,'a bubble inside <p>');
});

test('markup: an example’s lines are blocks with no newline between them (a newline inside <pre> doubled the line spacing)',()=>{
 const html=renderInfo('inputs','Bemenetek');
 const code=html.match(/<pre class="help-code"[^>]*><code>(.*?)<\/code><\/pre>/s)?.[1]??'';
 assert.ok(code.includes('<span class="help-line">'),'the example is rendered');assert.doesNotMatch(code,/\n/);
 assert.match(html,/<pre class="help-code" data-language="javascript" tabindex="0" aria-label="Kódpélda">/,'a scrollable example is reachable by keyboard');
 assert.match(renderHelpPage(REASON_CODES),/<div class="help-table" tabindex="0" role="region" aria-label="Okkódok táblázata">/,'the scrollable table too');
});

test('ADR-141 (T2): a bubble shows an example of at most 8 lines; a longer one is the help page’s, linked from the bubble',()=>{
 let long=0;
 for(const topic of helpTopics()){
  const bubble=renderInfo(topic.id,topic.title,{withSummary:false}),lines=(bubble.match(/class="help-line"/g)??[]).length;
  assert.ok(lines<=BUBBLE_EXAMPLE_LINES,`${topic.id}: ${lines} lines in the bubble`);
  if(topic.example&&topic.example.source.split('\n').length>BUBBLE_EXAMPLE_LINES){long++;assert.match(bubble,/Példa és kipróbálás a súgóban/,topic.id);assert.ok(bubble.includes(`<p>`),topic.id+': its sentence');}
  if(topic.example)assert.ok(renderExample(topic.example,topic.id,'page').includes('help-code'),topic.id+': the page keeps the whole example');
 }
 assert.ok(long>=3,'keyOrder, classFields and portability are longer than a bubble');
});

test('ADR-141 (T2): the article before a number follows how it is read (a 2., az 5., az 1000.)',()=>{
 const table={0:'a',1:'az',2:'a',5:'az',10:'a',15:'a',50:'az',55:'az',100:'a',105:'a',150:'a',500:'az',512:'az',1000:'az',1500:'az',2000:'a',5000:'az',12000:'a',150000:'a',1000000:'az'};
 for(const [n,expected] of Object.entries(table))assert.equal(article(Number(n)),expected,n);
 assert.equal(article(5,true),'Az');assert.equal(article(3,true),'A');
});
