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
  - az accessorpár, a duplikált és a számított név továbbra is kötött;
  - a beágyazott, függvényen belüli osztályok P4-ét csak a szintaktikus szabály ellenőrzi futás közben, a pillanatkép nem;
  - a forrásszöveg-reflexió kizárt.
