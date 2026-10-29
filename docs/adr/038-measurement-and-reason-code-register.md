# ADR-038 – Mérési infrastruktúra és az indokkódok jegyzéke

Állapot: implementálva (2026-10-29). A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 3. fázisa. A generátor kimenete, a validátor és a séma változatlan: a generátor ugyanazokat a kódokat és kategóriákat bocsátja ki (a teljes katalóguson ellenőrizve).

## Kontextus

- **Két mérőeszköz, egy szabály két példányban:** a generatív kampány és a korpuszmérés ugyanazt az osztályozást ismételte (hibás elfogadás, indokolatlan és jogos elutasítás, eldöntetlen). Okbontást egyik sem adott.
- **Torzított arány:** a dobó referenciákat a kampány nem választotta szét (terv 3.2).
- **Nem volt kikényszerített küszöb:** a generatív mérésre nem volt regressziós küszöb, csak a korpuszra.
- **Szétszórt indokkódok:** a kódok stringként éltek. A „kód → kategória” tudást a `statement-ordering` saját szabálya és a többi kibocsátó hely külön-külön ismerte (terv 3.3).
- **Futtatatlan nyelvi elemek:** több nyelvi elem egyetlen futtatott fixture-ben sem szerepelt (terv 4. pont).

## Döntés

### 1. Egy osztályozó, egy csoportosító

A [order-classification.mjs](../../tests/support/order-classification.mjs) az egyetlen hely, amely tudja, hogyan osztályozzuk egy modell egy sorrendjét:
- **osztályok:** `accepted`, `unsound`, `gap`, `justified`, `undecided`, `indeterminate`;
- **ok:** egy elutasítás oka a megsértett közvetlen kényszerek indokkódjai, vagy `scope`;
- **dobó referencia:** a fixture saját próbakonvenciója mondja meg, hogy a referencia dobott-e (`threw`, az objektumpróbánál `probeCaughtThrow`).

A `createTally` csoportonként számol, és rangsorolja az indokolatlan elutasítások okait. Ezt használja:
- a korpuszmérés (`measureFixture`);
- a [generative-metrics.mjs](../../tests/support/generative-metrics.mjs) (`measureCampaign`), amelyre a kézi kampány és a gyors teszt is épül.

A programok azonosítóit és fajtáit a [fixture-catalog.mjs](../../tests/support/fixture-catalog.mjs) birtokolja.

### 2. Kötelező mérőszámok és küszöbök

| Mérés | Csoportosítás | Küszöb |
| --- | --- | --- |
| [generative-metrics.test.mjs](../../tests/generative-metrics.test.mjs) (gyors konfiguráció, kb. 20 s) | fajta × nyelv × szabályverzió × dobott-e a referencia | hibás elfogadás = 0, eldöntetlen = 0, keretkimerülés = 0; az indokolatlan elutasítás aránya csoportonként nem nőhet ([generative-baseline.json](../../tests/fixtures/generative-baseline.json)); minden indokolatlan elutasításnak van regisztrált oka |
| [semantic-corpus.test.mjs](../../tests/semantic-corpus.test.mjs) (változatlan) | fixture | hibás elfogadás = 0, eldöntetlen = 0, rögzített teljességi számok |

**Javulás:** a küszöb nem nőhet. A javulást tudatosan, review mellett kell rögzíteni: `node tests/ordering-campaign.mjs --baseline`.

### 3. Az indokkódok jegyzéke

A [reason-codes.ts](../../src/author/reason-codes.ts) az egyetlen jegyzéke minden kódnak, amelyet a JS/TS-elemzés a provenienciába ír. Minden kódhoz megadja a kategóriát, a jelentést és a bevezető ADR-t.

- **Típus:** a `ReasonCodeName` típus miatt a fordító elutasítja a nem regisztrált, szó szerinti kódot (`OrderingReason.code`, `barrier()`).
- **Kódcsalád:** a szintaxisfajta szerinti barrier-kódok (például `ExpressionStatement`) egy családot alkotnak.
- **A kategória tulajdonosa:** a barrierek kategóriáját a `statement-ordering` a jegyzéktől kérdezi. A korábbi saját szabály (`unsupportedShape`) megszűnt.
- **Bizonyíték:** minden kódhoz rögzített bizonyíték tartozik ([reason-code-evidence.json](../../tests/fixtures/reason-code-evidence.json), előállítója a [reason-code-evidence.mjs](../../tests/reason-code-evidence.mjs)).

  | Bizonyíték | Jelentése | Kinek elég |
  | --- | --- | --- |
  | `justified` | egy sorrend, amelyet egyedül ez a kód utasít el, és az orákulum szerint más a viselkedése | minden kódnak |
  | `gap` vagy `occurrence` | dokumentált túlszigorúság vagy előfordulás | csak konzervatív kódnak |
  | `waived` | nevesített felmentés indoklással, csak a [reason-code-programs.mjs](../../tests/fixtures/reason-code-programs.mjs) listájáról | csak felmentett kódnak |

  Jelenleg 34 kód van: 29 viselkedési bizonyítékkal, 3 előfordulással, 2 felmentéssel (`module-import`, `overload-group`).
- **A [reason-codes.test.mjs](../../tests/reason-codes.test.mjs) ellenőrzi:**
  - a jegyzék alakját;
  - a teljességet: a teljes katalógus, a 24 TS-minta és a CopyField fixture minden kibocsátott kódja regisztrált, ugyanazzal a kategóriával, és egyik sem `unknown`;
  - hogy minden bizonyíték ma is érvényes.
- **Szabadság:** a pozíciófüggetlenség nem kód, hanem kényszer hiánya. Pozitív bizonyítéka a korpusz rögzített elfogadási száma.

### 4. Nyelvi lefedettség

A korpusz öt `coverage` fixture-t kapott:
- függvény- és osztálykifejezés;
- `for…in` és `do…while`;
- `?.`, `delete` és regex;
- `instanceof` és `in`;
- TS `as`, `!` és `satisfies`.

Mindegyik helyes, és nincs eldöntetlen eset.

## Következmények

**Mért kép (gyors konfiguráció):** a dobó referenciák külön csoportban. Az objektumprogramokon például:

| Referencia | Indokolatlan elutasítás aránya |
| --- | --- |
| JS, nem dobó | 26,6% |
| JS, dobó | 43,2% |
| TS, nem dobó | 11,3% |
| TS, dobó | 16,7% |

A korábbi összesített szám tehát részben mérési torzítás volt.

**Hátralévő tervezési adósság (ADR-037 szerint rögzítve):**
- A kibocsátó helyek a kód mellett még kézzel is megadják a kategóriát. Mindenhol a jegyzékből kellene levezetni; ez kb. 60 hely négy elemzőmodulban.
- Addig a teszt kikényszeríti, hogy a kibocsátott kategória egyezzen a jegyzékkel. A levezetés a 4. fázis első tétele.
