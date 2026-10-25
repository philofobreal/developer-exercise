# Formális sorrendi szerződés és hatáselemzés

Ez a dokumentum a generált sorrendszabályok jelentését, a támogatott résznyelvet és a bizonyossági szinteket rögzíti. A döntés: [ADR-008](adr/008-effect-based-statement-ordering.md). A strukturális elfogadási feltétel változatlan: [validációs modell](validacios-modell-es-formazas.md).

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

P3-at csak rögzített bemenetekkel lehet ellenőrizni, ezért a teszteken empirikus bizonyíték. P0–P2 szintaktikai, tehát pontosan ellenőrizhető.

## Generálási szabályok

Az [elemző](../src/author/statement-ordering.ts) minden SourceFile/Block/ModuleBlock listát egységekre bont.

| Egység | Feltétel | Indok (evidence) |
| --- | --- | --- |
| pure | egyetlen `const`/`let`/`var` deklaráció tiszta inicializálóval vagy anélkül (`let x;`), sajátjában álló sorokon | `pure-declaration`, `uninitialised-declaration` |
| pure | osztálydeklaráció dekorátor, számított kulcs, static inicializáló/blokk nélkül; `extends` csak deklarált osztályra | `class-definition` |
| pure | blokk vagy `if`, amelynek minden része tiszta | `pure-block`, `pure-branch` |
| position-free | egyedi nevű, törzzsel rendelkező függvénydeklaráció szkript-, modul- vagy függvénytörzs-szinten | `hoisted-function-declaration` |
| position-free | egyedi `interface`, `type`, `declare` utasítás | `erased-type-declaration` |
| barrier | minden más (hívás, írás, ciklus, vezérlésátadás, overload, Annex B blokkfüggvény, többsoros folytatás) | a SyntaxKind vagy az ok neve |
| opaque | komment és egyéb nem-utasítás sor | `non-statement-row` |

**Tiszta kifejezés** (`pure`): nem futtat felhasználói kódot, és bemenetei inicializáltsága után nem dob. Ide tartozik:

- feloldott kötés olvasása (`const`/`let`/`var` utasítás, paraméter, ciklus- és `catch`-változó, hoistolt függvény, korábbi osztály);
- friss objektum- vagy tömbliterál tiszta elemekkel (spread, számított kulcs és `__proto__` nélkül; a metódus- és accessor-definíció megengedett);
- függvény- és arrow-kifejezés (a törzse nem fut);
- `!`, `typeof`, `void`, `===`/`!==`, `&&`/`||`/`??`, feltételes kifejezés;
- primitív értékek felett a koerciós operátorok.

**Primitív érték:** szám-, string- és template-literál primitív helyettesítésekkel, `true`/`false`/`null`, illetve primitív inicializálójú `const` olvasása. Csak primitív érték lehet koerciós operátor (`+`, `<`, `${}` stb.) operandusa, mert objektumnál a `valueOf`/`toString` felhasználói kódot futtathat. A BigInt literál kizárt, mert a vegyes műveletek dobnak.

**Élek** egy listán belül, `i < j` egységekre:

```
edge(i.last → j.first)  ⇔  opaque(i) ∨ opaque(j) ∨ (¬free(i) ∧ ¬free(j) ∧ (barrier(i) ∨ barrier(j)))
```

Ezen felül minden kiértékelési idejű olvasás védett élt kap a kötést inicializáló utasítás sorától, ha az ugyanabban a függvénykontextusban van (TDZ- és értékpozíció). A más függvénykontextusból, paraméterből, ciklus- vagy `catch`-változóból, illetve hoistolt függvényből származó olvasáshoz nem kell él.

`with` vagy közvetlen `eval` esetén az egész fájl elemzetlen marad, minden sor soros.

**Osztálytagok** ([type-member-ordering](../src/author/type-member-ordering.ts), JS és TS): az egyedi nevű metódus, accessor és constructor definíció pozíciófüggetlen az osztálytörzsben. A futásidejű mezők, a static kód és a duplikált nevek sorrendje kötött. Az ADR-007 törölt típustag-futamai változatlanok.

## Helyességi érvelés a támogatott résznyelven

Állítás: ha P a fenti résznyelvre esik, és teljesülnek az A1–A4 feltevések, akkor minden `S ∈ A(M)` kielégíti P1–P3-at.

Feltevések:

- **A1:** a TypeScript parser és checker kötésfeloldása helyes a referencián.
- **A2:** nincsenek egzotikus hoszt-objektumok a primitív műveletekben.
- **A3:** nincs `with`/`eval` (kizárt).
- **A4:** a megosztott fizikai határú intervallumok sorosak (a generátor biztosítja).

Vázlat:

1. **Lokalitás.** A validátor `Scope` feltétele miatt minden sor a saját listájában marad, így a listák függetlenül vizsgálhatók; P1 teljesül.
2. **Barrier-stabilitás.** Bármely két barrier közötti szakaszban a pure egységek által olvasható állapot állandó, mert csak barrier ír, hív vagy ad át vezérlést, és a barrier relatív helye minden rendezett testvérhez képest rögzített.
3. **Pure kommutáció.** Két pure egység nem futtat kódot és nem dob. Csak a saját, egyedi kötését inicializálja, és a másik kötését csak védett éllel olvashatja. Felcserélésük ezért egyetlen kötés értékét, kivételt vagy hatásnaplót sem változtat meg.
4. **Pozíciófüggetlenség.** Függvénydeklarációt a FunctionDeclarationInstantiation vagy a GlobalDeclarationInstantiation a lista belépésekor hoz létre; törölt TS-deklarációnak nincs emitje. Egy metódust a ClassDefinitionEvaluation minden mezőinicializáló és static kód előtt telepít.
5. **Késleltetett olvasás.** Closure-törzs csak hívásra fut, a hívás pedig barrier.
6. **Kompozíció.** A blokk összegzése a gyerekek összegzéséből áll, a kifelé mutató olvasások élként továbbadódnak, így az állítás indukcióval terjed a beágyazásra.

Ez emberi bizonyításvázlat, nem gépi verifikáció. A modelltől független ellenőrzése empirikus (lásd lent).

## Vizsgált technikák

- **Read/write-halmazok és konfliktusfüggőség:** kötésszinten megvalósítva az olvasásokra. Az írások egyelőre barrierek; egy írási halmaz a lokális `let` értékadásokat szabadítaná fel.
- **Vezérlésifolyamat-elemzés:** nem szükséges. A vezérlő utasítások barrierek, a validátor scope-ellenőrzése pedig megakadályozza a vezérlési régiók közötti mozgást.
- **Absztrakt interpretáció:** egyetlen könnyű tartomány (primitív/nem primitív érték) a koerciós operátorokhoz. Teljes keretrendszer nem indokolt.

## Empirikus bizonyíték

A [független orákulum](../tests/support/semantic-oracle.mjs) más kódútvonalat használ, mint a generátor: JavaScriptre Acornt, TypeScriptre saját AST-bejárást, és P0–P3-at ellenőrzi. A [45 fixture-ös korpuszon](../tests/fixtures/ordering-corpus.mjs) minden egysoros áthelyezés és páros csere (10 861 elrendezés) vizsgálva van, és minden elfogadható sorrend legfeljebb 5000-ig teljesen, fölötte rögzített maggal mintázva. Futtatás: `node tests/ordering-metrics.mjs`.

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

## Ismert korlátok

- **Scope-áthelyezés:** a v2 `scopeId` soronként egyetlen scope-ot enged, ezért egy deklaráció beljebb vagy kijjebb helyezése elutasított (P1 szerint ez szándékos).
- **Property-olvasás, getter, destrukturálás:** barrier.
- **`let`/`var` és nem primitív koerciós operandus:** barrier (`var base = 2; base * 2`).
- **Lokális írások:** konfliktuselemzés nélkül barrierek.
- **Ciklus, `try`, `switch`:** barrier; a `case`-listák sorosak.
- **TS-overloadok, duplikált nevek, dekorátorok, kommentek, többsoros folytatások:** konzervatívak.
- **Futásidejű osztálymezők és `declare` mező:** a sorrend a futásidejű mezőkhöz képest kötött.
- **Async:** az `await` előtti és utáni tiszta sorok nem lépnek át rajta.

## Kompatibilitás és nyelvi határ

- **Régi modellek:** az importált modellek függőségei nem változnak. Újragenerálás csak explicit „Sorfüggőségek újraszámítása” műveletre történik.
- **Policy-címke:** új generáláskor `scoped-effect-analysis-v4`; a régi enumértékek érvényesek maradnak (additív sémabővítés).
- **Belső szerződés:** a `StatementOrdering {entries, protectedInputs, units}` 0-alapú fizikai sorokon dolgozik, nyelvfüggetlen. A projekciót a generátor végzi, a validátor nem változik.
- **Python-adapterhez:** egy hasonló, saját kötés- és hatásmodellt adó elemző kell. A fő különbségek: függvényszintű scope, nincs TDZ, a `global`/`nonlocal` kezelése, a dekorátorok azonnali futása, az osztálytörzs végrehajtható kód, a behúzás pedig `exact` (lásd [Python-terv](python-adapter-plan.md)).
