# ADR-133 – A négy nézetgomb kikapcsolva (Rendező | Megoldáskód, Szerkesztő | Kártyák)

Állapot: **elfogadva** (2026-11-11). A felhasználó döntése: „a négy gomb teljesen felesleges. a funkcióra sincs szükség, de csak kapcsold ki, ne töröld a funkciókat.” Kockázati osztály: megjelenítés; a motor, a szabályok és az értékelés nem változott. Az [ADR-106](106-focus-surface-code-views-and-author-defaults.md) kódnézet-választását és a Próba lépés megoldáskód-fülét kapcsolja ki.

## Döntés

- **A Próba munkaterületén és a gyakorlásban nincs nézetváltó:**
  - nincs „Rendező | Megoldáskód” fülsor; a munkaterület a rendező, fülsor és `tabpanel` szerep nélkül;
  - nincs „Szerkesztő | Kártyák” kódnézet-kapcsoló.
- **A kódnézetet a mutató dönti el,** a korábban eltárolt választástól függetlenül:
  - durva mutatón (érintőképernyő) kártyák, a nagy célterületek miatt (WCAG 2.5.8);
  - finom mutatón szerkesztő.
  - Különben aki korábban kártyákat választott, a kapcsoló nélkül nem tudna visszaváltani.
- **A megoldáskód nézet nem lép életbe** (`activateView`), akkor sem, ha egy régi vezérlő vagy billentyű kérné.
- **A kód megmarad:** a megoldáskód-szerkesztő, a kódnézetek, a választás tárolása és a gombok rajzolása változatlanul a forrásban van.
  - Egy kulcs kapcsolja vissza: `localStorage['ngdynamic.view-switches.v1'] = 'on'` (`viewSwitchesOffered` a `code-view.ts`-ben).
  - A böngészős tesztek, amelyek ezeket a nézeteket vizsgálják, ezzel futnak, így a kikapcsolt funkciók nem romlanak el észrevétlenül.
- **Szövegek:**
  - a gyakorlás „nem elérhető nézet” üzenete: „Ebben a nézetben csak a megoldás rendezése érhető el.”;
  - a tanulói előnézet súgója a megoldáskódot csak bekapcsolt nézetváltónál említi.

## Két terv („design it twice”)

1. **A gombok és a mögöttük álló kód törlése.** Elvetve: a felhasználó kifejezetten a megtartást kérte, és a tesztek (mátrix, TypeScript, munkafelület) a megoldáskódot a validátor bemenetének kényelmes forrásaként használják.
2. **Egy kulcs mögé kapcsolva, alapból kikapcsolva (választott).** A döntés egy helyen él (`code-view.ts`), a rajzoló és a nézetváltás ugyanazt kérdezi. A kódnézet tulajdonosa már ma is a választás tárolása, ezért nem kell új modul.

## Tervezési review (docs/design-review.md)

- **code-view.ts:** *elrejti*, hogy a nézetváltók kikapcsoltak, és hogy ilyenkor a mutató dönt. Új interfész: `viewSwitchesOffered()` és a kulcs neve. Hívói: `view.ts` (rajzolás), `interactions.ts` (nézetváltás).
- **Nem került párhuzamos állapot** a nézetbe vagy a vezérlőbe: a `state.view` értéke `sort` marad, mert a megoldáskód nézetbe nem lehet belépni.
- **Rögzített maradék:** a kikapcsolt kód csak a kulccsal bekapcsolt tesztekben fut; a szállított oldal alapállapotát az új `view_switches_off` böngészős eset és az elrendezés- és akadálymentességi kapu vizsgálja.

## Bizonyíték

- **Böngészős teszt** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py), `view_switches_off`, a kulcs nélkül):
  - a gyakorlásban és a szerzői Próba lépésben nincs `[data-view]`, `[data-set-code-view]` és `role="tablist"`; a rendező látszik és ellenőrizhető;
  - egy korábban eltárolt „kártyák” választás finom mutatón szerkesztő nézetet ad, érintőképernyőn kártyákat;
  - a kulccsal bekapcsolva a négy gomb újra megjelenik és működik.
- **A meglévő nézet- és kódnézet-tesztek** (`code_views`, megoldáskód-formázás, drag kártyanézetben, mátrix, TypeScript, akadálymentesség a megoldáskódon) a kulccsal változatlanul futnak.
