/** ADR-108 (E7): the author's analysis settings and the first gate's findings, as the Source step shows them.
 *
 * Hidden here: which options exist for which language and in which group, how each value is named, which value
 * a new exercise starts from and which one an old model is read with, how a locked control explains itself
 * ("Miért?" and how to lift it), the one-line summary, and how a gate finding points at its line and groups with
 * findings of the same cause (ADR-122). What the
 * analysis does with a setting, which preset locks what and which request is refused stay with the policy
 * resolver: this module only shows the resolution it is given and never recomputes it. A resolution made for
 * another request than the author's current one is not shown (the caller asks again; `settingsKey`).
 *
 * The start values are this module's decision (ADR-106); the compatibility values are the resolver's fallback,
 * which `tests/preflight-settings.test.mjs` holds equal.
 */
import type {AuthorDraft,PreflightOptions,SettingsOrigin} from './contracts.js';
import type {PolicyPath,PolicyResolution,PolicyUnavailable} from '../../dist/author/preflight/config-resolver.js';
import type {GateDiagnostic,SourceGate} from '../../dist/author/preflight/source-gate.js';
import {escapeHtml as esc} from './ui-utilities.js';
import {helpSummary,renderInfo} from './help-topics.js';

type Language='javascript'|'typescript';
/** ADR-106: the environment a new reference starts from (the author's choice): plain valid inputs, key order not
 * observed, standard class fields. A model brought in by JSON, a session or an admission keeps its own settings. */
export const NEW_DRAFT_SETTINGS={inputs:'valid',keyOrder:'ignored',classFields:'define'} as const satisfies Pick<AuthorDraft,'inputs'|'keyOrder'|'classFields'>;
/** `short`: the value in the folded summary. */
interface Choice {value:string;label:string;short?:string;}
interface Setting {
 path:PolicyPath;label:string;choices:readonly Choice[];
 /** The value a new exercise starts from (ADR-106). */
 start:string;
 /** The value an older model without this record is read with, when it differs from `start`. */
 legacy?:string;
 language?:Language;
}
/** ADR-123 (M5): where a group is set: `source` (the Kód step: what the source check looks for) or `analysis` (the
 * Elemzés és szabályok step: the environment the order is analysed in, and the profile that locks it). */
export type SettingsScope='source'|'analysis';
interface Group {title:string;intro:string;scope:SettingsScope;settings:readonly Setting[];}

/** The groups of the plan (§6); the pedagogical ordering group waits for its analyzer (ADR-108, deviation 2). */
const GROUPS:readonly Group[]=[
 {title:'Elemzési környezet',intro:'Milyen környezetben fut a referencia: ettől függ, mely sorok cserélhetők fel.',scope:'analysis',settings:[
  {path:'importEmit',label:'Importok kibocsátása',language:'typescript',start:'verbatim',choices:[
   {value:'verbatim',label:'verbatim · minden import megmarad',short:'verbatim'},{value:'elide-unused',label:'elide-unused · a csak típusként használt import kimarad',short:'elide-unused'}]},
  {path:'inputs',label:'Bemenetek',start:NEW_DRAFT_SETTINGS.inputs,legacy:'any',choices:[
   {value:'any',label:'Szigorú · bármilyen érték, trükkös objektumok is',short:'szigorú bemenet'},{value:'valid',label:'Érvényes egyszerű adat · számok, szövegek, tömbök, sima objektumok',short:'érvényes adat'}]},
  {path:'keyOrder',label:'Objektumkulcsok sorrendje',start:NEW_DRAFT_SETTINGS.keyOrder,legacy:'observed',choices:[
   {value:'observed',label:'Számít · a kulcsok létrehozási sorrendje a megoldás része',short:'kulcssorrend számít'},{value:'ignored',label:'Nem számít · a kulcsokat sorrendjüktől függetlenül hasonlítjuk',short:'kulcssorrend nem számít'}]},
  {path:'classFields',label:'Osztálymezők létrehozása',start:NEW_DRAFT_SETTINGS.classFields,legacy:'either',choices:[
   {value:'either',label:'Mindkét mód · szabványos definíció és régi értékadás is',short:'mindkét mezőmód'},{value:'define',label:'Csak szabványos · natív osztálymezők, useDefineForClassFields: true',short:'szabványos mezők'}]}]},
 {title:'Forrás biztonságossága',intro:'Mit keres a Forrás vizsgálata és a Modell készítése, mielőtt a forrásból sorok és szabályok lesznek.',scope:'source',settings:[
  {path:'tsDiagnostics',label:'TypeScript-diagnosztika',language:'typescript',start:'baseline',choices:[
   {value:'baseline',label:'Alap · a fordító alapbeállításai'},{value:'strict',label:'Szigorú · strict fordítóbeállítások'}]},
  {path:'jsCheck',label:'JavaScript típusellenőrzés',language:'javascript',start:'off',choices:[
   {value:'off',label:'Ki'},{value:'on',label:'Be · checkJs'}]},
  {path:'objectState',label:'Helyi objektumállapot',start:'local',choices:[
   {value:'local',label:'Ellenőrzi · biztos null/undefined elérés és nem függvény hívása'},{value:'off',label:'Ki'}]},
  {path:'unknownPolicy',label:'Nem eldönthető eredmények',start:'warn',choices:[
   {value:'warn',label:'Figyelmeztet · továbbléphetsz'},{value:'block',label:'Tilt · csak eldöntött eredménnyel lehet továbblépni'}]}]},
 {title:'Haladó profil',intro:'Előre beállított, együtt mozgó értékek: a konzervatív profil a fenti környezetet a legszigorúbb értékére zárja.',scope:'analysis',settings:[
  {path:'portability',label:'Hordozhatóság',start:'configured',choices:[
   {value:'configured',label:'Beállított környezet · a fenti választások szerint'},{value:'conservative',label:'Konzervatív · minden környezeti beállítás a legszigorúbb értéken'}]}]}
];
const SETTINGS:readonly Setting[]=GROUPS.flatMap(group=>group.settings);
const TOP_LEVEL=new Set<PolicyPath>(['inputs','keyOrder','classFields','importEmit']);
const settingOf=(path:string):Setting|undefined=>SETTINGS.find(setting=>setting.path===path);
const applies=(setting:Setting,language:string):boolean=>!setting.language||setting.language===language;

/** The value the author asked for (an absent one is the value an older model is read with). */
function requested(author:AuthorDraft,setting:Setting):string {
 const value=TOP_LEVEL.has(setting.path)?(author as unknown as Record<string,string|undefined>)[setting.path]:author.policy?.[setting.path as keyof PreflightOptions];
 return value??setting.legacy??setting.start;
}
/** Records one choice from a control of this module; an unknown option or value changes nothing. */
export function setPreflightOption(author:AuthorDraft,path:string,value:string):boolean {
 const setting=settingOf(path);
 if(!setting||!setting.choices.some(choice=>choice.value===value))return false;
 if(TOP_LEVEL.has(setting.path))(author as unknown as Record<string,string>)[setting.path]=value;
 else author.policy={...author.policy,[setting.path]:value};
 return true;
}
/** The nested part of the request (`policy`), with the values a new exercise starts from left out. */
export function preflightRequest(author:AuthorDraft):PreflightOptions|undefined {
 const entries=Object.entries(author.policy??{}).filter(([path,value])=>{const setting=settingOf(path);return setting&&value!==setting.start&&applies(setting,author.language);});
 return entries.length?Object.fromEntries(entries) as PreflightOptions:undefined;
}
export type SettingsRequest=Pick<AuthorDraft,'importEmit'|'inputs'|'keyOrder'|'classFields'|'policy'>;
/** The settings part of a generation request: the source-contract options at the top level, where they differ
 * from the compatibility value (the import emit only for TypeScript, ADR-013), the preflight options under `policy`. */
export function settingsRequest(author:AuthorDraft):SettingsRequest {
 const {importEmit,inputs,keyOrder,classFields}=author,policy=preflightRequest(author);
 return {...(author.language==='typescript'&&importEmit==='elide-unused'?{importEmit}:{}),...(inputs==='valid'?{inputs}:{}),...(keyOrder==='ignored'?{keyOrder}:{}),...(classFields==='define'?{classFields}:{}),...(policy?{policy}:{})};
}
/** ADR-108 (E8): the settings recorded in a session file, as a request. A file is untrusted: an option or value the
 * controls do not offer refuses the import (it is never dropped silently); the resolver checks the rest again. */
export function readSettings(value:unknown):SettingsRequest {
 const record=(item:unknown):item is Record<string,unknown>=>typeof item==='object'&&item!==null&&!Array.isArray(item);
 const refuse=(what:string):never=>{throw Error(`Érvénytelen elemzési beállítás a munkamenetben: ${what}.`);};
 if(!record(value))return refuse('nem objektum');
 const author:AuthorDraft={title:'',description:'',language:'typescript',source:'',message:''};
 const take=(path:string,item:unknown):void=>{if(typeof item!=='string'||!setPreflightOption(author,path,item))refuse(`${path}=${String(item)}`);};
 for(const [path,item] of Object.entries(value)){
  if(path==='policy'){if(!record(item))refuse('policy');else for(const [nested,option] of Object.entries(item)){if(TOP_LEVEL.has(nested as PolicyPath))refuse(`policy.${nested}`);take(nested,option);}}
  else if(TOP_LEVEL.has(path as PolicyPath))take(path,item);
  else refuse(path);
 }
 const {importEmit,inputs,keyOrder,classFields,policy}=author;
 return {...(importEmit?{importEmit}:{}),...(inputs?{inputs}:{}),...(keyOrder?{keyOrder}:{}),...(classFields?{classFields}:{}),...(policy?{policy}:{})};
}
/** ADR-108 (E8): what the author should know about settings that were not their own choices in this session. */
export function renderSettingsOrigin(origin:SettingsOrigin|undefined):string {
 if(origin==='partial')return '<p class="settings-origin" data-settings-origin="partial" role="note">A betöltött modell nem rögzítette minden elemzési beállítását (régebbi munkamenet vagy JSON-modell). A modell saját környezeti adatait használtuk, a többit az új feladat kezdőértékével ellenőriztük. Az eredeti forrás és a beállítások hitelessége ezért részleges; ha mást szeretnél, állítsd be és készítsd újra a modellt.</p>';
 if(origin==='recorded')return '<p class="settings-origin" data-settings-origin="recorded" role="note">Az elemzési beállítások a betöltött munkamenetből származnak; a modellt ezekkel újra ellenőriztük.</p>';
 return '';
}
/** Equal for two drafts exactly when a resolution of one is a resolution of the other. */
export const settingsKey=(author:AuthorDraft):string=>JSON.stringify([author.language,settingsRequest(author)]);
/** Whether `resolution` answers the author's current request (the resolver echoes what it was asked). */
function answers(resolution:PolicyResolution|undefined,author:AuthorDraft):resolution is PolicyResolution {
 if(!resolution||resolution.language!==(author.language==='typescript'?'typescript':'javascript'))return false;
 const {policy,...top}=settingsRequest(author),asked:Record<string,string|undefined>={...top,...policy};
 // A refused value is not echoed; its conflict names the path instead.
 const refused=new Set(resolution.conflicts.map(conflict=>conflict.path.replace(/^policy\./,'')));
 const keys=new Set([...Object.keys(asked),...Object.keys(resolution.requested)]);
 return [...keys].every(key=>refused.has(key)||asked[key]===resolution.requested[key as PolicyPath]);
}

const choiceLabel=(setting:Setting,value:string):string=>setting.choices.find(choice=>choice.value===value)?.label.split(' · ')[0]??value;
const suffix=(setting:Setting,value:string):string=>value===setting.start?' (új feladat kezdőértéke)':value===setting.legacy?' (régi modellek kompatibilitási értéke)':'';
const controlId=(path:string):string=>`preflight-${path}`;

/** `environment`: the values not offered where the analysis runs (C16), whatever the request; `resolution` answers it. */
function control(setting:Setting,author:AuthorDraft,resolution:PolicyResolution|undefined,environment:readonly PolicyUnavailable[]):string {
 const lock=resolution?.locks.find(item=>item.path===setting.path),asked=requested(author,setting),shown=lock?lock.effective:asked;
 const off=environment.filter(item=>item.path===setting.path),inactive=resolution?.inactive.find(item=>item.path===setting.path);
 const options=setting.choices.map(choice=>{const unavailable=off.some(item=>item.value===choice.value);return `<option value="${esc(choice.value)}"${choice.value===shown?' selected':''}${unavailable?' disabled':''}>${esc(choice.label+suffix(setting,choice.value)+(unavailable?' (csak szerveren)':''))}</option>`;}).join('');
 const hintId=`${controlId(setting.path)}-hint`,whyId=`${controlId(setting.path)}-why`;
 const notes=[inactive?.reason,...off.filter(item=>item.value!==shown||!inactive).map(item=>item.reason)].filter((note,index,all):note is string=>!!note&&all.indexOf(note)===index);
 const why=lock?`<details class="lock-why" data-lock-why="${esc(setting.path)}"><summary>Miért?</summary><p id="${whyId}">${esc(lock.reason)} Feloldás: állítsd a Hordozhatóságot „Beállított környezet” értékre${asked!==lock.effective?`; ekkor a választásod („${esc(choiceLabel(setting,asked))}”) visszaáll`:''}.</p></details>`:'';
 return `<div class="preflight-setting${lock?' locked':''}" data-preflight-setting="${esc(setting.path)}"><div class="setting-head"><label for="${controlId(setting.path)}">${esc(setting.label)}${lock?' <span class="lock-label">zárolva</span>':''}</label>${renderInfo(setting.path,setting.label,{withSummary:false})}</div><select id="${controlId(setting.path)}" data-preflight="${esc(setting.path)}" aria-describedby="${lock?whyId+' ':''}${hintId}" ${lock?'disabled':''}>${options}</select>${why}<small class="inline-hint" id="${hintId}">${esc(helpSummary(setting.path))}</small>${notes.map(note=>`<small class="inline-hint server-only" data-server-only="${esc(setting.path)}">${esc(note)}</small>`).join('')}</div>`;
}

/** One line per scope: for the source check, what it looks for and how undecided findings count; for the analysis,
 * the environment as it will run, the profile and the locks. */
function summary(author:AuthorDraft,resolution:PolicyResolution|undefined,scope:SettingsScope):string {
 const value=(path:PolicyPath):string=>{const setting=settingOf(path)!;return resolution?.locks.find(lock=>lock.path===path)?.effective??requested(author,setting);};
 const short=(path:PolicyPath):string=>{const setting=settingOf(path)!,current=value(path);return setting.choices.find(choice=>choice.value===current)?.short??current;};
 const typescript=author.language==='typescript';
 if(scope==='source'){
  const checks=['kötések',value('objectState')==='local'?'objektumállapot':'',typescript?(value('tsDiagnostics')==='strict'?'strict TS':''):(value('jsCheck')==='on'?'checkJs':'')].filter(Boolean);
  return ['ellenőrzés: '+checks.join(', '),value('unknownPolicy')==='block'?'bizonytalan: tilt':'bizonytalan: figyelmeztet'].join(' · ');
 }
 const environment=(['inputs','keyOrder','classFields',...(typescript?['importEmit'] as const:[])] as const).map(short),locks=resolution?.locks.length??0;
 return [...environment,value('portability')==='conservative'?'konzervatív profil':'',locks?`${locks} zárolt`:''].filter(Boolean).join(' · ');
}

const SCOPE_TITLE:Readonly<Record<SettingsScope,string>>={source:'Vizsgálati beállítások',analysis:'Elemzési beállítások'};
/** The folded settings block of one step (ADR-123): the Kód step shows the source check's settings, the Elemzés és
 * szabályok step the analysis environment and profile. Both come from the author's one request and its last resolution. */
export function renderPreflightSettings(author:AuthorDraft,resolution:PolicyResolution|undefined,scope:SettingsScope='source'):string {
 const current=answers(resolution,author)?resolution:undefined;
 // What the environment does not offer depends on the language only, so a resolution for an earlier request still says it.
 const environment=resolution&&resolution.language===(author.language==='typescript'?'typescript':'javascript')?resolution.unavailable??[]:[];
 const mine=GROUPS.filter(group=>group.scope===scope),paths=new Set<PolicyPath>(mine.flatMap(group=>group.settings.map(setting=>setting.path)));
 // A conflict of no one setting (a malformed policy object) is shown where the source is checked, so it is never lost.
 const conflicts=current?.conflicts.filter(conflict=>conflict.blocking&&(paths.has(conflict.path as PolicyPath)||scope==='source'&&!settingOf(conflict.path)))??[];
 const groups=mine.map(group=>{const settings=group.settings.filter(setting=>applies(setting,author.language));return settings.length?`<fieldset class="preflight-group"><legend>${esc(group.title)}</legend><p class="inline-hint">${esc(group.intro)}</p><div class="options-grid">${settings.map(setting=>control(setting,author,current,environment)).join('')}</div></fieldset>`:'';}).join('');
 return `<details class="analysis-options" data-memory="analysis-options-${scope}" data-settings-scope="${scope}"><summary><b>${SCOPE_TITLE[scope]}</b><span data-preflight-summary>${esc(summary(author,current,scope))}</span></summary>${conflicts.length?`<ul class="preflight-conflicts" role="alert">${conflicts.map(conflict=>`<li>${esc(conflict.message)}</li>`).join('')}</ul>`:''}${groups}</details>`;
}

const CERTAINTY:Readonly<Record<GateDiagnostic['certainty'],string>>={definite:'Biztos hiba',possible:'Lehetséges hiba',unknown:'Nem eldönthető'};
const ORIGIN:Readonly<Record<GateDiagnostic['origin'],string>>={compiler:'fordító','runtime-order':'futási sorrend','runtime-value':'futási érték',environment:'környezet'};
const RANK:Readonly<Record<GateDiagnostic['certainty'],number>>={definite:0,possible:1,unknown:2};
/** ADR-122 (M3): findings of one cause (certainty, origin and code) as one group, the surest first; eleven unresolved
 * imports read as one line, not eleven. */
export function groupFindings(findings:readonly GateDiagnostic[]):GateDiagnostic[][] {
 const groups=new Map<string,GateDiagnostic[]>();
 for(const item of findings){const key=`${item.certainty}|${item.origin}|${item.code}`;const group=groups.get(key);if(group)group.push(item);else groups.set(key,[item]);}
 return [...groups.values()].sort((a,b)=>RANK[a[0]!.certainty]-RANK[b[0]!.certainty]||a[0]!.line-b[0]!.line);
}
const lineButton=(line:number):string=>`<button type="button" class="diagnostic-line" data-goto-line="${line}" aria-label="Ugrás a(z) ${line}. sorra a forrásban">${line}. sor</button>`;
/** What a group of findings has in common, in one sentence: missing project context has one meaning whatever the name. */
const cause=(group:readonly GateDiagnostic[]):string=>group[0]!.origin==='environment'?'Hiányzó projektkontextus: a projekten kívüli modul vagy név típusai itt nem ellenőrizhetők. A sorrend elemzését ez nem érinti.':`${group[0]!.message} (és még ${group.length-1} hasonló)`;
/** The findings grouped by cause; one finding is one row with its line, a group one row with its lines folded. Line
 * numbers are those of the source editor, and each one jumps there. */
export function renderFindingGroups(findings:readonly GateDiagnostic[]):string {
 const row=(group:readonly GateDiagnostic[]):string=>{
  const first=group[0]!,head=`<span class="diagnostic-kind">${esc(CERTAINTY[first.certainty])}</span>`,origin=`<small class="diagnostic-origin">${esc(ORIGIN[first.origin])} · ${esc(first.code)}</small>`;
  if(group.length===1)return `<li class="diagnostic certainty-${first.certainty}" data-diagnostic="${esc(first.code)}">${head}${lineButton(first.line)}<span class="diagnostic-message">${esc(first.message)}</span>${origin}</li>`;
  const lines=group.map(item=>`<li>${lineButton(item.line)}<span class="diagnostic-message">${esc(item.message)}</span></li>`).join('');
  return `<li class="diagnostic diagnostic-group certainty-${first.certainty}" data-diagnostic="${esc(first.code)}" data-diagnostic-count="${group.length}">${head}<span class="diagnostic-count">${group.length} sor</span><div class="diagnostic-message">${esc(cause(group))}${first.origin==='environment'?renderInfo('project-context','Hiányzó projektkontextus'):''}</div>${origin}<details class="diagnostic-lines"><summary>A ${group.length} sor</summary><ol>${lines}</ol></details></li>`;
 };
 return `<ol class="diagnostic-list">${groupFindings(findings).map(row).join('')}</ol>`;
}
/** The first gate's findings for the source they were made from; for another text, a note that they may be out of date. */
export function renderSourceDiagnostics(gate:SourceGate|undefined,stale:boolean):string {
 if(!gate||!gate.diagnostics.length)return '';
 const title=gate.verdict==='blocked'?'A modell nem készült el: a forrás hibás':gate.verdict==='inconclusive'?'A forrás vizsgálata nem dőlt el teljesen':'Megjegyzések a forráshoz';
 return `<section class="source-diagnostics verdict-${gate.verdict}" data-source-diagnostics aria-labelledby="source-diagnostics-title"><div class="diagnostics-head"><h3 id="source-diagnostics-title">${esc(title)}</h3>${renderInfo('findings','Leletek')}</div>${stale?'<p class="inline-hint" data-diagnostics-stale>A forrás azóta változott; a lista a legutóbbi ellenőrzéshez tartozik.</p>':''}${renderFindingGroups(gate.diagnostics)}</section>`;
}
