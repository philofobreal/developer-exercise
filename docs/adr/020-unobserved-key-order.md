# ADR-020 – A metódusok és a felső szintű függvények kulcssorrendje csak reflektáló programban kötött

Állapot: implementálva (`scoped-effect-analysis-v11`). A validátor, a CodeLine-séma jelentése, a tanulói parsermentes értékelés és a bizalmi határ változatlan. A már importált modellek függőségei nem generálódnak újra.

## Kontextus

Az ADR-010 (P4) a megfigyelhető állapot részévé tette a reflektálható kulcssorrendet:

- az osztályok prototípusának és konstruktorának saját kulcsait;
- a klasszikus szkript globális objektumának `function`/`var` kulcsait.

Ezért a generátor két dolgot kötött:

- a különböző nevű metódusok és accessorok egymás közti sorrendjét (kulcslánc);
- a szkriptszintű függvénydeklarációk egymás közti és a `var`-okhoz viszonyított sorrendjét.

A gyakorlatban ez túl szigorú:

- A `sort-search` könyvtári feladat leírása szerint a két függvény sorrendje szabad, a generált modell mégis kötötte.
- Egy JavaScript-szakember a függvénydeklarációk és a metódusok sorrendjét felcserélhetőnek tartja: a függvények hoistolódnak, a metódusok mind létrejönnek, mielőtt bármelyik futna.
- A különbséget csak az látja, aki kifejezetten listázza a kulcsokat.
  - **Metódusok:** az osztálymetódus és az accessor nem felsorolható (`enumerable: false`), ezért az `Object.keys`, a `for…in` és a `JSON.stringify` nem mutatja. Csak az `Object.getOwnPropertyNames`, a `Reflect.ownKeys` és az `Object.getOwnPropertyDescriptors` látja.
  - **Függvények:** a szkriptszintű függvény a globális objektumon keresztül látszik (`Object.keys(globalThis)`).

A felhasználó döntése (2026-10-27):

- a felső szintű függvények és az osztálymetódusok sorrendje legyen szabad;
- a példánymezőké maradjon kötött.

## Döntés

### 1. A P4 pontosítása

**Továbbra is megfigyelt** a felsorolható kulcsok sorrendje:

- a példánymezők (paramétertulajdonságokkal);
- a static mezők;
- a szkriptszintű `var`-ok, valamint a TypeScript által `var`-ként kibocsátott `enum`, példányosított `namespace` és `import =`.

**Halmazként hasonlítódik** a nem felsorolható kulcsok köre: metódusok, accessorok, `accessor` mezők párja a prototípuson, és a szkriptszintű függvénydeklarációk. A kulcsok megléte és descriptor-fajtája számít, a létrehozási sorrendjük nem.

**Kivétel: a program maga reflektál.** Ha a referencia forrásszövegében bárhol (kommentben vagy stringben is) szerepel a következők egyike:

- `getOwnPropertyNames`, `ownKeys`, `getOwnPropertyDescriptors`, `Reflect`;
- `globalThis`, `window`, `self`, `frames`, `global`, `Function`, `eval` (az indirekt `eval` a globális objektumot látja);

vagy szkriptszinten `this` áll (ott a globális objektum; az arrow függvény ezt örökli), akkor az ADR-010 szerinti teljes kulcssorrend érvényes. Ez konzervatív: a véletlen névegyezés csak szigorít.

### 2. A generátorban

A [js-ts-ordering.ts](../../src/author/js-ts-ordering.ts) `observesKeyOrder` függvénye dönti el, megfigyelheti-e a program a kulcssorrendet. Az eredményt `reflectedKeys` opcióként mindkét elemző megkapja:

- **[type-member-ordering.ts](../../src/author/type-member-ordering.ts):** az ADR-010 kulcslánc csak `reflectedKeys` esetén épül. A mezők fázis szerinti sorrendje (ADR-012) változatlan.
- **[statement-ordering.ts](../../src/author/statement-ordering.ts):** a `script-global-order` kényszer egy hoistolt függvénydeklarációra csak `reflectedKeys` esetén vonatkozik. A `var` és a kibocsátott `var` lánca változatlan.
- **Overload-csoport:** a sima sorokból álló, máshol elő nem forduló nevű csoport egyetlen metódusdefiníció, mert a szignatúrák törlődnek. Az elemzés szerint így szabad. A v2-projekció lezárása (ADR-009) azonban a többsoros, lyukas egységet a forrásbeli oldalán tartja; ezt a projekciós veszteség méri (ADR-017).

### 3. Az orákulumban

A [semantic-oracle.mjs](../../tests/support/semantic-oracle.mjs) P4-e független implementációval követi a szabályt:

- **Szintaktikus rész:** a kulcslisták `keySet`/`classOrder`/`globalOrder` szerint.
- **Futásidejű pillanatkép:** a nem felsorolható kulcsok rendezve, a felsoroltak sorrendben; a függvényglobálisok rendezve.
- **Reflektáló program:** a `reflectsKeys` (névlista, illetve Acorn/TS-AST-alapú szkriptszintű `this`-keresés) esetén a régi, teljes sorrend érvényes.

## Helyesség

**Nem reflektáló program:**

- Egy metódus vagy függvény kulcsának helye csak a fenti API-kon vagy a globális objektumon át figyelhető meg. Ezek egyikét sem nevezi meg a program.
- A program által futtatott kód sem érheti el őket név nélkül: a közvetlen `eval` és a `with` eddig is elemzetlenné tette a fájlt, a `Function`, az indirekt `eval` és a dinamikus kulcsnévvel hívható `Reflect` pedig a névlistán van.
- A hívások eredménye nem függ a definíciók sorrendjétől: a függvények a lista elején jönnek létre, a metódusok minden mezőinicializáló és static kód előtt (ADR-008, ADR-012).
- A duplikált nevű tag vagy függvény továbbra is kötött, mert ott a későbbi felülírja a korábbit.

**A megfigyelési modell határa:** egy külső megfigyelő (például egy másik szkript vagy a tesztelő probe) nem része a feladatnak. Az ADR-010 előtti „call-only” politika ugyanígy nem tekintette annak.

## Következmények

- **Policy-címke:** `scoped-effect-analysis-v11` (additív sémabővítés).
- **Könyvtári példák** (revision 2): a `class-inventory-ts` és a `class-accounts-ts` kézi modelljében a konstruktor és a metódusok már nem kötöttek a mezőkhöz, illetve a konstruktorhoz. Az engedélyezett teljes sorrendek száma 288 → 5 760, illetve 192 → 20 160. Mindegyik egyszer kimerítően, futásidejű orákulummal ellenőrizve ekvivalens. A rendszeres teszt 1 000 felett rögzített mintán futtat (`ORACLE_EXHAUSTIVE=1` esetén mindet).
- **Tesztek:** a régi P4-et rögzítő tesztek kétfelé bontva:
  - a kívülről megfigyelt csere elfogadott;
  - ugyanaz reflektáló programban elutasított.
- **Új teszt:** [key-order-observation.test.mjs](../../tests/key-order-observation.test.mjs).
- **Mérés:** a [formális szerződésben](../formal-ordering-contract.md#adr-020-a-metódusok-és-függvények-kulcssorrendje).
- **Maradó konzervatív döntések:**
  - a példánymezők (az `accessor` mező is) egymás közti sorrendje;
  - az overload-szignatúrák egymás közti sorrendje;
  - a lyukas overload-csoport körüli lezárás.
