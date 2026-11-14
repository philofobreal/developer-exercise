# ADR-154 – A gyakorló lista fája: tananyagjegyzék a katalógus mellett, lenyíló ágak egy oszlopban (G3)

Állapot: **elfogadva** (2026-11-14). A [közös terv](../terv-korpusz-es-verziok.md) G3 lépése. A felhasználó a bemutató után döntött: „jóváhagyom az A változatot és a 2–5. ajánlást, mehet a G3”. Kockázati osztály: megjelenítés, katalógus (szerver és Local Demo bekötés). A mag, a szerzői elemzés és a szabályverzió nem változott.

## Kontextus

- **A lista eddig szint szerint csoportosított** (Kezdő, Közepes, Haladó; [ADR-101](101-exercise-levels.md)). 16 feladatnál ez elég; a tervezett 64-nél (JavaScript, TypeScript, RxJS) a lista áttekinthetetlen lenne.
- **A bemutató két változata:** A (lenyíló ágak egy oszlopban: témakör, alatta modul, alatta feladat) és B (témakörfülek, a modulok lapos csoportok).
- **A mérés a B ellen szólt:** három fül felirata (JavaScript 32, TypeScript 24, RxJS 8) az asztali oldalsávban összeért; a 64 feladattal a JavaScript-fül listája 2605 px magas, az A-é egy nyitott modullal 1444 px.

## Döntés

- **A lista a tananyag fája (A változat):** témakör, alatta modul, alatta a feladatok tanítási sorrendben.
  - Egy ág gomb, amely nyit és csuk (`aria-expanded`); a végén az alatta álló feladatok száma. A témakör a lista harmadik szintű címsora, a modul a negyedik.
  - **A csukott ág a tartalmát nem rajzolja ki.**
  - **Mikor nyitott egy ág:** ha az olvasó megnyitotta; ha becsukta, csukott. Amihez nem nyúlt, az akkor nyitott, ha a nyitott feladatot tartalmazza, vagy ha a listát szűrő szűkíti (a szűkített lista rövid, és amit talált, annak látszania kell).
  - Az olvasó választása az oldal életéig tart; újratöltés után a fa úgy áll, ahogy megnyílik.
- **A szint szövegként áll a listaelemen** a jelvények után („· Közepes”); a csoportosítást a fa vette át (2. ajánlás). Szint szerinti szűrő nincs.
  - **A fában a listaelem nem írja ki a verziószámot** (NY-60, a felhasználó jóváhagyta 2026-11-14-én). A tanuló a szint alapján választ, nem a kiadás száma alapján; a kettő együtt nem fért ki két jelvény mellé. Fa nélküli listában a verziószám marad.
  - **A feladat 14 px-rel áll beljebb a modulja alatt,** és **a nyitott feladat nyila a címe mellett áll,** a sor folyásán kívül: a címkesor így a nyitott elemben is ugyanolyan széles, mint a többiben.
- **A fát a tananyagjegyzék adja** (`curriculum/curriculum.json`): témakörök, moduljaik, egy modul feladatai sorrendben. Nem a feladat mondja meg, hol áll.
  - Ugyanaz a feladat önállóan is megáll, exportálva és importálva is; egy modul átnevezése nem kér új kiadást egyetlen feladattól sem.
  - **A 16 szállított feladat helye** (4. ajánlás): JavaScript – Alapok (5), Gyűjtemények (5), Algoritmusok (2); TypeScript – Ráhangoló (4).
- **Amit a jegyzék nem nevez meg:**
  - az a feladat a fa végén, a „További feladatok” ágban áll, a lista saját sorrendjében;
  - ha a jegyzék a lista egyetlen feladatát sem nevezi meg (vagy nincs jegyzék), a lista úgy áll, mint eddig: szint szerint csoportosítva;
  - a szerző saját előnézetei a fa után, külön csoportban állnak, mint eddig.
- **A jegyzék a listával együtt töltődik** (5. ajánlás), külön kérésben: a szerveren `GET /api/curriculum`, a Local Demóban a kiadott feladatok mellé másolt `examples/curriculum.json`. Ha nem érhető el, a lista fa nélkül áll.
- **A katalógus betöltése nem változott.** A [refaktorterv](../terv-munkafelulet-refaktor.md) T1.2 lépése a párhuzamos példatöltést valósítja meg. A build időben előre ellenőrzött katalógus (a lista egy kérésben, a feladatok megnyitáskor) akkor kerül elő, ha a 64 feladattal az indulás párhuzamosan is lassú; ezt a G6 szállítási döntése előtt mérni kell.

### Ami ebben a lépésben nincs (3. ajánlás)

- **„Előtte: …” (mire épít egy feladat):** a 16 feladat között nincs kijelölt előfeltétel; kitalálni pedagógiai döntés lenne. Az első valódi adat a G5 leckéivel jön, a jegyzék akkor kap ilyen mezőt.
- **Megoldott jel:** tárolt haladás kell hozzá; az az NY-57.

## Két terv („design it twice”)

Hol áll a tudás arról, hogy egy feladat hova tartozik:
1. **Mezők a feladatban** (`series`, `order`). Elvetve már a közös tervben: a modulok címe és sorrendje minden feladatban megismétlődne.
2. **A katalógus rakja rá a helyet minden listaelemre** (a kliens nem lát jegyzéket). Elvetve: a sorrend a lista sorrendjébe rejtőzne (rejtett kapcsolat), a szabály típusos modulban csak a magban állhatna (a szerver és a Local Demo közös típusos kódja), és minden későbbi jegyzékadat (előfeltétel, leckeszöveg) újabb mező lenne a listaelemen.
3. **A jegyzék változatlanul megy a klienshez, és egy headless modul rendezi (választott).** A szerver és a Local Demo csak továbbadja a fájlt; minden tudás egy modulban áll.

Hogyan nyit és csuk egy ág:
1. **`<details>` és a nézet folytonossága** (a nyitott állapot a DOM-ban él, kirajzolás előtt kiolvasva). Elvetve: a folytonosság kulcsa feladatonként más, így feladatváltáskor az olvasó által megnyitott ágak elvesznének.
2. **Gomb és állapot (választott):** az olvasó választása az állapotban áll, a nyitottságot a headless modul számolja; a csukott ág tartalma nem is kerül a DOM-ba.

## Tervezési review (docs/design-review.md)

- **A `curriculum` modul elrejti** a jegyzék alakját és azt, mi marad ki egy hibásból; azt, hogy a lista egy feladata hol áll; hogy mely ágak látszanak, hány feladattal; és hogy mikor nyitott egy ág. Interfésze három függvény: `readCurriculum`, `curriculumTree`, `toggleBranch`. Headless: a K1 listán áll, böngésző nélkül tesztelt.
- **Kitervezett hibák:** a hibás jegyzék nem dob, hanem ami benne rossz, az kimarad (azonosító vagy cím nélküli ág, ismételt azonosító, kétszer megnevezett feladat: az első helye érvényes); az ismeretlen feladatazonosító nem látszik; a jegyzékből kimaradt feladat nem vész el.
- **A `fields` modul rajzol:** az ág egy új mezőfajta a meglévő hierarchikus nyilvántartásban. A lista ugyanazzal a szűrt készlettel rajzolja a fát, amellyel a szűrő számol.
- **Az állapot egy helyen áll** (`state.curriculum`, `state.branches`), a vezérlő írja.
- **A katalógus csak cső:** a `catalog.mjs` beolvassa és továbbadja a fájlt, a `publish-examples.mjs` a kiadott feladatok mellé írja. Szabály nincs bennük.
- **design, rögzítve:** a `public/ui.js` (régi JS) három bekötő sorral bővült, a `pages-api.js` egy letöltő függvénnyel; szabály egyikben sincs.
- **A kapu tanulsága (első futás: 1 piros a 17-ből):** a Local Demo jegyzékolvasását először a megjelenítési modulba tettem (közvetlen letöltés a főszálon). Az architektúra-kapu megfogta: a megjelenítés egyetlen átviteli kapuja a szerver-API adaptere. A letöltés a Local Demo motorjába került, a háttérszál mögé, mint a feladatlistáé.
- **design, rögzítve:** új felső szintű mappa (`curriculum/`). A G5 ide teszi a leckék csomagjait; az [NY-40 terv](../terv-typescript-tananyag.md) jegyzéke ezzel a fájllal egyesül.
- **design, rögzítve:** az ág lenyomása a megjelenített állapotot (`aria-expanded`) olvassa ki, és azt fordítja meg; a vezérlő így nem számolja újra a fát. A régiós kirajzolásnál (Refaktor F4) ez Intent lesz.
- **A mutációs próba tanulsága:** a csukott ág tartalmát két helyen is kihagytam (a mezők építésekor és a kirajzoláskor); az egyik fölösleges volt, kikerült. Az NY-60-nál a cím és a nyíl távolságát nem őrizte teszt; bekerült.
- **A markup-szerződés** egy új művelettel bővült (`branch`).

## Bizonyíték

- **Headless egységteszt** ([curriculum.test.mjs](../../tests/curriculum.test.mjs), 13 teszt): a jól formált és a hibás jegyzék olvasása; a fa sorrendje, darabszámai, a kimaradó üres ágak; a „További feladatok” ág és a fa nélküli lista; a nyitottság három szabálya és az olvasó választásának elsőbbsége; a rajzolt jelölés (gomb, címsorszint, `aria-expanded`, `aria-controls`, a csukott ág üres); a szint a listaelemen; a szűkített lista számai; a saját előnézetek; az escape-elés; **eltérés-teszt** (mind a 16 szállított feladat pontosan egyszer áll a jegyzékben, és a jegyzék mást nem nevez meg); a szerver és a Pages-build viszi a jegyzéket.
- **Böngészős teszt** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py), `curriculum_tree`, a szerveren és a Pages-builden): a megnyíló fa; a csukott ág nem rajzol; az ág nyit, csuk és megtartja a fókuszt (egérrel, Enterrel, szóközzel); feladatválasztás után a nem érintett ág követi a nyitott feladatot; a kézzel becsukott témakör csukva marad; újranyitva a moduljai úgy állnak, ahogy maradtak; újratöltés után minden a kezdeti; telefonon a fa a lista görgetődobozában áll, az ág 44 px magas érintési cél, feladatválasztás után a lista összecsukódik.
- **A szűrő esete** (`technology_filter`) a fához igazítva: a darabszámok az ágakon állnak; szűrés alatt minden talált ág nyitott; a szűrés feloldása után a fa úgy áll, ahogy az olvasó hagyta.
- **Mutációs ellenőrzés:** 13 visszarontás a lefordított és a bekötött fájlokon; 12-t megfogtak a tesztek (az olvasó választása nem számít, a szűrő vagy a nyitott feladat nem nyit, egy feladat kétszer állhat, a maradék elvész, fa megnevezett feladat nélkül, a lenyomás nem fordít, nincs szint az elemen, a fa nem rajzolódik, a lenyomás nem csinál semmit, a szerver nem adja a jegyzéket, az oldal nem olvassa be). A túlélő a fölösleges feltétel volt; kivétele után a megmaradt helyet a teszt megfogja.
- **NY-60:** az egységteszt rögzíti, hogy a fa eleme nem ír verziószámot (a fa nélküli lista igen); a böngészős eset azt, hogy a nyíl a folyáson kívül áll, a nyitott elem címe nem ér alá, a címkesor a nyitott és a többi elemben ugyanott kezdődik és ugyanaddig érhet, a behúzás 14 px. Négy visszarontás, mind megbukik.
- **Valódi képernyőképek** a megvalósított fáról (asztal, sötét téma, telefon; a munkamenet jelentésében).

## Korlát

- **A címkesor asztalon egysoros, kis tartalékkal; keskeny oldalsávban a két jelvényes elemé kétsoros.**
  - Az első változatban (verziószámmal, 20 px-es behúzással, a nyíllal a sorban) a két jelvényes elem 87 px magas lett a korábbi 68 helyett. Az NY-60 után asztalon (239 px-es oldalsáv) mind a 16 elem címkéje egysoros (51 vagy 68 px).
  - A leghosszabb címke („TS 2.0 ES2018 · Közepes”) 170 px-t kér, és 178 px áll rendelkezésére: **8 px a tartalék.** Más gép betűtípusa ezt elviheti; akkor a szint új sorba törik, semmi nem romlik el. A teszt ezért két jelvény mellett megenged egy második sort.
  - 1024 px széles képernyőn (203 px-es oldalsáv) a két jelvényes elem címkéje kétsoros marad (28 px hiányzik); az egy jelvényeseké ott is egysoros lett.
  - Az ajánlásom („verziószám el, kisebb behúzás”) önmagában nem lett volna elég: a nyitott elemben a nyíl 24 px-t vett el a sorból. A mérés mutatta meg; ezért került a nyíl a cím mellé.
- **A soha nem érintett ág a nyitott feladatot követi:** ha az olvasó egy modult kézzel megnyit, majd másik témakörből választ feladatot, az előző témakör (amelyhez nem nyúlt) becsukódik; újranyitva a kézzel megnyitott modul nyitva áll.
- **A csukott ág feladatait a böngésző oldalon belüli keresése nem találja meg.**
- **A fa a szállított tananyagé.** A szerző saját feladatainak fába rendezése és a tanulónak szóló leckeszöveg az NY-57.
