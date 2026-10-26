# Nyelvi adapterek

Az alábbi API a meglévő v2 JS/TS folyamat kompatibilitási határa. Az új, opt-in Language IR v1 / CodeLine v3 author engine typed regisztere és bridge-je: [implementációs szerződés](language-engine-contract.md), [ADR-003](adr/003-language-ir-and-codeline-v3.md). Pythonhoz ezt a natív IR portot kell implementálni; a v2 nyelvlistát nem kell emiatt hallgatólagosan bővíteni. A meglévő UI/API/persistence v2 marad.

A `registerLanguageAdapter(id, adapter)` és `getLanguageAdapter(id)` a szerzői nyelvkezelés nyilvános API-ja. A regisztráció ellenőrzi a szükséges metódusokat és tiltja a névütközést. JavaScript és TypeScript működő adapterrel rendelkezik; új nyelvek nem kész implementációk.

| Metódus | Feladat |
| --- | --- |
| `parse(source, infrastructure)` | Nyelvspecifikus szintaktikai audit, soha nem programfuttatás |
| `format(source, infrastructure)` | Teljes szerzői dokumentum formázása |
| `tokenize(tree, infrastructure)` | Nyelvi tokenek, nem regexes forráshelyettesítés |
| `structure(tree, infrastructure)` | Fizikai nyitó/záró sorok és blokkfajták |
| `whitespace(tree, infrastructure)` | Olyan fizikai sorok halmaza, amelyek payloadja `exact` kezelést igényel |
| `analyzeDependencies(tree, infrastructure)` | Opcionális deklaráció/használat-jelzések, szerzői támpontként |
| `orderingRelations(tree, infrastructure)` | Opcionális, nyelvfüggetlen [`OrderingRelations`](../src/author/ordering-relations.ts) 0-alapú fizikai sorokra: kötelező előzmények, védett értékbemenetek, egységhatárok és szerzői megjegyzés ([ADR-011](adr/011-language-independent-ordering-relations.md)) |
| `declarationGroups(tree, infrastructure)` | Korábbi, kompatibilitásból megtartott lokális támpont; a generátor már az `orderingRelations` eredményét használja |

A beépített JS-adapter Acornt és TypeScript AST-t használ; a TS-adapter a TypeScript infrastruktúráját. A generátor és a szerver formázó végpontja a regiszteren át választ adaptert. A frontend részleges JS/TS behúzója önálló, toleráns megjelenítési réteg; ez nem teszi a TypeScript compilert kötelezővé tanulói szerverértékeléskor.

Új nyelvhez önálló parser/formatter/tokenizáló szükséges. A közös AST-intervallum eredmény és a whitespace-policy szerződéséhez kell illeszteni. Ezenkívül szándékosan bővíteni kell a CodeLine v2 Schema és a TypeScript exercise-típus nyelvlistáját, valamint a UI nyelvválasztóját és megjelenítési adapterét. A strukturális validátor belső keresése ettől változatlan marad. A belső ExerciseDefinition nyelvmezője már bővíthető.

Python esetén minden szintaktikailag jelentős behúzást `exact` módban kell kezelni, vagy külön, bizonyítottan megfelelő normalizálást bevezetni egy új sémaverzióban. Nem engedett automatikusan a JS/TS `indent` módját ráalkalmazni. Más nyelvet nem fordítunk JavaScriptre a Beautify használatához.

Az adapterregisztráció és a metódusszerződés külön tesztet kap; a JS/TS adapterek tényleges formázási/generálási/értékelési integráción is átesnek. Az importált külső adapter kódja megbízható alkalmazáskód, nem a tanuló által feltölthető plugin.

A közös `dependency-analysis.mjs` böngészőben is működő compiler hosttal oldja fel a kötéseket. A strict TypeScript [statement-ordering](../src/author/statement-ordering.ts) hatásösszegzésen alapuló, kompozicionális elemzése csak a szerzői generáláskor fut ([ADR-008](adr/008-effect-based-statement-ordering.md), [formális szerződés](formal-ordering-contract.md)).

**Rétegek** ([ADR-011](adr/011-language-independent-ordering-relations.md)):

| Réteg | Hol | Mit rejt el |
| --- | --- | --- |
| Nyelvspecifikus AST | adapter `parse` (JS/TS: TypeScript compiler AST) | grammar, parserdiagnosztika |
| Kötés- és hatáselemzés | [statement-ordering.ts](../src/author/statement-ordering.ts), [type-member-ordering.ts](../src/author/type-member-ordering.ts), összefogva: [js-ts-ordering.ts](../src/author/js-ts-ordering.ts) | szimbólumfeloldás, TDZ, írási halmaz, hatásosztályok, reflexiós kulcssorrend |
| Közös sorrendi relációk | [ordering-relations.ts](../src/author/ordering-relations.ts) | konjunkció, lezárás (ADR-009), tranzitív redukció; nyelvi szabályt nem ismer |
| Blokk- és scope-hierarchia | adapter `structure` → generátor | megtartott és elhagyott blokkok, `scopeId`, `functionBlock` |
| CodeLine v2-projekció | [code-line-projection.ts](../src/author/code-line-projection.ts), belépési pont: [generator.mjs](../src/author/generator.mjs) | fizikai sor → sorazonosító, blokk- és scope-hierarchia, klauzulaláncok (ADR-013), lezárás, redukció; a generátor csak bemenetet ellenőriz és policy-címkét ad |

A generátor csak a nyelvfüggetlen modult importálja, a JS/TS-elemzést pedig kizárólag a nyelvi regiszter köti be. Ezt az architektúrakapu gépileg ellenőrzi. A tanulói értékelő továbbra is a megbízható modell DAG-ját és a tartalmi bijekciót vizsgálja; nem futtat vagy parse-ol tanulói kódot.
