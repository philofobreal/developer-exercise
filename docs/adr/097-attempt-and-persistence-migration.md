# ADR-097 – Az `attempt` és a `persistence` modul TypeScriptre migrálva (NY-28)

Állapot: **elfogadva** (2026-11-04). A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-28 tétele, a felhasználó jóváhagyásával. Viselkedésmegőrző migráció ([ADR-001](001-typescript-workbench-and-boundaries.md) átmeneti határa). Validátor, generátor és modell nem változik.

## Kontextus

Az AGENTS.md két kötelező szerződése élt típus nélkül, kézzel írt JavaScriptben:
- **„Beszúrás, nem csere”, rögzített helyek:** `public/app/attempt.js` (`insertBetweenSlots`, a mozgatások és a szöveges szerkesztés visszaolvasása).
- **Verziózott mentés és importintegritás:** `public/app/persistence.js` (a munkamenet exportja és a beolvasott fájl ellenőrzése).

## Döntés

1. **[attempt.ts](../../src/workbench/attempt.ts)** és **[persistence.ts](../../src/workbench/persistence.ts)** szigorú TypeScriptben. A `public/app/attempt.js` és a `public/app/persistence.js` mostantól fordítói kimenet; a hívók (`ui.js`, `author-session.js` és a tesztek) változatlanok.
   - **Új típusok:**
     - `Attempt`: a nézet pillanatképe, kiegészítve a kódnézetben szerkesztett sorok szövegével;
     - `AttemptController`;
     - `SessionFile`: a munkamenetfájl 1-es verziója.
   - **A beolvasott fájl `unknown`,** és csak ugyanazokon az ellenőrzéseken át, ugyanazokkal a hibaüzenetekkel válik `Attempt`-té.
   - **A formázó port** ([formatter.d.ts](../../src/formatter.d.ts)) a `formatForIDE` deklarációjával bővült; maga a formázó régi modul marad.
2. **Őrteszt** ([workbench-sources.test.mjs](../../tests/workbench-sources.test.mjs)): a `public/app` minden modulja fordítói kimenet, kivéve egy név szerint rögzített listát (`api`, `author-session`, `clipboard`, `pages-api`).
   - Új, kézzel írt modul hibát okoz.
   - Egy migráció után a modul kikerül a listából.
   - A régi modulok száma 6 → 4.

## Bizonyíték

- **Egyszeri különbségi teszt** a régi és az új modulon, ugyanazokkal a bemenetekkel: 16 804 eset, 0 eltérés az eredményben, az állapotban, a formázott megoldásban és a hibaüzenetben. Lefedte:
  - 400 véletlen feladatot, feladatonként 30 véletlen műveletet (beszúrás, mozgatás, visszahelyezés, csere, kitöltés, szöveges szerkesztés);
  - a munkamenet exportját;
  - 12 féle hibás vagy hiányos munkamenet-fájlt;
  - az importált szöveg méretkorlátját.
- **A meglévő tesztek változatlanul:**
  - `insert-between` (9, köztük véletlen mozgatások invariánsai);
  - `persistence-registry`, `source-fidelity`, `live-ts-method-format`, `language-adapters`;
  - a teljes böngészőkészlet.

## Tervezési review (ADR-037)

- **Tulajdonos:** a beszúrási szabály egyetlen tiszta függvény (`insertBetweenSlots`). A munkamenetfájl alakja most típus (`SessionFile`), az ellenőrzése egy helyen van (`restoreAttempt`).
- **Interfész:** változatlan export-nevek és aláírások, a típusok csak kiegészítik őket.
- **Ami marad:** a két HTTP-adapter (`api`, `pages-api`), a `clipboard` és az `author-session`. A jegyzék ezeket tartja nyilván.
