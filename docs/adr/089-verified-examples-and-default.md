# ADR-089 – Minden példa igazolt, az alapértelmezés `verified-only` (NY-09, NY-10)

Állapot: **elfogadva** (2026-11-04). Pedagógiai és publikálási döntés, a felhasználó döntése szerint: „igazolt szabály, forráscsere, nincs éles telepítés”. Felülírja az [ADR-057](057-example-migration-and-publication-default.md) 2–4. pontját. Lezárja a [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-09 és NY-10 tételét, valamint a [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 1. fázisának 4. lépését. A szabályverzió nem változik (`scoped-effect-analysis-v50`).

## Kontextus

Az öt példából három „Nem igazolt” volt. A v50-es újramérés ([eltéréslista](../peldak-migracioja.md#újramérés-v50-2026-11-04--döntésre-vár-ny-09-ny-10)) megmutatta:
- **`class-accounts-ts`:** a frissítés a tanár 480 sorrendjéből 360-at utasítana el. Az ADR-057 az öröklés modellezésére várt, de az ok más: a metódustörzs `this.…` sorai általános utasításgátak. A tanári csere (`this.balance += amount` és `this.history.push('+' + amount)`) csak számbemenetre azonos. Egy `valueOf`-ot futtató összeg mellett a két sorrend más egyenleget ad.
- **`algo-sort-search-js`:** helyben frissítve nem igazolt (a mai generátor egy blokkal többet lát), a forrásból újragenerálva igazolt, döntésváltozás nélkül.
- **`profiles-js`:** a `first(); middle(); last();` ismeretlen hívások sorrendje futáskor számít, ezért a „fordított” profil a generált szabállyal körkörös.

## Döntés

1. **`class-accounts-ts`: igazolt szabály**, revízió 3, `analysis-verified`, az alapszerződéssel (`any`).
   - **Elvesztett elfogadás:** a 6/7 és a 13/14 csere. A leírás már nem ígéri, hanem megmondja, miért kötött: egy nem szám összeg mindkét sorban kódot futtathat.
   - **Új elfogadás:** a két mező (`balance`, `history`) egymáshoz és a többi taghoz képest szabad.
   - **A `valid` szerződés elvetve:** ugyanazt adta volna, de ott az elutasítás a generátor bizonyítatlan rése lenne, nem valódi ok.
2. **`algo-sort-search-js`: újragenerálva a forrásból**, revízió 2, `analysis-verified`.
   - A tanár mindhárom cseréje elfogadott marad.
   - A 4 régi kézi él fölösleges.
3. **`profiles-js`: forráscsere**, revízió 2, `author-modified`.
   - Az új forrás három független `const` deklaráció és egy `return`, amely mindhármat olvassa. A generált szabály a három deklarációt szabadon hagyja; a két profil (előre és fordítva) szerzői szűkítés.
   - A régi modell tesztfixture lett: [`tests/fixtures/legacy-examples/profiles-js.json`](../../tests/fixtures/legacy-examples/profiles-js.json). A régi, igazolás nélküli modellek tesztjei onnan olvassák.
4. **Az alapértelmezés `verified-only`.**
   - Egyetlen helyen él: a mag `DEFAULT_PUBLICATION_POLICY` értéke ([model-verification.ts](../../src/core/model-verification.ts)). A `publicationRefusal`, a `publicationPolicy` (beállítatlan `CODELINE_PUBLICATION`), az `ExerciseCatalog.open` és a `publishExamples` onnan olvassa.
   - A `publishable` csak kifejezett `CODELINE_PUBLICATION=publishable` beállítással érhető el. A szerver és a Pages-build ilyenkor „Örökölt publikálási mód” figyelmeztetést naplóz (`publicationNotice`).
   - **A felhasználó szerint nincs éles telepítés** régi tanári feladatokkal, ezért az átállás egyetlen kiszolgált feladatot sem tüntet el.

## Mérés

- **`class-accounts-ts`:**
  - a tanár 480 sorrendjéből 120 elfogadott marad (az öt tag minden sorrendje), 360 elutasított;
  - 1 631 vizsgált sorrendből 8 új elfogadás, mind helyes;
  - a modell 10 080 lineáris kiterjesztése (eddig 20 160) mind elfogadott, és a futási próba kimerítően (`ORACLE_EXHAUSTIVE=1`) mindet ekvivalensnek találja.
- **`algo-sort-search-js`:** 1 162 egysoros áthelyezés és csere közül egyetlen döntés sem változik; a tanár három cseréje elfogadott.
- **`profiles-js`:**
  - profil nélkül `analysis-verified`, a két profillal `author-modified`;
  - a fordított sorrend elfogadott, egy vegyes csere elutasított ([code-line.test.mjs](../../tests/code-line.test.mjs)).
- **Katalógus:** alapértelmezéssel mind az öt példa kiszolgálva (3 `analysis-verified`, 2 `author-modified`), 0 kihagyva.

## Bizonyíték

- [catalog-publication.test.mjs](../../tests/catalog-publication.test.mjs):
  - az alapértelmezés minden példát kiszolgál a várt minősítéssel;
  - a régi modelleket érintetlenül kihagyja, és csak `publishable` mellett szolgálja ki;
  - egy újabb frissítés egyik példán sem változtat;
  - csak régi modellekkel a katalógus nem indul el (fail-closed).
- [publication-gate.test.mjs](../../tests/publication-gate.test.mjs): a beállítatlan szabály `verified-only`; az „örökölt” figyelmeztetés csak `publishable` mellett jelenik meg; a Pages-közzététel rekordja az alapszabályt nevezi meg.
- [complex-scope-ordering.test.mjs](../../tests/complex-scope-ordering.test.mjs): a `class-accounts-ts` kiterjesztései (10 080) és a két megváltozott eset (a mezőcsere szabad, az egyenleg–napló csere kötött).

## Tervezési review (ADR-037)

- **Tulajdonos:** az alapértelmezés tudása eddig négy helyen volt leírva (mag, szabályfeloldó, katalógus, Pages-közzététel). Most egyetlen konstans a magban, mert a publikálási szabály ott van (ADR-027). A szerver- és a szkriptréteg nem tart párhuzamos értéket.
- **Interfész:** a mag egy konstanssal (`DEFAULT_PUBLICATION_POLICY`), a szerverkatalógus egy függvénnyel (`publicationNotice`) bővült. Mindkettőt a kompozíciós gyökerek olvassák (`server.mjs`, `build-pages.mjs`).
- **Design twice:**
  - *A `publishable` mód teljes eltávolítása:* elvetve. Egy régi telepítés frissítése közben átmeneti kapcsolóként kell, és a fail-closed teszt is erre épül.
  - *A régi `profiles-js` megtartása a példák között, új azonosítóval:* elvetve. A tanulók előtt egy futáskor sorrendfüggő „fordított” profil félrevezető tananyag. A régi modell tesztfixture-ként él tovább.
