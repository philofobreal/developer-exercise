# ADR-047 – A `switch` törzse saját blokk (v24)

Állapot: **elfogadva** (2026-10-31), szabályverzió `scoped-effect-analysis-v24`. A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 4. fázisának 6. tétele és a 6. fázis rövid távú pontja („a projekciós lezárás finomítása ott, ahol felesleges”).

## Kontextus

**A mért ok:** a v23 után a legnagyobb közös rés-ok a `sealed-unit` volt. A `flow` csoportban szinte mindegyik egy `switch` utasításból jött.

**Miért zárt le a projekció:**
- a strukturális elemzés (`jsTsStructure`) csak a `{…}` blokkokat (`Block`) adta át, a `switch` törzse (`CaseBlock`) viszont nem ilyen;
- a `switch` sorai így a szülő scope-ban voltak, és a projekció „lyukasnak” látta az egységet: egy testvér a sorai közé kerülhetett volna (ADR-009);
- ezért minden azonos scope-ú testvérrel sorrendbe kötötte, akkor is, ha a hatásnyomuk független volt (ADR-034).

## Döntés

1. **A `switch` törzse megtartott blokk:** saját scope-pal, a `switch (…) {` sortól a záró `}` sorig. A testvérek sorai így a scope miatt nem kerülhetnek be.
2. **A belső sorrend változatlan:** a `case`/`default` sorok és a klauzulák utasításai elemzés nélkül forrásbeli elődjüket követik, ahogy eddig a lezárt egységen belül.
3. **A `switch` egysége nem lyukas:** így nem zárul le, és a hatásnyoma (ADR-034) szerint mozoghat.
4. **Az orákulum változatlan:** a P1 lexikai tulajdonlás eddig is a listákon belül tartotta a sorokat.
5. **Szabályverzió:** v24.

## Ami marad

A többsoros kifejezés folytatósorai (`record(` … `)`) továbbra is lezártak. A sorai közé egy testvér csak a scope-pal nem lenne megakadályozható, és a v2 más eszközt nem ad. Ez a 6. fázis v3-modelljének tárgya; ma a `function` csoport fő maradék oka.

## Bizonyítékok

- **Tesztek:** [switch-scope.test.mjs](../../tests/switch-scope.test.mjs), az orákulummal ellenőrizve:
  - a törzs megtartott blokk, a sorai a scope-jában vannak, `sealed-unit` nincs;
  - egy másik objektum művelete a `switch` elé kerülhet (JS és TS);
  - testvér nem kerülhet a törzsbe, sor nem hagyhatja el a klauzuláját vagy a `switch`-et.
- **Mérés (12 mag, azonos orákulum, a v23-hoz képest):**

  | Csoport | v23 | v24 |
  | --- | ---: | ---: |
  | flow JS | 15,0% | 13,7% |
  | flow JS, dobó | 17,6% | 15,6% |
  | flow TS | 11,8% | 11,0% |
  | flow TS, dobó | 5,6% | 2,8% |

  A többi csoport változatlan, hibás elfogadás nincs.
