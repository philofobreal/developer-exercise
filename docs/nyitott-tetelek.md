# Nyitott tételek jegyzéke

Állapot: 2026-11-10, szabályverzió `scoped-effect-analysis-v54`. Ez az egyetlen hely, ahol a lezáratlan tételek össze vannak gyűjtve: a még meg nem oldott generátorhiányok, mérési korlátok, döntések és tervezési adósságok. A részletek a forrásként megadott ADR-ben vannak.

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
| NY-03 | **Hatásösszegzés** a felső szintű függvényekre (`var v = f()`) | generátor | **0 mért rés** (a korábban ide sorolt 31 rés más okú volt, [ADR-069](adr/069-deep-hostile-input-and-own-class-names.md)) | [ADR-040](adr/040-unknown-calls-and-unescaped-objects.md) | csak ha egy mérés esetet mutat |
| NY-05 | **2d maradéka:** saját objektumot kapó ismeretlen függvény (a referencia megtartása) | generátor | **0 mért rés** (2026-11-04: a korpusz `Object.entries(totals)` tanúja már nem rés, a kampányban sincs ilyen) | [ADR-040](adr/040-unknown-calls-and-unescaped-objects.md), [ADR-059](adr/059-read-only-builtins.md) | csak ha egy mérés esetet mutat |
| NY-08 | **Érték-perturbáció korlátja:** egy literál egyszerre, legfeljebb 96 változat | mérés | a rés felső becslés marad | [ADR-067](adr/067-value-perturbation-in-measurement.md) | csak ha egy rés gyanúsan szándékhű |
| NY-28 | **Régi, TypeScript-forrás nélküli felületi modulok:** `api`, `author-session`, `clipboard`, `pages-api` (`public/app`); az `attempt` és a `persistence` migrálva ([ADR-097](adr/097-attempt-and-persistence-migration.md)), a `drag-insert` is ([ADR-095](adr/095-tap-to-place-and-drag-insert-migration.md)) | tervezés | 4 modul; a lista rögzített (`workbench-sources.test.mjs`) | [ADR-001](adr/001-typescript-workbench-and-boundaries.md), [ADR-097](adr/097-attempt-and-persistence-migration.md) | a két HTTP-adapter és a vágólap, ha módosítani kell őket |
| NY-13 | **`primitive`/`pure`/`readOnly`:** három egymásra épülő osztályozó | tervezés | nincs | [ADR-050](adr/050-input-contract.md) | nem sürgős |
| NY-35 | **Objektumliterál: változó- és rövidített értékű tulajdonságsorok.** Csak a literálértékű (`name: "Alice"`) sorok szabadok; a `start: origin` és a `{ name, age }` alak sora kötött marad, holott egy saját, már inicializált kötés olvasása kódot nem futtat | generátor | korpusz: 1 rés (`ch-multiline-object`), amelyet a v54 orákulumbővítése tett láthatóvá | [ADR-128](adr/128-object-literal-rows-and-runtime-hooks.md) | a tiszta érték kiterjesztése a fájlban deklarált, nem `with`/`eval` alatti kötések olvasására; orákulumtanúk (TDZ, globális getter) |
| NY-30 | **Három felület a CSS-ben:** a panel, a beágyazott és a lebegő felület összevonása; az értesítés már egységes | tervezés | a keretes dobozok több, időben eltérően épült változata | [ADR-123](adr/123-steps-reassigned-and-one-skeleton.md) | osztálykészlet a panelekre, a régi változatok kivezetése az elrendezés-kapu mellett |
| NY-31 | **Súgó: „Kipróbálom” és kiemelt kód.** A példa nem nyitható meg a Kód lépésben; a buborék és az oldal kódja kiemelés nélküli | felület | alacsony | [ADR-124](adr/124-help-from-one-source.md) | a példa betöltése szerzői előnézetként, a Local Demo jelzéssel |
| NY-33 | **A v3 egységmodell bekötése a szerzői láncba** (overload-csoport, `});` jellegű lezáró sorok egységként) | tervezés | mért haszon nincs (az NY-04 lezárásakor) | [ADR-079](adr/079-overload-header-blocks.md) | külön epic, saját tervezési körrel |

## Elfogadott korlátok (nem rések, nem javítandók)

| Tétel | Miért | Forrás |
| --- | --- | --- |
| Egy accessor olvasása mezőinicializálóban (`f = this.p`, ahol `p` getter) kötött | a getter megfigyelheti a korábbi mezőt; a saját adatmezőt másoló mező szabad ([ADR-073](adr/073-base-chain-fields-and-defaults.md)) | [ADR-068](adr/068-binding-context-member-phases-early-exit.md) |
| A halott kód és a korai kilépés sorrendje kötött | pedagógiai döntés (A-politika) | [ADR-043](adr/043-dead-code-intent-policy.md), [ADR-019](adr/019-pure-effect-commutation.md) |
| `classFields: 'define'` mellett az ős elfedett `accessor` mezője és getter–setter párja (`random-inherit-typescript-7`, 4 rés) | a leszármazott saját mezője minden példányon elfedi a prototípust, és az ősosztályt a program nem példányosítja; a feloldáshoz programszintű elérhetőségi elemzés kellene egy ritka mintáért | [ADR-083](adr/083-accessor-field-in-key-chain.md) |
| Az `inherit` JS 28 elutasított sorrendje, amely csak a régi (`[[Set]]`) mezőmódban fut máshogy | az alapbeállítás („bármelyik mezőmód”) mindkét módban helyes; `classFields: 'define'` mellett 0 rés | [ADR-075](adr/075-standard-class-fields-setting.md), [ADR-084](adr/084-loop-first-iteration.md) |
| Az orákulum modulokat és a `[[Set]]` mezőmódot csak a TypeScript AST-ből olvassa, a kibocsátott kódból nem (volt NY-07) | ma egy modulfixture van; a `[[Set]]` kimenet a natív mezős olvasathoz csak a fordító átalakítását adná, azt a P3 futtatja; egy második modulfixture-nél a teszt jelez | [ADR-063](adr/063-oracle-typescript-emit-reading.md) |
| Univerzális szemantikai ekvivalencia | eldönthetetlen | [formális szerződés](formal-ordering-contract.md) |

## Lezárva

| Tétel | Lezárta |
| --- | --- |
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
