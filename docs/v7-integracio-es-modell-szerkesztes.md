# ngDynamic CodeLine v7: teljes üzleti logika, modell-visszaalkalmazás és beszúró drag & drop

## 0. Cél és invariánsok

A v7 megőrzi a v6 JS/TS-forráskódot **csak megjelenítéskor** behúzó modulját, és az eddig kialakított validációt. Két új, felhasználó által megfogalmazott funkciót vezet be:

1. A saját kódhoz elkészült szerzői `CodeLine` JSON a modellnézetben módosítható, az `Alkalmazás` szerveroldali ellenőrzése után a módosított modell az **aktuális feladat** új referencia-szabálykészlete lesz.
2. A drag & drop **beszúrás** a sortartalom felcserélése helyett. A pontos célhatár a sor közepe felett/alatt vált. Az eredményes mozgatás nem változtatja a tokenek multihalmazát és a rögzített sorok indexét.

Globális invariánsok: (I1) minden referenciaazonosító egyedi, (I2) sem drag/drop, sem formatter nem írhatja át a tokentartalmat, (I3) a `fixed` sor nem mozgatható, (I4) azonos normalizált tartalmú sorok felcserélt technikai azonosítói nem módosíthatják a kiértékelés eredményét, (I5) érvénytelen szerzői modell soha nem válhat aktívvá, (I6) a szerver nem hajthatja végre a tanuló kódját.

## 1. Adatmodell és jelentés

```typescript
interface CodeLine {
  id: number;                // egyedi szerzői token-ID, nem a helyesség fogalma
  code: string;              // pontosan egy fizikai kódsor
  dependencies: number[];    // MINDEN kötelező előd, nem feltétlen közvetlen
  fixed: boolean;           // a sor indexe a referenciában rögzített
  functionBlock: number;    // 0: top-level, különben a tulajdonos függvény
}
interface StructuredCodeLine extends CodeLine {
  scopeId: string | null;    // a közvetlen lexikai blokk (for/if/function stb.)
  normalization?: 'indent' | 'exact';
}
interface CodeBlock {
  id: string;
  kind: 'function'|'block';
  functionBlock?: number;    // csak function blokk esetében
  parentScopeId: string|null;
  openLineId: number;
  closeLineId: number;
}
```

`dependencies: [2,3]` azt jelenti, hogy a sort 2-es ÉS 3-as után kell elhelyezni. Egyetlen előd nem elég a két független deklarációból számoló sornál. `scopeId` nem ugyanaz, mint `functionBlock`: az egyik közvetlen lexikai konténer, a másik a birtokos függvényazonosság. A `fixed` itt abszolút eredeti helyet jelent, nem általános szemantikai tiltást.

A `normalization: 'indent'` kizárólag a vezető whitespace-t nem veszi figyelembe. Többsoros template stringekben a whitespace a program jelentését módosíthatja, ilyenkor csak kifejezetten biztonságos tokenizálás / `'exact'` használható. Az egyszerű sorazonosság nem bizonyítja a teljes program szemantikai egyenértékűségét.

## 2. A szerzői modell visszaalkalmazása – tranzakciós lépések

1. `Feladatkészítő` szerzői forrás → `POST /api/author/format` (JS: js-beautify, ha elérhető; TS: TS Language Service) → `POST /api/author/compile` → hitelesítendő referencia CodeLine-modell és rövid életű `draftId`.
2. A böngésző saját feladatként hozzáadja az új típust, visszavált a rendezésre.
3. Az `Adatmodell` tab csak **szerzői előnézetekhez** elérhető. A JSON input szövegként szerkeszthető és másolható. Nincs korlátlan kliensoldali megbízhatóság: a referencia nem értékelődik a böngészőben.
4. `Modell alkalmazása → Rendezés`: JSON parse → `POST /api/author/compile` body `{ model }`, legfeljebb 1 MiB kérésmérettel → szerver `compileCodeLineExercise()` és a szabálygráf + scope-hierarchia konzisztenciavizsgálata → a referencia eredeti sorrendjének önellenőrzése (`validateSubmission`).
5. **Csak siker után** a kliens új `draftId`-t állít aktívnak. Régi feladat tartalma, UI és editor megmarad, ha a szerver hibát jelez. A hibát a JSON-szerkesztőn jeleníti meg.
6. Ha a módosított modell `lines` listájában `id`, `code`, `fixed`, `normalization` soronként azonos, a tanuló aktuális `pool`, `answer`, `custom` állapota megmarad, a régi kiértékelés eldobódik. Így pl. egy `dependencies`-módosítás hatása **ugyanarra a rendezésre** ellenőrizhető. Ha a sorhalmaz vagy a rögzített pozíciók megváltoznak, új kitöltés indul.
7. A `POST /api/author/preview` az aktuális **szerveroldalon tárolt** modellt használja a beküldött `lines[]` ellenőrzésére, soha nem a böngészőből elküldött referenciát.

Tartalmi példa: `const a`, `const b` közül `b.dependencies=[functionOpen]`; a `return.dependencies=[a,b]`. A `b` most már `a` előtt is érvényes lehet. A `functionOpen` és a blokkhatárok ettől továbbra is érvényesek. A v7 regressziós teszt ugyanarra a megoldássorrendre az eredeti modellen `rejected`, a szerkesztett modellen `accepted` státuszt ellenőriz.

**Sematikus korlát:** az automatikus JS/TS modellgenerátor konzervatív; nem bizonyítja automatikusan a sorok függetlenségét. A szerző által lazított modellt publikálás előtt szakmailag meg kell vizsgálni.

## 3. Beszúró algoritmus – az editor valós sorhelyei

Legyen `A = [a_0, …, a_(N-1)]`, ahol `a_i` token-ID vagy `null`, és `F_i` azt jelzi, hogy a hely kötött. A `fixed` helyeket kihagyva kapjuk a mozgatható helyek sorát:

```
S = [ i | 0 ≤ i < N, F_i = false ]
V = A[S]                   // movable-slot positions including null
k = |{i ∈ S : i < boundary}|
```

A `boundary` egy **fizikai sorhatár** a `0..N` intervallumban. A kurzor által célzott `.code-row` felső fele `boundary=rowIndex`, az alsó fele `boundary=rowIndex+1`. Ebből nincs olyan interakció, amely egy sor *helyére*, tartalmát felülírva ejtene.

**Ha forráslistából érkezik elem:** keressünk a `V` tömbben a `k` határhoz legközelebbi szabad (`null`) helyet. Ha ez jobbra van, a köztes elemek egy pozícióval jobbra, ha balra, egy pozícióval balra tolódnak; az új elem közvetlenül a kívánt szomszédságba kerül. `fixed` sor a mozgatható helyek listájában nem szerepel, így soha nem csúszik el.

**Ha megoldáslistából érkezik elem:** előbb kiürítjük a forráspozíciót, majd ugyanazzal a beszúrási algoritmussal betesszük az új határra. Ez garantál legalább egy szabad mozgatható helyet. Az átrendezett szakasz *eltolódik*, a célhelyen lévő elem nem kerül vissza a húzott sor eredeti pozíciójára. Ha a lépés hibás vagy lehetetlen, az eredeti állapot visszaáll.

**UI-vizualizáció:** `public/app/drag-insert.js` kizárólag a kurzor és a DOM feletti viselkedést kezeli. A `dragover` során vizuális `insert-caret` jelenik meg, a határ feletti sor felfelé, az alatta lévő és következő sorok lefelé csúsznak; az aktuális adatmodellt még nem módosítja. A `drop` az egyetlen commit. A panel szélén a dragover automatikusan scrolloz, és a renderelő külön eltárolja/visszaállítja a megoldás és forráslista scrollTop/scrollLeft értékeit.

**Bonyolultság:** a beszúrás a mozgatható pozíciók számától függően `O(N)` idő és `O(N)` ideiglenes hely (a fixed-slot szűrés/újraépítés miatt). A feladat mérete 500 sorra korlátozott. A dragover előnézet a látható DOM-sorokat vizsgálja; nincs minden egérmozdulatra validátorfuttatás.

## 4. Matematikai kiértékelés

Az elfogadáshoz léteznie kell egy bijekciónak `f: (beküldött pozíciók) → (referencia tokenelemek)` úgy, hogy:

- `normalize(s_i) === normalize(code(f(i)))` a biztonságos normalizálási móddal;
- az összes `u→v` függőségi élre `position(u) < position(v)`;
- a fix elemek helye megegyezzen a referenciahelyükkel;
- a `scopeId`-ból levezetett blokkverem nyitó/záró viszonyai teljesüljenek;
- a több lehetséges `profiles` közül legalább egy teljesülhessen.

A keresés korlátos, MRV-heurisztikával gyorsított visszalépéses algoritmus. Erőforrás-limitnél `indeterminate`, nem `rejected` az eredmény. A szerver nem `eval`, nem `Function`, nem `vm`, nem TypeScript-parser alapján értékeli a TANULÓ kódját; a referencia publikus programkódja csak az előkészítő fázisban kerül parserbe. Ezt nem szabad összetéveszteni az algoritmusok általános szemantikai ekvivalenciájának bizonyításával.

## 5. Formatter és formai invariánsok

A JS Beautify az eredeti `ngDynamic` 5 szóközös beállítását és `_____code_line_end_;` jelölőjét megőrzi, **de csak tanácsadó formázási rétegként**. Nem jogosult tokenazonosítót vagy sorhatárt változtatni. Ha a részleges/hibás kódot átírná, az 5-space lexikai scanner végzi a megjelenítéshez az új indentációt. TypeScript részleges programot ugyanez a toleráns indenter kezel, míg a TELJES TS referencia forrását TypeScript Language Service formázza. A TS modellezés nem jelenti azt, hogy TS-szintaxist biztonságosan JS-re lehetne transzpilálni a JS Beautify kedvéért.

Invariáns: minden `indent` módban megjelenített kódsorra `trimStart(displayed) === trimStart(referenceCode)`; `exact` módban minden bájt változatlan. A tényleges validátor kizárólag a szervernek átadott (nem átformázott) kódsorokat használja.

## 6. Ousterhout — mély modulok, információrejtés

| Modul | Felszíni szerződés | Rejtett komplexitás |
|---|---|---|
| `public/app/attempt.js` | `insertFromPool`, `moveInAnswer`, `applyText`, `formattedAnswer` | mozgatható pozíciók, rögzített sorok, üres helyek, stabil ID-k |
| `public/app/drag-insert.js` | `createInsertionDrag({root,onInsert,onReturn})` | kurzor felezése, beszúrásmarker, vizuális eltolás, autoscroll, drag lifecycle |
| `public/formatter.js` | `formatForIDE` | régi JS Beautify, sentinel, hiányos JS/TS lexikai kontextus |
| `public/app/view.js` | `render` | VS Code IDE panelek, egysoros megjelenítés, Prism, inputok, UI |
| `public/app/ui-utilities.js` | `createScrollMemory` | két független scrollpozíció, textarea sorszámozás, vágólap |
| `src/server/catalog.mjs` | `createDraft`, `preview`, `evaluate` | megbízható szerveroldali modellek, tokenek, lejárat, önellenőrzés |
| `src/core/validator.ts` | `validateSubmission` | tartalom szerinti bijekció, DAG, lexikai scope, alternatívák, search limit |

A DOM-réteg nem ismerheti a validátor belső gráfszerkezetét; a validátor nem ismer DOM-ot, CSS-t vagy JS Beautify-t. Az új UI-komponens nem önálló üzleti modell, csak a mozgási szándék tolmácsa. A modellszerkesztő nem kerülhet a hiteles tanulói értékelési csatorna elé.

## 7. Regressziós és kockázati tesztmátrix

- **Node/TS build + unit:** eredeti referenciák, ugyanilyen `}` tokenek, kapcsos zárójel-blokkverem, részleges/hibás JS és TS indentáció, minden kombinált előzmény, alternatív profilok, időkorlát és hamis negatív/pozitív esetek.
- **Beszúrási modul:** üres lista, első/utolsó sorhatár, jobb/bal legközelebbi lyuk, teljes lista átrendezése, nem szomszédos eltolás, fix sorok, sikertelen beszúrás atomisága, 200 determinisztikus műveletből tokeninvariáns.
- **Szerzői modell:** elutasított régi sorrend, `dependencies` szerkesztése után ugyanannak elfogadása; körkörös függőség elutasítása úgy, hogy a korábbi draft tovább működik; új `fixed` pozíciók érvényesítése.
- **Nagyméretű HTTP:** a mellékelt 436 soros TypeScript osztály 64 KiB-nál nagyobb JSON-jának újrakompilálása, értékelése, továbbá a hibás TypeScript parse-visszajelzés.
- **Valódi Chromium DOM:** 100% szélesség, interaktív marker, non-swap drop, Prism háttér, 220 soros megoldás scrollTop megőrzése, fullscreen gomb és JS hibamentes modulbetöltés. A Chromium ténylegesen lefutott offline importmap-módban; a hálózati API-működést a Node HTTP-tesztek végzik. A külön localhost böngészőnavigáció a jelenlegi környezetben rendszerszinten tiltott, így arra nem állítunk sikeres tesztet.

## 8. Ismert további fejlesztési követelmények

Production esetén HTTPS, authentikáció/autorizáció, szerzői modellek publikálás előtti jóváhagyása, tartós adatbázis, több szerverre skálázott draftok, audit napló, szerzői modellek JSON Schema szerinti külső validálása és szemantikai/teszteset-alapú referencia hitelesítése kell. Az automatikus, minden programnyelvre érvényes helyesség-bizonyítás nem része ennek a rendszernek. JSX/TSX, Python és whitespace-érzékeny idegen nyelvek új nyelvspecifikus adaptert igényelnek.
