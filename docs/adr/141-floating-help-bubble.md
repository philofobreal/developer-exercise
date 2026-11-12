# ADR-141 – A ⓘ buboréka lebeg, és semmit nem tol el (NY-39, T1)

Állapot: **elfogadva** (2026-11-12). A felhasználó jóváhagyta a [javítási tervet](../terv-sugo-buborekok.md) („rendben, mehet”). Kockázati osztály: megjelenítés; a motor, a szabályok és az értékelés nem változott. Az [ADR-135](135-help-trial-and-highlighted-examples.md) helycsinálását váltja fel, az [ADR-124](124-help-from-one-source.md) buborékjának tartalmát megtartja. A terv T2 és T3 lépése ezt az ADR-t egészíti ki.

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
  - a T2-ben következik: az árva ⓘ a szabálytípusoknál, a 8 sornál hosszabb példák, a „Kipróbálom” felirata és elrendezése, a névelő;
  - a T3-ban következik: a fókuszkeret távolsága a címkétől, a `title` és a 44 px-es érintési terület;
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
