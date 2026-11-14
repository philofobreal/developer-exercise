# Terv: a munkafelület refaktorálása – headless alkalmazásmag, gyors kirajzolás, portolhatóság (NY-58)

Állapot: **beütemezve, az F0 kész** (2026-11-14, [ADR-151](adr/151-workbench-headless-core-foundations.md)), a felhasználó kérésére. A taskokra bontást és a végrehajtást egy másik ügynök végzi, ebből a dokumentumból. A fázisok elfogadása, valamint a megjelölt döntési pontok a felhasználóéi.

**Illesztés a többi tervhez (2026-11-14):** a 10. szakasz rögzíti, mi változott a javaslathoz képest (azonosítók), hol fed át más tételekkel, mi hiányzott belőle, és hol áll a sorrendben. A fázis indulása előtt azt olvasd el.

**A cél három dolog egyszerre:**
- a frontend **átláthatóbb és modulárisabb** legyen: egy állapottulajdonos, típusos parancsok, egy helyen a mellékhatások;
- **gyorsabb** legyen: mért, kapuval védett időkeretek a fő szálon;
- **később portolható** legyen bármely komponensalapú, reaktív UI-keretrendszerbe vagy könyvtárba. Ehhez nem a keretrendszert kell előre kiválasztani, hanem egy keretrendszer-független alkalmazásmagot és egy kis, rögzített nézetszerződést kell kialakítani.

**Kockázati osztály** ([ai-governance.md](ai-governance.md)):
- **megjelenítés:** `src/workbench`, `public`;
- **dokumentáció és eszközök:** governance-szabályok, architektúra-kapu, mérőeszköz.

A core, a szerzői elemzés, a generátor, a validátor, a modell- és munkamenetformátumok **nem változnak**.

## 0. Ha ügynökként veszed fel ezt a szálat

1. **Olvasd el, ebben a sorrendben:**
   - [AGENTS.md](../AGENTS.md), [architecture.md](architecture.md), [ai-governance.md](ai-governance.md), [design-review.md](design-review.md);
   - [ADR-001](adr/001-typescript-workbench-and-boundaries.md): a P3-as „controller” lépést ez a terv hajtja végre;
   - a munkafelület döntései: [ADR-022](adr/022-stepwise-author-flow.md), [ADR-095](adr/095-tap-to-place-and-drag-insert-migration.md), [ADR-097](adr/097-attempt-and-persistence-migration.md), [ADR-106](adr/106-focus-surface-code-views-and-author-defaults.md), [ADR-118](adr/118-picked-row-action-bar.md), [ADR-120](adr/120-availability-model.md), [ADR-121](adr/121-one-code-editor.md), [ADR-125](adr/125-local-demo-engine-in-a-worker.md), [ADR-127](adr/127-one-progress-indicator.md), [ADR-136](adr/136-background-render-keeps-open-menu.md), [ADR-142](adr/142-fast-deploy-and-local-gate.md);
   - [ui-ux-workflows.md](ui-ux-workflows.md), [szotar.md](szotar.md), [nyitott-tetelek.md](nyitott-tetelek.md);
   - végül ez a fájl.
2. **Ez a terv viselkedésmegőrző refaktorálás.** A felhasználó által látható szöveg, a műveletek jelentése, az elrendezés és a böngészős tesztek elvárásai nem változnak.
   - Ha egy teszt mégis változna, az a hiba jele, nem a teszté. Tesztet csak ADR-ben indokolva, ugyanabban a commitban szabad módosítani, gyengíteni soha (AGENTS.md).
3. **Fázisonként egy ADR készül**, „design it twice” összevetéssel és a [tervezési ellenőrzőlistával](design-review.md). Az ADR a fázis indulásakor a következő szabad számot kapja (2026-11-14-én, az NY-49 javítása után ez a 151); a szövegben „F0 ADR-je” néven szerepel.
4. **Minden commit után `npm run gate` fut.** Fázis végén `npm run gate -- --full`. Push, deploy és új futásidejű függőség csak a felhasználó jóváhagyásával (AGENTS.md és a 6. szakasz).
5. **Ha egy task a tervtől eltérő döntést kíván,** állj meg, és kérdezd meg a felhasználót. Ilyen döntés például: látható változás, új függőség, tesztelvárás módosítása.

## 1. Cél és nem-cél

| Cél | Mérhető kész-feltétel |
| --- | --- |
| Egy állapottulajdonos | Az alkalmazásállapotot csak a store és a parancsai módosítják. A nézet és a selectorok csak olvasható (`Readonly`) típust kapnak; a fordító kikényszeríti. |
| Típusos parancsok | Minden felhasználói műveletnek egy típusos `Intent` felel meg. A `public/ui.js` kikerül a kézzel írt JS-modulok listájáról ([ADR-097](adr/097-attempt-and-persistence-migration.md): a lista csak csökkenhet). |
| Headless mag | A store, a parancsok, a selectorok és a beszúrási gesztusgép nem hivatkozik DOM-ra; gépi kapu ellenőrzi. Böngésző nélküli Node-tesztek fedik őket. |
| Gyorsabb fő szál | A 4. szakasz F4-es időkeretei teljesülnek, és a mérőkapu (T0.2) védi őket. |
| Portolhatóság | A nézetszerződés (snapshot + Intent + markup-szerződés + behavior-életciklus) dokumentált. A böngészős tesztkészlet egy másik nézetadapter ellen is futtatható. |

**Nem cél:**
- keretrendszer vagy UI-könyvtár bevezetése;
- vizuális újratervezés;
- a szövegek átírása;
- a validálási és szerzői motor bármilyen változtatása;
- runtime AI.

## 2. Kiinduló állapot (2026-11-14, ellenőrizve a kódban és mérve)

### 2.1 Állapot és vezérlés

- **Egyetlen, helyben módosított állapotobjektum.**
  - Létrehozása: `public/ui.js:30`, típusa `WorkbenchState` (`src/workbench/contracts.ts:53-61`).
  - Helyben módosított `Map`-eket tartalmaz: `attempts`, `previews`, `learnerRules`.
  - A kísérletet helyben módosítja az `attempt.ts` (`insertFromPool`, `moveInAnswer`, `back`, `applyText`) és a `ui.js` `data-all` ága.
- **A vezérlés két helyen él.**
  - A `ui.js` kb. 45 ágú kattintáskezelő-láncot tartalmaz (`ui.js:100-251`), kb. 65 közvetlen `state.…=` értékadást és 64 kézi `render()` hívást.
  - A `interactions.ts` `installAuthoringFlows` (`:99-137`) szintén módosít állapotot: a tanulói előnézet kapcsolóját és a forrásfájl betöltését.
- **Állapot a DOM-ban is lakik.**
  - `root.dataset`: `surface`, `surfaceReturn`, `native`, `codeView`, `renderedView`, `renderedExercise`, `renderedMode`.
  - Témaállapot a `documentElement`-en, panelszélesség a `localStorage`-ban.
  - A szerkesztők értékét kattintáskor olvassa ki a kód (`ui.js:46`, `:146-148` és társai). A szabályűrlapot is a DOM-ból olvassa (`rule-panel.ts`).
- **Fókusz műveletek után:** 21 helyen `root.querySelector(...).focus()` a `ui.js`-ben. A fókusz célja szelektor, nem jelentés.
- **Versenyhelyzet elleni védelem:** a `captureAuthorRequest`, a `captureEditorRequest` és a `generation` összevetése szétszórva, kézzel, minden aszinkron ágban.
- **Ismétlődő tudás:** a JSON „nem alkalmazott” állapotát két hely számolja: `interactions.ts:110` és `flow.ts:26`. Ez `design` megállapítás.
- **Kirajzolás közbeni környezetolvasás:**
  - `matchMedia` (`view.ts:50`, `:260`);
  - `localStorage` (`code-view.ts:13`, `view.ts:29`).

### 2.2 Kirajzolás

- **A `view.ts` egy `render()`-je** (`:270-279`) a teljes `#app`-ot újraírja: `root.innerHTML = header() + shell`. Ezután:
  1. kitölti a szerkesztőket;
  2. Prismmel kiemel;
  3. megrajzolja a szabályíveket;
  4. lefuttatja a fit-modulokat;
  5. visszaállítja a görgetést és a fókuszt.
- **A beviteli események célzott foltozásai megkerülik a `render()`-t:** `refreshAuthorStatus`, `refreshStepper`, `refreshAvailability` és az `interactions.ts` input-kezelője.
- **Eseménykezelés `root`-ra delegálva.**
  - A sorrend számít: a `installDisabledGuard` capture-fázisú.
  - A `drag-insert` a `composedPath`-ra támaszkodik, mert a korábban futó kezelő újrarajzol, és leválasztja a célelemet (`drag-insert.ts:168`).

### 2.3 Mért fő szálas költség

Mérési körülmények:
- headless Chromium, Pages-build, 1500×1000 viewport, 4 mag, profiler nélkül, két futás;
- valódi eszközön és hálózaton nem mértük;
- a mérőszkriptek nem részei a repónak; a T0.2 hozza létre őket.

| Forgatókönyv | Fő szál | Domináns ok |
| --- | --- | --- |
| Try megnyitása, 486 soros TS-feladat (439+439 sor, kb. 15,6 ezer DOM-csomópont) | 352–424 ms (task 252–301) | style 125–148, layout 36–42, paint 55–66 ms |
| Billentyűs lerakás (Enter) | 280–288 ms (task kb. 218) | teljes újrarajzolás: style 107–115, parseHTML 18–23, Prism 17, `availability` 25 ms |
| Billentyűs célmozgatás (nyíl, Home, End) | 112–176 ms gombonként | `drop-shift` osztály minden sorra a határ után (`drag-insert.ts:41-47`), forced style 44–66 ms |
| Pointeres húzás, dragover | 118–120 ms eseményenként | `getBoundingClientRect` és `getComputedStyle` soronként (`drag-insert.ts:29-39`) |
| Ellenőrzés | 222–254 ms | teljes újrarajzolás. A validátor a workerben csak 53–55 ms. |
| Modell készítése (fő szál) | 104–198 ms | `drawRuleArcs` forced layout (`rule-board.ts:104`), `availability()` soronként (`rule-board.ts:30`, `view.ts:98`) |
| Szerkesztő, egy billentyű a 436 soros forrásban | 40–56 ms | a teljes szöveg újrakiemelése minden inputra |
| Indulás 80 ms-os emulált latenciával | „kész” 3,7 s | a 16 példa sorban töltődik és validálódik (`public/app/pages-api.js:32-40`); 1,65 MB-os workermodul-gráf (`schema-check` 855 KB, acorn 235 KB) |

**Ami nem szűk keresztmetszet:**
- a szkriptek fordítása és kiértékelése (kb. 5 ms);
- a Prism (10–18 ms renderenként);
- a js-beautify, amely egyetlen interakción sem fut;
- a fit-modulok (0,5–8,5 ms).

**A validátor és a motor már workerben fut** ([ADR-125](adr/125-local-demo-engine-in-a-worker.md)). A további gyorsulás tehát nem újabb workerből, hanem a DOM-munka csökkentéséből jön.

## 3. Célarchitektúra

```
 portok (infrastruktúra, cserélhető)
   api: szerver vagy Local Demo worker · format · storage · clock · clipboard · file · environment
        │
 ┌──────▼──────────────── headless alkalmazásmag (nincs DOM) ────────────────────────┐
 │ store: getSnapshot / subscribe / dispatch(intent)                                 │
 │   parancsok: Intent → új snapshot (+ effektek: aszinkron kérés, „a legutóbbi nyer”)│
 │   selectorok: snapshot → nézetmodell (tiszta, snapshotonként memoizált)           │
 │   gesztusgép: beszúrási gesztus (pick → target → place | cancel | return)         │
 │   már ma headless: attempt, persistence, flow, availability, learner-rules, …     │
 └──────┬────────────────────────────────────────────────────────────────────────────┘
        │ nézetszerződés: Snapshot + nézetmodell · Intent-szótár · FocusTarget ·
        │                 SafeHtml · markup-szerződés (id, data-*, aria) · behavior-életciklus
 ┌──────▼──────────────── nézetadapter (ma: vanilla DOM) ────────────────────────────┐
 │ régiós kirajzolás, kulcsolt sorlisták · DOM-esemény → Intent leképezés             │
 │ behaviorök: fit, ívek, húzásgeometria, panelméret, toggletip, szerkesztőszinkron,  │
 │             fókusz- és görgetésfolytonosság — attach(el) → {update, dispose}       │
 └────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 A store

```ts
interface WorkbenchStore {
  /** Csak olvasható; az identitás akkor és csak akkor változik, ha a tartalom változott. */
  getSnapshot(): WorkbenchSnapshot;
  /** A változás oka: `background` az olvasó által nem kezdeményezett frissítés (ADR-136). */
  subscribe(listener: (change: SnapshotChange) => void): () => void;
  /** Egy felhasználói művelet. A kimenet mondja meg, hová kerüljön a fókusz. */
  dispatch(intent: Intent): Promise<IntentOutcome>;
}
interface IntentOutcome { focus?: FocusTarget; }
```

- **Elrejtett tudás:**
  - az állapot alakja és változásának sorrendje;
  - az üzenetek irányítása: a mai `notify` és `commit` arról dönt, hogy egy üzenet melyik felületre tartozik;
  - a szerzői kérések versenyhelyzet-védelme;
  - az atomikus befogadás (`installPreview`, `admitAuthorModel`);
  - a háttérfrissítések (`ensurePolicy`).
- **Snapshot-identitás:** copy-on-write. A módosított ág új objektum, a változatlan ágak közösek maradnak.
  - Az `attempt.ts` műveletei új kísérletet adnak vissza, és a `Map`-ek helyett új `ReadonlyMap` keletkezik.
  - Ez illik az ADR-125 gyenge leképezéses `modelJson`-gyorsítótárához, amely ma is feltételezi, hogy a modellt nem írjuk át helyben.
- **Kis interfész:** három művelet. Az összes parancs egyetlen `dispatch` mögött van, így a nézet nem hív parancsot közvetlenül, és nem kell ismernie a hívási sorrendet.
- **„Design it twice”** (az F0 ADR-je):
  - (a) store + Intent;
  - (b) a mai `state` megtartása, csak a `ui.js` típusosítása;
  - (c) ugyanaz, mint az (a), de eseménybusszal.
  - A (b) nem ad snapshot-identitást, ezért portolhatóságot sem. A (c) időbeli csatolást és nehezen követhető vezérlést vezet be. **Javasolt az (a).**

### 3.2 Az Intent-szótár

- **Egy diszkriminált unió.** Minden mai `data-*` műveletnek (kb. 45 darab) és a szerkesztők, választók, fájlbevitelek eseményeinek egy-egy Intent felel meg.
- **A DOM-olvasás az adapteré:** a szerkesztő szövege, az űrlapértékek és a fájl tartalma az Intent payloadjában érkezik. A parancs soha nem olvas DOM-ot.
- **A `BUSY` lista** (`interactions.ts:80-86`) az Intent típusához kötött metaadat lesz: melyik Intent aszinkron, és mi a neve a folyamatjelzőben.

### 3.3 FocusTarget

- **A fókusz célja jelentés, nem szelektor.** Például:
  - `{kind:'action', action:'theme-cycle'}`;
  - `{kind:'row', list:'answer', lineId}`;
  - `{kind:'editor', editor:'author', selection:'end'}`;
  - `{kind:'heading', region:'step'}`.
- Az adapter dönti el, melyik elem ez. Így a mai 21 szelektoros fókuszhívás egy helyre kerül, és egy másik nézetréteg ugyanazt a szerződést teljesíti.

### 3.4 Selectorok (nézetmodell)

- **Tiszta függvények snapshot → nézetmodell irányban,** `WeakMap`-pel snapshotonként memoizálva.
- **Ma is ilyenek:** `flowSteps`, `staleReason`, `tryAdmission`, `availability`, `taskStatus`, `shownRules`, `rulesAvailable`, `rulesEditable`, `continuityKey`, `formattedAnswer`, `text`, `fixed`.
- **Kiemelendők a `view.ts`-ből** (kb. 80 sor):
  - `slotMarks` és `feedbackOf` (`:62-69`);
  - az értékelés címe (`:132-138`);
  - a pick-bar logikája (`:88-103`);
  - az eszközsor rangsorolása (`:162-167`).
- **Az `availability` renderenként egyszer számolódik** (selector), nem soronként.

### 3.5 Beszúrási gesztusgép

- **Headless állapotgép**, a `drag-insert.ts`-ből kiemelve (kb. 80 sor):
  - állapotok: `idle`, `picked`, `targeting`;
  - események: `pick`, `target(boundary)`, `place`, `cancel`, `return`.
- **A gép birtokolja:**
  - a beszúrás és nem csere szabályt;
  - a fixed slotok kerülését (`adjacentMoveBoundary`, `insertBetweenSlots` az attemptben);
  - **a bejelentések szövegét:** minden adapter ugyanazt mondja a képernyőolvasónak.
- **A DOM-adapter** (kb. 120 sor) végzi:
  - a pointer-, natív húzás-, érintés- és billentyűzetesemények gépi eseménnyé alakítását;
  - a geometriát: középpontok a gesztus kezdetén gyorsítótárazva, bináris kereséssel;
  - az előnézet megjelenítését.
- **A paritás itt bizonyítható:** ugyanaz a gépi eseménysor ugyanazt az Intent-sort adja, inputúttól függetlenül.

### 3.6 Nézetszerződés és kirajzolás

- **SafeHtml.** Márkázott típus; csak az escape-tulajdonos (`ui-utilities` `escapeHtml` és a Prism-burkoló) hozhatja létre. Nyers HTML-t csak SafeHtml-ből szabad beszúrni. Ez lesz minden jövőbeli adapter egyetlen „nyers HTML” kapuja.
- **Markup-szerződés.** Az id-k (`#app`, `#author-editor`, `#model-editor`, `#code-editor`, `#step-title`, `#workbench-main`, `#rule-panel-title`), a `data-*` műveletnevek, a sorok `data-list` / `data-line-id` / `data-index` attribútumai és az ARIA-szerepek egy dokumentált listában.
  - A böngészős tesztek ezekre épülnek, így **a tesztkészlet maga a nézetadapterek elfogadási tesztje**.
- **Régiós kirajzolás a vanilla adapterben.**
  - Régiók: fejléc, könyvtár, forráslépés, szabálylépés (tábla és panel), próbapanel (rendező és értékelés), súgó.
  - Minden régiónak memo-kulcsa van a nézetmodell-szeletből. Csak a megváltozott régió rajzolódik újra.
- **Kulcsolt sorlisták.**
  - A rendező két zónájában és a szabálytáblán a sor-DOM line id szerint újrahasznosul (`insertBefore` mozgatás, `data-index` frissítés).
  - A kiemelt HTML soronként gyorsítótárazott, kulcsa (line id, tartalom, nyelv); a sorok tartalma nem változik.
  - Saját, kb. 100 soros kulcsolt patcher, nem általános DOM-diff. A „design it twice” mindkettőt vesse össze, és rögzítse, miért elég a kulcsolt lista.
- **Behavior-életciklus.**
  - Minden DOM-viselkedés `attach(element, options) → {update?(viewModel), dispose()}` alakú:
    - fit-modulok, szabályívek, panelméret, toggletip, szerkesztőszinkron, menük, felület (teljes képernyő);
    - húzásadapter, fókusz- és görgetésfolytonosság.
  - Ez az alak bármely komponensrendszer „commit utáni hook” és „elemre kötött direktíva” fogalmára egy az egyben leképezhető.
  - `document` és `window` figyelőt csak behavior regisztrálhat, és `dispose`-ban le is veszi.
- **Környezet mint állapot.** A `matchMedia`, a tárolt beállítások és a téma egy `environment` snapshot-szeletbe kerülnek. Ezt egy behavior frissíti; a kirajzolás nem olvas környezetet.

## 4. Fázisok és taskok

A fázisok sorrendje: F0 → F1 → F2 → F3 → F4 → F5 → F6.
- Az F1 a F0 mérőkapuja után bármikor futhat, akár a F2-vel párhuzamosan; az eredménye megmarad a későbbi fázisokban.
- A „méret” a mozgatott vagy új kód nagyságrendje, nem időbecslés.

### F0 – Alapok: döntés, mérés, governance (dokumentáció és eszközök)

| Task | Tartalom | Kész-feltétel |
| --- | --- | --- |
| **T0.1** Az F0 ADR-je | A célarchitektúra (3. szakasz), a „design it twice” összevetés (3.1), az elrejtett tudás modulonként, a fázisok. A [nyitott tételek](nyitott-tetelek.md) NY-58-as sora már megvan; a T0.1 a forrásoszlopába írja az ADR-t. | ADR elfogadva a felhasználó által |
| **T0.2** Mérőkapu | `tests/browser-perf.playwright.py` és `npm run test:browser:perf`. A 2.3-as forgatókönyvek (Try megnyitása, Enter, billentyűs célmozgatás, dragover, ellenőrzés, modell készítése, gépelés, indulás) futnak. Medián legalább 5 futásból, CDP CPU-fojtással (4×) és anélkül. Mérőszámok: leghosszabb fő szálas task, LoAF, eseményidő. Alapszint `tests/fixtures/perf-baseline.json`-ban; frissítése csak `--baseline` kapcsolóval, a meglévő baseline-szabály szerint. A keret kezdetben az alapszint +20%-a (regressziós kapu); fázisonként szigorodik. | A kapu zöld a mai kódon; a `test:browser:all` része; az ADR rögzíti a mérés zajszintjét |
| **T0.3** Governance | Az 6. szakasz szabályainak beírása az [ai-governance.md](ai-governance.md)-be, az [AGENTS.md](../AGENTS.md)-be és a [design-review.md](design-review.md)-be; a gépi szabályok az `scripts/architecture-rules.ts`-be, negatív tesztekkel (`tests/architecture.test.mjs`). A még üres headless-modullista már a szabállyal együtt érkezik. | Negatív tesztek bukást mutatnak; a governance-teszt zöld |
| **T0.4** Markup-szerződés | A böngészős tesztek és a kód által használt id-k, `data-*` műveletek és sorattribútumok jegyzéke (`src/workbench/markup-contract.ts` konstansokként vagy dokumentumként, a „design it twice” dönt). A governance-teszt ellenőrzi, hogy minden kezelt `data-*` művelet a jegyzékben van, és fordítva. | Teszt zöld; eltérés esetén bukik |
| **T0.5** Policy-lista ellenőrzése | A `docs/architecture-policy.json` `legacyJavaScript` listája a `public/app/attempt.js`-t, a `drag-insert.js`-t és a `persistence.js`-t is tartalmazza, holott a forrásuk strict TS ([ADR-095](adr/095-tap-to-place-and-drag-insert-migration.md), [ADR-097](adr/097-attempt-and-persistence-migration.md)). Tisztázandó, hogy elavult bejegyzés-e; ha igen, eltávolítandó. | A lista a valós állapotot mutatja |

### F1 – Gyors teljesítménynyereség, architektúraváltás nélkül (megjelenítés)

| Task | Tartalom | Kész-feltétel |
| --- | --- | --- |
| **T1.1** `availability` egyszer | A szabálytábla és az eszközsor egyetlen, renderenkénti eredményt használ, nem soronként hív (`rule-board.ts:30`, `view.ts:98`). | −16–45 ms renderenként a perf-kapun; `availability.test.mjs` zöld |
| **T1.2** Párhuzamos példatöltés | `public/app/pages-api.js:32-40`: a 16 példa letöltése párhuzamos, az eredménysorrend determinisztikus marad. Alternatíva, amelyet az ADR mérlegel: előre validált katalógus build időben (`scripts/build-pages.mjs`). | Indulás emulált latenciával legalább 30%-kal rövidebb; `pages-build`- és `pages-api`-tesztek zöldek |
| **T1.3** Húzásgeometria | A sorközéppontok a gesztus kezdetén gyorsítótárazódnak, a keresés bináris (`drag-insert.ts:29-39`). Görgetésre és átméretezésre a gyorsítótár érvénytelenné válik. **Szemantikai feltétel:** ugyanarra a pointerpozícióra ugyanaz a határ jön ki, mint ma (a transzformáció-kompenzációt a gyorsítótár eleve kiváltja, mert az előnézet előtti pozíciót rögzíti). | Dragover < 16 ms a perf-kapun; `browser-drag` (44 eset) zöld; egységteszt a határszámításra |
| **T1.4** Egyetlen elemes előnézet | A `drop-shift` osztály N sorra helyett egyetlen távtartó vagy caret-elem jelzi a határt (`drag-insert.ts:41-47`). A vizuális viselkedésnek meg kell egyeznie (ADR-095 animációkompenzáció). Ha nem egyezhet meg, ez **döntési pont**. | Billentyűs célmozgatás < 16 ms; a drag- és layout-suite zöld |
| **T1.5** Layout-olvasások kötegelése | A `drawRuleArcs` előbb minden geometriát kiolvas, aztán ír (`rule-board.ts:104`). A görgetésmemória és a fókusz-visszaállítás sorrendje egy forced layoutra csökken. | A forced layoutok száma renderenként mérve csökken |
| **T1.6** `content-visibility` | `content-visibility:auto` és `contain-intrinsic-size` a rendező- és táblasorokon. Ellenőrizendő: az ívek geometriája, a `scrollIntoView`, az a11y-fa és a layout-kapu. | Try megnyitása és a szabályok kirajzolása mérhetően gyorsabb; a11y- és layout-suite zöld |
| **T1.7** Egy „dirty” tulajdonos | A JSON nem alkalmazott állapotát csak az `author-workspace` (`modelJson`) számolja; az `interactions.ts:110` őt kérdezi. | `design` megállapítás lezárva; tesztek zöldek |

### F2 – Típusos vezérlő és Intent-szótár (megjelenítés; ADR-001 P3 „controller”)

| Task | Tartalom | Kész-feltétel |
| --- | --- | --- |
| **T2.1** `controller.ts` | A `ui.js` parancsai strict TS-be kerülnek: `authorApply`, `toggleLink`, `go`, `importSession`, `notify`, `commit`, `ensurePolicy`, `snapshot`, `openHelpTrial`, `init`, valamint a kattintásláncban élő parancsok (kb. 250 sor). A kirajzolást egy átmeneti `render` port hívja; ez az F3-ban megszűnik. | Viselkedés változatlan, minden suite zöld |
| **T2.2** Intent-szótár | `Intent` diszkriminált unió, `dispatch(intent)`. A kattintási lánc helyett az adapter egy táblázattal képezi le a `data-*` műveletet és a DOM-ból kiolvasott payloadot Intentté. A `BUSY` metaadat az Intenthez kerül. | Minden `data-*` művelet és bemeneti esemény egy Intent; a T0.4 szerződéstesztje zöld |
| **T2.3** A szétszórt vezérlés összevonása | Az `installAuthoringFlows` állapotmódosító részei (előnézet-kapcsoló, forrásfájl betöltése) Intentként a vezérlőbe kerülnek. | Állapotot csak a vezérlő módosít (`grep`-pel és a T0.3 szabályával) |
| **T2.4** FocusTarget | A 21 szelektoros fókuszhívás helyett `IntentOutcome.focus`; az adapter egy helyen oldja fel. | Fókusz- és a11y-suite zöld |
| **T2.5** „A legutóbbi nyer” | A `captureAuthorRequest`, a `captureEditorRequest` és a `generation` összevetés egy vezérlőbeli effektsegédbe kerül, csatornánként (szerzői kérés, szerkesztő, értékelés). | Egységtesztek késleltetett ígéretekkel: elavult válasz nem módosít állapotot |
| **T2.6** Headless vezérlőtesztek | `tests/workbench-controller.test.mjs`: hamis `api`/`format`/`storage` portokkal, böngésző nélkül. Minden Intent típusra legalább egy eset, az aszinkron Intentekre hiba- és versenyhelyzet-eset is. | Minden Intent lefedve (a governance-teszt ellenőrzi, 6. szakasz) |
| **T2.7** `ui.js` kivezetése | A `public/ui.js` csak bootstrap (portok, store, adapter összekötése), vagy generált TS-kimenet lesz; kikerül a `legacyJavaScript` listáról. | `docs/architecture-policy.json` lista csökkent; az architektúra-kapu zöld |

### F3 – Store és csak olvasható snapshot (megjelenítés)

| Task | Tartalom | Kész-feltétel |
| --- | --- | --- |
| **T3.1** `createWorkbenchStore(ports)` | `getSnapshot` / `subscribe` / `dispatch`. A vanilla adapter feliratkozik, a kézi `render()` hívások megszűnnek; a `background` a `SnapshotChange` része (ADR-136). | 0 kézi `render()` hívás a vezérlőben |
| **T3.2** Copy-on-write | Az `attempt.ts` műveletei új kísérletet adnak vissza; a `Map`-ek cserélődnek, nem módosulnak. A `setLearnerData` és társai már így működnek (ADR-123). | A tesztmódban mélyen fagyasztott snapshot (`Object.freeze`) mellett minden teszt zöld |
| **T3.3** Readonly típusok | A selectorok és a nézet `DeepReadonly<WorkbenchSnapshot>`-ot kapnak; a fordító tiltja az írást. | `tsc` zöld; egy negatív típusteszt bizonyítja a tiltást |
| **T3.4** DOM-ban tartott állapot | `surface`, `codeView`, téma, panelszélesség és `environment` (szűk nézet, tárolt beállítások) a snapshotba kerül, a `storage` és `environment` porton át. A `renderedView` és `renderedExercise` jelölőt az adapter a snapshotból származtatja (a húzásvédelem és a Ctrl+Enter továbbra is használja). | Kirajzolás közben nincs `matchMedia`- és `localStorage`-olvasás (T0.3 szabály) |
| **T3.5** Selectorok | A 3.4 szakasz kiemelései; `WeakMap`-memo snapshotonként. Egységtesztek Node-ban. | A `view.ts` csak nézetmodellt kap; selector-tesztek zöldek |

### F4 – Régiós kirajzolás és kulcsolt listák (megjelenítés; a legnagyobb nyereség)

| Task | Tartalom | Kész-feltétel |
| --- | --- | --- |
| **T4.1** Régiók | A `view.ts` (281 sűrű sor, 49 KB) régiókra bomlik, a régiók a rejtett tudás szerint: a fejléc a menüket, a próbapanel a rendezőt és az értékelést. Minden régió nézetmodell-szeletből SafeHtml-t ad, memo-kulccsal. | Csak a változott régió rajzolódik újra (egységteszt a memóra) |
| **T4.2** Kulcsolt sorlisták | Rendező (két zóna) és szabálytábla: sor-DOM line id szerint, mozgatás `insertBefore`-ral; soronkénti kiemelés-gyorsítótár. | Enter, drop és ellenőrzés: leghosszabb task < 50 ms a 486 soros Try-ban (alapszint 218–254 ms) |
| **T4.3** Folytonosság részleges kirajzolásnál | A megtartott csomópont megtartja a fókuszt és a kijelölést; a `continuity` és a görgetésmemória csak a cserélt régióra fut. | Fókusz-, a11y- és workbench-suite zöld |
| **T4.4** Szerkesztő-kiemelés | Csak a megváltozott sorok kiemelése, vagy `requestAnimationFrame`-kötegelés. | Gépelés: billentyűnként < 16 ms feldolgozás a 436 soros forrásban |
| **T4.5** SafeHtml | Márkázott típus; nyers HTML csak SafeHtml-ből (T0.3 gépi szabály). | Architektúra-kapu zöld, negatív teszttel |

**Az F4 célkeretei** (a T0.2 kapuján, 4×-es fojtás nélkül, medián):

| Forgatókönyv | Alapszint | Cél |
| --- | --- | --- |
| Enter / drop / ellenőrzés, 486 sor | 218–254 ms | < 50 ms |
| Billentyűs célmozgatás | 112–176 ms | < 16 ms |
| Dragover | 118–120 ms | < 16 ms |
| Try megnyitása | 252–301 ms task | < 120 ms |
| Modell készítése (fő szál) | 104–198 ms | < 60 ms |

Ha egy cél a mérés szerint nem érhető el, az ADR rögzíti az okát és az elért értéket. A keret nem lazítható csendben.

### F5 – Behaviorök és a gesztusgép (megjelenítés)

| Task | Tartalom | Kész-feltétel |
| --- | --- | --- |
| **T5.1** Behavior-életciklus | `attach(el, options) → {update?, dispose}` a fit-modulokra, a szabályívekre, a panelméretre, a toggletipre, a szerkesztőszinkronra, a menükre (`interactions.ts:48`) és a felületre (`surface.ts:38-39`). | `document` és `window` figyelő csak behaviorben (T0.3); egységteszt a `dispose`-ra |
| **T5.2** Gesztusgép | A 3.5 szakasz szerint; a bejelentések szövege a gépből jön. | Node-tesztek: a pointer-, natív, érintéses és billentyűs eseménysor ugyanazt az Intent-sort adja; `browser-drag` zöld |
| **T5.3** Figyelősorrendi függések | A kulcsolt kirajzolás után a `composedPath`-kerülőút (`drag-insert.ts:168`) és a capture-sorrendi függések felülvizsgálata. A megmaradókat az ADR rögzíti. | Rögzítve vagy megszüntetve |

### F6 – Portolhatóság igazolása (dokumentáció és eszközök; döntési pont)

| Task | Tartalom | Kész-feltétel |
| --- | --- | --- |
| **T6.1** Adapterútmutató | `docs/munkafelulet-adapterek.md`: hogyan teljesíti egy nézetréteg a szerződést. Tartalma: feliratkozás a store-ra (külső store mint állapotforrás), commit utáni hook a behaviorökhöz, elemhivatkozás vagy direktíva, a SafeHtml egyetlen beszúrási pontja, a FocusTarget feloldása, a markup-szerződés. Keretrendszer-független megfogalmazásban. | Dokumentum-kapu zöld |
| **T6.2** Cserélhető belépési pont a tesztekhez | A böngészős suite-ok egy változóval másik belépési oldalt (adaptert) is kiszolgálhatnak, változatlan elvárásokkal. | A vanilla adapter ezen az úton is zöld |
| **T6.3** Második adapter | **Csak a felhasználó döntésére:** melyik keretrendszer, külön ágon, futásidejű függőséggel (6. szakasz, jóváhagyási pont). | Nem része ennek a tervnek |

## 5. Függőségek és párhuzamosság

- **F0 mindennek előfeltétele.** A T0.2 mérőkapu nélkül a teljesítményállítás nem igazolható.
- **F1 és F2 párhuzamos lehet.** A T1.3 és T1.4 húzásgeometriája az F5-ben a DOM-adapterbe költözik, nem vész el.
- **F3 az F2-re épül:** Intent nélkül a store nem tudja átvenni a `render()` hívásokat.
- **F4 az F3-ra épül:** a régiós memóhoz snapshot-identitás kell. Az F4 hozza a legnagyobb teljesítménynyereséget, ezért az F3 után ne halaszd.
- **F5 a T5.1-ig párhuzamos lehet az F4-gyel.** A T5.2 az F4 kulcsolt listái után egyszerűbb.

## 6. Az AI governance-be rögzítendő szabályok (T0.3)

Minden szabálynál megadjuk, hogy gépi vagy review-kontroll, és hová kerül.

| # | Szabály | Kikényszerítés | Hova |
| --- | --- | --- | --- |
| K1 | **Headless határ:** a headless modulok listáján lévő fájlok (store, vezérlő, selectorok, gesztusgép, és a már ma headless `attempt`, `persistence`, `flow`, `availability`, `learner-rules`, `author-session`, `contracts`) nem hivatkozhatnak `document`, `window`, `Element`, `HTMLElement`, `localStorage`, `sessionStorage`, `matchMedia`, `getComputedStyle`, `requestAnimationFrame` globálisra, és nem importálhatnak DOM-adaptert. | gépi: `presentation-headless` szabály az `architecture-rules.ts`-ben, a `core-platform` mintájára; negatív teszt | architecture-rules, ai-governance „Governance-elemek” |
| K2 | **Egy állapotíró:** a snapshotot csak a store és a vezérlő parancsai hozzák létre. A nézet és a selectorok `DeepReadonly` típust kapnak. | gépi: a TypeScript fordító; negatív típusteszt. Review: nincs párhuzamos, kézzel szinkronban tartott állapot | AGENTS.md (Ousterhout-szakasz), design-review „Időbeli csatolás” |
| K3 | **DOM-írás csak az adapterben:** `innerHTML`, `outerHTML` és `insertAdjacentHTML` csak a nézetadapter felsorolt moduljaiban, és csak SafeHtml értékkel. | gépi: szabály a modullistára; a SafeHtml-t csak az escape-tulajdonos hozhatja létre (`information-hiding`) | architecture-rules, AGENTS.md (prezentáció: escaped rendering) |
| K4 | **Behavior-életciklus:** `document`/`window` `addEventListener`, `ResizeObserver` és `MutationObserver` csak behavior-modulban, `dispose`-zal. | gépi: modullista-szabály; review: a `dispose` valóban mindent levesz | architecture-rules, design-review |
| K5 | **Markup-szerződés:** id, `data-*` művelet és sorattribútum csak a jegyzékkel együtt változhat; változásához ADR kell, és a tesztek ugyanabban a commitban követik, gyengítés nélkül. | gépi: governance-teszt a jegyzék és a kezelt műveletek egyezésére; review: ADR | AGENTS.md, ai-governance „Kockázati osztályok – Megjelenítés” |
| K6 | **Intent-lefedettség:** minden Intent-típusnak van headless vezérlőtesztje. | gépi: a governance-teszt összeveti az Intent-unió tagjait a tesztek táblázatával | ai-governance, tests/governance.test.mjs |
| K7 | **Teljesítménykeret:** a kirajzolást, húzást vagy interakciót érintő változás a `test:browser:perf` kaput futtatja. Az alapszint csak dokumentált javulással, `--baseline`-nal írható újra, a meglévő baseline-szabály szerint. | gépi: a kapu és a `gate-plan` (a változás eléri az oldalt → fut); review: az ADR „Bizonyíték” szakasza előtte/utána számokkal | ai-governance „Bizonyítékok megőrzése”, AGENTS.md „Agent workflow” 4. pont |
| K8 | **Új futásidejű frontendfüggőség** (keretrendszer, UI-könyvtár, állapotkezelő) csak a felhasználó döntésére. | review: jóváhagyási pont | AGENTS.md „Approval points” lista bővítése |
| K9 | **Viselkedésmegőrző refaktorálás:** refaktoráló commit nem változtat látható szöveget, elrendezést vagy tesztelvárást. Ha mégis kell, az külön, megjelölt commit ADR-rel. | review; a böngészős suite-ok változatlansága | AGENTS.md „Agent workflow” 2. pont |
| K10 | **A megjelenítési kockázati osztály bizonyítéka kiegészül:** headless egységteszt a parancsokra és selectorokra; perf-kapu forróút-változásnál; a markup-szerződés tesztje. | review és gépi (K5–K7) | ai-governance „Kockázati osztályok” |
| K11 | **Kirajzolás közben nincs környezetolvasás** (`matchMedia`, storage): a környezet az `environment` szeletből jön. | gépi: K1 a kirajzoló modulokra is kiterjesztve, a felsorolt globálisokra; a behavior-modulok kivételek | architecture-rules |
| K12 | **Fázis = ADR:** minden fázis ADR-je tartalmazza a modulonkénti elrejtett tudást, az interfészt, a „design it twice” összevetést, a mérést és a `design` megállapításokat (javítva vagy rögzítve). | review; a governance-teszt a nyitott szakaszokat a jegyzékhez köti | design-review, ai-governance |

A gépi szabályok (K1, K3, K4, K11) modullistái az `architecture-rules.ts`-ben az `information-hiding` mintájára élnek. Egy új modul felvétele a listára tervezési döntés, amelyet az ADR rögzít (AGENTS.md).

## 7. Kockázatok és ellenszerek

| Kockázat | Ellenszer |
| --- | --- |
| Fókusz- és kijelölésvesztés a részleges kirajzolásnál | T4.3; a workbench-, a11y- és drag-suite fázisonként `--full`-lal; a FocusTarget minden Intent-típusra tesztelve |
| Versenyhelyzet az aszinkron Intentekben | T2.5 egyetlen effektsegéd; késleltetett ígéretes egységtesztek |
| Zajos headless mérés | medián legalább 5 futásból; fojtott és fojtatlan mérés; a keret kezdetben +20% |
| Hatókör-kúszás (UX- vagy szövegváltozás „ha már ott vagyunk”) | K9; döntési pont a felhasználónak |
| Nagy, egyszerre bevitt változás | taskonként zöld kapu; az F2 először átmeneti `render` porttal, a store csak az F3-ban |
| A hosszú böngészős suite lassítja a kört ([NY-42](nyitott-tetelek.md)) | `npm run gate` taskonként, `--full` fázis végén |
| `content-visibility` mellékhatása (ívek, `scrollIntoView`, layout-kapu) | T1.6 külön task, mérés és layout-suite; ha nem tiszta, elhagyható |
| A copy-on-write költsége | elhanyagolható (16 kísérlet, kis objektumok); a perf-kapu méri |

## 8. Teljes kész-feltétel

- A `public/ui.js` nincs a `legacyJavaScript` listán. A vezérlés strict TS-ben van, Intent-szótárral.
- **Állapot és kirajzolás:**
  - állapotot csak a store ír, ezt a fordító kikényszeríti;
  - kézi `render()` hívás nincs;
  - a kirajzolás régiós és kulcsolt.
- **A K1–K12 szabályok beírva;** a gépiek negatív tesztekkel.
- **Az F4 célkeretei teljesülnek** a perf-kapun, vagy az ADR rögzíti az eltérés okát.
- **Minden meglévő suite változatlan elvárásokkal zöld** (`npm run gate -- --full`), és az új headless tesztek is zöldek.
- **Dokumentáció kész:**
  - az ADR-ek (az F0 ADR-jétől), a CHANGELOG;
  - a nyitott tételek jegyzéke (NY-58 lezárva vagy a hátralévő részre szűkítve);
  - az [architecture.md](architecture.md) határtáblája frissítve (store, vezérlő, selectorok, gesztusgép, nézetadapter, behaviorök sorral);
  - az adapterútmutató (T6.1).

## 9. Útmutató a taskosításhoz

**Minden task tartalmazza:**
1. **Azonosító és cél:** például `T2.4`, egy mondat.
2. **Érintett fájlok** útvonallal.
3. **Elrejtett tudás és interfész:** melyik modul mit birtokol a task után.
4. **Kockázati osztály és kötelező bizonyíték:** [ai-governance.md](ai-governance.md) és a 6. szakasz.
5. **Tesztek:** új vagy érintett egység-, böngészős és perf-teszt.
6. **Kész-feltétel:** a fenti táblákból, mérhető formában.
7. **Függőség:** melyik task után jöhet.
8. **Döntési pont:** ha van, a felhasználónak szóló kérdés.

**Megállási pontok, amelyeknél a felhasználót kell kérdezni:**
- push vagy deploy;
- új futásidejű függőség (K8);
- látható változás (K9), például ha a T1.4 előnézete vizuálisan nem egyezhet meg;
- tesztelvárás módosítása;
- a T6.3 második adaptere;
- ha egy F4-es cél nem érhető el, és a keretet módosítani kellene.

## 10. Illesztés a többi tervhez és ütemezés (2026-11-14)

A felhasználó kérése: a terv kerüljön a többi tétel közé úgy, hogy ne legyen velük fedésben, ne ismételjen, és ne legyen hiányos. Az egységes sorrend a [jegyzék](nyitott-tetelek.md) „Sorrend” szakaszában áll; ez a szakasz az indoklás.

### 10.1 Ami a javaslathoz képest változott

| Volt | Lett | Miért |
| --- | --- | --- |
| NY-49 | **NY-58** | az NY-49 időközben a TypeScript `namespace` hibás elfogadása lett |
| ADR-148-tól | **a következő szabad számtól** | a 148 (névelő) és a 149 (technológiajelölés) foglalt |
| G1–G12 szabályok | **K1–K12** | a G1–G9 a [közös terv](terv-korpusz-es-verziok.md) lépései, a „G1” és „G2” pedig az első és a második kapu neve is |

Az F0–F6 és a T-azonosítók maradtak. A feladatlistában „Refaktor F0…F6” néven állnak, mert az F1–F6 egy lezárt, régi dizájnszakasz neve is volt.

A javaslat tényeit a kódon ellenőriztem (2026-11-14): a `ui.js` 63 `render()` hívása, kb. 22 fókuszhívása és a T0.5 három elavult listabejegyzése megvan; a hivatkozott ADR-ek és dokumentumok léteznek.

### 10.2 Fedések és hiányok

| Másik tétel | Hol ér össze | Feloldás |
| --- | --- | --- |
| **G2** (jelvény, szűrő, összesítő) és **G3** (a lista fája) | új állapot (szűrő, nyitott ágak) és új `data-*` műveletek a `view.ts`, a `fields.ts` és a `ui.js` területén; az F2–F4 ugyanezeket a fájlokat bontja szét | **a G2 és a G3 az F2 előtt készül el.** Így az Intent-szótár és a régiók a végleges felületre készülnek, és a refaktorálás elfogadási tesztjei már a G2 és a G3 tesztjeit is tartalmazzák. A G2 és a G3 az F0 szabályai szerint készül, ahol a régi szerkezet engedi (egy állapotíró, a jegyzékbe vett műveletek) |
| **NY-57** (tananyag a tanulónak, a szerző saját fája) | nagy új felület | **az F4 után:** már az új szerkezetre épüljön |
| **NY-42** (a kapu leghosszabb sorainak felosztása) | a T0.2 új böngészős sort ad a teljes körhöz; a K7 a felületi változások kapujába is beteszi | az NY-42 az F0 része lesz: a mérősor külön sávban fut, és nem lehet a kapu új alsó határa |
| **NY-28** (`pages-api`, régi JS) | a T1.2 a `pages-api.js` betöltő részét írja át; a T2.7 a `ui.js`-t veszi le a régi JS listájáról | az NY-28 külön tétel marad; a T1.2 bekötés jellegű módosítás. A `pages-api.js`-t a G8 (RxJS-típusok) is érinti: **a T1.2 a G8 előtt** |
| **G3 tananyagjegyzéke** | a T1.2 alternatívája (előre ellenőrzött katalógus build időben) ugyanarról a betöltésről dönt | **egy döntés, a G3 ADR-jében.** A T1.2 azt valósítja meg, amit a G3 választ. **Eldőlt ([ADR-154](adr/154-curriculum-tree-in-the-practice-list.md)):** a T1.2 a párhuzamos példatöltés; az előre ellenőrzött katalógus csak mért lassúságra kerül elő (a G6 szállítási döntése előtt mérve) |
| **G5–G8** (48 új lecke) | a 2.3 mérései 16 feladatra szólnak; az indulás soros betöltése a katalógussal együtt nő | **hiány a javaslatban:** a T0.2 forgatókönyvei rögzített feladatkészleten fussanak, ne a szállított katalóguson, különben minden tananyagfázis átírná az alapszintet. Az indulást a szállított katalógussal is mérni kell, tájékoztató számként. **A T1.2 a G6 szállítási döntése előtt** |
| **G4** (TypeScript 6.0.3) | a `src/workbench` is ezzel fordul; az F2–F5 sok új szigorú típust hoz | **a G4 az F2 előtt:** az új kód egyszer készüljön, az új fordítóra |
| **ADR-145** rögzített megállapításai | a 650 px-es határ két helyen áll; három mérőmodul külön figyelővel | a T3.4 (`environment` szelet) és a T5.1 (behavior-életciklus) zárja le őket; az F3 és az F5 ADR-je hivatkozzon rájuk |
| **ADR-146** (panelszélesség) | a szélesség gyökér-CSS-változóban és a `localStorage`-ban él (`pane-split.ts`) | a T3.4 része; a tárolási kulcsok nem változnak |
| **ADR-144, ADR-146** (mért listamagasság; `contain:size` a szabálypanelen) | a T1.6 `content-visibility`-je a mért magasságokat és az ívek geometriáját érinti | a T1.6 ellenőrzőlistája bővül: `list-fit`, a szabálypanel konténerlekérdezése, a ragadós oldalsáv (NY-43) |
| **ADR-149** (technológiajelölés) | a lista elemei `technologies` mezőt visznek | a T3.3 snapshot-típusai tartalmazzák; a javaslat még nem ismerhette |
| **K8** (új futásidejű frontendfüggőség) | az AGENTS.md jóváhagyási listája ma is kér jóváhagyást új futásidejű szolgáltatáshoz | a T0.3 a meglévő listát bővíti egy sorral, nem új szabályt ír mellé |
| **NY-56** (Angular-ág) | névrokonság a T6.3-mal | nincs közük egymáshoz: az NY-56 Angular-kódot tanító feladatokról szól, a T6.3 a munkafelület saját nézetrétegéről |
| **NY-49, NY-50, G5–G8, NY-51** | nincs közös fájl (mag, szerzői elemzés, tesztek, példák) | **párhuzamosan futhatnak** az F2–F5-tel, ha másik ügynök viszi. Közös a kapu ideje és a főág: egyszerre egy push megy ([ADR-142](adr/142-fast-deploy-and-local-gate.md)) |

### 10.3 Hol áll a sorrendben, és érdemes-e a végére hagyni

**A nagy részét (F2–F6) érdemes a tartalmi munka végére hagyni; az F0-t és az F1-et nem, és az NY-57 elé be kell fejezni.**

| Rész | Mikor | Miért |
| --- | --- | --- |
| **F0** (mérés, szabályok, markup-szerződés) | az NY-49 után, a G2 előtt | látható változás nélküli, kis lépés; a mérőkapu megmutatja, mit ront a G2, a G3 és a növekvő katalógus; az új felület már a szabályok szerint készül |
| **F1** (gyors nyereség) | a G3 után, a G6 előtt | a T1.2 nélkül az indulás a 64 feladattal tovább lassul; a többi task a felületi munkától független |
| **F2–F5** (vezérlő, store, régiós kirajzolás, gesztusgép) | a G3 és a G4 után; **másik ügynökkel a G5–G8 alatt párhuzamosan, egy ügynökkel a G8 után** | viselkedésmegőrző refaktoráláshoz nyugodt felület kell; a tartalmi fázisok nem nyúlnak a `src/workbench`-hez |
| **F6** (adapterútmutató) | az F5 után | – |

**Miért nem a legvégére, mindenestül:**
- az NY-57 nagy új felület; ha a régi szerkezetre épül, az F2–F4 többet visz át, és az új felület is megfizeti a régi szerkezet árát;
- az indulási idő a katalógussal nő (T1.2);
- mérőkapu nélkül a G2 és a G3 lassulása észrevétlen marad.

**Miért nem most, mindenestül:**
- a helyesség előbbre való: az NY-49 hibás elfogadás;
- a G2 és a G3 a felhasználó kért, látható eredménye; a refaktorálás hét fázisa ezeket hosszú időre megállítaná;
- az Intent-szótár akkor teljes, ha a G2 és a G3 műveletei már megvannak.

### 10.4 Döntések a felhasználónak

1. **A sorrend** a 10.3 szerint.
2. **Ki viszi az F2–F5-öt:** másik ügynök a tartalmi fázisok alatt, vagy ugyanaz az ügynök a G8 után.
3. **Az F0 ADR-je:** a célarchitektúra elfogadása (T0.1).
