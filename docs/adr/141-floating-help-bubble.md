# ADR-141 – A ⓘ buboréka lebeg, és semmit nem tol el (NY-39)

Állapot: **elfogadva** (2026-11-12). A felhasználó jóváhagyta a [javítási tervet](../terv-sugo-buborekok.md) („rendben, mehet”). Kockázati osztály: megjelenítés; a motor, a szabályok és az értékelés nem változott. Az [ADR-135](135-help-trial-and-highlighted-examples.md) helycsinálását váltja fel, az [ADR-124](124-help-from-one-source.md) buborékjának tartalmát megtartja. A terv T2 és T3 lépése lent egészíti ki; a három lépéssel az NY-39 lezárult.

## Kontextus

- **A buborék helyet csinált magának.** Nyitáskor a gazdája (címke, fejléc, kérdés) alsó margót kapott, így:
  - a beállítás választója 289–399 px-rel lejjebb került, gyakran ki a képből;
  - a Feladat állapota sorában a sor saját válasza („● Igen”) a buborék alá került, mert a margó csak a kérdés celláját nyújtotta meg;
  - telefonon a Minősítés jelvényei a buborék alá csúsztak;
  - a beállítás magyarázó mondata eltávolodott a példájától.
- **A magas buborék a ragadós sávok alá került** (réteg 13, a sávoké 14 és 15), és nyitáskor semmi nem görgette a képbe.
- **Hibás HTML (B5):** a „Bemenetek → szigorú lett” sor egy `<p>` volt. A buborék blokkjai lezárták, így a sor többi része, nyitott buborékkal pedig a ⓘ is, a soron kívülre került. Az új jelölésben a buborék a burkolóján kívülre került volna, és ott a ⓘ nem is nyílt volna ki, ezért ez a T1-be került.

A mérés (hét hely, asztal és telefon) a [tervben](../terv-sugo-buborekok.md) van.

## Döntés

- **A buborék a felső rétegben nyílik (`popover`),** a ⓘ gombjához igazítva. A gombot és a buborékot `popovertarget` köti össze. A buborék a ragadós sávok fölött van, és az oldalon semmi nem mozdul.
- **Elhelyezés** (`toggletip.ts`):
  - a gomb alatt nyílik, ha ott elfér, vagy ha alatta legalább annyi hely van, mint fölötte; különben fölötte;
  - vízszintesen a gombhoz igazodik, és 16 px-re a kép szélétől megáll;
  - legfeljebb akkora, amekkora hely van; a többi a buborékon belül görgethető;
  - ha a gomb a kép szélén áll, és egyik oldalon sincs legalább 160 px (vagy a buborék saját magassága), a gomb előbb a kép közepére görgetődik;
  - görgetésnél és átméretezésnél a buborék követi a gombot; ha a gomb kigördül a képből, a buborék bezárul.
- **Bezárás:**
  - Escape és külső kattintás: a böngésző saját viselkedése (`popover="auto"`);
  - ha a fókusz kilép a buborékból és a gombjából (például Tab az utolsó link után), a buborék bezárul. Így a buborék alá került vezérlő takarva soha nem kap fókuszt (WCAG 2.4.11);
  - a buborék saját szövegére kattintva a fókusz nem kerül sehova, ezért a buborék nyitva marad.
- **Újrarajzolás:**
  - egy nem az olvasó által okozott (háttérben érkező, ADR-136) rajzolás után ugyanaz a buborék újra kinyílik, a témája és a sorszáma szerint;
  - az olvasó műveletére jövő rajzolás bezárja.
- **Jelölés** (`renderInfo`):
  - `<span class="toggletip">` burkoló, benne `button.info-button` (`aria-expanded`) és `div.toggletip-panel[popover]`;
  - a buborék első sora a téma neve.

  A párosító azonosítókat a modul adja rajzolásonként, így a szöveges rajzolók tiszták maradnak. A burkoló `span`, mert szövegben is állhat, de `<p>`-ben soha.
- **A környezetsor** (`analysis-settings`) `div` lett (B5).

## Két terv („design it twice”)

1. **A helycsinálás foltozása gazdatípusonként** (rácssor, fejléc, szövegközi ⓘ). Elvetve, mert:
   - minden új ⓘ-hely új szabályt kérne;
   - a kezelt vezérlő továbbra is elugrana;
   - a magas buborék a sáv alatt maradna.
2. **Lebegő réteg, eltolás nélkül (választott).** Egy modul tudja az elhelyezést és a bezárás okait; a hívók csak `renderInfo(...)`-t írnak.

## Tervezési review (docs/design-review.md)

- **toggletip.ts:**
  - *elrejti*: a helyet és a magasságkorlátot; az átfordítást; a gomb követését; a fókusz kilépésére és a gomb kigördülésére történő bezárást; a háttér-újrarajzolás utáni visszanyitást; a gombok és buborékok párosítását;
  - *interfésze*: egy telepítő (`installToggletips(root)`) és egy művelet: `rendered({background})`, rajzolás után. Hívója a `view.ts`.
- **Kikerült** a régi helycsinálás (`TIP_HOSTS`, a margó) az `interactions.ts`-ből, és a `continuity.ts` ⓘ-kivétele: a buborék már nem `details.menu`.
- **Nincs párhuzamos állapot:** a nyitott buborékot csak a modul tartja nyilván, a böngésző `toggle` eseményéből.
- **Rögzített maradék:**
  - a nyitott buborék akadálymentességi vizsgálata csak a buborékra szól. Az alatta lévő oldalt csukott buborékkal vizsgáljuk, mert a buborék takarása átmeneti, és a fókusz nem juthat alá. Az egész oldal vizsgálata nyitott buborékkal itt is 0 hibát adott, de egy másik betűkészletnél (CI) a takart vezérlő más lenne.

## Bizonyíték

- **Mérés** (hét hely, 30 megnyitás, asztal 1280×900 és telefon 390×844, sötét téma):
  - a környező elemek egy pixelt sem mozdulnak;
  - a buborék a képen belül van, és az alja látszik;
  - nincs vízszintes görgetés;
  - Escape bezár, a fókusz a ⓘ-ra tér vissza.
- **Böngészős teszt** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py)):
  - `help_toggletips`: nyitás, `aria-expanded`, Escape, Tab-kilépés, link új lapon;
  - `background_render_keeps_menu`: a nyitott buborék a háttérben érkező rajzolás után nyitva marad;
  - `inputs_override`: a környezetsor négy része egy sorban marad, és az ⓘ-ja kinyílik;
  - telefonos szélességek (320, 390, 768 px): nyitáskor semmi nem mozdul, a buborék a képen belül van, és a magasra nőtt buborék belül görgethető.
- **Egységteszt** ([help-examples.test.mjs](../../tests/help-examples.test.mjs)): buborék soha nem áll nyitott `<p>`-ben.
- **Akadálymentesség** ([browser-a11y.playwright.py](../../tests/browser-a11y.playwright.py)): a nyitott buborék 0 hibával, mind a négy téma–szélesség párban.

## T2: elhelyezés és tartalom (2026-11-12)

A felhasználó jóváhagyta („rendben, folytasd”).

- **A szabálytípusok árva ⓘ-ja megszűnt.** A buboréka ugyanazt mondta, mint az alatta álló bekezdés. A bekezdés végén most „Részletek a súgóban ↗” link áll; a linket a `helpLink` adja, ugyanaz, amely a buborék utolsó sora.
- **A „Bemenetek → szigorú lett” sor ⓘ-ja a „Bemenetek:” címke mellett áll,** mint minden más ⓘ, nem a mondat végén.
- **A buborék legfeljebb 8 soros kódpéldát mutat** (`BUBBLE_EXAMPLE_LINES`).
  - A hosszabb példa (ma az Objektumkulcsok sorrendje 10, a Hordozhatóság 10 és az Osztálymezők létrehozása 13 sorral) a súgóoldalé.
  - Ilyenkor a buborék a téma mondatát mondja (akkor is, ha a mondat a vezérlő alatt is áll, hogy a buborék ne csak egy link legyen), és „Példa és kipróbálás a súgóban ↗” linkkel zárul.
  - A súgóoldal a teljes, ellenőrzött példát mutatja; a példák motoros tesztje nem változott.
- **„Kipróbálom a Kód lépésben”:**
  - a munkafelületi gomb felirata megmondja, hova visz;
  - a buborékban egyszer áll: „A „Kipróbálom” a mostani forrást és beállításokat lecseréli; visszavonható.”;
  - a kimenetel és a gombja egy sorban, rácsban áll.

  A súgóoldal linkje „Kipróbálom” maradt: ott az oldal elhagyása a hivatkozásból látszik.
- **Névelő:** az `article(n)` a szám kiejtése szerint dönt: „az” egy (1), öt (5), ötven (50–59), ötszáz (500–599), ezer (1000–1999) és az általuk vezetett ezresek és milliók előtt, különben „a”. A sorjel (#5) ugyanígy, „az ötös”.
  - **Cserélve a munkafelületen:** a súgópélda mondata és a Kipróbálom üzenete, a leletek és a bemeneti sor „Ugrás … sorra” felirata, a szabálytábla, a szabálypanel és a sorgombok feliratai.

### Rögzített maradék (T2)

- A motor (`src/core/diagnostics.ts`, a tanulói visszajelzés), a szabályszerkesztés és a szerzői elemzés üzenetei (`src/author`) továbbra is „a(z)”-t írnak.
  - A számos esetek a magban vannak, ezért külön kockázati osztály; a nevesek („a(z) „x””) kiejtése egy azonosítónál nem dönthető el biztosan.
  - A felületi feliratok cseréje ezeket nem érintette.

### Bizonyíték (T2)

- **Egységteszt** ([help-examples.test.mjs](../../tests/help-examples.test.mjs)):
  - egy témához sem mutat a buborék 8 sornál hosszabb példát; a hosszabbaknál ott a mondat és a link, a súgóoldalon a teljes példa;
  - a névelő 20 számra (0, 1, 2, 5, 10, 15, 50, 55, 100, 105, 150, 500, 512, 1000, 1500, 2000, 5000, 12 000, 150 000, 1 000 000);
  - a bemenetek buborékának pontos jelölése (kimenetel, gomb, megjegyzés).
- **Böngészős teszt** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py)):
  - `help_toggletips`: a kulcssorrend buborékában nincs kód, ott a mondat és a link; a bemenetekében a példa;
  - `help_trial`: a „Kipróbálom a Kód lépésben” a bemenetek példáját szigorú szerződéssel tölti be; a 2. és 3. sor cseréjét az Ellenőrzés elutasítja, ahogy a súgó mondja.

## T3: a ⓘ gomb és az átfogó teszt (2026-11-12)

A felhasználó jóváhagyta („mehet”).

- **A fókuszkeret nem ér a címkéhez (B1):** a címke és a ⓘ köze 6 px, a ⓘ fókuszkerete 1 px-re áll a gombtól (3 px vastag). Előtte a köz 2 px volt, a keret 3 px-re állt, így 4 px-et takart a címke utolsó betűjéből.
- **Nincs kettős súgó (B8):** a `title` attribútum kikerült. Egérrel eddig a böngésző saját „Súgó: …” felirata is feljött a buborék fölé. A gomb neve (`aria-label`) maradt.
- **Érintőképernyőn 44×44 px a cél (B9), az [ADR-140](140-button-system.md) mérete szerint.**
  - A 28 px-es gomb körül egy láthatatlan keret (`::before`, 8 px minden oldalon) adja.
  - A címke és a ⓘ köze érintőképernyőn 8 px, így a keret nem veszi el a címkére szánt koppintást.
  - A beállítás választója 8 px-re kerül a címkesortól (eddig 6 px volt, a keret 2 px-et belelógott volna).
  - A „Bemenetek → szigorú lett” sorban a „Bemenetek: ⓘ” saját sort kap, 8 px-re a mondattól, és a mondat sorai magasabbak. Eddig a „2. sor” gomb közvetlenül a ⓘ alatt állt, 0 px-re.

  Egérrel az elrendezés nem változott.

- **A buborék az első képkockától a helyén van (a felhasználó jelezte, 2026-11-12: „felvillannak balfelül … és utána ugranak csak oda”).**
  - **Az ok:** a T1 a böngésző saját nyitására (`popovertarget`) bízta a megjelenést, és a buborék a későbbi `toggle` eseményben kapott helyet. Közben a böngésző egy képkockát a bal felső sarokban (0, 0) rajzolt ki, a mérés szerint minden ⓘ-nél.
  - **A javítás:** a ⓘ kattintását a modul maga kezeli (`show`). Ugyanabban a feladatban nyitja meg és helyezi el a buborékot, így két kirajzolás között már csak a végleges hely látszik. Billentyű és érintés ugyanezen az úton megy.
  - **A `popovertarget` attribútum marad** a párosításhoz és ahhoz, hogy a külső kattintásos bezárás a gombot a buborék részének tekintse.
  - **Tartalék:** minden más nyitás (`beforetoggle`) láthatatlan (`data-placing`), amíg helyet nem kap; a háttér-újrarajzolás utáni visszanyitás is a `show` úton megy.

### Két terv a 44 px-hez

1. **A gomb maga 44 px.** Elvetve: minden címkesor és kérdéssor magasabb lenne, a Feladat állapota három sora telefonon 16 px-rel nőne, asztalon pedig fölösleges.
2. **Láthatatlan keret durva mutatón (választott).** A látvány és az asztali elrendezés nem változik. A kerettel szomszédos vezérlőkkel való ütközést a kapu méri; ahol ütközött (a választó, a „2. sor”), ott a köz nőtt, nem a keret csökkent.

### Bizonyíték (T3)

A **böngészős kapu** (`toggletips_everywhere`, [browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py)) minden ⓘ-t megnyit:
- **helyek:** a beállítások, a leletlista fejléce, a csoportosított projektkontextus-lelet, a bemeneti sor, a Feladat állapota három kérdése és a Minősítés;
- **körülmények:** asztalon (1280×900) és telefonon (390×844, érintéssel), világos és sötét témában.

Mindegyiknél ellenőrzi:
- nincs natív `title`;
- a fókuszkeret nem éri el a címke szövegét;
- érintésnél a gomb középpontjától 21 px-re mind a négy irányban a gomb a cél, a címke utolsó betűje nem, és a keret más vezérlővel nem fed át;
- nyitáskor semmi nem mozdul;
- az első kirajzolt képkockán a buborék már a végleges helyén áll, billentyűvel és egérrel vagy érintéssel nyitva is (`FIRST_FRAME`);
- a buborék a képen belül van;
- Escape bezár, és a fókusz visszatér;
- a külső kattintás és a Tab-kilépés is bezár.

**A kapu előbb a javítás előtti állapoton futott, és bukott:**
- asztalon a B8 és a B1 miatt („a native title bubble”, „the focus ring reaches the label (329 < 333)”);
- ezek javítása után telefonon a B9 miatt („no target at -21,0”);
- a 44 px-es keret első változatán a címkére, majd a „2. sor” gombra és a választóra lógott.

Mindegyik javítva.

**A felvillanás:** a javítás előtt a mérés mind a négy kipróbált ⓘ-nél (0, 0)-ban rajzolta az első képkockát. A javítás után az első képkocka a végleges helyen van. **Mutációs próba:** ha a modul a kattintást ismét a böngészőre hagyja, és a láthatatlan nyitást is kiveszem, a kapu elbukik: „first painted at [0, 0], placed at [339, 631]”.
