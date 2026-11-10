/**
 * ADR-124 (H1–H3): the help, from one source. Every explanation the author reads about the workbench lives here once:
 * the short text a setting shows under its control, the ⓘ bubble beside a label, and the help page built from it
 * (`renderHelpPage`, written to public/help/index.html by the build). Nothing else writes these texts, so the bubble,
 * the hint and the page cannot drift apart.
 *
 * The examples are claims about the engine (“swapping rows 3 and 4: accepted when key order does not count”), and
 * tests/help-examples.test.mjs runs each one through the real generator, validator and first gate: a rule version that
 * changes the behaviour turns the help's test red, so the help cannot silently go out of date (the doctest principle).
 *
 * Hidden here: the topics and their order, their anchors, the wording, the examples, and the markup of the bubble and of
 * the page. Callers name a topic and get text or markup.
 */
import {escapeHtml as esc} from './ui-utilities.js';
import {icon} from './icons.js';

/** The settings an example may set: the request's own names (ADR-108), resolved by the policy resolver in the test. */
export type HelpSettings=Readonly<Partial<Record<'inputs'|'keyOrder'|'classFields'|'importEmit'|'portability'|'tsDiagnostics'|'jsCheck'|'objectState'|'unknownPolicy',string>>>;
/** Two rows of the reference swapped, under each setting: accepted or not. `label`: the setting as the author sees it. */
export interface OrderExample {kind:'order';language:'javascript'|'typescript';source:string;swap:readonly [number,number];outcomes:readonly {settings:HelpSettings;label:string;accepted:boolean}[];}
/** The source checked under each setting: the first gate's verdict, whether it lets the source on, and the finding it names. */
export interface CheckExample {kind:'check';language:'javascript'|'typescript';source:string;outcomes:readonly {settings:HelpSettings;label:string;verdict:'passed'|'inconclusive'|'blocked';admitted:boolean;finding?:string}[];}
export type HelpExample=OrderExample|CheckExample;
export interface HelpTopic {id:string;title:string;
 /** One or two sentences: the setting's hint, the bubble's text, the page's lead. */
 summary:string;
 /** Paragraphs for the page; `code` in backticks. */
 body:readonly string[];
 example?:HelpExample;}
interface HelpGroup {id:string;title:string;intro:string;topics:readonly HelpTopic[];}

const KEY_ORDER_SOURCE="class Box {\n  constructor() {\n    this.a = 1;\n    this.b = 2;\n  }\n}\nfunction evaluate() {\n  const list = Object['ke' + 'ys'];\n  return list(new Box());\n}";
const UNKNOWN_SOURCE='const count = 5;\nconsole.log(count.length);';

const GROUPS:readonly HelpGroup[]=[
 {id:'lepesek',title:'A három lépés',intro:'A feladatkészítés három lépése; mindegyiknek egy feladata és egy fő művelete van.',topics:[
  {id:'steps',title:'Kód → Elemzés és szabályok → Próba és kiadás',summary:'A Kód lépésben a referenciaforrás készül el és megy át a vizsgálaton; az Elemzés és szabályok lépésben a sorrendi szabályok; a Próba és kiadás lépésben a feladat tanulóként működik, és innen exportálható.',body:[
   'Minden beállítás ott áll, ahol a hatása látszik: a forrás vizsgálatának beállításai a Kód lépésben, az elemzési környezet és a profil az Elemzés és szabályok lépésben, a tanulónak szóló cím, leírás és szint a Próba és kiadás lépésben.',
   'Egy lépés alján mindig ugyanaz a sáv áll: balra a visszalépés, középen az állapot egy mondatban, jobbra a fő művelet.',
   'A Pages-en futó változat Local Demo / Preview Validation: helyi demonstráció, nem hitelesített vizsgaeredmény.']}]},
 {id:'vizsgalat',title:'Vizsgálati beállítások (Kód lépés)',intro:'Mit keres a Forrás vizsgálata és a Modell készítése, mielőtt a forrásból sorok és szabályok lesznek.',topics:[
  {id:'tsDiagnostics',title:'TypeScript-diagnosztika',summary:'A szigorú mód a strict fordítóbeállításokkal ellenőriz; a hibái biztos fordítási hibák, és megállítják a modellkészítést.',body:[
   'Alap módban a fordító alapbeállításai érvényesek. A szigorú mód például a típus nélküli paramétert (`TS7006`) is hibának veszi.'],
   example:{kind:'check',language:'typescript',source:'function len(s) {\n  return s.length;\n}',outcomes:[
    {settings:{tsDiagnostics:'baseline'},label:'Alap',verdict:'passed',admitted:true},
    {settings:{tsDiagnostics:'strict'},label:'Szigorú',verdict:'blocked',admitted:false,finding:'TS7006'}]}},
  {id:'jsCheck',title:'JavaScript típusellenőrzés',summary:'Bekapcsolva a TypeScript fordító checkJs módban is átnézi a forrást. Amit csak ez talál, lehetséges hiba: figyelmeztet, vagy a „Nem eldönthető eredmények” beállítás szerint megállít.',body:[
   'JavaScriptben a típus csak következtetett, ezért a checkJs lelete nem biztos hiba: a program futhat helyesen.'],
   example:{kind:'check',language:'javascript',source:UNKNOWN_SOURCE,outcomes:[
    {settings:{jsCheck:'off'},label:'Ki',verdict:'passed',admitted:true},
    {settings:{jsCheck:'on'},label:'Be',verdict:'inconclusive',admitted:true,finding:'TS2339'}]}},
  {id:'objectState',title:'Helyi objektumállapot',summary:'Biztos TypeError, amelyet egy helyi változó deklarált értéke okoz: tagelérés null vagy undefined értéken, vagy egy nem függvény meghívása.',body:[
   'Csak azt jelzi, ami a deklarált értékből biztosan következik; a paraméterek és a kívülről jövő értékek nem tartoznak ide.'],
   example:{kind:'check',language:'javascript',source:'const user = null;\nconsole.log(user.name);',outcomes:[
    {settings:{objectState:'off'},label:'Ki',verdict:'passed',admitted:true},
    {settings:{objectState:'local'},label:'Ellenőrzi',verdict:'blocked',admitted:false,finding:'OS001'}]}},
  {id:'unknownPolicy',title:'Nem eldönthető eredmények',summary:'Ha egy ellenőrzés nem tud dönteni (lehetséges hiba, kimerült keret, hiányzó könyvtár), az nem „hibás program”. Figyelmeztetésnél továbbléphetsz, tiltásnál nem. A biztos hiba mindig megállít.',body:[
   'Ugyanez a beállítás dönt a Próba lépés kapujánál is: tiltásnál a nem teljesen igazolt modellel a Próba nem nyílik meg.'],
   example:{kind:'check',language:'javascript',source:UNKNOWN_SOURCE,outcomes:[
    {settings:{jsCheck:'on',unknownPolicy:'warn'},label:'Figyelmeztet (checkJs be)',verdict:'inconclusive',admitted:true,finding:'TS2339'},
    {settings:{jsCheck:'on',unknownPolicy:'block'},label:'Tilt (checkJs be)',verdict:'inconclusive',admitted:false,finding:'TS2339'}]}}]},
 {id:'elemzes',title:'Elemzési beállítások (Elemzés és szabályok lépés)',intro:'Milyen környezetben fut a referencia: ettől függ, mely sorok cserélhetők fel. Módosítás után a modellt újra kell készíteni; a kézi szabálydöntések ekkor elvesznek, ezt a felület előre jelzi.',topics:[
  {id:'inputs',title:'Bemenetek',summary:'Érvényes adatnál a bemenetek olvasása és a beépített, nem módosító műveletek (például join, Math.max) egymáshoz képest szabadok; a hibás vagy trükkös bemenetet ekkor nem vizsgáljuk. Ha a program maga módosíthatja a tulajdonságolvasást (Proxy, prototípus), az elemzés szigorú marad.',body:[
   'Szigorú bemenetnél egy tulajdonság olvasása is futtathat kódot (getter, Proxy), ezért két olvasás sorrendje számít.'],
   example:{kind:'order',language:'javascript',source:'function measure(grid) {\n  const rows = grid.length;\n  const cols = grid[0].length;\n  return rows * cols;\n}',swap:[2,3],outcomes:[
    {settings:{inputs:'any'},label:'Szigorú',accepted:false},{settings:{inputs:'valid'},label:'Érvényes egyszerű adat',accepted:true}]}},
  {id:'keyOrder',title:'Objektumkulcsok sorrendje',summary:'Object.keys, JSON.stringify, for…in. Nem számít esetén a kulcsokat létrehozó sorok egymáshoz képest cserélhetők, mint a toEqual vagy deepStrictEqual összehasonlításnál. Ne válaszd, ha a program a kulcsok sorrendjéből számol.',body:[
   'Ha a program felsorolja a kulcsokat, a létrehozásuk sorrendje a kimenet része. A „Nem számít” a szerző döntése, hogy ez a feladatban nem lényeges.'],
   example:{kind:'order',language:'javascript',source:KEY_ORDER_SOURCE,swap:[3,4],outcomes:[
    {settings:{keyOrder:'observed'},label:'Számít',accepted:false},{settings:{keyOrder:'ignored'},label:'Nem számít',accepted:true}]}},
  {id:'classFields',title:'Osztálymezők létrehozása',summary:'A régi értékadásos módban egy mező létrehozása lefuttatja az ős azonos nevű setterét, ezért az ilyen mezők sorrendje kötött. Ne válaszd, ha a kódot régebbi célra fordítják.',body:[
   'A „Csak szabványos” a natív osztálymezőket (useDefineForClassFields: true) feltételezi: a mező definíció, nem értékadás, az ős settere nem fut le.'],
   example:{kind:'order',language:'javascript',source:"class B {\n  set f5(value) {\n    record('set', this.g);\n  }\n}\nclass A extends B {\n  f5 = 6;\n  g = 7;\n}\nfunction evaluate() {\n  const a = new A();\n  return [a.g, a.f5];\n}",swap:[7,8],outcomes:[
    {settings:{classFields:'either'},label:'Mindkét mód',accepted:false},{settings:{classFields:'define'},label:'Csak szabványos',accepted:true}]}},
  {id:'importEmit',title:'Importok kibocsátása (TypeScript)',summary:'A buildbeállításod szerint: verbatimModuleSyntax / preserveValueImports esetén verbatim. Az import-sorok szabadsága ettől függ.',body:[
   'Verbatim módban minden import betölti a modulját, ezért az importok sorrendje futási sorrend. Ha a csak típusként használt import kimarad a kimenetből, az a sor szabad.'],
   example:{kind:'order',language:'typescript',source:"import { make } from './make';\nimport { Shape } from './shape';\nconst shape: Shape = make();",swap:[1,2],outcomes:[
    {settings:{importEmit:'verbatim'},label:'verbatim',accepted:false},{settings:{importEmit:'elide-unused'},label:'elide-unused',accepted:true}]}},
  {id:'portability',title:'Hordozhatóság',summary:'A konzervatív profil a környezeti beállításokat a legszigorúbb értékükre zárja: a megoldásnak minden környezetben helyes sorrendet kell adnia. A választásaid megmaradnak, és a profil kikapcsolásakor visszaállnak.',body:[
   'A zárolt beállítás mellett a „Miért?” megmondja az okát és a feloldás módját.'],
   example:{kind:'order',language:'javascript',source:KEY_ORDER_SOURCE,swap:[3,4],outcomes:[
    {settings:{keyOrder:'ignored'},label:'Beállított környezet, kulcssorrend: Nem számít',accepted:true},{settings:{keyOrder:'ignored',portability:'conservative'},label:'Konzervatív, kulcssorrend: Nem számít',accepted:false}]}}]},
 {id:'allapot',title:'A feladat állapota',intro:'Az Elemzés és szabályok lépés tetején három kérdés, mindegyikre Igen, Részben vagy Nem, egy mondattal; a következő lépés a lépés alján.',topics:[
  {id:'fillable',title:'Kitölthető?',summary:'A referencia elfogadott-e, eldőlt-e a forrás vizsgálata, és nem hosszabb-e a feladat 100 sornál.',body:[
   'Részben, ha a vizsgálat nem dőlt el (például hiányzó projektkontextus miatt), vagy ha a feladat 100 sornál hosszabb: tanulóként ennyi sort rendezni nem gyakorlás, érdemes egy osztályt vagy függvényt külön feladatba emelni.']},
  {id:'checkable',title:'Ellenőrizhető?',summary:'Minden tanulói sorrendre eldönthető-e a válasz a kereten belül: ekkor a feladat publikálható.',body:[
   'Ha egy kapupróba nem dől el, a tanuló „Nem eldönthető” eredményt kaphat, és a feladat nem publikálható.']},
  {id:'fair',title:'Igazságos?',summary:'Nem utasít-e el helyes sorrendet. Elemzéssel igazolt modellnél nem; konzervatív modellnél néhány óvatos szabály miatt igen, és a Megmutatom gomb megnyitja ezeket.',body:[
   'Az óvatos (konzervatív) szabály ott áll, ahol az elemzés nem tud dönteni; a szerző a Szabályok típus szerint listában fajtánként feloldhatja.']}]},
 {id:'minosites',title:'Minősítés',intro:'A kész modell besorolása; a Minősítés részletei között az állítások és alapjuk.',topics:[
  {id:'qualification',title:'Elemzéssel igazolt, konzervatív, szerzői módosítás, nem igazolt',summary:'Elemzéssel igazolt: minden szabály a forrás elemzéséből következik. Konzervatív: van óvatos szabály. Szerzői módosítás: a szerző szűkített. Nem igazolt: a szabályok lazítanak, vagy nincs bizonyíték.',body:[
   'A szerzői szűkítés (szabály, rögzített sor, profil) nem fogad el semmit, amit a generált modell elutasít; ezért szerzői módosítás, nem „nem igazolt”.',
   'Ha egy kézi modell lazít, a lelet megnevezi a generált kötést, amely nem következik a szabályaiból (például „#1 → #3”).',
   'Publikálható az a modell, amely a saját referenciáját elfogadja, minden kapupróbája eldől, és nincs nyelvi hibája.']}]},
 {id:'leletek',title:'Leletek',intro:'A Forrás vizsgálata és a minősítés leletei, okonként csoportosítva; a sorszám mindig a forrásszerkesztő sora, és kattintásra oda ugrik.',topics:[
  {id:'findings',title:'Biztos hiba, lehetséges hiba, nem eldönthető',summary:'A biztos hiba mindig megállít. A lehetséges hiba és a nem eldönthető lelet a „Nem eldönthető eredmények” beállítás szerint figyelmeztet vagy megállít.',body:[
   'Az azonos okú leletek egy sort adnak („11 sor”), a sorok lenyitva érhetők el.']},
  {id:'project-context',title:'Hiányzó projektkontextus (például TS2307)',summary:'A fájl a projekten kívüli modulra vagy névre hivatkozik, ezért a típusai itt nem ellenőrizhetők. A sorrend elemzését ez nem érinti.',body:[
   'Tipikus egy nagyobb projektből kiemelt TypeScript-fájlnál: minden import feloldatlan. Teendő nincs; ha a típushelyesség fontos, a projektben ellenőrizd.']}]},
 {id:'szabalyok',title:'Szabályok és okkódok',intro:'Minden sorrendi szabálynak van oka. Az ok kategóriája (bizonyított, konzervatív, szerkezeti, szerzői) dönti el, hogyan szerkeszthető.',topics:[
  {id:'rule-kinds',title:'Szabályok típus szerint',summary:'Egy szabálytípus minden szabálya egy lépésben feloldható, ha a feladatban nem számít; a feloldás indoklással kerül a modellbe.',body:[
   'Egyenként a sor láncszem gombjával is lehet szabályt felvenni, törölni vagy megjegyzést írni. A szerkezeti szabály nem távolítható el.']}]},
 {id:'nehez',title:'Nehéz helyzetek',intro:'Gyakori esetek, amelyekben a felület válasza elsőre meglepő lehet.',topics:[
  {id:'long-task',title:'Hosszú feladat',summary:'100 sor fölött a felület figyelmeztet: tanulóként ennyi sort rendezni nem gyakorlás. Emelj ki egy osztályt vagy függvényt.',body:[
   'A küszöb pedagógiai döntés (2026-11-09).']},
  {id:'rebuild',title:'Beállításváltozás és kézi szabályok',summary:'Az elemzési beállítás módosítása után a modellt újra kell készíteni. Az újrakészítés a forrásból indul, ezért a kézi szabálydöntések elvesznek; az elavultsági sáv ezt előre megmondja.',body:[
   'Utána a lépés kiírja, hány nem szerkezeti szabály volt és hány lett.']},
  {id:'local-demo',title:'Local Demo és a szerver',summary:'A Pages-változat Local Demo / Preview Validation: a böngészőben fut, nem hitelesített vizsgaeredmény. A beépített feladatok szabályait éles használatban a szerver kezeli (Trusted Server Validation).',body:[
   'A tanulói megoldást a rendszer sosem futtatja; a döntés a modell szabályaiból születik.']}]}
];

const TOPICS:ReadonlyMap<string,HelpTopic>=new Map(GROUPS.flatMap(group=>group.topics.map(topic=>[topic.id,topic] as const)));
/** Every topic of the help, in page order (the examples' test reads them from here). */
export const helpTopics=():readonly HelpTopic[]=>[...TOPICS.values()];
/** A topic's one or two sentences ('' for an unknown topic). */
export const helpSummary=(id:string):string=>TOPICS.get(id)?.summary??'';
/** The page's address for a topic, relative to the workbench page. */
export const helpHref=(id:string):string=>`./help/index.html#${encodeURIComponent(id)}`;

const inline=(text:string):string=>esc(text).replace(/`([^`]+)`/g,'<code>$1</code>');
const rowsOf=(example:HelpExample):string=>example.kind==='order'?`A(z) ${example.swap[0]}. és ${example.swap[1]}. sor cseréje`:'A forrás vizsgálata';
const VERDICT:Readonly<Record<CheckExample['outcomes'][number]['verdict'],string>>={passed:'átment',inconclusive:'nem dőlt el',blocked:'biztos hiba'};
/** An example as the author reads it: the numbered source, then one line per setting with what happens. */
export function renderExample(example:HelpExample):string {
 const code=example.source.split('\n').map((line,index)=>`<span class="help-line"><span class="help-ln" aria-hidden="true">${index+1}</span>${esc(line)||' '}</span>`).join('');
 const outcomes=example.kind==='order'
  ?example.outcomes.map(outcome=>`<li><b>${esc(outcome.label)}:</b> ${outcome.accepted?'elfogadva':'elutasítva'}</li>`)
  :example.outcomes.map(outcome=>`<li><b>${esc(outcome.label)}:</b> ${VERDICT[outcome.verdict]}${outcome.finding?` (${esc(outcome.finding)})`:''}, ${outcome.admitted?'továbbléphetsz':'nem léphetsz tovább'}</li>`);
 return `<figure class="help-example"><pre class="help-code" tabindex="0" aria-label="Kódpélda"><code>${code}</code></pre><figcaption>${rowsOf(example)}:<ul>${outcomes.join('')}</ul></figcaption></figure>`;
}

/** ADR-124 (H3): the ⓘ beside a label. A toggletip (a menu, so Escape and an outside click close it): the topic's
 * sentences, its example, and the help page at the topic in a new tab. `withSummary: false` where the same sentences
 * already stand under the control. */
export function renderInfo(id:string,name:string,{withSummary=true}:{withSummary?:boolean}={}):string {
 const topic=TOPICS.get(id);if(!topic)return '';
 return `<details class="menu toggletip" data-help="${esc(id)}"><summary class="info-button" aria-label="Súgó: ${esc(name)}" title="Súgó: ${esc(name)}">${icon('help')}</summary><div class="menu-panel toggletip-panel" role="note">${withSummary?`<p>${inline(topic.summary)}</p>`:''}${topic.example?renderExample(topic.example):''}<a class="help-link" href="${helpHref(id)}" target="_blank" rel="noopener">Részletek a súgóban${icon('external')}<span class="sr-only"> (új lapon)</span></a></div></details>`;
}

/** A reason code of the analysis, as the registry gives it (the build passes the registry in). */
export interface HelpReasonCode {code:string;category:string;meaning:string;}
const CATEGORY:Readonly<Record<string,string>>={proven:'bizonyított',conservative:'konzervatív',structural:'szerkezeti',author:'szerzői'};
/** ADR-124 (H2): the whole help page, from the topics and the reason-code registry: a contents list with search, one
 * section per group, one anchored section per topic. Static HTML; the search is a script of its own (help-search). */
export function renderHelpPage(codes:readonly HelpReasonCode[]):string {
 const toc=GROUPS.map(group=>`<li><a href="#${group.id}">${esc(group.title)}</a><ol>${group.topics.map(topic=>`<li data-help-entry="${esc(topic.id)}"><a href="#${esc(topic.id)}">${esc(topic.title)}</a></li>`).join('')}</ol></li>`).join('');
 const table=`<div class="help-table" tabindex="0" role="region" aria-label="Okkódok táblázata"><table><thead><tr><th scope="col">Okkód</th><th scope="col">Kategória</th><th scope="col">Jelentése</th></tr></thead><tbody>${[...codes].sort((a,b)=>a.code.localeCompare(b.code)).map(code=>`<tr><th scope="row"><code>${esc(code.code)}</code></th><td>${esc(CATEGORY[code.category]??code.category)}</td><td>${inline(code.meaning)}</td></tr>`).join('')}</tbody></table></div>`;
 const topic=(entry:HelpTopic):string=>`<section class="help-topic" id="${esc(entry.id)}" data-help-topic><h3><a href="#${esc(entry.id)}">${esc(entry.title)}</a></h3><p class="help-summary">${inline(entry.summary)}</p>${entry.body.map(paragraph=>`<p>${inline(paragraph)}</p>`).join('')}${entry.example?renderExample(entry.example):''}${entry.id==='rule-kinds'?table:''}</section>`;
 const sections=GROUPS.map(group=>`<section class="help-group" id="${group.id}" data-help-group><h2>${esc(group.title)}</h2><p>${inline(group.intro)}</p>${group.topics.map(topic).join('')}</section>`).join('');
 return `<!doctype html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><script src="../app/theme-boot.js"></script><title>Súgó · CodeLineSorter</title><link rel="stylesheet" href="../style.css"></head>
<body class="help-page"><a class="skip-link" href="#help-main">Ugrás a tartalomra</a>
<header class="help-header"><a class="brand" href="../index.html"><span class="brand-mark" aria-hidden="true"></span><strong>CodeLine<span class="brand-tail">Sorter</span></strong></a><span class="help-title">Súgó</span></header>
<div class="help-layout"><nav class="help-toc" aria-label="A súgó tartalma"><label class="help-search">Keresés a súgóban<input type="search" data-help-search autocomplete="off" placeholder="például kulcssorrend"></label><p class="help-count" data-help-count role="status" aria-live="polite"></p><ol>${toc}</ol></nav>
<main id="help-main" class="help-main" tabindex="-1"><h1>Súgó</h1><p class="help-lead">A beállítások, a minősítés, a leletek és a nehéz helyzetek. Minden példa egyben teszt: a valódi elemzővel és kiértékelővel fut, ezért a súgó nem avulhat el.</p>${sections}</main></div>
<script type="module" src="../app/help-search.js"></script></body></html>
`;
}
