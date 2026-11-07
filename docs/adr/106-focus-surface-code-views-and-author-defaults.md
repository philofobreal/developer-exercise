# ADR-106 – Fókusz mód, két kódnézet, görgethető teljes képernyő és engedékenyebb szerzői alapértékek

Állapot: **elfogadva** (2026-11-07). Kockázati osztály: megjelenítés, illetve a 4. pont miatt pedagógiai döntés (a felhasználó kérte). Ez az átalakítás F4 szakasza; az ADR-105-re épül.

## Kontextus

A felhasználó kérései:
- **Fókusz mód:** a kódszerkesztő és a kódrendező a lehető legnagyobb felületre kiemelhető legyen („kvázi fullscreen”).
- **Kódnézetek:** legalább két kódnézet közül lehessen választani.
- **Görgetés teljes képernyőn:** „fullscreenben nem működik a scroll”.
- **Szerzői alapértékek:** az elemzési beállítások alapból legyenek: érvényes egyszerű adat, a kulcssorrend nem számít, csak szabványos osztálymezők.

A teljes képernyő hibájának oka:
- A gomb az `#app` elemet tette teljes képernyőre. A teljes képernyős elemet az oldal görgetése nem mozgatja, az elemnek pedig nem volt saját görgetése, ezért ami nem fért ki, elérhetetlen lett.
- A Fullscreen API nélküli tartalék (`ng-fullscreen` osztály) mögött nem volt stílus.

## Döntés

1. **Felületek** ([surface.ts](../../src/workbench/surface.ts)):
   - **Két felület:** `app` (az egész munkaterület) és `focus` (csak a kódfelület). A gyökér `data-surface` attribútumában élnek, így minden újrarajzolást túlélnek.
   - **Fullscreen API:**
     - ahol van, a felület a böngésző teljes képernyőjét használja;
     - a böngészőből kilépve (Escape vagy gesztus) a felület is megszűnik.
   - **Tartalék API nélkül (iOS Safari):**
     - a felület ugyanaz a rögzített réteg;
     - Escape-pel elhagyható, kivéve listában, szerkesztőben, nyitott menüben, vagy amíg egy sor fel van véve.
   - **Görgetés:** a gyökér mindkét felületen maga görget (`overflow: auto`). Ez javítja a teljes képernyős hibát.
2. **Fókusz mód:**
   - **Gomb:** a Próba eszközsorában „Fókusz”, illetve „Kilépés” felirattal, `aria-pressed` állapottal.
   - **Mi marad:**
     - egy soros címsor (cím, nyelv, érvényesítés neve; a Preview Validation vagy Local Demo megnevezés tehát látszik);
     - az eszközsor;
     - a listák, illetve a Megoldáskód szerkesztő a képernyő magasságáig;
     - az Ellenőrzés sáv.
   - **Ami eltűnik:** a fejléc, a feladatlista, a lépéssor és a súgó.
   - **Állapot:** a kitöltés, a nézet és a görgetés megmarad.
   - **A fejléc teljes képernyő gombja megmarad:** a Forrás és a Szabályok lépésben csak ez emeli ki a felületet.
3. **Kódnézetek** ([code-view.ts](../../src/workbench/code-view.ts)):
   - **Szerkesztő:**
     - sűrű, folytonos lista, mint egy kódszerkesztőben;
     - finom mutatónál 28 px-es sorok;
     - a forráslista is kártyák nélkül.
   - **Kártyák:**
     - külön csempék kerettel, 40 px-es sorokkal és 13 px-es kóddal;
     - a rögzített sor bal szegélye kék, az üres hely szaggatott keretű.
   - **Érintőképernyőn** mindkét nézetben 44 px marad a sor (célterület).
   - **Választás:** az eszközsorban; a böngésző megjegyzi (`ngdynamic.code-view.v1`). Választás nélkül érintőképernyőn Kártyák, egérrel Szerkesztő.
   - **Prioritás:** a szabályok `:where()`-rel alacsony prioritásúak, így a sorállapotok (kijelölt, hibás, felvett) színei mindig felülírják őket.
4. **Szerzői alapértékek** ([author-workspace.ts](../../src/workbench/author-workspace.ts), `NEW_DRAFT_SETTINGS`):
   - **Mire vonatkozik:** az új piszkozat és a példából indított piszkozat alapértéke `inputs: valid`, `keyOrder: ignored`, `classFields: define`. Ez a szerveres és a Pages-felületen egyaránt érvényes.
   - **Mire nem vonatkozik:**
     - a JSON-ból, munkamenetből vagy felvett modellből érkező piszkozat a saját beállításait őrzi;
     - a generátor könyvtári alapértékei (`any`, `observed`, `either`) nem változnak, így a kész gyakorlófeladatok és a tárolt modellek szabályai sem.
   - **Az összefoglaló sor** minden változtatás után frissül. Eddig a régi értéket mutatta.
   - **Kockázat:** ezek az értékek engedékenyebbek. Több sorrendet fogadnak el, ha a program trükkös bemenetet kap, kiírja a kulcsok sorrendjét, vagy régebbi célra fordul. Ezért látszanak az összefoglalóban, és a lenyitott panel minden beállításnál megmondja, mikor ne válaszd.
5. **Lépéssor:** a kék aktív lépés felirata fehér. Egy korábbi szabály a lépés címét sötétre színezte.

## Bizonyíték

- **`browser-workbench` esetek:**
  - Fókusz mód Fullscreen API-val: csak a kódfelület látszik, a lista legalább 100 px-szel magasabb, a szerkesztő magasabb 500 px-nél, a kitöltés változatlan, és a kilépés visszaállítja az oldalt.
  - Fókusz mód API nélkül: rögzített réteg, kilépés Escape-re.
  - Két kódnézet: a választás újratöltés után is megmarad; a sor 28, illetve 40 px.
  - Új alapértékek: az összefoglaló minden változtatást követ.
- **`browser-matrix`:** teljes képernyőn a munkaterület a tartalom aljáig görget.
- **`browser-drag`:** a teljes húzáskészlet mindkét kódnézetben lefut (`--code-view=cards`).
- **axe:** 0 hiba mindkét témában.

## Tervezési review (ADR-037)

- **Tulajdonos:**
  - a felület tudása (API vagy tartalék, kilépés) a `surface.ts`-ben él;
  - a kódnézeté (tárolás, alapérték) a `code-view.ts`-ben;
  - a geometria a stíluslapban; a nézet csak kiolvassa az állapotot;
  - a szerzői alapértékeket a szerzői munkaterület birtokolja.
- **Design twice:**
  - *A teljes képernyő gomb helyett csak Fókusz:* elvetve. A Forrás és a Szabályok lépésben nem lenne teljes képernyő.
  - *A kódnézet a munkafolyamat állapotában (`state`):* elvetve. Megjelenítési preferencia, a munkamenet-mentésbe nem tartozik.
  - *A generátor alapértékeinek átírása:* elvetve. Megváltoztatná a tárolt modellek és a kész feladatok jelentését; ehhez külön jóváhagyás kell (AGENTS.md).
