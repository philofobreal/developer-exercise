# ADR-155 – A munkafelület gyors nyeresége architektúraváltás nélkül (NY-58, F1)

Állapot: **elfogadva** (2026-11-14). A [refaktorterv](../terv-munkafelulet-refaktor.md) F1 fázisa; a felhasználó jóváhagyta („jóváhagyom, mehet a Refaktor F1”). Kockázati osztály: megjelenítés. Viselkedésmegőrző: a látható szöveg, a műveletek jelentése és az elrendezés nem változik; a markup-szerződés nem változik. A fázis taskonként halad; ez az ADR taskonként bővül.

## Kontextus (mérve 2026-11-14-én, a 482 soros TypeScript-feladaton)

- **A munkafelület minden művelet után a teljes oldalt újrarajzolja** ([ADR-151](151-workbench-headless-core-foundations.md)). Ezen az F4 változtat; az F1 azt veszi el, ami a mai szerkezetben is fölösleges.
- **A kényszerített elrendezések forrása nyomkövetéssel mérve** (Chromium trace, a kiváltó hívás veremével), egy kirajzolásra a Próba lépésben:
  - a szabályívek listánként külön mértek és rajzoltak: a második lista mérése az első rajzolása után új elrendezést kényszerített ki;
  - a magasságrögzítés ([ADR-152](152-technology-labels-in-the-practice-list.md)) a kirajzolás elején a régi, eldobásra váró oldalt rendeztette el;
  - a fejléc illesztése előbb ír, aztán mér.
- **Az „szerkeszthetők-e a szabályok” kérdést minden sor külön tette fel.** A válasz a teljes forrást és a teljes JSON-piszkozatot hasonlítja össze az alkalmazott modellével; 482 sornál ez kirajzolásonként kb. 25 ms volt.
- **A „nem alkalmazott JSON” állapotot két hely számolta** (a nézet és a szerkesztő beviteli kezelője), eltérő kóddal; a kezelő minden leütésre újra szöveggé alakította a teljes modellt.

## Döntés

### T1.1 – Az elérhetőség kirajzolásonként egyszer

- **A szabálytábla és a rendező sorai egyetlen választ kapnak** arra, hogy a szabályok most szerkeszthetők-e; a kirajzolás egyszer kérdez, és minden sornak átadja.
- A rendező sorvezérlőit egy kirajzolásra szóló gyár adja (`createRowRuleControls`), ahogy a szabályjelöléseket is (`createRuleMarks`). Az egy sorra szóló hívások (`connectButton`, `tryRowRuleControls`) megmaradtak, maguk kérdeznek.

### T1.5 – Egy mérési fázis kirajzolásonként

- **Az ívek mérése és rajzolása két fél** (`measureRuleArcs` visszaadja a rajzolást): minden lista mérése megtörténik, mielőtt bármelyik rajzolódna.
- **A nézet folytonossága a nyitott részeket azonnal visszanyitja,** a mérés előtt, és a fókusz visszaadását adja vissza, amelyet a nézet a mérés után hív (`restore` → folytatás). A kettő sorrendje így nem téveszthető el.
- **A kirajzolás sorrendje:** előbb minden, amiből az új oldal áll (HTML, szerkesztők tartalma, visszanyitott részek), aztán a mérések (ívek, fejléc, eszköztár, listák, görgetés), végül ami a mérésekből következik (ívek rajzolása, fókusz).
- **A magasságrögzítés megszűnt** ([ADR-152](152-technology-labels-in-the-practice-list.md) kerülőmegoldása). Az ok megszűnt: az oldal már nem mérődik a visszanyitás előtti, rövidebb állapotában. Az ADR-152 görgetés-tesztje a rögzítés nélkül is zöld.

### T1.7 – Egy tulajdonos a JSON-piszkozat állapotára

- **Csak az `author-workspace` dönti el,** hogy a CodeLine JSON alkalmazott-e (`modelDraftStatus`): ő birtokolja a modell szövegét (`modelJson`, gyorsítótárazva). A nézet, a folyamat (`jsonPending`) és a szerkesztő beviteli kezelője őt kérdezi; a kezelő a szerkesztő éppen gépelt szövegével.
- A felirat („Nem alkalmazott JSON”, „Aktív modell”, „Új feladat JSON-ból”) is egy helyről jön.

## Két terv („design it twice”)

T1.1:
1. **Gyorsítótár az `availability` függvényben.** Elvetve: az állapotnak nincs verziója, a gyorsítótár érvényességét nem lehetne megmondani.
2. **A kirajzoló egyszer kérdez, és átadja (választott).** A meglévő minta (`createRuleMarks`) folytatása.

T1.5, a nyitott részek és a fókusz:
1. **Két külön művelet a folytonosságon** (`reopen`, `refocus`). Elvetve: kötelező hívási sorrend a hívón.
2. **Egy művelet, amely a második felét visszaadja (választott).** A fókusz nem adható vissza a visszanyitás előtt, mert a folytatás csak a hívásból kapható meg. Az ívek ugyanezt a mintát követik.
3. **A magasságrögzítés megtartása, kényszerítés nélkül** (a magasság követése `ResizeObserver`-rel). Elvetve: a tünetet kezelné tovább, egy újabb megfigyelővel.

T1.7:
1. **A kezelő olvassa az állapotot** (`jsonPending(state)`). Elvetve: a kezelő a `ui.js` kezelője előtt is futhat, amikor az állapot még a régi szöveget tartja.
2. **A tulajdonos a szöveget is megkaphatja (választott):** alapértelmezésben az állapotét, a kezelőtől a szerkesztőét.

## Tervezési review (docs/design-review.md)

- **Elrejtett tudás:** az `author-workspace` tudja, mi az alkalmazott modell szövege és mikor piszkozat a JSON; a `rule-board` tudja, mit kell az ívekhez mérni és hogyan rajzolódnak; a `continuity` tudja, mi volt nyitva és hol állt a fókusz. A nézet kirajzolása csak a fázisok sorrendjét tudja.
- **Az interfészek nem szélesedtek érdemben:** egy új gyár (`createRowRuleControls`), egy új kérdés (`modelDraftStatus`), egy kettéosztott művelet (`measureRuleArcs`; a `drawRuleArcs` megmaradt az ívek önálló újrarajzolására). A `continuity.restore` visszatérési értéket kapott.
- **Megszűnt egy ismétlés** (a JSON-állapot két számítása: a refaktorterv 2.1 szakaszának `design` megállapítása) és egy kerülőmegoldás (a magasságrögzítés).
- **design, rögzítve:** a fejléc illesztése (`fitBrand`) továbbra is ír, mielőtt mér, ezért kirajzolásonként egy elrendezést kikényszerít. Pontos megtartása mellett nem kerülhető el (a szélesebb lépcsőt ki kell próbálni); a régiós kirajzolás (F4) a fejlécet ritkán rajzolja újra.
- **design, rögzítve:** a görgetés visszaállítása a listák illesztése után marad (pontosság), ezért elrendezést kényszerít ki, ha a fejléc illesztése írt.

## Bizonyíték

- **T1.1, egységteszt** ([workbench-flow.test.mjs](../../tests/workbench-flow.test.mjs)): a kérdés a JSON-piszkozatot olvassa; a teszt megszámolja az olvasásokat. A 60 soros tábla és a rendező 60 sora egyszer kérdez; az egy válasz minden sorhoz eljut (alkalmazatlan piszkozatnál mind a 120 vezérlő letiltott, az okával). Három visszarontás, mind megbukik.
- **T1.7, egységteszt** (ugyanott): a tulajdonos válasza alkalmazott modell nélkül és vele, az állapot szövegére és a gépelt szövegre, a három felirattal.
- **T1.5, nyomkövetés** (kényszerített és keret szerinti elrendezések egy forgatókönyvben, előtte → utána): Próba megnyitása 7 → 5; billentyűs lerakás 8 → 6; ellenőrzés 7 → 6. Az ívek két kényszerítése egyre csökkent, a magasságrögzítésé megszűnt.
- **A görgetés megtartása** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py), `tap_to_place`): a rögzítés nélkül is zöld.
- **Mérősáv és teljes kör:** a fázis végén, a többi taskkal együtt (lásd lent).

## Korlát

- **Az elrendezés ideje alig változik:** a kirajzolás első elrendezése (a teljes új oldalé) adja az idő nagy részét, a megszűnt kényszerítések kis részfákat érintettek. A darabszám csökkent; a nagy nyereség az F4 régiós kirajzolásáé.
