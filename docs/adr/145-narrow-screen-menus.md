# ADR-145 – Keskeny képernyő: egy fejlécmenü, feliratos eszközök ahol elférnek (NY-37, D5)

Állapot: **elfogadva** (2026-11-14). Az [ADR-140](140-button-system.md) D5 lépése. A felhasználó a bemutató után döntött; a döntései szó szerint: „1. a, 2.b, 3.b”, majd „a teljes képernyő gomb maradjon kint. a többinél is inkább az ajánlásod mentén kellene csinálni”, végül „a menü az sose legyen kiírva”. Kockázati osztály: megjelenítés; a motor, a szabályok és az értékelés nem változott.

## Kontextus (mérve 2026-11-14-én, 390 px széles telefonon)

- **A fejlécben három felirat nélküli ikongomb állt** (munkamenet, téma, teljes képernyő), a szerzői Próba lépésben egy negyedik (tanulói nézet). A témagomb körbejárt a három állapoton, és nem mondta meg, mi következik.
- **Az eszköztáron minden eszköz ikon volt,** felirat nélkül: Újrakezdés, Mintamegoldás kitöltése, Sor szabályai, Fókusz. A felirat csak hosszú nyomásra (title) vagy képernyőolvasóval derült ki.
- **A súgó („Súgó: kezelés és billentyűzet”) a listák alatt áll,** telefonon egy-két képernyővel az eszközök alatt.

## Döntés

- **Egy menügomb a fejlécben (☰), 650 px alatt.** A munkamenet négy sorát és a témát tartja:
  - a sorok ikonnal és teljes felirattal, legalább 44 px magasan;
  - a téma hármas választó (Rendszer, Világos, Sötét): a választás után a menü nyitva marad, a fókusz a választott részen áll;
  - a csoportokat címke nevezi meg (Munkamenet, Megjelenés).
- **A teljes képernyő gomb a menü mellett, kint marad** (a felhasználó döntése).
- **A menügomb mindig ikon, sosem felirat** (a felhasználó döntése). A neve a képernyőolvasónak szól („Menü: munkamenet és megjelenés”, „További eszközök”).
- **A tanulói előnézetben nincs munkamenet,** ezért menü sincs: a témagomb és a teljes képernyő gomb áll ott, mint eddig.
- **Az eszköztáron az eszköz feliratot kap, ahol a sorban elfér.** A sorrend:
  1. a lépés fő eszköze (a szerzői Próbában „Sor szabályai”, a gyakorlásban „Mintamegoldás kitöltése”, a tanulói előnézetben „Fókusz”);
  2. a többi eszköz együtt.
- **Az elférést modul méri** ([toolbar-fit.ts](../../src/workbench/toolbar-fit.ts)), nem töréspont dönti el: a sorban lépésenként és nézetenként más eszköz áll, és a felirat szélessége a telefon betűjétől függ (ugyanez az indok, mint a logónál, [ADR-137](137-logo-fits-measured.md)).
- **A két ritkán kellő eszköz egy ⋯ gomb mögé kerül, ahol kettő van belőlük:** az Újrakezdés és a listák alatti súgóhoz vezető sor. Ez a gyakorlás és a tanulói előnézet (ott áll súgó a listák alatt).
  - A súgósor kinyitja a súgót, a képernyőre hozza, és átadja neki a fókuszt.
- **A szerzői Próba lépésben nincs ⋯ menü:** ott nincs súgó a listák alatt, egy soros menü pedig csak egy koppintással többe kerülne. A négy eszköz marad, a mért feliratokkal.
- **A Fókusz az eszköztáron marad** (a felhasználó döntése).
- **A menü sorai nem lapok:** nincs arcuk, amíg rájuk nem mutatnak; a letiltott sor felirata halvány, vonal nélkül.
- **Bezárt menü sora nem kaphat fókuszt.** Ha egy sor munkája után a kirajzolás bezárja a menüt, a fókusz a menü gombjára kerül ([continuity.ts](../../src/workbench/continuity.ts)). Ez minden menüre igaz, a széles képernyő munkamenet-menüjére is; ott a fókusz eddig elveszett.

### Mért eredmény (a felület saját betűjével)

| Szélesség | Gyakorlás | Szerzői Próba |
| --- | --- | --- |
| 320 px | három ikon | „Sor szabályai” feliratos, három ikon |
| 360 px | „Mintamegoldás kitöltése” feliratos, Fókusz és ⋯ ikon | „Sor szabályai” feliratos, három ikon |
| 390 px | „Mintamegoldás kitöltése” és „Fókusz” feliratos, ⋯ ikon | „Sor szabályai” feliratos, három ikon |
| 600 px | ugyanaz | mind a négy feliratos |

### Ára

- **320 px-en a gyakorlás három eszköze ikon marad:** a fő eszköz felirata 10 px-rel szélesebb a sornál.
- **A szerzői Próbában az Újrakezdés telefonon ikon marad** 600 px alatt.
- **A fekvő telefon** (legfeljebb 500 px magas, 650 px-nél szélesebb) nem változott: ott minden eszköz ikon, a fejlécben a három gomb külön áll.
- **Fekvő kis telefonon** (568×320: keskeny és alacsony egyszerre) a menü magasabb a képernyőnél; a menü ezért legfeljebb a képernyő aljáig ér, és belül görgethető.
- **Az asztali „Munkamenet” gomb felirata megmaradt** 1200 px fölött. A „sose legyen kiírva” döntést a D5 két új menügombjára értettem; ha a munkamenet gombjára is vonatkozik, az egy sor a stíluslapban.

### Útközben talált hiba (a D5 előtt is megvolt)

- **Fekvő kis telefonon a módváltó két felirata egymásba csúszott** (568×320-on a „Feladat készítése” 25 px-rel, a „Gyakorlás” 12 px-rel lógott ki a gombjából). Az ok: a módváltó csoportja összenyomható volt, ezért a fejléc nem lógott ki, és a logó illesztője ([ADR-137](137-logo-fits-measured.md)) nem lépett vissza. A csoport most nem nyomható össze; a logó lép vissza helyette (568×320-on a felirat nélküli logóra).

## Két terv („design it twice”)

A feliratok elférésére:

1. **Töréspontok a stíluslapban** (felirat 360 px fölött, minden felirat 600 px fölött). Elvetve: a gyakorlás fő eszköze 320 px-en 10 px-rel lóg ki, 360 px-en 30 px-rel fér el; más betűvel a határ máshol van, és a szerzői Próba sora mást tart, mint a gyakorlásé.
2. **A logó illesztőjének (header-fit.ts) bővítése az eszköztárral.** Elvetve: a neve és a leírása a fejlécről szól, a lépései és az „elfér” döntése más; a közös rész egy ciklus.
3. **Külön mérőmodul, a döntés a stíluslapé (választott).** A nézet megmondja, melyik eszköz kaphat feliratot és milyen sorrendben; a modul megméri, hány fér el; a stíluslap rajzolja ki.

A menük tartalmára: a bemutató két változata közül (A: ☰ ikon, feliratok ahol elférnek; B: „Menü” felirat, csak ikonok) a felhasználó a fenti keveréket választotta.

## Tervezési review (docs/design-review.md)

- **toolbar-fit.ts elrejti** a lépéseket (minden felirat, csak az első, ikonok) és azt, mit jelent az „elfér” (a sor nem lóg ki, és az eszközök a kódnézet-váltó mellett maradnak). **Interfésze** egy függvény (`installToolbarFit(root)`, a visszaadott illesztés a kirajzolás után fut), a nézet `data-label-rank` jelölése és a modul `data-labels` válasza.
- **A fókusz visszaadása a continuity.ts-ben van,** nem a hívóknál: a vezérlő (`public/ui.js`) nem tud arról, hogy egy eszköz menüben áll-e.
- **Első változat, visszavonva:** a teljes képernyő kapcsolója a fejlécmenü sora volt, és külön függvény (`focusControl`) adta vissza a fókuszt a menü gombjának. A felhasználó döntése után a sor kikerült, a függvény megszűnt.
- **Első változat, visszavonva:** a menük bezárásának szabálya kivételt tett a választócsoportra. A mutációs próba megmutatta, hogy fölösleges: a választás kirajzolja az oldalt, a lecserélt elemre érkező kattintás pedig már nem zár menüt.
- **design, rögzítve:** három mérőmodul figyeli a gyökér méretét (header-fit, list-fit, toolbar-fit), mindegyik saját figyelővel. Egy közös figyelő kevesebb kód lenne, de a három döntés egymástól független; a sorrendjük a kirajzolás után rögzített (fejléc, eszköztár, listák), mert az eszköztár magassága a listák tetejét tolja.
- **design, rögzítve:** a 650 px-es határ két helyen áll: a nézetben (`matchMedia`) és a stíluslapban. Ha az egyik változik, a másikat is igazítani kell; a teszt mindkét oldalt méri (390 és 900 px).
- **design, rögzítve:** a `public/ui.js` két sorral bővült (témaválasztás név szerint, súgósor). Mindkettő bekötés; a szabály típusos modulban van (`theme.ts`, `interactions.ts`).

## Bizonyíték

- **Böngészős teszt** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py)):
  - `header_menu` (390 px, majd 568×320): a fejlécben a menü és a teljes képernyő gomb áll; a menügombon nincs szöveg; négy feliratos sor, legalább 44 px; a témaválasztás után a menü nyitva, a fókusz a választáson; Escape bezár és visszaadja a fókuszt; a teljes képernyő gomb megtartja a fókuszt; mentés után a fókusz a menü gombján; 900 px-en három külön vezérlő, visszaszűkítve újra a menü; a tanulói előnézetben nincs menü; 568×320-on a módváltó feliratai a gombjukban maradnak, a nyitott menü a képernyőn belül ér véget, az utolsó része a menü görgetésével érhető el.
  - `toolbar_menu` (320, 360, 390, 600 px): az eszközök egy sorban, kilógás nélkül; eggyel több felirat már nem férne el; a feliratok a fenti táblázat szerint; a ⋯ gombon nincs szöveg, legalább 44 px; a két sora feliratos; a súgósor kinyitja a súgót, a képernyőn van, övé a fókusz; az Újrakezdés a menüből visszaállítja a próbálkozást, a fókusz a ⋯ gombon; fókusz módban ugyanazok az eszközök; 900 px-en nincs menü és nincs rangsor.
- **Akadálymentességi vizsgálat** ([browser-a11y.playwright.py](../../tests/browser-a11y.playwright.py)): a nyitott ⋯ menü is a vizsgált nézetek között van, világos és sötét témában.
- **Elrendezés-kapu** ([browser-layout.playwright.py](../../tests/browser-layout.playwright.py)): a menü sorai kivételek a lap szabályai alól (nincs letört sarok, nincs arc); a kontrasztjukat a menü hátterén méri.
- **Egységteszt** ([theme.test.mjs](../../tests/theme.test.mjs)): a téma név szerinti beállítása és a körbejárás.
- **Mutációs ellenőrzés:** tizenkilenc rontás megbuktatja a két tesztet: az illesztő mindig ikont, mindig minden feliratot ad, nem nézi a kilógást, kihagyja a középső lépést; a bezárt menü sora megtartja az elveszett fókuszt; a lecserélt elemre érkező kattintás menüt zár; a súgósor nem nyit, nem ad fókuszt, nem hozza a képernyőre a súgót, nincs bekötve; nincs menü keskeny képernyőn; a szélesség átlépése nem rajzol újra; a Fókusz az első rangú; a szerzői Próba is menüt kap; a feliratok sosem látszanak; a menü sorai ikonná zsugorodnak; a témaválasztás nincs bekötve; fekvő kis telefonon a módváltó csoportja összenyomható; a menü olyan magas, amilyenek a sorai. A huszadik (a módváltó gombjainak külön rögzítése) nem buktatta meg; ezért került ki az a szabály.
- **Nem fedi teszt:** más betűkészlet (a mérés épp ezért van, de a teszt a felület saját betűjével fut); fekvő kis telefonon (568×320) a teszt a fejlécet és a fejlécmenüt méri, az eszköztárat csak kézzel néztem meg (a gyakorlásban két felirat és a ⋯, a szerzői Próbában egy felirat).
