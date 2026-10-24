# ADR-007 – TypeScript típusmezők és megfigyelhető osztálysorrend

Állapot: implementáció és regressziós ellenőrzés. Az ADR-001–006 és a tanulói/parsermentes validáció változatlan.

Az interface + UserAccount képi esetében a régi generátor minden sort sorba láncolt. Az interface külön nevű adatmezőinek kötése indokolatlanul szigorú volt. Az osztálymezők és a constructor this-értékadásai viszont futásidejű műveletek lehetnek: a referencia és a képi átrendezés Object.keys(user) eredménye eltér mind useDefineForClassFields=true, mind false mellett. Ezeket általánosan felcserélhetőnek minősíteni hibás lenne.

Új, strict TS type-member-ordering modul fogadja az author AST-t és az injektált TypeScript API-t. Csak külön nevű, teljes egysoros PropertySignature és initializer/decorator nélküli declare PropertyDeclaration futamai kapnak részleges sorrendet. Computed/numerikus/private-# nevek, duplikált nevek, overload/method/call/index signature, kommenttel ellátott vagy többsoros tagok és megosztott fizikai határok konzervatívak. A rendes class mező és minden this-értékadás a meglévő runtime-barrier marad. Az új authoring.dependencyPolicy érték scoped-type-members-v3; a régi enumértékek és importált modellek változatlanul olvashatók.

Minden szabad tag az előző barrier után, a következő barrier/zárás pedig az összes szabad tag után kell álljon. A type/member szerkezet megmarad; nincs új validátor, tanulói parsing vagy futtatás. A generátor a typed projekciót a régi statement-ordering eredményére alkalmazza, majd ugyanazzal a tranzitív redukcióval és shared-boundary védelemmel zár. A note mező emberi magyarázat, nem grading-szabály. A generátor továbbra is syntax auditot végez, nem teljes TS project/type checket.

Az egyetlen új legacy wiring a generator.mjs → dist/author/type-member-ordering.js hívás. A gépi architektúrakapu csak ezt a konkrét irányt engedi; a modulban kizárólag type-only TypeScript import van. A core sem AST-t, sem infrastruktúrát nem kap. Ez az ADR-001 fokozatos TS-migrációja, nem a teljes author elemző átírása.

A statikus buildben az author mappa egy szinttel kerül közelebb a gyökérhez, ezért a build-pages kizárólag ennek az importnak a relatív útját vetíti át. Az új compiled modul a dist/author alatt marad; valódi Pages-alútvonalas import és artifactteszt védi a bekötést. A generator.d.mts szűk buildtool-port, nem a legacy algoritmus típusellenőrzötté nyilvánítása. A példatár építője strict TypeScript, a meglévő Node buildtool-konfigurációban.

A nyilvános TypeScript példatár forrást és generált v2 modellt ad, a tesztmátrix pedig minden megnevezett eset megengedett és tiltott sorrendjét ellenőrzi Node/Pages módban. A kis típusmező-futamokon teljes permutációs, a képi eseten minden egyes soráthelyezéses regresszió készül. Futásidejű összehasonlítás kizárólag fix, korlátos tesztfixture-ökön történhet, saját VM-contexttel és határidővel.

A UserAccount külön, explicit kézi oktatási változata csak a name/id értékét teszi a szerzői feladat céljává, a kulcssorrendet kizárja. Ez nem generátorlazítás: más feladatazonosító, manual-value-contract stratégia, generált dependencyPolicy nélkül és egyértelmű note-tal készül. Mind a nyolc kombináció name/id értéke ellenőrzött mindkét compilerbeállításban. Frissítés/újragenerálás visszaállítja a konzervatív alapot. Ez a meglévő kézi v2 authoring használata, nem új tanulói értékelési út.
