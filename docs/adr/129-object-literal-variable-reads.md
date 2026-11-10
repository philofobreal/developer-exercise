# ADR-129 – Objektumliterál: változót olvasó tulajdonságsorok (v55, NY-35)

Állapot: **elfogadva** (2026-11-10). A szabályverziót (`scoped-effect-analysis-v55`) a felhasználó kérte („folytasd a NY-35-öt, mindig az a legfontosabb, hogy minél helyesebb legyen és ne sérüljön a teljesség”). Kockázati osztály: szerzői elemzés, valamint orákulum és mérés. Az [ADR-128](128-object-literal-rows-and-runtime-hooks.md) folytatása.

## Kontextus

- **A v54-ben csak a literálértékű tulajdonságsorok lettek szabadok.** A `start: origin` vagy a `{ name, age }` sora kötött maradt. A v54-es orákulumbővítés ezt egy korpuszrésként tette láthatóvá (`ch-multiline-object`).
- **Egy változó olvasása kódot nem futtat, de nem mindig ártalmatlan:**
  - **TDZ:** egy még nem inicializált `let`, `const` vagy osztály olvasása `ReferenceError`-t dob. Ha egy literál két ilyen kötést olvas, a sorrend dönti el, melyik hiba jelentkezik.
  - **Globális getter:** egy nem deklarált név a globális objektum tulajdonsága, amely getter is lehet, és kódot futtathat.
  - **Dinamikus hatókör:** `eval` és `with` alatt a név feloldása futásidőben dől el.

## Döntés

- **A tiszta érték** (`inert-value.ts`) egy opcionális `read` bizonyítással bővül. Az osztálymezők nem adják meg, nálunk tehát semmi nem változik.
- **Az objektumliterál** ([object-literal-ordering.ts](../../src/author/object-literal-ordering.ts)) megadja; a rövidített `{ name }` alak ugyanígy `name: name`. Egy olvasás akkor szabad, ha a fájlban nincs `eval` vagy `with`, és:
  - **hatókörfeloldás:** a név a legbelső olyan deklarációjára oldódik fel, amelynek hatóköre tartalmazza (a destrukturált név is ilyen);
  - **nincs TDZ:** ez a deklaráció `var`, paraméter (hatóköre a törzs) vagy függvény- illetve fájlszintű függvénydeklaráció;
  - **bizonyítottan inicializált:** ez a deklaráció egy `let`, `const` vagy osztály, amely az olvasás előtt véget ér, ugyanabban a függvényben, és nem `switch`-ágban áll (az ág kötésének hatóköre az egész `switch`-törzs; a ciklusfej kötése csak a ciklustörzsben számít);
  - **egy kockázatos kötés:** minden más lexikális kötés olvasása is csak a saját `ReferenceError`-ját dobhatja, kódot nem futtat. Egy literál legfeljebb **egy** ilyen kötést olvashat (akárhány sorban: a hiba ugyanaz); kettőnél a sorrend dönti el, melyik hiba jön;
  - **globálisok:** a fájlban nem deklarált `undefined`, `NaN` és `Infinity` (nem írható, nem konfigurálható globálisok).
- **Kötve marad:**
  - minden név, amelyet a fájl másképp is köt: import, `catch` paraméter, függvény- vagy osztálykifejezés saját neve, enum, névtér, blokkszintű függvény, `using`;
  - a nem deklarált globális név.
- **A kulcssorrend döntése nem változik** (ADR-128): „Számít” mellett a kijutó objektum sorrendje kötött.

## Két terv („design it twice”)

1. **A TypeScript-ellenőrző (`createProgram`, szimbólumtábla) a névfeloldásra (elvetve).** Pontos, de a szerzői elemzés egy fájlon, ellenőrző nélkül dolgozik. A Local Demo háttérszálán ez új, nehéz függőség lenne, és a TDZ-kérdést úgysem válaszolja meg.
2. **Saját, szándékosan szűk hatókörfeloldás (választott).** Csak azt a néhány deklarációfajtát ismeri, amelynek a TDZ-viselkedését bizonyítani tudja; minden mást kötve hagy. A tévedés iránya mindig a szigorúság.

## Talált hiba (NY-36, nem ebben az ADR-ben javítva)

- **A kijutás vizsgálata közben az orákulum régi helyességi rést mutatott.** „Számít” mellett az osztálymezők sorrendje szabad, ha a program maga nem sorolja fel a kulcsokat ([ADR-029](029-unobserved-instance-field-order.md)). A visszaadott példány kulcsait azonban a hívó felsorolhatja.
- **Tanú:** `class Point { x = 1; y = 2; }`, `return new Point()`, a próbahívás `JSON.stringify`-ja. JS-ben és TS-ben is 3 hibásan elfogadott sorrend.
- Az objektumliterál ezt a v54 óta kijutásnak veszi, 0 hibás elfogadással.
- **A javítás döntést kíván:** mit jelent a „Számít”. Ha a hívó felsorolását is, akkor a szállított osztálypéldák szabályai szigorodnak, és ehhez jóváhagyás kell. A [nyitott tételek](../nyitott-tetelek.md) között NY-36.

## Tervezési review (docs/design-review.md)

- **object-literal-ordering.ts:**
  - *elrejti* a névfeloldást, a TDZ-bizonyítást és a „legfeljebb egy kockázatos kötés” szabályt;
  - az interfésze nem változott.
- **inert-value.ts:** egy definíció maradt. A `read` bizonyítás opcionális; ahol nincs megadva, a döntés a régi.
- **Rögzített maradék:**
  - az import és a `catch` paraméter olvasása kötött marad (bizonyítható lenne, de mért igény nincs);
  - NY-36.

## Bizonyíték

- **[object-literal-rows.test.mjs](../../tests/object-literal-rows.test.mjs)**, tíz orákulumfixtúra mindkét kulcssorrend-beállítással. Mindegyiken 0 hibás elfogadás és rögzített elfogadásszám, „Nem számít” mellett egy megnevezett sorpár:
  - **szabad:** paraméter, rövidített TS-alak, értékadás előtti `var`, blokkbeli `const` beágyazott tömbben, destrukturált `const`, árnyékolt név, egy `switch`-TDZ kötés, egy záróbeli TDZ kötés két sorban;
  - **kötött:** két záróbeli TDZ kötés (az orákulum futtatással igazolja az eltérő hibaüzenetet), globális getter.
- **Kötve maradó esetek:** import, `catch` paraméter, a ciklusfej kötése a saját fejében, `eval`, blokkszintű függvény.
- **Mérések:**
  - generatív alapvonal: csak a címke változott;
  - korpusz: nincs változás. A `ch-multiline-object` „Számít” mellett visszaadja az objektumot, ezért ott kötött; ez az NY-36 kérdése;
  - a 16 szállított példa és a 24 TS minta függőségei nem változtak.
