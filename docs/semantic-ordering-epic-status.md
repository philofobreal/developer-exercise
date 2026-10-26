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
| D1 | EPIC-05: típusos szabályműveletek (félkész, a `stash@{0}`-ban): atomikus befogadás, profilok, fixed, megjegyzések, lazítás megerősítési szintekkel, hatásjelentés tanúsorrenddel. Minden szerkesztés után V1-újraminősítés. A refresh jelentve vezeti össze a szerzői szabályokat, a lazításokat és a megjegyzéseket | ✅ | szabályeditor-regressziók (09.3) |
| D2 | EPIC-05: vizuális szabálypanel, `importEmit`-választó és a minősítés megjelenítése a szerzői felületen | ⏳ | Playwright-bizonyíték |
| E1 | EPIC-06: core diagnosztikai modul (bizonyított konfliktusok, többértelműség, keret) | ⏳ | diagnosztikai regressziók (09.4), metamorf: a validátor döntése változatlan |
| F1 | EPIC-07: tanulói visszajelzés és soronkénti jelölés | ⏳ | böngészőteszt, hozzáférhetőség |
| F2 | EPIC-08: disclosure policy (szerző / Pages / trusted szerver) és szerveroldali szerzői jogosultság, vagy explicit, dokumentált helyidemó-korlát | ⏳ | negatív szivárgási és jogosultsági tesztek |
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

**Új sorrend:** A2 → C2 → R1 → V1 → D1 → D2 → E1 → F1 → F2 → G1.

**A D1 felfüggesztése:** a félkész munka a `stash@{0}` „D1 WIP: typed rule edits…” bejegyzésében van; csak saját fájlok, a felhasználói snapshot nélkül. Tartalma:

- `src/core/rule-editing.ts`: `applyRuleEdits`, `mergeAuthorRules`;
- `ruleNotes`, `relaxations` és `conformance` a sémában, a típusban és a magyarázatban.

A C2 és a V1 után `git stash pop`, majd ütközésfeloldással folytatódik.

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

**Következik:** D2.
