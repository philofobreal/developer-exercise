# Nyitott tételek jegyzéke

Állapot: 2026-11-03, szabályverzió `scoped-effect-analysis-v38`. Ez az egyetlen hely, ahol a lezáratlan tételek össze vannak gyűjtve: a még meg nem oldott generátorhiányok, mérési korlátok, döntések és tervezési adósságok. A részletek a forrásként megadott ADR-ben vannak.

**Szabályok:**
- Minden ADR, amelynek „Nyitott” szakasza van, ide kerül. Ezt a [governance-teszt](../tests/governance.test.mjs) ellenőrzi.
- Egy tétel lezárásakor a sor „Lezárva” részbe kerül a lezáró ADR-rel. Nem törlődik.
- A mért hatás a legutóbbi teljes kampányból (12 mag, 6 fajta, 2 nyelv) és a korpuszból való. A szám a rés, vagyis a fölöslegesen elutasított, futásidőben egyenértékű sorrend.

**Típusok:**
- **generátor:** a szabályok fölöslegesen szigorúak;
- **mérés:** az osztályozó vagy az orákulum korlátja;
- **döntés:** a felhasználó (pedagógiai vagy publikálási) döntése kell hozzá;
- **tervezés:** Ousterhout-féle adósság, viselkedésváltozás nélkül;
- **környezet:** nem a repó hibája.

## Nyitott

| ID | Tétel | Típus | Mért hatás (legutóbbi kampány) | Forrás | Következő lépés |
| --- | --- | --- | --- | --- | --- |
| NY-01 | **A `flow` maradéka: az első kört kihagyó ciklus.** `for (const entry of boxes) { if (seen > 0) { … } seen = seen + 1; }` az első elemen nem fut, a modell mégis minden elemre érvényesnek veszi. Az egyszer futó ciklus ([ADR-070](adr/070-loop-body-at-most-once.md)), a pozíciós cellák ([ADR-071](adr/071-statement-positioned-heap-cells.md)) és a biztos felülírás ([ADR-072](adr/072-certain-overwrites.md)) után ez maradt | generátor | `flow`: 1 rés nyelvenként (v38) | [ADR-046](adr/046-loops-over-own-objects.md), [ADR-070](adr/070-loop-body-at-most-once.md), [ADR-072](adr/072-certain-overwrites.md) | ciklusgörgetés kellene (az ADR-070 elvetette); csak ha több tanú lesz |
| NY-03 | **Hatásösszegzés** a felső szintű függvényekre (`var v = f()`) | generátor | **0 mért rés** (a korábban ide sorolt 31 rés más okú volt, [ADR-069](adr/069-deep-hostile-input-and-own-class-names.md)) | [ADR-040](adr/040-unknown-calls-and-unescaped-objects.md) | csak ha egy mérés esetet mutat |
| NY-04 | **v3 egységmodell:** a TS overload-csoport és a blokkot is záró sor (`});`) | generátor | `class` TS: 19 rés (`sealed-unit` 14, `continued-row` 5), korpusz 3 fixture | [ADR-066](adr/066-unit-blocks.md) | külön epic (15. feladat) |
| NY-05 | **2d maradéka:** saját objektumot kapó ismeretlen függvény (a referencia megtartása) | generátor | nem mért; korpusz: `Object.entries(totals)` 3 rés | [ADR-040](adr/040-unknown-calls-and-unescaped-objects.md), [ADR-059](adr/059-read-only-builtins.md) | mérés előbb, utána döntés |
| NY-06 | **Tiszta beépített globálisok** (`Math.max`) külön kódcsaládja | generátor | nem mért | [ADR-040](adr/040-unknown-calls-and-unescaped-objects.md) | mérés |
| NY-07 | **Orákulum:** a modulok és a `[[Set]]` osztálymező-mód második (kibocsátott) olvasata | mérés | az A1 feltevés szűkítése, nem résszám | [ADR-063](adr/063-oracle-typescript-emit-reading.md) | |
| NY-08 | **Érték-perturbáció korlátja:** egy literál egyszerre, legfeljebb 96 változat | mérés | a rés felső becslés marad | [ADR-067](adr/067-value-perturbation-in-measurement.md) | csak ha egy rés gyanúsan szándékhű |
| NY-09 | **Alapértelmezés `verified-only`** (1. fázis 4. lépés) | döntés | 3 példa „Nem igazolt” | [ADR-057](adr/057-example-migration-and-publication-default.md) | a felhasználó döntése: példafrissítés, kivétel a kiszolgálásból vagy marad |
| NY-10 | **`class-accounts-ts` migrációja:** a frissítés a tanár 480 sorrendjéből 360-at elutasítana | döntés | 360 sorrend | [ADR-057](adr/057-example-migration-and-publication-default.md) | a felhasználó döntése |
| NY-11 | **G fázis:** az AI-governance teljessé tétele | tervezés | „részleges” jelölés | [megbízhatósági terv, G fázis](megbizhatosagi-audit-terv.md#g-fázis--az-ai-governance-teljessé-tétele-tervezés-átfogó) | leltár és terv |
| NY-12 | **`object-footprints.ts`:** a heap és az értelmező egyetlen closure | tervezés | nincs | [ADR-065](adr/065-design-debt-removal-and-module-split.md) | nem sürgős |
| NY-13 | **`primitive`/`pure`/`readOnly`:** három egymásra épülő osztályozó | tervezés | nincs | [ADR-050](adr/050-input-contract.md) | nem sürgős |
| NY-14 | **`POLICY_INTENT`:** kézi lista az osztályozóban | tervezés | nincs | [ADR-068](adr/068-binding-context-member-phases-early-exit.md) | a jegyzékbe, ha lesz második ilyen okkód |
| NY-15 | **Az ellenőrzési kapu** a blokkszámból következtet az azonos szerkezetre | tervezés | nincs | [ADR-066](adr/066-unit-blocks.md) | saját összevetés, ha a frissítés más finomítást kap |
| NY-17 | **Szkriptszintű `var` olvasása** koerciós műveletben (`let l3 = v1 + 1`): más szkript írhatja | döntés | `script` JS 5 rés | [ADR-009](adr/009-sealed-units-and-throw-free-reads.md) | szerződésdöntés: egyetlen szkriptnek tekinthető-e a feladat |
| NY-18 | **`new Item10()`:** overloados, paramétertulajdonságos TS-osztály kimarad az objektummodellből | generátor | `class` TS 1 rés | [ADR-069](adr/069-deep-hostile-input-and-own-class-names.md) | okelemzés, ha több eset lesz |
| NY-19 | **Eldobott objektumba írás sorrendje:** két írás egy tömbbe, amelyre később már semmi nem hivatkozik (`a.note('n2')` ↔ `a.note('n3')`, majd `a.attach(shared)`). Az A-politika mintájára a generátor kötve tartja; a mérés még résnek számolja | mérés | `object` 11 + 11 rés | [ADR-071](adr/071-statement-positioned-heap-cells.md) | a mérésben szándékként elkülöníteni (a próba a létrehozott objektumokat is megfigyeli), ha egy második tanú is ide esik |
| NY-20 | **`class-evaluation-order`:** a `class` TS kampány egy rése, még nem elemzett | generátor | `class` TS 1 rés | [ADR-068](adr/068-binding-context-member-phases-early-exit.md) | okelemzés a tanún |
| NY-16 | **A böngészőtesztek környezete:** a Python Playwright 1248-as Chromiumot vár, 1243-as van telepítve | környezet | friss konténerben nem indul | — | a környezet beállítása; addig `PLAYWRIGHT_BROWSERS_PATH` alias |

## Elfogadott korlátok (nem rések, nem javítandók)

| Tétel | Miért | Forrás |
| --- | --- | --- |
| `f7 = this.f5`: getterre is olvasható mezőinicializáló kötött | egy getter megfigyelheti a korábbi mezőt | [ADR-068](adr/068-binding-context-member-phases-early-exit.md) |
| A halott kód és a korai kilépés sorrendje kötött | pedagógiai döntés (A-politika) | [ADR-043](adr/043-dead-code-intent-policy.md), [ADR-019](adr/019-pure-effect-commutation.md) |
| Univerzális szemantikai ekvivalencia | eldönthetetlen | [formális szerződés](formal-ordering-contract.md) |

## Lezárva

| Tétel | Lezárta |
| --- | --- |
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
