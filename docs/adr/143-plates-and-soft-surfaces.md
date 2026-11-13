# ADR-143 – Vizuális irány: lecsapott lap minden feliratos gombon, lágy felületek

Állapot: **az irány elfogadva, a megvalósítás a bemutató jóváhagyására vár** (2026-11-13). A felhasználó egy saját gombmintát mutatott („Rounded Industrial Buttons”, CleanActive 02.1), és a három, valódi felületen kipróbált változat közül a harmadikat választotta: „mehet a 3. változat, a panelek is lágyuljanak”. Kockázati osztály: megjelenítés. Módosítja az [ADR-140](140-button-system.md) sziluett-szabályát (a lecsapott sarok ott csak a döntés gombjaié volt) és az [ADR-138](138-three-surfaces.md) szögletes sarkait; a három felület és a gombkomponens szerkezete marad.

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

## Rögzített maradék

- **Safari és Firefox** a vágás helyett kerekítést mutat, amíg a `corner-shape` nem érkezik meg; az iPades tanulók így látják.
- **A minta állapotszínei gombként** (zöld, sárga, piros, türkiz, lila lap) nem kerülnek be: a felületen ezek jelzések.
