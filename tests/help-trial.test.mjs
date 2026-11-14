/** ADR-135 (NY-31): „Kipróbálom” and the highlighted examples of the help. A trial loads the example's source under one
 *  outcome's settings; the request the workbench then sends must resolve to the very policy the help's own test runs
 *  (help-examples.test.mjs), so what the author sees reproduces what the help claims. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveAuthorPolicy} from '../dist/author/preflight/config-resolver.js';
import {helpTopics,helpTrial,helpTrialFromHash,helpTrialHref,renderExample} from '../public/app/help-topics.js';
import {authorRequest,canUndoReplace,startFromHelp,undoReplace} from '../public/app/author-workspace.js';
import {highlightLines} from '../public/app/ui-utilities.js';

const TOP=['inputs','keyOrder','classFields','importEmit'];
/** The request as help-examples.test.mjs builds it. */
const helpRequest=(language,settings)=>({language,...Object.fromEntries(Object.entries(settings).filter(([key])=>TOP.includes(key))),policy:Object.fromEntries(Object.entries(settings).filter(([key])=>!TOP.includes(key)))});
const draft=()=>({author:{title:'Saját',description:'Leírás',level:'basic',language:'javascript',source:'let mine = 1;',message:'',inputs:'valid',keyOrder:'ignored',classFields:'define',policy:{jsCheck:'on'}}});

const trials=helpTopics().filter(topic=>topic.example).flatMap(topic=>topic.example.outcomes.map((outcome,index)=>({topic,outcome,index})));

test('every outcome of every example is a trial',()=>{
 assert.equal(trials.length,18);
 for(const {topic,index} of trials)assert.ok(helpTrial(topic.id,index),topic.id);
 assert.equal(helpTrial('steps',0),undefined,'a topic without an example');assert.equal(helpTrial('keyOrder',9),undefined);assert.equal(helpTrial('nincs',0),undefined);
});

test('a trial loads the source under exactly the policy the help test resolves, whatever the draft had',()=>{
 for(const {topic,outcome,index} of trials){
  const state=draft();startFromHelp(state,helpTrial(topic.id,index));
  const request=authorRequest(state.author),expected=resolveAuthorPolicy(helpRequest(topic.example.language,outcome.settings));
  assert.equal(request.source,topic.example.source);assert.equal(request.language,topic.example.language);
  assert.deepEqual(resolveAuthorPolicy(request).effective,expected.effective,`${topic.id}: ${outcome.label}`);
  assert.equal(resolveAuthorPolicy(request).fingerprint,expected.fingerprint,`${topic.id}: ${outcome.label}`);
  assert.deepEqual([state.author.title,state.author.description,state.author.level],['Saját','Leírás','basic'],'the learner-facing data stay the author’s');
  assert.match(state.author.message,new RegExp(`${topic.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')} \\(${outcome.label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\)`));
 }
});

test('the replaced draft comes back with undo',()=>{
 const state=draft(),before=structuredClone(state.author);startFromHelp(state,helpTrial('keyOrder',1));
 assert.equal(canUndoReplace(state),true);undoReplace(state);assert.deepEqual({...state.author,message:''},before);assert.match(state.author.message,/Visszaállítottuk/);
});

test('the help page address names a trial; anything else names none',()=>{
 for(const {topic,index} of trials){
  const href=helpTrialHref(topic.id,index);assert.match(href,/^\.\.\/index\.html#kiprobalom=/);
  assert.deepEqual(helpTrialFromHash(href.slice(href.indexOf('#'))),helpTrial(topic.id,index));
 }
 for(const hash of ['','#','#keyOrder','#kiprobalom=keyOrder','#kiprobalom=keyOrder.x','#kiprobalom=%E0%A4%A.0','#kiprobalom=nincs.0','#kiprobalom=keyOrder.0&x'])assert.equal(helpTrialFromHash(hash),undefined,hash);
});

test('an example renders a Kipróbálom per outcome: a button in the workbench, a link to it on the page',()=>{
 const topic=helpTopics().find(entry=>entry.id==='keyOrder');
 const bubble=renderExample(topic.example,topic.id,'workbench'),page=renderExample(topic.example,topic.id,'page');
 assert.equal(bubble.match(/<button type="button" class="btn help-try" data-help-try="keyOrder" data-help-outcome="\d"/g)?.length,topic.example.outcomes.length);
 assert.equal(page.match(/<a class="btn help-try" href="\.\.\/index\.html#kiprobalom=keyOrder\.\d"/g)?.length,topic.example.outcomes.length);
 assert.doesNotMatch(page,/<button/);
 // prism.css paints any `language-` element with its own light background: in the dark theme the listing's light tokens
 // then stood on a light ground (contrast 1.28, the a11y gate).
 for(const html of [bubble,page])assert.doesNotMatch(html,/class="[^"]*\blanguage-/);
});

test('highlighted lines: one well-formed line per source line, a multi-line token keeps its class on each line',async()=>{
 const source='const a = `x\ny`; // c\nlet <b> = 1;';
 const plain=highlightLines(source,'javascript');
 assert.deepEqual(plain,['const a = `x','y`; // c','let &lt;b&gt; = 1;'],'without Prism: escaped text');
 for(const grammar of ['prism-core','prism-clike','prism-javascript'])await import(`../public/vendor/${grammar}.js`);
 const lines=highlightLines(source,'javascript');
 assert.equal(lines.length,3);
 for(const line of lines)assert.equal((line.match(/<span/g)??[]).length,(line.match(/<\/span>/g)??[]).length,line);
 assert.match(lines[0],/class="token template-string"/);assert.match(lines[1],/^<span class="token template-string"><span class="token string">y/);
 assert.equal(lines.map(line=>line.replace(/<\/?span[^>]*>/g,'')).join('\n').replace(/&lt;/g,'<').replace(/&gt;/g,'>'),source,'the text is the source, escaped');assert.doesNotMatch(lines.join(''),/<b>/,'markup in the source stays text');
 delete globalThis.Prism;
});
