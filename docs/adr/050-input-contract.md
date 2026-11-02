# ADR-050 – Választható bemeneti szerződés (v26)

Állapot: **elfogadva** (2026-11-02), szabályverzió `scoped-effect-analysis-v26`. A felhasználó döntése: a kapcsoló bevezetése, a valós helyzetek választható kezelésével. Kiegészíti az [ADR-015](015-evidence-binding-and-analysis-environment.md) elemzési környezetét és az [ADR-019](019-pure-effect-commutation.md) kommutációját.

## Kontextus

A négy régi, kézzel írt példa és a v25-ös újragenerálás összevetése egy mérési vakfoltot mutatott meg. A tanár hallgatólagosan feltételezi, hogy a függvény bemenetei egyszerű adatok, ezért például ezt a két sort felcserélhetőnek írta le:

```js
const rows = grid.length;
const cols = grid[0].length;
```

A generátor és az orákulum a P2 szerint minden property-olvasást külső hatásnak tekint, mert a hívó getteres vagy Proxy objektumot is átadhat. Így a BFS-példa hat tanári szabadságát és a számlás példa kettőt kötött volna. A szintetikus kampányok zárt programokat mérnek, ezért ezt az okot nem mutatták ki.

A felhasználó kérése: a valóság minden helyzete legyen jól kezelve, választható módon. A három valós helyzet:
- trükkös külső érték (getter, Proxy, saját konverzió);
- egyszerű, de hibás alakú adat;
- érvényes egyszerű adat.

## Döntés

1. **Bemeneti szerződés** (`inputs`), a szerző választja feladatonként. A generátor bemenete, a modell `authoring.evidence.environment.inputs` mezője és a séma is ismeri.
   - **`any` (alapértelmezett):** bármilyen érték. A szabályok változatlanok.
   - **`valid`:** érvényes egyszerű adat: primitív (szimbólum nélkül), sima tömb és objektum adattulajdonságokkal, `Set`/`Map`, közvetlen paraméterként callback. Az alakja olyan, amilyet a kód elvár, így a kód rajta nem hibázik.
   - **A hibás alakú egyszerű adat** sorrend szempontjából az `any` alá esik: két olvasás közül az elsőként hibázó dönti el a kivétel üzenetét (`grid` `null` esetén „reading 'length'” vagy „reading '0'”), ezért külön fokozat nem adna szabadságot.
2. **Olvasási egység** (`read`, `statement-ordering`): `valid` szerződésnél egy deklaráció, blokk vagy elágazás akkor olvasási egység, ha csak olvas:
   - property- és elemolvasás, `this`, opcionális lánc;
   - konverzió (aritmetika, összehasonlítás, sablonliterál);
   - spread tömb- és objektumliterálban;
   - a listázott beépített hívások: `Math.*`, `Number`, `String`, `Boolean`, `parseInt`, `Object.keys`/`values`/`entries`, `Array.isArray`, egyargumentumú `Array.from`; a nem módosító, callbacket nem hívó metódusok (`join`, `slice`, `indexOf`, `includes`, `at`, `concat`, `split`, `has`, `get` és társaik); `new Set(…)`, `new Map(…)`.

   Egy olvasási egység a tiszta, a lokálisan író és a többi olvasási egységhez képest csak név szerinti RAW/WAR/WAW miatt kötött. Minden más egységhez képest sorrendben marad: barrierhez, saját objektumon dolgozó művelethez. Az ADR-019 kommutációja rá nem vonatkozik, mert egy külső hatás azt írhatja, amit olvas.
3. **Amit a program maga ad hozzá:**
   - **A szerződés nem alkalmazható,** és az elemzés szigorú marad, ha a forrás megnevez valamit, amivel a tulajdonságolvasás vagy az iteráció megváltoztatható. Ilyen a `Proxy`, a `Reflect`, a `defineProperty`, a `setPrototypeOf`, a `__proto__`, a `.prototype`, egy jól ismert szimbólum, az `eval`, a `Function` és a `with`, valamint a számított nevű accessor. A modell megjegyzése ezt kimondja.
   - **A program saját accessorának neve** olvasáskor kódot futtat, ezért ilyen nevű olvasás nem olvasási hatás.
   - **Konverziós metódusnév** (`valueOf`, `toString`, `toPrimitive`, `toJSON`) esetén a konverzió csak primitív operanduson olvasás.
   - **Generátor** esetén a spread nem olvasás.
   - **Programban definiált tagnév** hívása sosem beépített hívás.
4. **Szétbontott nevek (minden szerződésben):** a `const [a, b] = …` vagy a `function f({x})` neve a deklarációval, illetve a paraméterrel inicializált kötés. Az olvasása kötésolvasás, mint egy egyszerű `const`-é. Ez az orákulummal eddig is egyező, szigorúbb volt a generátorban.
5. **Bizonyíték és ellenőrzés:**
   - a `valid` szerződés az `environment.inputs` mezőben rögzül; az `any` semmit nem ír, így a régi modellek bizonyítéka változatlan;
   - a modellminősítés és a szerzői frissítés a rögzített szerződéssel generál újra, ezért a mező törlése kézi szerkesztésnek látszik (`rederivation: differs`).
6. **Felület:** a szerzői forrásnézet „Bemenetek” választója, mindkét nyelvnél. A szigorú az alapértelmezés, a magyarázat kimondja, mit nem vizsgálunk érvényes adatnál.
7. **Orákulum** ([semantic-oracle.mjs](../../tests/support/semantic-oracle.mjs)): az `inputs: 'valid'` fixture ugyanezt a politikát valósítja meg, független kóddal (Acorn és a TS-AST bejárása; `readWorld`, `jsRead`, `tsRead`). Az olvasási hatású utasítás nem külső, de az ADR-019 kommutációból kimarad. A P3 a fixture érvényes bemenetein fut.
8. **Szabályverzió:** v26.

## Tervezés (kétszer)

- **A) Beágyazva (első változat):** a szerződés programtényei a `statementOrdering` 700 soros függvényében álltak, a `readOnly` mellett. Ezek a horgok szövege, az accessor- és tagnevek, a generátorok és a beépítettek listái. A hívó egy döntés részleteit látta.
- **B) Saját modul (választott):** a [input-contract.ts](../../src/author/input-contract.ts) elrejti, mit enged meg a szerződés egy programban, és mit vesz vissza belőle a program maga. A `statementOrdering` egy hívással kérdez (`inputFacts`), és csak a `readOnly` marad nála, mert az a kötés- és tisztaságzárványokat használja.
- **Az orákulum a saját példányát tartja:** a politika listái szándékosan ismétlődnek benne, mert az orákulum független megvalósítás.
- **Rögzített megállapítás (`design`):** a `primitive`, a `pure` és a `readOnly` három, egymásra épülő rekurzív osztályozó. Egyetlen, szinttel paraméterezett osztályozó mélyebb lehetne. Ma nem vonjuk össze: a `pure` és a `primitive` sok szabály közös alapja, és az összevonás minden korábbi szabályverzió modelljeit érintené.

## Helyességi érv

**Indukció a futás lépésein** (a P2 eddigi érvelése mellett): egy olvasási egység érvényes adaton nem fut kódot, nem dob és nem ír. Ezért az eredménye csak a kötések és az objektumállapot értékétől függ.
- **Kötések:** a név szerinti RAW/WAR/WAW miatt minden elfogadott sorrendben ugyanazt látja.
- **Objektumállapot:** csak olyan egység írhatja, amely nem tiszta, nem lokális író és nem olvasási egység. Az olvasási egység mindegyikhez képest sorrendben marad, így ugyanazt az állapotot látja.

Tehát ugyanazt az értéket kapja, ugyanazokra a kötésekre. A tiszta és az olvasási egységek egymás közti cseréje nem változtat semmit, ami megfigyelhető.

**A szerződés a referenciára vonatkozó feltevés:** egy érvényes bemeneten hibázó referencia megsérti. A program saját horgait a 3. pont szűri ki.

## Következmények

- **A régi példák újragenerálása `valid` szerződéssel:**
  - **`algo-bfs-js`:** a hat tanári szabadságból öt megmarad. A `visited.add(key)` / `queue.push(…)` pár kötött marad, mert a `Set` saját objektumként nincs modellezve.
  - **`class-accounts-ts`:** a két tanári szabadság (`this.balance += …` és `this.history.push(…)`) kötött marad, mert ehhez az öröklő osztály mezőinek elkülönítése kellene.
  - **`algo-sort-search-js`:** nem változik.
  - Az átírás továbbra is a felhasználó jóváhagyásához kötött.
- **Az `any` szerződésű modellek:** csak a szétbontott nevek olvasása lett szabadabb.

## Bizonyítékok

- **Tesztek:** [input-contract.test.mjs](../../tests/input-contract.test.mjs), mindegyik az orákulummal ugyanazon szerződés alatt.
  - **Szabad `valid`-dal, kötött `any`-vel:**
    - két bemeneti olvasás;
    - beépített metódus;
    - elemolvasás olvasási kulccsal;
    - szétbontott nevek (TS);
    - `this` olvasása (TS).
  - **Kötött:**
    - olvasás az általa látott írás előtt (az orákulum futásidőben is eltérést lát);
    - a program saját getterének neve;
    - Proxy-t használó program (szigorú marad, megjegyzéssel).
  - **Egyéb:**
    - programban definiált `join` metódus;
    - a bizonyíték, a modellminősítés és a frissítés;
    - az ismeretlen érték elutasítása.
  - **Felület:** [author-workspace.test.mjs](../../tests/author-workspace.test.mjs), és egy böngészős forgatókönyv („Bemenetek” választó, rögzítés, visszatöltés).
- **Korpusz:** hat dedikált szerződéses fixture és a négy könyvtári példa `-valid` változata.
  - Hibás elfogadás nincs.
  - A dedikált fixture-ökön completeness-rés sincs.
  - Az `algo-bfs-js-valid` 25 szomszédos sorrendet fogad el (az `any` alatt 5-öt), rés nélkül.
- **Generatív kampány (12 mag, azonos orákulum):** a v25 (változtatás előtti) generátor és a v26 `any` szerződéssel minden csoportban bájtra azonos résszámot ad, tehát a szigorú mód nem változott. Hibás elfogadás egyik futásban sincs.

  | Csoport | v25 | v26 `any` | v26 `valid` |
  | --- | ---: | ---: | ---: |
  | szkript JS | 1,0% | 1,0% | 0,0% |
  | minden más csoport | változatlan | változatlan | változatlan |

  A szintetikus kampány zárt programokat mér, saját objektumokkal. A szerződés a paraméteres, valódi feladatkódra hat, ezt a korpusz szerződéses fixture-jei mérik. A gyors baseline-ban csak a címke változott.
- **Korpusz-baseline:** a meglévő 69 fixture értékei változatlanok, a 10 új fixture tudatosan rögzítve. Az indokkód-bizonyítékok nem változtak.
