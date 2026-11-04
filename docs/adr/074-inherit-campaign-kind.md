# ADR-074 – Öröklési programok a generatív kampányban; az őslánc JavaScriptben is (v40)

Állapot: **elfogadva** (2026-11-04), szabályverzió `scoped-effect-analysis-v40`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-21 tétele. Kiegészíti az [ADR-073](073-base-chain-fields-and-defaults.md) bizonyítékát, és javítja a hatókörét.

## Kontextus

Az ADR-073 egy hibás elfogadást javított: a `[[Set]]` mezőmódban egy mező értékadása az ősosztály azonos nevű setterét futtatja, és a setter megfigyelheti a másik mezőt. Ezt egy célzott próba találta meg, nem a kampány.

A kampány `class` fajtájában (`randomClassProgram`) az ősosztálynak legfeljebb metódusai, mezői, statikus tagjai és számított nevű metódusai vannak, accessora soha. A „0 hibás elfogadás” tehát öröklés mellett erre a családra nem volt bizonyíték.

## Döntés

1. **Új programfajta: `inherit`** ([random-programs.mjs](../../tests/support/random-programs.mjs), `randomInheritProgram`, a [fixture-katalógus](../../tests/support/fixture-catalog.mjs) `PROGRAM_KINDS` tagja).
   - **Az ős tagjai:**
     - getter/setter pár, amelynek a settere egy leszármazott mezőt rögzít;
     - leszármazott mezőt olvasó getter;
     - `accessor` mező (TypeScript);
     - metódus, mező;
     - számított nevű accessor.
   - **A leszármazott tagjai:**
     - literál mezők, néhány az ős tagjával azonos névvel;
     - korábbi mezőt másoló mező;
     - ős getteren át olvasó mező;
     - `record(…)` kezdőértékű mező;
     - privát mező;
     - alapértékes paraméterű konstruktor `super()`-rel.
   - A próba néha szerializálja a példányt (kulcssorrend).
2. **A veszélyes minta szándékosan gyakori:** a magok mintegy háromnegyedében az ős egyik settere egy literál kezdőértékű leszármazott mező nevét viseli, és egy másik leszármazott mezőt rögzít.
   - Az első, egyenletes eloszlású változat 12 magon egyszer sem hozta létre ezt úgy, hogy a mezők lazák maradjanak: az egyetlen jelöltben a próba szerializált, így egyik mező sem volt laza.
   - Egy véletlen generátor csak akkor bizonyít egy szabálycsaládra, ha a család mintái elég gyakran előfordulnak benne.
3. **Külön fajta, nem a `class` bővítése.** A meglévő fajták programjai, és így az alapértékeik és a korábbi mérések, változatlanok maradnak.
4. **Az őslánc JavaScriptben is (v40, [type-member-ordering.ts](../../src/author/type-member-ordering.ts)).** Az új fajta az orákulum `es2015` környezetében ([ADR-062](062-oracle-environments-and-for-in.md)) egy JavaScript-hibás elfogadást is talált: a `random-inherit-javascript-1` programban az ős `f2` settere az `f1`-et rögzíti, és a két mező cseréjét a generátor elfogadta.
   - Az ES2015-ös lefordítás a mezőt értékadással hozza létre (`[[Set]]`).
   - Az elemzés környezete JavaScriptre is mindkét mezőmódot ígéri (`classFields: 'either'`).
   - Az ADR-073 ősláncfeltétele ezért JavaScriptre is vonatkozik. Ez egy nyelvi elágazással kevesebb.

## Mérés

**Visszamenőleges próba:** az új fajta a v38-as szabályokon (az ADR-073 előtt), 12 TypeScript-magon:
- **33 hibás elfogadás 3 programban** (`random-inherit-typescript-1`, `-4`, `-9`).
- A v39-en és a v40-en ugyanitt 0.

**A JavaScript-lyuk** a környezetváltozatos tesztben ([oracle-environments.test.mjs](../../tests/oracle-environments.test.mjs), 1 mag, `strict`/`es2015`/`sloppy`) bukott el: 2 hibás elfogadás a v39-en. A fő kampány alapból csak a `strict` környezetet futtatja, ezért ott nem látszott.

**Teljes kampány, v40, 12 mag:**

| Csoport | Sorrend | Elfogadott | Rés | Hibás elfogadás |
| --- | --- | --- | --- | --- |
| `inherit` JS | 7 409 | 358 (v39: 487) | 133 (v39: 56) | 0 |
| `inherit` TS | 6 884 | 374 | 77 | 0 |
| a többi 6 fajta | 351 664 | 14 939 | 48 | 0 |
| **Összesen** | **365 957** | **15 671** | **258** | **0** |

**Környezetváltozatokkal** (`--environments=strict,es2015,sloppy`, `inherit` és `class`, 12 mag):
- 0 hibás elfogadás.
- Az `inherit` JS rése 105. A v40 által visszavont 129 sorrendből 28 az ES2015-ös lefordításban valóban másként fut (a v39 ezeket hibásan fogadta el). A többi 101 csak ott kockázatos, szabványos JavaScriptben egyenértékű.

**A JavaScript ára:** a v40 szabványos (`[[Define]]`) JavaScriptben egyenértékű sorrendeket is elutasít, ha az ősnek ilyen nevű accessora van. Ezt a szerződés diktálja: az elemzés mindkét mezőmódot ígéri. Egy „csak `[[Define]]`” JavaScript-beállítás visszaadná ezeket, de ez szerződésdöntés (NY-23). *Utóirat:* a felhasználó a szerzői beállítást választotta; az [ADR-075](075-standard-class-fields-setting.md) (v41) `classFields: 'define'` értéke mindkét nyelven visszaadja ezeket, az alapértelmezés változatlan.

A 210 új rés (JS 133, TS 77) eddig rejtve volt. Okai (NY-22):
- **(a)** egy `record(…) ?? 7` kezdőértékű mező minden laza mező után kötött, holott a külső hívás csak primitívet kap, és a példányt nem éri el;
- **(b)** az ős azonos nevű settere minden literál mezőt köt, akkor is, ha a setter más mezőt figyel. Ez az ADR-073 szándékos óvatossága, és v40 óta JavaScriptre is vonatkozik;
- **(c)** az ős duplikált accessorai.

## Bizonyíték

[inherit-programs.test.mjs](../../tests/inherit-programs.test.mjs):
- **a szabályverzió** v40, a formális szerződésben az ADR-074-hez kötve;
- **a fajta a kampányban van:** a magok legalább felében benne van a veszélyes minta, és minden program örököl;
- **egy TypeScript veszélyes program** (az 1-es mag, ahol a v38 11 hibás sorrendet fogadott el): 0 hibás elfogadás mindkét mezőmódban.

[class-field-chain.test.mjs](../../tests/class-field-chain.test.mjs): a JavaScript-változat az `es2015` környezettel; az ős settere köti a mezők sorrendjét.

A [generative-baseline.json](../../tests/fixtures/generative-baseline.json) az új csoportokat is rögzíti, ezért egy rés vagy hibás elfogadás ezekben is a gyors kapun bukik.

## Tervezési review (ADR-037)

- **Tulajdonosok:**
  - a programalakok tudása a programgenerátoré;
  - az őslánc a tagrendezésé.

  A kampány, a besorolás és az interfészek változatlanok.
- **Design twice:**
  - *A `class` fajta bővítése:* elvetve, mert minden meglévő osztályprogramot és alapértéket megváltoztatna, és a régi mérések összehasonlíthatatlanná válnának.
  - *Egyenletes véletlen tagválasztás:* elvetve. A mért példa szerint nem állítja elő a veszélyes mintát.
  - *A JavaScript-kivétel megtartása:* elvetve. A szerződés mindkét mezőmódot ígéri, és a kivétel hibás elfogadást okozott.
- **Tanulság:** a fő kampány környezetváltozatok nélkül fut. A JS-lyukat a környezetváltozatos teszt egyetlen magja fogta meg. A szabálycsaládot érintő változásnál a kampányt a környezetváltozatokkal is lefuttatjuk.
