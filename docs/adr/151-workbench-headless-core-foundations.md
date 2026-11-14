# ADR-151 – A munkafelület headless magjának alapjai: célarchitektúra, mérőkapu, szabályok, markup-szerződés (NY-58, F0)

Állapot: **elfogadva** (2026-11-14). A [refaktorterv](../terv-munkafelulet-refaktor.md) a felhasználóé; az F0 fázist jóváhagyta („amint végez és zöld, jóváhagyom és mehet a Refaktor F0”). Ez az ADR a terv T0.1–T0.5 taskjait zárja. Kockázati osztály: dokumentáció és eszközök (architektúra-kapu, kapufuttató, mérőeszköz, governance); a munkafelület kódja nem változott, látható változás nincs.

Öt ponton tér el a megvalósítás a tervtől; ezeket a „Lezárt kérdések” szakasz rögzíti.

## Kontextus

- **A munkafelület állapotát ma több hely írja:** a `public/ui.js` 63 kézi `render()` hívással és kb. 22 szelektoros fókuszhívással, az `interactions.ts`, és a DOM maga (a terv 2. szakasza; a számokat a kódon ellenőriztem).
- **A fő szál forró útjai lassúak** a 482 soros feladaton: egy billentyűs lerakás és egy ellenőrzés a teljes oldalt újrarajzolja (lent a mért alapszint).
- **Mérés nélkül a gyorsítás nem igazolható,** szabály nélkül az új felület (a jelölés felülete, a lista fája) a régi szerkezetet hizlalja tovább.

## Döntés

### A célarchitektúra (a terv 3. szakasza)

- **Headless alkalmazásmag:** egy store (`getSnapshot`, `subscribe`, `dispatch(intent)`), típusos Intent-szótár, tiszta selectorok, beszúrási gesztusgép. DOM-ot nem ismer.
- **Nézetszerződés:** csak olvasható snapshot és nézetmodell, Intent-szótár, `FocusTarget`, `SafeHtml`, markup-szerződés, behavior-életciklus.
- **Nézetadapter (ma: vanilla DOM):** régiós és kulcsolt kirajzolás, DOM-esemény → Intent, behaviorök.
- **A fázisok** (F1–F6) a terv 4. szakasza szerint, a [jegyzék](../nyitott-tetelek.md) sorrendjében.

### Amit az F0 ad

| Task | Eredmény |
| --- | --- |
| **T0.2 Mérőkapu** | [browser-perf.playwright.py](../../tests/browser-perf.playwright.py), `npm run test:browser:perf`, alapszint: `tests/fixtures/perf-baseline.json`. Nyolc forgatókönyv egy rögzített feladaton (a 482 soros TypeScript-fixture a szerző szerkesztőjébe illesztve, a statikus Pages-builden: a szállított katalógus nem számít bele). A kapu a többi böngészős sor után, egyedül futtatja. |
| **T0.3 Szabályok** | A K1–K12 az [ai-governance.md](../ai-governance.md)-ben, az [AGENTS.md](../../AGENTS.md)-ben és a [design-review.md](../design-review.md)-ben. Négy gépi szabály az architektúra-kapuban, negatív tesztekkel: `presentation-headless` (K1), `presentation-dom-write` (K3), `presentation-behavior` (K4), `presentation-environment` (K11). |
| **T0.4 Markup-szerződés** | [markup-contract.json](../markup-contract.json): 8 azonosító, 46 művelet, 104 jelölő; a [teszt](../../tests/markup-contract.test.mjs) három egyezést őriz (lent). |
| **T0.5 Policy-lista** | Az `attempt.js`, a `drag-insert.js` és a `persistence.js` a régi JS listájáról a generált kimenetek közé került: a forrásuk szigorú TypeScript, és a kapu mostantól ezt a hármat is összeveti a forrásával (37 generált kimenet). |

### A mért alapszint (2026-11-14, három mérés mediánja)

| Forgatókönyv | Fő szál, ms (medián) | Egység | Stílus-újraszámolás | Elrendezés | Hozzáadott DOM-csomópont |
| --- | ---: | ---: | ---: | ---: | ---: |
| egység (rögzített szintetikus munka) | 43 | 1.00 | 1 | 2 | 18001 |
| egy billentyű a 482 soros forrásban | 31 | 0.81 | 2 | 3 | 3505 |
| modell készítése (a fő szál része) | 336 | 8.47 | 37 | 12 | 9427 |
| a Próba lépés megnyitása | 264 | 6.44 | 10 | 4 | 15498 |
| billentyűs célmozgatás (nyíl) | 85 | 2.05 | 3 | 2 | 2 |
| billentyűs lerakás (Enter) | 322 | 7.67 | 15 | 5 | 15503 |
| húzás: egy mozdulat a másik lista fölött | 184 | 3.82 | 6 | 3 | 1 |
| ellenőrzés | 421 | 10.16 | 18 | 6 | 17662 |

- **Az „egység”** a fő szál saját CPU-ideje (a Chromium szálórája szerint), osztva egy rögzített szintetikus munka idejével, amelyet ugyanaz a böngésző mér. Az arány gépek között vihető, az ezredmásodperc nem.
- **A számok egyeznek a terv méréseivel** nagyságrendben (a terv: lerakás 280–288 ms, ellenőrzés 222–254 ms, húzás 118–120 ms).
- **A teljes újrarajzolás látszik a darabszámokon:** egy lerakás 15 503, egy ellenőrzés 17 662 DOM-csomópontot hoz létre újra; a billentyűs célmozgatás csak 2-t, mégis 85 ms (stílus-újraszámolás minden sorra).

### A mérés zajszintje, és ami belőle következik

Kilenc teljes mérés azonos kódon, ezen a gépen:

| Mit | Szórás azonos futások között |
| --- | --- |
| stílus-újraszámolás, elrendezés, hozzáadott csomópont | **0** hat forgatókönyvben; a modellkészítésnél a stílus 31–39, az elrendezés 10–14 (a folyamatjelző és a worker válaszai akkor érkeznek, amikor érkeznek) |
| idő, öt futás mediánja | 18–52% |
| idő, hét futás legjobbja, egységben | 3–37% |

- **A darabszám a kapu:** legfeljebb 10%-kal (legalább 2-vel) lépheti túl az alapszintet; a modellkészítés stílus- és elrendezésszáma 50%-kal.
- **Az idő csak durva romlást fog meg:** a keret az alapszint 1,6-szorosa (CI-ben 2-szerese). A terv +20%-os kerete ezen a mérésen változatlan kódon is elbukna.
- **A cél attól még ellenőrizhető:** az F4 céljai négy-ötszörös gyorsulások (például lerakás 50 ms alatt a mai 322 helyett), messze a zaj fölött.
- **Jelentett, nem kapuzott:** falióra-idő, leghosszabb task, leglassabb esemény, leghosszabb képkocka fojtás nélkül és 4-szeres CPU-fojtással; az oldal indulása a szállított katalóguson (ma 370–460 ms helyi kiszolgálóról).

### A gépi szabályok listái (a mai állapot)

| Szabály | A listán ma | Miért ennyi |
| --- | --- | --- |
| K1 headless | `attempt`, `author-session` | A terv hét modult nevez már headlessnek; kettő felel meg ma. A `flow`, az `availability` és a `contracts` DOM-típust nevez meg (`HTMLElement`, 2, 1 és 1 helyen); a `learner-rules` a DOM-ot használó `ui-utilities`-t importálja; a `persistence` maga a tárolóadapter (`localStorage`, `document`), az port marad, nem headless modul. |
| K3 DOM-írás | `view`, `ui-utilities`, `activity` | ezek írnak ma nyers HTML-t (a nézet, a szerkesztőkeret kiemelője, a folyamatjelző rögzített váza) |
| K4 figyelők | `view`, `interactions`, `surface`, `toggletip`, `header-fit`, `list-fit`, `toolbar-fit` | ezek tartanak ma `document`- vagy `window`-figyelőt, illetve megfigyelőt |
| K11 környezet | tíz kirajzoló modul | a `view.ts` és a `code-view.ts` ma olvas médialekérdezést és tárolót; a `view.ts` az F3-ban kerül a listára |

A `public/ui.js` régi JS, a szabályok a T2.7-ig nem érik el (egy `innerHTML` írása van).

### A markup-szerződés

- **A szerződés az, amire a böngészős tesztek építenek:** 150 `data-*` név és 8 azonosító. A források további 40 `data-*` neve az adapter saját szókincse, nem szerződés.
- **A teszt három egyezést őriz:**
  1. amit egy böngészős teszt kiválaszt, az a jegyzékben van;
  2. ami a jegyzékben van, az létezik a forrásokban (a „retired” lista neve nem);
  3. a jegyzék műveletei pontosan azok a `data-*` nevek, amelyeket a vezérlő kezel.

## Két terv („design it twice”)

**A store** (a terv 3.1 szakasza): (a) store és Intent; (b) a mai állapot megtartása, csak a `ui.js` típusosítása; (c) eseménybusz. A (b) nem ad snapshot-identitást, a (c) időbeli csatolást hoz. **Az (a) a választott.**

**A markup-szerződés alakja:**
1. **Konstansmodul** (`markup-contract.ts`). Elvetve most: futásidejű kód lenne, amelyet még semmi nem használ; az F2 Intent-táblája lesz az első fogyasztója, akkor dönthető el.
2. **Adatfájl a dokumentumok között, teszttel (választott).** A tesztek és a kód egyezését ma is őrzi, kód nélkül.

**A mérőszám:**
1. **Falióra-medián +20%-os kerettel** (a terv). Elvetve: azonos kódon 18–52%-ot szór.
2. **Csak darabszámok.** Elvetve: a stílusszámítás költségét nem látja (a célmozgatás 2 csomópont, 85 ms).
3. **Darabszám szigorú kerettel, szálidő-arány tág kerettel (választott).**

## Tervezési review (docs/design-review.md)

- **A mérőeszköz elrejti** a forgatókönyveket, a mérés módját (szálóra, egység, megfigyelők) és a kereteket; a kapufuttató csak annyit tud róla, hogy egyedül kell futnia.
- **A modullisták egy helyen állnak** (az architektúra-szabályok fájljában), a szabállyal együtt; a dokumentumok hivatkoznak rájuk, nem ismétlik.
- **design, rögzítve:** a K4 a közvetlen alakokat fogja meg (`document.addEventListener`, `window.addEventListener`, csupasz `addEventListener`, megfigyelő létrehozása). Egy `ownerDocument`-en át felvett figyelő review-feladat marad.
- **design, rögzítve:** a markup-teszt a „kezelt művelet” fogalmát mintaillesztéssel állapítja meg a vezérlő szövegén; az F2 Intent-táblája után a tábla lesz a forrás.
- **design, rögzítve:** a mérőkapu a böngészős sorok végére kb. 2 perc 20 másodpercet tesz; a kapu két leghosszabb sorának felosztása (NY-42) külön lépés marad.

## Bizonyíték

- **Negatív tesztek** ([architecture.test.mjs](../../tests/architecture.test.mjs)): a négy szabály mindegyike bukást ad a tiltott alakra, és nem ad a megengedettre (kilenc globális név, DOM-típus szignatúrában, tag mint nem-globális, a listán kívüli modul).
- **A mai kód megfelel:** az architektúra-kapu zöld (156 fájl, 37 generált kimenet).
- **Governance-teszt** ([governance.test.mjs](../../tests/governance.test.mjs)): a K1–K12 tábla teljes, a gépi szabályok neve a táblában és a kapuban is megvan, az AGENTS.md megnevezi a K5, K7, K8 és K9 szabályt.
- **Markup-teszt:** négy teszt zöld.
- **Mérőkapu:** zöld a mai kódon; az alapszint három mérés mediánja; a zajtábla kilenc mérésből való.
- **Teljes kör:** `npm run gate` (az eszközlánc változása a teljes regressziót futtatja).

## Lezárt kérdések (2026-11-14)

A megvalósítás öt ponton tért el a tervtől. A felhasználó az első négyet megerősítette („jóváhagyom mind a három ajánlást”), az ötödiket a CI első futása zárta le:

1. **Az időkeret 1,6-szoros, nem +20%;** a szigorú kapu a darabszám. Ok: a mért zaj.
2. **A headless listán két modul állt, nem hét** (az [ADR-152](152-technology-labels-in-the-practice-list.md) óta három). Ok: a többi ma DOM-típust vagy DOM-modult használ; fázisonként kerülnek fel.
3. **A markup-szerződés adatfájl, és a tesztek által használt neveket tartalmazza,** nem a források minden nevét.
4. **Az NY-42-ből az F0 annyit oldott meg, hogy a mérősor egyedül fut;** a leghosszabb sorok felosztása nyitva maradt a [jegyzékben](../nyitott-tetelek.md).
5. **CI-ben az időkeret 2-szeres.** A mérőkapu a CI-gépen az első futásra zöld lett (366d028), a darabszámok ott is az alapszinten belül vannak. Ha egy későbbi futás eltér, nem a keret tágul: a CI saját alapszintet kap.
