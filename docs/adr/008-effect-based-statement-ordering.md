# ADR-008 – Hatásösszegzésen alapuló, típusos utasítássorrend-elemzés

Állapot: implementálva, Node- és böngészőtesztekkel ellenőrizve. Az ADR-001–007, a validátor, a tanulói parsermentes értékelés és a bizalmi határ változatlan.

## Kontextus

A korábbi `statement-ordering.mjs` csak egysoros, primitív `const`/`let` deklarációkat engedett felcserélni. Egy független orákulummal mérve 45 fixture-ön nem fogadott el hibás sorrendet, de 103 egyenértékű szomszédos elrendezést elutasított. Fő okok:

- hoistolt függvény- és típusdeklarációk;
- friss literálok és closure-ök;
- paraméter-, ciklus- és `let`-olvasások;
- osztálymetódusok.

Az ADR-001 P4 lépése a statement-ordering TypeScript-migrációját is előírja.

## Döntés

1. Az elemzés strict TypeScriptbe kerül: [statement-ordering.ts](../../src/author/statement-ordering.ts). A régi `.mjs` megszűnik.
2. Minden lista egységei pure / position-free / barrier / opaque osztályt kapnak, indokkal együtt (`units`). Él akkor keletkezik, ha bármelyik fél opaque, vagy ha egyik fél sem pozíciófüggetlen és legalább az egyik barrier. Ehhez jönnek a kötésolvasási védett élek, amelyeket csak az azonos függvénykontextusú inicializálás vált ki. A pontos szabályok és a helyességi vázlat: [formális szerződés](../formal-ordering-contract.md).
3. A tagsorrend-modul JavaScriptre is fut. Az egyedi nevű metódus-, accessor- és constructor-definíció pozíciófüggetlen, a mezők és a static kód kötött.
4. Új, additív `authoring.dependencyPolicy`: `scoped-effect-analysis-v4`. A régi értékek és modellek érvényesek; importkor nincs automatikus újraszámítás.
5. A `with` mellett a közvetlen `eval` is kikapcsolja az elemzést. A `using`/`await using` deklaráció barrier.
6. Explicit migrációs bekötés: a `generator.mjs` és a `languages.mjs` a lefordított `dist/author/statement-ordering.js`-t importálja. Az architektúrakapu csak ezt a két irányt engedi; a Pages-build ugyanezeket az útvonalakat vetíti át.

## Pedagógiai politika

A szigorúbb, explicit `E_pol` politika marad érvényben: a lexikai tulajdonlás megmarad, a hatásos utasítások sorrendje kötött, és egyetlen azonos futás nem elég. A hoistolt függvény- és törölt típusdeklaráció helye a saját listáján belül szabad; ez tudatos döntés, mert a nyelv ezeket a lista belépésekor hozza létre. Egy esetleges „definíció a használat előtt” stílusszabály külön, explicit kézi profillal adható meg.

## Vizsgált alternatívák

- **A validátor scope-feltételének lazítása:** elvetve. A `scopeId` nem alku tárgya, és a P1 politikát sértené.
- **Teljes CFG- vagy absztraktinterpretáció-keretrendszer:** elvetve. A vezérlő utasítások barrierek maradnak, a mérhető nyereség a kötés- és hatásszintű összegzésből jön.
- **Írási halmazok a lokális `let` értékadásokra:** későbbre halasztva. Kevés a mérhető nyereség, és a koerciós primitívséghez teljes íráskövetés kellene.
- **Futtatásos ellenőrzés a generátorban:** tiltott. Csak rögzített tesztfixture-ökön fut.

## Következmények

- 45 fixture-ön a hibás elfogadás 0 maradt, az egyenértékű, de elutasított szomszédos elrendezések száma 103-ról 30-ra csökkent. Részletek: [mérés](../formal-ordering-contract.md#empirikus-bizonyíték).
- A meglévő generált minták (24 TS-példa és a letölthető korrigált JSON) újragenerálódnak; az új címke látszik bennük.
- Hét meglévő teszt elvárása változott, gyengítés nélkül:
  - négy policy-címke;
  - egy redundáns bemenet-él;
  - tizenhárom forgatókönyv-változat `rejected` → `accepted` (mindegyiket az orákulum ekvivalensnek igazolja);
  - három, korábban barrierként rögzített deklaráció (`[a]`, `{ a }`, `var c = 3`) orákulummal igazolt pozitív tesztbe került, a helyükre hét új negatív eset lépett.
- WP5: a korpusz rögzített completeness-alapvonallal, a kimerítő, property-alapú és metamorf tesztek, valamint a negatív kontrollok a `check:all` részei ([részletek](../formal-ordering-contract.md#wp5-kimerítő-property-alapú-és-metamorf-ellenőrzés)).
- Nyitott: írási halmazok a lokális értékadásokra, a property-olvasás biztonságos részhalmaza és a scope-áthelyezés (új séma nélkül nem reprezentálható).
