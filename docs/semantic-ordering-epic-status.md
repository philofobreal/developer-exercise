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

Jelölés: ✅ kész és ellenőrzött · 🔄 folyamatban · ⏳ következik · ⏸ felfüggesztve · ⛔ blokkolt.

| # | Munkacsomag | Állapot | Elfogadási bizonyíték |
| --- | --- | --- | --- |
| B1 | EPIC-02.2: lokális írás-/olvasási halmazok, RAW/WAR/WAW konfliktusélek, `local-write` egység | ✅ | a 248↔249 csere elfogadott a teljes fájlból generált modellen; a 305↔306 (`UUID()`) elutasított; korpusz és kampány: 0 hibás elfogadás |
| B2 | EPIC-03: közös fizikai határok (`} else {`, `} catch {`, `} finally {`) klauzulaláncként, szeparátorélekkel; a projekció típusos modulba kerül | ✅ | 0 elhagyott blokk a CopyField négy `if/else`-párjánál; v2/v3 kompatibilitás; architektúrakapu |
| B3 | EPIC-02.1: importelemzés explicit emit-kontextussal (`import type`, specifier-`type`, csak típusként használt, mellékhatás-import, értékimport) | ✅ | az 5–7. sor döntése mindkét emit-kontextusban tesztelve; értékimport és mellékhatás-import kötött |
| C1 | EPIC-04: proveniencia az `OrderingRelations`-ben és a modell `authoring` metaadatában; örökölt vagy ismeretlen kategória | ✅ (életciklus: C2) | minden generált élnek van kategóriája; a régi modellek „örökölt” jelölést kapnak |
| A2 | Formális szerződés: verziózott policy-táblázat (P2 a v1–v8 és a v9 között), a megfigyelhető állapot definíciója, hatókörhöz kötött soundness és completeness, reprezentálhatóság | ✅ | a szerződés és az orákulum ugyanazt a megfigyelést nevezi meg; minden policycímkéhez tartozik szabályverzió |
| C2 | Bizonyíték-életciklus és elemzési környezet: `authoring.evidence` (forrásdigest, elemző- és policyverzió, TypeScript-verzió, import-emit, script/modul, osztálymezőmód-feltevés). Eltérő forrásnál a proveniencia `stale`; a magyarázat és minden szerkesztési döntés ezt tiszteletben tartja | ✅ | a JSON-ban átírt kódsor után egyetlen ok sem számít érvényesnek; a refresh újraköti |
| R1 | Referenciaaudit szintjei: szintaktikai; egyfájlos szemantikai (TypeScript `Program`-diagnosztika lib-bel, Node-on); „nem ellenőrizhető”, ha hiányzik a projektkontextus (feloldatlan import). Az eredmény az evidence része; a Pages explicit „nem ellenőrzött” | ✅ | típushibás referencia jelölése; a feloldatlan import nem „helyes”, hanem „nem ellenőrizhető” |
| V1 | Model Verification Gate: befogadás, referencia-elfogadás, keretalkalmasság (a referencia és a szomszédság a produkciós kereten belül), a proveniencia lefedettsége és frissessége, a konzervatív és reprezentációs fallbackek helye, lazítások, audit, környezet. Ezekből minősítési státusz: elemzéssel igazolt / konzervatív / szerzői döntéssel módosított / nem igazolt. Kis modellnél a projekció kimerítő összevetése az adapter relációival | ✅ | minősítési regressziók; a CopyField és a legacy modellek státusza indokolt |
| D1 | EPIC-05: típusos szabályműveletek: atomikus befogadás, profilok, fixed, megjegyzések, lazítás megerősítési szintekkel, hatásjelentés tanúsorrenddel. Minden szerkesztés után V1-újraminősítés. A refresh jelentve vezeti össze a szerzői szabályokat, a lazításokat és a megjegyzéseket | ✅ | szabályeditor-regressziók (09.3) |
| D2 | EPIC-05: vizuális szabálypanel, `importEmit`-választó és a minősítés megjelenítése a szerzői felületen | ✅ | Playwright-bizonyíték |
| U1 | A szerzői és a próbanézetek egyszerűsítése: léptetéses folyamat, egyetlen aktív állapottal, egyértelmű állapotkapcsolattal és frissítéssel a nézetek között | ✅ | állapotgép-egységtesztek, Playwright-átjárási tesztek minden lépésváltásra, újragenerálásra és frissítésre |
| E1 | EPIC-06: core diagnosztikai modul (bizonyított konfliktusok, többértelműség, keret) | ✅ | diagnosztikai regressziók (09.4), metamorf: a validátor döntése változatlan |
| F1 | EPIC-07: tanulói visszajelzés és soronkénti jelölés | ✅ | böngészőteszt, hozzáférhetőség |
| F2 | EPIC-08: disclosure policy (szerző / Pages / trusted szerver) és szerveroldali szerzői jogosultság, vagy explicit, dokumentált helyidemó-korlát | ✅ | negatív szivárgási és jogosultsági tesztek |
| G1 | EPIC-09/12: teljes regresszió, kampány, böngésző; forráshűségi round-trip (forrás → modell → render → export/import); a szerzői elemzés idő- és memóriakerete; dokumentáció, végső jelentés | ⏳ | `check:all`, `test:browser:all`, `git diff --check` |

## Kritikai felülvizsgálat és újratervezés (2026-10-26)

A felhasználó a MASTER EPIC-ről kritikai elemzést adott át. Az alábbi tábla minden pontját a repository tényleges állapotával veti össze. Állapot: ✅ már teljesül · 🟡 részben teljesül · ❌ nem teljesül.

| Pont | Állapot | Döntés |
| --- | --- | --- |
| P2-ellentmondás (EPIC-01 kontra EPIC-02, -12) | ✅ a kódban, 🟡 a szerződésben | **Kódban feloldva:** az ADR-013 explicit, verziózott (`v9`) P2-pontosítás, az orákulum független saját implementációval követi, nem gyengített teszt. **Hiányzik:** a policyverziók táblázata és a megfigyelhető állapot pontos definíciója → A2 |
| `A(G(P)) = E_policy(P)` túl erős | 🟡 | A szerződés már résznyelvre korlátozott soundnesst állít. Pontosítani kell: a completeness csak a kezelt **és** reprezentálható konstrukciókon kötelező, az `indeterminate` külön státusz, az elfogadási halmaz pedig a szabályverzióhoz és a mozgatási tartományhoz kötött → A2 |
| Referencia teljes nyelvi auditja | ❌ | Az `audit.mjs` szintaktikai, a `bindingChecker` `noLib`/`noResolve`. Új munkacsomag → R1 |
| Model Verification Gate | ❌ | A befogadás csak alakot, gráfot és referenciát ellenőriz. Új munkacsomag → V1. Tetszőleges forrás futtatása továbbra sincs; a kimerítő ellenőrzés a projekciót veti össze az elemzés relációival, nem a programot futtatja |
| Szemantikai újraminősítés szabálylazítás után | 🟡 | A félkész D1 rögzíti a lazításokat (`relaxations`, `conformance`), de a minősítés a V1-re épül, és a döntés helyessége a proveniencia érvényességén múlik → D1 felfüggesztve; C2 és V1 után folytatódik |
| Effektív fordítási környezet | 🟡 | Az `importEmit` létezik, de nincs a modellhez kötve; a többi feltevés (script/modul, osztálymezőmód, TS-verzió) nincs rögzítve → C2 |
| Reprezentációs alkalmassági vizsgálat | 🟡 | Az ADR-013 igazolta, hogy a klauzulalánc a v3-mal azonos nyelvet fogad el. A szabadság vetítés közbeni elvesztése generáláskor viszont nincs mérve → V1 (projekciós veszteség) |
| Proveniencia-életciklus | ❌ | A C1 okai nincsenek forrás-, elemző- és környezetverzióhoz kötve. Egy JSON-ban átírt kódsor mellett elavult okok maradnának, és ezek alapján a D1 megerősítés nélkül engedne törölni egy bizonyított élt. **Ez a D1 biztonsági előfeltétele** → C2 |
| Szerveroldali szerzői jogosultság | ❌ | A szerver szerzői API-ja hitelesítés nélküli helyi eszköz → F2: szerveroldali kapu, vagy dokumentált korlát, de nem elkészült biztonsági funkcióként |
| Forráshűség és szerzői teljesítmény | 🟡 | Az exact-whitespace és az 500 soros validáció tesztelt; a teljes round-trip és a szerzői elemzés kerete nem → G1 |

**Visszamenőleges értékelés:**

- **B szakasz:** megfelel az új szempontoknak. A P2 explicit, verziózott továbbfejlesztés lett, nem csendes gyengítés, és az orákulum függetlenül követi.
- **C1:** a javasolt sorrendnek megfelelően a szerkesztő és a diagnosztika előtt készült el, de életciklus nélkül. Ezt a C2 pótolja, nem újraírással, hanem a meglévő okok verzióhoz kötésével.

**Új sorrend:** A2 → C2 → R1 → V1 → D1 → D2 → E1 → F1 → F2 → G1. A D2 után közbeiktatva: D2 → **U1** → E1 → F1 → F2 → G1 (lásd az U1 szakaszt a dokumentum végén).

**A D1 felfüggesztése:** a félkész munka a `stash@{0}` „D1 WIP: typed rule edits…” bejegyzésében van; csak saját fájlok, a felhasználói snapshot nélkül. Tartalma:

- `src/core/rule-editing.ts`: `applyRuleEdits`, `mergeAuthorRules`;
- `ruleNotes`, `relaxations` és `conformance` a sémában, a típusban és a magyarázatban.

A C2 és a V1 után `git stash pop`, majd ütközésfeloldással folytatódik.

**Feloldva (D1):** a stash tartalma a `7af9b20` commitba került, a bejegyzés törölve.

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
- **C1:** a proveniencia (miért kötött egy él) még nem tartós. → lezárva (ADR-014).

## C1 – proveniencia – lezárva

**Döntés:** [ADR-014](adr/014-constraint-provenance.md).

**Megvalósítás:**

- **Okok az elemzésben:** az `OrderingEntry.reasons` mezőt a `statement-ordering.ts` és a `type-member-ordering.ts` tölti ki.
- **Okok a projekcióban:** a `code-line-projection.ts` a saját éleihez is okot rögzít, és a redukció után megmaradt élek okait `provenance` listaként adja vissza.
- **Modell:** a generátor ezt `authoring.provenance` mezőként menti.
- **Core:** az `explainConstraints` a modell alapján magyaráz.

**Bizonyíték:**

- A korpusz minden fixture-ében és a teljes `CopyFieldUtilityService`-ben minden függőségnek van ismert kategóriájú oka. A CopyField 451 függősége 582 okkal szerepel, `unknown` nélkül.
- A 248/249. sor előzménye `data` / `binding-input`, a 306. soré `effect` / `ExpressionStatement`, a `} else {` soré `structure` / `clause-*`.
- A régi modellek `legacy` jelölést kapnak.
- A proveniencia elhagyása vagy átírása egyetlen ítéletet sem változtat meg (metamorf teszt).

**Szerkeszthetőségi osztályok:**

| Osztály | Kategóriák |
| --- | --- |
| `hard` | `structure`, `unit` |
| `proven` | `data`, `effect`, `policy` |
| `conservative` | `conservative` |
| `pedagogical` | `author` |
| `legacy` | `unknown` |

**Nyitott, a későbbi szakaszokba integrálva:**

- **D1:** a kézi szabályok `author` okkal kerülnek a modellbe; a refresh megőrzi őket. Jelenleg a megtartott eredeti él `unknown`.
- **E1:** a profilélek (OR) magyarázata.
- **F1:** a kódok magyar megjelenítése.
- **F2:** a proveniencia a trusted gráf része, ezért a tanulói kliens nem kaphatja meg.

## A2 – formális szerződés – lezárva

A [formális szerződés](formal-ordering-contract.md) három új része:

- **[A helyességi cél hatóköre](formal-ordering-contract.md#a-helyességi-cél-hatóköre):**
  - soundness kötelező a résznyelven;
  - completeness kötelező a felsorolt, kezelt és reprezentálható eseteken;
  - minden más jelölt fallback;
  - az `indeterminate` külön státusz;
  - minden állítás a feladattartományhoz, a szabályverzióhoz és a szerzői módosításokhoz viszonyított.
- **[Megfigyelhető állapot](formal-ordering-contract.md#megfigyelhető-állapot):** pontosan az, amit az orákulum összevet (eredmény, kivétel, hatásnapló, reflektált szerkezet, statikus szerkezet). Ide tartozik a nem megfigyelt dolgok listája, a futtatási környezet és egy ismert orákulumkorlát: kivételnél a hatásnapló nincs összevetve.
- **[Policyverziók](formal-ordering-contract.md#policyverziók):** minden címkéhez döntés és P2/P4-változás tartozik. A v9 P2-je verziózott, szigorúan bővebb újradefiniálás, nem csendes gyengítés.

Új feltevés: **A5** (futtatási környezet).

**Következik:** C2. → lezárva.

## C2 – bizonyítékkötés és elemzési környezet – lezárva

**Döntés:** [ADR-015](adr/015-evidence-binding-and-analysis-environment.md).

**Megvalósítás:** a modell `authoring.evidence` mezője tartalmazza:

- a sorok `[id, code, scopeId]` digestjét;
- a szabályverziót;
- a környezetet: TypeScript-verzió, import-emit, script/modul, `classFields: either`.

**Működés:**

- **Kötés:** a magyarázat csak egyező digestnél használja a provenienciát, különben `unbound`, és minden ok `legacy`. Így a D1 biztonsági döntése nem épülhet elavult okra.
- **Egyetlen definíció:** a digest csak a core-ban van, a projekció explicit architektúra-bekötéssel hívja.
- **Refresh:** a refresh újraköt.

**Bizonyíték:**

- [evidence-binding.test.mjs](../tests/evidence-binding.test.mjs): átírt, átszámozott és leválasztott eset; a fixed és a szabályok nem oldják a kötést; metamorf validáció; séma; refresh; architektúra.
- `check:all` 613/613, `test:browser:all` 114 PASS, `git diff --check` tiszta.

**A D1 folytatásához:** a `stash@{0}` kódkommentjei még „ADR-015”-öt említenek a szabályszerkesztésre. Folytatáskor a szabályszerkesztés ADR-je a következő szabad szám lesz, és a kommenteket ehhez kell igazítani.

**Következik:** R1, a referenciaaudit szintjei. → lezárva.

## R1 – a referencia nyelvi auditja – lezárva

**Döntés:** [ADR-016](adr/016-reference-language-audit.md).

**Megvalósítás:** `createReferenceAuditor(ts, library?)`, egyfájlos TypeScript `Program` a szabványos könyvtárral, porton át.

| Eredmény | Jelentés |
| --- | --- |
| `ok` | nincs diagnosztika ebben az egyfájlos kontextusban |
| `errors` | biztos nyelvi hiba |
| `unverifiable` | csak hiányzó kontextusra visszavezethető diagnosztika, a modulok listájával |
| `not-run` | nincs szabványos könyvtár |

**Működés:**

- **Szerver:** minden befogadásnál fut. Az eredmény a válasz része, a modellbe nem kerül, importból nem vehető át.
- **Pages:** `not-run`.

**Bizonyíték:**

- [reference-audit.test.mjs](../tests/reference-audit.test.mjs): hibák, `ok`, kontextushiány, CopyField (11 feloldatlan import, `unverifiable`), dekorátormód, `not-run`, lib-port szűkítése és gyorsítótár, szerverválasz.
- A Pages API-teszt is ellenőrzi.
- `check:all` 621/621, `test:browser:all` 114 PASS, `git diff --check` tiszta.

**Nyitott:**

- **Többfájlos projektkontextus:** saját `tsconfig`, `node_modules`, path mapping; jelenleg nem adható meg, ezért `unverifiable`.
- **Megjelenítés:** a D2 feladata.
- **Minősítés:** a V1 feladata.

**Következik:** V1, a Model Verification Gate. → lezárva.

## V1 – Model Verification Gate – lezárva

**Döntés:** [ADR-017](adr/017-model-verification-gate.md).

**Megvalósítás:**

- **Projekciós veszteség:** generáláskor, `evidence.projectionLoss`.
- **Újralevezetés:** a `verifyAuthorModel` összeveti a modellt az újragenerálással; a függőségeknek, a nem szerzői éleknek és okoknak pontosan egyezniük kell.
- **Core gate:** `verifyModel`. Státusz (`analysis-verified` / `conservative` / `author-modified` / `unverified`), `publishable` jelző, valamint `checked` / `tested` / `not-established` / `refuted` állítások.
- **Bekötés:** a szerver és a Pages minden draftnál futtatja, és a megbízható példáknál is rögzíti.

**Bizonyíték:**

- [model-verification.test.mjs](../tests/model-verification.test.mjs): `analysis-verified`, fallback, veszteség, CopyField, kézi módosítás, hamisított ok, legacy, `fixed` és profil, nyelvi hiba, keret, a csak core-ból futó gate és a szerver.
- A Pages API-teszt is ellenőrzi.
- `check:all` 629/629, `test:browser:all` 114 PASS, `git diff --check` tiszta.

**Eloszlás:**

| Készlet | Eredmény |
| --- | --- |
| `examples/` (5) | mind `unverified` (proveniencia nélküli, régi modellek), de publikálható |
| TS-mintatár (26 modell) | 17 `analysis-verified`, 4 `conservative` (számított mező, overloadok, kommentek, beágyazott típus; projekciós veszteség 1–3 pár), 1 `author-modified` (`fixed` és profilok), 4 `unverified` |
| CopyField | `conservative`, publikálható, nyelvileg `unverifiable`, projekciós veszteség 0 |

A 4 `unverified` minta: a soros legacy modell, a kézi `values-only` szerződés és két mintán talált nyelvi hiba.

**A gate által talált valódi hibák:**

- **`13-duplicate-names`:** duplikált interfésztag, TS2300. Szándékos hibaeset.
- **`23-parameter-property`:** szkriptfájlban a `class Parameters` ütközik a szabványos könyvtár globális `Parameters<T>` típusával (TS2300, TS2693). A minta szkriptként nem fordítható; a javítás külön döntés (átnevezés vagy modullá alakítás), mert a minta várt sorrendjeit is érinti.

**Nyitott:**

- A katalógus nem tilt `unverified` modellt; az éles publikálási politika az F2 része.
- A gate megjelenítése a D2 része.
- A lazítások bekötése a D1 folytatásakor történik.

**Következik:** D1 folytatása (`git stash pop`), a gate-tel való újraminősítéssel; ADR-018. → lezárva.

## D1 – típusos szabályműveletek – lezárva

**Döntés:** [ADR-018](adr/018-typed-rule-editing.md).

**Folytatás a stash-ből:**

- a `stash@{0}` munkája visszaállt, az ütközéseket feloldottam (séma, típus, magyarázat, index);
- az ADR-hivatkozás 018 lett;
- a magyarázat `conformance` mezője megszűnt, a minősítés a gate dolga.

**Megvalósítás:**

- **Műveletek:** `applyRuleEdits` (atomikus köteg, szerkeszthetőség szerinti biztonság, rögzített lazítás, hatásjelentés tanúsorrenddel).
- **Szerkesztés:** az `editAuthorModel` minden szerkesztés után újraminősít. Lazítás után `unverified`, szerzői szűkítés után `author-modified`; az újralevezetés levonja a rögzített lazításokat.
- **Refresh:** a `refreshAuthorModel` és a `mergeAuthorRules` jelentéssel együtt viszi át a szabályokat; az eredeti proveniencia csak kötött állapotban dönt.

**Bizonyíték:**

- [rule-editing.test.mjs](../tests/rule-editing.test.mjs), 12 eset: hozzáadás és eltávolítás, tranzitív, kör, a referencia ellen, atomikus köteg, pedagógiai és redundáns eltávolítás, `hard` / konzervatív / bizonyított, kötetlen proveniencia, `fixed`, OR-profilok (őszinte `maybe`), megjegyzések, újraminősítés, refresh `reapplied` / `revoked` / legacy / felülírt esettel, v2-kompatibilitás és JSON-oda-vissza.
- `check:all` 641/641, `git diff --check` tiszta.

**Böngészős futás:** a teljes kör 114/114 PASS (a második futás).

- **Javított tesztkörnyezeti hiba:** a tesztek statikus szervere 5 elemű kapcsolatsorral futott. Ezért a bővülő ES-modulgráf egy részét Windowson `ERR_CONNECTION_REFUSED` hibával elutasította, és a TypeScript-es Pages-teszt reprodukálhatóan elbukott. A közös `StaticServer` (`tests/browser_support.py`, sorhossz 128) mind a hat tesztkörnyezetben ezt használja; a tesztek elvárásai nem változtak.
- **Régebbi flake:** a mátrix valódi egeres és érintéses beszúrási esete terhelés alatt időnként elbukik. Ez a C1-korabeli `e8e5694`-n is kimutatható (5 futásból 4 hiba), tehát nem ennek a munkának a következménye. A tesztet nem gyengítettem; a kivizsgálás a G1 része.

**Nyitott:**

- **D2:** szabálypanel, `importEmit`-választó, a gate és a refresh-jelentés megjelenítése.
- **F2:** szerveroldali szerzői jogosultság.
- **G1:** a drag-and-drop flake kivizsgálása, valamint a `23-parameter-property` minta fordíthatósága.

**Következik:** D2 (lásd a lezárási pontot).

## Lezárási pont (2026-10-26, D1 után)

A felhasználó kérésére a munka itt lezárul: minden elkészült rész a `main` ágon van és pusholva. Nincs nyitott feature-ág (a régi `codex/audit-workbench-release` a `main`-be olvadt, a távoli ága már törölve volt, a helyi is törölve). Nincs stash, worktree vagy háttérmunkamenet. A working tree-ben csak a felhasználói `project-snapshot.md` marad, amely szándékosan nincs verziókezelve. Az epicet innen az alábbi hátralékkal lehet újraindítani.

### Ami kész

Az A2, B1–B3, C1, C2, R1, V1 és D1 a teljes **háttér-alap**:

- a P2 verziózott pontosítása (v9);
- lokális írások, klauzulaláncok, importok;
- proveniencia, és annak forráshoz kötése;
- referenciaaudit;
- minősítési kapu;
- típusos, újraminősített szabályszerkesztés.

Utolsó ellenőrzés: `check:all` 641/641, `test:browser:all` 114/114, `git diff --check` tiszta.

### Ami hátra van (az epic sorrendjében)

| # | Tartalom | Mi múlik rajta |
| --- | --- | --- |
| D2 | vizuális szabálypanel az `applyRuleEdits` / `editAuthorModel` / `explainConstraints` fölött; `importEmit`-választó; az audit, a minősítés és a refresh-jelentés megjelenítése; escape-elt megjegyzésszöveg; Playwright-bizonyíték | Az API már visszaadja az `audit`, a `verification` és a `refresh` mezőt, de **a felület még semmit nem mutat belőlük**. A szerző ma csak a JSON-szerkesztőben szerkeszthet, ott nincs biztonsági és hatáskontroll. |
| E1 | core diagnosztikai modul: bizonyított konfliktus, többértelműség, keretkimerülés, profilmagyarázat; a validátor ítéletét soha nem változtatja | A „magyarázható validáció” fele hiányzik. |
| F1 | magyar tanulói visszajelzés, soronkénti jelölés, hozzáférhetőség, elavult diagnózis érvénytelenítése | A tanuló ma csak elfogad / elutasít / `indeterminate` választ kap. |
| F2 | disclosure policy (szerző / Pages / trusted szerver); szerveroldali szerzői jogosultság, vagy dokumentált helyidemó-korlát; döntés arról, hogy a katalógus tiltson-e `unverified` modellt | lásd a kockázatokat |
| G1 | teljes regresszió és kampány; forráshűségi round-trip; a szerzői elemzés idő- és memóriakerete; végső jelentés; a drag-and-drop flake; a `23-parameter-property` minta | — |

Az epic címadó, látható része (vizuális szabályszerkesztő, magyarázható validáció) tehát **még nincs kész**; csak az alapja készült el.

### Ismert problémák és kockázatok

1. **Hitelesítés nélküli szerzői API.** A szerver szerzői végpontjai helyi eszközként, jogosultság nélkül futnak. Nyilvános hálózatra így nem tehetők ki (F2).
2. **A minősítés csak tájékoztató.** A katalógus `unverified` modellt is kiszolgál. Mind az 5 `examples/` modell `unverified` (proveniencia nélküli, régi modellek), de publikálható. A szabályaik csendes átírása tilos, csak explicit refresh köti őket (F2).
3. **Egyfájlos referenciaaudit.** Valódi projektfájl (pl. CopyField: 11 feloldatlan import) soha nem kap `ok`-t, csak `unverifiable`-t. Saját `tsconfig`, `node_modules` és path mapping nem adható meg. A Pages-ben az audit `not-run`.
4. ~~**`23-parameter-property` minta.**~~ Megoldva (G1.1): az osztály neve `Point`, a minta szkript maradt; a modell függőségei és sorrendje változatlan, csak a kódszöveg és a forráskivonat.
5. ~~**Mátrix drag-and-drop flake.**~~ Megoldva (G1.2): a teszt a beszúrási határra, a sor középvonalára célzott. A valódi egeres és érintéses beszúrás terhelés alatt időnként elbukik. Ez a D1 előtt is így volt (`e8e5694`: 5 futásból 4 hiba). A teszt nincs gyengítve, a hiba nincs kivizsgálva.
6. **Proveniencia-plafon.** 10 000 oknál nagyobb modellnél a generátor nem ment provenienciát. Ilyenkor a magyarázat `absent`, a gate `unverified`-et ad, és minden generált szabály törlése policy-felülírást kér. Ez biztonságos irányú, de nincs jelezve a szerzőnek (D2).
7. **Régi, evidence nélküli modellek.** A proveniencia `unbound`, ezért szerzői szabály eltávolításához is policy-felülírás kell, amíg egy refresh meg nem köti a modellt. Ez helyes, de a felületen még nincs megmagyarázva (D2).
8. **A hatásjelentés korlátos.** A `maybe` őszinte eldöntetlenség: a tanúkeresés alternatívánként legfeljebb 17 célzott sorrendet próbál.
9. **Orákulumkorlát (A2).** Kivétellel végződő futásnál a hatásnapló nincs összevetve. A soundness-állítás ennyivel gyengébb.
10. **Projekciós veszteség.** A korpuszban 8 pár, 4 mintán 1–3 pár. Ezek `conservative` státuszt kapnak: a v2 reprezentáció itt szigorúbb, mint az elemzés.
11. **Fordítási sorrendhez kötött bekötés.** A `code-line-projection.ts` a lefordított `dist/index.js`-ből importálja a digestet (explicit architektúra-szabály). A forrásfa csak `build` után konzisztens.

### Ami szándékosan kimaradt vagy szünetel

- **Python adapter:** PY-01/02 parser-szelet kész, PY-03+ szünetel. Az új reprezentáció nem akadályozza.
- **A generátor teljes TS-migrációja (ADR-001 P4):** a projekció típusos modulba került, a `generator.mjs` továbbra is átmeneti JS.
- **v3 natív út:** nem szükséges, a v2 klauzulalánc ugyanazt a nyelvet fogadja el.
- **Futtatásalapú ellenőrzés tetszőleges forrásra:** szándékosan nincs. Production kiértékelés nem parse-ol és nem futtat tanulói kódot, és runtime AI sincs.

### Helyi, nem verziókezelt maradványok

- 68 db, `.gitignore` által kizárt `*.log` fájl a repó gyökerében (2026-10-24, korábbi auditfutások).
- `_site/`, `dist-tools/`, `test-results/`, `.venv/`, `node_modules/`.

Ezek nem ennek a munkának a termékei, ezért nem töröltem őket. A `*.log` fájlok nyugodtan törölhetők.

## Javítás a lezárás után: tiszta egység és hatás-barrier (ADR-019, v10)

**Bejelentés:** a felhasználói képen a `binarySearch` két első sorának cseréje (`let high = sorted.length - 1;` ↔ `let low = 0;`) „Hibás” lett, holott a két sor sorrendje közömbös.

**Diagnózis:**

- A könyvtári, kézzel hangolt modell (`examples/algo-sort-search-js.json`) és a futás is elfogadja a cserét: a core validátor, a szerver és az élesített Pages is.
- A hiba a szerzői „Alkalmazás → Rendezés” útján jön elő, amely a forrásból **generált** modellt használja. A v9 P2 minden tiszta egységet minden barrierhez kötött, a `sorted.length` pedig property-olvasás (getter lehet), tehát barrier.
- Ugyanez okozta az `insertionSort` `current`/`j` cseréjének elutasítását; ott ráadásul az `i - 1` sem számított tisztának.

**Javítás:** [ADR-019](adr/019-pure-effect-commutation.md).

- **Generátor:** a pontosított P2 a [statement-ordering.ts](../src/author/statement-ordering.ts) fájlban.
- **Orákulum:** független követés a [semantic-oracle.mjs](../tests/support/semantic-oracle.mjs) fájlban.
- **Tesztek:** [pure-effect-commutation.test.mjs](../tests/pure-effect-commutation.test.mjs) (9 eset, mindegyik a generátorral és az orákulummal is).
- **Ellenőrzés:** böngészőben, helyben, szerzői előnézettel: a képen látható sorrend elfogadott.

**A mintapéldák teljes átvizsgálása:**

- **Módszer:** minden testvérlista minden permutációja, legfeljebb 6 egységig, futásidejű orákulummal, a kézi és a generált modellel.
- **Eredmény:** egyik modell sem fogad el hibás sorrendet.

A generált modell még ekvivalensként elutasítja:

| Példa | Elutasított, de ekvivalens | Ok |
| --- | --- | --- |
| `algo-sort-search-js` | a két függvény sorrendje | P4: szkriptszintű globális kulcssorrend (`Object.keys(globalThis)`) |
| `algo-sort-search-js` | a két `if` cseréje | a `return`-t tartalmazó ág vezérlésátadás (a kézi modell is elutasítja) |
| `algo-bfs-js` | a deklarációk egy része, a célellenőrzés a szomszédok után | paraméter-property olvasása (`grid.length`, `start.join`) |
| `class-inventory-ts`, `class-accounts-ts` | metódus- és konstruktorsorrend, `this.balance` / `this.history` frissítés | P4 prototípus-kulcssorrend, illetve `this`-property írása és hívás |

A kézi `class-inventory-ts` modell a konstruktort a mező után, a metódusokat a konstruktor után köti. Ez a P4-nél is szigorúbb. A kézi `algo-sort-search-js` leírása pedig szabad függvénysorrendet ígér, amit a generált modell a P4 miatt nem tart be.

## Policydöntés: a metódusok és a felső szintű függvények sorrendje szabad (ADR-020, v11)

**A felhasználó döntése (2026-10-27):** a felső szintű függvények és az osztálymetódusok sorrendje legyen szabad, a példánymezőké maradjon kötött.

**Megvalósítás:** [ADR-020](adr/020-unobserved-key-order.md).

- **Generátor:** a kulcslánc és a függvények globális lánca csak akkor érvényes, ha a program maga listázhatja a kulcsokat (`observesKeyOrder`).
- **Orákulum:** független P4-követés.
- **Overload-csoport:** egyetlen metódusdefiníció.
- **A két kézi osztálypélda** revíziója 2 lett, a konstruktor és a metódusok szabadok.

**Talált és kezelt ellenpélda:**

- A `refl-explicit-property-names` program maga hívja az `Object.getOwnPropertyNames`-t. Ott a metóduscsere valódi futásidejű eltérés, ezért a reflektáló program a régi szabályt kapja.
- Az első implementáció egy szkripthiba miatt (backspace-karakter a regexben) ezt nem ismerte fel; a független orákulum és a korpuszteszt azonnal jelezte.

## D2 – szerzői szabálypanel – lezárva

**Döntés:** [ADR-021](adr/021-author-rule-panel.md).

**Megvalósítás:**

- **Szabálypanel a rendezőn:** csak a szerző saját előnézetében. A sor láncszem gombja megnyitja a panelt, a közvetlen előzmények és követők kiemelődnek. A panel mutatja a szabályok okát, szerkeszthetőségét és megjegyzését. Itt lehet szabályt felvenni és eltávolítani, megjegyzést írni és sort rögzíteni. Megjelenik a hatásjelentés tanúsorrenddel és a gate státusza is.
- **Megerősítés:** a szükséges szintet a core nevezi meg (`acknowledge`). Indoklás adható, amely a lazítással együtt a modellbe kerül.
- **Adatmodell:** minősítés, állítások, nyelvi audit, szerzői lazítások és refresh-jelentés.
- **Referenciaforrás:** `importEmit`-választó TypeScripthez.
- **API:** `POST /api/author/rules`, illetve Pages-ben `editRules`. A végpont a megbízható draft-másolatot szerkeszti, és a sikeres szerkesztés új draftot ad. Elutasításnál `ok: false` a válasz, és a draft érintetlen.

**Talált és javított hibák:**

- **Redundáns eltávolítás (D1):** egy bizonyított kényszer csak szerzői szabályok miatt számított redundánsnak, így megerősítés nélkül törlődött. A szerzői szabályok ezután szabadon eltávolíthatók voltak.
- **Refresh:** a refresh elhagyta a rögzített `importEmit`-et, így egy `elide-unused` modellből csendben `verbatim` lett.
- **Előnézet:** a szerver az előnézetet fix 1-es revízióval értékelte.

**Bizonyíték:**

- [author-rule-panel.test.mjs](../tests/author-rule-panel.test.mjs) (10 eset);
- Pages-adapter-eset;
- pontosított `rule-editing` eset;
- két új Playwright-eset Node és Pages módban; a workbench-csomag 33/33.

**Nyitott:**

- az OR-profilok szerkesztése a panelen (most csak a JSON-ban);
- a szerzői API jogosultsága (F2);
- a nézetek átalakítása (U1).

## U1 – a nézetek és az állapotátmenetek egyszerűsítése – lezárva

**Döntés:** [ADR-022](adr/022-stepwise-author-flow.md); a felület leírása: [UI/UX](ui-ux-workflows.md).

**Megvalósítás:**

- **Két mód:** Feladat készítése (kezdőoldal) és Gyakorlás.
- **Szerzői lépések:** Forrás → Szabályok → Próba, egy aktív lépéssel. A típusos `flow.ts` dönt a zárolásról, az elavulásról és a landolásról.
- **Szabályok lépés:** a vizuális szabálytábla (`rule-board.ts`) ívekkel és összekötéssel (egér, toll, érintés, billentyűzet), mellette a D2 panelje, alatta a minősítés. A JSON haladó alnézet.
- **Példák:** kezdőpontok a Forrás lépésben; a gyakorlásból „Saját feladat ebből a példából”.
- **Egy szerzői projekt** a feladatonkénti munkaterületek helyett (az ADR-004 ezen része felváltva).

**Kiegészítés (felhasználói kérés):** a próbarendezőben is ott vannak a soronkénti szabálygombok, az ívek (az aktuális elrendezésben, mozgatás után újrarajzolva) és a panel; a szerkesztés azonnal újraértékeli a kitöltést. Bizonyíték: workbench 41/41, `workbench-flow` 7.

**A felhasználó kérdésére:** a drag-and-drop felületen a függőségek ábrázolása és szerkesztése itt készült el. A szabálytábla íveket rajzol, és két sor körgombjának összehúzásával szabályt vesz fel.

**Talált és javított hibák:**

- a „Minősítés” blokk bezárult a JSON-nézetről való visszaváltáskor;
- a húzás utáni kattintáselnyelés bennragadhatott (Pages-módban reprodukálható volt);
- újratöltés után a helyi mentés nem lett volna elérhető a kezdőoldalról, ezért a Forrás lépés indulási sorába került.

**Bizonyíték:**

- `workbench-flow` (6) és az átírt `author-workspace` egységtesztek;
- workbench-böngészőcsomag 39/39;
- mátrix 32/32, drag 44/44;
- offline, szerveres v7, TypeScript, engine és Python csomag zöld.

### Az eredeti ütemezés (2026-10-27)

**Felhasználói kérés (2026-10-27):** a „01 · Referencia és szabályok” (Referenciaforrás, Adatmodell) és a „02 · Megoldás és próba” (Rendező, Megoldáskód) tabok között legyen egyértelmű átmenet és funkcionalitás. A felület legyen egyszerűbb és egységesebb. Lehet léptetéses, és egyszerre csak egy állapotban lehessünk, amíg egy kód- vagy tananyagpélda tesztje elkészül. Az oldalsó példalista POC/MVP szempontból zavaró.

**A jelenlegi állapot problémái (a kódból):**

- **Négy egyenrangú tab, közös rejtett állapottal:** `state.author`, `authorBaseline`, `modelDraft`, `authorModel`, `authorInsight`, `previews`, valamint feladatonkénti attempt-ek. Nincs explicit állapotgép: az, hogy melyik nézet melyik modellből indul, elszórt feltételeken múlik (`previews.has(active)`, piszkos jelzők).
- **Az oldalsó feladatkönyvtár és a saját előnézet ugyanabban a listában van:** a választás egyszerre vált referenciát, munkaterületet és próbát.
- **Átjáráskor nincs érvénytelenítés:** a forrás, a JSON vagy a szabályok változása után a többi nézet nem jelzi, hogy az ő állapota elavult. Ilyen a próba eredménye, az előnézet és a minősítés.

**Terv (ipari mintára: wizard / stepper, egyetlen forrás, explicit érvénytelenítés):**

1. **Állapotgép típusos modulban:** a lépések Forrás → Szabályok → Próba (→ Tanulói preview). A modul minden lépésnél megmondja, mi az aktív modell, és mi elavult. Egy lépés csak akkor érhető el, ha a bemenete érvényes. A visszalépés megmarad, a „piszkos” állapot explicit, és az alkalmazás megerősítést kér.
2. **Egyetlen igazságforrás:**
   - forrásszöveg és alkalmazott modell (draft);
   - minden származtatott állapot (JSON-nézet, szabálylap, minősítés, próba) az alkalmazott modellből és annak revíziójából számolódik;
   - változáskor a revízió alapján jelölődik elavultnak, nem a nézetek egymást frissítő mellékhatásaival.
3. **A példák kezdőpontok:** az oldalsó lista helyett az 1. lépésben „Indulás példából” választó. A gyakorlófeladat-mód (tanulói) külön belépési pont.
4. **A JSON-szerkesztő haladó eszköz a Szabályok lépésben;** a szabálypanel (D2) a Szabályok lépés fő felülete.
5. **Tesztek:**
   - állapotgép-egységtesztek minden átmenetre (alkalmazás, újragenerálás, refresh, szabályszerkesztés, import, visszalépés piszkos állapottal, kései válasz);
   - Playwright-átjárási tesztek Node és Pages módban: minden lépésváltásnál ellenőrzik, hogy a kapcsolódó nézetek a helyes modellrevízióból indulnak, és az elavult eredmények jelölve vannak.
6. **Megőrzendő szerződések:** a nem alkalmazott piszkozatok soha nem vesznek el, a natív, pointeres, érintéses és billentyűzetes egyenértékűség megmarad, ahogy a tanulói elkülönítés, a munkamenet-export és -import és a vágólap is.

**Ütemezés:** közvetlenül a D2 után, az E1 és az F1 előtt. Így a tanulói visszajelzés (F1) és a diagnosztika megjelenítése már az új lépésszerkezetbe épül. Az E1 core-modul ettől független, akár előbb is mehet.

## E1 – core diagnosztikai modul – lezárva

**Döntés:** [ADR-023](adr/023-explainable-validation-diagnostics.md).

**Megvalósítás:**

- **`diagnoseSubmission`:** maga hívja a validátort, és a jelentésben változatlanul visszaadja az ítéletét. A diagnosztika csak magyaráz.
- **Közös tartalmi illesztés:** a `content-match.ts` modul. Ebből dolgozik a validátor és a diagnosztika is; a validátor viselkedése nem változott.
- **Bizonyítás:** egy konfliktus akkor bizonyított, ha minden tartalomkonzisztens hozzárendelésben igaz. Sorrendnél ez a jelöltpozíciók szélső értékeiből dönthető el (`min P(a) > max P(b)`), így duplikált tartalomnál sem kell egyetlen sort kiválasztani. A blokk- és egységhibákhoz minden érintett sornak egyértelmű helyűnek kell lennie.
- **Kategóriák:** ismeretlen tartalom, többlet- vagy hiányzó sor, előfordulási szám, rögzített hely, közvetlen és tranzitív sorrend, szerzői és szerkezeti szabály, blokk- és konténerhatár, v3-egység, profilkonfliktus (csak ha minden profil sérül), `indeterminate`, érvénytelen referencia, általános (nem bizonyítható) elutasítás, diagnosztikai keret.
- **Szövegek:** determinisztikus magyar sablonok. Szemantikai ok csak kötött provenienciából jelenik meg.
- **Javaslatok:** `verified` csak validátor által elfogadott mozgatásra; `partial`, ha csak az adott ütközés szűnik meg; egyébként `guidance`. A mozgatás a rendező beszúrási szemantikáját követi.
- **Keret és felfedés:** explicit lépéskeret, részleges jelentés jelöléssel. Minden diagnosztikának van felfedési szintje az F2 számára.

**Bizonyíték:**

- [diagnostics.test.mjs](../tests/diagnostics.test.mjs) (17 eset) a 09.4 és 09.5 pontjaira;
- metamorf ellenőrzés a három példa összes (illetve 400) permutációján: verdikt-azonosság, brute-force bijekciós igazolás, ellenőrzött javítások;
- 500 soros lánc 14 ms, 500 soros duplikált modell 55 ms (helyi mérés).
- `check:all` 689/689; a validátort a böngészőben is futtató offline és szerveres böngészőcsomag zöld; `git diff --check` tiszta.

**Nyitott:**

- a megjelenítés, a soronkénti jelölés és az elavult aszinkron diagnózis érvénytelenítése (F1);
- a felfedési szabályozás és a negatív szivárgási tesztek (F2);
- a szerver és a Pages ezért még nem küld diagnosztikát.

**Javítás a felhasználó jelzésére (2026-10-27):** a Próba lépésben a szabályszerkesztés után a rendező a tetejére ugrott, mert a görgetési memória az előnézet minden befogadáskor változó azonosítójához volt kötve. Most a szerzői projekt állandó kulcsához kötött (ADR-022, `continuityKey`). Bizonyíték: `workbench-flow` 8 eset, workbench-böngészőcsomag 43 eset.

## Közbeiktatott feladatok (2026-10-28)

A felhasználó két nagy feladatot kért az F1, F2 és G1 előtt. Az epic terve változatlanul megmarad, és utánuk folytatódik.

1. **Kapcsolatkapcsoló ([ADR-024](adr/024-link-toggle-and-exact-restore.md)) – kész:** a kör kipipálja a kiinduló sor közvetlen kapcsolatait a kapcsolat színével; pipára kattintva megszűnik, üres körre kattintva létrejön a kapcsolat, és a megszüntetett generált kapcsolat pontosan visszaállítható. Bizonyíték: `rule-editing` oda-vissza út, `workbench-flow` 9 eset, workbench-böngészőcsomag 45/45.
2. **A függőségi gráf a mesterprompt szerint ([ADR-025](adr/025-local-object-effect-footprints.md), v12) – kész:** a mai elemző minden mellékhatásos utasítást teljes forrássorrendbe láncolt, és a megjegyzések is független sorokat kötöttek össze. A v12 a függvény saját objektumain dolgozó utasításokat a konstruktor-, metódus- és accessortörzsek absztrakt végrehajtásából számolt hatásnyom szerint rendezi, az egysoros megjegyzést pedig felszabadítja. Bizonyíték:
   - a prompt referenciafüggvényén az 5040 sorrendből pontosan az a 136 elfogadott, amelyet a futásidejű orákulum ekvivalensnek talál (v11: 1);
   - objektumkampány 120 program, 473 836 sorrend, 0 hibás elfogadás;
   - korpusz 0 hibás elfogadás.

**Ezután folytatódik:** F1 → F2 → G1.

## F1 – visszajelzés és soronkénti jelölés – lezárva

**Döntés:** [ADR-026](adr/026-learner-feedback-and-row-marks.md).

- **API:** az értékelő végpontok a változatlan ítélet mellett nézőnként vágott visszajelzést adnak. A szerzői előnézet mindent lát, a tanuló (megbízható értékelés, gyakorlás, Tanulói nézet) a pozíciószintig. A szabályszintű ok visszatartott, és egy általános sor helyettesíti.
- **Felület:**
  - rövid ok az értékelősávban, részletes magyarázat javítással és bizonyítékkal;
  - soronkénti jelölés a ténylegesen értékelt sorokon, `aria-describedby`-vel;
  - „Ugrás” a sorokhoz fókuszkezeléssel;
  - azonnali érvénytelenítés minden mozgatáskor.
- **A nyitott kérdés:** a meglévő Tanulói nézet pontosan a tanulói szintet mutatja, külön kapcsoló nem kell.
- **Bizonyíték:** `discloseReport` egységteszt; negatív szivárgási API-teszt; böngészős eset Node és Pages módban.

**Következik:** F2 (a felfedési politika, a tanulói szint emelése, szerveroldali szerzői jogosultság), majd G1.

## F2 – felfedési politika és szerzői jogosultság – lezárva

Döntés: [ADR-027](adr/027-disclosure-and-author-authorization.md).

A felhasználó kérésére (2026-10-28, kevés token) kis részfeladatokra bontva, részfeladatonként külön committal:

| # | Részfeladat | Állapot |
| --- | --- | --- |
| F2.1 | Szerveroldali szerzői kapu (`src/server/author-gate.ts`, natív TypeScript, saját `tsconfig.server.json`): token nélkül csak loopback kliens loopback hosztnévvel (DNS-rebinding ellen), cross-site és idegen `Origin` mindig tiltott, `CODELINE_AUTHOR_TOKEN` esetén kötelező `Bearer` token; a tanulói végpontok nyitottak maradnak | ✅ `author-gate.test.mjs` |
| F2.2 | Egyetlen politika (`channelFeedback`) a szervernek és a Pages-nek: a szerzői előnézet mindent lát; a tanuló alapból `positions`, a szerző feladatonként `learnerFeedback: "rules"`-ra emelheti (a megsértett pár, indoklás és kategória nélkül; a provenienciából származó kód `order-direct` lesz). Az indoklás a diagnosztika külön, csak `provenance` szinten látható része (`reasons`) | ✅ `diagnostics`, `trust-boundary` |
| F2.3 | Egyetlen publikálási szabály (`publicationRefusal`): a keretben el nem dönthető modellt a katalógus soha nem szolgálja ki; `CODELINE_PUBLICATION=verified-only` mellett a nem igazoltat sem. A kihagyott modell a `skipped` listába kerül és a szerver indításkor kiírja, a fájl érintetlen. A lista minden feladatnál megadja a minősítést (`verification`). Az alapértelmezés a régi példákat továbbra is kiszolgálja | ✅ `catalog-publication` |
| F2.4 | ADR-027, CHANGELOG, `check:all`, böngészőcsomagok, lezárás | ✅ |

**Korlátok:** a felület tokent nem küld (token módban a szerzői API csak API-kliensből érhető el); a `learnerFeedback` csak JSON-ban állítható; a lista minősítéséhez nincs jelvény; a token egyetlen közös titok.

**Következik:** G1.

## G1 – lezáró regresszió és jelentés – lezárva

A G1.1–G1.2 a felhasználó kérésére részfeladatonként megállva, a G1.3–G1.5 egyben készült. A tesztelési eljárás leírása: [lezáró regresszió – módszertan](lezaro-regresszio-modszertan.md).

| # | Részfeladat | Állapot |
| --- | --- | --- |
| G1.1 | A `23-parameter-property` minta fordíthatósága: átnevezés (`Parameters` → `Point`), mert modullá alakítás új sort hozna; előtte TS2300 ×2 és TS2693, utána 0 diagnosztika (`lib.es2022`, strict); a regenerált modellben csak a kódszöveg, a név és a kivonat változott | ✅ |
| G1.2 | A mátrix drag-and-drop flake: **tesztoldali ok**. Az egeres és az érintéses gesztus pontosan a célsor középvonalára (`y+22`, sormagasság 44) ejtett, a beszúrási határ pedig épp a középvonal; az egész pointerkoordináta a tört elrendezéshez képest döntötte el az oldalt (rögzített hiba: 953 < 953,016 → a sor elé). A termék helyes, sor nem veszett el és nem duplázódott. A gesztus most a sor ¾-ére céloz, és új ellenpróba ellenőrzi a ¼-et (a sor elé); az állítások nem gyengültek. Terhelés alatt (4 párhuzamos futás): előtte 8-ból 2 és 12-ből 1 hiba, utána 16/16 zöld | ✅ |
| G1.3 | Forráshűségi round-trip ([source-fidelity.test.mjs](../tests/source-fidelity.test.mjs)): 24 TS-minta és 4 JS/TS szélső eset, hat lépésben (forrás → modell → IDE-nézet → értékelés → szerkesztő szövege → munkamenet-export/import → modell-JSON). 28/28 zöld. Megállapítás: az `indent` sor a nézetben új behúzást kap; ez a dokumentált formázási projekció, nem hűségi hiba, az `exact` sor betűre azonos | ✅ |
| G1.4 | A szerzői elemzés kerete ([author-budget.test.mjs](../tests/author-budget.test.mjs)), esetenként külön folyamatban, a 500 soros bemeneti korlátnál: service-436 0,13 s / 14 MiB, objects-500 1,3 s / 115 MiB, flat-500 0,8 s / 85 MiB; keret 10 s és 400 MiB | ✅ |
| G1.5 | `check:all` 741/741; kampány 1–200. mag, 7 változat, 1 400 program, 2 372 610 sorrend, **0 hibás elfogadás**, 0 eldöntetlen, 0 `indeterminate` (130 perc); `test:browser:all` mind a 8 csomag zöld (offline, szerver, mátrix 32, drag 45, workbench 49, engine, TypeScript 24 modell Node és Pages módban, Python-platform 58 eset) | ✅ |

**Végső jelentés.** Az epic minden szakasza lezárult. A korábban nyitott kockázatok közül a 4. és az 5. megoldva (G1.1, G1.2). A G1 új regressziót nem talált a termékben: a mátrix-flake tesztoldali ok volt, a forráshűség és az erőforráskeret a mért korlátokon belül van.

**Korlátok.** A kampány minta, nem teljes bizonyítás; a függvénytörzs-generátor csak JavaScriptet állít elő. Az erőforrás-mérések egy gépen készültek. A teljes WCAG-megfelelés és az univerzális szemantikai ekvivalencia nem állítás.

## Utómunka: futásidőhöz igazított függőségek (ADR-028, v13)

A G1 után a felhasználó a futásidejű mesterpromptot saját bemenettel (`runMiniFixture`) adta át, és azt kérte, hogy a blokkon belül független sorok legyenek szabadon rendezhetők. A promptot LLM-ként lefuttattuk, a kapott modellt soronként és a futásidejű orákulummal is megvizsgáltuk: [elemzés](runtime-prompt-mini-fixture-elemzes.md).

A v12 túlkötött: a mintán 328 futásidőben azonos sorrendet utasított el. Négy okát javítottuk: mezőszint, listaszintű `if/else`, string-metódusok, egyetlen kivétel ([ADR-028](adr/028-runtime-precise-object-footprints.md)). A v13 lezárt sorrendi relációja azonos a kézi modellével.

A következő kérdés a `state` és a `score` mező cseréje volt: ez csak a kulcssorrendet változtatja. A felhasználó döntése szerint a példánymezők kulcssorrendje csak kulcsokat listázó programban számít ([ADR-029](adr/029-unobserved-instance-field-order.md), v14).
