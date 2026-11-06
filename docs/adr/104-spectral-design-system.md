# ADR-104 – Spectral dizájnrendszer: két téma, egy tokenrendszer, helyi betűk

Állapot: **elfogadva** (2026-11-06), a 2., 3. és 5. pontot, valamint a ferde gombok és a sötét paletta sorát az [ADR-105](105-mock-character-and-calm-layout.md) felülírja. A felhasználó egy HTML-mockot („CodeLine / Spectral White”) adott át. A kérése: a következetlenségeit találjuk meg és javítsuk, a javított dizájn szerint alakítsuk át a felületet, és legyen sötét mód. A felhasználó korábbi irányelve: a látványterv ne határozza meg a funkciókat. Kockázati osztály: megjelenítés. Ez az átalakítás első szakasza (F1); a témaváltó (F2), az információs architektúra (F3), a Fókusz mód és a kódnézetek (F4), valamint a böngészős hibajavítás (F5) külön szakasz.

## A mock elemzése

**Átvett elemek:**
- fehér „papír” felület, halvány háttérrel;
- egyetlen erős kék kiemelőszín;
- szögletes geometria, tiszta 1 px-es vonalak;
- egyetlen hangsúlyos fő művelet;
- tömör visszajelző sáv;
- a sorsűrűség ötlete (F4).

**Nem átvett elemek (következetlenségek):**

| Következetlenség | Javítás |
| --- | --- |
| Vegyes nyelv: RESET, CHECK, DRAG MODE, „insert line” a magyar felületen | csak magyar felirat |
| Ütköző színjelentések: a piros egyszerre hiba és díszítés (a cím melletti négyzet, a megoldás-sáv jelölője), sőt az „i” infósáv is piros; a sárga egyszer fő gomb, máskor semleges visszajelzés | kék a kiemelés; piros csak a hiba (`--d`); sárga csak a figyelmeztetés (`--w`); cián a „megelőzi” szabály (`--i`) |
| Hármas navigáció ugyanarra a három nézetre (ikonsáv, oldalsáv, lépéssor), eltérő nevekkel | egy navigáció (F3) |
| Működés nélküli „IDE-díszlet”: fájlfül ×-szel, „+” új lap, értesítés piros ponttal, profil, `⑂ main*`, „Ln 3, Col 12”, „✓ 0 errors” | nem vesszük át, mert valótlan állapotot mutat (F3) |
| Holt kód: kb. 8 rejtett elem, dupla „Ellenőrzés” gomb | nincs megfelelője |
| Következetlen lépésjelölés („✓ 01 · Forrás” és „03” + „Próba”) | egységes lépésjelölés (F3) |
| A sorsűrűség kapcsolója fogaskerék ikont kapott | a kapcsoló a kódnézetnél (F4) |
| Három betűcsalád, csupa nagybetűs széles display-betű; a kód 11 px; 8–9 px-es feliratok, egy helyen kb. 2,5:1 kontraszttal | két betűcsalád; legkisebb méret 11 px |
| Google Fonts: a CSP (`'self'`) tiltja, offline nem működik | helyi betűk (OFL) |
| Ferde gombok (`clip-path`), amelyek levágják a fókuszkeretet | szögletes, ferdítés nélkül |
| Mindig teljesen fedő sorvégi gombok, hosszú soron a kódra lógva | a korábbi döntés marad: halványak, hoverre élesek (F5) |
| Dupla állapotjelzés rögzített soron (tiltott fogantyú és lakat) | egy jelzés (F5) |

## Döntés

1. **Tokenrendszer két témára** ([style.css](../../public/style.css), első sorok):
   - **A skálák neve a lépés:** `--n` semleges, `--a` kiemelő, `--i` info, `--w` figyelmeztetés, `--d` hiba, `--v` lila. A `NN` lépés a háttértől mért távolság, ezért egy komponens mindkét témában ugyanazt jelenti.
   - **Sötét téma:** világosság ≈ NN%, a korábbi obsidian palettából.
   - **Világos téma:** szakaszonként lineáris görbe. A felületek közel fehérek (8 → `#ffffff`), a keretek a mock nyomtatott vonalaihoz hasonlók (24 → kb. 87%), a szöveg közel fekete (92 → kb. 7%). A semleges skála telítettsége a sötét téma 45%-a.
   - **A komponensek** csak ezeket a tokeneket és a szemantikus réteget (`--bg`, `--surface`, `--text`, `--muted`, `--accent` …) használják. A korábbi `--navy`, `--cyan`, `--blue`, `--amber`, `--red` és `--violet` nevek megszűntek.
   - **A beégetett árnyék- és tónusszínek** `color-mix` és egy témánkénti `--shadow` lett.
2. **Kiemelőszín:** mindkét témában kék (hue 224). Világosban `--a-60` (`#063bcc`), sötétben `--a-66`, mindkettőn `--a-10` felirattal. A korábbi cián a „megelőzi” szabályjelölés színe lett, így nem ütközik a kiemeléssel.
3. **Témaválasztás:**
   - alapértelmezésben a rendszer beállítása (`prefers-color-scheme`);
   - a `data-theme="light"` vagy `"dark"` attribútum felülírja;
   - a `<meta name="color-scheme" content="light dark">` mindkettőt engedi.

   A kapcsoló és a megjegyzett választás az F2 feladata.
4. **Tipográfia:**
   - **Inter** (felület) és **JetBrains Mono** (kód), változtatható súlyú woff2, latin és latin-ext részhalmaz (a magyar ő és ű a latin-extben van), helyben kiszolgálva: `public/vendor/fonts`, OFL-1.1, a `sync-vendor.mjs` a pontos npm-csomagból másolja;
   - a szerver a `font/woff2` típust kiszolgálja;
   - **legkisebb betűméret 11 px** (a korábbi 7–10 px-es feliratok 11 px-re nőttek);
   - **nincs programozói ligatúra:** a `>=` `>=` marad, az `=>` `=>`, mert a feladat a kód pontos szövegéről szól. Ez a lap egyetlen `!important`-ja: a komponensek `font` rövidítése a `font-feature-settings`-et visszaállítja (CSS Fonts 4), öröklés tehát nem elég.
5. **Geometria:** egy kis lekerekítés (`--radius: 3px`) panelekre, vezérlőkre és címkékre; a kör alakú elemek maradnak.

## Mérés

WCAG-kontraszt (szöveg 4,5:1-től):

| Pár | Sötét | Világos |
| --- | --- | --- |
| szöveg / háttér | 15,35 | 18,78 |
| halvány szöveg / háttér | 8,47 | 8,70 |
| halvány szöveg / kiemelt felület | 6,85 | 8,04 |
| kiemelőn álló felirat | 5,33 | 8,23 |
| kiemelő szöveg / felület | 9,82 | 16,62 |
| kulcsszó (`--i-78`) / felület | 11,75 | 8,59 |
| sztring (`--w-72`) / felület | 10,22 | 6,68 |
| figyelmeztetés / figyelmeztető tónus | 9,66 | 10,22 |
| hiba / hiba tónus | 11,42 | 16,74 |
| fókuszkeret / háttér (3:1-től) | 5,74 | 11,02 |

Böngészőben, három méretben (1 440 × 900, 1 280 × 720, iPhone 13) és mindkét témában:
- a betűk mindkét részhalmazzal betöltődnek;
- nincs 11 px alatti szöveg;
- nincs vízszintes kilógás;
- nincs JavaScript-hiba.

Az axe-készlet mindkét témában 0 hibát ad minden nézetben (asztali gép és telefon). A sötét témát egyszer, ideiglenes másolattal futtattuk; a sötét téma állandó gépi kapuja az F2 része.

Az első axe-futás egy valódi hibát talált: a „JS” fájljelvény világos témában 3:1-es volt (`--w-56` háttér, `--n-10` felirat). **Szabály:** egy kitöltés és a rajta álló felirat ne a skála közepéről (kb. 36–64) vegye a lépést, mert ott a két téma nem fordul tisztán. A jelvény ezért tónusos lett (`--w-20` háttér, `--w-80` felirat), a TypeScript-jelvény ugyanígy (`--n-20`, `--n-84`). A kiemelő gomb párját témánként választjuk (2. pont). Más ilyen pár nincs a lapon (gépi keresés).

## Tervezési review (ADR-037)

- **Tulajdonos:** a témák tudása a stíluslap első soraiban él (skálák és szemantikus réteg). A komponenses szabályok téma nélkül íródnak, ezért egy új téma egy skálablokk.
- **Design twice:**
  - *Szemantikus tokenek minden komponensre* (`--panel-bg`, `--row-hover` …, kb. 80 új név): elvetve. A lépésnevek már most a szerepet írják le (távolság a háttértől), és a két téma közti megfeleltetés egy függvény, nem 80 egyedi döntés.
  - *Tiszta világosság-megfordítás a világos témában:* elvetve. Mérve a kiemelt felületek sötétebbek lettek a háttérnél, és a felület szürke, nehéz lett; a papírfehér görbe ezt javítja.
  - *A mock betűi Google Fonts-ról:* elvetve. A CSP és az offline működés miatt csak helyi betű jöhet szóba; a display-betű (Exo 2) a csupa nagybetűs zaj miatt kimaradt.
