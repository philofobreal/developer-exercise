# ADR-143 – Vizuális irány: lecsapott lap minden feliratos gombon, lágy felületek

Állapot: **elfogadva, megvalósítás folyamatban** (2026-11-13; a bemutatót a felhasználó jóváhagyta: „jóváhagyom, mehet a D2”; a D2 kész, lásd lent). A felhasználó egy saját gombmintát mutatott („Rounded Industrial Buttons”, CleanActive 02.1), és a három, valódi felületen kipróbált változat közül a harmadikat választotta: „mehet a 3. változat, a panelek is lágyuljanak”. Kockázati osztály: megjelenítés. Módosítja az [ADR-140](140-button-system.md) sziluett-szabályát (a lecsapott sarok ott csak a döntés gombjaié volt) és az [ADR-138](138-three-surfaces.md) szögletes sarkait; a három felület és a gombkomponens szerkezete marad.

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

## Rögzített maradék

- **Safari és Firefox** a vágás helyett kerekítést mutat, amíg a `corner-shape` nem érkezik meg; az iPades tanulók így látják.
- **A minta állapotszínei gombként** (zöld, sárga, piros, türkiz, lila lap) nem kerülnek be: a felületen ezek jelzések.
