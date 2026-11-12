/** ADR-108 (E7): the author's settings block and the first gate's findings. The block shows the resolver's
 *  answer and never recomputes it: a lock is a disabled control with the effective value, its reason and how to
 *  lift it; options outside the language are not shown; the start value of a new exercise and the value an old
 *  model is read with are named as such; a finding points at its line and says how certain it is. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPreflightSettings,renderSourceDiagnostics,setPreflightOption,preflightRequest} from '../public/app/preflight-settings.js';
import {authorRequest} from '../public/app/author-workspace.js';
import {resolveAuthorPolicy} from '../dist/author/preflight/config-resolver.js';
import {sourceGate} from '../dist/author/preflight/source-gate.js';

const draft=(extra={})=>({title:'T',description:'',language:'javascript',source:'const a = 1;',message:'',inputs:'valid',keyOrder:'ignored',classFields:'define',...extra});
const resolve=author=>resolveAuthorPolicy(authorRequest(author));
/** Both steps' blocks (ADR-123): the Kód step's source check and the Elemzés és szabályok step's environment. */
const both=(author,resolution)=>renderPreflightSettings(author,resolution,'source')+renderPreflightSettings(author,resolution,'analysis');
const control=(html,path)=>html.match(new RegExp(`<div class="preflight-setting[^"]*" data-preflight-setting="${path}">.*?</small></div>`))?.[0]??'';

test('groups follow the language: a JavaScript draft has checkJs and no TypeScript options, and the reverse',()=>{
 const js=both(draft(),resolve(draft()));
 for(const group of ['Elemzési környezet','Forrás biztonságossága','Haladó profil'])assert.match(js,new RegExp(`<legend>${group}</legend>`));
 assert.match(js,/data-preflight="jsCheck"/);assert.doesNotMatch(js,/data-preflight="(tsDiagnostics|importEmit)"/);
 const ts=both(draft({language:'typescript'}),resolve(draft({language:'typescript'})));
 assert.match(ts,/data-preflight="tsDiagnostics"/);assert.match(ts,/data-preflight="importEmit"/);assert.doesNotMatch(ts,/data-preflight="jsCheck"/);
 assert.doesNotMatch(js,/Oktatási sorrendi/,'no group without an analyzer behind it (deviation 2)');
});

test('ADR-123 (M5): each step shows its own settings: the source check in Kód, the environment and the profile in Elemzés és szabályok',()=>{
 const author=draft({language:'typescript'}),resolution=resolve(author);
 const source=renderPreflightSettings(author,resolution,'source'),analysis=renderPreflightSettings(author,resolution,'analysis');
 assert.match(source,/<legend>Forrás biztonságossága<\/legend>/);assert.doesNotMatch(source,/<legend>(Elemzési környezet|Haladó profil)<\/legend>/);
 for(const path of ['tsDiagnostics','objectState','unknownPolicy'])assert.match(source,new RegExp(`data-preflight="${path}"`));
 for(const path of ['inputs','keyOrder','classFields','importEmit','portability'])assert.match(analysis,new RegExp(`data-preflight="${path}"`)),assert.doesNotMatch(source,new RegExp(`data-preflight="${path}"`));
 assert.match(source,/<b>Vizsgálati beállítások<\/b><span data-preflight-summary>ellenőrzés: kötések, objektumállapot · bizonytalan: figyelmeztet<\/span>/);
 assert.match(analysis,/<b>Elemzési beállítások<\/b><span data-preflight-summary>érvényes adat · kulcssorrend nem számít · szabványos mezők · verbatim<\/span>/);
 assert.match(analysis,/data-memory="analysis-options-analysis"/);assert.match(source,/data-memory="analysis-options-source"/);
});

test('values are named: the start of a new exercise and the compatibility value of old models, never “alapértelmezett”',()=>{
 const html=both(draft(),undefined);
 assert.match(control(html,'inputs'),/Érvényes egyszerű adat[^<]*\(új feladat kezdőértéke\)/);
 assert.match(control(html,'inputs'),/Szigorú[^<]*\(régi modellek kompatibilitási értéke\)/);
 assert.match(control(html,'unknownPolicy'),/Figyelmeztet[^<]*\(új feladat kezdőértéke\)/);
 assert.doesNotMatch(html,/alapértelmezett/);
 // An old model's absent value is read as the compatibility value.
 assert.match(control(both(draft({inputs:undefined}),undefined),'inputs'),/<option value="any" selected>/);
});

test('the conservative profile: locked controls are disabled, show the effective value, say why and how the choice comes back',()=>{
 const author=draft();assert.equal(setPreflightOption(author,'portability','conservative'),true);
 const resolution=resolve(author),html=both(author,resolution);
 assert.deepEqual(resolution.locks.map(lock=>lock.path),['inputs','keyOrder','classFields']);
 const inputs=control(html,'inputs');
 assert.match(inputs,/<select id="preflight-inputs" data-preflight="inputs" aria-describedby="preflight-inputs-why preflight-inputs-hint" disabled>/);
 assert.match(inputs,/<option value="any" selected>/);assert.match(inputs,/zárolva/);
 assert.match(inputs,/<summary>Miért\?<\/summary><p id="preflight-inputs-why">A konzervatív sorrend[^<]*Feloldás: állítsd a Hordozhatóságot[^<]*„Érvényes egyszerű adat”/);
 assert.doesNotMatch(control(html,'objectState'),/disabled/,'an option outside the preset stays free');
 assert.match(html,/<span data-preflight-summary>szigorú bemenet · kulcssorrend számít · mindkét mezőmód · [^<]*konzervatív profil · 3 zárolt<\/span>/);
 assert.equal(author.inputs,'valid','the request is kept under the lock');
 setPreflightOption(author,'portability','configured');
 assert.doesNotMatch(both(author,resolve(author)),/disabled/);
});

test('the request carries only what differs from the start, under policy; unknown options and values change nothing',()=>{
 const author=draft();
 assert.equal(preflightRequest(author),undefined);assert.equal('policy' in authorRequest(author),false);
 setPreflightOption(author,'unknownPolicy','block');setPreflightOption(author,'objectState','local');setPreflightOption(author,'tsDiagnostics','strict');
 assert.deepEqual(authorRequest(author).policy,{unknownPolicy:'block'},'start values and options of the other language stay out');
 assert.equal(setPreflightOption(author,'unknownPolicy','require-ack'),false);assert.equal(setPreflightOption(author,'controlFlow','on'),false);
 assert.equal(author.policy.unknownPolicy,'block');
 assert.match(both(author,resolve(author)),/bizonytalan: tilt/);
});

test('a refused request is shown as an alert, as the compile request would refuse it (C33)',()=>{
 // A value the controls never offer, brought in for example by an older session: the resolver refuses it.
 const author=draft({policy:{unknownPolicy:'require-ack'}}),html=both(author,resolve(author));
 assert.match(html,/<ul class="preflight-conflicts" role="alert"><li>Nem eldönthető eredmények: érvénytelen érték \(require-ack\)/);
});

test('findings: certainty in words, the line as a button, the origin; out-of-date findings say so',()=>{
 const policy=resolveAuthorPolicy({language:'javascript'});
 const gate=sourceGate({semantics:'ok',diagnostics:[],assumptions:[],unresolved:[]},policy,{completeness:'within-supported-scope',findings:[{line:3,code:'BS001',certainty:'definite',origin:'runtime-order',binding:'x',message:'A(z) „x” <kötés> az inicializálása előtt.'}]});
 assert.equal(gate.verdict,'blocked');
 const html=renderSourceDiagnostics(gate,false);
 assert.match(html,/<h3 id="source-diagnostics-title">A modell nem készült el: a forrás hibás<\/h3>/);
 assert.match(html,/<span class="diagnostic-kind">Biztos hiba<\/span><button type="button" class="diagnostic-line" data-goto-line="3" aria-label="Ugrás a 3\. sorra a forrásban">3\. sor<\/button>/);
 assert.match(html,/&lt;kötés&gt;/,'messages are escaped');assert.match(html,/futási sorrend · BS001/);
 assert.doesNotMatch(html,/data-diagnostics-stale/);assert.match(renderSourceDiagnostics(gate,true),/data-diagnostics-stale/);
 assert.equal(renderSourceDiagnostics(undefined,false),'');
});

test('an absent value is shown as the resolver reads it: the compatibility values are the resolver’s fallback',()=>{
 for(const language of ['javascript','typescript']){
  const bare={title:'T',description:'',language,source:'',message:''},html=both(bare,undefined),fallback=resolveAuthorPolicy({language}).effective;
  const shown=[...html.matchAll(/data-preflight="([^"]+)"[^>]*>(?:(?!<\/select>).)*?<option value="([^"]+)" selected>/g)].map(([,path,value])=>[path,value]);
  assert.ok(shown.length>=7,language);
  for(const [path,value] of shown)assert.equal(value,fallback[path],`${language} ${path}`);
 }
});

test('a resolution made for another request is not shown: the locks belong to the request that asked for them',()=>{
 const author=draft();setPreflightOption(author,'portability','conservative');const stale=resolve(author);
 setPreflightOption(author,'portability','configured');
 assert.doesNotMatch(both(author,stale),/disabled/);
 assert.match(both({...author,policy:{portability:'conservative'}},stale),/disabled/);
});

test('C16: what the environment does not offer is a disabled option that says why, even before a matching resolution arrives',()=>{
 const author=draft(),local=resolveAuthorPolicy(authorRequest(author),{languageAudit:false});
 const html=both(author,local);
 assert.match(control(html,'unknownPolicy'),/<option value="block" disabled>Tilt[^<]*\(csak szerveren\)<\/option>/);
 assert.match(control(html,'unknownPolicy'),/data-server-only="unknownPolicy">[^<]*csak a szerveren választható/);
 assert.match(control(html,'jsCheck'),/<option value="on" disabled>/);
 assert.doesNotMatch(control(both(author,resolve(author)),'unknownPolicy'),/disabled/,'the server offers it');
 const changed={...author,policy:{objectState:'off'}};
 assert.match(control(both(changed,local),'unknownPolicy'),/<option value="block" disabled>/,'an environment fact needs no fresh resolution');
 // A server session that asked for checkJs: kept in the request, inactive here, and said so.
 const asked=draft({policy:{jsCheck:'on'}});
 assert.match(control(both(asked,resolveAuthorPolicy(authorRequest(asked),{languageAudit:false})),'jsCheck'),/data-server-only="jsCheck">JavaScript típusellenőrzés: Itt nem fut/);
});
