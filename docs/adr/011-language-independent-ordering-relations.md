# ADR-011 – Nyelvfüggetlen sorrendi relációk az adapter és a v2-projekció között (WP7)

Állapot: implementálva. Viselkedésmegőrző: mind a 167 generált modell bájtra azonos a módosítás előtt és után. A vizsgált halmaz a teljes korpusz, 80 véletlen program, a 4 nagy referencia és a 24 TS-minta. A validátor, a séma és a tanulói határ változatlan.

## Kontextus

A WP7 azt vizsgálta, milyen belső eredményt adhat át a szemantikai elemző a nyelvfüggetlen modellgenerátornak. A vizsgálat előtti állapot:

- A `generator.mjs`, amely a CodeLine v2-projekció, közvetlenül importálta a TS-specifikus [type-member-ordering](../../src/author/type-member-ordering.ts) modult, és a TypeScript AST-vel hívta. A gráfredukciót a [statement-ordering](../../src/author/statement-ordering.ts) modulból vette.
- A két elemzés eredményét implicit „későbbi felülírja” szabállyal fésülte össze, és a lezárást (ADR-009) is maga végezte.
- Az adapterhatáron csak a `statementOrdering` haladt át, így egy új nyelv nem adhatott tagszintű relációt a generátor módosítása nélkül.

A natív Language IR / CodeLine v3 út (ADR-003, `LanguageEngine`) ettől független. A JS/TS ma a `legacy-v2-projection` stratégiával, ezen a projekción át jut el a v3-ig.

## Döntés

A meglévő adapterhatárt használjuk, egyetlen szűk, típusos belső szerződéssel. Új AST- vagy IR-keretrendszer nem készül.

1. **[ordering-relations.ts](../../src/author/ordering-relations.ts)**, nyelvfüggetlen, parser- és TS-import nélkül:
   - `OrderingRelations {entries, protectedInputs, spans, note}` 0-alapú fizikai sorokon:
     - **`entries`:** kötelező előzmények (konjunkció);
     - **`protectedInputs`:** a redukcióban megtartott értékbemenetek;
     - **`spans`:** oszthatatlan egységhatárok;
     - **`note`:** szerzői magyarázat, nem értékelési szabály.
   - **`combineOrderingRelations`:** független elemzések konjunkciója, unióval.
   - **`sealMultiRowUnits`:** az ADR-009 lezárása, a projekció adatain.
   - **`reduceGeneratedDependencies`:** áthelyezve.
2. **[js-ts-ordering.ts](../../src/author/js-ts-ordering.ts)**, a JS/TS adapter sorrendi képessége:
   - az utasítás- és a tagelemzést egyetlen `OrderingRelations`-szé kapcsolja össze;
   - a két elemzés diszjunkt sorokat köt; ezt a teljes korpuszon teszt ellenőrzi, így az unió azonos a korábbi felülírással.
3. **Adapter-metódus:** `orderingRelations(tree, infrastructure)` váltja a `statementOrdering`-et a [nyelvi regiszterben](../../src/author/languages.mjs).
4. **A generátor** csak projekció. A blokk- és scope-hierarchiát (megtartott és elhagyott blokkok, `scopeId`, `functionBlock`) és a fizikai sor → sorazonosító leképezést birtokolja. Nyelvi modult nem importál.
5. **Architektúrakapu:**
   - a generátor kizárólag a `dist/author/ordering-relations.js` modult importálhatja;
   - a JS/TS-elemzést kizárólag a `languages.mjs` kötheti be;
   - a két korábbi kivétel (generátor → `type-member-ordering`, illetve → `statement-ordering`) megszűnt.

A Pages-build ugyanezt a két útvonalat vetíti át.

### Rétegek

| Réteg | Tulajdonos | Interfész |
| --- | --- | --- |
| Nyelvspecifikus AST | adapter (`parse`) | átlátszatlan fa, csak az adapter metódusai kapják |
| Kötés- és hatáselemzés | `statement-ordering.ts`, `type-member-ordering.ts` | `OrderingRelations` |
| Közös sorrendi relációk | `ordering-relations.ts` | konjunkció, lezárás, redukció |
| Blokk- és scope-hierarchia | adapter `structure` + generátor | `{start, end, kind}` intervallumok |
| CodeLine v2-projekció | `generator.mjs` | `CodeLineExercise` |

### Mi marad rejtve, ki változik, miért kell

- **Rejtve marad:** a TypeScript AST, a szimbólumfeloldás és a hatásosztályok az adapterben vannak, a generátor ezekről semmit nem tud.
- **Változó hívók:** a generátor, a nyelvi regiszter, a Pages-build és az architektúraszabály. Más nem változik.
- **Indok:** egy új nyelv csak `orderingRelations`-t ad; a projekció, a lezárás és a redukció újrahasznosítható. Egy játéknyelvi adapter tesztje igazolja ([ordering-relations.test.mjs](../../tests/ordering-relations.test.mjs)).

## Vizsgált alternatívák

- **Teljes, általános AST/IR-keretrendszer:** elvetve; spekulatív.
- **A generátor teljes TS-migrációja:** nem része a WP7-nek (ADR-001 P4). Csak a nyelvfüggetlen sorrendi logika került típusos modulba.
- **A Python adapter v2-projekción át:** elvetve. A Python natív IR v3-on megy (behúzásblokk záró sor nélkül, összefüggő `MovableUnit`). A szerkezeti feladatok: [Python-terv](../python-adapter-plan.md#illeszkedés-a-közös-sorrendi-szerződéshez-wp7-adr-011).
- **Python → JS transzpiláció vagy Beautify-alapú wrapping:** kizárva.

## Következmények

- Viselkedés és mérés változatlan: azonos modellek, azonos policy-címke (`scoped-effect-analysis-v6`).
- **Architektúra-tesztek:** az új, szigorúbb határ szerint frissültek, a korábbi engedélyek szűkültek, nem tágultak.
- **Új teszt:** [ordering-relations.test.mjs](../../tests/ordering-relations.test.mjs). Ellenőrzi a konjunkciót, a lezárást, a redukciót, a diszjunkt sorokat és egy nem TypeScript-alapú adapter projekcióját.
- **Nyitott:** a generátor maradék MJS-része (sorleképezés, blokkmegtartás) az ADR-001 migrációs listáján marad. *Utóirat:* az ADR-013 ezt a részt a típusos [code-line-projection.ts](../../src/author/code-line-projection.ts) modulba vitte; a `generator.mjs` azóta csak belépési pont.
