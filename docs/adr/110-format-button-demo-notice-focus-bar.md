# ADR-110 – Látható Formázás gomb, egyszer megjelenő Local Demo magyarázat, fókuszsáv és visszatérés a teljes képernyőhöz

Állapot: **elfogadva** (2026-11-08). Kockázati osztály: megjelenítés. Az [ADR-105](105-mock-character-and-calm-layout.md), az [ADR-106](106-focus-surface-code-views-and-author-defaults.md) és az [ADR-107](107-editor-window-focus-split-and-rule-inspector.md) módosítása.

## Kontextus

A felhasználó jelzései:
1. **Eltűnt a Formázás gomb a Forrás lépésből.**
   - Valójában megvolt: az ADR-105-ös tömörítés óta felirat nélküli ikon, átlátszó háttérrel és kerettel, a Referenciaforrás címsorának jobb szélén.
   - Nem lehetett észrevenni.
2. **A Local Demo jelzés túl sok helyet foglal, és mindig ki van írva.**
   - A cím alatt hosszú jelvény („Local Demo / Preview Validation”).
   - Alatta egy teljes szélességű sáv ugyanezzel a szöveggel.
3. **A Fókusz módban nincs fejléc a logóval.**
   - Ha a teljes képernyős oldalnézetből lépünk fókuszba, a fókusz kioldása a böngésző teljes képernyőjéből is kilép, és nem a teljes képernyős oldalnézethez tér vissza.

## Döntés

1. **Formázás:** feliratos gomb („Formázás”), látható kerettel, a Referenciaforrás címsorában. A másolás és a beillesztés ikon marad.
2. **Local Demo** (az AGENTS.md szerződése szerint a Pages egyértelműen Local Demo marad):
   - **Jelvény:** mindig ott van a cím alatt, rövid szöveggel („Local Demo”).
     - A teljes név és a jelentés („Local Demo / Preview Validation: Helyi demonstráció, nem hitelesített vizsgaeredmény”) a jelvény címe és akadálymentes neve.
     - Szerveren a jelvény változatlan („Preview Validation”, „Trusted Server Validation”).
   - **Magyarázó sáv:** addig jelenik meg, amíg a néző az „Értem” gombbal el nem veti.
     - Ez nézőnkénti kényelmi beállítás a böngésző helyi tárában (`codeline.local-demo-notice`).
     - Tár nélkül (privát ablak, tiltott tár) a sáv egyszerűen megjelenik.
3. **Fókuszsáv:** fókuszban az oldal fejléce helyett egy 32 px magas sáv látszik a logóval és a névvel. Kisebb, mint az oldal fejléce, és nem vesz el helyet a kódfelülettől.
4. **Fókusz és teljes képernyő** ([surface.ts](../../src/workbench/surface.ts)):
   - **Teljes képernyős oldalnézetből lépünk fókuszba:** a fókusz megjegyzi, honnan jött (`data-surface-return`). Kioldáskor oda tér vissza: a teljes képernyős oldalnézet marad, a böngésző teljes képernyője nem zárul be. Ugyanez történik az Escape-re a Fullscreen API nélküli böngészőben.
   - **Az oldalról lépünk fókuszba:** a kioldás a fókusz által nyitott teljes képernyőt is bezárja, mint eddig.
   - **A böngésző saját kilépése** (Escape a natív teljes képernyőben) mindkettőt bezárja.

## Bizonyíték

- [browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py), Node és Pages módban:
  - `focus_bar_and_full_screen_return`: a fókuszsáv látszik, legfeljebb 34 px magas; teljes képernyőről fókuszba és vissza: a felület `app`, a natív teljes képernyő változatlan; oldalról fókuszba és vissza: semmi nem marad teljes képernyőn.
  - `preflight_ui`: a Formázás gomb látható, feliratos, és van kerete.
- [browser-matrix.playwright.py](../../tests/browser-matrix.playwright.py): a Pages jelvénye „Local Demo”, a teljes név az akadálymentes nevében; az „Értem” után a sáv újratöltéskor sem jelenik meg.
- A gépi akadálymentességi átvizsgálás a fő nézeteken 0 hibával.
