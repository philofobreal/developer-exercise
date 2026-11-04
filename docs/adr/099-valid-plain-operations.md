# ADR-099 – Tiszta műveletek és beépített hívások a `valid` szerződés alatt (v51, NY-06)

Állapot: **elfogadva** (2026-11-04), szabályverzió `scoped-effect-analysis-v51`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-06 tétele, a felhasználó jóváhagyásával. Kiegészíti az [ADR-050](050-input-contract.md) bemeneti szerződését.

## Kontextus

Az [ADR-098](098-three-new-verified-examples.md) példajelöltjei megmutatták, hogy a `valid` szerződés (érvényes egyszerű adat) mellett is kötött maradt néhány sorrend, amely a tipikus kezdő kódban gyakori. Egy statisztikafeladat (átlag, minimum, maximum) két változatban:
- **Gyűjtőváltozókkal és ciklussal:** 2 elfogadott sorrend és 6 rés.
  - A `let largest = -Infinity` kötött volt, mert az `Infinity` globális olvasás.
  - A ciklusmag három független gyűjtősora kötött volt, mert a `smallest = value < smallest ? value : smallest` jobb oldala nem tiszta, csak olvasó.
  - A `const count = values.length` nem kerülhetett a ciklus elé, mert a `for…of` mindig gát volt.
- **Beépítettekkel:** egyetlen csere sem volt szabad.
  - A `Math.min(...values)` szétterített argumentuma nem volt olvasás.
  - A `values.reduce((sum, value) => sum + value, 0)` visszahívása miatt a hívás ismeretlen volt.

## Döntés

Csak a `valid` szerződés alatt, és csak ha a szerződés a programra alkalmazható (ADR-050, 3. pont). Az alapszerződés (`any`) változatlan.

**Generátor** ([statement-ordering.ts](../../src/author/statement-ordering.ts), [input-contract.ts](../../src/author/input-contract.ts)):
1. **Globális állandó:** az `Infinity` és a `NaN`, ha a program nem deklarálja őket, csak olvasás. Nem írható, nem konfigurálható globális adattulajdonságok.
2. **Szétterített argumentum beépített függvénynek** (`Math.min(...values)`): olvasás, ha a programban nincs generátor és saját accessor. A szétterítést a beépített bejáró végzi.
3. **Visszahívásos tömbmetódus:** a `map`, `filter`, `some`, `every`, `find`, `findIndex`, `findLast`, `findLastIndex`, `flatMap`, `reduce` és `reduceRight` hívása olvasás, ha:
   - a metódusnév nem a program saját tagja;
   - az objektuma csak olvasható;
   - a visszahívás tömör, nem aszinkron nyílfüggvény, egyszerű nevű paraméterekkel, és a törzse csak olvas;
   - a `reduce` és a `reduceRight` kezdőértéket kap, mert anélkül üres tömbön dob.
4. **Lokális értékadás csak olvasó jobb oldallal** (`smallest = value < smallest ? value : smallest`): olvasási egység, amely a kötést írja.
5. **`for…of` csak olvasható értéken:** olvasási egység, mint egy blokk, ha:
   - a ciklusváltozó egyetlen `let`/`const` név;
   - a programban nincs generátor és saját accessor;
   - a törzs csak tiszta, olvasási és lokálisan író egységekből áll;
   - nincs belőle kiugrás (`break`, `continue`, `return`, `throw`).

**Orákulum** ([semantic-oracle.mjs](../../tests/support/semantic-oracle.mjs), `jsRead`/`tsRead`): ugyanez a politika, saját kóddal.
- A szétterített argumentum beépített függvénynek olvasás.
- A visszahívásos metódusnál a nyílfüggvény törzse a hívás részeként, a saját osztályozó szerint ítélődik. Ha a törzs ír vagy hív, a hívás külső hatás.
- A `for…of` a törzsével együtt olvasás.

## Helyességi érv

A `valid` szerződés szerint a bemenet érvényes egyszerű adat, és a kód rajta nem hibázik (ADR-050).
- **Beépített algoritmusok:** ezen az adaton a beépített bejáró, a `Math.*` és a felsorolt tömbmetódusok nem futtatnak programkódot és nem írnak; az egyetlen visszahívás tömör, csak olvasó nyílfüggvény. A program saját generátora, accessora és tagneve kizárja a szabályt.
- **Az olvasási egység** a többi olvasási, tiszta és lokálisan író egységhez képest csak név szerinti adatfüggőség miatt kötött, minden más egységhez képest sorrendben marad (ADR-050). Így ugyanazt a kötés- és objektumállapotot látja minden elfogadott sorrendben.
- **A ciklus** véges: a törzs nem ír objektumállapotot, tehát az iterált tömb nem nő. Nincs kiugrás, így minden kör lefut.
- **Az orákulum** a szabályt függetlenül valósítja meg. A futtatás (P3) és a környezetváltozatok ugyanúgy futnak.

## Mérés

*A kampány lefutása után kitöltve.*

## Bizonyíték

[valid-plain-operations.test.mjs](../../tests/valid-plain-operations.test.mjs):
- **pozitív:** a gyűjtőváltozós és a beépítettes változat, a kampány tanúi, 0 réssel;
- **az alapszerződés változatlan:** ugyanazok a programok kötöttek maradnak;
- **negatív:** író visszahívás, blokktörzsű visszahívás, kezdőérték nélküli `reduce`, kiugró ciklus, objektumot író ciklus, generátort tartalmazó program. Mindegyik kötött marad, és mindegyiken 0 a hibás elfogadás.

## Tervezési review (ADR-037)

- **Tulajdonos:**
  - a beépítettek listája és feltételei a bemeneti szerződés modulé (`callbackMethod`);
  - az osztályozás az utasításrendezésé (`readOnly`, `readCallback`, `localWrite`, a ciklus a `summary`-ben).

  A `localWrite` most a kötés mellett azt is visszaadja, hogy olvas-e; egyetlen hívója van.
- **Design twice:**
  - *A visszahívás törzsének teljes osztályozása (blokktörzs, külső kötések):* elvetve. A tömör, csak olvasó nyílfüggvény lefedi a tanúkat, és a külső `let`/`const` olvasása visszahívásból ideiglenes holtzóna miatt külön kérdés.
  - *A ciklus mint saját objektum hatásnyoma (ADR-034):* elvetve. A paraméteradat nem saját objektum; az olvasási egység pontosan a `valid` szerződés fogalma.
