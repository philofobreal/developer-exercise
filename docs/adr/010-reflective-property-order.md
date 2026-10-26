# ADR-010 – Reflektálható tulajdonságsorrend a pedagógiai ekvivalenciában

Állapot: implementálva, Node-tesztekkel és a független orákulummal ellenőrizve. Kiegészíti az ADR-007/008/009-et. A validátor, a CodeLine-séma jelentése, a tanulói parsermentes értékelés és a bizalmi határ változatlan.

## Kontextus

Az ADR-008 az egyedi nevű osztálymetódusokat és accessorokat pozíciófüggetlenné tette, mert a ClassDefinitionEvaluation minden mezőinicializáló előtt telepíti őket. A metódushívások eredménye így valóban független a sorrendtől. A JavaScript objektummodellje viszont a tulajdonságok **létrehozási sorrendjét** megfigyelhetővé teszi: az OrdinaryOwnPropertyKeys a tömbindex-kulcsok után a string kulcsokat létrehozási sorrendben adja vissza.

Az ellentmondás a projekten belül is megvolt. Az ADR-007 az osztálymezők `Object.keys`-sorrendjét kifejezetten megfigyelhetőnek tekintette, a prototípus és a konstruktor kulcssorrendjét azonban senki nem vizsgálta. A korpusz egyetlen probe-ja sem reflektált, ezért a régi orákulum (P0–P3) ezeket a cseréket ekvivalensnek mérte.

**Reprodukció** ([reflection-ordering.test.mjs](../../tests/reflection-ordering.test.mjs); a régi kódon 8 tesztből 7 elbukik):

| Eset | Mit fogad el a régi validátor | Mi változik |
| --- | --- | --- |
| JS: `first()` ↔ `second()` | elfogad | `Object.getOwnPropertyNames(Example.prototype)`: `constructor, first, second` → `constructor, second, first`; minden hívás eredménye azonos |
| Ugyanez, ha a program maga reflektál | elfogad | a **régi** politika szerint is futásidejű eltérés: valódi hibás elfogadás |
| TS ugyanez | elfogad | a parser- és a teljes strict típusellenőrzés mindkét sorrendre hibátlan; mindkét emit-módban csak a `Reflect.ownKeys(Example.prototype)` tér el |
| statikus metódusok | elfogad | a `Reflect.ownKeys(Shape)` sorrendje |
| szkriptszintű `function`/`var` | elfogad | az `Object.keys(globalThis)` sorrendje |

**Mérési adat:** a specifikáció a globális függvénykötéseket a `var`-kötések előtt hozza létre. A V8 (Node `vm`) viszont forrássorrendben, összefésülve hozza létre őket. A szabály ezért mindkettőt egyetlen láncként kezeli.

## Döntés

**A változat: szigorúbb megfigyelhetőség.** Az E_pol új feltétele:

> **P4 reflektálható tulajdonságsorrend.** Az osztályok prototípusának és konstruktorának, a példánymezőknek, valamint a klasszikus szkript globális objektumának saját kulcssorrendje és descriptor-fajtája megegyezik a referenciáéval.

**Explicit kizárás** (a B-változat szűk, dokumentált része): a forrásszöveg-reflexió, vagyis a `Function.prototype.toString`, az `Error.prototype.stack` és a sor- vagy oszlopszám. Ezek *minden* átrendezést megkülönböztetnek, így bevonásukkal `E_pol` a referenciára zsugorodna. A kizárás minden állításra vonatkozik.

### Generálási szabályok

A javítás az author rétegben van.

**[type-member-ordering.ts](../../src/author/type-member-ordering.ts):**

- Minden tag, amely string kulcsot hoz létre a prototípuson (`static` esetén a konstruktoron), a többi ilyen taghoz képest megtartja a sorrendjét. Ilyen tag a törzzsel rendelkező metódus és accessor, köztük a számított nevű, a duplikált nevű, az accessorpár és az overload-csoport implementációja.
- Ha két egymást követő ilyen tag közül legalább az egyik szabad, a modul élet ad hozzá közéjük. A mezőkhöz képest a szabadságuk megmarad: a mezők a példányon jönnek létre, a statikus mezők pedig mindig a statikus metódusok után.
- **Szabad marad:**
  - a `constructor`, mert a `constructor` kulcs jön létre elsőként;
  - a tömbindex nevű tag (`0`, `'1'`), mert ezek a kulcsok növekvő sorrendben listázódnak;
  - a privát `#név`, mert nem reflektálódik;
  - a törölt TS-tag: `declare`, `abstract`, overload-szignatúra, interface és type.
- A numerikus és a privát nevek mostantól kanonikus kulccsal számítanak az egyediségbe. Az eddig ok nélkül kötött `0()` és `#x()` így szabaddá vált.

**[statement-ordering.ts](../../src/author/statement-ordering.ts):**

- Klasszikus szkriptben (nem ES-modulban) azok a lista-egységek, amelyek globális objektumtulajdonságot hoznak létre, forrássorrendben maradnak. Ilyen egység a függvényimplementáció, valamint a beágyazott függvényen kívüli `var`- vagy Annex B blokkfüggvény-deklaráció.
- A `const`, `let` és `class` globális lexikai kötés, nem objektumtulajdonság, ezért szabad marad.

**Policy-címke:** új, additív érték: `scoped-effect-analysis-v6`. A régi modellek és címkék érvényesek; importkor nincs újraszámítás.

### Orákulum

A [semantic-oracle.mjs](../../tests/support/semantic-oracle.mjs) változásai:

- **Szintaktikus P4-szabály:** független kód, JS-re Acorn, TS-re saját AST-bejárás.
- **Futásidejű pillanatkép:** a felső szintű osztályok prototípusának és konstruktorának `Reflect.ownKeys`-e descriptor-fajtával, valamint a deklarált globális tulajdonságok sorrendje. TS-nél mindkét osztálymező-módban fut.
- **Külön ok:** a reflexiós eltérés `reflection` okként szerepel, elkülönül a hívásszintű `runtime` eltéréstől.
- **`policy: 'call-only'`:** a régi P0–P3 politikát adja vissza, kizárólag összehasonlító mérésre.

## Vizsgált alternatívák

- **B – szűk ekvivalencia (csak hívások):** elvetve.
  - Az ADR-007 a mezőkre már a reflexiót tekintette mérvadónak.
  - A reflektáló programokra (`Object.getOwnPropertyNames`) a régi generátor már a saját politikája szerint is hibásan fogadott el.
  - A hibás elfogadás súlyosabb, mint a túlzott szigor.
- **Minden metódus rögzítése:** elvetve. A constructor, a privát, a tömbindex és a törölt tagok szabadsága bizonyítottan helyes, és a mezőkhöz képesti szabadság is megmarad.
- **A validátor bővítése:** elvetve, mert a precedenciaélek elegendők.

## Következmények

- **Mérés:** két politika mellett, azonos korpuszon, [formális szerződés, ADR-010](../formal-ordering-contract.md#adr-010-reflexiós-mérés). A neighbourhood-mérés nem látta a hibát, mert a többsoros metódusblokkok cseréje nem egysoros mozgatás. A tagblokk-permutációs teszt ezt a vakfoltot zárja be.
- **Szándékos completeness-veszteség:**
  - a különböző nevű metódusok egymáshoz képesti sorrendje;
  - a szkriptszintű függvények és `var`-ok sorrendje.
- **Megmaradó korlátok:**
  - a duplikált és a számított név továbbra is kötött; az accessorpárt és a számított nevű metódust később az [ADR-012](012-class-evaluation-phases-and-accessor-pairs.md) lazította;
  - a beágyazott, függvényen belüli osztályok P4-ét csak a szintaktikus szabály ellenőrzi futás közben, a pillanatkép nem;
  - a forrásszöveg-reflexió kizárt.

## Kiegészítés: felülvizsgálat utáni javítás (`scoped-effect-analysis-v7`)

A WP1–WP8 lezárása utáni kódfelülvizsgálat két, a P4-et sértő hibás elfogadást talált. Egyiket sem mutatta ki a korpusz, mert egyik alak sem szerepelt benne. A második esetben a régi orákulum is ugyanabban a vakfoltban volt, mint a generátor.

| Eset | Mit fogadott el a validátor | Mi változik |
| --- | --- | --- |
| TS `accessor level = 1` mező előtt álló `read()` metódus a mező mögé mozgatva | elfogad | `Reflect.ownKeys(Gauge.prototype)`: `constructor, read, level, …` → `constructor, level, read, …`; mindkét emit-módban |
| `static accessor unit` a `static make()` elé mozgatva | elfogad | `Reflect.ownKeys(Gauge)`: `…, make, unit` → `…, unit, make` |
| szkriptszintű `function` átmozgatva egy `enum` vagy egy példányosított `namespace` másik oldalára | elfogad | `Object.keys(globalThis)`: `f, E, g` → `E, f, g` |

**Ok:**

- **`accessor` mező:** a TypeScript (és a decorators-javaslat) `accessor` mezője definíciókor get/set párt hoz létre a prototípuson (static esetén a konstruktoron), a metódusok között, forrássorrendben. A generátor sima mezőnek tekintette, a metódusok pedig a mezőkhöz képest szabadok.
- **TS-kibocsátott globálisok:** az `enum`, a példányosított `namespace` és az `import x = N.y` alias `var` deklarációként kerül a kibocsátott szkriptbe, vagyis globális objektumtulajdonság lesz. A globális lánc csak a `function`/`var` utasításokat ismerte.

**Javítás** (szigorúbb, a validátor változatlan):

- **[type-member-ordering.ts](../../src/author/type-member-ordering.ts):** a nem absztrakt, nem `declare` `accessor` mező a kulcsláncba kerül, és a mezők között is a helyén marad (az inicializálója mezősorrendben fut). A privát és a tömbindex nevű `accessor` a kulcsláncon kívül marad.
- **[statement-ordering.ts](../../src/author/statement-ordering.ts):** klasszikus szkriptben a nem `declare` `enum`, a példányosított `namespace` és a nem type-only `import =` alias globális egység. Típus-only az a namespace, amelynek törzse csak `interface`-t, `type`-ot, `declare` utasítást és típus-only namespace-t tartalmaz; ez nem bocsát ki semmit, ezért szabad marad. Minden más namespace konzervatívan példányosítottnak számít.
- **Orákulum:** a TS globális tulajdonságait a kibocsátott (ES2022) szkriptből, Acornnal olvassa ki. Így pontosan azok számítanak, amelyek ténylegesen `var`-t vagy függvényt bocsátanak ki, a generátor TS-AST-szabályától függetlenül. Az `accessor` mező a szintaktikus P4-szabályban a metódusok láncába kerül.
- **Policy-címke:** új, additív `scoped-effect-analysis-v7`. A régi modellek és címkék érvényesek; importkor nincs újraszámítás.

**Mérés** (61 fixture, azonos orákulum mindkét oldalon): a hibás elfogadások száma a K45-ön 1 → 0 (`ts-enum`), az R7-en 463 → 0. A completeness-rések száma változatlan (6 / 7 / 25). Részletek: [formális szerződés, v7](../formal-ordering-contract.md#v7-kiegészítés-accessor-mezők-és-ts-kibocsátott-globálisok). Reprodukció és tagblokk-permutáció: [reflection-ordering.test.mjs](../../tests/reflection-ordering.test.mjs).

**Tanulság:** a véletlenprogram-generátor csak egy függvénytörzsön belüli JS-t állít elő, ezért osztályt, szkriptszintű deklarációt és TS-t nem fed le. Mindkét hibát kézi felülvizsgálat találta meg, nem a generatív teszt. A generatív lefedettség bővítése külön feladat.
