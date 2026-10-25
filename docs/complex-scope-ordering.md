# Összetett JS/TS sorrend- és scope-mátrix

A [tests/complex-scope-ordering.test.mjs](../tests/complex-scope-ordering.test.mjs) azt vizsgálja, hogyan viselkedik a generátor és a validátor valós algoritmusokon, osztályszerkezeteken és a scope-ok közötti sorthelyezéseken. A futtatás csak rögzített tesztfixtúrákon történik; tanulói beküldést a termék továbbra sem futtat és nem parse-ol.

## Orákulum

Minden elrendezést két független szemszögből osztályozunk:

- **Validátor:** `validateSubmission` a generált vagy a könyvtári modellel (`accepted`/`rejected`).
- **Futási próba:** az elrendezett kód Node `vm`-ben, 100 ms-os időkorláttal, rögzített bemenetekkel fut. TypeScriptnél `transpileModule` mindkét `useDefineForClassFields` beállítással fut, és a szintaktikai diagnosztika is eltérésnek számít. Ha a JSON-kimenet (és a `record()` napló) egyezik a referenciáéval, az elrendezés *próba szerint ekvivalens*.

A próba bizonyíték, nem bizonyítás: csak a megadott bemenetekre igaz. A metódusok definíciós sorrendje reflexióval (`Object.getOwnPropertyNames(prototype)`) megfigyelhető volna, ezt a próbák szándékosan nem vizsgálják.

A három lehetséges kimenet:

| Validátor | Próba | Jelentés |
| --- | --- | --- |
| elfogad | ekvivalens | támogatott rugalmasság |
| elutasít | eltér | indokolt elutasítás |
| elutasít | ekvivalens | **ismert konzervatív korlát** |
| elfogad | eltér | hibás elfogadás – minden tesztben tiltott |

## Lefedett forgatókönyvek (generált modellek)

Tizenöt forrás, 73 elnevezett változat:

- külső konstans és ciklusmag: kezdeti deklarációk permutációi, konstans áthelyezése a ciklusmagba, belső deklaráció kiemelése, akkumulátor a ciklusba, TDZ, return a ciklusban;
- háromszintű blokkok árnyékolással: szintenkénti cserék, cserék két scope között, kiemelés és lejjebb helyezés, duplikált deklaráció;
- `var` és függvény-hoisting, felső szintű függvények sorrendje;
- closure késleltetett olvasással;
- `else if` lánc megosztott `} else {` határokkal;
- címkézett ciklusok, `continue`/`break`, `try/catch/finally`, `switch` esésekkel;
- destrukturálás, objektumliterál, template literál;
- JavaScript osztály mezőinicializálással és metódusokkal;
- TypeScript interface/type literal tagok, `enum`, `declare` mező, paraméterproperty, öröklés és `super`, típusannotált metódusváltozók.

Emellett minden forrás **minden egysoros áthelyezését és páros cseréjét** (forrásonként 33–713 különböző elrendezés) ellenőrizzük: egyetlen elfogadott elrendezés sem viselkedik másként.

## Bal oldali feladatkönyvtár

A három legegyszerűbb példát (`sum-js`, `sum-ts`, `dependencies-js`) négy összetett feladat váltotta. A régi modellek változatlanul a [tests/fixtures/legacy-examples](../tests/fixtures/legacy-examples/sum-js.json) mappába kerültek, így az eddigi regressziók ugyanazzal az erősséggel futnak. A `profiles-js` (alternatív OR-profilok) a könyvtárban maradt.

| Feladat | Tartalom | Engedélyezett teljes sorrend |
| --- | --- | --- |
| `algo-bfs-js` | szélességi keresés rácson, sor, `Set`, `continue`, rögzített függvényhatár | 960 |
| `algo-sort-search-js` | beszúrásos rendezés és bináris keresés, két felső szintű függvény, `} else {` | 8 |
| `class-accounts-ts` | absztrakt osztály, védett mezők, paraméterproperty, öröklés, `super` | 192 |
| `class-inventory-ts` | interface, generikus megszorítás, privát `Map`, három metódus | 288 |

A könyvtári modellek a generátor kimenetéből készültek, majd szerzői finomhangolást kaptak: csak olyan függőségeket lazítottunk, amelyek a próba szerint nem változtatnak a viselkedésen (független kezdeti deklarációk, független állapotfrissítések, metódus- és függvénydeklarációk sorrendje, típus a használat után). A teszt a validátortól függetlenül felsorolja a modell **összes** lineáris kiterjesztését. Mindegyiket a validátor elfogadja, és a futási próba ekvivalensnek találja. Minden más szomszédos elrendezést a validátor elutasít.

## Eredmény és ismert korlátok

Az eredmény az [ADR-008](adr/008-effect-based-statement-ordering.md) hatáselemzése és az [ADR-009](adr/009-sealed-units-and-throw-free-reads.md) javításai után: 30 elfogadott ekvivalens változat, 36 indokolt elutasítás, 7 ismert konzervatív korlát, és **nulla hibás elfogadás**. (A régi generátorral 16/36/21, az ADR-008 után 29/36/8 volt; minden felszabadult változatot a futási próba ekvivalensnek igazol, a WP6-ban a `declare` mező a futásidejű mezők elé kerülhet.) A generált modellek söprése minden elfogadott elrendezést ekvivalensnek talált.

A konzervatív korlátok két okra vezethetők vissza:

1. **Scope-tulajdonlás.** A validátor minden sort pontosan a referencia lexikai scope-jához köt (`docs/architecture.md`, nem alku tárgya). Ezért egy deklaráció *eggyel beljebb vagy kijjebb* helyezése akkor is elutasított, ha a program ugyanazt csinálja (pl. `const step = 2;` a ciklusmagba a használat elé, `offset` kiemelése a külső blokkba). Ezt csak a modell bővítésével lehetne feloldani: soronként engedélyezett scope-halmaz és ehhez tartozó szerzői analízis kellene, ADR-rel.
2. **Konzervatív generátor.** Az ADR-008 óta a tiszta deklarációk (friss literál, closure, kötésolvasás, `let x;`), a hoistolt függvény- és típusdeklarációk, valamint az osztálymetódusok is szabadon mozognak a saját listájukban. Hívás, tulajdonságolvasás, destrukturálás, nem primitív operandus, ciklus és minden írás továbbra is barrier. Ezért a generált BFS-modell szomszédságában még mindig csak 1 elrendezés elfogadott (`grid.length`, `new Set`, `queue.shift()`); a könyvtári változatban a szerző kézzel engedte meg a 960 sorrendet. A szabályok: [formális sorrendi szerződés](formal-ordering-contract.md).

Futtatás: `node --test tests/complex-scope-ordering.test.mjs` (a `npm run check:all` része). A diagnosztikai sorok forgatókönyvenként kiírják a szomszédos elrendezések, elfogadások és konzervatív elutasítások számát.
