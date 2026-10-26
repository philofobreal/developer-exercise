# Formális sorrendi szerződés és hatáselemzés

Ez a dokumentum a generált sorrendszabályok jelentését, a támogatott résznyelvet és a bizonyossági szinteket rögzíti. A döntések: [ADR-008](adr/008-effect-based-statement-ordering.md), a WP6-javítások: [ADR-009](adr/009-sealed-units-and-throw-free-reads.md), a reflektálható tulajdonságsorrend: [ADR-010](adr/010-reflective-property-order.md). A strukturális elfogadási feltétel változatlan: [validációs modell](validacios-modell-es-formazas.md).

## Fogalmak

- `P`: a szerző referenciaprogramja; `T`: a sorelőfordulások halmaza egyedi azonosítókkal; `Π(T)`: T összes permutációja.
- `M = G(P)`: a generált CodeLine v2 modell; `A(M) ⊆ Π(T)`: a validátor által elfogadott permutációk, ha a keresés döntésre jutott (`indeterminate` nem tartozik bele).
- Strukturális elfogadás (változatlan): `Accept(S) ⇔ ∃ profil p, ∃ tartalomhelyes bijekció f: Order(f, p) ∧ Scope(f) ∧ Fixed(f)`.
- `E_pol(P)`: a pedagógiai politika szerint P-vel egyenértékű permutációk (lásd lent). `E_pol(P) ⊆ E_run(P)`, ahol `E_run` a puszta futásidejű egyenértékűség.

**Soundness:** `A(M) ⊆ E_pol(P)`. **Completeness:** `E_pol(P) ⊆ A(M)`.

Tetszőleges JavaScript-programok szemantikai egyenértékűsége nem dönthető el mindig termináló algoritmussal (Rice tétele). Ezért egyik tulajdonságra sincs univerzális garancia. A cél: soundness a lent definiált résznyelven, növekvő completeness, és minden másra konzervatív (soros) szabály.

## Pedagógiai elfogadási politika (`E_pol`)

Egy S permutáció akkor egyenértékű P-vel, ha egyszerre teljesül:

1. **P0 szintaxis:** S elemezhető.
2. **P1 lexikai tulajdonlás:** minden utasítás és osztály-/típustag ugyanabban a listában marad (a listák multihalmazként egyeznek). Egy deklaráció másik scope-ba helyezése akkor sem engedett, ha a futás ugyanaz.
3. **P2 hatássorrend:** minden utasításlistában minden olyan pár relatív sorrendje megmarad, amelynek legalább egyik tagja kiértékeléskor hatásos (hívás, `new`, értékadás, `++/--`, `delete`, `await`, `yield`, `throw`, `return`, `break`, `continue`, property-olvasás, spread, destrukturálás, ciklus, `in`/`instanceof`, `eval`). Kivétel a pozíciófüggetlen tag: hoistolt függvénydeklaráció függvény/szkript-szinten, illetve törölt TS-típusdeklaráció. A függvény- és osztálytörzsek nem kiértékelési idejű hatások.
4. **P3 megfigyelhető viselkedés:** azonos visszatérési érték, kivétel és hatásnapló.
5. **P4 reflektálható tulajdonságsorrend (ADR-010):** a következők saját kulcssorrendje és descriptor-fajtája azonos:
   - az osztályok prototípusa és konstruktora;
   - a példánymezők;
   - a klasszikus szkript globális objektuma (`function`/`var`).

   Ezt minden reflexiós API megfigyeli: `Object.getOwnPropertyNames`, `Reflect.ownKeys`, `Object.keys`, `Object.getOwnPropertyDescriptors`.

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
| barrier | minden más (hívás, írás, ciklus, vezérlésátadás, Annex B blokkfüggvény, többsoros folytatás) | a SyntaxKind vagy az ok neve |
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

**Primitív érték:** szám-, string- és template-literál primitív helyettesítésekkel, `true`/`false`/`null`, illetve primitív inicializálójú `const` olvasása. **Írási halmaz:** a fájl összes értékadás-, `++/--`-, destrukturáló és `for-in/of` célpontja. Az írási halmazon kívüli (soha újra nem írt) `let`/`var` függvénykontextusban `const`-ként kezelődik. Szkriptszinten nem, mert ott a globális scope-on át (`globalThis`, indirekt `eval`, `Function`) szintaktikai hivatkozás nélkül is írható. Csak primitív érték lehet koerciós operátor (`+`, `<`, `${}` stb.) operandusa, mert objektumnál a `valueOf`/`toString` felhasználói kódot futtathat. A BigInt literál kizárt, mert a vegyes műveletek dobnak.

**Élek** egy listán belül, `i < j` egységekre:

```
edge(i.last → j.first)  ⇔  opaque(i) ∨ opaque(j) ∨ (¬free(i) ∧ ¬free(j) ∧ (barrier(i) ∨ barrier(j)))
```

Ezen felül minden kiértékelési idejű olvasás védett élt kap a kötést inicializáló utasítás sorától, ha az ugyanabban a függvénykontextusban van (TDZ- és értékpozíció). A más függvénykontextusból, paraméterből, ciklus- vagy `catch`-változóból, illetve hoistolt függvényből származó olvasáshoz nem kell él.

`with` vagy közvetlen `eval` esetén az egész fájl elemzetlen marad, minden sor soros.

**Lezárás (projekció, ADR-009).** A validátor egy sort ott fogad el, ahol a nyitott scope megegyezik a sor `scopeId`-jével. Egy többsoros egység belsejében ez csak két helyen fordulhat elő: a folytatósoroknál (például `record(` … `);`) és az elhagyott, megosztott határú blokkoknál (`} else {`, `} catch (e) {`). Ha egy egység belsejében van ilyen „lyuk”, minden azonos scope-ú testvéregység a forrásbeli oldalán marad:

```
lyuk(U) ⇔ ∃ r ∈ [U.first, U.last): nyitottScopeUtána(r) = scope(U.first)
lyuk(U) ∧ scope(X.first) = scope(U.first) ∧ X.last < U.first  ⇒  X.last → U.first
lyuk(U) ∧ scope(X.first) = scope(U.first) ∧ X.first > U.last  ⇒  U.last → X.first
```

A precedencia csak „előtte” vagy „utána” relációt fejez ki, a „nem a belsejében” feltételt nem. Ezért a lezárás a forrásbeli oldalt rögzíti: helyes, de egy pozíciófüggetlen sor ilyen egységen nem léphet át.

**Osztálytagok** ([type-member-ordering](../src/author/type-member-ordering.ts), JS és TS):

- **Szabad, azaz pozíciófüggetlen** az osztálytörzsben az egyedi nevű metódus, accessor és constructor definíció, valamint a `declare` mező.
- **Kulcslánc (ADR-010):** a string kulcsot létrehozó tagok azonos objektumon (prototípus, illetve `static` esetén a konstruktor) forrássorrendben maradnak. Ilyen a törzzsel rendelkező metódus és accessor, a számított, duplikált, accessorpár- és overload-implementáció is. A mezőkhöz képest szabadok maradnak.
- **Kívül marad a láncon:** a `constructor`, a tömbindex nevű, a privát `#` és a törölt tag.

 A paramétertulajdonságot a TypeScript mindkét osztálymező-módban a konstrukció elején állítja be, a constructor helyétől függetlenül. Egy overload-csoport (szignatúrák és implementáció) egyetlen kötött egység. A futásidejű mezők, a static kód és a duplikált nevek sorrendje kötött. Az ADR-007 törölt típustag-futamai változatlanok. A többsoros tagokra ugyanaz a lezárás vonatkozik.

## Helyességi érvelés a támogatott résznyelven

Állítás: ha P a fenti résznyelvre esik, és teljesülnek az A1–A4 feltevések, akkor minden `S ∈ A(M)` kielégíti P1–P3-at.

Feltevések:

- **A1:** a TypeScript parser és checker kötésfeloldása helyes a referencián.
- **A2:** nincsenek egzotikus hoszt-objektumok a primitív műveletekben.
- **A3:** nincs `with`/`eval` (kizárt).
- **A4:** a megosztott fizikai határú intervallumok sorosak, és minden lyukas többsoros egység le van zárva (a generátor biztosítja).

Vázlat:

1. **Lokalitás.** A validátor `Scope` feltétele egy sort csak a saját reprezentált scope-jába enged. Ezen belül a lezárás miatt egyetlen testvér sem kerülhet egy másik egység belsejébe (WP6: ez korábban hiányzott, lásd ADR-009). Így minden egység összefüggő marad és a saját listájában áll, a listák függetlenül vizsgálhatók, és P0/P1 teljesül.
2. **Barrier-stabilitás.** Bármely két barrier közötti szakaszban a pure egységek által olvasható állapot állandó, mert csak barrier ír, hív vagy ad át vezérlést, és a barrier relatív helye minden rendezett testvérhez képest rögzített.
3. **Pure kommutáció.** Két pure egység nem futtat kódot és nem dob, mert minden bemenete garantáltan inicializált (WP6: a más kontextusú TDZ-olvasás és az önhivatkozás kizárva; egy dobó „tiszta” sor helye closure-on és `catch`-en át megfigyelhető volt). Csak a saját, egyedi kötését inicializálja, és a másik kötését csak védett éllel olvashatja. Felcserélésük ezért egyetlen kötés értékét, kivételt vagy hatásnaplót sem változtat meg.
4. **Pozíciófüggetlenség.** Függvénydeklarációt a FunctionDeclarationInstantiation vagy a GlobalDeclarationInstantiation a lista belépésekor hoz létre; törölt TS-deklarációnak nincs emitje. Egy metódust a ClassDefinitionEvaluation minden mezőinicializáló és static kód előtt telepít. A létrehozási sorrend csak a kulcssorrendben látszik (P4). Ezt a kulcslánc rögzíti: osztályonként és objektumonként, a szkript globális objektumán pedig a függvények és a `var`-ok együttes láncával. A `constructor` kulcs mindig elsőként jön létre, a tömbindex-kulcsok növekvő sorrendben listázódnak, a privát nevek nem reflektálódnak.
5. **Késleltetett olvasás.** Closure-törzs csak hívásra fut, a hívás pedig barrier.
6. **Kompozíció.** A blokk összegzése a gyerekek összegzéséből áll, a kifelé mutató olvasások élként továbbadódnak, így az állítás indukcióval terjed a beágyazásra.

Ez emberi bizonyításvázlat, nem gépi verifikáció. A modelltől független ellenőrzése empirikus (lásd lent).

## Vizsgált technikák

- **Read/write-halmazok és konfliktusfüggőség:** kötésszinten megvalósítva az olvasásokra. Az írások egyelőre barrierek; egy írási halmaz a lokális `let` értékadásokat szabadítaná fel.
- **Vezérlésifolyamat-elemzés:** nem szükséges. A vezérlő utasítások barrierek, a validátor scope-ellenőrzése pedig megakadályozza a vezérlési régiók közötti mozgást.
- **Absztrakt interpretáció:** egyetlen könnyű tartomány (primitív/nem primitív érték) a koerciós operátorokhoz. Teljes keretrendszer nem indokolt.

## Empirikus bizonyíték

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

**Szomszédsági vakfolt.** A szomszédság egysoros mozgatásokat és párcseréket vizsgál, ezért egy többsoros metódusblokk cseréjét nem látja. A hibát csak az A(M) és az új tagblokk-permutációs teszt mutatta ki: [reflection-ordering.test.mjs](../tests/reflection-ordering.test.mjs). Ez öt osztályra kimerítően vagy mintával felsorolja a tagblokkok sorrendjét, és az elfogadott ⊆ ekvivalens feltételt ellenőrzi; három esetben pontos egyezéssel.

**Nagy referenciák** (reflective, előtte → utána): a generálás `flat-pure` 10,0 → 10,1 ms, `blocks-and-helpers` 29,4 → 30,6 ms, `class-members` 11,5 → 11,2 ms, `continued-calls` 45,6 → 46,3 ms. A referencia-állapotok (sorok száma + 1) változatlanok, a validálás minden alakra 4 ms alatt marad.

## Ismert korlátok

- **Reflexió (ADR-010):** a különböző nevű metódusok egymáshoz képesti, valamint a szkriptszintű `function`/`var` deklarációk sorrendje kötött. Az accessorpár, a duplikált és a számított nevű tag konzervatív. A futásidejű pillanatkép csak a felső szintű osztályokat látja; a beágyazottakat a szintaktikus P4-szabály ellenőrzi. A forrásszöveg-reflexió kizárt.

- **Scope-áthelyezés:** a v2 `scopeId` soronként egyetlen scope-ot enged, ezért egy deklaráció beljebb vagy kijjebb helyezése elutasított (P1 szerint ez szándékos).
- **Property-olvasás, getter, destrukturálás:** barrier.
- **Újraírt `let`/`var` és nem primitív koerciós operandus:** barrier. A soha újra nem írt `let`/`var` függvénykontextusban `const`-ként kezelődik.
- **Lokális írások:** maguk az írások barrierek; az írási halmaz csak az olvasások stabilitását dönti el.
- **Lyukas többsoros egység:** egy pozíciófüggetlen sor nem léphet át rajta (lezárás).
- **Más függvénykontextusból olvasott `let`/`const`/osztály:** barrier, mert a belső függvény a deklaráció előtt is futhat.
- **Ciklus, `try`, `switch`:** barrier; a `case`-listák sorosak.
- **TS-overload-csoportok, duplikált nevek, dekorátorok, kommentek, többsoros folytatások:** konzervatívak.
- **Futásidejű osztálymezők:** a sorrend kötött (a `declare` mező és a constructor szabad).
- **Async:** az `await` előtti és utáni tiszta sorok nem lépnek át rajta.

## Kompatibilitás és nyelvi határ

- **Régi modellek:** az importált modellek függőségei nem változnak. Újragenerálás csak explicit „Sorfüggőségek újraszámítása” műveletre történik.
- **Policy-címke:** új generáláskor `scoped-effect-analysis-v6` (ADR-010); a régi enumértékek, köztük a v4 és a v5, érvényesek maradnak (additív sémabővítés).
- **Belső szerződés:** a `StatementOrdering {entries, protectedInputs, units}` 0-alapú fizikai sorokon dolgozik, nyelvfüggetlen. A projekciót a generátor végzi, a validátor nem változik.
- **Python-adapterhez:** egy hasonló, saját kötés- és hatásmodellt adó elemző kell. A fő különbségek: függvényszintű scope, nincs TDZ, a `global`/`nonlocal` kezelése, a dekorátorok azonnali futása, az osztálytörzs végrehajtható kód, a behúzás pedig `exact` (lásd [Python-terv](python-adapter-plan.md)).
