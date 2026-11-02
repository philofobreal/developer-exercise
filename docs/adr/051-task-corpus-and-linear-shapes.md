# ADR-051 – Feladatkorpusz és lineáris alakkódolás az orákulumban

Állapot: **elfogadva** (2026-11-02). Mérési infrastruktúra, a generátor szabályai és a szabályverzió (`scoped-effect-analysis-v26`) nem változnak. Az [ADR-050](050-input-contract.md) után javasolt következő lépés: valódi feladatokra hasonlító mérőkorpusz.

## Kontextus

A korpusz fixture-jei egy-egy konstrukciót izolálnak (scope, `else if`, getter, osztálymező), a generatív kampány pedig zárt, véletlen programokat mér. Egyik sem olyan, mint egy tanórai feladat: paraméteres segédfüggvények, osztályok, closure-ök, gyűjtemények, kivételek, generikusok, enumok és uniótípusok együtt, 13–45 soron. A bemeneti szerződés (ADR-050) is éppen az ilyen kódra hat.

Az első mérés két dolgot mutatott:

- **Orákulumhiba:** a `task-grade-report-ts` mérése `RangeError: Invalid string length` hibával megállt. Az orákulum `tsShape`-je (és ugyanígy a `jsShape`) minden szinten a gyerekek már JSON-szöveg alakját csomagolta újra `JSON.stringify`-jal. Az escape-elés szintenként megduplázza a visszaperjeleket, így a kódolás hossza a mélységgel exponenciálisan nő. Egy függvényhívásban álló, ciklusba ágyazott template literál már túllépte a V8 sztringkorlátját.
- **Rések:** a 24 mérésből kettőben van completeness-rés (lásd lent).

## Döntés

1. **Feladatkorpusz** ([task-programs.mjs](../../tests/fixtures/task-programs.mjs)): 12 feladat, 7 JavaScript és 5 TypeScript. Mindegyik `origin: 'task'` fixture a közös korpuszban, `any` és `valid` szerződéssel is (`-valid` utótag), tehát 24 rögzített mérés. A probe csak érvényes egyszerű adatot ad át.

   | Feladat | Fő konstrukciók |
   | --- | --- |
   | `task-word-frequency-js` | regex `split`, `Map`, rendezés összehasonlítóval |
   | `task-matrix-stats-js` | egymásba ágyazott számlálós ciklus, `new Array().fill`, `reduce` |
   | `task-ledger-js` | osztály, kivétel dobása és elkapása, `try/catch` |
   | `task-group-by-js` | `reduce` objektumakkumulátorral, `Object.keys` |
   | `task-form-validation-js` | független ellenőrzések, hibalista |
   | `task-search-tree-js` | két osztály, `while (true)`, rekurzió, alapértelmezett paraméter |
   | `task-memoize-js` | closure, `Map`-gyorsítótár, függvény tulajdonsága |
   | `task-bracket-stack-ts` | generikus osztály, getter, `Record`, `else if` |
   | `task-cart-total-ts` | interface, típusalias, többsoros literál |
   | `task-priority-queue-ts` | enum, privát mezők, rendezés, opcionális lánc |
   | `task-grade-report-ts` | uniótípus, `else if` lánc, `switch` átcsúszással, template literál |
   | `task-graph-reach-ts` | `Map`/`Set`, tuple-destrukturálás, `!`, `continue` |

2. **Lineáris alakkódolás az orákulumban** ([semantic-oracle.mjs](../../tests/support/semantic-oracle.mjs)): csak az atomok (csomópontfej, név, literál) JSON-escape-eltek; a csomópont `(fej,gyerek…)`, a lista `[elem,…]`, a JS-objektum `{"név":érték,…}` alakban a már kódolt gyerekek köré íródik, újra-escape-elés nélkül. A kódolás injektív marad, és a sorrendfüggetlen listák (utasítások, osztálytagok) ugyanúgy rendezve kerülnek bele, ezért két alak pontosan akkor egyenlő, mint eddig. Csak a hossz lett lineáris.

3. **Mérés:** a `node tests/ordering-metrics.mjs` külön `task` csoportot összesít, és a `core` csoportból kihagyja, így a korábbi `core` számok összevethetők maradnak.

## Helyesség

- **Az alakkódolás cseréje ítéletet nem változtat:** az egyenlőségi reláció azonos (mindkét kódolás injektív, ugyanazokat a listákat rendezi). Bizonyíték azonos mércével: a korábbi 79 korpusz-fixture rögzített értéke bájtra azonos, a generatív gyors baseline, az indokkód-bizonyítékok és a bemeneti szerződés tesztjei változatlanul zöldek (105/105). Mellékhatás: a korpuszteszt futásideje ezen a gépen 173 s-ról kb. 50 s-ra csökkent.
- **A feladatkorpusz** csak hozzáadott mérés: a probe-ok rögzítettek, a programok szerzői tesztadatok, tanulói kód nem fut.

## Mérési eredmény (12 feladat × 2 szerződés)

- **Hibás elfogadás:** 0. Eldöntetlen, orákulum-eldöntetlen és `indeterminate`: 0.
- **Szomszédos sorrendek:** 27 380, ebből 463 elfogadott; completeness-rés 12, mind két feladatban:
  - **`task-ledger-js` (5–5 rés, `object-write-after-write`):** a konstruktor `this.owner`, `this.balance`, `this.entries` kulcslétrehozása kötött, pedig a program nem listáz kulcsot. Ok: a kulcsfelsorolás szöveges felismerése (`keyEnumeration`) az `entries` mezőnevet `Object.entries`-nek veszi. Konzervatív, nem hibás.
  - **`task-cart-total-ts` (1–1 rés, `sealed-unit`):** a `rule` deklaráció nem kerülhet a többsoros `items` tömbliterál elé. A többsoros egység lezárása az ismert v2-korlát (6. fázis).
- **A `valid` szerződés hatása:** csak két feladatban ad szabadságot, résmentesen: `task-form-validation-js` 9 → 12, `task-memoize-js` 4 → 6 elfogadott szomszéd. A többi feladat sorrendjét a saját objektumok írása és a hívások kötik, nem a bemenetek olvasása.

## Következmények

- A korpusz-baseline 24 új sorral bővült; a meglévő sorok nem változtak.
- **A korpusz építése közben talált hiba** (külön döntés, ADR-052): a kulcsfelsorolás és a reflexió szöveges felismerése nem látja a futásidőben összerakott tulajdonságnevet (`Object['ke' + 'ys']`), és ilyenkor a generátor hibás sorrendet fogad el.
- **Nyitott:** a `keyEnumeration` mezőnév miatti túlszigorúsága (`task-ledger-js`) és a többsoros literálok lezárása (`task-cart-total-ts`).
