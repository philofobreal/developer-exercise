# Terv: a ⓘ súgóbuborékok javítása (NY-39)

Állapot: **kész** ([ADR-141](adr/141-floating-help-bubble.md), 2026-11-12): T1, T2 és T3; az NY-39 lezárva. Terv: a felhasználó kérésére („vizsgáld meg az összes infó tooltippet, tárd fel a hibáikat és írj tervet a javításukra”). Kockázati osztály: megjelenítés. A motor, a szabályok és az értékelés nem változik. A megvalósítás az [ADR-141](adr/141-floating-help-bubble.md); az [ADR-135](adr/135-help-trial-and-highlighted-examples.md) helycsinálását váltja fel, az [ADR-124](adr/124-help-from-one-source.md) buborékjának tartalmát megtartja.

## Hol van ⓘ (a teljes lista)

Egy függvény rajzolja (`renderInfo`, [help-topics.ts](../src/workbench/help-topics.ts)), hét helyről hívva:

| # | Hely | Gazda (a buborék körüli elem) | Fájl |
| --- | --- | --- | --- |
| 1 | Elemzési beállítások: mind a 9 beállítás címkéje | `.setting-head` | `preflight-settings.ts` |
| 2 | „Bemenetek: érvényes egyszerű adat → szigorú lett” sor | nincs (szövegközi `span`) | `preflight-settings.ts` |
| 3 | Leletlista egy sora: „Hiányzó projektkontextus” | nincs (`.diagnostic-message`) | `preflight-settings.ts` |
| 4 | Leletlista fejléce („Leletek”) | `.diagnostics-head` | `preflight-settings.ts` |
| 5 | „Szabályok típus szerint” lenyíló | nincs (a `summary` után, külön sorban) | `rule-panel.ts` |
| 6 | Minősítés fejléce | `.insight-heading` | `rule-panel.ts` |
| 7 | A feladat állapota: Kitölthető? / Ellenőrizhető? / Igazságos? | `.task-question` (rácssor első cellája) | `task-status.ts` |

A viselkedés két helyen él: `installToggletips` (helycsinálás, vízszintes eltolás, [interactions.ts](../src/workbench/interactions.ts)) és `installMenus` (Escape, külső kattintás). A gyakorló nézetben és a súgóoldalon nincs ⓘ.

## Feltárt hibák

Mérve 1280×900 asztali és 390×844 telefonos nézetben, sötét témában, mindegyik ⓘ megnyitásával. A mérőszkript a buborék, a címke, a gazda és a szomszédos elemek helyét rögzítette nyitás előtt és után, valamint a fókuszkeret és a ragadós sávok takarását.

| ID | Hiba | Bizonyosság, bizonyíték | Érintett hely |
| --- | --- | --- | --- |
| B1 | **A fókuszkeret rálóg a címke utolsó betűjére.** A globális keret 3 px vastag, 3 px-re a gombtól. A címke és a ⓘ között 2 px a köz, ezért a keret 4 px-et takar a betűből. (1. kép: a „Bemenetek” „k”-ja.) | biztos: `style.css` 28. sor, mért köz 2 px | mind |
| B2 | **Nyitáskor eltolódik a tartalom, üres sávot hagyva.** A buborék alatti vezérlő a helycsinálás miatt 289–399 px-rel lejjebb kerül (a beállítás választója). Gyakran kicsúszik a képből, pedig a tanár épp azt akarta kezelni. (2. kép) | biztos: mért eltolás | 1, 4, 6, 7 |
| B3 | **A Feladat állapota sorában a sor saját válasza eltűnik a buborék alatt.** A „● Igen” és a magyarázó szöveg a rácssor másik celláiban áll. A helycsinálás csak a kérdés celláját nyújtja meg, ezért azok a buborék alá kerülnek. (4. kép) | biztos: mindhárom kérdésnél, asztalon és telefonon | 7 |
| B4 | **Telefonon a Minősítés jelvényei a buborék alá kerülnek.** Az „Elemzéssel igazolt” és a „Publikálható” jelvény 176 px-rel lejjebb csúszik. | biztos: mért | 6 |
| B5 | **Hibás HTML szétszedi a környezetsort, csukott buborékkal is.** A ⓘ (`<details>`, benne `<div>`) egy `<p class="analysis-settings">` bekezdésben áll. A böngésző ezért ott lezárja a bekezdést, és a sor maradéka („Objektumkulcsok sorrendje…”, „Osztálymezők…”, „A modell ezzel a környezettel készült.”) a formázott soron kívülre kerül: köz nélkül, más betűmérettel. Nyitva a ⓘ új sorba törik, a buborék pedig eltakarja az Elemzési beállítások mezőit. | biztos: a DOM-ban a bekezdésnek egyetlen gyereke van | 2 |
| B6 | **Árva ⓘ a „Szabályok típus szerint” lenyílóban.** Címke nélkül, külön sorban áll a cím alatt, és a buborék eltakarja a „Mind feloldása” gombot. A buborék szövege ugyanaz, mint az alatta álló magyarázó bekezdésé. | biztos: mért takarás | 5 |
| B7 | **A magas buborék kilóg a képből, és a ragadós műveletsáv alá kerül.** A kódpéldás buborékok 376–409 px magasak. A buborék rétege (13) a ragadós sávok (14, 15) alatt van, és nyitáskor semmi nem görgeti a képbe. Telefonon a „Részletek a súgóban” a „Következő lépés” sáv alatt marad. (3. kép) | biztos: mért alsó él 1063 és 1219 px 900 px-es nézetben | 1 |
| B8 | **Egérrel két súgó jelenik meg egyszerre.** A ⓘ `title` attribútuma miatt a böngésző saját, „Súgó: …” feliratú buboréka is feljön a mi buborékunk fölé. | biztos: kódból | mind |
| B9 | **Telefonon kicsi az érintési cél.** A ⓘ 28×28 px, az [ADR-140](adr/140-button-system.md) érintési mérete 44 px. | biztos: mért | mind |
| B10 | **A beállítás példája és magyarázata szétválik.** A beállítások buborékában nincs magyarázó mondat (`withSummary: false`), mert az a választó alatt áll. A helycsinálás viszont ezt a mondatot 289–399 px-rel lejjebb tolja: a buborékban csak egy kód és „A(z) 2. és 3. sor cseréje” marad, a magyarázat a képen kívül. (2. kép) | biztos: mért | 1 |
| B11 | **A háttérben érkező újrarajzolás becsukja a nyitott buborékot.** Az [ADR-136](adr/136-background-render-keeps-open-menu.md) a menüket nyitva tartja, a ⓘ-t kifejezetten kizárja. | valószínű: kódból, nem mért | mind |
| B12 | **A buborék „Kipróbálom” gombja nem mondja meg, mit tesz.** Lecseréli a mostani forrást és beállításokat, és a Kód lépésre visz (visszavonható). A gomb a kimenetel alatt, behúzva, külön sorba törik. | biztos: kódból és képről | 1, 6 (példás témák) |
| B13 | **„A(z)” a szövegben.** A névelő a számból kiszámítható („A 2. és 3. sor”, „Az 5. sor”). Ugyanez a leletek „Ugrás a(z) 2. sorra” feliratában. | biztos | példás témák, leletek |

Rendben működik:
- Escape bezár, és a fókusz a ⓘ-ra tér vissza.
- Egyszerre egy buborék van nyitva.
- Bezáráskor a helycsinálás eltűnik.
- Egyik szélességen sincs vízszintes görgetés.
- A súgóoldal linkje új lapon a témához visz.

## Két terv („design it twice”)

1. **A helycsinálás foltozása gazdatípusonként.** Rácssornál a teljes sor nyúlna meg, fejlécnél a fejléc egésze, szövegközi ⓘ-nál a sor, és a hiányzó gazdák felkerülnének a listára. **Elvetve, mert:**
   - minden új ⓘ-hely új szabályt kérne;
   - a kezelt vezérlő továbbra is 300–400 px-rel elugrana;
   - a magas buborék továbbra is a ragadós sáv alá kerülne.

   A hibák többsége (B2, B3, B4, B7, B10) magából a helycsinálásból jön.
2. **Lebegő réteg, eltolás nélkül (választott).**
   - **A buborék a felső rétegben (`popover`) nyílik, a ⓘ-hoz igazítva.** Semmit nem tol el, és a ragadós sávok fölött van.
   - **Elhelyezés:** alá nyílik, ha ott elfér; különben fölé. A magassága legfeljebb a rendelkezésre álló hely, a többi a buborékon belül görgethető.
   - **Bezárul** Escape-re, külső kattintásra, és ha a fókusz kilép belőle. Ez utóbbi miatt a buborék alatt álló vezérlő soha nem kap fókuszt takarva (WCAG 2.4.11).
   - **WCAG 1.4.13:** a buborék a felhasználó kattintására nyílik, bezárható, és nem tűnik el magától.
   - **A felelősség** egy modulba kerül (`toggletip.ts`), amely elrejti az elhelyezést, a bezárási okokat és az újrarajzolás utáni visszanyitást. A hívók továbbra is csak `renderInfo(...)`-t írnak.

## Feladatok és sorrend

**T1 Lebegő réteg** (B2, B3, B4, B7, B10, B11):
- `renderInfo`: `<button popovertarget>` és `<div popover>` a `details` helyett; a téma neve a buborék első sora.
- Új modul: `toggletip.ts` (helyzet, átfordítás, magasságkorlát, görgetés és átméretezés követése, bezárás a fókusz kilépésekor).
- A `TIP_HOSTS` és a margó-helycsinálás törlése; az `installMenus` nem foglalkozik a ⓘ-val.
- `continuity.ts`: a nyitott buborék a témája (`data-help`) szerint visszanyílik háttér-újrarajzolás után; előtérbeli rajzolásnál bezárul.
- Az ADR-135 `COVERED_BY_BUBBLE` tesztje új jelentést kap: nem a takarást tiltja, hanem azt, hogy takart vezérlő fókuszt kapjon.
- Az akadálymentességi kapu a nyitott buborékot külön vizsgálja, az oldalt csukott buborékkal (az ADR-ben indokolva).

**T2 Elhelyezés és tartalom** (B6, B10, B12, B13; a B5 a T1-ben javult, mert az új jelölésben ott a ⓘ ki sem nyílt volna):
- **Környezetsor:** a ⓘ a „Bemenetek:” címke mellé kerül.
- **Szabálytípusok (B6):** az árva ⓘ megszűnik; a magyarázó bekezdés végére „Részletek a súgóban ↗” link kerül.
- **Példák mérete:** a buborékban legfeljebb 8 soros kódpélda szerepel. Hosszabbnál a buborék a mondatot és a „Példa és kipróbálás a súgóban ↗” linket mutatja. Ezt egységteszt őrzi a témák listáján. A súgóoldal változatlanul a teljes példát adja, és a példák motoros ellenőrzése (`help-examples.test.mjs`) nem változik.
- **„Kipróbálom” (B12):**
  - a felirat „Kipróbálom a Kód lépésben”;
  - a buborékban egyszer egy sor: „A mostani forrást és beállításokat lecseréli; visszavonható.”;
  - a kimenetel és a gomb egy sorban áll (rács).
- **Névelő (B13):** egy `article(n)` segéd (a / az a szám kiejtése szerint: 1, 5, 50–59, 500–599, 1000–1999 → „az”) egységteszttel. Minden „a(z)” erre cserélődik a súgóban és a leleteknél.

**T3 A ⓘ gomb és a kapu** (B1, B8, B9, a teljes lista ellenőrzése):
- A címke és a ⓘ köze 6 px, a ⓘ fókuszkerete 1 px-re a gombtól, így a keret nem ér a címkéhez.
- A `title` attribútum törlése (az akadálymentes név az `aria-label`).
- Durva mutatón 44×44 px-es találati terület egy álelemmel, az elrendezés változása nélkül. A ⓘ sziluettje (kerekített) a D4 része marad.
- **Új böngészős kapu (`toggletips_everywhere`):**
  - a hét hely mindegyikén, asztalon és telefonon, világos és sötét témában;
  - nyitás után a környező elemek legfeljebb 1 px-et mozdulnak;
  - a buborék a ragadós sávokon kívül, a képen belül áll, vagy belül görgethető;
  - a fókuszkeret nem metszi a címkét;
  - Escape, külső kattintás és Tab-kilépés bezár, a fókusz visszatér;
  - nincs vízszintes görgetés és natív `title`-buborék;
  - háttér-újrarajzolás után a buborék nyitva marad.

  A kaput **először a mai állapotra kell megírni, és ott buknia kell** (B1–B9), utána jön a javítás.
- **Lezárás:**
  - ADR-141, CHANGELOG, a jegyzékben NY-39 lezárva;
  - `check:all`, `build:pages`, `test:browser:all`;
  - push a mainre, utána a CI és a Pages telepítésének megvárása.

**Sorrend:**
1. T1, T2 és T3 a gombrendszer (D1–D6) **előtt**: ezek a tanárt ma akadályozó hibák, a gombrendszer pedig áttervezés.
2. A ⓘ kerekített sziluettje és a buborék sarka a D4-ben dől el, a T3 találati területére építve.

## Nem része

- A súgótartalom átírása, a 8 sornál hosszabb példák rövidítése kivételével.
- Lebegő súgó egérmutatóra: a ⓘ kattintásra nyílik, egérmutatóra nem.
- A súgóoldal elrendezése.
