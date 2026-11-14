# ADR-152 – A technológiajelölés a gyakorló listában: jelvények, összesítő szűrő, mondat a cím alatt (G2)

Állapot: **elfogadva** (2026-11-14). A [közös terv](../terv-korpusz-es-verziok.md) G2 lépése. A felhasználó a bemutató után döntött: „jóváhagyom mind a három ajánlást, mehet a G2” (B változat a listára és a szűrőre, A szövege a címsorra, a jelvények nem tesznek külön sort az elem alá, a nyelv neve lekerül a listaelemről). Kockázati osztály: megjelenítés; a mag, a szabályok és az értékelés nem változott.

## Kontextus

- **A jelölés a G1 óta megvan a modellben és a listában** ([ADR-149](149-technology-labels.md)), de a felület nem mutatta.
- **A bemutató két változata:** A (szöveges sor, két választó, külön összesítő tábla) és B (jelvények, az összesítő maga a szűrő).

## Döntés

- **A listaelemen jelvények állnak ott, ahol eddig a nyelv neve állt:** `TS 2.0` `ES2018` · v2. A jelvény vonala a nyelv színe.
  - Az elem nem lett magasabb: a jelvények a meglévő második sorban állnak.
  - A nyelvet a cím előtti négyzet mondja ki (JS, TS); a négyzet a képernyőolvasónak és a `title`-ben a teljes nevet adja.
  - Jelölés nélküli feladaton a nyelv neve marad.
- **A lista fölött minden jelvény ott áll a feladatok számával:** ez az összesítő (miből áll a lista), és egyben a szűrő.
  - Egy jelvény megnyomva a listát rá szűkíti; újra megnyomva elengedi. Egyszerre egy jelvény választható.
  - **„és a korábbi verziók”:** ugyanannak a technológiának a régebbi verziói is megjelennek. Választás nélkül a kapcsoló letiltott.
  - A szintek csoportjai a szűrt listát mutatják a saját darabszámukkal; a kiürült csoport nem látszik.
  - A megnyitott feladat nyitva marad, ha a szűrés kiveszi a listából.
  - A választás az oldal életéig tart; újratöltés után nincs szűrés.
  - **A szűrő a lista része** (a `nav` első eleme), és telefonon a lista saját görgetődobozában áll (a képernyő 60%-a). A nyitott feladatlista így nem lett magasabb, mint a G2 előtt.
- **A cím alatt egy mondat:** „TypeScript 2.0-tól · ES2018-tól · ellenőrizve: TypeScript 5.8”.
  - A „-tól/-től” rag a szám kiejtését követi (2015-től, 2018-tól, 2.0-tól).
  - **„ellenőrizve”** csak TypeScript-feladaton áll: az a TypeScript-kiadás, amely a feladatot a katalógusba vételkor ellenőrizte. A szerveren ez a futó fordító; a Local Demóban a kiadási jegyzék (`publication.json`) mondja meg, mert ott a lista ellenőrzés nélkül töltődik be.
  - A szerző piszkozatán a mért mondat áll, „ellenőrizve” nélkül.
- **A szűrő jelvényének neve a látható szövege és az, amit a szám számol** („ES2015 13 feladat”; a „feladat” szó csak a képernyőolvasónak szól). A technológia nevét a jelvények csoportja viseli (`role="group"`, a látható csoportnévvel megnevezve).
- **A kirajzolás megtartja az ablak görgetését** (régi, most elérhetővé vált hiba javítása):
  - Telefonon a feladatlista csukva rajzolódik, és a nézet folytonossága csak a mérések után nyitja vissza. A mérések ebben a rövidebb állapotban rendezték el az oldalt.
  - Ha az oldal ennél lejjebb volt görgetve, a böngésző levágta a görgetést, majd a lista visszanyitása eltolta: a kirajzolást kiváltó koppintás kattintása egy másik sorra esett (mérve: a felvett sor azonnal le is került a megoldásba, az oldal 611 px-t ugrott).
  - A szűrő első változata (a lista fölött, a görgetődobozon kívül) 177 px-rel magasabbá tette a nyitott listát, így a hiba a kapu telefonos koppintás-tesztjében is megjelent.
  - Javítás: a kirajzolás a saját idejére rögzíti a gyökérelem magasságát, így az oldal közben nem rövidülhet.
  - *Módosítva ([ADR-155](155-workbench-quick-gains.md), T1.5): a rögzítés megszűnt, mert az ok megszűnt (a nyitott részek a mérés előtt nyílnak vissza). A teszt maradt.*

## Két terv („design it twice”)

A szűrő alakjára a bemutató A és B változata; a felhasználó a B-t választotta (egy vezérlő végzi az összesítést és a szűrést).

A jelvények helyére a listaelemen:
1. **Külön sor a cím alatt** (a bemutató B változata). Elvetve a felhasználóval egyeztetve: minden elem egy sorral magasabb lenne, ami a 64 feladatos fánál sok görgetés.
2. **A cím sorában, a cím után.** Elvetve: a címek a keskeny oldalsávban két sorba törnek, a jelvény a tördelést rontaná.
3. **A meglévő második sorban, a nyelv neve helyén (választott).**

A szűrés tudásának helyére:
1. **A nézetben** (`fields.ts`). Elvetve: a verziósorrend és az egyezés szabálya DOM nélkül is tesztelhető tudás.
2. **Külön headless modul (választott):** [technology-filter.ts](../../src/workbench/technology-filter.ts).

## Tervezési review (docs/design-review.md)

- **A `technology-filter` modul elrejti** a jelvény szövegét, a verziók sorrendjét, a lista jelvényeinek és darabszámainak kiszámítását, az egyezés szabályát, a jelvény megnyomásának hatását és a cím alatti mondatot a ragjaival. Headless: a K1 listán áll, böngésző nélkül tesztelt.
- **A `fields` modul rajzol:** jelvények az elemen, a szűrő a lista fölött. A lista ugyanazzal a függvénnyel szűkül, amellyel a szűrő a választást megítéli (`liveFilter`), így a kettő nem térhet el.
- **Kitervezett hiba:** ha a választott jelvény már nincs a listán (más katalógus), az nem üres listát ad, hanem semmit nem szűr.
- **Az állapot egy helyen áll** (`state.technologyFilter`), a vezérlő írja; a DOM-ban nincs másolata.
- **design, rögzítve:** a verziók összehasonlítása két helyen él: a magban ([ADR-149](149-technology-labels.md)) és ebben a modulban. A megjelenítés csak típust importálhat a magból (architektúra-kapu); a függvény öt sor. Ugyanez a helyzet, mint a névelőnél ([ADR-148](148-article-as-it-is-read.md)).
- **design, rögzítve:** a `public/ui.js` (régi JS) két bekötő sorral bővült; a szabály a headless modulban van. A [markup-szerződés](../markup-contract.json) két új művelettel bővült (`technology`, `technology-earlier`).
- **design, rögzítve:** a görgetés megtartása a nézet kirajzolásában áll (két utasítás), mert a kirajzolás tulajdona, hogy a csere közbenső állapotai kívülről nem látszanak. Az elvetett másik terv a folytonosság kettévágása volt (előbb a nyitott részek, a mérések után a fókusz): két hívás kötelező sorrenddel, szélesebb interfész. A gyökérok (a mérések a visszanyitás előtt futnak) megmarad; a régiós kirajzolás (Refaktor F4) szünteti meg.
- **A kapu tanulsága (első futás: 2 piros a 17-ből):** a jelvénygomb `aria-label`-je nem tartalmazta a látható szövegét (axe: `label-content-name-mismatch`), ezért kikerült; a telefonos koppintás-teszt mutatta meg a görgetés hibáját.
- **A kapu tanulsága (második futás: 1 piros a 17-ből):** 390×700-as telefonon a nyitott lista a fölé tett szűrővel magasabb lett a képernyőnél, és az eredménysáv a képernyő alá került. A szűrő ezért a lista görgetődobozába került. A görgetés javítása megmaradt: a hiba a szűrőtől függetlenül létezik, és a teszt most a szűrő magasságától függetlenül éri el (a kirajzolás előtt a csukott listás oldal magasságánál lejjebb görget).
- **A mutációs próba tanulsága:** a vezérlő két fókuszhívása fölösleges volt (a nézet folytonossága a kirajzolás után magától visszaadja a fókuszt), ezért kikerült.

## Bizonyíték

- **Headless egységteszt** ([technology-filter.test.mjs](../../tests/technology-filter.test.mjs)): a jelvény szövege, a verziósorrend, a csoportok és darabszámok, az egyezés mindkét módja, a választás váltása, a rag 15 évszámra és 11 kiadásra; a lista jelvényei, a szűkítés és a csoportszámok, az elavult választás, a szűrő jelölései és akadálymentes nevei, az escape-elés.
- **A listázás** ([technology.test.mjs](../../tests/technology.test.mjs)): a szerver és a Local Demo a négy TypeScript-feladatra megnevezi az ellenőrző fordítót, JavaScript-feladatra nem; a kiadási jegyzék tartalmazza a fordító verzióját.
- **Böngészős teszt** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py), a szerveren és a Pages-builden): a hat jelvény a darabszámával; a jelvények a nyelv neve helyén, egyik elem sem magasabb 72 px-nél; szűkítés és csoportszámok; a fókusz a megnyomott jelvényen és a kapcsolón marad; a nyitott feladat nyitva marad; a korábbi verziók; másik jelvény átveszi a választást; billentyűvel elengedés; a cím alatti mondat TypeScript-, JavaScript-feladaton és a szerző piszkozatán; újratöltés után nincs szűrés.
- **A görgetés megtartása** (ugyanott, `tap_to_place`): telefonon, nyitott feladatlistával, a csukott lista magasságánál lejjebb görgetve a koppintás felveszi a sort, és a görgetés helye nem változik. A javítás nélkül ez a teszt piros.
- **Akadálymentességi vizsgálat:** a lista a jelvényekkel és egy megnyomott jelvénnyel, mindkét témában, asztalon és telefonon.
- **Elrendezés-kapu:** a jelvény lapos pirula, mint a többi állapotcímke.
- **Mutációs ellenőrzés:** 13 rontás a lefordított és a bekötött fájlokon; 11-et megfogtak a tesztek (a korábbi verziók soha vagy mindig egyeznek, az újranyomás nem enged el, a váltás elfelejti a kapcsolót, hibás rag, minden feladat fordítót nevez meg, az elavult választás kiüríti a listát, nincs jelvény, a lista nem szűkül, JavaScript-feladat fordítót nevez meg, a Local Demo nem nevez meg fordítót). Kettő túlélte: a két fölösleges fókuszhívás, amelyek kikerültek.
- **Markup-szerződés és architektúra-kapu:** zöld (az új modul headless).

## Korlát

- **Egyszerre egy jelvény választható;** két technológia együttes szűrése (például TS 2.0 és ES2015) nincs.
- **A szűrés nem marad meg újratöltés után,** és nem része a mentett munkamenetnek.
- **Telefonon a jelvénysor két-három sort foglal** a lista görgetődobozának elején (844 px magas képernyőn a doboz 506 px-éből 177-et); a 64 feladatos fánál (G3) ezt újra meg kell nézni.
