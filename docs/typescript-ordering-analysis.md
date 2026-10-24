# A UserAccount példa és a TypeScript sorrendszabályok

## Miért lett „Hibás” a képen?

A beküldött TypeScript program helyes; a képi átrendezés sem szintaktikai hiba miatt lett elutasítva. A [beküldött v2 modell](../public/samples/typescript/01-user-account.legacy.json) a sorokat teljes `1 → 2 → … → 13` láncba fűzte. A képen a class mezők (`6/7`) és a constructor értékadásai (`9/10`) fordítottak. Ezt a láncot a validátor helyesen elutasítja. A `dependencyHints` csak tájékoztató, nem helyettesíti a dependencies szabályokat.

A generátor régi `statementOrdering` algoritmusa a SourceFile/Block/ModuleBlock statement-listákat elemzi. Az interface/class member-listát nem lazította; a constructor két ExpressionStatement értékadása pedig mellékhatásos barrier maradt. Így a kezdeti soros előfeltételek teljesen megmaradtak. A `scoped-primitive-dag-v2` címke nem ígért minden TypeScript-konstrukcióhoz optimális vagy szemantikailag teljes gráfot.

Az interface két külön nevű adatmezőjénél ez indokolatlan szigorúság volt, ezt javítottuk. A class mezők és this-értékadások automatikus felcserélhetőségét viszont nem lehet biztonságosan általánosítani.

## Konkrét futásidejű ellenpélda

A rögzített referencia és a képi sorrend ugyanazt a `name` és `id` értéket adja, de:

| Megfigyelés | Referencia | Képi sorrend |
| --- | --- | --- |
| `user.name` | `Murphy` | `Murphy` |
| `user.id` | `1` | `1` |
| `Object.keys(user)` | `["name", "id"]` | `["id", "name"]` |

A teszt ezt a pinned TypeScript 5.8.3 compilerrel, ES2022 target mellett **useDefineForClassFields=false és true** esetén is igazolja. False esetén a törölt meződeklarációk helyett a constructor első property-írásai alakítják a sorrendet; true esetén a class field definíciók sorrendje számít. A tulajdonságok értékei ezért önmagukban nem elegendő ekvivalencia-orákulumok. Setter, öröklés, computed név, initializer és statikus blokk még további megfigyelhető hatást adhat.

A compilerbeállítás és a `declare` mezők szerepének hivatalos háttere: [TypeScript Classes – type-only fields és inicializálási sorrend](https://www.typescriptlang.org/docs/handbook/2/classes), [useDefineForClassFields](https://www.typescriptlang.org/tsconfig/useDefineForClassFields.html). A fenti konkrét eredményt a repository saját, korlátos tesztje méri; production/tanulói kódot nem futtatunk.

## Mit változtattunk?

A [strict TS projekció](../src/author/type-member-ordering.ts) a külön nevű, teljes egysoros interface-/type-literal adatmezőket és explicit `declare` class field sorokat engedi egy futamon belül cserélni. Az összes szabad mező a megelőző barrier után, a következő barrier/zárás az összes szabad mező után kell álljon. Kommentált/többsoros/duplikált/computed/numerikus tag, overload, accessor, rendes class field, this-értékadás és ismeretlen hatás konzervatív marad.

A UserAccount új gráfjában a 2. és 3. sor egyaránt `[1]` függőségű, a 4. sor mindkettőt igényli: `[2,3]`. A class és constructor többi sorrendje megmarad. A [friss generált modell](../public/samples/typescript/01-user-account.model.json) `schemaVersion: 2` marad; a `scoped-type-members-v3` az **elemzési politika verziója**, nem a feladatséma verziója. A teljes képi átrendezés továbbra is elutasított, az interface mezőcseréje elfogadott.

Külön [kézi name/id érték szerinti modell](../public/samples/typescript/01-user-account.values-only.model.json) is letölthető. Ennek explicit szerzői célja csak a két property értéke; a kulcssorrend kizárt megfigyelés. Ez mind a nyolc cserekombinációt, így a teljes képi sorrendet is elfogadja, mindkét compilerbeállítás mellett ellenőrzött name/id értékekkel. Nem a generátor által bizonyított általános ekvivalencia, nem alkalmazható automatikusan setteres/öröklött/mellékhatásos osztályokra. A forrás újragenerálása vagy függőségfrissítés visszaállítja az alapértelmezett konzervatív szabályokat.

Normál JSON-import nem módosítja a régi láncot. Az **Adatmodell → Sorfüggőségek újraszámítása** explicit művelet az új szabályokra frissíti, megtartva kódot/ID-t/fixedet/blokkokat/kézi éleket/profilokat. Az authoring note a szerzői nézetben és a hibajelentés lenyitható „Generált sorrendszabályok” részében magyarázza az elemzést. A note nem konkrét hibasor-diagnózis és nem grading-szabály; importból származó szövegként HTML-escape-et kap. A learner preview nem mutatja ezt a szerzői részletet.

A beküldött cím/leírás egy másik, a/b/c/note feladatról szól. Ez metaadat, nem határoz meg előfeltételt vagy fixed helyet. Mind a 13 sor `fixed: false`, tehát a leírás ellenére egyik sincs abszolút helyre rögzítve; a függvényhatárt a scope/dependency védi. A forrásfájl betöltése megőrzi a kézzel szerkeszthető címet/leírást, de most külön jelzi, hogy ezeket ellenőrizni kell.

## Hozzáférhető példatár és tesztmátrix

A **Referenciaforrás → TypeScript példatár** link 24 forrás/modell párt kínál. Lokálisan: `http://localhost:5173/samples/typescript/index.html`; Pages alatt a projekt alapútvonalán belüli `samples/typescript/index.html`. A [helyi példatár](../public/samples/typescript/index.html), [gépi esetlista](../public/samples/typescript/suite.json) és mindegyik `.ts`/`.model.json` fájl közvetlenül is elérhető. A JSON importálható; a source újraalkalmazása a generátort hívja. A fixed/profil példa kézi szabályait csak a JSON hordozza.

Lefedett csoportok: interface/type literal, declare, readonly/optional/Unicode/idézett név, mezőinitializálás, constructor read/write, ismételt írás, setter, öröklés/super, computed/static/privát tag, paraméterproperty, overload, duplikált név, komment/JSDoc, multiline típus/literál, namespace/generic, primitív DAG, shared else határ, fixed hely és OR profil.

- A [Node-mátrix](../tests/typescript-member-ordering.test.mjs) minden publikált példa referenciáját, megnevezett elfogadott/tiltott cseréjét és a kijelölt kis futamok összes permutációját ellenőrzi, v2/v3 bridge-paritással. Három ötsoros mintán összesen 360 teljes fizikai permutáció fut; a képi példa mind a 169 egyetlen soráthelyezése külön tartalmi orákulummal ellenőrzött, az indent-normalizálást és azonos kapcsos zárójelek bijekcióját is figyelembe véve.
- További vegyes minták védik az inline/kommentes/többsoros/duplikált/overload/decorator/static/abstract/accessor határokat. Az 500 soros limitet és 498 mező fordított sorrendjét is ellenőrizzük. A UserAccount interface/class/constructor cseréinek mind a nyolc kombinációját a két compilerbeállítás futási eredményével vetjük össze; pontosan két kombináció megengedett. Külön vegyes teszt kapcsolja össze az új típusmező-DAG-ot a fixed hellyel, közös élekkel, OR profilokkal, sourceLine metaadattal, tartalmi multiplicitással, ASCII/Unicode whitespace-szel és indeterminate budgettel.
- A pozitív publikus források teljes strict TypeScript-típusellenőrzést kapnak. A külön megjelölt 13. negatív példa szándékos TS2300; ez bizonyítja, hogy a generátor syntax auditja nem teljes típusellenőrzés. Ez a negatív típusminta szintaktikailag befogadható, ezt a példatár egyértelműen jelzi.
- A [valódi Chromium-mátrix](../tests/browser-typescript.playwright.py) Node-on és Pages-alútvonalon külön-külön mind a 24 modellt, egy kézi változatot és 79 elfogadási/elutasítási esetet vizsgálja. A képi példa tényleges source-file/Apply/editor/check útja, a policy-magyarázat, learner izoláció és a JSON-letöltés is ellenőrzött. A 104 API-kérés hostonként a valódi rate limiten belül marad.
- A CI a példatárat ugyanabból a manifestből és source-okból újraépíti; `git diff --exit-code` védi a modellek és a HTML egyezését is. A négy régi trusted példa nem változik.

Futtatás: `npm run check:all`, majd `npm run test:browser:all`; a célzott böngészőkör `npm run test:browser:typescript`. A konkrét eredményeket a `test-results/typescript-matrix.json`, a Node-logok és a browser-képernyőképek adják. Ez a véges, megnevezett szabálymátrix széles regressziós alap; nem a TypeScript minden grammar-/compiler-/programkombinációjának bizonyítása. [ADR-007](adr/007-typescript-erased-member-ordering.md).
