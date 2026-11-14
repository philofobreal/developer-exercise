# ADR-143 – Vizuális irány: lecsapott lap minden feliratos gombon, lágy felületek

Állapot: **elfogadva, megvalósítás folyamatban** (2026-11-13; a bemutatót a felhasználó jóváhagyta: „jóváhagyom, mehet a D2”; a D2, a D3, a D3b és a D4a kész, lásd lent). **A lap arcát és a vágott sarok alakját és technikáját a D3b felülírta** (a „Döntés” két pontja: átmenet, vonal, árnyék; `corner-shape`). A felhasználó egy saját gombmintát mutatott („Rounded Industrial Buttons”, CleanActive 02.1), és a három, valódi felületen kipróbált változat közül a harmadikat választotta: „mehet a 3. változat, a panelek is lágyuljanak”. Kockázati osztály: megjelenítés. Módosítja az [ADR-140](140-button-system.md) sziluett-szabályát (a lecsapott sarok ott csak a döntés gombjaié volt) és az [ADR-138](138-three-surfaces.md) szögletes sarkait; a három felület és a gombkomponens szerkezete marad.

## Kontextus

- **A minta:** minden gomb lecsapott bal felső és jobb alsó sarkú lap, finom függőleges átmenettel, hajszálvonallal és lágy árnyékkal; 50 px magas (a kompakt 44, a lépéslap 65 px), a felirat 12 px, 760-as súllyal. A lapot gombonként egy SVG rajzolja JavaScripttel.
- **Mérés a valódi felületen** (1366×650 px, Próba lépés, prototípus a szállított stíluslapra töltve):

  | Változat | A lista kezdete | Látható lista |
  | --- | --- | --- |
  | 1. ma (az ADR-140 D1 után) | 247 px | 320 px |
  | 2. a minta minden gombon, a saját méreteivel | 281 px | 301 px |
  | 3. lecsapott sarok minden feliratos gombon, a mai sűrűséggel | 247 px | 320 px |

- **A 2. változatban** egy képernyőn 40 sorgomb is árnyékos lapot kapott, a kód mellett.

## Döntés

- **Minden feliratos gomb lecsapott lap:** az eszközsor, a fejléc eszközei, a menügombok, a módváltó, a lépéslapok és a fő műveletek.
  - A vágás a gomb magasságát követi (a magasság 28%-a a két vágott sarkon, 14%-a a másik kettőn): 36 px-en kb. 10 és 5 px, a lépéslapon 18 és 7 px.
  - A lap: finom függőleges átmenet, hajszálvonal, lágy árnyék. Sötét témában árnyék helyett világosabb felső él.
  - A sűrűség a mai: 36 px (érintésre 44), a fő művelet 44 px, a lépéslap 58 px. A minta 50, 44 és 65 px-es méretei nem.
- **Ikon- és sorgomb:** kerekített. Az ikongomb ugyanazt a lapot kapja, a sorgomb lapos marad.
- **Kitöltés:** egy képernyőn legfeljebb két teli lap van: az aktuális lépés és a fő művelet (a sárga „Ellenőrzés” vagy a kék). A módváltó kiválasztott fele halvány lap, kék vonallal és a 2 px-es jellel, nem teli kék.
- **Bekapcsolt állapot:** a halvány lap mellett megmarad a 2 px-es jel (az ADR-140 D1 szerint). A mintában a bekapcsolt gombot csak egy halványabb árnyalat jelezte.
- **Az állapot nem gomb:** a minősítés, a jelvények és a címkék pirula alakú, lapos címkék; a minta színkészlete rájuk kerülhet, de gombnak nem látszhatnak.
- **Összetartozó választók** (Forráskód | CodeLine JSON, Vizuális | JSON): egy kerekített csoport, benne a kiválasztott rész kis lap.
- **Lágy felületek:** a lépés kerete 12 px, a panel 10 px, a betét 8 px, a lebegő felület 12 px sugarat kap; a mezők 8 px-et. A kód mögé nem kerül díszítő átmenet.
- **Tipográfia:**
  - a gombfelirat 13 px, 600-as súlyú marad (a minta 12 px, 760-as felirata kisebb és tömörebb);
  - olvasnivaló szöveg legalább 12 px (ma sok az 11 px-es);
  - a kód asztalon 13 px, telefonon 12 px.
- **Technika:** CSS `corner-shape`, JavaScript és gombonkénti SVG nélkül (az ADR-140 indoklása áll). Ahol a böngésző nem ismeri (ma a Safari és a Firefox), ugyanaz a gomb a vágás helyén kerekítést kap: a forma aszimmetriája megmarad.

## Három terv

1. **Az ADR-140 szerint: lecsapott sarok csak a döntés gombjain.** A felhasználó a mintát választotta; a prototípus megmutatta, hogy a vágás 36 px-en is tiszta.
2. **A minta minden gombon, a saját méreteivel.** Elvetve: a lista 34 px-rel lejjebb kezdődik és 19 px-rel kevesebb látszik belőle, a sorgombok lapjai a kód mellett zajt adnak.
3. **Lecsapott sarok minden feliratos gombon, a mai sűrűséggel (választott).** A forma a mintáé, a hely a kódé.

## Bemutató (prototípus, 2026-11-13)

A jelölt stílus a szállított stíluslapra töltve, a valódi felületen: Kód, Elemzés és szabályok, Próba, Gyakorlás; világos és sötét téma; 1366×768 px és telefon (390×844 px); külön a `corner-shape` nélküli megjelenés.

- **Akadálymentesség:** az axe 16 nézetben (négy lépés × két téma × két méret) 0 hibát talált a jelölt stílussal.
- **Ismert durvaságok a prototípusban** (a megvalósítás dolga):
  - telefonon a felirat nélküli gombok is vágott sarkot kaptak; a szabály szerint kerekítettek lesznek;
  - telefonon a kártyasor számoszlopa kilóg a kerekített sorból;
  - 13 px-es kódnál a hosszú sor vége gyakrabban kerül a sorgombok alá, ha a szabálypanel nyitva van.

## Megvalósítás (az NY-37 új lépései, a bemutató jóváhagyása után)

- **D2:** a lap minden feliratos gombon; szerepek (teli, sárga, bekapcsolt, letiltott); módváltó és lépéslapok; a régi ferde és lecsípett szabályok megszűnnek.
- **D3:** lágy felületek és mezők; az állapotcímkék pirulaként.
- **D4:** választócsoportok, ikon- és sorgombok, a ⓘ és a „Kipróbálom” gomb; tipográfia.
- **D5–D6:** változatlanul a telefonos összevont menük és a lezárás.

Minden lépés külön push, `npm run gate` után ([ADR-142](142-fast-deploy-and-local-gate.md)).

## D2: a lap minden feliratos gombon (2026-11-13)

- **Egy lapszabály** (`public/style.css`, „the plate”) adja az alakot, az arcot, a szerepeket és az állapotokat az eszközgomboknak, a menügomboknak, a módváltónak, a lépéslapoknak és a fő műveleteknek. A régi ferde módváltó, a lecsípett sarkú fő művelet és a lépéslapok külön szabályai, valamint a `--cut` és a `--skew` token megszűntek.
- **Az alak a hely magasságát követi:** a vágás a `--control-h` (a lépéslapon a saját `--plate-h`) 28, illetve 14%-a. Mért értékek: 36 px-en 10 és 5 px, a 44 px-es fő műveleten 12 és 6 px, az 58 px-es lépéslapon 16 és 8 px.
- **Felirat nélküli gomb kerekített.** Ahol egy szabály elrejti a feliratot (keskeny fejléc, telefon, fekvő telefon), ugyanott `--plate-cut:0` áll: ez az egyetlen kapcsoló a két alak között.
- **Szerepek:**
  - teli kék: a lépés fő művelete és az aktuális lépés;
  - sárga: a tanuló „Ellenőrzés” gombja;
  - bekapcsolt (a kapcsolók és a kiválasztott mód): halvány lap, kék vonal, 2 px-es jel;
  - letiltott és zárolt lépés: egy tompa, lapos lap, árnyék nélkül.
- **A fő művelet 44 px magas** (a többi gomb 36 px). Fekvő telefonon 40 px marad, mint a szomszédai: 44 px-rel a fókusz mód listái a 360 px-es képernyő 40%-a alá estek volna (143 px a 144 helyett).

### Két terv az alak kapcsolására („design it twice”)

1. **Két tulajdonság a felirat nélküli helyeken** (`--plate-r` és `--plate-corners`). Elvetve: hat helyen kellett a kettőt együtt beállítani, és az egyik kihagyása fél alakot adott.
2. **Egy kapcsoló (`--plate-cut`, választott):** a sugár és a sarokforma ugyanabból a számból számol, ezért fél állapot nincs.

### Tervezési review (docs/design-review.md)

- **A lapszabály elrejti** a vágás arányát, a sarokformát, az arc átmenetét és árnyékát, a szerepek színeit és a letiltott megjelenést. **A hívó** (egy hely szabálya) a magasságot adja meg, és azt, hogy van-e látható felirat.
- **design, rögzítve:** a felirat elrejtése és a `--plate-cut:0` két külön deklaráció ugyanabban a szabályban; a CSS nem tudja a látható feliratból levezetni. Az elrendezés-kapu minden nézetben méri, hogy a felirat nélküli lap kerekített, a feliratos vágott.

### Eltérés a tervtől és maradék

- **A választócsoport kiválasztott része még teli kék** (Forráskód | CodeLine JSON, Vizuális | JSON). Emiatt a Kód és az Elemzés lépésben három teli kék elem látszik, nem kettő. A csoport a D4-ben kap új alakot; a „legfeljebb két teli lap” szabályt a kapu addig a Próba és a Gyakorlás nézetben méri.
- **A menü tételei is lapok** (a bemutató szerint); telefonon 44 px magasak.
- **A lépéslap vágása 16 és 8 px,** nem a bemutató kézzel beírt 18 és 7 px-e: a lépéslap is a közös arányt követi, külön szám nélkül.

### Bizonyíték

- **Elrendezés-kapu** ([browser-layout.playwright.py](../../tests/browser-layout.playwright.py)), 6 képernyőméret × 2 téma × 4 nézet:
  - minden feliratos lap vágott (a magasság 28 és 14%-a, lágy sarokkal, ahol a böngésző ismeri), minden felirat nélküli kerekített;
  - minden lapnak arca van (átmenet);
  - legfeljebb két teli lap áll a képernyőn;
  - a bekapcsolt gomb és a kiválasztott mód jelet visel.
- **Állapotok** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py), `button_states`): a lapnak átmenete és árnyéka van, a letiltott lapos.
- **Mutációs ellenőrzés:** a sarokforma törlése, az ikongomb és a telefonos módváltó kapcsolójának törlése, a lapos arc, egy harmadik teli lap és a jel törlése mind megbuktatja a kaput.
- **Javított mérés:** a „legfeljebb két teli lap” ellenőrzés először a teljes arcot hasonlította össze, és nem vette észre a harmadik teli lapot, amíg az egér egy lépéslapon állt. Most az arc záró színét veti össze a márkaszínekkel.

## D3: lágy felületek, mezők, állapotcímkék és választócsoportok (2026-11-13)

A felhasználó döntése: „jóváhagyom, mehet a D3 a választócsoportokkal együtt”. A választócsoportok a D4-ből kerültek előre, mert a D2 után a Kód és az Elemzés lépésben a kiválasztott részük volt a harmadik teli kék elem.

- **A három felület sarka token** (az [ADR-138](138-three-surfaces.md) egy-egy szabályában): a lépés kerete 12 px, a panel 10 px, a betét 8 px, a lebegő felület 12 px. A mező 8 px, a kis doboz (`--radius`: kódrészlet, szabály hozzáadása, megerősítés, kártyasor) 6 px.
- **Két doboz bekerült a panelek közé** (Vizsgálati és Elemzési beállítások, Tanulói adatok és kiadás); a saját keretük és hátterük megszűnt.
- **A listapanel egy lekerekített doboz két részben:** a címsor felül, a lista alul kerekített. A címsor színes csíkja a címsor saját háttere lett (eddig a cím `::before` eleme volt), így a sarok magától levágja.
- **Az értékelősáv** a panel sarkát kapja, és a színes blokkját a sarokra vágja.
- **Az értesítések** (Local Demo, piszkozat, elavult modell, szünetelő szerkesztés) a betét sarkát kapják; a 4 px-es csíkjuk a sarokkal fordul.
- **A sor szabályainak panelje** kerekített; fiókként (keskeny képernyőn) szögletes marad, mert a képernyő szélén áll.
- **Az állapot pirula:** az állapotcímke, a szabályjelvény, a minősítés, a „Publikálható” és a Preview Validation jelvény, a zárolt beállítás címkéje. Lapos: nincs árnyéka és átmenete, így nem nézhető gombnak. A nyelv jelvénye (JS, TS) szögletes maradt: azonosító, nem állapot.
- **A választócsoport** (Forráskód | CodeLine JSON, Vizuális | JSON) egy kerekített csoport, akkora, mint a mellette álló gombok. A kiválasztott rész kis lap a bekapcsolt gomb arcával (halvány lap, kék vonal), a többi lapos. Érintésre egy rész a csoport teljes magasságában válaszol. A 2 px-es jel itt nincs: a kiválasztott részt a kerete és a lapja különbözteti meg, nem csak a színe.
- **Kártyanézet (telefon, tablet):** a kártya belül akkora, mint egy sor, a kerete ezen felül van (érintésre 46 px a korábbi 44 helyett); az első része a kártya sarkát követi. Eddig a keret a belsejéből vett el 2 px-t, ezért a fogantyú és a számoszlop a kártya alján és sarkán kilógott.
  - **Első változat, visszavonva:** a fogantyút a kártya belsejéhez igazítottam (42 px). A kapu két böngészős sora megbukott rajta, mert az érintési cél 44 px alá esett.
- **Megszűnt** a D1 átmeneti szabálya (a választócsoport két szélső gombjának kerekítése) és egy halott szabály (`.mode-switch button.active`), amelyet a lapszabály már a D2-ben felülírt.

### Két terv a sarkok tisztán tartására („design it twice”)

1. **Minden lekerekített doboz levágja a tartalmát** (`overflow:clip` a felületek szabályában). Elvetve: a fókuszkeretet, a lebegő súgót és a vízszintesen görgethető kódsort is levágná; a kártyasoron a hosszú kódsor vége eltűnne.
2. **A doboz csak ott vág, ahol a tartalma a széléig ér** (értékelősáv, listapanel, folyamatjelző), **máshol a belső elem követi a sarkot** (címsor, kártyafogantyú) (választott). Hogy egy új elem ne lógjon ki észrevétlenül, a kapu minden nézetben méri.

### Tervezési review (docs/design-review.md)

- **A felületszabályok elrejtik** a sarok méretét is (eddig a keretet és a hátteret); egy komponens szabálya nem ír sarkot. A címkék, a mezők és az értesítések sarka szintén egy-egy szabály; a komponensek saját `border-radius` sorai megszűntek.
- **design, rögzítve:** a `.panel-title` és az utána álló `.ide-pane` két doboz, amely együtt ad egy lekerekített panelt; a kapcsolatuk egy szomszéd-szelektor (`.panel-title+.ide-pane`). Egy közös burkoló elem tisztább volna, de a nézetmodulokat érintené.
- **design, rögzítve:** a kapu felületlistája megismétli a stíluslap listáit. Egy új felületet mindkét helyre fel kell venni; a kapu így azt bizonyítja, hogy a felsoroltak sarkát későbbi szabály nem írja felül (az ADR-138 előtt ez volt a hiba).

### Bizonyíték

- **Elrendezés-kapu** ([browser-layout.playwright.py](../../tests/browser-layout.playwright.py)); a Kód és az Elemzés lépés is bekerült, így 6 képernyőméret × 2 téma × 6 nézet:
  - minden felület a tokenje szerinti sarkot viseli;
  - lekerekített sarokban nem áll szögletes elem (minden nézetben, az oldal teljes hosszában);
  - az állapotcímke lapos pirula;
  - a választócsoport akkora, mint a szomszédos gombok, egy kiválasztott része van, csak annak van arca, és minden része a csoport széléig válaszol;
  - legfeljebb két teli lap áll a képernyőn, most már a Kód és az Elemzés lépésben is.
- **Mutációs ellenőrzés:** tíz rontás, mind megbuktatja a kaput:
  - az értékelősáv vágásának törlése; a címsor csíkja újra szögletes gyerekelemként; a kártyafogantyú sarkának törlése (szögletes elem a sarokban);
  - egy panel sarkának későbbi felülírása; a mezők szabályának törlése (felület a sarka nélkül);
  - szögletes jelvény (nem pirula);
  - a kiválasztott rész arc nélkül; a rész csak önmagán válaszol (választócsoport);
  - a kiválasztott rész teli kék, kétféleképpen (harmadik teli lap a Kód lépésben).
- **Egyszeri pixelmérés** (nem része a kapunak, mert képolvasó könyvtárat kívánna): 58 nézetben minden lekerekített doboz sarokpixelét összevetettem a környezetével. A felületeken nem talált eltérést. A kapu a `::before` és `::after` rajzot nem látja; ezt a mérés fedte le.
- **Képernyőkép-összevetés:** 15 nézet, világos és sötét téma, asztal és telefon, a változtatás előtt és után.

### Maradék

- ~~Telefonon, a szerző Próba lépésében a sor végi ikonok egy esetben a kód fölé kerültek.~~ **Helyesbítés (D4a):** ez nem a termék hibája volt, hanem a mérésé. Csak a teljes oldalas képernyőképen jelenik meg: a rögzítés idejére kiesik az érintőképernyő-emuláció, és a sorgombok egy képkockára előjönnek. Ugyanannak az állapotnak a látható képernyős képén és a számított stílusban a sorgombok rejtve vannak.
- **A súgóbuborék ⓘ gombjának nyitott állapota szögletes;** a D4 tárgya.

## D4a: a többi gomb, a fókuszkeret, a távolságok (2026-11-14)

A felhasználó jóváhagyta a lépést („jóváhagyom, mehet a D4a, az eltérések maradjanak”), és közben egy képet küldött a „Formázás” gombról: „remélem ezek a képen látható furcsa hoverek és a gombok közti távolságok is majd javulni fognak valamikor”. A képen két hiba látszott; mindkettő bekerült ebbe a lépésbe.

- **A fókuszkeret követi a lapot:** 3 px széles gyűrű, 2 px-re a laptól, a letöréssel együtt. Eddig körvonal (`outline`) volt, azaz lekerekített téglalap, amely a letört saroknál elállt a gombtól. A gyűrű a vonal rétegében készül; ha a lapnak vonala is van (bekapcsolt, letiltott), fókuszban mindkét gyűrű a fókusz színét kapja. A kényszerített színek, a `shape()` nélküli böngésző és a dolgozó lap megtartja a körvonalat.
- **A szerkesztő eszközei 6 px-re állnak egymástól.** A „Formázás”, a másolás és a beillesztés eddig összeért (0 px): a csoportnak nem volt saját elrendezése, és amíg az ikongombok keret nélküliek voltak, ez nem látszott.
- **Egy régi szabály rámutatáskor szegélyt rajzolt a „Formázás” köré** (`.editor-tools button.labeled-tool:hover`): téglalap alakú vonal a letört lap körül. Megszűnt a csoport többi régi keretszabályával együtt.
- **A „veszély” szerep visszakerült:** a szabályt eltávolító gomb halványpiros lap sötétpiros felirattal. A D2 óta a lapszabály felülírta a régi piros hátteret (nyugalomban szürke volt, rámutatva piros téglalap jelent meg mögötte); ezt akkor nem vettem észre, mert egy teszt sem nézte.
- **A nem-lap gombok is lágyak:** az alap gomb sarka 6 px (eddig 0), így az „Ugrás … sorra” gombok és a sorgombok is kerekítettek. A feladatlista sora a csíkja felől egyenes marad.
- **A ⓘ kör:** rámutatva és nyitva kör alakú a kiemelése (eddig négyzet volt).
- **A „Kipróbálom” kis lap:** a buborékban gomb, a súgóoldalon hivatkozás (`a.btn`); mindkettő ugyanaz a lap, kis méretben.

### Tervezési review (docs/design-review.md)

- **A lapszabály most a fókuszkeretet is elrejti;** a hívó semmit nem állít hozzá. A gyűrű a körvonal két eltolt példánya (5 és 2 px-rel kijjebb), ugyanabból a sarokleírásból.
- **design, rögzítve:** a `::before` most három dolgot szolgál (vonal, fókuszgyűrű, forgó jel). A szabályok sorrendje dönt: a forgó jel mindent kizár, a fókusz a vonalat magába foglalja. Negyedik szerepet már ne kapjon.
- **design, rögzítve:** a hivatkozás-lap (`a.btn`) a gombok alapstílusát (kurzor, elrendezés) a közös vezérlőszabályból kapja; a `button` elemre írt régi szabályok rá nem vonatkoznak.

### Bizonyíték

- **Elrendezés-kapu** ([browser-layout.playwright.py](../../tests/browser-layout.playwright.py)):
  - egy csoport egy sorban álló lapjai legalább 4 px-re állnak egymástól;
  - egyetlen gombnak sincs szögletes sarka (kivétel a sor fogantyúja és a feladatsor csík felőli oldala);
  - billentyűvel elérve a lap fókuszkerete a lapot követi: a vonal nélküli lapon egy gyűrű, a vonalason kettő; a körvonal ki van kapcsolva.
- **Állapotok** (`button_states`): a fő művelet, az ellenőrzés és az eltávolító művelet mindegyikének saját arca van, és a felirata legalább 4,5 : 1 arányban elüt tőle.
- **Mutációs ellenőrzés:** hét rontás, mind megbuktatja a megfelelő tesztet: összeérő eszközök; szögletes sima gombok; szögletes ⓘ; a körvonal vissza a lapra; egy gyűrű a vonalas lapon; az eltávolító gomb arc nélkül; az eltávolító gomb halvány felirattal.
- **Közeli képek** mindkét témában: a fókuszban álló „Formázás”, a kiválasztott mód fókuszban, a nyitott ⓘ, az eltávolítás megerősítése, a sor szabályai, a súgóoldal „Kipróbálom” gombjai.

## Újranyitva: a lap arca és a vágott sarok alakja (2026-11-13, D3b előtt)

A felhasználó az éles felületet látva két döntést kifogásolt:

- **Az arc:** „a gradiensek a gombokban nagyon 2000-es évek dizájn. nem tetszik. találd ki a modern változatukat.”
- **A vágott sarok:** „a gombok lecsapott bal felső és jobb alsó részei sem jól vannak kerekítve”, pontosítva: „chrome-ban láttam és rendes, arányos kerekítés legyen a két lecsapott saroknál, azaz sarkanként két kerekítés legyen, ami a szögeknek megfelelően kanyarodik”.

Mit jelent ez a döntésekre:

- **A „finom függőleges átmenet” megszűnik;** a D3b bemutatóján legalább három átmenet nélküli arc közül választ a felhasználó.
- **A `corner-shape` nem tudja a kért alakot.** A kérés valódi ferde letörés, amelynek mindkét csúcsa külön kerekített; a `superellipse` egyetlen ívet rajzol, a `bevel` csúcsa éles. A „Technika” pont (CSS `corner-shape`, SVG nélkül) ezért újra eldöntendő a D3b-ben: a kivágott forma a keretvonalat, az árnyékot és a fókuszkeretet is érinti.
- **Ami nem változik:** minden feliratos gomb lap, a sűrűség, a szerepek (teli, sárga, bekapcsolt, letiltott), a felirat nélküli gomb kerekítése.

## D3b: a lap új arca és a letörés két kerekített csúccsal (2026-11-13)

A felhasználó a bemutató négy arca és két sarokváltozata közül választott: „jóváhagyom, mehet a 2. sarok és az C arc”. (A javaslatom az A arc volt, vékony vonallal; a döntés a felhasználóé.)

- **Alak (2. sarok):** a bal felső és a jobb alsó sarok valódi ferde letörés, mindkét csúcsán külön ívvel; a másik két sarok kerek. Minden a lap magasságát követi: a letörés a magasság 30%-a, a csúcsok kerekítése 24%-a, a kerek sarkok 22%-a. A felhasználó saját mintájának rajzolóját követi (ott minden csúcs külön ívet kap), CSS-ben.
- **Arc (C):** egyetlen sík tónus. Nincs átmenet, vonal és árnyék.
  - alap: halványszürke; rámutatva egy árnyalattal sötétebb;
  - teli kék (fő művelet, aktuális lépés) és sárga (Ellenőrzés): sík szín;
  - bekapcsolt: halványkék arc, kék vonal és a 2 px-es jel;
  - letiltott: üres lap hajszálvonallal és tompa felirattal.
- **Technika:** a lap az arcának kivágása (`clip-path: shape()`), mert szegély nem tudja követni a letörést. Az arc a felirat alatti réteg (`::after`), nem maga a gomb: a gombra tett kivágás a fókuszkeretet is levágná. A gomb átlátszó szegélyt tart, amelyet a kényszerített színek (Windows nagy kontraszt) kirajzolnak.
- **Egy körvonal mindkét alakra:** minden sarok két görbe egy 45 fokos él körül. Hosszú éllel és rövid görbékkel letörés; ha a két görbe összeér, kerek sarok. A felirat nélküli gomb (`--plate-cut:0`) így ugyanabból a szabályból kerekített téglalap.
- **A vonal** (bekapcsolt, letiltott) gyűrű az arc alatt (`::before`): a körvonal és az egy képponttal beljebb futó körvonal különbsége. A dolgozó gomb forgó jele ugyanezt a helyet használja, ezért a dolgozó lapnak nincs vonala.
- **A választócsoport** kiválasztott része is sík (halványkék, kék vonal), árnyék nélkül.
- **Megszűnt** a `corner-shape`, az átmenet, a lap árnyéka és a hozzájuk tartozó hét token, valamint a lépéslap két régi díszítő szabálya (`.step.current::after`).

### Eltérés a bemutatótól

- **A letiltott gomb nem halvány tónus, hanem üres lap hajszálvonallal.** A bemutató előtt jeleztem, hogy a C arcban a letiltott gomb világos témában szinte eltűnik; a körvonal bármilyen háttéren (oldal, menü) látszik. Egy sorral visszaállítható, ha a felhasználó a tónust kéri.
- **A kerek sarkok valódi körívek** (két görbéből); a bemutatón egy görbéből álltak, kissé szögletesebben.
- **Sötét témában a teli kék gomb rámutatva sötétebb lesz, nem világosabb.** Az új kontrasztmérés találta: a világosabb kéken (#4876f7) a fehér felirat 4,03 : 1 volt, a szükséges 4,5 : 1 alatt. Az új szín #1f4fd6. A hibát eddig semmi nem mérte, mert az átmenetes háttéren az axe nem számol kontrasztot.

### Három terv a rajzolásra („design it twice”)

1. **`corner-shape`** (a D2 megoldása). Elvetve: a `bevel` csúcsa éles, a `superellipse` egyetlen ív; a kért alakot egyik sem adja.
2. **Gombonkénti SVG és JavaScript** (a minta megoldása). Elvetve, ahogy az [ADR-140](140-button-system.md) is: minden kirajzolás után újra kellene rajzolni, és a gomb mérete nélkül nincs alak.
3. **`clip-path: shape()` egy rétegen (választott).** Tiszta CSS, a gomb méretét követi. Ára: az arc pszeudoelem, ezért az axe nem látja a gomb hátterét (lásd lent).

### Tervezési review (docs/design-review.md)

- **A lapszabály elrejti** a körvonal geometriáját (a sarkonkénti három hosszt és a két alak közti átmenetet), a rétegeket, az arc és a szerepek színeit. **A hívó** változatlanul a magasságot adja meg, és azt, hogy van-e látható felirat (`--plate-cut:0`).
- **design, rögzítve:** a körvonal háromszor áll a stíluslapban (az arc, a gyűrű külső és belső köre), egyenként kb. 1400 karakter. A CSS-ben nincs mód egy alakot paraméterrel újrahasználni; a három példányt egy segédszkript írta, a magyarázat a szabály fölött áll.
- **design, rögzítve:** a `::before` két gazdát szolgál (a vonal gyűrűje és a dolgozó gomb forgó jele). A szabály kizárja az ütközést (`:not([data-busy-shown])`), de a kettő nem látszhat egyszerre.
- **design, rögzítve:** az axe a pszeudoelemmel rajzolt hátteret nem látja, ezért a lapok feliratának kontrasztját nem ítéli meg. Az elrendezés-kapu ezt maga méri (lent).

### Bizonyíték

- **Elrendezés-kapu** ([browser-layout.playwright.py](../../tests/browser-layout.playwright.py)), 6 képernyőméret × 2 téma × 6 nézet:
  - a feliratos lap körvonala letörés (a magasság 39,94%-ánál kezdődik a bal oldalon), a felirat nélkülié kerek;
  - a lap arca egy sík tónus: van színe, nincs átmenete és árnyéka;
  - a felirat legalább 4,5 : 1 arányban elüt az arcától, minden látható lapon; és szerepenként is, nyugalomban és rámutatva (hét pár, mindkét témában);
  - legfeljebb két teli lap; a bekapcsolt lapnak vonala és jele van; a választócsoportnak egy kiválasztott része.
- **Állapotok** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py), `button_states`): a lap sík; a letiltott üres, vonallal, mindkét fajtája egyforma; a dolgozó nem látszik letiltottnak és nincs vonala; a bekapcsoltnak más arca, vonala és jele van.
- **Mutációs ellenőrzés:** tizenkét rontás, mind megbuktatja a megfelelő tesztet:
  - ikongomb letöréssel; kisebb letörés (rossz körvonal);
  - átmenet az arcon; árnyék a lap alatt (nem sík arc);
  - sötét tónus sötét felirat alatt; a régi rámutatási szín sötét témában (kontraszt);
  - bekapcsolt gomb jel nélkül; harmadik teli lap; a választócsoport kiválasztott része háttér nélkül;
  - letiltott gomb arccal; bekapcsolt gomb vonal nélkül; átmenet minden lapon (az állapotteszt).
  - Két rontást elsőre rosszul írtam meg (az egyik hatástalan volt, a másikra egy másik ellenőrzés bukott előbb); kijavítva mindkettő a saját ellenőrzésén bukik.
- **Akadálymentességi sor** (axe): 0 hiba; a lapok kontrasztját a fenti mérés fedi.
- **Képernyőkép-összevetés:** 15 nézet, világos és sötét téma, asztal és telefon, a változtatás előtt és után.

## Rögzített maradék

- **Régebbi böngészők** (Chrome és Edge 135 előtt, Safari 18.4 előtt, Firefox a `shape()` megérkezése előtt) a letörés helyett lekerekített téglalapot mutatnak (D3b). A D3b előtt a vágott sarok csak Chromium-alapú böngészőben látszott.
- **A minta állapotszínei gombként** (zöld, sárga, piros, türkiz, lila lap) nem kerülnek be: a felületen ezek jelzések.
