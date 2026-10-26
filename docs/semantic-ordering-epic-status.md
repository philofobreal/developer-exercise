# Semantic Ordering Precision epic – állapot és újraindítási pont

Ez a dokumentum a „Semantic Ordering Precision, Visual Dependency Rule Editor & Explainable Validation” epic tartós munkanyilvántartása. Minden szakasz végén frissül, így egy megszakadt munkamenet innen veszteség nélkül folytatható. A fejlesztés helyi munkakönyvtárban folyik; push és deploy csak külön felhatalmazással történik.

## EPIC-00 – a folyamatban lévő munka összevezetése

**Kiinduló állapot:** `main` = `origin/main` = `76382c7`. A working tree tiszta, kivéve a felhasználói `project-snapshot.md` fájlt, amelyhez nem nyúlok. Nincs más munkakönyvtár, stash, futó háttérfolyamat vagy látható párhuzamos agent.

| Korábbi munka | Döntés | Indok |
| --- | --- | --- |
| WP1–WP8, ADR-008…011 (hatásösszegzés, lezárás, reflexió, nyelvfüggetlen relációk) | CONTINUE | helyes, mérésekkel igazolt alap; az epic P0–P4 szerződése erre épül |
| v7 (`accessor`, TS-kibocsátott globálisok), generatív lefedettség | CONTINUE | ez a független orákulum és a baseline mérőeszköze (EPIC-09) |
| R1–R3 / v8 (ADR-012) | COMPLETE (kész, pusholva) | csak az osztálytagokat érinti; **nem** oldja meg az import-, a lokális értékadás- és a blokkhatár-problémát |
| 4. feladat: a generátor TS-migrációja (ADR-001 P4) | INTEGRATE → EPIC-03 | a közös blokkhatárok kezelése a projekciót úgyis átírja; az új projekciós logika eleve típusos modulba kerül |
| 5. feladat: Python adapter (PY-03…) | PAUSE SAFELY | az epic csak azt kéri, hogy az új v3/IR megoldás ne akadályozza a behúzásos nyelveket; a Python-státusz változatlan: PY-01/02 parser-szelet, PY-03+ nyitott |
| Böngészős workbench-flake (`'class-name'`, Prism) | INTEGRATE → EPIC-09 | önmagában 3/3 zöld; a végső böngészős körben kivizsgálandó |

**Érvénytelenné vált feltevés:** a v8 nem teljesíti az epic 1–7. elfogadási feltételét. A `CopyFieldUtilityService` mért állapota a `76382c7`-en: minden vizsgált csere elutasított (5↔6↔7, 248↔249, 305↔306). A kihagyott blokkok száma 8, ez négy `if / } else { / }` pár.

## EPIC-01 – architekturális térkép

`forrás → adapter.parse (TS AST) → statement-ordering + type-member-ordering (kötés, hatás) → OrderingRelations → generator.mjs projekció (blokkmegtartás, scope, functionBlock, lezárás, redukció, elhagyott blokkok soros láncai) → CodeLine v2 → compileCodeLineExercise (séma, admission) → compileDefinition (élek: dependencies + scope open/close + edges; profilok OR) → validateSubmission (tartalomalapú bijekció, MRV DFS, közös keret)`

| Hol | Mi keletkezik |
| --- | --- |
| `statement-ordering.ts` | szemantikai élek (barrier/pure/position-free, védett olvasás, globális lánc) |
| `type-member-ordering.ts` | tagszintű élek (definíció, fázis, kulcslánc) |
| `generator.mjs` | **technikai korlát:** a közös fizikai sorú blokkok (`} else {`) elhagyása és sorosítása; lezárás (ADR-009); tranzitív redukció; alapértelmezett „forrásbeli előd” él a nem listázott sorokra |
| `model.ts` | szerkezeti élek: blokk-nyitó → tag → blokk-záró, nyitó → záró |
| `code-line-v3.ts` | v3: unitok, konténerek, határesemények (közös határ natívan kifejezhető) |
| `dependency-refresh.ts` | explicit újragenerálás importált modellre |

**Baseline (`76382c7`):**

- `check:all`: 577/577; `test:browser:all`: 114 PASS, egy időszakos workbench-hibával.
- Korpusz (61 fixture): 0 hibás elfogadás, rések K45/W9/R7 = 6/7/20.
- Generatív kampány (550 program, ~411 000 sorrend): 0 hibás elfogadás, 2 455 rés.

## Feladatlista (függőségi sorrendben)

Jelölés: ✅ kész és ellenőrzött · 🔄 folyamatban · ⏳ következik · ⛔ blokkolt.

| # | Munkacsomag | Állapot | Elfogadási bizonyíték |
| --- | --- | --- | --- |
| B1 | EPIC-02.2: lokális írás-/olvasási halmazok, RAW/WAR/WAW konfliktusélek, `local-write` egység | ✅ | a 248↔249 csere elfogadott a teljes fájlból generált modellen; a 305↔306 (`UUID()`) elutasított; korpusz és kampány: 0 hibás elfogadás |
| B2 | EPIC-03: közös fizikai határok (`} else {`, `} catch {`, `} finally {`) klauzulaláncként, szeparátorélekkel; a projekció típusos modulba kerül | ✅ | 0 elhagyott blokk a CopyField négy `if/else`-párjánál; v2/v3 kompatibilitás; architektúrakapu |
| B3 | EPIC-02.1: importelemzés explicit emit-kontextussal (`import type`, specifier-`type`, csak típusként használt, mellékhatás-import, értékimport) | ✅ | az 5–7. sor döntése mindkét emit-kontextusban tesztelve; értékimport és mellékhatás-import kötött |
| C1 | EPIC-04: proveniencia az `OrderingRelations`-ben és a modell `authoring` metaadatában; örökölt vagy ismeretlen kategória | ⏳ következik | minden generált élnek van kategóriája; a régi modellek „örökölt” jelölést kapnak |
| D1 | EPIC-05: típusos szerzői szabályműveletek, atomikus admission, refresh a kézi szabályok megőrzésével | ⏳ | szabályeditor-regressziók (09.3) |
| D2 | EPIC-05: vizuális szabálypanel a szerzői felületen | ⏳ | Playwright-bizonyíték |
| E1 | EPIC-06: core diagnosztikai modul (bizonyított konfliktusok, többértelműség, keret) | ⏳ | diagnosztikai regressziók (09.4), metamorf: a validátor döntése változatlan |
| F1 | EPIC-07: tanulói visszajelzés és soronkénti jelölés | ⏳ | böngészőteszt, hozzáférhetőség |
| F2 | EPIC-08: disclosure policy (szerző / Pages / trusted szerver) | ⏳ | negatív szivárgási tesztek |
| G1 | EPIC-09/12: teljes regresszió, kampány, böngésző, dokumentáció, végső jelentés | ⏳ | `check:all`, `test:browser:all`, `git diff --check` |

## Döntésnapló

- (EPIC-00) A közös blokkhatár v2-ben pontosan kifejezhető: a klauzulalánc egyetlen megtartott konténer, a belső `} else {` sorok szeparátorok. Egy szegmens sorai a következő szeparátor előtt, a következő szegmens sorai utána állnak. Ez ugyanazt a nyelvet fogadja el, mint a v3 határeseményes reprezentáció, ezért a v2 → v3 projekció is pontos lesz; natív JS/TS → v3 út nem szükséges ehhez.

## B szakasz (B1–B3) – lezárva

**Döntés:** [ADR-013](adr/013-local-writes-clause-chains-and-imports.md).

**Bizonyíték:**

- **`CopyFieldUtilityService`:** 8 → 0 elhagyott blokk; a 248↔249 csere elfogadott; a 305↔306 (`UUID()`) és a 251↔252 csere elutasított; az importok mindkét emit-kontextusban az emit szerint döntődnek el ([local-write-ordering.test.mjs](../tests/local-write-ordering.test.mjs), [import-ordering.test.mjs](../tests/import-ordering.test.mjs)).
- **Korpusz** (64 fixture) és **generatív kampány** (560 program): 0 hibás elfogadás; a rések száma 2 072 → 1 959 ([formális szerződés](formal-ordering-contract.md#adr-013-lokális-írások-klauzulaláncok-és-importok)).

**Ellenőrzés:** `check:all` 596/596, `test:browser:all` 114 PASS, `git diff --check` tiszta. A `20-shared-boundaries` minta elvárása tudatosan frissült (3↔4 elfogadott), mert a korábbi elutasítás a sorosító `} else {` kezelésből jött, nem szemantikai szabályból.

**Policy-változás:** a P2 pontosítva: a lokális írás csak konfliktus esetén kötött. A független orákulum saját implementációval követi.

**Nyitott, a későbbi szakaszokba integrálva:**

- **D2:** a szerzői felületen még nincs `importEmit`-választó; az alapértelmezés a konzervatív `verbatim`.
- **C1:** a proveniencia (miért kötött egy él) még nem tartós.
