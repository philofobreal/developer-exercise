# ADR-116 – Fekvő telefon, egységes gombmagasság és elrendezés-kapu

Állapot: **elfogadva** (2026-11-09). Kockázati osztály: megjelenítés. A mobilterv M1 pontja; az [ADR-105](105-mock-character-and-calm-layout.md) mobil elrendezését és az [ADR-110](110-format-button-demo-notice-focus-bar.md) fókusz módját javítja. Az F5 elrendezés-kapuja itt készül el.

## Kontextus

A felhasználó négy, fekvő telefonon készült képernyőképe alapján, a magam 780×360-as és 915×412-es méréseivel (2026-11-09):
- **Csak szélesség szerinti töréspontok.**
  - Minden mobilszabály 650 px alatti szélességre szólt, magasság szerinti töréspont nem volt.
  - A fekvő telefon (kb. 740–930 × 340–430 px) így a táblagépes elrendezést kapta: kétsoros fejléc, nagy cím, kártyás lépéssor, kétsoros eszköztár.
  - Egy 360 px magas képernyőn a gyakorló nézetben a listák a hajtás alatt kezdődtek (915×412-n 536 px-nél).
- **Fókusz módban a listák 16 px magasak voltak** (780×360). A fix magasságú sávok (Local Demo, kétsoros eszköztár, eredménysáv, részletek, megjegyzés) elvitték a helyet.
- **Üres oldalsáv.**
  - Ha a feladatlistát keskeny nézetben becsukták, széles nézetben (például fekvő telefonon teljes képernyőn) a lista rejtve maradt.
  - A lenyíló fejléce ott nem jelzi, hogy kattintható, így a 232 px-es oldalsáv üres maradt.
- **Vegyes gombmagasság egy sorban.** Érintőképernyőn a szegmensgombok 34 px-esek, a műveleti gombok 44 px-esek voltak.
- **A fejléc kilógott** 850 és 1000 px között: a „Tanulói nézet” felirata és a „Studio” címke nem fért ki.

## Döntés

- **Magasság szerinti töréspont:** `(max-height:500px) and (orientation:landscape)`.
  - A fekvő telefon a keskeny elrendezést kapja: a feladatlista lenyíló, a lista nem oldalsáv.
  - Minden sáv egy sor és egy magasság:
    - a fejléc kb. 47 px, 36 px-es vezérlőkkel, a módváltó a logó mellett;
    - a lépéssor 36 px, alcímek nélkül;
    - az eszköztár egy sor 40 px-es gombokkal, a másodlagos gombok csak ikonnal, akadálymentes névvel;
    - a cím egy sorban, levágással; a leírás egy sorra vágva; a „Saját feladat ebből” a cím sorában.
  - A listák magassága `100dvh - 100px`, így görgetés után kitöltik a képernyőt.
  - Fókuszban:
    - a Local Demo sáv, a cím, a megjegyzés és a részletek rejtve maradnak;
    - az eredménysáv egy sor.
- **Egy gombmagasság sorónként.** Érintőképernyőn minden eszköztárgomb 44 px (a szegmensgombok is), fekvő telefonon 40 px.
- **Álló telefonon az eredménysáv egy sor:** az eredmény egy sorban balra, az Ellenőrzés jobbra; a listák harmadát már nem takarja.
- **A széles oldalsáv sosem üres.**
  - Széles nézetben a feladatlista becsukott állapotban is látszik (`::details-content`), és a fejléce nem csukja be.
  - A kezdő állapotot választó JavaScript-lekérdezés (`view.ts`) ugyanazt a töréspontot használja, mint a stíluslap.
- **1000 px alatt** a „Tanulói nézet” csak ikon, a „Studio” címke eltűnik.

## Két terv („design it twice”)

1. **CSS-töréspontok a meglévő stíluslapban (választott).**
   - A döntés egy helyen van, a stíluslapban.
   - A nézetkód nem változik, egyetlen kivétellel: a kezdeti nyitott/csukott állapot lekérdezése, amely ADR-105 óta JavaScriptben él.
2. **JavaScript-elrendezésváltó (`data-layout` attribútum `matchMedia` alapján, elvetve).**
   - Egy helyről vezérelne minden elrendezést.
   - Viszont minden render elé időbeli csatolást tenne, és a töréspont-tudás kétfelé szakadna (JS és CSS).

## Ismert maradék

- **A sorvégi gombok érintőképernyőn továbbra is a kód fölött állnak.**
  - A megoldás (kijelölt sor műveletei az alsó sávban, ahogy a mobilterv mutatja) a húzás és a billentyűzetes mozgatás egyenértékűségét is érinti.
  - Ezért külön lépés: M1b.
- **Álló telefonon a fejléc két sor (97 px).** 844 px magasságban ez elfér; a mock egysoros fejlécét az M5 lépés-újraosztásával együtt vezetjük be.
- **A lépéssor jelölése** (pipa a figyelmeztetés mellett) az M3 része.

## Bizonyíték

[browser-layout.playwright.py](../../tests/browser-layout.playwright.py) (`npm run test:browser:layout`, a `test:browser:all` része):
- **Méretek:**
  - asztal 1440×900, laptop 1280×720;
  - táblagép 880×1100, érintéssel;
  - telefon 390×844, valamint fekve 780×360 és 915×412;
  - mindegyik világos és sötét témában.
- **Nézetek:** a szerzői Próba és a gyakorló nézet, fókusszal és anélkül.
- **Mérések:**
  - nincs oldalirányú görgetés;
  - nincs kilógó fejlécgomb;
  - az eszköztár gombjai egyforma magasak;
  - fekvő telefonon az eszköztár egy sor, a fejléc legfeljebb 52 px, a listák az első képernyőn kezdődnek;
  - fókuszban a listák együtt a magasság legalább 40%-át kapják;
  - a keskeny nézetben becsukott feladatlista széles nézetben látszik.
- **A kapu a régi stíluslappal elbukik** (táblagép: 34 és 44 px-es gombok egy sorban).
- **Mért eredmény (780×360, fókusz):** a listák 16 px helyett 149–157 px-esek; a gyakorló nézetben a listák 281 px-nél kezdődnek (eddig az első képernyő alatt).
