# ADR-122 – A feladat állapota a tanárnak: három kérdés, egy következő lépés

Állapot: **elfogadva** (2026-11-10). A 100 soros küszöböt a felhasználó döntötte el (2026-11-09). Kockázati osztály: megjelenítés és interakció. A mobil- és felületterv M3 pontja.

## Kontextus

Mért kiindulás (Pages-build, Playwright, 2026-11-10): a 436 soros TypeScript mintát betöltöttük, és elkészítettük a modellt.

- **A Forrás lépés leletlistája:** 11 külön „Nem eldönthető” sor, angolul („Cannot find module…”, TS2307). Valójában egy okról van szó: a fájl importjai a projekten kívül vannak.
- **Két sorszámozás:** ugyanaz az import a Forrás lépésben „3. sor”, a Minősítésben „2. sor”. A Minősítés a modell sorait számozta, az üres sorok nélkül.
- **Négyféle szó a lépéssoron:** „Hibás forrás”, „Figyelmeztetés”, „Figyelmeztetéssel”, „Zárva” – és mellettük „Zárolt”, „Elavult”.
- **A lépéssor szava gépelés közben régi maradt:** a „Hibás forrás” csak a következő újrarajzoláskor tűnt el.
- **A Szabályok lépés minősítése belső kódokkal szólt:**
  - „Konzervatív · Publikálható · 9 kényszer konzervatív fallback (opaque-row, unclassified-member) · 325 egységpárt a v2-projekció rendez”;
  - semmi nem mondta, hogy 439 sor sok egy tanulói feladatnak;
  - azt sem, mi a teendő.

## Döntés

- **Egy tulajdonos: [task-status.ts](../../src/workbench/task-status.ts).** A kapuk és a minősítés rekordjaiból három kérdésre válaszol. Mindegyikre egy színnel és szóval (Igen / Részben / Nem), egy mondattal és legfeljebb egy gombbal:

  | Kérdés | Igen | Részben | Nem |
  | --- | --- | --- | --- |
  | **Kitölthető?** | a referencia elfogadott, legfeljebb 100 sor | a forrás vizsgálata nem dőlt el, vagy 100 sornál hosszabb, vagy a referencia elfogadása nem dőlt el | a modell nem fogadható be, vagy a saját referenciáját sem fogadja el |
  | **Ellenőrizhető?** | publikálható: minden tanulói sorrendre eldől a válasz | a keretben nem minden sorrendre dől el | a referencia nem fogadható el, vagy nyelvi hibás |
  | **Igazságos?** | elemzéssel igazolt | konzervatív (az óvatos szabályok fajtái szóval, „Megmutatom” gombbal), szerzői döntés vagy nem igazolt | – |

- **Egy következő lépés a legrosszabb válaszból:**
  - hiba vagy elutasító második kapu: „Vissza a forráshoz”, a kapu saját üzenetével;
  - figyelmeztetés: „A figyelmeztetések nem akadályozzák a próbát…” és „Tovább a próbához”;
  - minden rendben: „Próbáld ki tanulóként.”
- **A „Megmutatom” gomb** kinyitja a „Szabályok típus szerint” listát. Ott az óvatos szabályok fajtánként állnak, és egy lépésben feloldhatók (ADR-056).
- **A lépéssor egy szókészlete:** Kész, Figyelem, Hiba, Zárolt, Elavult.
  - A Forrás lépés az első kapu szava, csak arra a szövegre, amelyet a kapu vizsgált.
  - A Szabályok lépés az állapotkártya összesített hangja.
  - A Próba lépés a második kapu szava.
- **Egy helyen, élőben:**
  - a lépéssor kirajzolása és helybeni frissítése a [flow.ts](../../src/workbench/flow.ts) `renderStepper` és `refreshStepper` függvénye;
  - a szerkesztő minden bevitele után frissül, így gépeléskor a régi szöveghez tartozó „Hiba” azonnal eltűnik.
- **Leletek okonként:** a [preflight-settings.ts](../../src/workbench/preflight-settings.ts) `groupFindings` és `renderFindingGroups` függvénye.
  - Az azonos bizonyosságú, eredetű és kódú leletek egy sort adnak („Nem eldönthető · 11 sor · Hiányzó projektkontextus…”).
  - A sorok lenyitva érhetők el, mindegyik ugrik a forrásba. Egy lelet egy sor marad, a korábbi jelöléssel.
  - Ugyanez a lista áll a Forrás lépésben, a kártya „Részletek” pontjában és a Minősítés nyelvi auditjánál.
- **Egy sorszámozás:**
  - minden lelet a forrásszerkesztő sorszámát mutatja;
  - a Minősítés auditja a modell sorát a sor `sourceLine` mezőjén keresztül fordítja vissza;
  - más lépésből kattintva a Forrás lépés nyílik meg, és kijelöli a sort.
- **A kártya nem jelenik meg,** ha a forrás vagy a beállítás a modell óta változott. Ilyenkor az elavultsági sáv beszél, a lépés szava „Elavult”.

## Két terv („design it twice”)

1. **Egy modul dönti el a választ, a lépéssor és a kártya is tőle kérdez (választott).** Az ítélet egy helyen van, a kettő nem mondhat ellentmondót.
2. **A Minősítés panel, a lépéssor és a leletlista külön bővítése (elvetve).** Ugyanazt a „mi a legrosszabb” döntést három helyen kellene meghozni. Ez információszivárgás, és pont az a széttartás, amelyet a kiinduló mérés mutatott.

## Tervezési review (docs/design-review.md)

- **task-status.ts**
  - *Elrejti:* hogyan képeződnek le a kapurekordok és a minősítés a három kérdésre; a hosszú feladat küszöbét; melyik lelet vezet, és melyik gombot kapja.
  - *Interfésze:* `taskStatus(state)` és `renderTaskStatus(state)`.
  - *Hívói:* a nézet és a `flow.ts`.
  - Nem dönt újra semmit, amit a kapu vagy a minősítés eldöntött.
- **preflight-settings.ts:** a lelet megjelenítésének tulajdonosa volt eddig is (sorra ugrás); a csoportosítás ugyanez a tudás.
- **flow.ts:** a lépés állapotának tulajdonosa volt; a lépéssor kirajzolása a nézetből ide került, mert a helybeni frissítésnek ugyanazt kell tudnia.
- **Rögzített kis átfedés:** a Minősítés nyelvi auditja (`ReferenceAudit`) leleteit a rule-panel alakítja a kapu leletformájára (kód előtag, környezeti eredet). Ugyanezt teszi a szerzői oldalon a `source-gate.ts`. A megjelenítés a határszabály miatt csak típust importálhat a szerzői kódból, ezért ez a két soros leképezés kétszer szerepel. Ha a minősítés egyszer kapuleletet ad, ez megszűnik.

## Nem része ennek a döntésnek

- **„Érvényes adat → szigorú lett” a beállítássávban:** a kért és a hatályos bemeneti szerződés különbsége ma csak a generátor szöveges megjegyzésében él. Strukturált kijelzéséhez a modell bizonyítékába (`AnalysisEnvironment`) új mezőt kellene felvenni; ez sémaváltozás a szerzői elemzésben. Az M5-be kerül, amely az elemzési beállításokat amúgy is a Szabályok lépésbe viszi.
- **A „Rendben így” nyugtázás:** a figyelmeztetéseket nem kell külön elfogadni; a Próba megnyitható, a kártya ezt kimondja. Nyugtázási állapot nem került a modellbe.
- **Telefonon a lépéssor szava ma is rejtett** (650 px alatt a `small` nem látszik); ott a kártya beszél. A lépéssor elrendezése az UI4 + M5 része.

## Bizonyíték

- **Egységteszt:** [task-status.test.mjs](../../tests/task-status.test.mjs):
  - mindhárom kérdés minden ága;
  - a 100 és a 101 soros határ;
  - a következő lépés hiba, figyelmeztetés és rendben esetén;
  - a lépéssor szókészlete (minden szó előfordul, más nem);
  - a csoportosítás és a sorrend;
  - más szöveghez tartozó leletet nem használ;
  - a Minősítés forrássorszáma.
- **Átírt meglévő egységteszt:** [workbench-flow.test.mjs](../../tests/workbench-flow.test.mjs) a Próba szavára: „Figyelem”, „Zárolt”.
- **Böngészős teszt:** [browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py) `task_status`:
  - konzervatív modellnél „Igazságos? Részben”;
  - a „Megmutatom” kinyitja és fókuszálja a szabálytípusokat;
  - a következő lépés a Próbát nyitja;
  - igazolt modellnél három „Igen” és „Kész”.
- **Átírt böngészős tesztek:** `preflight_ui` és `source_check` az új szavakra. Itt bizonyított a gépelés közbeni törlés is: a `[data-step-status]` üres a kitöltés után, újrarajzolás előtt.
- **Mérés a TS mintán:** 11 lelet egy sorban; a Forrás és a Minősítés sorszámai azonosak (1, 3, 4, … 14); a Minősítés „3. sor” gombja a Forrás lépés 3. sorát jelöli ki.
