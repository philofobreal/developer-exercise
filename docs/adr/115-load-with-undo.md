# ADR-115 – A példa kiválasztáskor betöltődik, és visszavonható

Állapot: **elfogadva** (2026-11-09). Kockázati osztály: megjelenítés. A mobil- és lépésterv M2 pontja; az [ADR-022](022-stepwise-author-flow.md) szerzői munkaterületét bővíti.

## Kontextus

- **Ma:** a Forrás lépés Megnyitás menüjében a példát egy listából kellett kiválasztani, majd a „Példa betöltése” gombra kattintani. A gyakori felületek a kiválasztással azonnal betöltenek; a külön gomb fölösleges lépés.
- **A kockázat:** az azonnali betöltés egy véletlen választással felülírja a szerző el nem alkalmazott forrását. A gomb eddig ezt a véletlent szűrte.

## Döntés

**A lista választása azonnal betölt, a gomb megszűnik.** A felülírt piszkozat nem vész el: a betöltés üzenete mellett megjelenik a **Visszavonás**, amely visszahozza.
- **A visszavonás addig él, amíg a betöltött piszkozat érintetlen.** Ha a szerző szerkeszti, az már az ő munkája, a gomb eltűnik.
- **Ugyanez érvényes minden betöltésre, amely a teljes piszkozatot cseréli:** a példára, a „Saját feladat ebből” műveletre, a TS tesztfájlra és a forrásfájlra.
- **Visszavonás után** egy korábban elküldött kérés késői válasza nem írja felül a visszaállított forrást (új kérésgeneráció).

## Két terv („design it twice”)

1. **Betöltés visszavonással (választott).**
   - A [author-workspace.ts](../../src/workbench/author-workspace.ts) birtokolja az állapotot (`authorReplaced`: a felülírt és a betöltött piszkozat).
   - A hívók egy műveletet kapnak: `replaceDraft`, `canUndoReplace`, `undoReplace`.
   - Nem kell tudni, mi számít „mentetlen” változásnak, és a felület sosem állítja meg a szerzőt.
2. **Rákérdezés betöltés előtt (elvetve, a mobilterv mockja még ezt mutatta).**
   - Nyilván kellene tartani, mi volt az utoljára betöltött forrás, hogy a felület eldönthesse, van-e mentetlen szerkesztés. Ez a betöltések minden hívójánál szinkronban tartandó párhuzamos állapot.
   - Minden választás egy plusz kattintással járna, akkor is, ha semmi nem veszne el.

**Mi marad rejtve:** a felülírt piszkozat tárolása és az, hogy mikor érvényes még. A hívók (`ui.js`, `interactions.ts`) csak a teljes új piszkozatot adják át. A nézet (`view.ts`) csak azt kérdezi, megjelenjen-e a gomb; gépelés közben a `refreshAuthorStatus` rejti el.

## Bizonyíték

- [author-workspace.test.mjs](../../tests/author-workspace.test.mjs) M2:
  - a betöltés kérdés nélkül cserél;
  - a visszavonás pontosan a korábbi piszkozatot hozza vissza, egyszer;
  - szerkesztés után nincs visszavonás;
  - a visszavonás érvényteleníti a betöltés késői válaszát.
- [browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py):
  - nincs betöltés gomb;
  - a választás azonnal betölt;
  - a Visszavonás visszahozza a forrást és eltűnik;
  - gépeléskor a gomb rejtve van.
