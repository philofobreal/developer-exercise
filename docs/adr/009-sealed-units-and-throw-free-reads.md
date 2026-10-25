# ADR-009 – Lezárt többsoros egységek, dobásmentes tiszta olvasás, írási halmazok (WP6)

Állapot: implementálva, Node-tesztekkel és a független orákulummal ellenőrizve. Az ADR-008 kiegészítése. A validátor, a séma jelentése, a tanulói parsermentes értékelés és a bizalmi határ változatlan.

## Kontextus

A WP6 a WP5 mérőeszközeivel és célzott próbákkal újraauditálta az ADR-008 generátorát. Hat valódi hibásan elfogadó (1. típusú) hibát talált. Mindegyikre előbb reprodukáló fixture készült ([ordering-corpus.mjs](../../tests/fixtures/ordering-corpus.mjs), `origin: 'wp6'`), és a régi generátor mindegyiken hibás sorrendet fogadott el:

| # | Hiba | Reprodukció | Gyökérok |
| --- | --- | --- | --- |
| 1 | Hoistolt függvény egy többsoros utasítás sorai közé kerül (`record(` / `function h() {…}` / `1,`): szintaktikai hiba | `wp6-hoisted-into-continued-call` | A pozíciófüggetlen egységnek nincs éle a barrierrel. A folytatósorokon a validátor nyitott scope-ja megegyezik a sor scope-jával. |
| 2 | Hoistolt függvény egy `} catch {` / `} else {` határú blokkba kerül: P1-sértés, futáskor `TypeError` | `wp6-hoisted-into-shared-boundaries` | Az elhagyott (nem reprezentálható) blokkok sorai a szülő scope-ban vannak; az intervallum lánca csak precedencia, nem kizárás. |
| 3 | Szabad metódus egy többsoros mezőinicializáló belsejébe kerül: szintaktikai hiba | `wp6-member-into-continued-field` | Ugyanaz, osztálytörzsben. |
| 4 | Pozíciófüggetlen sor egy TS overload-szignatúra és az implementáció közé kerül (TS2391) | `wp6-overload-groups`, `ch-ts-overloads` | A szignatúra, az implementáció és a többi egység külön egység volt. Az orákulum P0-ja nem látta, mert a `transpileModule` nem jelzi a checker-hibát. |
| 5 | `const broken = broken` „tiszta” volt; dob, és a helye closure-on és `catch`-en át megfigyelhető | `wp6-self-referential-initializer` | A kötésfeloldás csak a deklaráció kezdetét vetette össze, nem a végét. |
| 6 | Más függvénykontextusból olvasott `const` (TDZ), illetve másik `case`-ágban deklarált kötés olvasása „tiszta” volt; dobhat | `wp6-outer-binding-before-initialization`, `wp6-case-clause-binding` | A tiszta sor „bemenetei inicializáltak” feltevése a hoistolt belső függvényre és a `switch`-ugrásra nem állt. |

Az 1–4. hiba az ADR-008-ban bevezetett pozíciófüggetlenségből ered. A helyességi vázlat 1. lépése („a scope a sort a listájában tartja”) a nem reprezentált blokkok és a folytatósorok esetén nem állt fenn. Az 5–6. hiba a „pure nem dob” feltevés megsértése.

Két teljességi (2. típusú) hiba is előkerült:

- A `name()` constructorra nem adott nevet, ezért a constructor sosem volt szabad, holott az ADR-008 szerződése szerint az.
- A `declare` mező és a soha újra nem írt `let`/`var` feleslegesen kötött volt.

## Döntés

1. **Lezárás a projekcióban** ([generator.mjs](../../src/author/generator.mjs)):
   - Egy többsoros egységben „lyuk” van, ha valamelyik nem utolsó sora után a validátor nyitott scope-ja az egység saját scope-ja.
   - Lyukas egységnél minden azonos scope-ú testvéregység forrásbeli oldalára precedenciaél kerül. A redundáns éleket a meglévő tranzitív redukció eltávolítja.
   - Ez az egyetlen réteg, amely egyszerre ismeri a megtartott és elhagyott blokkokat és az egységhatárokat. Az utasítás- és a tagelemzés is erre támaszkodik.
2. **Overload-csoport egy egység:** az utasítás- és a tagelemzésben is. A csoport barrier, a lezárás kezeli.
3. **Dobásmentes tiszta olvasás:**
   - az olvasásnak a teljes deklaráció után kell állnia;
   - a más függvénykontextusból olvasott `let`/`const`/osztály nem tiszta;
   - a `case`-ágban deklarált kötés olvasása nem tiszta.
4. **Írási halmazok:**
   - a fájl összes értékadás-, `++/--`-, destrukturáló és `for-in/of` célpontját egy halmaz tartalmazza;
   - a halmazon kívüli `let`/`var` függvénykontextusban `const`-ként primitív operandus lehet;
   - szkriptszinten nem, mert a globális scope hivatkozás nélkül is írható.
5. **Osztálytagok:**
   - a constructor névhibája javítva, a constructor (paramétertulajdonságokkal együtt) szabad;
   - a `declare` mező szabad;
   - a TypeScript 5 emitje mindkét osztálymező-módban ellenőrizve: a paramétertulajdonság a constructor helyétől függetlenül a konstrukció elején jön létre.
6. **Orákulum P0:** a TS overload-szignatúrák szomszédossága explicit ellenőrzés (TS2389/TS2391).
7. **Új, additív policy-címke:** `scoped-effect-analysis-v5`. A régi modellek és címkék érvényesek; importkor nincs újraszámítás.

### Interfészbővítés

A `TypeMemberOrdering` új mezőt kap: `spans: {first, last}[]`. A `StatementOrdering.units` már létezett.

- **Rejtett tudás marad:** a tag- és utasításosztályozás.
- **Mit lát a generátor:** csak az egységhatárokat.
- **Hívó:** egyedül a generátor, más hívó nem változik.
- **Miért kell:** a „lyuk” csak a megtartott blokkok ismeretében dönthető el.

## Vizsgált alternatívák

- **„Nem a belsejében” kényszer OR-profilokkal:** elvetve. Egységpáronként két profil exponenciális profilszámot adna. Az `edges`/`profiles` jelentése nem változhat.
- **A validátor bővítése egységszomszédossággal:** elvetve. A validátor nyelvfüggetlen és változatlan marad.
- **Tiszta deklaráció kommutációja barrierrel** (ha a kötése nem szökik és a bemenetei stabilak): megvizsgálva, halasztva.
  - A korpuszon egyetlen szomszédos rést oldana fel (`ch-template-coercion`).
  - Teljes hivatkozás- és closure-szökéselemzést igényelne. A hibásan elfogadó eltérés kockázata nagyobb, mint a nyereség.
- **A más kontextusú TDZ-olvasás pontosabb kezelése:** halasztva, mert a mérés szerint a szigorítás egyetlen fixture-ön sem csökkentette az elfogadást.
  - Ilyen kezelés lehet a „may-throw” egységek egymáshoz és a szökő kötésekhez rendezése.

## Következmények

- A mérés eredménye: [formális szerződés, WP6](../formal-ordering-contract.md#wp6-javítás-mérés-és-regresszióvédelem).
- A lezárás miatt egy hoistolt függvény nem léphet át lyukas többsoros egységen. Ez szándékos completeness-veszteség: az új fixture-ökön 8 szomszédos rés marad.
- **Új regressziós tesztek:**
  - [wp6-regressions.test.mjs](../../tests/wp6-regressions.test.mjs): célzott ellenpéldák;
  - kiterjesztett véletlen programok: többsoros hívás, `} else {`;
  - [ordering-scale.test.mjs](../../tests/ordering-scale.test.mjs): determinisztikus korlátok 500 soros referenciákra.
- Meglévő teszt nem gyengült. A policy-címke 4 helyen v5-re változott, a rögzített completeness-alapvonal pedig javult (felülvizsgált frissítés).
