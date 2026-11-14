# ADR-147 – A tanuló az első ellenőrzés után megnézheti a feladat szabályait, ha a szerző engedi (NY-46)

Állapot: **elfogadva** (2026-11-14). Az [ADR-027](027-disclosure-and-author-authorization.md) felfedési politikáját bővíti egy harmadik szinttel. A felhasználó kérése és döntése szó szerint: „a gyakorló példáknál is írjuk ki a kiértékelés negatív részlet eredményeit … és bekapcsolható legyen a sorok függőségének mutatása (szabályok megjelenítése ikon minden sorban)”, majd a javaslat után: „szabálypanel ne jelenjen meg csak úgy magától, hanem bekapcsolható legyen az oktató által. az oktatók kapják meg ezt a beállítási lehetőséget, hogy ők állíthassák feladatonként. mindegyik elkészült és elkészülőben lévő gyakorló feladat kapja meg a szabálypanelt. a gyakorló feladatokban a szabálypanel csak akkor jelenjen meg, ha már legalább egyszer kiértékelést nyomott a tanuló a gyakorló feladatban.” Kockázati osztály: mag (a felfedési politika) és megjelenítés. A validátor döntése és a bizalmi határ nem változott: a tanulói beadást továbbra sem elemezzük és nem futtatjuk, és a tanuló semmit nem küldhet, ami szabállyá válna.

## Kontextus (mérve 2026-11-14-én)

- **A megsértett sorpár kiírása megvolt a magban** (`learnerFeedback: rules`, ADR-027), a szerző feladatonkénti döntéseként. A 16 szállított feladat egyike sem kapcsolta be, és a szerzői felületen nem volt hozzá vezérlő; csak a JSON-ban lehetett beállítani.
- **A teljes szabálygráf szándékosan nem jutott el a tanulóhoz;** az ADR-027 ezt kimondta, és teszt őrizte.
- **A gyakorló feladat listája a sorokat a referencia sorrendjében küldi,** és a gyakorlásban van „Mintamegoldás kitöltése”. A helyes sorrend tehát eddig is elérhető volt; a szabályok azt teszik hozzá, mely más sorrendek helyesek még, és miért köt egy sor egy másikat.

## Döntés

- **Harmadik közlési szint: `graph`.** A feladat `learnerFeedback` mezője rendezett skála: `positions` (alapérték) < `rules` < `graph`.
  - `positions`: a tanuló csak a hibás helyet látja.
  - `rules`: a megsértett szabály két sorát is.
  - `graph`: mint a `rules`, és az értékelés válasza a feladat **szabálylapját** is viszi.
- **A szabálylap** a feladat minden közvetlen szabálya egyszer, sorpárként: melyik sornak kell a másik előtt állnia, és hogy a pár a kód saját szerkezete-e (blokk és sorai). Ok, eredet, kategória és megjegyzés nincs benne; a tranzitív lezárt sincs.
- **„Az első ellenőrzés után” a bizalmi határon teljesül, nem a nézetben.** A szabálylapot csak az értékelés válasza viszi; a feladatok listája soha. Ellenőrzés előtt a böngészőben nincs szabály, amit egy nézet elrejthetne.
- **Egy helyen dől el** (`evaluationDisclosure` a magban): a megbízható szerver és a Pages Local Demo ugyanazt hívja.
- **A tanuló felülete az első ilyen válasz után:**
  - megjelenik a „Sor szabályai” eszköz és minden soron a láncszem gomb; az állapotsor ezt ki is mondja;
  - **semmi nem nyílik ki magától:** a panelt a tanuló nyitja meg;
  - a panel csak olvasható: a kijelölt sor előtt és után kötelezően álló sorok, a kódjukkal megnevezve; a sorok kiemelése és az ívek ugyanazok, mint a szerzőnél;
  - sorszám nincs (az a referencia sorrendjét mondaná meg), ok nincs, szerzői vezérlő nincs (nincs kapcsolatkör, rögzítés, űrlap);
  - érintőképernyőn a kijelölt sor alsó sávja vezet a szabályaihoz;
  - azonos tartalmú soroknál a panel kimondja, hogy azok felcserélhetők.
- **Meddig él:** a feladatra az oldal élettartamáig (az Újrakezdés és a feladatváltás nem törli); újratöltés után újra ellenőrizni kell. Mentett vagy importált munkamenet nem hordozza.
- **A szerző állítja, feladatonként,** a „Tanulói adatok és kiadás” részben („Mit lát a tanuló egy hibás megoldásról?”). Új feladatnál az alapérték `positions`. A beállítás nem igényel újraelemzést: a szerző kéréseivel utazik (előnézet, szabályszerkesztés, forrásból készített piszkozat), és a „Tanulói nézet” azonnal azt mutatja, amit a tanuló kapna.
- **A 16 szállított feladat megkapta a `graph` szintet.** A verziószámuk nem változott: a sorok, a szabályok és az elfogadott megoldások ugyanazok, csak a közlés bővült.

### Ára

- **Ezeknél a feladatoknál az első ellenőrzés után a tanuló minden szabályt lát.** A feladat ettől kezdve gyakorló mód: a szabályok alapján a sorrend összerakható. Számonkérésre szánt feladatnál a szerző hagyja `positions` vagy `rules` szinten.
- **A szállított feladatoknál a megsértett sorpár most megjelenik** a tanuló visszajelzésében („A 4. sornak a 3. sor előtt kell állnia” típusú mondat, a mai szövegezéssel: „A(z) 4. sor a(z) 3. sor előtt kell állnia.”; a névelő az NY-41 tétele).
- **A panel a kód blokkszerkezetéből következő szabályokat is felsorolja** (egy blokk nyitó sora után minden sora). Ezek sokan vannak; „Szerkezeti” címkét kapnak, és az ívük szaggatott.

## Két terv („design it twice”)

1. **A szabálylap a feladat listájával utazik, a nézet rejti el az első ellenőrzésig.** Elvetve: a szabály a böngészőben lenne ellenőrzés előtt, a „csak utána” így csak megjelenítési ígéret volna.
2. **Külön végpont a szabálylapnak, amelyet a kliens az első ellenőrzés után kér le.** Elvetve: a szervernek számon kellene tartania, ki ellenőrzött már (munkamenet-állapot egy állapot nélküli értékelő mellé), vagy a végpont bárkinek válaszolna, és akkor az 1. tervvel egyenlő.
3. **A szabálylap az értékelés válaszának része (választott).** Nincs új végpont és nincs szerveroldali állapot; aki választ kapott, az ellenőrzött.

A mező alakjára: külön logikai mező (`learnerRules: true`) helyett a meglévő `learnerFeedback` skála kapott harmadik értéket, mert a szabálypanel a megsértett pár kiírása nélkül értelmetlen kombináció lenne, és így egy rendezett döntés marad egy helyen.

## Tervezési review (docs/design-review.md)

- **A mag elrejti** a szintek jelentését és azt, mit visz a válasz: `evaluationDisclosure(report, channel, model)` egy hívás a két motorban; a szabálylapot modellenként egyszer számolja ki. A `channelFeedback` megmaradt (a visszajelzés szintje), a hívók már nem azt hívják.
- **learner-rules.ts elrejti,** mikor van a tanulónak szabálya (a válasz hozta, a szemben álló feladatra; szerzői piszkozatnál csak a tanulói nézetben, és csak amíg a modell az, amelyet értékeltek), és mit mond a csak olvasható panel. **Interfésze:** `keepLearnerRules`, `learnerRules`, `renderLearnerRulePanel`, `learnerLineName`.
- **A szerzői szabálypanel (rule-panel.ts) maradt a szerkesztő;** két új kérdést válaszol meg a rajzolóknak: `rulesEditable` (a szerző saját szabályai állnak szemben) és `shownRules` (a kirajzolandó párok, bármelyik olvasónak). A rajzolás (rule-board.ts) így nem tud arról, kié a szabály.
- **Az interfész bővítésének oka (AGENTS.md):** a `Report` kapott egy `rules` mezőt és az állapot egy `learnerRules` tárat; új hívó a vezérlő egy sora (`keepLearnerRules`). Rejtve marad, hogy a lap mikor érvényes és mikor nyitja a panelt (soha).
- **design, rögzítve:** a `public/ui.js` három sorral bővült (a válasz szabályainak megtartása, a szint a szerzői kérések mellett kétszer). Mindhárom bekötés; a szabály típusos modulban van.
- **design, rögzítve:** a `public/app/pages-api.js` kézzel írt modul (NY-28); a három hívás ott is a mag függvényeit hívja, saját szabálya nincs.
- **Első változat, visszavonva:** a szint a szerzői kérés (`authorRequest`) része volt. Három meglévő teszt mutatta meg, hogy az a kérés a forrás elemzéséről szól, és a mezői rögzítettek; a szint most külön utazik mellette (`learnerLevel`).
- **Első változat, visszavonva:** a tanulói modul a hiányos állapotot nem tűrte (a feladatlistát olvasta, mielőtt megnézte volna, van-e megtartott lap); egy meglévő szerzői teszt megbuktatta.

## Bizonyíték

- **Egységteszt, bizalmi határ** ([trust-boundary.test.mjs](../../tests/trust-boundary.test.mjs)): a lista sosem visz szabályt; `graph` szinten a válasz minden közvetlen szabályt egyszer visz, három kulccsal; a visszajelzés szintje `rules`, ok és kategória nélkül; más szinten és ismeretlen értéknél nincs lap; HTTP-n ugyanez, és a beadás saját „szabályai” semmit nem változtatnak. A szint a piszkozaton: forrásból, előnézettel, szabályszerkesztéssel; az alkalmazott modell saját szintje erősebb a kérésénél.
- **Egységteszt, felület** ([learner-rules.test.mjs](../../tests/learner-rules.test.mjs), [task-status.test.mjs](../../tests/task-status.test.mjs)): mikor van szabály és mikor nincs; az első válasz bezárja a panelt, a későbbi nem; a panel tartalma; nincs szerkesztő elem, sorszám, szerzői szöveg; a kód védve van.
- **Böngészős teszt** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py), `learner_rules`), a szerverrel és a Pages builddel: ellenőrzés előtt semmi; utána eszköz és sorgombok, a panel zárva; a panel csak olvasható; Újrakezdés és feladatváltás után megmarad, újratöltés után nincs; a szerző választója, a tanulói nézet követi; a szint túléli a szabályszerkesztést; érintőképernyőn az alsó sáv.
- **Akadálymentességi vizsgálat** ([browser-a11y.playwright.py](../../tests/browser-a11y.playwright.py)): a nyitott tanulói panel a vizsgált nézetek között van.
- **Mutációs ellenőrzés:** huszonegy rontás megbuktatja a teszteket. Az egységteszteket tizenhat: a lap a `rules` szinten is utazik; a lap okot visz; a lap a lezártat viszi; a `graph` a visszajelzésben `positions`; a lista megmondja a szintet; az előnézet, a szabályszerkesztés, illetve a forrásból készült piszkozat nem veszi át a szintet; a kérés felülírja az alkalmazott modellét; a szerző saját ellenőrzése is megtartja a lapot; az első válasz nyitva hagyja a panelt; más modellnél megmarad a régi lap; a szabály a gyakorláson kívül is látszik; a panel sorszámot ír; a tanuló kapcsolatkört kap; a szint nem tanulói adat. A böngészős esetet öt: a válasz szabályai nem maradnak meg; a kijelölt sor sávja kapcsolatot kínál a tanulónak; a szabályszerkesztés, illetve az előnézet nem viszi a szintet; a Pages-motor lap nélkül válaszol.
- **Nem fedi teszt:** a súgóoldalon nincs szócikk az új beállításról; a szállított feladatok panelje csak a legelső feladaton lett böngészőben megnézve (a szabálylapot a mag minden modellre ugyanúgy számolja).
