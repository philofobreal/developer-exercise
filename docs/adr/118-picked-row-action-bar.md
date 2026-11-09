# ADR-118 – Érintésen a kijelölt sor műveletei az alsó sávban

Állapot: **elfogadva** (2026-11-09). Kockázati osztály: megjelenítés és interakció. A mobilterv M1b pontja; az [ADR-095](095-tap-to-place-and-drag-insert-migration.md) érintéses kijelölésére és az [ADR-117](117-button-component.md) gombkomponensére épül. Az ADR-091 sorvégi gombjait érintésen felváltja.

## Kontextus

- **A takarás:** érintőképernyőn a rendező sorvégi gombjai (szabály, kapcsolat, beszúrás, fel, le, vissza) mindig látszottak, és eltakarták a kód végét. Telefonon a kód felét fedték le.
- **A meglévő kijelölés:** az ADR-095 óta egy koppintás a fogantyúra kijelöli a sort, egy második koppintás a helyére teszi. A kijelölésnek azonban nem voltak saját műveletei.
- **A szabálypanel:** telefonon a teljes képernyőt elfoglalta, az eszköztárral együtt. Csak a saját fejlécében lévő gombbal lehetett bezárni.

## Döntés

- **Érintőképernyőn a rendező soraiban nincs vezérlő** (`hover:none`); a rögzített sor jelzése megmarad.
- **Kijelölés:**
  - A sor kódjára koppintás is kijelöli a sort, ahogy a fogantyúra koppintás.
  - A húzáskezelő (`drag-insert.ts`) egy jelzéssel (`onPick`) megmondja, melyik sor van kijelölve.
  - A kijelölést listája és sorazonosítója tartja (`rowPick`), nem a pozíciója.
- **A műveletsáv** az Ellenőrzés sávjának helyén jelenik meg (`pickBar`):
  - **felhasználható sornál:** Beszúrás;
  - **megoldássornál:** Feljebb, Lejjebb, Vissza a sorokhoz;
  - **mindkettőnél:** Sor szabályai (ha a szerzőnek elérhető) és Kész.
  - Ugyanazok a kezelők futnak (`data-move`, `data-up`, `data-down`, `data-remove`, `data-rule-line`), mint a sorvégi gombokon.
  - A Feljebb és a Lejjebb után a kijelölés a soron marad (`data-keep-pick`); a többi művelet és a Kész megszünteti.
  - A koppintással áthelyezés (ADR-095) változatlanul működik.
- **A szabálypanel telefonon (650 px alatt) alsó lap:** legfeljebb a képernyő háromnegyede, az eszköztár fölötte látszik, a bezárás a ragadós fejlécben marad.
- **Érintés-elsődleges képernyőn egérrel** (például táblagép egérrel, `hover: none`) a kódra kattintás is kijelöl. Itt a sorvégi gombok rejtve vannak, és e nélkül az egér nem érné el a sor műveleteit. A böngészős mátrixteszt érintéses, 1500 px-es környezete éppen ezt az esetet mutatta ki.
- **Egérrel és billentyűzettel semmi nem változik:** a sorvégi gombok és a billentyűzetes mozgatás ugyanúgy működik. Egérrel nem jön létre kijelölés, ezért a sávot nem kell töréspont szerint ki-be kapcsolni.

## Két terv („design it twice”)

1. **A húzáskezelő jelzi a kijelölést, a nézet rajzolja a sávot (választott).**
   - A kijelölés tudása egy helyen marad, a húzáskezelőben; a nézet csak megjeleníti.
   - Új eseménykezelő nem kell, a meglévő sorkezelők futnak.
2. **A húzáskezelő maga építi a sáv DOM-ját (elvetve).**
   - A megjelenítést a bevitel-adapterbe keverné.
   - A sáv kikerülne a nézet újrarajzolásából, és két helyen kellene a gombokat karbantartani.

## Bizonyíték

- [browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py) `pick_actions` (390 × 844, érintés):
  - érintésen nincs vezérlő a soron;
  - a kódra koppintás kijelöl, a sáv megjelenik, az Ellenőrzés helyén;
  - Beszúrás, majd Lejjebb: a sor lejjebb kerül, a kijelölés rajta marad;
  - Vissza a sorokhoz, majd Kész;
  - nincs oldalirányú görgetés;
  - a szerzői Próbán a Sor szabályai alsó lapot nyit, amely a képernyő felső ötödét szabadon hagyja, és a fejlécéből bezárható.
- A meglévő `tap_to_place` (ADR-095) változatlanul átmegy.
- [browser-matrix.playwright.py](../../tests/browser-matrix.playwright.py): a sormozgató lépések egy segéden (`row_action`) mennek át. Ez a soron lévő gombot használja, ha látszik, különben a kijelölt sor sávját.
- **Javított hiba fejlesztés közben:** a kijelölés utáni újrarajzolás kiürítette a képernyőolvasó állapotsorát. A bemondás most az újrarajzolás után jön.
