# ADR-101 – A feladat szintje és a szint szerint csoportosított feladatlista

Állapot: **elfogadva** (2026-11-05). A felhasználó döntése: „kérem a csoportosítást, a besorolás jó”. A jóváhagyott besorolás: 6 kezdő, 7 közepes, 3 haladó. Kockázati osztály: mag (sémabővítés) és megjelenítés. A szabályverzió nem változik.

## Kontextus

16 példánál a gyakorló feladatlista hosszú volt, és fájlnév szerint rendezett, így a kezdő és a haladó feladatok összekeveredtek. A Gyakorlás ráadásul az első feladattal (`algo-bfs-js`, a legnehezebb) nyílt meg.

## Döntés

1. **Választható `level` mező a feladatmodellben** ([schema.json](../schema.json), [code-line.ts](../../src/core/code-line.ts)): `beginner`, `intermediate` vagy `advanced`. Szerzői döntés, mint a cím és a leírás.
   - A hiányzó szint besorolatlant jelent, ezért minden régi modell érvényes marad.
   - Ismeretlen érték érvénytelen modell (a séma kikényszeríti).
   - A szint metaadat, a szabályokat nem érinti, ezért revíziót sem emel. A szerzői frissítés megtartja, mert az eredeti modell minden mezőjét átviszi.
2. **A katalógus** (a szerver `ExerciseCatalog.list` és a Pages-adapter) továbbadja a szintet a feladat összefoglalójában.
   - A Pages-adapter (`public/app/pages-api.js`) régi, kézzel írt modul; csak egy adatmező átadása került bele, szabály nem.
3. **A feladatlista** ([fields.ts](../../src/workbench/fields.ts)):
   - **Csoportok:** „Kezdő”, „Közepes”, „Haladó”, „Egyéb feladatok” (besorolatlan), és a szerző „Saját előnézet” csoportja. Egy csoporton belül a katalógus sorrendje marad.
   - **Egy helyen:** a `practiceOrder` adja a sorrendet a lista és az induló feladatválasztás számára.
   - **Indulás:** a Gyakorlás az első kezdő feladattal nyílik meg.
4. **A 16 példa besorolása:**

| Szint | Példák |
| --- | --- |
| Kezdő | `celsius-js`, `even-odd-js`, `grade-ts`, `greeting-js`, `rectangle-js`, `vowels-js` |
| Közepes | `class-inventory-ts`, `fib-memo-js`, `profiles-js`, `stack-ts`, `stats-js`, `stats-reduce-js`, `word-count-js` |
| Haladó | `algo-bfs-js`, `algo-sort-search-js`, `class-accounts-ts` |

## Bizonyíték

[exercise-levels.test.mjs](../../tests/exercise-levels.test.mjs):
- **séma:** a három szintet és a hiányzót elfogadja, egy ismeretlent elutasít;
- **katalógus:** a jóváhagyott besorolással szolgálja ki a példákat;
- **feladatlista:** a csoportok sorrendje helyes, csoporton belül a katalógus sorrendje marad;
- **induló feladat:** a gyakorlás első feladata egy kezdő feladat.

A teljes böngészőkészlet (húzás minden példán, akadálymentességi átvizsgálás) változatlan elvárásokkal fut.

## Tervezési review (ADR-037)

- **Tulajdonos:**
  - a szint jelentése a modellé (séma, mag);
  - a sorrend és a csoportosítás a feladatlistáé (`practiceOrder`, egyetlen hely).

  A szerver és a Pages-adapter csak továbbadja; nem rendez.
- **Interfész:** egy választható modellmező, egy választható összefoglaló-mező és egy exportált függvény.
- **Szerzői szintválasztó (2026-11-05, kiegészítés):** a Forrás lépés „Szint” választója. A generátor a szintet a címhez hasonlóan változatlanul továbbadja ([generator.mjs](../../src/author/generator.mjs)): az üreset elhagyja, az ismeretlent elutasítja.
  - Egy példából indított feladat átveszi a példa szintjét, egy importált modell a sajátját.
  - A szint megváltoztatása, mint a címé, újraépítést kér.
  - **Bizonyíték:** generátorteszt a szintről, és böngészőteszt arra, hogy a kiválasztott szint a JSON-modellben megjelenik.
- **Design twice:** *a szint külön katalógusfájlban (`examples/levels.json`):* elvetve. Egy tanár saját feladata is hordozhat szintet, és egy második fájl szétválna a modelltől.
