# Changelog

## Unreleased – 2026-10-26 generatív lefedettség: osztályok, szkriptszint, TypeScript

- **Új generátormódok** ([random-programs.mjs](tests/support/random-programs.mjs)): `randomClassProgram` (felső szintű, öröklő és beágyazott osztályok minden tagfajtával, TS-ben `declare`, paramétertulajdonság, overload, `accessor`), valamint `randomScriptProgram` (szkriptszintű deklarációk, TS-ben `enum`, `namespace`, `import =`). A korábbi generátor csak egy függvénytörzs JS-kódját állította elő.
- **Blokkmozgatás** (`blockMoves`): minden utasítás és osztálytag egészben, a saját listáján belül minden más helyre. Ezt a többsoros mozgást az egysoros szomszédság nem fejezi ki.
- **Orákulum:** a beágyazott osztálydeklarációk futásidejű kulcs- és descriptor-pillanatképet kapnak, a probe lefutása után. Korábban ezekre csak a szintaktikus szabály vigyázott.
- **Tesztek:** a `check:all` 160 referencia lefutását ellenőrzi, és 36 rögzített magú programon mintavett, szomszédsági és blokkmozgatásos soundness-tesztet futtat; ehhez jön egy blokkmozgatás- és egy beágyazottosztály-regresszió.
- **Kézi kampány:** [tests/ordering-campaign.mjs](tests/ordering-campaign.mjs). Eredménye 550 programon és 410 371 sorrenden: **0 hibás elfogadás**, 0 eldöntetlen, 0 `indeterminate`. [Részletek](docs/formal-ordering-contract.md#generatív-lefedettség-osztályok-szkriptszint-typescript).
- **Production:** változatlan. A generátor, a validátor, a séma és a policy-címke sem változott; csak a tesztkód és a tesztorákulum bővült.

## Unreleased – 2026-10-26 felülvizsgálat: `accessor` mezők és TS-kibocsátott globálisok (ADR-010 kiegészítés)

- **Felülvizsgálat:** a WP1–WP8 utáni kódáttekintés két, a P4-et sértő hibás elfogadást talált, egyik alak sem szerepelt a korpuszban:
  - egy metódus átléphetett egy TS `accessor` mezőn, pedig az get/set párt hoz létre a prototípuson (static esetén a konstruktoron) a metódusok között;
  - egy szkriptszintű függvény átléphetett egy `enum`-on vagy egy példányosított `namespace`-en, pedig ezek `var`-ként globális tulajdonságok. Ezt az orákulum sem látta (közös vakfolt).
- **Javítás:** az `accessor` mező a kulcsláncba kerül; az `enum`, a példányosított `namespace` és az `import =` alias globális egység. A típus-only namespace szabad marad. Az orákulum a TS globálisokat a kibocsátott szkriptből olvassa. Részletek: [ADR-010 kiegészítés](docs/adr/010-reflective-property-order.md#kiegészítés-felülvizsgálat-utáni-javítás-scoped-effect-analysis-v7).
- **Policy-címke:** additív `scoped-effect-analysis-v7`. A validátor és a séma jelentése változatlan; az importált modellek nem generálódnak újra.
- **Tesztek:** két új reflexiós fixture (`refl-ts-accessor-fields`, `refl-ts-emitted-globals`), reprodukciók parserrel, teljes típusellenőrzéssel és mindkét emit-módban, tagblokk-permutáció. A `ts-enum` forgatókönyv probe-ja a globális kulcssorrendet is kiolvassa, ezért a „függvény az enum elé” változat indokolt elutasítás lett.
- **Mérés** (61 fixture, azonos orákulum mindkét oldalon): a hibás elfogadások száma a K45-ön 1 → 0, az R7-en 463 → 0. A completeness-rések száma változatlan, a K45 A(M) értéke 2 298 → 2 297. Az új elfogadott halmaz a régi részhalmaza, és minden eleme helyes. [Részletek](docs/formal-ordering-contract.md#v7-kiegészítés-accessor-mezők-és-ts-kibocsátott-globálisok).

## Unreleased – 2026-10-26 WP7 nyelvfüggetlen sorrendi határ és WP8 dokumentáció (ADR-011)

- **WP7:** új, nyelvfüggetlen [`ordering-relations.ts`](src/author/ordering-relations.ts) szerződés. Tartalma: `OrderingRelations`, konjunktív kombináció, valamint áthelyezve a lezárás és a tranzitív redukció.
  - A JS/TS-elemzést a [`js-ts-ordering.ts`](src/author/js-ts-ordering.ts) fogja össze, az adapter `orderingRelations` metódusán át.
  - A `generator.mjs` már csak projekció: nem importál TS-specifikus modult. Az architektúrakapu ezt gépileg tiltja; a korábbi két generátorkivétel megszűnt.
  - Viselkedésmegőrző: mind a 167 generált modell bájtra azonos (korpusz, 80 véletlen program, nagy referenciák, 24 TS-minta).
  - Új teszt: [`tests/ordering-relations.test.mjs`](tests/ordering-relations.test.mjs). Lefedi a konjunkciót, a lezárást, a redukciót, a diszjunkt sorokat és egy nem TypeScript-alapú játéknyelvi adapter projekcióját.
  - A Python szerkezeti feladatai dokumentálva, implementáció nélkül.
- **WP8:** a [formális szerződés](docs/formal-ordering-contract.md) új szakaszokat kapott:
  - végleges állapot;
  - a soundness és a completeness mérési jelentése;
  - konzervatív fallbackek;
  - a tesztorákulum bizonyítási határai;
  - P0–P4-re frissített helyességi állítás.

  A korábbi mérések történeti szakaszként maradnak meg.

## Unreleased – 2026-10-26 reflektálható tulajdonságsorrend (ADR-010)

- **Probléma:** az ADR-008 óta két különböző nevű osztálymetódus, illetve két szkriptszintű `function`/`var` cseréje elfogadott volt. Minden hívás eredménye azonos maradt, de az `Object.getOwnPropertyNames(C.prototype)`, a `Reflect.ownKeys(C)` és az `Object.keys(globalThis)` sorrendje megváltozott.
  - Ha maga a program reflektált, ez a régi politika szerint is hibás elfogadás volt.
  - Reprodukció JS-re és TS-re: parser, teljes strict típusellenőrzés és mindkét emit-mód külön ([tests/reflection-ordering.test.mjs](tests/reflection-ordering.test.mjs)); a régi kódon 8-ból 7 teszt elbukik.
- **Politika:** új P4-feltétel: a reflektálható kulcssorrend és a descriptor-fajta megőrzendő. A forrásszöveg-reflexió (`toString`, `stack`) explicit módon kizárt.
- **Author-javítás:**
  - **Kulcslánc a tagokra:** a kulcsot létrehozó metódusok és accessorok azonos objektumon (prototípus, illetve konstruktor) forrássorrendben maradnak.
  - **Szabad marad:** a `constructor`, a privát `#`, a tömbindex nevű és a törölt tag.
  - **Szkriptszint:** a szkriptszintű függvények és `var`-ok egy láncot alkotnak. Mérés szerint a V8 forrássorrendben hozza létre a globális tulajdonságokat.
- **Policy-címke:** additív `scoped-effect-analysis-v6`. A validátor és a séma jelentése változatlan.
- **Orákulum:** szintaktikus P4-szabály és futásidejű `Reflect.ownKeys`-pillanatkép, külön `reflection` okkal. A `policy: 'call-only'` a régi szemantikát adja vissza összehasonlításhoz; a mérőeszköz `--policy` kapcsolót kapott.
- **Mérés:** azonos, 59 fixture-ös készleten.
  - A reflexiós politika szerint a régi generátor 14 321 hibás elfogadása (a K45-ön 9 151) 0-ra csökkent.
  - A K45-en az elfogadott teljes sorrendek száma 11 449-ről 2 298-ra csökkent; ez pontosan a régi halmaz helyes része.
  - A szomszédsági rések száma változatlan.
- **Frissített elvárások, gyengítés nélkül:**
  - két forgatókönyv-probe a kulcssorrendet is kiolvassa, ezért két változat indokolt elutasítássá vált;
  - új, elfogadott változat igazolja, hogy a metódus a mezőkhöz képest szabad;
  - a policy-címke 4 helyen frissült;
  - a completeness-alapvonal frissült.

## Unreleased – 2026-10-25 WP6 sorrendi hibák javítása és mérés (ADR-009)

- Hat hibásan elfogadó hiba javítva, mindegyikre előbb reprodukáló fixture készült (`origin: 'wp6'`):
  - **Lezárás:** pozíciófüggetlen sor nem kerülhet többsoros utasítás, `} else {`/`} catch {` határú blokk vagy többsoros mező belsejébe ([generator.mjs](src/author/generator.mjs)).
  - **Overload-csoport:** a TS overload-csoport egyetlen egység.
  - **Tisztaság:** nem tiszta az önhivatkozó inicializáló, a más függvénykontextusból olvasott `let`/`const`/osztály és a `case`-ágbeli kötés olvasása.
- Teljességi javítások:
  - a constructor ténylegesen szabad (névfeloldási hiba), a paramétertulajdonságokkal együtt;
  - a `declare` mező szabad;
  - a soha újra nem írt `let`/`var` függvénykontextusban `const`-ként primitív operandus (írási halmazok).
- Új, additív policy-címke: `scoped-effect-analysis-v5`. A `TypeMemberOrdering.spans` a generátornak adja az egységhatárokat. Az orákulum P0-ja ellenőrzi a TS overload-szomszédosságot.
- **Mérés:** a HEAD kódjával összevetve, ugyanazon az 54 fixture-ös készleten.
  - Hibás elfogadás: 81 → 0.
  - Completeness-rés az eredeti 45 fixture-ön: 28 → 6.
  - Elfogadott teljes sorrend: 5 100 → 11 449, mind orákulummal ellenőrizve.
  - Részletek és a nagy referenciák: [formális szerződés](docs/formal-ordering-contract.md#wp6-javítás-mérés-és-regresszióvédelem).
- **Új tesztek:**
  - `tests/wp6-regressions.test.mjs`;
  - `tests/ordering-scale.test.mjs`;
  - kiterjesztett véletlen programok;
  - a mérőeszköz új mérőszámai: nem támogatott esetek, redundáns élarány, nagy referenciák.
- **Frissített elvárások, gyengítés nélkül:**
  - a policy-címke 4 helyen;
  - a scope-mátrix `declare` változata most `accepted` (orákulum szerint ekvivalens);
  - a UserAccount-teszt megengedett halmaza a constructor mögé kerülő mezővel bővült (mindkét mezőmódban futásidőben ellenőrizve);
  - a rögzített completeness-alapvonal.

## Unreleased – 2026-10-25 WP5 szemantikai regressziók és sorvégkezelés

- `tests/semantic-corpus.test.mjs`: a 45 fixture-ös korpusz feltétlen soundness-ellenőrzése, fixture-enként rögzített completeness-alapvonallal (`tests/fixtures/ordering-baseline.json`) és negatív kontrollokkal. `tests/ordering-properties.test.mjs`: 24 360 elrendezéses kimerítő Π(T) független tanúellenőrzéssel, 30 seeded véletlen program, átnevezési/újrabehúzási/ID-csere metamorf relációk és keretkonzisztencia. Hibás elfogadás: 0.
- `.gitattributes`: LF az indexben és minden munkakönyvtárban (CRLF csak .bat/.cmd), bináris eszközök jelölve; a `sync-vendor` LF-fel másolja a CRLF-es upstream licenceket. Megszűnnek a build utáni fantom-módosítások.

## Unreleased – 2026-10-25 hatásösszegzésen alapuló sorrendelemzés (ADR-008)

- A `statement-ordering.mjs` strict TypeScriptre migrált ([src/author/statement-ordering.ts](src/author/statement-ordering.ts)): egységenkénti pure / position-free / barrier / opaque osztály indokkal, kötésolvasás paraméterekre, ciklus- és `catch`-változókra, friss literálok, closure-ök, hoistolt függvény- és törölt típusdeklarációk, osztálydefiníciók; osztálymetódusok JS-ben is szabadok. `eval` és `using` konzervatív. Új additív `dependencyPolicy`: `scoped-effect-analysis-v4`. Független pedagógiai-politikai orákulum ([tests/support/semantic-oracle.mjs](tests/support/semantic-oracle.mjs)) és 45 fixture-ös korpusz: hibás elfogadás 0 → 0, egyenértékű de elutasított szomszédos elrendezés 103 → 30. Formális szerződés: [docs/formal-ordering-contract.md](docs/formal-ordering-contract.md).

## Unreleased – 2026-10-25 összetett példák és scope-mátrix

- Bal oldali feladatkönyvtár: a `sum-js`, `sum-ts` és `dependencies-js` helyett négy összetett feladat (BFS rácson, beszúrásos rendezés + bináris keresés, absztrakt osztály + öröklés, interface + generikus osztály). A régi modellek tesztfixtúraként változatlanul futnak (`tests/fixtures/legacy-examples/`). Új `tests/complex-scope-ordering.test.mjs`: 15 JS/TS forgatókönyv, 73 elnevezett változat, teljes egysoros-áthelyezési/páros-csere söprés és a könyvtári modellek összes lineáris kiterjesztése futási orákulummal. Eredmény: nincs hibás elfogadás; 21 ismert konzervatív korlát dokumentálva ([docs/complex-scope-ordering.md](docs/complex-scope-ordering.md)). A Pages-tesztek a szállított példák számát az `examples/` mappából veszik.

## Unreleased – 2026-10-24 audit

- TypeScript member-ordering: az egyszerű, külön nevű, törölt típusmezők indokolatlan soros kötése javítva strict TS author-projekcióval. A rendes class mezők és this-értékadások megfigyelhető sorrendje megmarad. Új policy-magyarázat, 24 letölthető source/model pár, teljes kis permutációs és Node/Pages böngészős mátrix, strict fixture-typecheck és generált példatár-CI kapu. [UserAccount-elemzés](docs/typescript-ordering-analysis.md), ADR-007.

- Lezáró ág-/PR-review és fejlesztési összegzés: a korábbi három fejlesztési ág már a main történetében; a Python könyvtári szelet és a review-javítások külön beolvasztási kapuval. ADR-004 pontosítva az explicit függőségfrissítésről; a teljes Python-adapter és termékintegráció továbbra is nyitott. [Összegzés](docs/development-summary-and-integration.md).

- Teljes fejlesztési review: natív IR teljes fizikai forráslefedése, ritkás renderjavaslat elutasítása, Python loaderhiba utáni újrapróbálás és nagy AST erőforrás-diagnosztika javítva. A szerzői guard már a fájl-/clipboard-/hálózati I/O előtt rögzül; késői JSON/session-import nem ír felül újabb referenciát. A dokumentáció parser/adapterszelet-státuszai egységesítve. [Review és bizonyíték](docs/review-language-engine-python.md).
- Régi v2 soros modellekhez explicit Sorfüggőségek újraszámítása: typed author port, Node/Pages admission, megmaradó ID/kód/fixed/kézi élek/profilok és kompatibilis kitöltés. A képi evaluate-eset 5040 permutációs regresszióval, API- és böngészős tesztekkel, javított JSON-nal dokumentált. Normál import és learner validáció változatlan.

- A mainre zárt alapok után megkezdett Python-integráció: pinned Pyodide 314.0.7 / CPython 3.14.2 author parserport, izolált process/worker, strict DTO, cancel/timeout/restart, hash/licenc artifactkapu és 58 esetes Node/Chromium korpusz (+27 generált kombináció). Teljes Python IR-adapter, UI és release továbbra is nyitott; [pontos státusz](docs/python-parser-platform.md).

- Részletes Python-adapter integrációs terv: PY-01–PY-11 taskok, parser/platform döntési kapu, IR-leképezés, verziózott termékintegráció és tesztmátrix. Ebben a tervcommitban Python-adapter még nincs implementálva.

- Referencia-/próbamunkafolyamat javítása: a kézzel gépelt referencia megmarad, feladatonként külön source/JSON draft, egyértelmű Referenciaforrás/Megoldáskód nézetek és pending jelzések, explicit rendezőből újratöltés, késői admission elleni védelem. Strict TS workspace-politika, ADR-004 és Node/Pages böngészős regressziók.

- Language IR v1 és opt-in CodeLine v3 alap: fizikai source span, atomi többsoros unit, külön syntactic container/binding scope, virtuális határesemények, indent policy. Ugyanaz a bounded bijekciós validátor, strict TS adapterregiszter, JS/TS v2 bridge, gráfmentes render port, Schema-/permutációs-/adapter-/Chromium-contract tesztek és CI generáltkód-kapu. V2 UI, API, importált szabályok és governance megőrizve. Python parser/adapter és v3 termékintegráció nyitott; [terv és állapot](docs/language-engine-migration.md).

- Unicode whitespace előtagok tartalommegőrzése a live formatterben: csak ASCII szóköz/tab normalizálható, a validátor szerződésével egyezően.
- Kiadás előtti review: fixed pozíció közvetlen korláttal, implicit oldalkorlát nélkül; késői formázási és hibás kiértékelési válaszok nem írnak felül újabb munkát. Új üzleti/technikai szerződés és ADR-002.
- Munkafolyamat-központú UI/UX: forrás-/JSON-belépés, forrásfájl-betöltés, külön tanulói preview, megmaradó editor-draftok, hozzáférhető tabs/shortcut/fókusz/busy és mobilfelület; új megjelenítési források strict natív TypeScriptben.
- AI governance, AGENTS, Ousterhout-alapú döntéstulajdonosok és TS-migrációs ADR; natív TS architektúrakapu import-/strictness-/végrehajtási korlátokkal, generált forrásgazdákkal és negatív regressziókkal.

- Scope-onként kompozicionális függőséggenerálás: külső konstanskötések, beágyazott egységek és adat-/vezérlési korlátok; 5040 képi sorpermutációs JS-orákulum, háromszintű regressziók és korai prefix-scope-ellenőrzés az azonos kapcsos zárójelek miatti kereséshez.

- Kötésalapú részleges sorrend az egyszerű primitív const deklarációk között; állandó ID-alapú függőségek, opcionális sourceLine és szerver által számított matchedTokenIds megfeleltetés, szerzői/kiértékelési táblázatokkal. A meglévő modellek szabályai megmaradnak.

- Natív drag-and-drop javítása minden példánál: a böngésző által küldött pointercancel nem törli többé a natív húzást; 36 valódi Node/Pages böngészős regressziós eset.

- Indítási portütközés javítása: implicit alapportnál korlátos fallback, explicit PORT-nál olvasható hiba; más alkalmazás folyamatát nem állítjuk le.

- TASK-19: másolás/beillesztés a szerzői forráshoz, JSON-modellhez, megoldásszerkesztőhöz és rendezőhöz; forrássor-másolás, hibavisszajelzés és fixed-védelem.

- Regex-, komment-, string- és template-tudatos, öt szóközös toleráns behúzás; exact és nyers literálsorok védelme.
- Valódi JS Beautify összehasonlító regresszió, helyi assetek és kontrollált lexikai fallback.
- AST-alapú JS/TS blokkhierarchia; globális struktúravesztés helyett dokumentált intervallumfallback.
- Külön szerzői szintaktikai referenciaaudit, JS-specifikus Acorn parser és működő nyelvi adapterregiszter.
- Egyetlen JSON Schemából generált runtime-ellenőrző; duplikált függőségek, integritás és erőforráskorlátok egységesítése.
- Hatékonyabb fixed-horgonyélek és referenciasor-indexelés; megőrzött bounded search és indeterminate.
- Natív, pointeres, touch és billentyűzetes beszúrás; fókusz/státuszüzenet és animációközi célzás javítása.
- Explicit Local Demo / Preview / Trusted Server validációs módok.
- Modell- és munkamenet-export/import, kézi helyi mentés, szigorú próbálkozásintegritás.
- Bővíthető mezőregiszter, külön szerzői életciklus és persistence, egységes CSS.
- Hordozható HTTP/Pages Playwright-mátrix és egyszeri verify → ellenőrzött artifact → deploy CI-lánc.
- UTF-8 README, helyes repository/Pages útvonalak, pontos tesztállítások és megőrzött harmadikfél-licencek.

A helyi audit lezárásakor távoli push, release és deployment nem történt; a később külön kért kiadási szakasz nyoma a Git/GitHub történetben követhető. Projektlicenc választása továbbra is tulajdonosi döntés.
