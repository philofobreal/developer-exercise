# ADR-137 – A logó felirata ott látszik, ahol elfér; „EDITOR” a „Studio” helyett

Állapot: **elfogadva** (2026-11-11). A felhasználó kérése: „mobil nézeten indokolatlanul tűnik el a logó felirata. már nincs annyi gomb, hogy ne férne el” és „a logóba ne legyen ott a studio szó, 'EDITOR' szó legyen”. Kockázati osztály: megjelenítés. Az [ADR-123](123-steps-reassigned-and-one-skeleton.md) (UI4) álló telefonos alkalmazássávját módosítja.

## Kontextus

- **650 px alatt (álló telefon) a felirat („CodeLineSorter”) mindig rejtve volt,** csak a négyzetes jel látszott. A kis „Studio” címke 1200 px alatt tűnt el.
- **Mérés a felirattal** (szerzői mód, kész modell):
  - 360 és 390 px-en elfér;
  - 320 px-en 23, 375 px-en 10, 412 px-en 49 px-szel túlcsordult volna. 400 px fölött a fejléc gombjai 44 px-esek, így öt gomb 220 px-et foglal.
- **Egy fix töréspont rossz mindkét irányban:** ahol elfér, feleslegesen rejt, és egy szélesebb betűtípusú eszközön túlcsordulhat. A CI-hibákból tudjuk, hogy a betűtípus eszközönként eltér.

## Döntés

- **Mért illesztés** ([header-fit.ts](../../src/workbench/header-fit.ts)): a sáv minden rajzolás után és minden szélességváltozáskor (ResizeObserver, illetve a webfont betöltése után) az első olyan lépést választja, amelynél a sor nem csordul túl:
  1. teljes: jel, felirat és „EDITOR”;
  2. az „EDITOR” címke nélkül;
  3. a jel nélkül;
  4. kisebb (14 px-es) felirat;
  5. még kisebb (13 px-es) felirat;
  6. csak a jel; a felirat ekkor is a sáv akadálymentes neve marad.
- **Szűkebb térközök álló telefonon:** a sáv elemei közt 6 px, a bal oldali margó 12 px, a jobb 10 px.
- **„EDITOR” a „Studio” helyett.** A jelölésben „Editor” áll, a stílus nagybetűsíti (a képernyőolvasó szóként mondja). A címke nem töréspont szerint tűnik el, hanem a mérés szerint.

## Két terv („design it twice”)

1. **Töréspontok, finomhangolt betűméretekkel.** Elvetve: a szélesség mellett a betűtípus is dönt, és a töréspont egyiket sem méri.
2. **Mérés lépcsőkkel (választott).** A döntés egy modulé, egy kérdés: túlcsordul-e a sor. A CSS csak a lépcsőket írja le (`data-brand`).

## Tervezési review (docs/design-review.md)

- **header-fit.ts:** *elrejti* a lépcsőket és azt, mikor fér el a sor. Interfész: `installHeaderFit(root)` adja a rajzolás utáni illesztést; a `fitBrand` a lépcsőt választja. Egy hívó: `view.ts`.
- **style.css:** a régi rejtő szabályok (650 px alatt a felirat, 360 px alatt a jel, 1200, 1000 és 850 px alatt a címke, fekvő telefonon a címke) megszűntek; a lépcsők egy helyen állnak.

## Bizonyíték

- **Mérés** (szerzői és gyakorló mód):

  | Szélesség | Lépcső |
  | --- | --- |
  | 320 px | 14 px-es felirat |
  | 360 px | felirat jel nélkül |
  | 375–390 px | jel és felirat |
  | 412–430 px | felirat jel nélkül |
  | 600–1440 px | teljes, „EDITOR”-ral |

  - Egy sor, túlcsordulás nélkül.
  - Mesterségesen szélesebb betűvel 320 px-en csak a jel marad; máshol a felirat látszik.
- **Böngészős teszt** (`header_logo_fits`; 320, 360, 390, 412, 430, 600 és 1280 px):
  - a sor nem csordul túl, telefonon egy sor;
  - a felirat látszik;
  - 1280 px-en az „Editor” címke is;
  - „Studio” sehol;
  - szélesebb betűvel sem csordul túl.
  - Mutációs próba: lépcsők nélkül a teszt elbukik.
