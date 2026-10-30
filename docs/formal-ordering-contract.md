# Formális sorrendi szerződés és hatáselemzés

Ez a dokumentum a generált sorrendszabályok jelentését, a támogatott résznyelvet és a bizonyossági szinteket rögzíti. A strukturális elfogadási feltétel változatlan: [validációs modell](validacios-modell-es-formazas.md).

**Döntések:**

- [ADR-008](adr/008-effect-based-statement-ordering.md): hatásösszegzés;
- [ADR-009](adr/009-sealed-units-and-throw-free-reads.md): lezárás, dobásmentes olvasás, írási halmazok;
- [ADR-010](adr/010-reflective-property-order.md): reflektálható tulajdonságsorrend, v7-kiegészítéssel (`accessor` mező, TS-kibocsátott globálisok);
- [ADR-011](adr/011-language-independent-ordering-relations.md): nyelvfüggetlen sorrendi relációk;
- [ADR-012](adr/012-class-evaluation-phases-and-accessor-pairs.md): osztálykiértékelési fázisok és accessorpárok;
- [ADR-013](adr/013-local-writes-clause-chains-and-imports.md): lokális írások, klauzulaláncok és importok;
- [ADR-014](adr/014-constraint-provenance.md): kényszer-proveniencia és szerkeszthetőségi osztályok;
- [ADR-015](adr/015-evidence-binding-and-analysis-environment.md): a bizonyítékok kötése és az elemzési környezet;
- [ADR-016](adr/016-reference-language-audit.md): a referencia nyelvi auditja;
- [ADR-017](adr/017-model-verification-gate.md): modellminősítés (Model Verification Gate);
- [ADR-018](adr/018-typed-rule-editing.md): típusos szerzői szabályműveletek;
- [ADR-019](adr/019-pure-effect-commutation.md): tiszta egység és hatás-barrier kommutációja, számlálóváltozók;
- [ADR-020](adr/020-unobserved-key-order.md): a metódusok és a felső szintű függvények kulcssorrendje csak reflektáló programban kötött.

## Végleges állapot (WP1–WP8)

**Mérés:** a 61 fixture-ös korpuszon, reflektáló politikával (P0–P4), az ADR-012 után, [mérés](#adr-012-osztálykiértékelési-fázisok-és-accessorpárok). Az ADR-011 viselkedésmegőrző volt: mind a 167 generált modell bájtra azonos maradt.

| | K45 (eredeti) | W9 (WP6) | R7 (reflexió) |
| --- | ---: | ---: | ---: |
| hibásan elfogadott sorrend (A(M) + szomszédság) | 0 | 0 | 0 |
| indokolatlanul elutasított szomszéd | 6 | 7 | 20 |
| elfogadott teljes sorrend, A(M), mind orákulummal ellenőrizve | 2 297 | 61 | 3 706¹ |
| orákulum által eldöntetlen / validátor `indeterminate` | 0 / 0 | 0 / 0 | 0 / 0 |
| nem támogatott (elemzés kikapcsolva) | 1 fixture | 0 | 0 |

¹ Az `refl-ts-erased-and-overloads` teljes sorrendjeiből csak 300 rögzített magú minta van ellenőrizve.

**Mit jelentenek ezek a számok:**

- Állítás: soundness a lent definiált résznyelven, emberi bizonyításvázlattal és véges, független empirikus ellenőrzéssel.
- **Nem állítás:** teljes JavaScript- vagy TypeScript-szemantikai bizonyítás, tetszőleges bemenetre érvényes ekvivalencia, illetve a tesztkészleten kívüli programok completeness-e.


## Fogalmak

- `P`: a szerző referenciaprogramja; `T`: a sorelőfordulások halmaza egyedi azonosítókkal; `Π(T)`: T összes permutációja.
- `M = G(P)`: a generált CodeLine v2 modell; `A(M) ⊆ Π(T)`: a validátor által elfogadott permutációk, ha a keresés döntésre jutott (`indeterminate` nem tartozik bele).
- Strukturális elfogadás (változatlan): `Accept(S) ⇔ ∃ profil p, ∃ tartalomhelyes bijekció f: Order(f, p) ∧ Scope(f) ∧ Fixed(f)`.
- `E_pol(P)`: a pedagógiai politika szerint P-vel egyenértékű permutációk (lásd lent). `E_pol(P) ⊆ E_run(P)`, ahol `E_run` a puszta futásidejű egyenértékűség.

**Soundness:** `A(M) ⊆ E_pol(P)`. **Completeness:** `E_pol(P) ⊆ A(M)`.

### A helyességi cél hatóköre

Az `A(M) = E_pol(P)` elméleti cél, nem általános ígéret. Három ok miatt nem az:

- a sorrendelemzés csak bizonyos konstrukciókon vezeti le a függetlenséget;
- a v2/v3 reprezentáció (DAG, scope, fixed, OR-profilok) nem minden megengedett halmazt ír le tömören;
- a validátor korlátos keresést végez.

Ezért a szerződés négy, külön ellenőrzött állításra bomlik.

1. **Soundness (kötelező):** `A(M) ⊆ E_pol^v(P)` minden olyan P-re, amely a támogatott résznyelvre esik ([helyességi érvelés](#helyességi-érvelés-a-támogatott-résznyelven)). Itt `v` a modell `dependencyPolicy` címkéjéhez tartozó policyverzió ([policyverziók](#policyverziók)). A résznyelven kívül a konzervatív fallbackek miatt a modell szigorúbb, és soundness-állítást csak a fallbackek helyességéig tesz.
2. **Completeness (kötelező a kezelt és reprezentálható részen):** ha két egység a lenti „kezelt” esetek valamelyikébe esik, és a v2 projekció a különállásukat ki tudja fejezni, akkor a felcserélésük nem utasítható el. Kezelt esetek:
   - független tiszta deklarációk;
   - konfliktusmentes lokális írások;
   - pozíciófüggetlen deklarációk;
   - fázison belül vagy fázisok között szabad osztálytagok;
   - az emit által törölt importok;
   - egy klauzulalánc szegmensén belüli sorok.

   A nem reprezentálható esetet (például egyéb közös fizikai határ) a projekció jelöli: elhagyott blokk, `shared-boundary-lock` proveniencia.
3. **Fallback (kötelező jelölés):** minden más eset konzervatív. A szigorítás oka a modellben `conservative` kategóriájú proveniencia, nem hallgatólagos.
4. **Eldöntetlenség:** a kimerült keret `indeterminate`, soha nem elfogadás és nem elutasítás. Egy referenciamodell akkor alkalmas élesítésre, ha a referencia és a szomszédsága a produkciós kereten belül eldől. Ezt a modellminősítés ellenőrzi ([ADR-017](adr/017-model-verification-gate.md): `publishable`), és ugyanott rögzül, mely állítás ellenőrzött, mely csak tesztekkel alátámasztott, és mely nem megállapított.

**Viszonyítási alap:** minden `A(M)`-ről szóló állítás egy rögzített feladattartományra vonatkozik:

- a T sorelőfordulásainak permutációira, sorszintű mozgatással, a sorok szövege és multiplicitása változatlan;
- a modell szabályverziójára (`dependencyPolicy`);
- a szerzői módosításokra.

Szerzői lazítás után a modell nem állíthatja, hogy `A(M) ⊆ E_pol^v(P)`.

**Mérésben** minden vizsgált S öt diszjunkt kategória egyikébe esik:

- **soundness-sértés:** a validátor elfogadja, az orákulum szerint nem ekvivalens;
- **completeness-rés:** az orákulum szerint ekvivalens, a validátor elutasítja;
- **indokolt elutasítás;**
- **orákulum által eldöntetlen** (időtúllépés);
- **validátor `indeterminate`** (kimerült keresési keret).

Az utolsó kettő sosem számít elfogadásnak vagy elutasításnak. A completeness-rés a rögzített bemenetű orákulumhoz mért felső becslés: egy rés lehet csak az adott bemenetre fennálló ekvivalencia is (lásd az orákulum határait).

Tetszőleges JavaScript-programok szemantikai egyenértékűsége nem dönthető el mindig termináló algoritmussal (Rice tétele). Ezért egyik tulajdonságra sincs univerzális garancia. A cél: soundness a lent definiált résznyelven, növekvő completeness, és minden másra konzervatív (soros) szabály.

## Pedagógiai elfogadási politika (`E_pol`)

Egy S permutáció akkor egyenértékű P-vel, ha egyszerre teljesül:

1. **P0 szintaxis:** S elemezhető.
2. **P1 lexikai tulajdonlás:** minden utasítás és osztály-/típustag ugyanabban a listában marad (a listák multihalmazként egyeznek). Egy deklaráció másik scope-ba helyezése akkor sem engedett, ha a futás ugyanaz.
3. **P2 hatássorrend (ADR-013 és ADR-019 óta pontosítva):** minden utasításlistában minden olyan pár relatív sorrendje megmarad, amelynek legalább egyik tagja kiértékeléskor *külső* hatású (hívás, `new`, nem lokális vagy összetett értékadás, `++/--`, `delete`, `await`, `yield`, `throw`, `return`, `break`, `continue`, property-olvasás, spread, destrukturálás, ciklus, `in`/`instanceof`, `eval`, modulbetöltő import). A függvénylokális `let`/`var`/paraméter írása hatásmentes jobb oldallal *lokális* hatás: csak az ugyanazt a kötést olvasó vagy író tagokhoz képest kötött (RAW, WAR, WAW). Kivétel a pozíciófüggetlen tag: hoistolt függvénydeklaráció függvény/szkript-szinten, törölt TS-típusdeklaráció, illetve az emit által törölt import. **ADR-019 (v10):** függvényszintű listában egy hatásmentes utasítás és egy külső hatású utasítás sorrendje szabad, ha a külső hatású nem hagyhatja el önmagát korán (`return`, `throw`, `yield`, `await`, kifelé ugrás, `using`), a függvény nem használ `arguments`-et vagy `eval`-t, a hatásmentes utasítás csak saját `let`/`const`/osztály kötést ír, amelyre sem beágyazott függvény, sem a külső hatású utasítás nem hivatkozik, és minden olvasott neve a függvényben deklarált, amelyet sem beágyazott függvény, sem a külső hatású utasítás nem ír (név szerint). A függvény- és osztálytörzsek nem kiértékelési idejű hatások. **ADR-025 (v12):** függvényszintű listában két *helyi objektumművelet* (`const X = new C(…)` öröklés nélküli saját osztállyal, `const X = [ … ]` / `{ … }`, illetve egy ilyen név metódushívása vagy tulajdonságírása azonosító vagy literál argumentumokkal) sorrendjét nem a P2, hanem a P3 futásidejű összevetése dönti el. Az egysoros megjegyzés nem utasítás, ezért sorrendje a P2-ben eleve nem szerepel.
4. **P3 megfigyelhető viselkedés:** azonos visszatérési érték, kivétel és hatásnapló.
5. **P4 reflektálható tulajdonságsorrend (ADR-010, v11-ben ADR-020):** a következők saját kulcsai és descriptor-fajtája azonos:
   - az osztályok prototípusa és konstruktora;
   - a példánymezők;
   - a klasszikus szkript globális objektuma (`function`/`var`).

   **A sorrendre v11 óta két szabály vonatkozik:**

   - **Felsorolható kulcsok** (példánymezők, static mezők, `var`-globálisok és a TS által `var`-ként kibocsátott deklarációk): a sorrend kötött, mert az `Object.keys`, a `for…in` és a `JSON.stringify` is mutatja.
   - **Nem felsorolható kulcsok** (metódusok, accessorok) **és a szkriptszintű függvénydeklarációk:** halmazként hasonlítódnak össze.

   **Kivétel:** ha a program maga listázhatja ezeket a kulcsokat, a teljes ADR-010 sorrend érvényes. Ez akkor áll fenn, ha a forrásszöveg megnevez egy reflexiós API-t vagy a globális objektumot (`getOwnPropertyNames`, `ownKeys`, `getOwnPropertyDescriptors`, `Reflect`, `globalThis`, `window`, `self`, `frames`, `global`, `Function`, `eval`), vagy szkriptszinten `this`-t használ.

### Megfigyelhető állapot

A P3 és a P4 a következőket figyeli. Ugyanezt hasonlítja össze a független orákulum ([semantic-oracle.mjs](../tests/support/semantic-oracle.mjs)): a generátor és az orákulum ugyanabban az értelemben használja az egyenértékűséget.

| Megfigyelés | Tartalom | Hol rögzül |
| --- | --- | --- |
| eredmény | a rögzített probe visszatérési értéke JSON-szerializálva, az objektumok kulcssorrendjével együtt; aszinkron probe esetén a teljesült érték | `call` |
| kivétel | a dobott kivétel neve és üzenete; dobáskor az orákulum a hatásnaplót nem veti össze (ismert korlát) | `call` |
| hatásnapló | a `record(...)` hívások argumentumai, sorrendben (a fixture minden megfigyelt hatást ezen át jelent) | `call.trace` |
| reflektált szerkezet | az osztályok prototípusának és konstruktorának saját kulcsai, kulcsonként a descriptor fajtája (érték/accessor) és az `enumerable`, `configurable`, `writable` jelzők; a beágyazott osztályoké; a klasszikus szkript deklarált globálisai. v11 óta a nem felsorolható kulcsok és a függvényglobálisok rendezve, a felsoroltak sorrendben; reflektáló programban minden sorrendben (ADR-020) | `reflection` |
| szerkezet | a listák multihalmaza (P1) és a hatásos egységek sorrendje listánként (P2) | statikus `shape`, `effects` |

**Nem megfigyelt:**

- a futási idő és a memória;
- a forrásszöveg-reflexió (lásd a kizárást);
- a `record` nélküli konzolkimenet;
- a modulbetöltés tényleges külső hatása: ezt a modulbetöltő import kötése fedi, nem futtatással igazoljuk.

**Futtatási környezet:** strict klasszikus szkript, TypeScriptnél ES2022-re fordítva, mindkét osztálymezőmódban (`useDefineForClassFields` igaz és hamis). Ami ezen kívül esik (CommonJS-betöltő, bundler, dekorátortranszformáció, más `target`), azt a generátor konzervatív szabállyal kezeli. A ténylegesen feltételezett beállításokat a modell `authoring.evidence.environment` mezője rögzíti (ADR-015).

### Policyverziók

A `dependencyPolicy` címke a generálási szabályok verziója. Egy modell állításai mindig a saját címkéjéhez tartozó szabályokra vonatkoznak. Az újabb címke nem érvényteleníti a régi modellt; a régi modell csak explicit „Sorfüggőségek újraszámítása” után kap új szabályokat.

| Címke | Döntés | A P2 és a P4 változása |
| --- | --- | --- |
| `primitive-const-islands-v1`, `scoped-primitive-dag-v2` | korai, ADR előtti generátorok | csak primitív `const`-szigetek, illetve listánkénti primitív DAG; részletes szerződés nincs, ezért proveniencia nélkül `legacy` |
| `scoped-type-members-v3` | [ADR-007](adr/007-typescript-erased-member-ordering.md) | törölt TS-adattagok futamai szabadok |
| `scoped-effect-analysis-v4` | [ADR-008](adr/008-effect-based-statement-ordering.md) | P2: minden hatásos utasítás (az értékadás is) barrier; a tiszta egységek kommutálnak |
| `scoped-effect-analysis-v5` | [ADR-009](adr/009-sealed-units-and-throw-free-reads.md) | lezárás, dobásmentes olvasás |
| `scoped-effect-analysis-v6`, `-v7` | [ADR-010](adr/010-reflective-property-order.md) | P4 bekerül: kulcslánc, szkriptszintű globális lánc; v7: `accessor` mező, TS-kibocsátott globálisok |
| `scoped-effect-analysis-v8` | [ADR-012](adr/012-class-evaluation-phases-and-accessor-pairs.md) | osztálykiértékelési fázisok, accessorpárok |
| `scoped-effect-analysis-v9` | [ADR-013](adr/013-local-writes-clause-chains-and-imports.md) | **P2 explicit pontosítása:** a függvénylokális írás tiszta jobb oldallal csak RAW/WAR/WAW konfliktusnál kötött; az emit által törölt import pozíciófüggetlen; klauzulaláncok |
| `scoped-effect-analysis-v10` | [ADR-019](adr/019-pure-effect-commutation.md) | **P2 pontosítása:** egy tiszta, blokkszintű, lokális deklaráció átléphet egy olyan hatás-barriert, amely korán nem hagyja el önmagát, és sem közvetlenül, sem closure-ön át nem éri el a deklaráció kötéseit; a csak `++`/`--` által írt primitív számláló olvasása primitív |
| `scoped-effect-analysis-v11` | [ADR-020](adr/020-unobserved-key-order.md) | **P4 pontosítása:** a metódusok, az accessorok és a szkriptszintű függvénydeklarációk létrehozási sorrendje csak akkor kötött, ha a program maga listázhatja a kulcsokat; a mezők és a `var`-ok sorrendje változatlan; a sima overload-csoport egyetlen metódusdefiníció |
| `scoped-effect-analysis-v12` | [ADR-025](adr/025-local-object-effect-footprints.md) | **P2 pontosítása:** függvényszintű listában a saját objektumokon dolgozó utasítások (konstruktor-, metódus- és accessortörzsek absztrakt végrehajtásával számolt) hatásnyoma alapján rendeződnek: csak objektumütközés (RAW/WAR/WAW a tárolt referenciákkal kiterjesztve) vagy lehetséges kivétel köti őket; egy kivételt nem dobó objektumművelet és egy lokális írás kommutál. Az egysoros, nem irányelv-megjegyzés szabad a blokkján belül |
| `scoped-effect-analysis-v13` | [ADR-028](adr/028-runtime-precise-object-footprints.md) | **P2 pontosítása:** a hatásnyom mezőszintű (új kulcsot létrehozó írás és tömb egész objektum); a listaszintű `if/else` hatásnyomot kap; ismert string-metódus bizonyítottan string értéken nem ismeretlen kód; `may-throw` csak két lehetséges kivétel között köt. **Szigorítás:** a `.length` olvasás csak string értéken elemezhető |
| `scoped-effect-analysis-v14` | [ADR-029](adr/029-unobserved-instance-field-order.md) | **P4 pontosítása:** a kódot nem futtató (literál-kezdőértékű vagy kezdőérték nélküli), egyedi nevű példánymezők egymáshoz képest szabadok, ha a program maga nem listázza a kulcsokat (reflexió, `keys`/`values`/`entries`, `stringify`, `assign`, `structuredClone`, `console`, `inspect`, spread, `for…in`); a többi konstrukciókori egység követi őket |
| `scoped-effect-analysis-v15` | [ADR-031](adr/031-constructor-this-footprints.md) | **P2 pontosítása:** a nem származtatott, elemezhető osztály konstruktorában a `this` saját objektum (a paraméter tárolható, de művelet rajta ismeretlen kód; szökéskor barrier); kulcsokat nem listázó programban az új kulcsot létrehozó írás mezőszintű |
| `scoped-effect-analysis-v16` | [ADR-032](adr/032-value-sensitive-guards.md) | **P2 pontosítása:** ismert primitív értékek (literálok, a törzsekbe adott literál argumentumok, kódot nem futtató műveletek) eldöntik az `if`, a feltételes kifejezés és a rövidzár ágát; a soha le nem futó ág dobása, írása és olvasása nem számít |
| `scoped-effect-analysis-v17` | [ADR-034](adr/034-list-level-control-flow-footprints.md) | **P2 pontosítása:** függvényszintű listában az `else if` lánc, a `switch`, a `try/catch/finally` és a saját tömbön futó, azt nem író `for…of` is hatásnyomot kap; a ciklusban írt helyi változók ismert értéke elveszik |
| `scoped-effect-analysis-v18` | [ADR-039](adr/039-ambient-variable-declarations.md) | **P2 pontosítása:** a `declare const/let/var` utasítás egyedi, saját sorú azonosítókkal pozíciófüggetlen, mint az `interface`; minden TypeScript-emit törli. A destrukturáló vagy közös sorú alak konzervatív marad |
| `scoped-effect-analysis-v19` | [ADR-040](adr/040-unknown-calls-and-unescaped-objects.md) | **P2 pontosítása:** a saját objektumon futó törzsben a program által nem (vagy csak ambiensen) deklarált függvény hívása csak primitív argumentumokkal *külső* hatásnyomot kap, és nem szökteti meg az objektumot. Két külső hívás kötött (`external-call-order`); a külső hívás egy lehetséges kivétellel kötött (`may-throw`), elkapva is, mert nem is térhet vissza; az elkapott külső hívás a más kontextusban deklarált kötést olvasó lokális írással is kötött. A listaszintű ismeretlen hívás barrier marad; a közvetlen `eval`, az objektum argumentum és a deklarált hívott függvény ismeretlen kód |

A v9 P2-je **szigorúan bővebb** a v4–v8 P2-jénél: minden, amit a régi szabály megengedett, az újban is megengedett. Az új szabadságnak két forrása van, és egyiknek sincs megfigyelhető hatása a felcserélt párra nézve (lásd a [megfigyelhető állapotot](#megfigyelhető-állapot)): a lokális írás csak a saját kötését módosítja és nem dob; az emit által törölt import futásidőben nem létezik. Ez nem a régi P2 csendes gyengítése, hanem verziózott újradefiniálás: a régi címkéjű modellek a régi szabállyal maradnak érvényesek, és az orákulum a v9 P2-t saját, független implementációval követi (ADR-013).

A v11 P4-e **szigorúan bővebb** a v10-énél: a nem felsorolható kulcsok és a függvényglobálisok sorrendje csak reflektáló programban számít (ADR-020); minden más változatlan.

A v10 P2-je ugyanígy **szigorúan bővebb** a v9-énél. Az új szabadság: egy tiszta deklaráció és egy hatás-barrier felcserélése, ha a barrier által futtatható kód semmilyen úton nem éri el a deklaráció kötéseit, és a barrier nem viszi el a vezérlést a listából. Ilyenkor sem a kötések értéke, sem a hatásnapló, sem a kivétel nem változik. Az orákulum név szerint, kötésfeloldás nélkül, saját implementációval követi (ADR-019).

**Kizárás:** a forrásszöveg-reflexió (`Function.prototype.toString`, `stack`, sor- és oszlopszám) nem része az E_pol-nak, mert minden átrendezést megkülönböztet.

P3-at és a P4 futásidejű részét csak rögzített bemenetekkel lehet ellenőrizni, ezért ezek a teszteken empirikus bizonyítékok. P0–P2 és a P4 kulcssorrend-szabálya szintaktikai, tehát pontosan ellenőrizhető. Az ADR-010 előtti politika (P0–P3, „call-only”) a mérésekben összehasonlításként külön szerepel.

## Generálási szabályok

Az [elemző](../src/author/statement-ordering.ts) minden SourceFile/Block/ModuleBlock listát egységekre bont.

| Egység | Feltétel | Indok (evidence) |
| --- | --- | --- |
| pure | egyetlen `const`/`let`/`var` deklaráció tiszta inicializálóval vagy anélkül (`let x;`), sajátjában álló sorokon | `pure-declaration`, `uninitialised-declaration` |
| pure | osztálydeklaráció dekorátor, számított kulcs, static inicializáló/blokk nélkül; `extends` csak deklarált osztályra | `class-definition` |
| pure | blokk vagy `if`, amelynek minden része tiszta | `pure-block`, `pure-branch` |
| position-free | egyedi nevű, törzzsel rendelkező függvénydeklaráció szkript-, modul- vagy függvénytörzs-szinten | `hoisted-function-declaration` |
| position-free | egyedi `interface`, `type`, `declare` utasítás | `erased-type-declaration` |
| barrier | TS overload-csoport (szignatúrák és implementáció együtt, egyetlen egység) | `overload-group` |
| local-write | `x = e`: x egy ugyanabban a függvénykontextusban korábban deklarált `let`/`var`, e tiszta; illetve blokk vagy `if`, amelynek minden része tiszta vagy lokális író (ADR-013) | `local-write`, `local-write-block`, `local-write-branch` |
| position-free | `import type`, illetve `elide-unused` emitnél a csak típusként használt import, dekorátor nélküli fájlban (ADR-013) | `type-only-import`, `elided-type-import` |
| barrier | modulbetöltő import (értékimport, mellékhatás-import, `verbatim` emit), illetve minden más (hívás, nem lokális írás, ciklus, vezérlésátadás, Annex B blokkfüggvény, többsoros folytatás) | `module-import`, a SyntaxKind vagy az ok neve |
| opaque | komment és egyéb nem-utasítás sor | `non-statement-row` |

**Tiszta kifejezés** (`pure`): nem futtat felhasználói kódot és nem dob. Minden olvasott kötés inicializált, amikor a kifejezés fut. Ide tartozik:

- feloldott kötés olvasása:
  - azonos függvénykontextusú `const`/`let`/osztály, ha az olvasás a teljes deklaráció után áll, és a deklaráció nem `case`-ágban van (a védett él biztosítja az inicializálást);
  - `var` (TDZ nélkül), paraméter, ciklus- és `catch`-változó, hoistolt függvény;
  - **nem** tiszta: más függvénykontextusból olvasott `let`/`const`/osztály (a belső függvény a deklaráció előtt is meghívható), az önhivatkozó inicializáló (`const a = a`), valamint egy másik `case`-ágban deklarált kötés;
- friss objektum- vagy tömbliterál tiszta elemekkel (spread, számított kulcs és `__proto__` nélkül; a metódus- és accessor-definíció megengedett);
- függvény- és arrow-kifejezés (a törzse nem fut);
- `!`, `typeof`, `void`, `===`/`!==`, `&&`/`||`/`??`, feltételes kifejezés;
- primitív értékek felett a koerciós operátorok.

**Primitív érték:** szám-, string- és template-literál primitív helyettesítésekkel, `true`/`false`/`null`, illetve primitív inicializálójú `const` olvasása. ADR-019 óta primitív a függvénykontextusú `let`/`var` (a sima `for` fejléc egyetlen változója is), ha a kezdőértéke primitív, és minden további írása `++`/`--`: ez számot számmá alakít. **Írási halmaz:** a fájl összes értékadás-, `++/--`-, destrukturáló és `for-in/of` célpontja. Az írási halmazon kívüli (soha újra nem írt) `let`/`var` függvénykontextusban `const`-ként kezelődik. Szkriptszinten nem, mert ott a globális scope-on át (`globalThis`, indirekt `eval`, `Function`) szintaktikai hivatkozás nélkül is írható. Csak primitív érték lehet koerciós operátor (`+`, `<`, `${}` stb.) operandusa, mert objektumnál a `valueOf`/`toString` felhasználói kódot futtathat. A BigInt literál kizárt, mert a vegyes műveletek dobnak.

**Élek** egy listán belül, `i < j` egységekre:

```
edge(i.last → j.first)  ⇔  opaque(i) ∨ opaque(j) ∨ (¬free(i) ∧ ¬free(j) ∧ (barrier(i) ∨ barrier(j)) ∧ ¬commute(i, j))   (ADR-019)
                          ∨ (global(i) ∧ global(j))                                  (ADR-010)
                          ∨ W(i)∩(R(j)∪W(j)) ≠ ∅ ∨ R(i)∩W(j) ≠ ∅                     (ADR-013)
```

`commute(i, j)` (ADR-019): az egyik egység tiszta, a másik hatás- vagy alakkonzervatív barrier, és teljesülnek az [ADR-019](adr/019-pure-effect-commutation.md) feltételei (függvénykontextus `arguments` nélkül; a barrier korán nem hagyja el önmagát és nem `using`; a tiszta egység csak saját blokkszintű kötést ír, amelyre más kontextus és a barrier nem hivatkozik; olvasott kötéseit más kontextus és a barrier nem írja; kötés és név szerint).

R és W a tiszta, illetve lokális író egységek szimbólumszintű olvasási és írási halmaza: egy deklaráció a saját kötését írja, egy összetett egység a részei unióját, a zárványtörzsek olvasásai nem számítanak. Ezen felül minden lokális írás védett élt kap a célkötése deklarációjától, és minden kiértékelési idejű olvasás védett élt kap a kötést inicializáló utasítás sorától, ha az ugyanabban a függvénykontextusban van (TDZ- és értékpozíció). A más függvénykontextusból, paraméterből, ciklus- vagy `catch`-változóból, illetve hoistolt függvényből származó olvasáshoz nem kell él.

`with` vagy közvetlen `eval` esetén az egész fájl elemzetlen marad, minden sor soros.

**Lezárás (projekció, ADR-009).** A validátor egy sort ott fogad el, ahol a nyitott scope megegyezik a sor `scopeId`-jével. Egy többsoros egység belsejében ez csak két helyen fordulhat elő: a folytatósoroknál (például `record(` … `);`) és az elhagyott, megosztott határú blokkoknál. A `} else {`, `} catch (e) {` és `} finally {` határ ADR-013 óta klauzulalánc, ezért ott nincs lyuk. Ha egy egység belsejében van ilyen „lyuk”, minden azonos scope-ú testvéregység a forrásbeli oldalán marad:

```
lyuk(U) ⇔ ∃ r ∈ [U.first, U.last): nyitottScopeUtána(r) = scope(U.first)
lyuk(U) ∧ scope(X.first) = scope(U.first) ∧ X.last < U.first  ⇒  X.last → U.first
lyuk(U) ∧ scope(X.first) = scope(U.first) ∧ X.first > U.last  ⇒  U.last → X.first
```

A precedencia csak „előtte” vagy „utána” relációt fejez ki, a „nem a belsejében” feltételt nem. Ezért a lezárás a forrásbeli oldalt rögzíti: helyes, de egy pozíciófüggetlen sor ilyen egységen nem léphet át.

**Osztálytagok** ([type-member-ordering](../src/author/type-member-ordering.ts), JS és TS):

- **Szabad, azaz pozíciófüggetlen** az osztálytörzsben az egyedi nevű metódus, accessor és constructor definíció, valamint a `declare` mező.
- **Kulcslánc (ADR-010):** a string kulcsot létrehozó tagok azonos objektumon (prototípus, illetve `static` esetén a konstruktor) forrássorrendben maradnak. Ilyen a törzzsel rendelkező metódus és accessor, a számított, duplikált, accessorpár- és overload-implementáció is. A mezőkhöz képest szabadok maradnak.
- **Accessorpár (ADR-012):** az azonos nevű, azonos elhelyezésű getter és setter egy tulajdonság. Mindkét fél definíció, a kulcsláncban pedig egy csoport: egymás közt felcserélhetők, de mindkettő követi az előző és megelőzi a következő kulcsot.
- **Fázisok (ADR-012):** a futásidejű egységek fázisa `key` (számított nevű metódus vagy accessor), `static` (static mező, static blokk) vagy `instance` (példánymező). Egy egység minden korábbi, közös fázisú vagy fázis nélküli egységet követ; a különböző fázisú egységek egymáshoz képest szabadok.
- **`accessor` mező (v7):** get/set párt hoz létre a metódusok között, ezért a kulcsláncban van, az inicializálója miatt pedig a mezők között is a helyén marad.
- **Kívül marad a láncon:** a `constructor`, a tömbindex nevű, a privát `#` és a törölt tag.

 A paramétertulajdonságot a TypeScript mindkét osztálymező-módban a konstrukció elején állítja be, a constructor helyétől függetlenül. Egy overload-csoport (szignatúrák és implementáció) egyetlen kötött egység. A futásidejű mezők és a static kód a saját fázisukon belül kötöttek; a duplikált nevek, a számított nevű mezők, a dekorált és a kommentelt tagok fázis nélküliek, tehát minden egységhez képest kötöttek. Az ADR-007 törölt típustag-futamai változatlanok. A többsoros tagokra ugyanaz a lezárás vonatkozik.

## Helyességi érvelés a támogatott résznyelven

Állítás: ha P a fenti résznyelvre esik, és teljesülnek az A1–A5 feltevések, akkor minden `S ∈ A(M)` kielégíti P0–P4-et.

Feltevések:

- **A1:** a TypeScript parser és checker kötésfeloldása helyes a referencián. A referencia nyelvi helyességét a nyelvi audit (ADR-016) jelzi; `unverifiable` és `not-run` esetén ez nincs ellenőrizve.
- **A2:** nincsenek egzotikus hoszt-objektumok a primitív műveletekben.
- **A3:** nincs `with`/`eval` (kizárt).
- **A4:** a megosztott fizikai határú intervallumok sorosak, és minden lyukas többsoros egység le van zárva (a generátor biztosítja).
- **A5:** a referencia futtatási környezete a [megfigyelhető állapotnál](#megfigyelhető-állapot) leírt környezet, vagy olyan, amelynek eltérését konzervatív szabály fedi. Ilyen az ismeretlen buildnél alkalmazott `verbatim` import-emit, a dekorátoros fájl és a modulbetöltő importok kötése. A szerző által megadott környezet (`importEmit`) maga is feltevés: ha hibás, az állítás nem érvényes.

Vázlat:

1. **Lokalitás.** A validátor `Scope` feltétele egy sort csak a saját reprezentált scope-jába enged. Ezen belül a lezárás miatt egyetlen testvér sem kerülhet egy másik egység belsejébe (WP6: ez korábban hiányzott, lásd ADR-009). Így minden egység összefüggő marad és a saját listájában áll, a listák függetlenül vizsgálhatók, és P0/P1 teljesül.
2. **Barrier-stabilitás.** Bármely két barrier közötti szakaszban a pure egységek által olvasható állapot állandó, mert csak barrier ír, hív vagy ad át vezérlést, és a barrier relatív helye minden rendezett testvérhez képest rögzített. ADR-019: egy pure egység akkor léphet át egy barriert, ha a barrier az egység olvasott kötéseit nem írja, a saját kötéseire nem hivatkozik, és closure sem éri el őket. Ilyenkor a barrier számára az egység láthatatlan, az egység számára a barrier által írt állapot nem bemenet. Ha a barrier dob, a vezérlés elhagyja a blokkot, ahol a blokkszintű kötés closure nélkül nem látható.
3. **Pure kommutáció.** Két pure egység nem futtat kódot és nem dob, mert minden bemenete garantáltan inicializált (WP6: a más kontextusú TDZ-olvasás és az önhivatkozás kizárva; egy dobó „tiszta” sor helye closure-on és `catch`-en át megfigyelhető volt). Csak a saját, egyedi kötését inicializálja, és a másik kötését csak védett éllel olvashatja. Felcserélésük ezért egyetlen kötés értékét, kivételt vagy hatásnaplót sem változtat meg.
4. **Pozíciófüggetlenség.** Függvénydeklarációt a FunctionDeclarationInstantiation vagy a GlobalDeclarationInstantiation a lista belépésekor hoz létre; törölt TS-deklarációnak nincs emitje. Egy metódust a ClassDefinitionEvaluation minden mezőinicializáló és static kód előtt telepít. A létrehozási sorrend csak a kulcssorrendben látszik (P4). Ezt a kulcslánc rögzíti: osztályonként és objektumonként, a szkript globális objektumán pedig a függvények és a `var`-ok együttes láncával. v11 óta (ADR-020) a nem felsorolható kulcsokra és a függvényglobálisokra a kulcslánc csak akkor vonatkozik, ha a program maga listázhatja őket; különben a sorrendjük a megfigyelt állapotban nem szerepel. A `constructor` kulcs mindig elsőként jön létre, a tömbindex-kulcsok növekvő sorrendben listázódnak, a privát nevek nem reflektálódnak.
5. **Késleltetett olvasás.** Closure-törzs csak hívásra fut, a hívás pedig barrier.
6. **Kompozíció.** A blokk összegzése a gyerekek összegzéséből áll, a kifelé mutató olvasások élként továbbadódnak, így az állítás indukcióval terjed a beágyazásra.

Ez emberi bizonyításvázlat, nem gépi verifikáció. A modelltől független ellenőrzése empirikus (lásd lent). A WP6 és az ADR-010 éppen ennek a vázlatnak két hiányát tárta fel: a lyukas egységet (1. lépés) és a kulcssorrendet (4. lépés). Mindkettőt valódi ellenpélda alapján javítottam, ezért a vázlat további rejtett feltevései sem zárhatók ki.

## Konzervatív fallbackek

Ha a feltételek nem teljesülnek, a generátor a forrássorrendet tartja meg. Ez helyes, de szigorúbb:

| Feltétel | Fallback |
| --- | --- |
| `with` vagy közvetlen `eval` a fájlban | az egész fájl elemzetlen, minden sor soros |
| nem támogatott vagy ismeretlen utasítás, hívás, írás, property-olvasás, ciklus, vezérlésátadás | barrier |
| több utasítás egy fizikai soron, vagy a listának nincs saját nyitó/záró sora | a lista soros |
| többsoros egység saját blokkhatárok nélkül | barrier, valamint lezárás (ADR-009) |
| `} else {`, `} catch {`, `} finally {` közös határ | klauzulalánc: egy konténer szeparátorsorokkal, minden sor a saját klauzulájában (ADR-013) |
| egyéb közös fizikai határ, illetve olyan klauzulalánc, amelynek első vagy utolsó sora más blokkal közös | elhagyott blokk, sorosított intervallum |
| ismeretlen TypeScript-build | `verbatim` import-emit: csak az `import type` szabad |
| más kontextusú `let`/`const`/osztály-olvasás, önhivatkozás, `case`-ágbeli kötés | nem tiszta, barrier |
| újraírt `let`/`var` koerciós operandusként; szkriptszintű `let`/`var` | nem primitív, barrier |
| duplikált, dekorált, kommentelt osztálytag, számított nevű mező | fázis nélküli, kötött tag (ADR-012) |
| számított nevű metódus | `key` fázis: a mezőkhöz képest szabad, a kulcslánchoz és a többi számított kulcshoz képest kötött |
| a prototípuson vagy a konstruktoron kulcsot létrehozó tagok (az `accessor` mezőt is beleértve); szkriptszintű `function`/`var`, valamint a TS `enum`, példányosított `namespace` és `import =` alias | egymáshoz képest kötött kulcslánc (ADR-010, v7) |
| 250-nél több megtartott blokk, 500 sor vagy 50 KB fölött | elhagyott blokk, illetve elutasított szerzői forrás |
| kimerült validátorkeret | `indeterminate`, soha nem elfogadás |
| importált kézi modell | a függőségei nem generálódnak újra, csak explicit szerzői művelettel |
| szerzői lazítás (generált kényszer eltávolítása) | csak megerősítéssel, rögzítve; a modell ezután `unverified`, a soundness nem állított (ADR-018) |

## A tesztorákulum bizonyítási határai

- **Független kódút, részben közös parser:** JavaScriptre Acorn, TypeScriptre viszont ugyanaz a TypeScript-parser, saját bejárással. Egy TS-parserhiba (A1) mindkét oldalon megjelenhet.
- **Véges bemenet:** P3 és a P4 futásidejű része a rögzített probe-ot futtatja vm-kontextusban, strict szkriptként, TS-nél ES2022-re fordítva, mindkét osztálymező-módban. Egy „ekvivalens” ítélet csak erre a bemenetre szól. Ezért lehet completeness-rés például a `ch-typeof-strict-equality` vagy az `algo-bfs-js` esete.
- **P4-lefedettség:**
  - a felső szintű osztályok és a deklarált globálisok pillanatképe közvetlenül a szkript kiértékelése után készül;
  - a beágyazott osztálydeklarációkat (függvényben, blokkban, namespace-ben) az orákulum egy közvetlenül utánuk beszúrt regisztráló utasítással gyűjti, és a probe lefutása után rögzíti; így a descriptor-fajtát is a V8 tényleges állapota dönti el;
  - nem látja a probe által soha el nem ért beágyazott deklarációt és az osztálykifejezést, ezeket csak a szintaktikus P4-szabály fedi;
  - TypeScriptnél a globálisok listája a kibocsátott szkriptből származik (v7), így a generátor TS-AST-szabályától független.
- **Típusellenőrzés:** a teljes TS-típusellenőrzés csak a reflexiós reprodukciókban fut. A P0 egyébként a parserdiagnosztikát, a `transpileModule` diagnosztikáját és az overload-szomszédosságot ellenőrzi.
- **Mintavétel:** a szomszédság egysoros mozgatást és párcserét vizsgál. A többsoros egységek mozgatását a blokkmozgatás (`blockMoves`: minden utasítás és osztálytag egészben, a saját listáján belül minden más helyre), a tagblokk-permutációs és az A(M)-ellenőrzés fedi. Az A(M) 10 000 sorrend fölött mintavételezett.
- **Időtúllépés:** eldöntetlen eredmény, nem ekvivalencia; a rövid keretet hosszabb keret ellenőrzi újra.
- **Kizárt megfigyelések:** a forrásszöveg-reflexió és a `call-only` politika csak összehasonlító mérésre szolgál.

## Vizsgált technikák

- **Read/write-halmazok és konfliktusfüggőség:** kötésszinten megvalósítva az olvasásokra. Az írási halmaz (ADR-009) az olvasott `let`/`var` stabilitását dönti el, maguk az írások barrierek maradnak.
- **Vezérlésifolyamat-elemzés:** nem szükséges. A vezérlő utasítások barrierek, a validátor scope-ellenőrzése pedig megakadályozza a vezérlési régiók közötti mozgást.
- **Absztrakt interpretáció:** egyetlen könnyű tartomány (primitív/nem primitív érték) a koerciós operátorokhoz. Teljes keretrendszer nem indokolt.

## Empirikus bizonyíték (történeti mérések)

Az alábbi szakaszok az egyes lépések előtte–utána méréseit rögzítik a saját korpuszukon és orákulumukon. A végleges számok a [végleges állapotnál](#végleges-állapot-wp1wp8) szerepelnek.


A [független orákulum](../tests/support/semantic-oracle.mjs) más kódútvonalat használ, mint a generátor: JavaScriptre Acornt, TypeScriptre saját AST-bejárást, és P0–P3-at ellenőrzi. Az ADR-008-mérés idején a [korpusz](../tests/fixtures/ordering-corpus.mjs) 45 fixture-ből állt. Minden egysoros áthelyezés és páros csere (10 861 elrendezés) vizsgálva volt, és minden elfogadható sorrend legfeljebb 5000-ig teljesen, fölötte rögzített maggal mintázva (a WP6 óta a küszöb 10 000). Futtatás: `node tests/ordering-metrics.mjs`.

| Mérőszám (45 fixture) | ADR-008 előtt | után |
| --- | ---: | ---: |
| hibásan elfogadott elrendezés | 0 | **0** |
| egyenértékű, de elutasított szomszédos elrendezés | 103 | **30** |
| elfogadott szomszédos elrendezés | 128 | 201 |
| a modell összes elfogadott teljes sorrendje | 103 | 5 100 |
| orákulum által eldöntetlen / validátor `indeterminate` | 0 / 0 | 0 / 0 |
| generált élek / redundánsan megtartott olvasási él | 529 / 3 | 546 / 28 |
| validátor-állapotok az összes elfogadott sorrenden | 1 843 | 158 582 |
| generálás a 45 fixture-ön / 500 soros referencián | 72,4 / 8,4 ms | 66,4 / 22,9 ms |

A redundáns élek a szándékosan megtartott értékbemenetek; a függőségi táblában mutatják az olvasott deklarációt. Az állapotszám azért nő, mert jóval több sorrend elfogadható. A mérés egyetlen Windows-gépen, terhelés mellett készült; az időértékek tájékoztatók.

A normál `check:all` része:

- a [scope-mátrix](complex-scope-ordering.md);
- az orákulummal igazolt pozitív deklarációs esetek és az új negatív barrier-esetek: [dependency-bindings.test.mjs](../tests/dependency-bindings.test.mjs);
- az eredeti 5040 permutációs és beágyazási regressziók;
- a 24 elemű TypeScript-mátrix;
- a WP5 tesztjei (lásd alább).

### WP5: kimerítő, property-alapú és metamorf ellenőrzés

Mindkét fájl a `check:all` része. A kategóriák külön számolódnak: soundness-sértés (hibás elfogadás), completeness-rés, orákulum által eldöntetlen eset, validátor `indeterminate` és szintaktikai/reprezentációs hiba. Az `indeterminate` sosem számít elfogadásnak vagy elutasításnak.

- **[semantic-corpus.test.mjs](../tests/semantic-corpus.test.mjs):**
  - Mind a 45 fixture-re a teljes szomszédság (10 861 elrendezés) és fixture-enként legfeljebb 200 elfogadott sorrend (fölötte 100, rögzített maggal mintázva) ellenőrzött.
  - A soundness feltétlen. A completeness fixture-enként rögzített: [ordering-baseline.json](../tests/fixtures/ordering-baseline.json). Mind a romlást, mind a javulást csak tudatos, felülvizsgált frissítés (`node tests/ordering-metrics.mjs --baseline`) engedi át.
  - Három negatív kontroll (szándékosan éltelenített modell) igazolja, hogy a teszt minimális ellenpéldával jelez.
- **[ordering-properties.test.mjs](../tests/ordering-properties.test.mjs):**
  - **Kimerítő Π(T):** a 12 legfeljebb 7 soros fixture minden permutációja, összesen 24 360 különböző elrendezés. Minden elfogadott sorrendnél a validátortól független tanúellenőrzés fut: bijekció, tartalom, fixed, függőség, él, profil, blokkverem.
  - **Property-alapú:** 30 rögzített magú, véletlen, mindig termináló program (felső szintű és beágyazott blokkok, `if`, closure, literálok, írások, hívások, hoistolt függvények). Mintavett lineáris kiterjesztések és a teljes szomszédság: 12 803 elrendezés, 666 elfogadott, mind helyes.
  - **Metamorf relációk:** 55 fixture-ön 760 azonosító konzisztens átnevezése és kétféle újrabehúzás után a generált sorrendi szerkezet azonos. Bijektív ID-csere mellett minden ítélet azonos, és a tanú leképeződik.
  - **Keretkonzisztencia:** 25 állapotos keretnél az eredmény vagy `indeterminate`, vagy azonos a teljes keretével (184 döntött, 62 `indeterminate`).

Eredmény: egyetlen soundness-sértés sincs. A kis fixture-ök teljes permutációs terében 4 completeness-rés maradt (`ch-direct-eval`, `ch-typeof-strict-equality`, `ch-var-operand`), a véletlen programokban 3. Futásidő ezen a gépen: kb. 85 s és 75 s, párhuzamosan.

A teljes, korlát nélküli mérés (`node tests/ordering-metrics.mjs`, kb. 4 perc) kézi eszköz marad.

## WP6: javítás, mérés és regresszióvédelem

A WP6 hat hibásan elfogadó hibát talált és javított ([ADR-009](adr/009-sealed-units-and-throw-free-reads.md)):

- többsoros egység belsejébe kerülő pozíciófüggetlen sor (folytatósor, `} else {`/`} catch {` határ, többsoros mező);
- szétválasztott TS overload-csoport;
- dobó „tiszta” olvasás (önhivatkozás, más kontextusú TDZ-olvasás, `case`-ág).

Mindegyikhez előbb reprodukáló fixture készült (`origin: 'wp6'`, 9 darab), a régi generátor mindegyiken hibás sorrendet fogadott el. A javítások általános szabályok; fixture- vagy változónévre nincs hardcode.

**Tesztkészlet és tartomány.** A mérést mindkét oldalon ugyanaz a mérőeszköz, korpusz és orákulum végezte:

- **előtte:** a HEAD `4d3a1be` kódja, külön munkakönyvtárban;
- **utána:** a WP6 kódja;
- **K45:** az eredeti 45 fixture; **W9:** a 9 WP6-reprodukció;
- **Szomszédság:** minden egysoros áthelyezés és páros csere (K45: 10 861, W9: 1 870 különböző elrendezés);
- **A(M):** a modell összes lineáris kiterjesztése, fixture-enként 10 000-ig teljes felsorolással. Mindkét mérésben minden fixture teljesen fel lett sorolva;
- **Orákulum:** P0 a TS overload-szomszédossággal pontosítva. Ettől lett a régi `ch-ts-overloads` 2 rése valójában 2 hibás elfogadás.

| Mérőszám | Készlet / tartomány | Előtte | Utána |
| --- | --- | ---: | ---: |
| hibásan elfogadott elrendezés | K45 / W9, szomszédság + A(M) | 2 / 79 | **0 / 0** |
| indokolatlanul elutasított (completeness-rés) | K45 / W9, szomszédság | 28 / 6 | **6 / 8** |
| elfogadott szomszédos elrendezés | K45 / W9 | 201 / 58 | 223 / 39 |
| elfogadott teljes sorrend, mind orákulummal ellenőrizve | K45 / W9, A(M) | 5 100 / 125 | **11 449 / 61** |
| orákulum által eldöntetlen / validátor `indeterminate` | mind | 0 / 0 | 0 / 0 |
| nem támogatott (elemzés kikapcsolva: `eval`/`with`) | fixture / rés | 1 / 1 | 1 / 1 |
| generált élek | K45 / W9 | 546 / 113 | 547 / 113 |
| redundáns (megtartott olvasási) élek aránya | K45 / W9 | 5,13 % / 6,19 % | 4,94 % / 4,42 % |
| validátor-állapotok az összes elfogadott sorrenden | K45 | 158 582 | 361 706 |
| generálás, fixture-enkénti átlag összege | K45 | 68,2 ms | 64,4 ms |

- A W9 előtti számok a hibás elfogadásokat is tartalmazzák; az elfogadások csökkenése ott maga a javítás.
- Az állapotszám a több elfogadott sorrend miatt nő: a `class-inventory-ts` 2 880 helyett 5 760, a `class-accounts-ts` 1 680 helyett 5 040 sorrendet enged. Ennek oka a constructor és a `declare` mező szabaddá válása.
- A maradék 6 K45-rés:
  - `ch-direct-eval`: nem támogatott;
  - `ch-loop-and-catch-bindings`: `} catch {` határ;
  - `ch-typeof-strict-equality` és a két `algo-bfs-js` rés: csak a rögzített bemenetre ekvivalens, általánosan nem (rövidzár és ismeretlen értékű `+`);
  - `ch-template-coercion`: tiszta deklaráció barrieren át, az ADR-009-ben halasztva.
- A 8 W9-rés a lezárás szándékos ára: a precedencia nem tudja kifejezni, hogy egy sor „ne kerüljön a belsejébe”.

**Nagy referenciák** (szintetikus, legfeljebb 500 soros; generálás 5 futás mediánja, majd a referenciasorrend validálása):

| Alak | Sorok | Élek (redundáns) | Generálás előtte → utána | Referencia-állapotok | Validálás |
| --- | ---: | ---: | ---: | ---: | ---: |
| `flat-pure` | 500 | 499 (0) | 11,0 → 9,7 ms | 501 | < 5 ms |
| `blocks-and-helpers` | 497 | 496 (0) | 26,3 → 29,8 ms | 498 | < 5 ms |
| `class-members` | 500 | 499 (0) | 12,8 → 12,5 ms | 501 | < 5 ms |
| `continued-calls` | 498 | 497 (0) | 15,6 → 52,6 ms | 499 | < 5 ms |

A lezárás lyukas egységenként végigmegy a testvéreken. A `continued-calls` alakban ez négyzetes, de 500 soron belül 60 ms alatt marad. Egyetlen Windows-gépen mértem; az időértékek tájékoztatók.

**Regresszióvédelem a `check:all`-ban:**

- a korpuszteszt mind az 54 fixture-re, rögzített alapvonallal;
- [wp6-regressions.test.mjs](../tests/wp6-regressions.test.mjs): minden hibára a konkrét ellenpélda elutasítva, a megengedett sorrend elfogadva, mindkettő orákulummal egyeztetve;
- kiterjesztett véletlen programok (többsoros hívás, `} else {`, 12 mag): a régi generátor ezek közül 5-ben hibás sorrendet fogadott el;
- [ordering-scale.test.mjs](../tests/ordering-scale.test.mjs): determinisztikus élszám- és állapotkorlátok az 500 soros referenciákra.

## ADR-010: reflexiós mérés

**Tesztkészlet:**

- **K45:** az eredeti 45 fixture;
- **W9:** a WP6-reprodukciók;
- **R5:** 5 új reflexiós fixture (`origin: 'reflection'`);
- **Mérés:** a szomszédság (K45: 10 861, W9: 1 870, R5: 5 323 elrendezés), valamint az A(M), fixture-enként 10 000-ig teljes felsorolással (kivétel: az `refl-ts-erased-and-overloads` mindkét oldalon 300 rögzített magú mintával);
- **Előtte:** a `2408988` HEAD kódja, külön munkakönyvtárban; **utána:** az ADR-010 kódja. A mérőeszköz, a korpusz és az orákulum mindkét oldalon azonos.

**Két orákulumpolitika.** A két politika számai közvetlenül nem hasonlíthatók össze, ezért mindkettő külön oszlopban szerepel:

- **`call-only`** (régi P0–P3): érték, kivétel és hatásnapló, reflexió csak akkor, ha a probe maga reflektál;
- **`reflective`** (P0–P4): ehhez jön a kulcssorrend szintaktikai szabálya és a futásidejű pillanatkép.

| Mérőszám | Készlet | call-only, előtte | reflective, előtte | reflective, **utána** | call-only, utána |
| --- | --- | ---: | ---: | ---: | ---: |
| hibásan elfogadott (A(M) + szomszédság) | K45 / W9 / R5 | 0 / 0 / 2 | **9 151** / 0 / **5 170** | **0 / 0 / 0** | 0 / 0 / 0 |
| indokolatlanul elutasított szomszéd | K45 / W9 / R5 | 6 / 8 / 8 | 6 / 7 / 8 | 6 / 7 / 8 | 6 / 8 / 17 |
| elfogadott teljes sorrend, A(M) | K45 / R5 | 11 449 / 5 524 | 11 449 / 5 524 | 2 298 / 1 928 | 2 298 / 1 928 |
| generált élek | K45 / W9 / R5 | 547 / 113 / 118 | ← | 555 / 113 / 122 | ← |
| validátor-állapotok A(M)-en | K45 | 361 706 | ← | 65 533 | ← |
| generálás, fixture-átlagok összege | K45 | 60,6 ms | 60,2 ms | 65,2 ms | 64,6 ms |

**Értelmezés:**

- A régi politika a hibát csak ott látta, ahol maga a program reflektált (`refl-explicit-property-names`, 2 eset). A korpusz többi probe-ja nem reflektált, ezért a régi mérés 0-t mutatott.
- A reflektáló politika szerint a régi generátor 11 eredeti fixture-ön fogadott el hibás sorrendet:
  - `class-inventory-ts`: 4 800;
  - `class-accounts-ts`: 4 200;
  - `ch-ts-hoisted-types`: 120;
  - `js-class-fields-methods`: 12;
  - és még hét, osztály nélküli fixture-ön összesen 19, ahol felső szintű függvénydeklarációk cserélődtek.
- Az új modell az eredeti 45 fixture-ön pontosan a régi elfogadott halmaz helyes részét fogadja el (11 449 − 9 151 = 2 298), és a szomszédsági rések száma nem változott.
- Az R5-ön az elfogadás 354 helyes sorrendről 1 928-ra nőtt. Oka, hogy a privát, a tömbindex nevű és a constructor tag szabaddá vált.
- A `call-only` szerinti 17 R5-rés az új, szigorúbb szemantika szándékos következménye: a régi politika ekvivalensnek tartott 9 olyan szomszédot, amely reflexióval megkülönböztethető.

### v7-kiegészítés: `accessor` mezők és TS-kibocsátott globálisok

A felülvizsgálat két új reflexiós fixture-t adott a korpuszhoz (`refl-ts-accessor-fields`, `refl-ts-emitted-globals`), így R5 helyett R7 a reflexiós készlet. Mindkét oldalon az új orákulum (TS-globálisok a kibocsátott szkriptből, `accessor` a kulcsláncban) és ugyanaz a 61 fixture fut; az előtte oldal a `dcfda83` kódja külön munkakönyvtárban.

| Mérőszám | K45 előtte → utána | W9 | R7 előtte → utána |
| --- | ---: | ---: | ---: |
| hibásan elfogadott (A(M) + szomszédság) | **1 → 0** | 0 → 0 | **463 → 0** |
| indokolatlanul elutasított szomszéd | 6 → 6 | 7 → 7 | 25 → 25 |
| elfogadott teljes sorrend, A(M) | 2 298 → 2 297 | 61 → 61 | 2 503 → 2 042 |
| generált élek | 555 → 556 | 113 → 113 | 161 → 164 |
| validátor-állapotok A(M)-en | 65 533 → 65 524 | 837 → 837 | 85 919 → 74 894 |

**Értelmezés:**

- A K45 egyetlen hibája a `ts-enum`: a `function evaluate` az `enum Level` elé kerülhetett, és ezzel megváltozott az `Object.keys(globalThis)` sorrendje. A régi orákulum ezt nem látta, mert a TS-globálisokat a saját AST-bejárásával gyűjtötte, és abból az `enum` kimaradt.
- Az R7 463 hibája: 449 az `accessor` mezőn átlépő metódusokból, 14 a kibocsátott `enum`/`namespace`/`import =` globálisokon átlépő függvényekből.
- A javítás csak éleket ad hozzá, ezért az új elfogadott halmaz a régi részhalmaza, és minden eleme orákulummal ellenőrzötten helyes. Kiesett teljes sorrendek: `ts-enum` 1, `refl-ts-accessor-fields` 448, `refl-ts-emitted-globals` 13. (A hibaszám a hibás szomszédsági elfogadásokat is tartalmazza, ezért nagyobb lehet.) A rések száma nem nőtt; a típus-only `Shapes` namespace előtt a függvény továbbra is szabad.
- A generálási idő változása (fixture-átlagok összege) mérési zajon belül van.

### Generatív lefedettség: osztályok, szkriptszint, TypeScript

A korábbi véletlenprogram-generátor csak egyetlen függvénytörzs JS-kódját állította elő; osztályt, szkriptszintű deklarációt és TypeScriptet nem. A v7-hibákat ezért kézi felülvizsgálat találta meg. A [random-programs.mjs](../tests/support/random-programs.mjs) két új, rögzített magú módot kapott:

- **`randomClassProgram`:** felső szintű osztály (fele eséllyel egy ősosztállyal), és a `evaluate()`-ben beágyazott osztály. Tagjai: metódus, static metódus és mező, getter, accessorpár, mező (korábbi mezőt vagy `record` hívást olvasó inicializálóval), privát mező és metódus, tömbindex, string és számított nevű metódus, constructor, JS-ben duplikált név. TypeScriptben ezen felül: `declare` mező, paramétertulajdonság, overload-csoport, `accessor` és `static accessor` mező, interface.
- **`randomScriptProgram`:** klasszikus szkript `function`, `var`, `let`, `const`, `class`, értékadás és `record` utasításokkal. TypeScriptben ezen felül: `enum`, példányosított és típus-only `namespace`, `import =` alias, interface, type alias és `declare`.

Minden referencia hiba nélkül lefut; ezt a `check:all` 160 programon ellenőrzi. Minden programon három sorrendfajta fut: 25 mintavett teljes sorrend, a teljes egysoros szomszédság, valamint minden blokkmozgatás.

**A `check:all`-ban** ([ordering-properties.test.mjs](../tests/ordering-properties.test.mjs)): 12 JS- és 4 TS-osztályprogram, 12 JS- és 8 TS-szkript, összesen kb. 45 s. A TS-osztályprogramoknál az egysoros szomszédság minden negyedik eleme fut, a blokkmozgatás teljesen.

**Kézi kampány:** [ordering-campaign.mjs](../tests/ordering-campaign.mjs). A soundness-sértést azonnal, minimalizált sorrenddel és forráskóddal írja ki, és ilyenkor 1-es kilépési kóddal áll le. Mérés a `check:all`-tól eltérő magokon:

| Programfajta | Magok | Sorrendek | Elfogadott | Hibás elfogadás | Completeness-rés | Blokkmozgatás |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| JS-osztály | 61–200 | 190 461 | 7 434 | **0** | 1 769 | 6 872 |
| TS-osztály | 61–130 | 109 722 | 4 328 | **0** | 796 | 4 417 |
| JS-szkript | 61–200 | 26 497 | 2 307 | **0** | 271 | 5 573 |
| TS-szkript | 61–200 | 46 233 | 2 753 | **0** | 657 | 5 465 |
| JS-függvénytörzs (régi generátor) | 31–90 | 37 458 | 1 256 | **0** | 31 | 3 130 |
| **Összesen** | 550 program | 410 371 | 18 078 | **0** | 3 524 | 25 457 |

Orákulum által eldöntetlen és validátor `indeterminate` eredmény nem volt. Ezen felül egy előzetes futás az 5–60. magon, mind a négy új változatra, 168 655 sorrendet vizsgált; ott sem volt hibás elfogadás.

**Értelmezés:** a v7 utáni szabályokban a vizsgált alakkészleten nem került elő újabb hibás elfogadás. Ez korlátos empirikus bizonyíték, nem bizonyítás: a generátor csak a fent felsorolt alakokat állítja elő, és a futásidejű összevetés a rögzített probe-ra szól. A completeness-rések (például a mezőkhöz képest szabadon mozgatható, de egymáshoz kötött metódusok, valamint a típus-only namespace barrierje) a lazítási feladat bemenetei.

### ADR-012: osztálykiértékelési fázisok és accessorpárok

**Korpusz** (61 fixture, azonos orákulum; előtte a `2358cea` kódja külön munkakönyvtárban):

| Mérőszám | K45 | W9 | R7 előtte → utána |
| --- | ---: | ---: | ---: |
| hibásan elfogadott (A(M) + szomszédság) | 0 → 0 | 0 → 0 | **0 → 0** |
| indokolatlanul elutasított szomszéd | 6 → 6 | 7 → 7 | 25 → 20 |
| elfogadott teljes sorrend, A(M) | 2 297 → 2 297 | 61 → 61 | 2 042 → 3 706 |
| validátor-állapotok A(M)-en | változatlan | változatlan | 74 894 → 134 990 |

A K45 és a W9 nem tartalmaz accessorpárt, vegyes static és példánymezőt vagy számított nevű metódust, ezért változatlan. Az R7-en a `refl-index-private-accessor-duplicate` (1 440 → 2 880, a getter és a setter felcserélhető) és a `refl-ts-accessor-fields` (112 → 336, a static és a példánymezők egymáshoz képest szabadok) változott. Az állapotszám az elfogadott sorrendek számával arányosan nőtt.

**Generatív kampány** (ugyanazok a magok, ugyanaz a mintavevő mindkét oldalon):

| Programfajta | Hibás elfogadás | Indokolatlan elutasítás előtte → utána | Elfogadott előtte → utána |
| --- | ---: | ---: | ---: |
| JS-osztály (140) | **0 → 0** | 1 769 → 1 047 | 7 425 → 8 615 |
| TS-osztály (70) | **0 → 0** | 796 → 449 | 4 326 → 4 789 |
| JS- és TS-szkript, JS-függvénytörzs (340) | **0 → 0** | 959 → 959 | 6 318 → 6 318 |
| **Összesen** (550 program, kb. 411 000 sorrend) | **0** | 3 524 → 2 455 (−30%) | 18 069 → 19 722 |

Az osztályprogramokon a rések száma 42%-kal csökkent. A szkript- és a függvényprogramok számai bájtra azonosak, mert a szabályok csak osztálytagokat érintenek.

**Teljesítmény:** a validálás a nagy referenciákon is 16 ms alatt maradt. A generálás a 500 soros osztályon 10,7 ms helyett 16,6 ms, mert a fázisélek bekötése lineáris: fázisonként csak a legutóbbi egység kap élt. Egy négyzetes változat ugyanerre 79,6 ms volt, és bájtra azonos modelleket adott 425 programon.

**Tesztsegéd-javítás:** az `extensions` mintavevő véletlen mélységi keresése a lazább modelleken néhány programon exponenciálisan sok zsákutcába futott (≥20 s magonként). Most nem nyit meg blokkot, amíg a blokk belső sorainak külső függőségei nincsenek a helyükön, és nem zár le blokkot, amíg az összes belső sora nincs lerakva. Ez csak a halott ágakat vágja le: a teljes felsorolás eredménye és sorrendje változatlan, a véletlen minták viszont mások, mint korábban. Ezért a fenti kampányt mindkét oldalon az új mintavevővel futtattam újra.

### ADR-013: lokális írások, klauzulaláncok és importok

**Korpusz** (64 fixture: K45, W9, R7 és az új P3 `precision` készlet; azonos, pontosított P2-t követő orákulum mindkét oldalon; előtte a `76382c7` kódja külön munkakönyvtárban):

| Mérőszám | K45 | W9 | R7 | P3 |
| --- | ---: | ---: | ---: | ---: |
| hibásan elfogadott (A(M) + szomszédság) | 0 → **0** | 0 → **0** | 0 → **0** | 0 → **0** |
| indokolatlanul elutasított szomszéd | 5 → 4 | 7 → 4 | 20 → 20 | 7 → 1 |
| elfogadott teljes sorrend, A(M) | 2 297 → 2 299 | 61 → 64 | 3 706 → 3 706 | 32 → 128 |

**Megjegyzés a K45 kiinduló értékéhez:** a K45 előtte-értéke azért 5 és nem 6, mert a pontosított P2 a `ch-typeof-strict-equality` egyik korábbi „rését” helyesen indokolt elutasításnak sorolja be. Ott a `chosen` a `fallback`-et olvassa (RAW), és csak a rögzített probe nem értékeli ki.

**Generatív kampány** (azonos magok, mintavevő és orákulum mindkét oldalon):

| Programfajta | Hibás elfogadás | Indokolatlan elutasítás előtte → utána | Elfogadott előtte → utána |
| --- | ---: | ---: | ---: |
| JS-függvénytörzs, lokális írásokkal és `} else {` határokkal (140) | **0 → 0** | 166 → 53 | 3 214 → 3 432 |
| JS- és TS-osztály (140) | **0 → 0** | 984 → 984 | 9 210 → 9 210 |
| JS- és TS-szkript (280) | **0 → 0** | 922 → 922 | 5 060 → 5 060 |
| **Összesen** (560 program, kb. 386 000 sorrend) | **0** | 2 072 → 1 959 | 17 484 → 17 702 |

**`CopyFieldUtilityService`** (teljes fájl, generált és ténylegesen validált modell):

- elhagyott blokk 8 → 0, soros zárolóél 30 → 0;
- a 248↔249 csere elfogadott, a 305↔306 (`UUID()`) és a 251↔252 (hívások) csere elutasított;
- az importcserék mindkét emit-kontextusban pontosan a TypeScript-emit szerint döntődnek el (90 párdöntés).

**Teljesítmény:** a nagy referenciák generálása 13–52 ms, a validálásuk 3 ms alatt marad; a négy alak referencia-állapotszáma változatlan (sorok + 1).

**Szomszédsági vakfolt.** A szomszédság egysoros mozgatásokat és párcseréket vizsgál, ezért egy többsoros metódusblokk cseréjét nem látja. A hibát csak az A(M) és az új tagblokk-permutációs teszt mutatta ki: [reflection-ordering.test.mjs](../tests/reflection-ordering.test.mjs). Ez öt osztályra kimerítően vagy mintával felsorolja a tagblokkok sorrendjét, és az elfogadott ⊆ ekvivalens feltételt ellenőrzi; három esetben pontos egyezéssel.

**Nagy referenciák** (reflective, előtte → utána): a generálás `flat-pure` 10,0 → 10,1 ms, `blocks-and-helpers` 29,4 → 30,6 ms, `class-members` 11,5 → 11,2 ms, `continued-calls` 45,6 → 46,3 ms. A referencia-állapotok (sorok száma + 1) változatlanok, a validálás minden alakra 4 ms alatt marad.

### ADR-019: tiszta egység és hatás-barrier kommutációja

**Módszer:** mindkét oldalon ugyanaz a v10 P2-t követő orákulum fut. Az előtte-oldal a `c6ed3e0` (v9) generátora, külön munkakönyvtárban.

**Korpusz** (64 fixture):

| Mérőszám | K45 | W9 | R7 | P3 | Összesen |
| --- | ---: | ---: | ---: | ---: | ---: |
| hibásan elfogadott | 0 → **0** | 0 → **0** | 0 → **0** | 0 → **0** | 0 → **0** |
| elfogadott szomszéd | 224 → 237 | 42 → 42 | 123 → 123 | 28 → 28 | 417 → 430 |
| indokolatlanul elutasított szomszéd | 16 → 3 | 5 → 5 | 20 → 20 | 1 → 1 | 42 → 29 |
| elfogadott teljes sorrend, A(M) | 2 299 → 2 314 | 64 → 64 | 3 706 → 3 706 | 128 → 128 | 6 197 → 6 212 |

**Generatív kampány** (`node tests/ordering-campaign.mjs`, alapértelmezett magok, programfajtánként 200 program):

| Programfajta | Hibás elfogadás | Indokolatlan elutasítás előtte → utána | Elfogadott előtte → utána |
| --- | ---: | ---: | ---: |
| JS-függvénytörzs | **0 → 0** | 2 070 → 502 | 4 886 → 8 526 |
| JS-osztály | **0 → 0** | 1 495 → 1 423 | 11 966 → 12 159 |
| TS-osztály | **0 → 0** | 1 261 → 1 197 | 12 742 → 12 886 |
| JS-szkript | **0 → 0** | 431 → 431 | 3 122 → 3 122 |
| TS-szkript | **0 → 0** | 810 → 810 | 4 000 → 4 000 |
| **Összesen** (1 000 program, kb. 790 000 sorrend) | **0** | 6 067 → 4 363 | 36 716 → 40 693 |

A szkriptszint szándékosan változatlan, mert ott az ADR-019 nem érvényes.

**Projekciós veszteség:**

| Hol | Előtte → utána | Ok |
| --- | --- | --- |
| CopyField | 0 → 3 pár | egy tiszta arrow-deklaráció átléphetne egy lyukas többsoros egységet, a lezárás nem engedi |
| `wp6-hoisted-into-continued-call` | 1 → 2 pár | ugyanez |

Mindkettőt `conservative` státusz jelzi.

**A bejelentett eset:**

- **`binarySearch`:** a `low`/`high` és az `insertionSort` `current`/`j` cseréje a generált modellben elfogadott, a futás szerint ekvivalens.
- **CopyField:** a 305↔306 (`UUID()`) és a 251↔252 csere továbbra is elutasított.

**Teljesítmény:** a nagy referenciák generálása és validálása a mérési zajon belül maradt; a két oldal párhuzamos terhelés alatt futott.

### ADR-020: a metódusok és függvények kulcssorrendje

**Módszer:** mindkét oldalon ugyanaz a v11 P4-et követő orákulum fut. Az előtte-oldal a `bd6c460` (v10) generátora, külön munkakönyvtárban.

**Korpusz** (64 fixture):

| Mérőszám | K45 | W9 | R7 | P3 | Összesen |
| --- | ---: | ---: | ---: | ---: | ---: |
| hibásan elfogadott | 0 → **0** | 0 → **0** | 0 → **0** | 0 → **0** | 0 → **0** |
| elfogadott szomszéd | 237 → 237 | 42 → 42 | 123 → 132 | 28 → 28 | 430 → 439 |
| indokolatlanul elutasított szomszéd | 3 → 3 | 6 → 6 | 33 → 24 | 1 → 1 | 43 → 34 |
| elfogadott teljes sorrend, A(M) | 2 314 → 11 469 | 64 → 64 | 3 706 → 5 612 | 128 → 128 | 6 212 → 17 273 |

**Generatív kampány** (`--kinds=class,script`, programfajtánként 200 program; a függvénytörzseket a v11 nem érinti):

| Programfajta | Hibás elfogadás | Indokolatlan elutasítás előtte → utána | Elfogadott előtte → utána |
| --- | ---: | ---: | ---: |
| JS-osztály | **0 → 0** | 4 276 → 1 198 | 12 159 → 15 804 |
| TS-osztály | **0 → 0** | 3 601 → 1 596 | 12 886 → 15 122 |
| JS-szkript | **0 → 0** | 2 567 → 480 | 3 122 → 6 682 |
| TS-szkript | **0 → 0** | 2 528 → 861 | 4 000 → 6 952 |
| **Összesen** (800 program, kb. 650 000 sorrend) | **0** | 12 972 → 4 135 | 32 167 → 44 560 |

**Könyvtári példák:** a két osztálypélda kézi modelljének minden teljes sorrendje futásidőben ekvivalens (5 760, illetve 20 160 sorrend, kimerítően).

**Maradó rések:**

- **a példánymezők sorrendje:** szándékos, az `accessor` mezőé is;
- **az overload-szignatúrák sorrendje:** konzervatív;
- **a lyukas overload-csoport körüli lezárás:** projekciós veszteség.

## Ismert korlátok

- **Reflexió (ADR-010, ADR-020):** a szkriptszintű `var`/`enum`/`namespace` deklarációk sorrendje kötött. A különböző nevű metódusok, `accessor` mezők és a szkriptszintű függvények egymáshoz képesti sorrendje v11 óta csak reflektáló programban kötött; az `accessor` mező mezőként a mezők között a helyén marad. Egy namespace csak akkor szabad, ha törzse kizárólag típus- vagy `declare` deklarációkat tartalmaz. A duplikált nevű tag és a számított nevű mező konzervatív. Az accessorpár két fele nem állhat a következő kulcs két oldalán, akkor sem, ha a kulcs az első fél helyén keletkezik (precedenciával nem kifejezhető). A beágyazott osztályokat a probe utáni futásidejű pillanatkép és a szintaktikus P4-szabály ellenőrzi. A forrásszöveg-reflexió kizárt.

- **Scope-áthelyezés:** a v2 `scopeId` soronként egyetlen scope-ot enged, ezért egy deklaráció beljebb vagy kijjebb helyezése elutasított (P1 szerint ez szándékos).
- **Property-olvasás, getter, destrukturálás:** barrier, egy kivétellel. Függvénytörzs listájában a saját objektumokon (helyben létrehozott példány, tömb- és objektumliterál, a konstruktor `this`-e) végzett művelet hatásnyomot kap (ADR-025, ADR-028, ADR-031). A nyom a konstruktor-, metódus- és accessortörzsek absztrakt végrehajtásával, mezőszinten számol. A `.length` csak string értéken elemezhető; az objektumonként összevont mezőérték elveszíti az ismert értékét. A destrukturálás mindig barrier.
- **Újraírt `let`/`var` és nem primitív koerciós operandus:** barrier. A soha újra nem írt `let`/`var` függvénykontextusban `const`-ként kezelődik; a csak `++`/`--` által írt, primitív kezdőértékű számláló primitív (ADR-019).
- **Tiszta egység és barrier (ADR-019):** szabad, kivéve: `var` vagy `using`; szkript- és modulszint; `arguments`; vezérlésátadást tartalmazó barrier; closure-ön át elért kötés; név szerinti egyezés a barrierben (az árnyékoló név is tilt). Egy lyukas többsoros barrier körül a lezárás a forrásbeli oldalt tartja.
- **Lokális írások (ADR-013):** a lokális írás csak konfliktus esetén kötött. Akadály marad: a paraméter mint cél, az összetett értékadás (`+=`), a `++`/`--`, a property-írás, a szkriptszintű írás, a több deklarációt tartalmazó utasítás és a ciklusfejbeli változó írása.
- **Importok (ADR-013):** a modulbetöltő importok egymáshoz és a többi utasításhoz képest kötöttek, az ES-modul-hoistolást a szabály nem használja ki. Ismeretlen buildnél a `verbatim` kontextus érvényes.
- **Lyukas többsoros egység:** egy pozíciófüggetlen sor nem léphet át rajta (lezárás).
- **Más függvénykontextusból olvasott `let`/`const`/osztály:** barrier, mert a belső függvény a deklaráció előtt is futhat.
- **Vezérlési szerkezetek (ADR-028, ADR-032, ADR-034):** függvénytörzs listájában az `if / else if / else`, a `switch`, a `try/catch/finally` és a saját tömbön futó, azt nem író `for…of` hatásnyomot kap, ha a tartalma saját objektumokon dolgozik, és nem lép ki belőle `return`. Az ismert érték (literál, kódot nem futtató művelet) eldönti az ágat. Barrier marad:
  - a számlálós `for`, a `while`, a `do` és a `for…in`;
  - a címkés ugrás és a bejárt tömböt író ciklus;
  - a helyi `let`/`var` változót író szerkezet;
  - minden szerkezet, amely nem csak saját objektumon dolgozik, vagy a szkript-, modul- és osztályszinten áll.
- **`switch`:** a `case` sorai saját blokk nélküli többsoros egységet alkotnak. A v2-projekció ezt lezárja (ADR-009), ezért a `switch` sorai a szomszédaihoz képest sorosak.
- **Kivétel (ADR-028):** két lehetséges kivétel egymáshoz képest kötött (`may-throw`), mert a felszínre kerülő üzenet a sorrendtől függ. Egyetlen lehetséges kivétel szabadon mozoghat a kivételt nem dobó saját objektumműveletek között.
- **TS-overload-csoportok, duplikált nevek, dekorátorok, kommentek, többsoros folytatások:** konzervatívak.
- **Futásidejű osztálymezők:** a sorrend a fázisukon belül kötött (ADR-012). Kivétel (ADR-029, v14): a kódot nem futtató, egyedi nevű példánymezők egymáshoz képest szabadok, ha a program nem listázza a kulcsokat. A kódot futtató kezdőértékű mező, a `static` és az `accessor` mező kötött marad. A `declare` mező és a constructor szabad.
- **Async:** az `await` előtti és utáni tiszta sorok nem lépnek át rajta.

## Kompatibilitás és nyelvi határ

- **Régi modellek:** az importált modellek függőségei nem változnak. Újragenerálás csak explicit „Sorfüggőségek újraszámítása” műveletre történik.
- **Policy-címke:** új generáláskor `scoped-effect-analysis-v19` (ADR-040). A régi enumértékek, köztük a v4–v18, érvényesek maradnak (additív sémabővítés).
- **Generatív lefedettség:** a kampány `flow` fajtája ([random-programs.mjs](../tests/support/random-programs.mjs), `randomFlowProgram`) a saját objektumokon dolgozó műveleteket vezérlési szerkezetekbe ágyazza, JS-ben és TS-ben. Tartalmazza a fenti szabad és barrier alakokat is (`else if`, `switch`, `try`, `for…of`, számlálós `for`, `while`, címkés ugrás).
- **Belső szerződés (ADR-011):** az adapter `orderingRelations` metódusa nyelvfüggetlen [`OrderingRelations`](../src/author/ordering-relations.ts) relációt ad: előzmények, védett bemenetek, egységhatárok, megjegyzés, 0-alapú fizikai sorokon. A projekciót a típusos [code-line-projection.ts](../src/author/code-line-projection.ts) végzi (ADR-013), a validátor nem változik.
- **Proveniencia (ADR-014):** minden előzményhez ok tartozik (kategória és kód), a projekció a saját éleinek okát is rögzíti, és a modell `authoring.provenance` mezőjébe csak a redukció után megmaradt élek okai kerülnek. Ez magyarázat, nem szabály: a validáció nem olvassa. Csak addig érvényes, amíg az `authoring.evidence` digestje egyezik a sorokkal (ADR-015); különben `unbound`.
- **Python-adapterhez:** natív IR v3 út egységszintű relációkkal; a v2-projekció nem használható. A szerkezeti feladatok: [Python-terv](python-adapter-plan.md#illeszkedés-a-közös-sorrendi-szerződéshez-wp7-adr-011).
