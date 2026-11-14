# Nyitott tételek jegyzéke

Állapot: 2026-11-14, szabályverzió `scoped-effect-analysis-v58`. Ez az egyetlen hely, ahol a lezáratlan tételek össze vannak gyűjtve: a még meg nem oldott generátorhiányok, mérési korlátok, döntések és tervezési adósságok. A részletek a forrásként megadott ADR-ben vannak.

**Szabályok:**
- Minden ADR, amelynek „Nyitott” szakasza van, ide kerül. Ezt a [governance-teszt](../tests/governance.test.mjs) ellenőrzi.
- Egy tétel lezárásakor a sor „Lezárva” részbe kerül a lezáró ADR-rel. Nem törlődik.
- A mért hatás a legutóbbi teljes kampányból (12 mag, 7 fajta, 2 nyelv; az `inherit` fajta az ADR-074 óta) és a korpuszból való. A szám a rés, vagyis a fölöslegesen elutasított, futásidőben egyenértékű sorrend.

**Típusok:**
- **generátor:** a szabályok fölöslegesen szigorúak;
- **mérés:** az osztályozó vagy az orákulum korlátja;
- **döntés:** a felhasználó (pedagógiai vagy publikálási) döntése kell hozzá;
- **tervezés:** Ousterhout-féle adósság, viselkedésváltozás nélkül;
- **felület:** a szerző vagy a tanuló felületének hiánya, a validátor viselkedése nem változik;
- **környezet:** nem a repó hibája.

## Nyitott

| ID | Tétel | Típus | Mért hatás (legutóbbi kampány) | Forrás | Következő lépés |
| --- | --- | --- | --- | --- | --- |
| NY-40 | **Egymásra épülő TypeScript-tananyag, egyben tesztkorpusz** ([terv](terv-typescript-tananyag.md)): 20 lecke 10 modulban egy könyvtári kölcsönzőrendszer felépítésén át; minden lecke korpusz (`curriculum` eredet), a mérés után a jóváhagyottak szállított feladatok | döntés | még nincs mérés; a terv jóváhagyva (2026-11-12) | [terv](terv-typescript-tananyag.md) | C0 felmérés és jóváhagyás (a tananyag, a szintek, a kísérleti leckék) → C1 infrastruktúra → C2–C4 fázisok mérési jelentéssel → C5 lezárás; más ügynök (például Codex) is felveheti |
| NY-44 | **JS- és TS-korpusz verzióhoz kötött lefedettséggel** (a felhasználó kérése, 2026-11-14): gyakorló és oktató anyagok, amelyek a JavaScript és a TypeScript nyelvi elemeit kiadásonként fedik; az NY-40 tananyagát magába foglalja és a JavaScriptre is kiterjeszti. **Az anyag a gyakorló feladatok közé kerül,** a mostani 16 feladatra és egymásra épül, és a bal oldali feladatlista **fa-szerkezetében** (témakör → modul → lecke) kap helyet a mostani feladatok mellett | generátor, mérés, felület | a próba mérve (2026-11-14), a végleges elemtábla a G1 része | [terv](terv-korpusz-es-verziok.md) | **a közös terv jóváhagyva** (2026-11-14): mért hiánylista (a 88 vizsgált elemből 18 fordul elő, a korpusz lényegében ES2015-ig tart), 20 JS- és 20 TS-lecke, a fa a tananyagjegyzékből; lépések: G1 jelölés → G2 a jelölés felülete → G3 a fa → G5–G7 az anyag fázisonként, teljes körrel |
| NY-45 | **Legújabb RxJS és legújabb TypeScript, verzióválasztóval** (a felhasználó kérése, 2026-11-14): példafeladatok, a verzió kiválasztható. **A felhasználó pontosítása (2026-11-14):** a verziószám a feladat által bemutatott technológia verziószáma (például JavaScript, TypeScript, Angular, RxJS); minden feladat megnevezi a technológiáit a verziójukkal, hogy feladatkészítéskor megadható, a gyakorló feladatok között pedig verzió szerint kereshető legyen. **Visszamenőleg is (2026-11-14):** minden valaha elkészült feladat megkapja a jelölést, és a felület kiírja, mely technológiákból (nyelv, library, framework) és mely verziókból áll; az anyag a gyakorló feladatok közé kerül, az NY-44 anyagára épül, és ugyanabban a fában kap helyet | generátor, felület | próba (2026-11-14): egy 12 soros RxJS-program modellje majdnem lineáris (egy szabad pár), a hivatkozásai ellenőrizetlenek (`unverifiable`) | [terv](terv-korpusz-es-verziok.md) | **a közös terv jóváhagyva** (2026-11-14), mind a hét ajánlással: a TypeScript 7.0 natív program, nem tölthető be, ezért a legújabb használható fordító a 6.0.3; az ellenőrzés könyvtára ES2025 és Node 24 a CI-ben; `rxjs` 7.8.2 fejlesztési függőségként; lépések: G1 jelölés → G4 eszközlánc → G8 RxJS |
| NY-50 | **Az orákulum három korlátja:** (a) a tanú a `Symbol.x` olvasását reflexiónak jelöli (a saját `Reflect.get` hívása miatt), ezért hamis hibás elfogadást mér saját iterátoros osztályon; (b) a szabványos dekorátor alkalmazási sorrendjét szövegesen hasonlítja; (c) a `vm` környezetben Node 22-n nincs `Symbol.dispose` | mérés | 2 hamis jelzés és 1 nem mérhető program a 25-ös söprésben | [terv](terv-korpusz-es-verziok.md) 1.6 | (a) és (b) a G5 előtt, teljes körrel és változatlan alapszinttel; a (b)-hez tartozik, hogy a névtér nem exportált tagjának cseréjét is eltérőnek méri egy exportált függvény mellett ([ADR-150](adr/150-namespace-exported-function-keeps-its-place.md)); (c) a G4 Node-váltásával |
| NY-51 | **RxJS teljes lefedettsége:** a 173 exportból a tervezett 8 lecke 17-et használ; hátra van a lusta létrehozás modellje, az időalapú operátorok (virtuális idő), a forró és hideg folyam, az ütemezők, a teljes operátortábla és egy RxJS-kampányfajta | generátor, mérés | a próbában egy 12 soros program egyetlen szabad párt kap | [terv](terv-korpusz-es-verziok.md) 10. | a G8 mérése után három lépésben |
| NY-52 | **Általános library-ismeret:** típuscsomag és hívásleírás library-nként egységesen, méretkerettel a Local Demóban | tervezés | nincs | [terv](terv-korpusz-es-verziok.md) 10. | a második library (Angular) előtt |
| NY-53 | **Verziók karbantartása:** több library-verzió; a natív TypeScript-fordító, amint betölthető; évente az új ECMAScript-kiadás | környezet, tervezés | nincs | [terv](terv-korpusz-es-verziok.md) 10. | eseményhez kötve; évente júliusban felülvizsgálat |
| NY-54 | **A technológiajelölés mérési korlátai:** a típusellenőrző viselkedésében megjelenő újdonságot nem látja; típus nélküli JavaScript-fogadón a metódus neve dönt (alsó becslés); könyvtár nélkül csak a szintaxist méri; a dekorátor a régi mód szerint számít; régi futtatókörnyezetben nem fut próba | mérés | a 16 szállított feladaton nem érint egyet sem | [ADR-149](adr/149-technology-labels.md) | a G6 mérései után, ha a kézi jelölések száma indokolja |
| NY-55 | **Kimaradó nyelvi elemek:** több fájl és modulok, felső szintű `await`, dinamikus `import`, időzítők, `WeakRef` | döntés, generátor | nincs | [terv](terv-korpusz-es-verziok.md) 10. | a G9 után külön terv |
| NY-56 | **Angular-ág:** felmérés és terv (sablon, függőséginjektálás, dekorátorok, jelek) | döntés | nincs | [terv](terv-korpusz-es-verziok.md) 10. | a G4 és az NY-52 után |
| NY-57 | **Tananyag a tanulónak, a szerző saját fája, haladás több eszközön** | felület, döntés | nincs | [terv](terv-korpusz-es-verziok.md) 10. | a G3 után, bemutatóval |
| NY-58 | **A munkafelület refaktorálása** ([terv](terv-munkafelulet-refaktor.md)): headless alkalmazásmag (store, típusos Intent-szótár, selectorok, gesztusgép), régiós és kulcsolt kirajzolás, mérőkapuval védett időkeretek, dokumentált nézetszerződés; viselkedésmegőrző, hét fázisban (F0–F6) | tervezés, felület | mért kiindulás (486 soros feladat): billentyűs lerakás 280–288 ms, húzás eseményenként 118–120 ms, ellenőrzés 222–254 ms a fő szálon; indulás lassított hálózaton 3,7 s | [terv](terv-munkafelulet-refaktor.md) | **beütemezve** (a terv 10. szakasza): F0 az NY-49 után; F1 a G3 után; F2–F5 a G3 és a G4 után (másik ügynökkel a G5–G8 alatt, különben a G8 után); az NY-57 elé be kell fejezni |
| NY-59 | **A szerver kitelepítése nyilvános címre:** tárhely, `npm run deploy`, a statikus fájlok gyorsítótárazása és tömörítése (ma `no-store`, tömörítés nélkül), egy példány (a piszkozatok és a kéréskorlát memóriában élnek) | döntés, környezet | indulás 1,1 mp, memória kb. 225 MB, kiértékelés 1,2 ms (medián) | [ADR-151](adr/151-public-server-practice-only.md) | a felhasználó tárhelyválasztása után |
| NY-60 | **A motor nyilvános marad, amíg a Pages-kiadás és a nyilvános forrásrepó él:** a Pages leállítása vagy átirányítása és a repó priváttá tétele | döntés | az `_site` kb. 2 MB olvasható motorkódot szállít | [ADR-151](adr/151-public-server-practice-only.md) | az NY-59 után, a felhasználó távoli művelete |
| NY-42 | **A kapu alsó határa a leghosszabb sor:** a `browser-workbench` (374 mp) és a három hosszú egységtesztfájl (168, 128 és 104 mp) nem osztható szét | tervezés | felületi változás kb. 7 perc, teljes kör kb. 12 perc; felosztással kb. 5, illetve 9 perc lenne elérhető | [ADR-142](adr/142-fast-deploy-and-local-gate.md) | **az NY-58 F0 lépésével együtt:** a T0.2 új böngészős mérősort ad a teljes körhöz, az nem lehet a kapu új alsó határa; addig csak ha a 7, illetve 12 perc zavar; a munkafelület-sor esetei közös oldalon, egymás után futnak, ezért a felosztás tervezést kér |
| NY-03 | **Hatásösszegzés** a felső szintű függvényekre (`var v = f()`) | generátor | **0 mért rés** (a korábban ide sorolt 31 rés más okú volt, [ADR-069](adr/069-deep-hostile-input-and-own-class-names.md)) | [ADR-040](adr/040-unknown-calls-and-unescaped-objects.md) | csak ha egy mérés esetet mutat |
| NY-05 | **2d maradéka:** saját objektumot kapó ismeretlen függvény (a referencia megtartása) | generátor | **0 mért rés** (2026-11-04: a korpusz `Object.entries(totals)` tanúja már nem rés, a kampányban sincs ilyen) | [ADR-040](adr/040-unknown-calls-and-unescaped-objects.md), [ADR-059](adr/059-read-only-builtins.md) | csak ha egy mérés esetet mutat |
| NY-08 | **Érték-perturbáció korlátja:** egy literál egyszerre, legfeljebb 96 változat | mérés | a rés felső becslés marad | [ADR-067](adr/067-value-perturbation-in-measurement.md) | csak ha egy rés gyanúsan szándékhű |
| NY-28 | **Régi, TypeScript-forrás nélküli felületi modul:** `pages-api` (`public/app`, a Local Demo motorja); az `attempt` és a `persistence` migrálva ([ADR-097](adr/097-attempt-and-persistence-migration.md)), a `drag-insert` is ([ADR-095](adr/095-tap-to-place-and-drag-insert-migration.md)), az `api`, a `clipboard` és az `author-session` is ([ADR-134](adr/134-api-clipboard-session-migration.md)) | tervezés | 1 modul; a lista rögzített (`workbench-sources.test.mjs`) | [ADR-001](adr/001-typescript-workbench-and-boundaries.md), [ADR-097](adr/097-attempt-and-persistence-migration.md), [ADR-134](adr/134-api-clipboard-session-migration.md) | a `pages-api`, ha módosítani kell |
| NY-13 | **`primitive`/`pure`/`readOnly`:** három egymásra épülő osztályozó | tervezés | nincs | [ADR-050](adr/050-input-contract.md) | nem sürgős |
| NY-33 | **A v3 egységmodell bekötése a szerzői láncba** (overload-csoport, `});` jellegű lezáró sorok egységként) | tervezés | mért haszon nincs (az NY-04 lezárásakor) | [ADR-079](adr/079-overload-header-blocks.md) | külön epic, saját tervezési körrel |

### Sorrend (2026-11-14, a két terv és az adósságok beütemezése után)

Felülvizsgálva 2026-11-14-én: minden nyitott tétel aktuális. Azóta elkészült a G1 ([ADR-149](adr/149-technology-labels.md)); tíz új tétel került fel (NY-49–NY-58).

1. **Egységes sorrend (2026-11-14, a két terv és az adósságok együtt):**
   1. ~~NY-49~~ kész ([ADR-150](adr/150-namespace-exported-function-keeps-its-place.md), v58); a G1 kész ([ADR-149](adr/149-technology-labels.md)).
   2. **NY-58 F0** (mérőkapu, szabályok, markup-szerződés; vele az NY-42).
   3. **G2** (a jelölés felülete) → **G3** (a lista fája; a betöltés módjáról is itt dől el a döntés).
   4. **NY-58 F1** (gyors nyereség; a T1.2 a G6 előtt).
   5. **G4** (eszközlánc) → **NY-50** (az orákulum három korlátja).
   6. **G5 → G6 → G7 → G8** (az anyag és az RxJS). **Az NY-58 F2–F5 ezek alatt párhuzamosan fut, ha másik ügynök viszi;** egy ügynökkel a G8 után.
   7. **NY-58 F6** → **NY-51** (RxJS teljes lefedettsége) → **G9** (lezárás).
   8. **NY-57** (tananyag a tanulónak; már az új szerkezetre) → **NY-52, NY-56** (általános library-ismeret, Angular-ág) → **NY-55** (kimaradó nyelvi elemek).
   - Eseményhez kötött: **NY-53** (verziók), **NY-54** (a jelölés korlátai, a G6 után).
   - Az indoklás: a [közös terv](terv-korpusz-es-verziok.md) 10. szakasza és a [refaktorterv](terv-munkafelulet-refaktor.md) 10. szakasza.
2. **NY-40 TypeScript-tananyag:** a közös terv TypeScript-ága (G5–G7); a C0 kérdései megmérve (a közös terv 1.2 és 1.6 szakasza).
3. **Valódi tanári kód mérése:** a helyesség és a teljesség legfontosabb forrása; a felhasználótól kell hozzá anyag. A tananyag és a söprés nem pótolja. Bármikor beilleszthető, amint az anyag megvan.
4. **NY-28** (`pages-api`), ha módosítani kell; a T1.2 és a G8 bekötés jellegű módosítása nem migráció.
5. **Parkoló, csak mért eset esetén:** NY-33, NY-03, NY-05, NY-08, NY-13.

## Elfogadott korlátok (nem rések, nem javítandók)

| Tétel | Miért | Forrás |
| --- | --- | --- |
| Egy accessor olvasása mezőinicializálóban (`f = this.p`, ahol `p` getter) kötött | a getter megfigyelheti a korábbi mezőt; a saját adatmezőt másoló mező szabad ([ADR-073](adr/073-base-chain-fields-and-defaults.md)) | [ADR-068](adr/068-binding-context-member-phases-early-exit.md) |
| A halott kód és a korai kilépés sorrendje kötött | pedagógiai döntés (A-politika) | [ADR-043](adr/043-dead-code-intent-policy.md), [ADR-019](adr/019-pure-effect-commutation.md) |
| `classFields: 'define'` mellett az ős elfedett `accessor` mezője és getter–setter párja (`random-inherit-typescript-7`, 4 rés) | a leszármazott saját mezője minden példányon elfedi a prototípust, és az ősosztályt a program nem példányosítja; a feloldáshoz programszintű elérhetőségi elemzés kellene egy ritka mintáért | [ADR-083](adr/083-accessor-field-in-key-chain.md) |
| Az `inherit` JS 28 elutasított sorrendje, amely csak a régi (`[[Set]]`) mezőmódban fut máshogy | az alapbeállítás („bármelyik mezőmód”) mindkét módban helyes; `classFields: 'define'` mellett 0 rés | [ADR-075](adr/075-standard-class-fields-setting.md), [ADR-084](adr/084-loop-first-iteration.md) |
| Az orákulum modulokat és a `[[Set]]` mezőmódot csak a TypeScript AST-ből olvassa, a kibocsátott kódból nem (volt NY-07) | ma egy modulfixture van; a `[[Set]]` kimenet a natív mezős olvasathoz csak a fordító átalakítását adná, azt a P3 futtatja; egy második modulfixture-nél a teszt jelez | [ADR-063](adr/063-oracle-typescript-emit-reading.md) |
| „Számít” mellett a prototípus-kulcsok (metódusok) sorrendje csak akkor kötött, ha a program maga reflektál rájuk | a hívó `Object.getOwnPropertyNames(C.prototype)` hívással is láthatná, de a „Számít” a felsorolható (saját) kulcsokról szól; a metódussorrend megkötése szinte minden osztályfeladatot merevvé tenne | [ADR-130](adr/130-key-order-reaches-callers.md) |
| Univerzális szemantikai ekvivalencia | eldönthetetlen | [formális szerződés](formal-ordering-contract.md) |

## Lezárva

| Tétel | Lezárta |
| --- | --- |
| NY-37: gombrendszer és vizuális irány, kilenc lépésben (D1–D6): letört lap a feliratos gombokon, kerek ikon- és sorgombok, sík arc, a lapot követő fókuszkeret, lágy felületek, legalább 12 px-es szöveg, telefonos menük, egy keretbe fogott munkaterület; az eltérések az eredeti döntéstől rögzítve | [ADR-140](adr/140-button-system.md), [ADR-143](adr/143-plates-and-soft-surfaces.md), [ADR-145](adr/145-narrow-screen-menus.md), [ADR-146](adr/146-workspace-frame-and-rule-panel-split.md) |
| NY-49: a TypeScript `namespace` exportált függvénye a helyén marad; eddig a modell elfogadta a cseréjét az exportált változókkal, pedig a névtér kulcssorrendje megváltozott (hibás elfogadás, a 25 programos söprés találta) | [ADR-150](adr/150-namespace-exported-function-keeps-its-place.md) |
| NY-41: a mag és a szerzői elemzés üzenetei „a” vagy „az” névelőt írnak „a(z)” helyett, a következő szó hangzása szerint (szám, sor, kódrészlet); a „kell állnia” részes esettel áll; nyolc beégetett névelő is javult | [ADR-148](adr/148-article-as-it-is-read.md) |
| NY-46: a gyakorló feladatokban a megsértett sorpár megjelenik, és az első ellenőrzés után megnyitható a csak olvasható „Sor szabályai” panel; a szerző állítja feladatonként (alapból ki), a 16 szállított feladat megkapta; a szabálylap csak az értékelés válaszával utazik | [ADR-147](adr/147-learner-rule-panel-after-a-check.md) |
| NY-47: a „Sor szabályai” panel a Próba lépésben két oszlopba törik, ha 560 px-nél szélesebb (a panel saját szélessége dönt) | [ADR-146](adr/146-workspace-frame-and-rule-panel-split.md) |
| NY-48: a nyelvjelvény a nyelv saját színét viseli minden felületen és mindkét témában (JavaScript sárga, TypeScript kék); a kijelölést a sor jelzi | [ADR-143](adr/143-plates-and-soft-surfaces.md) |
| NY-43: a gyakorlás feladatlistájának oldalsávja az oldal aljára görgetve is leér a képernyő aljáig (eddig 64 px-rel fölötte véget ért, mert a magassága a kigördült fejléccel számolt) | [ADR-146](adr/146-workspace-frame-and-rule-panel-split.md) |
| NY-38: egymás melletti listák a ragadós értékelősáv fölött érnek véget (mért hely: a listák teteje és a sáv magassága); a Pages első látogatásán (Local Demo értesítés) és ellenőrzés után is; fekvő telefonon a címsorhoz görgetve; 180 px alatt a lista 180 px és az oldal görget | [ADR-144](adr/144-lists-end-above-the-result-bar.md) |
| NY-39: a ⓘ súgóbuborék a tartalom fölött lebeg, semmit nem tol el, és az első képkockától a helyén van (nem villan fel a bal felső sarokban); a képen belül, a ragadós sávok fölött áll; 8 sornál hosszabb példa a súgóoldalon; „Kipróbálom a Kód lépésben”; helyes névelő; a fókuszkeret nem ér a címkéhez; érintésnél 44 px-es cél; egy kapu minden ⓘ-helyre | [ADR-141](adr/141-floating-help-bubble.md) |
| NY-30: a keretes dobozok három felületre egyszerűsödtek (panel, beágyazott, lebegő; a lépéskeret az oldal hátterén), egy szabállyal felületenként | [ADR-138](adr/138-three-surfaces.md) |
| NY-31: a súgó példái kimenetelenként kipróbálhatók a munkafelületen, pontosan a súgó tesztjének beállításaival (a buborékból gomb, az oldalról hivatkozás); a kód a buborékban és az oldalon is kiemelt | [ADR-135](adr/135-help-trial-and-highlighted-examples.md) |
| NY-36: „Számít” mellett a hívó felsorolását is védi a kulcssorrend: visszaadott objektum, kívülről elérhető osztály példányai és statikus kulcsai; ami bizonyítottan bent marad, szabad (`object-reach.ts`). A `class-accounts-ts` (rev 4) „Nem számít” beállítást kapott | [ADR-130](adr/130-key-order-reaches-callers.md) |
| NY-35: az objektumliterál sora saját kötést is olvashat (`start: origin`, `{ name }`), ha az olvasás bizonyítottan nem futtat kódot és nem dob; egy nem bizonyítottan inicializált lexikális kötés literálonként egyszer (a korpusz rése „Nem számít” mellett bezárult) | [ADR-129](adr/129-object-literal-variable-reads.md) |
| NY-34: a bemeneti szerződés horogvizsgálata csak a futó kódot nézi; a típusban, megjegyzésben álló `Function`, `Symbol.`, `Proxy` nem tesz szigorúvá (a TS minta megkapja az „érvényes adat” szerződést; a sorrendjein ez nem változtat, lásd a mérést) | [ADR-128](adr/128-object-literal-rows-and-runtime-hooks.md) |
| NY-29: a bemeneti szerződés kérve és hatályosan, az okkal és a sorral (`inputsOverride`) | [ADR-126](adr/126-inputs-contract-as-applied.md) |
| NY-32: modellkészítés háttérszálon a Local Demóban; a leghosszabb fő szálas feladat 2,4–2,6 s helyett kb. 140 ms (a `jsonPending` gyorsítótárával együtt) | [ADR-125](adr/125-local-demo-engine-in-a-worker.md) |
| NY-27: a hosszú sor teljes szövege telefonon: a kijelölt sor sávja a sort egészében, tördelve mutatja | [ADR-118](adr/118-picked-row-action-bar.md) (kiegészítés, 2026-11-10) |
| A `param` rés a `valid` szerződés alatt: a saját tömbre írás (`out.push(c0)`) és az olvasási egységek sorrendje (v52); a 7-es mag 19 → 0 rés | [ADR-102](adr/102-valid-reads-commute-with-own-objects.md) |
| NY-06: tiszta műveletek és beépített hívások a `valid` szerződés alatt (v51); a `stats-js` tanú rése 6 → 0, a két statisztikapélda felvéve | [ADR-099](adr/099-valid-plain-operations.md) |
| NY-11: az AI-governance teljes (tulajdonos, kikényszerítés és bizonyíték minden elemhez); a jegyzék sora elavult volt. 2026-11-04: a kockázati osztályok kiegészítve az akadálymentességi átvizsgálással és a régi modulok őrtesztjével | [ADR-049](adr/049-ai-governance-completion.md), [ADR-096](adr/096-automated-accessibility-scan.md), [ADR-097](adr/097-attempt-and-persistence-migration.md) |
| NY-09 és NY-10: minden példa igazolt (`class-accounts-ts` igazolt szabállyal, `algo-sort-search-js` újragenerálva, `profiles-js` forráscserével), az alapértelmezés `verified-only` | [ADR-089](adr/089-verified-examples-and-default.md) |
| NY-16: a böngészőtesztek a telepített legújabb Chromiummal indulnak, ha a Playwright saját revíziója hiányzik (a 1.64.1-es csomag 1248-at vár, a konténerben 1243 van) | [browser_support.py](../tests/browser_support.py), [README](../README.md) |
| NY-14: a futással nem megfigyelhető okkódot a regiszter jelöli (`unobservable`), az osztályozó onnan olvas | [ADR-088](adr/088-unobservable-reason-codes.md) |
| NY-01: a ciklus első köre külön (`flow`: 1 → 0 rés nyelvenként) | [ADR-084](adr/084-loop-first-iteration.md) |
| NY-22: az `inherit` fajta maradéka; az `accessor` mező az azonos kulcsú láncban (TS 2 → 0 rés); a `define` mód árnyékolt ősét az elfogadott korlátok sorolják | [ADR-083](adr/083-accessor-field-in-key-chain.md) |
| NY-26: az egyedi nevű interfész-metódusszignatúra törlődik (`refl-ts-erased-and-overloads`, 1 rés, 1 projekciós veszteség) | [ADR-087](adr/087-erased-method-signatures.md) |
| NY-25: a reguláris kifejezés literálja tiszta kezdőérték (`cov-optional-delete-regex`, 4 rés) | [ADR-086](adr/086-regular-expression-literal.md) |
| NY-17: a szkriptszintű `var` koerciós olvasása; a szerződés a külső kódot rosszindulatú környezettel méri, a pontatlan rész javítva | [ADR-081](adr/081-hostile-environment.md), [ADR-082](adr/082-script-bindings-since-declaration.md) |
| NY-15: az ellenőrzési kapu a szerkezetet veti össze, nem a blokkszámot | [ADR-079](adr/079-overload-header-blocks.md) |
| NY-12: az objektumheap saját modul (`ObjectHeap`), az értelmező a műveletein át hívja | [ADR-085](adr/085-object-heap-module.md) |
| NY-19: eldobott objektumba írás sorrendje (a mérés `heap` szándékként sorolja) | [ADR-080](adr/080-observed-heap-intent.md) |
| NY-24: szkriptkötés a deklarációja óta; a `script` JS rései (a szigorú szerződés rosszindulatú környezettel mérve) | [ADR-082](adr/082-script-bindings-since-declaration.md), [ADR-081](adr/081-hostile-environment.md) |
| NY-04: TS overload-csoport (a v3 egységmodell mért haszna); a v3 bekötése a szerzői láncba mért haszon nélkül tervezési lehetőség marad | [ADR-079](adr/079-overload-header-blocks.md) |
| NY-23: JavaScript-mezőmód (döntés: szerzői beállítás „csak szabványos”) | [ADR-075](adr/075-standard-class-fields-setting.md) |
| NY-21: a kampány nem generált ősosztálybeli accessort | [ADR-074](adr/074-inherit-campaign-kind.md) |
| NY-18: alapértékes paraméterű konstruktor az objektummodellben | [ADR-073](adr/073-base-chain-fields-and-defaults.md) |
| NY-20: a korábbi saját adatmezőt másoló mező (`f7 = this.f5`); közben a laza mezők `[[Set]]` módbeli hibás elfogadása ősosztálybeli setterrel | [ADR-073](adr/073-base-chain-fields-and-defaults.md) |
| NY-01 nagy része: a biztosan felülírt mező korábbi értékei, a getter ismert értéke, a `switch` ismert értékkel, a halott `catch` okozta kötés a mérésben | [ADR-072](adr/072-certain-overwrites.md) |
| NY-02: a nem dobó `object` programok mezőérték-túlbecslése (a később beírt érték a korábbi olvasásban) | [ADR-071](adr/071-statement-positioned-heap-cells.md) |
| Többsoros kifejezések lezárása, ha blokk ábrázolhatja | [ADR-066](adr/066-unit-blocks.md) |
| A halott ág és a véletlenül egyező érték a mérésben | [ADR-067](adr/067-value-perturbation-in-measurement.md) |
| Függvénynév kötési kontextusa, duplikált definíciók, laza static mezők | [ADR-068](adr/068-binding-context-member-phases-early-exit.md) |
| A `while` terminálása | [ADR-064](adr/064-monotone-while-loops.md) |
| A legfeljebb egyszer futó `for … of` túlbecslése | [ADR-070](adr/070-loop-body-at-most-once.md) |
| A `param` programok rései (gyenge próbák) | [ADR-069](adr/069-deep-hostile-input-and-own-class-names.md) |
| Számnevű és duplikált metódusú osztály `new`-ja | [ADR-069](adr/069-deep-hostile-input-and-own-class-names.md) |
| A megerősítési szint a magból, a modulbontások | [ADR-065](adr/065-design-debt-removal-and-module-split.md) |
| Szöveges kulcsmegfigyelés (`task-ledger-js`) | [ADR-060](adr/060-key-observation-text.md) |
| A generátor MJS-része típusos modulba | [ADR-013](adr/013-local-writes-clause-chains-and-imports.md) (ADR-011 utóirata) |
| A `task-corpus` nyitott tételei (kulcsfelsorolás, többsoros literál) | [ADR-060](adr/060-key-observation-text.md), [ADR-066](adr/066-unit-blocks.md) (ADR-051) |
