# ADR-105 – A mock karaktere és egy nyugodtabb felület: formák, kék–sárga, grafit sötét téma, témaváltó

Állapot: **elfogadva** (2026-11-06). Az ADR-104 2., 3. és 5. pontját és a „nem átvett” táblázat két sorát (ferde gombok, sötét paletta) felülírja.

A felhasználó visszajelzése az F1 után:
- a ferde és a lecsípett sarkú gombok a dizájn részei;
- a kék és a sárga világos nézetben pontosan annyira legyen markáns a gombokban és a keretekben, mint a mockban;
- a sötét nézet ne kékes színezetű legyen;
- a felület túlzsúfolt, ezért egyszerűsíteni és összevonni kell.

Kockázati osztály: megjelenítés. Ez az átalakítás F2 (témaváltó) és F3 (információs architektúra) szakasza.

## Kontextus

- **Ferde gombok:** az ADR-104 elvetette őket, mert a mock `clip-path`-szal vágja a formát, és ez a fókuszkeretet is levágja. Ez az ok a megvalósításra vonatkozott, nem a formára.
- **Kék és sárga az F1 után:** a kék sötétebb lett (`#063bcc`), a sárga csak figyelmeztetés volt. Világos nézetben ezért szinte nem maradt szín.
- **Sötét téma:** a régi, kékes „obsidian” semleges skálára épült (hue 212, telítettség kb. 35%).
- **Zsúfoltság:** egy képernyőn hármas navigáció volt (útvonalsor, projektkártya, lépéssor), hamis fájlfülek és állapotsorok, külön tippkártya és állapotsor, valamint hat egyforma súlyú gomb a forrás megnyitására. Telefonon kb. két képernyőnyi keret volt a kód előtt.

## Döntés

1. **Formák (a mock geometriája, levágott fókuszkeret nélkül):**
   - A módfülek (Feladat készítése / Gyakorlás) `transform: skewX(-14deg)`-gel dőlnek, a tartalom visszadől. A keret és a fókuszkeret a formát követi.
   - Az erős műveletek (`.primary`, az aktív lépés) jobb alsó sarka 13 px-en le van csípve. A forma háttérátmenet (`linear-gradient(315deg, …)`, `background-origin: border-box`), ezért a fókuszkeret teljes téglalap marad.
   - Nincs `clip-path`, és nincs `::before` sem: a foglalt gomb pörgője a `::before`-t használja.
   - A többi gomb szögletes, a mock vonalvastagságával. Hoverre a mock kék körvonalát kapja.
   - Telefonon a módfülek egyenesek (a mock is levágás nélkül mutatja őket).
2. **Kék és sárga a mock arányában** (márkatokenek: `--blue`, `--yellow`, `--blue-pale`, `--yellow-pale`, `--accent-text`):
   - **kék `#0649f8`:**
     - az aktív módfül, az aktív lépés, a választott szegmens és a fő továbblépő gomb;
     - a fejléc bal sávja, a márkajel és a szakaszcímek négyzete;
     - a forráslista jelölője és a kiválasztott feladat széle;
     - az elfogadott eredmény sávja.
   - **sárga `#ffd900`:**
     - az egyetlen Ellenőrzés gomb;
     - a nyelvjelvény (JS/TS);
     - a megoldáslista jelölője;
     - a kiválasztott feladat jelvénye;
     - a várakozó eredménysáv (a mock visszajelző sávja).
   - **piros:** a mock díszítő pirosa továbbra is kimarad, mert nálunk a piros a hiba (ADR-104). Ahol a mock pirosat díszítésre használt (a megoldássáv jelölője), ott sárga áll.
3. **Grafit sötét téma:**
   - a semleges skála `hsl(222, 6–7%, NN%)`, közel színtelen, és a lépések távolsága ugyanaz, mint eddig;
   - a kék csak kiemelés: kitöltésre `#2f63f5` fehér felirattal, szövegre `#86a8ff`;
   - a sárga ugyanaz, mint világosban.
4. **Témaváltó** (`src/workbench/theme.ts`):
   - **Váltás:** egy gomb a fejlécben, sorrendje Rendszer → Világos → Sötét. A felirata az aktuális választás, az akadálymentes neve a következőt is megmondja.
   - **Tárolás:** a választás `localStorage`-ba kerül (`ngdynamic.theme.v1`, try/catch), a Rendszer a kulcsot törli.
   - **Villanásmentes betöltés:** a `theme-boot.ts` klasszikus szkript a `<head>`-ben, a stíluslap előtt. Az első festés előtt beállítja a `data-theme`-et. Modul nem lehet, mert a böngésző a modult elhalasztja. A kulcsot a `tests/theme.test.mjs` köti össze a modullal.
5. **Információs architektúra (kevesebb, de minden megmarad):**
   - **Egy navigáció:** a lépéssor. Megszűnt az útvonalsor, a projektkártya, a tippkártya és az alsó állapotsor. Ezek tartalma a címsor egy sorába került: nyelvjelvény, sorok száma és az érvényesítés neve (`.mode-badge`: Preview Validation, Trusted Server Validation, Local Demo).
   - **Munkamenet-menü a fejlécben:** helyi mentés, visszatöltés, fájl export és import. Korábban két helyen és két kártyán voltak.
   - **Forrás lépés:**
     - a cím, a nyelv, a szint és a leírás egy rácsban van;
     - a négy elemzési beállítás lenyitható panel, összefoglalójában az aktuális értékekkel;
     - a forrás megnyitása (példa, fájl, TS tesztfájl, TypeScript-példatár) egy „Megnyitás” menü;
     - a formázás, a másolás és a beillesztés ikongomb a szerkesztő fejlécében.
   - **Próba:**
     - egy eszközsor van: Rendező/Megoldáskód, Visszaállítás, Minta kitöltés;
     - a haladás a Megoldás panel fejlécébe került (számláló és vékony sáv), a nagy haladáskártya megszűnt;
     - nincs hamis fájlfül („snippets.txt”, „solution.js”) és hamis állapotsor („UTF-8”);
     - a billentyűzet-súgó és a használati súgó egy „Súgó” panel lett.
   - **Gyakorlás:**
     - a feladatlista keskeny képernyőn összecsukott feladatválasztó; az összefoglalóban a kiválasztott feladat címe látszik;
     - a lista függőleges, a korábbi vízszintes, levágott sáv helyett.
   - **Fejléc telefonon:** két sor. Fent a márka és három ikongomb, alatta a két módfül.
   - **A Local Demo** (Pages) továbbra is külön sorban mondja ki, hogy nem hitelesített (AGENTS.md).
6. **Menük:** `details.menu` elemek. Külső kattintásra, Escape-re és belső műveletre bezáródnak (`installMenus`); újrarajzoláskor csukva térnek vissza.

## Mérés

WCAG-kontraszt (szöveg 4,5:1-től, fókuszkeret 3:1-től):

| Pár | Világos | Sötét |
| --- | --- | --- |
| felirat a kéken | 6,33 | 4,97 |
| kék szöveg / háttér | 6,33 | 8,14 |
| kék szöveg / halványkék | 5,60 | 6,52 |
| felirat a sárgán | 13,94 | 14,14 |
| szöveg / sárga sáv | 18,39 | 11,57 |
| szöveg / háttér | 18,78 | 15,67 |
| halvány szöveg / háttér | 8,70 | 8,69 |
| fókuszkeret / háttér | 11,02 | 5,85 |

Böngészőben, 1 440 × 900 és iPhone 13 méretben, mindkét témában:
- nincs vízszintes kilógás;
- nincs 11 px alatti szöveg;
- nincs 24 px alatti célterület;
- nincs JavaScript-hiba.

**Hajtás feletti tartalom:**
- 1 440 × 900-on a Gyakorlásban a kód és az Ellenőrzés gomb is látszik görgetés nélkül;
- a szerzői Forrás lépésben a szerkesztő a hajtás felett kezdődik.

**Gépi kapuk:**
- az axe-készlet minden nézetet mindkét témában vizsgál, asztali gépen és telefonon is, a nyitott feladatválasztóval és a munkamenet-menüvel együtt (`tests/browser-a11y.playwright.py`);
- a böngészős tesztek a témaváltást (megjegyzés, újratöltés, első festés előtti alkalmazás) és a menük bezáródását is ellenőrzik.

## Tervezési review (ADR-037)

- **Tulajdonos:**
  - a téma tudása a `theme.ts`-ben él, a nézet csak kiolvassa;
  - a menük bezárási szabálya egy helyen van (`installMenus`);
  - a formák a stíluslap keretrészében vannak, a komponensek a tokeneket használják.
- **Design twice:**
  - *`clip-path` a mock szerint:* elvetve, mert levágja a fókuszkeretet.
  - *`::before` alakzat:* elvetve, mert ütközik a foglalt gomb pörgőjével.
  - *Három gombos témaválasztó (szegmens):* elvetve. A fejlécben három gomb helyét foglalná, a ciklikus gomb a felirattal és a következő értékkel egyértelmű.
  - *A beállítások modális ablakban:* elvetve. A lenyitható panel a helyén marad, az összefoglaló mutatja az értéket, és a továbblépés nem kíván extra lépést.
- **Ami hátravan:**
  - a Fókusz mód és a két kódnézet (F4); ez váltja ki a fejléc teljes képernyős gombját;
  - a maradék böngészős hibák és a gépi elrendezés-kapu (F5).
