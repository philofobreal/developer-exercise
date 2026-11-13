# ADR-144 – A listák a ragadós értékelősáv fölött érnek véget: mért hely (NY-38)

Állapot: **elfogadva** (2026-11-13). A felhasználó jóváhagyta a lépést („jóváhagyom, mehet az NY-38”). Az [ADR-139](139-result-bar-sticks.md) rögzített maradékát zárja le. Kockázati osztály: megjelenítés; a motor, a szabályok és az értékelés nem változott.

## Kontextus (mérve 2026-11-13-án, a D3 után)

A listák magassága egy állandóval számolt: a képernyő magassága mínusz 400 px, de legalább 320 px. A 400 px azt becsülte, ami a listák fölött és alatt áll. A becslés három helyen tévedett; a táblázat azt mutatja, hány px került a listák aljából a ragadós sáv alá az oldal tetején (egymás melletti listák):

| Helyzet | Képernyő | A sáv alatt |
| --- | --- | --- |
| Gyakorlás | 1366×650 | 46 px |
| Gyakorlás, ellenőrzés után | 1366×650 | 68 px |
| Gyakorlás | 1366×600 | 96 px |
| Szerzői Próba | 1366×600 | 29 px |
| Gyakorlás, ellenőrzés után, fekvő tablet | 1024×768 | 14 px |
| Pages, első látogatás (Local Demo értesítés) | 1366×768 és 1440×900 | 44 px |
| Pages, első látogatás (Local Demo értesítés) | 1366×650 | 114 px |

- **A listák fölötti rész nézetenként más:** a gyakorlásban 314 px, a szerzői Próba lépésben 247 px, a Local Demo értesítéssel 382 px.
- **A sáv megnő,** amikor eredmény érkezik: 62 px-ről 84 px-re; egy kinyitott részlettel tovább.
- **A legkisebb magasság (320 px)** 720 px alatti képernyőn akkor is a sáv alá tolta a listát, ha a becslés jó volt.
- **A legelterjedtebb eset nem a jegyzékben rögzített 1366×650 volt,** hanem a Pages első látogatása: ott minden szokásos képernyőn hiányzott 44 px.
- **Fekvő telefonon** a lista címsora 37 px magas a kis gombjaival; a képlet 30 px-szel számolt, ezért a címsorhoz görgetve 5–6 px, ellenőrzés után további 22 px került a sáv alá.

## Döntés

- **Egy mérőmodul** ([list-fit.ts](../../src/workbench/list-fit.ts)) két tényt közöl a stíluslappal, az alkalmazás gyökerén, képpontban:
  - `--lists-top`: az oldal tetejétől a listák tetejéig;
  - `--result-bar`: az értékelősáv magassága.
- **A stíluslap dönt arról, mit kezd velük** (`public/style.css`, a `.drop-zone` szabálya):
  - **egymás melletti listák:** a képernyő magassága mínusz a két mért érték mínusz 16 px (a sáv saját margója és a panel vonala); legalább 180 px, legfeljebb 640 px;
  - **egymás alatti listák (keskeny képernyő):** a régi állandó marad, mert a két lista együtt úgysem fér az első képernyőre;
  - **fekvő telefon:** a lista a címsorával együtt tölti ki a képernyőt a sáv fölött;
  - **fókusz mód:** változatlan (ott az elrendezés maga osztja el a helyet).
- **A mérés akkor fut újra,** amikor a nézet újrarajzolódik, és amikor az oldal mérete megváltozik (sortörés, eredmény vagy kinyitott részlet a sávban, elvetett értesítés, későn érkező betűkészlet).
- **Ahol 180 px-nél kevesebb hely marad** (például 1366×520), a lista 180 px, és az oldal görget, mint eddig.
- **Amíg a kijelölt sor műveleteinek sávja áll az értékelősáv helyén** (érintőképernyő), az utolsó mérés marad érvényben, hogy a listák ne ugorjanak koppintáskor.
- **A listák a helyüket most ki is töltik.** Eddig a becslés a szerzői Próba lépésben 77 px-t szabadon hagyott; 1366×768-on a lista ott 368 px helyett 442 px.
- **Megszűnt egy halott szabály** (1750 px-nél szélesebb képernyőre 720 px-es felső határ): egy későbbi szabály mindig felülírta.

### Ára

- **A listák alja elmozdul, amikor a sáv megnő:** ellenőrzéskor 22 px-rel rövidebbek lesznek. A sorok nem mozdulnak (a lista teteje áll); a lista belül görgethető.

## Két terv („design it twice”)

1. **Jobb állandó a stíluslapban** (kisebb legkisebb magasság, nagyobb levonás). Elvetve: a listák fölötti rész 247 és 382 px között változik, a sáv 62 és 84 px között; egy állandó vagy helyet pazarol, vagy alálóg.
2. **Az oldal egy képernyőnyi oszlop, amelyben a listák a maradékot kapják** (mint a fókusz módban). Elvetve: a sáv utáni tartalomnak (megjegyzés, tanulói adatok, súgó) a képernyő alatt kell folytatódnia, ehhez a nézetek jelölését át kellene szerkeszteni.
3. **Két mért tény, a döntés a stíluslapé (választott).** A töréspontok egy helyen maradnak; a modul nem tud arról, hogy a listák egymás mellett vagy alatt állnak.

## Tervezési review (docs/design-review.md)

- **list-fit.ts elrejti,** mit mér (a látható első lista tetejét és az értékelősáv magasságát, attól függetlenül, hogy az oldal vagy a teljes képernyős gyökér görget) és mikor. **Interfésze** egy függvény (`installListFit(root)`, a visszaadott mérés a kirajzolás után fut) és a két tulajdonság neve.
- **A két tény egyike sem függ a listák saját magasságától,** ezért egy mérés után nincs több változás: a mérés és a magasság nem kergeti egymást.
- **design, rögzítve:** a stíluslap 16 px-e (a sáv margója és a panel vonala) és a fekvő telefon 44 px-e (címsor, köz, vonal) állandó. Ha a sáv margója vagy a címsor változik, ezeket is igazítani kell; a kapu mindkét esetet méri.
- **design, rögzítve:** a modul a gyökér méretének változását figyeli. Ha valami úgy tolja le a listákat, hogy az oldal magassága közben nem változik, a mérés csak a következő kirajzoláskor frissül. Ilyen helyzetet nem találtam.
- **Első változat, visszavonva:** a modul az értékelősávot külön is figyelte. A mutációs próba megmutatta, hogy fölösleges: a sáv növekedése az oldal magasságát is megváltoztatja, vagy az oldal elfér a képernyőn, és akkor a sáv nem áll a listákon.

## Bizonyíték

- **Elrendezés-kapu** ([browser-layout.playwright.py](../../tests/browser-layout.playwright.py), `lists_above_bar`), öt képernyőn (1366×600, 1366×650, 1280×720, 1440×900, fekvő tablet 1024×768), a szerzői Próba lépésben és a gyakorlásban, ellenőrzés előtt és után:
  - a listák a sáv fölött érnek véget, és leérnek hozzá (legfeljebb 20 px marad köztük);
  - 70 px-rel lejjebb tolva a listák 70 px-rel rövidebbek (a hely mért, nem állandó);
  - a sávban kinyitott részlet után is a sáv fölött maradnak;
  - 1366×520-on a lista 180 px;
  - fekvő telefonon a címsorhoz görgetve a lista a sáv fölött ér véget, ellenőrzés előtt és után.
- **Mutációs ellenőrzés:** hat rontás megbuktatja a kaput: a régi állandó; 320 px-es legkisebb magasság; a fekvő telefon régi állandója; a sáv mérése nélkül; a listák tetejének mérése nélkül; a méretváltozás figyelése nélkül. A hetedik (a sáv külön figyelésének törlése) nem buktatta meg; ezért került ki az a kód (lásd fent).
- **Mérés a Pages-builden** (statikus kiszolgálás, Local Demo értesítéssel és elvetése után, három képernyőn): 0 px a sáv alatt; a régi képlet ugyanott 44–114 px-t rejtett el.
- **Nem fedi teszt:** hogy a mérés a kirajzolással egy lépésben fut (nem egy képkockával később). A méretfigyelés egy képkockán belül pótolná, ezért a kapu nem tudja megkülönböztetni.
