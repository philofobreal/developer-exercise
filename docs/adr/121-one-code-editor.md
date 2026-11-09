# ADR-121 – Egy kódszerkesztő: kiemelés, behúzás, automatikus formázás betöltéskor

Állapot: **elfogadva** (2026-11-09). Kockázati osztály: megjelenítés. A felület-audit M4 pontja (a felhasználó kérése: „ahol forráskód nézet van, ott legyen kiemelés és formázás”).

## Kontextus

A felület-audit kódnézet-leltára (2026-11-09) szerint:
- **Kiemelés csak két helyen volt:** a rendező soraiban és a szabálytáblán.
- **Sima szövegmező volt mindhárom szerkesztő:** a forrás, a CodeLine JSON és a megoldáskód szerkesztője. A Tab öt szóközt szúrt be, más segítség nem volt.
- **Egyszerű szövegként jelentek meg a kódrészletek** a szabálypanelen, a függőségi táblában és a soronkénti megfeleltetésben.
- **Nem formázódott a betöltött forrás** (TypeScript minta, forrásfájl, beillesztés); a Formázás gombot kézzel kellett megnyomni.

## Döntés

- **Egy kiemelő** ([ui-utilities.ts](../../src/workbench/ui-utilities.ts) `highlight`): a már szállított Prism. A rendező, a szabálytábla, a kódrészletek és a szerkesztők ugyanezt használják; a JSON a JavaScript nyelvtanával színeződik.
- **Egy szerkesztőkomponens** (`editorShell`, `syncEditors`) a forráshoz, a JSON-hoz és a megoldáskódhoz:
  - Egy átlátszó szövegmező fekszik egy kiemelt réteg fölött, azonos betűvel, sormagassággal, margóval és tabulátormérettel. A görgetés és a sorszámok szinkronban maradnak.
  - **A szövegmező natív marad:** a visszavonás, a kijelölés, az IME, a beillesztés és a mobil billentyűzet a böngészőé.
  - Nagy kontrasztú (forced-colors) módban a réteg kikapcsol, és a natív szöveg látszik.
- **A szerkesztés billentyűi** egy tiszta függvényben vannak (`editorKey`, egységtesztelhető):
  - Tab és Shift+Tab kijelölt sorokra is (a forrásnál öt, a JSON-nál két szóköz).
  - Enter megtartja a behúzást, nyitó zárójel után beljebb kezd.
  - A csak behúzást tartalmazó sorba írt `}` visszalép egy szintet.
  - A módosítás a böngésző saját szerkesztésén megy át (`insertText`), így a natív visszavonás működik.
- **Automatikus formázás, ahol van értelme:**
  - **forrás:** a TypeScript minta, a forrásfájl és az üres (vagy teljesen kijelölt) szerkesztőbe beillesztett teljes forrás a formázón át érkezik (`formatLoaded`). Egy Visszavonás visszahozza az előzőt (ADR-115).
    - **Csak ha a tördelés változik:** egysoros vagy rosszul tördelt kódnál. A már a formázó soraira tördelt forrás a szerző saját behúzásával marad.
    - **Miért:** a teljes böngészős sor kimutatta, hogy különben egy két szóközzel behúzott, szállított TypeScript-minta öt szóközösre változik, és eltér a saját modelljétől.
    - **Formázhatatlan forrás:** változatlanul töltődik be, és az üzenet ezt meg is mondja.
  - **JSON:** a teljesen beillesztett, érvényes JSON két szóközzel tördelődik.
  - **Gépelés közben nincs formázás:** az elmozdítaná a kurzort, és a szerző tudta nélkül írná át a kódját.
- **A tanuló megoldáskódja nem formázódik automatikusan** (a felhasználó jóváhagyásával). A kiértékelés a beírt szöveget kapja meg pontosan (AGENTS.md: a literális szóközök megőrzése); a kézi Formázás gomb megmarad.
- **A formázó** a nézet létrehozásakor portként érkezik (`WorkbenchOptions.format`: szerver vagy Local Demo), így a fájlbetöltő ugyanazt használja.

## Két terv („design it twice”)

1. **Átlátszó szövegmező a kiemelt réteg fölött (választott).** Új függőség nincs, a natív szerkesztés megmarad. Az illesztés feltétele az azonos betűmetrika és a sortörés nélküli szöveg; mindkettő a stíluslapban rögzített.
2. **`contenteditable` vagy CodeMirror/Monaco (elvetve).**
   - A `contenteditable` esetén a kijelölést, a visszavonást és a mobil bevitelt újra kellene írni.
   - A CodeMirror és a Monaco külső könyvtár (300 KB–2 MB), amelyet a felhasználó nem kért.

## Bizonyíték

- **Egységtesztek:**
  - [editor-keys.test.mjs](../../tests/editor-keys.test.mjs): Enter, `}`, Tab és Shift+Tab egy vagy több sorra, a JSON két szóközös egysége, a többi billentyű a böngészőé;
  - [author-workspace.test.mjs](../../tests/author-workspace.test.mjs): `formatLoaded` formázott, formázhatatlan, formázó nélküli és már tördelt (a behúzás marad) esete.
- **Böngészős teszt:** [browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py) `code_editor`:
  - gépeléskor öt szóközös behúzás és visszalépő `}`;
  - a kiemelt réteg pontosan a szöveget mutatja;
  - egy egysoros forrásfájl formázva érkezik, a Visszavonás visszahozza az előzőt;
  - a már tördelt fájl (`source_file`) változatlan marad;
  - a szabálypanel kódrészlete és a tanulói szerkesztő is kiemelt.
