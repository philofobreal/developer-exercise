# ADR-150 – A névtér exportált függvénye a helyén marad (NY-49, v58)

Állapot: **elfogadva** (2026-11-14). A felhasználó jóváhagyta („jóváhagyom, mehet az NY-49”). Kockázati osztály: szerzői elemzés (generátorszabály), orákulum és mérés (két új korpuszprogram, alapszint). Új szabályverzió: `scoped-effect-analysis-v58`.

## Kontextus (mérve 2026-11-14-én)

- **Hibás elfogadás.** A [közös terv](../terv-korpusz-es-verziok.md) 25 programos söprése találta: a modell elfogadta, hogy egy TypeScript `namespace` exportált függvénye az exportált változók elé vagy közé kerüljön.
- **Amit a hívó lát** (mindkét sorrendet lefuttatva):

  | Sorrend | `evaluate()` | `Object.keys(Timing)` |
  | --- | --- | --- |
  | referencia | 9 | `["penalty","bonus","total"]` |
  | a függvény elöl | 9 | `["total","penalty","bonus"]` |

  A hívások eredménye azonos; a névtér objektumának kulcssorrendje más.
- **Az ok.** A TypeScript az exportált függvényt két részben bocsátja ki: a függvényt (emelt deklaráció), és a deklaráció helyén egy értékadást a névtér objektumára (`Timing.total = total;`). A generátor az exportált függvényt ugyanúgy szabadon mozgathatónak vette, mint bármely emelt függvényt, és az értékadásról nem tudott.
- **A névtér többi exportált tagja eddig is kötött volt:** a változó (`declaration-shape`), az osztály, az enum és a belső névtér (fajta szerinti akadály). Egyedül a függvény szökött ki.
- **A korpuszban nem volt ilyen program,** ezért a mérés nem jelezte; az éles szerzői úton viszont elérhető volt (az első kapu átengedi).

## Döntés

- **A névtér törzsében álló, exportált, törzzsel rendelkező függvénydeklaráció akadály** (fajta szerinti: `FunctionDeclaration`), nem szabadon mozgatható sor. A helye a kibocsátott értékadás helye.
- **Ami nem változott:**
  - a névtér nem exportált függvénye (nem ír a névtér objektumára) emelt marad;
  - a modul felső szintű `export function`-je emelt marad (nincs névtérobjektum);
  - a `declare` függvény és a típust deklaráló tagok (`interface`, `type`) szabadok maradnak.
- **A „Nem számít” kulcssorrend nem oldja fel.** A kibocsátott értékadás hatással járó utasítás, amely korán kiléphet (a névtér objektuma kívülről is létezhet); az A-politika ([ADR-019](019-pure-effect-commutation.md), [ADR-043](043-dead-code-intent-policy.md)) szerint a helye ettől függetlenül kötött, és az orákulum is így méri.
- **Új okkód nincs:** a sor ugyanazt a fajta szerinti akadályt kapja, mint mellette az exportált enum és a belső névtér.
- **Szabályverzió: v58.** A v57-es címkéjű, névteret tartalmazó modellek ebben az egy pontban megengedőbbek lehettek; a szállított 16 feladatban és a 24 mintában nincs exportált függvényt tartalmazó névtér, azok szabályai nem változtak (csak a címkéjük).

## Két terv („design it twice”)

1. **Kulcssorrend-lánc a névtér exportált tagjai között,** csak „Számít” mellett (`key-creation-order`). Elvetve: az értékadás korai kilépése a kulcssorrendtől függetlenül is köt, és az orákulum „Nem számít” mellett is eltérőnek méri; a szabály két helyen élne (a változóknál akadály, a függvénynél lánc).
2. **Az exportált függvény ugyanaz az akadály, mint a névtér többi exportált tagja (választott).** Egy feltétel egy helyen; a névtér minden exportált értéktagja egyformán viselkedik.
3. **A névtér teljes törzse forrássorrendben.** Elvetve: fölöslegesen kötné a nem exportált függvényt és a típusokat (a mutációs próba ezt résként méri).

## Tervezési review (docs/design-review.md)

- **A tudás helye:** a [statement-ordering.ts](../../src/author/statement-ordering.ts) utasítás-összefoglalója, ahol a függvénydeklaráció emelhetősége eldől. A hívók és az interfész nem változtak.
- **design, rögzítve:** a névtér exportált változója `declaration-shape` (konzervatív, „nem elemzett”), az exportált függvénye fajta szerinti akadály (hatás). A két ok ugyanazt a jelenséget takarja; egységes, pontos okkód a névtér exportjaira külön lépés lenne, új súgószöveggel és bizonyítékprogrammal. Mért rés nincs mögötte.
- **design, rögzítve:** a modulfájl két felső szintű `export const` sora ma kötött (`declaration-shape`, 1 mért rés a próbában). Ez teljességi rés, nem helyességi hiba; nem része ennek a lépésnek.

## Bizonyíték

- **Regressziós teszt** ([namespace-exports.test.mjs](../../tests/namespace-exports.test.mjs)):
  - a hiba futtatva: a két sorrend kulcslistája eltér, a hívások eredménye azonos;
  - a v58-as modell elutasítja a függvényt a változók előtt és között, „Nem számít” mellett is; a típust deklaráló tag szabad marad;
  - a nem exportált függvény, a modul felső szintű exportált függvénye és a belső névtér esete.
- **Korpusz:** két új program ([ordering-corpus.mjs](../../tests/fixtures/ordering-corpus.mjs)), mindkettő két próbával (a hívás és a névtér kulcslistája): `cov-ts-namespace-exports` és `cov-ts-namespace-private-function`. Mindkettőn 0 hibásan elfogadott sorrend és 0 rés.
- **Alapszint:** a diff csak a két új kulcsot adja hozzá; meglévő érték nem változott (134 program).
- **Szállított modellek:** a 16 feladat és a 24 minta csak a címkéjében változott (v57 → v58); `verify-models` zöld.
- **A söprés hét névtér-alakja** a javítás után: mindegyiken 0 hibás elfogadás (exportált és nem exportált tagok, osztály, enum, belső névtér, összeolvadó névterek, a kulcsokat maga felsoroló program, modulfájl).
- **Mutációs ellenőrzés** a lefordított szabályon:

  | Rontás | Regressziós teszt | Korpusz |
  | --- | --- | --- |
  | a szabály törölve | bukik | 32 hibásan elfogadott sorrend |
  | minden exportált függvény akadály (a modulé is) | bukik | változatlan |
  | a névtér minden függvénye akadály (a nem exportált is) | bukik | 1 rés |
- **Kampány-alapszint:** a 15 csoport kulcsa a szabályverziót is tartalmazza, ezért újraírtam; a diff csak a címkét cseréli (v57 → v58), egyetlen érték sem változott.
- **Teljes kör:** `npm run gate`.

## Útközben talált hiba (nem ehhez a változáshoz tartozik)

- **Az akadálymentességi sor egyszer elbukott a teljes körben:** a folyamatjelző felirata halványulás közben került a vizsgálat alá (1,43-as kontraszt). Külön futtatva háromszor zöld volt. A vizsgálat most megvárja a halványulás végét ([browser-a11y.playwright.py](../../tests/browser-a11y.playwright.py)); a megjelenített és az eltűnt jelzőt változatlanul vizsgálja.

## Korlát

- **Az orákulum a névtér nem exportált tagjainak cseréjét is eltérőnek méri,** ha a csere egy exportált függvény kibocsátott értékadásán lép át. A v58 ezt nem engedi (korai kilépés), így a kettő egyezik; hogy az A-politika itt nem túl szigorú-e, az az NY-50 (b) kérdése.
- **A névtér kulcssorrendje a korpuszban két programon van mérve;** a tananyag névteret használó leckéi bővítik.
