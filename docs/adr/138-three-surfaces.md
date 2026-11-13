# ADR-138 – Három felület a CSS-ben: panel, beágyazott, lebegő (NY-30)

Állapot: **elfogadva** (2026-11-11). **A szögletes sarkokat az [ADR-143](143-plates-and-soft-surfaces.md) lágyra módosította (2026-11-13, D3): a sarok felületenként token, a szabályok ugyanazok;** a három felület és az egy-egy szabály marad. A felhasználó a következő tételt kérte; az NY-30 az [ADR-123](123-steps-reassigned-and-one-skeleton.md) (UI4) rögzített maradéka volt. Kockázati osztály: megjelenítés. A működés nem változott.

## Kontextus

- **19 keretes, kitöltött doboz élt a CSS-ben,** mindegyik a saját keretszínével, hátterével és sarkával. A tényleges, számított értékek (sötét téma):

  | Felület | Keret | Háttér | Sarok |
  | --- | --- | --- | --- |
  | Panel (8) | 2 szín | 3 árnyalat | 0 |
  | Beágyazott (6) | 4 szín | 3 árnyalat | 0 vagy 3 px |
  | Lebegő (2) | 2 szín | 2 háttér | 0 vagy 3 px, 2 árnyék |

- **Egy későbbi szabály 0-ra írta felül a sarkot** a panelek többségén (az F1b karakter), a többin nem. A forrásból nem látszott, mi érvényes.
- **A különbségek nem jelentettek semmit:** nem jelentésbeli eltérések voltak, hanem az időben eltérően épült változatok.

## Döntés

- **Felület-tokenek** (`:root`):
  - `--panel-line`, `--panel-fill`;
  - `--inset-line`, `--inset-fill`;
  - `--float-line`, `--float-fill`, `--float-shadow`.
  - A lebegő háttér világos témában fehér, sötétben a kiemelt szürke (`n-16`). Az oldalnál sötétebb vagy azzal egyező lebegő felület (a régi menü) nem vált el a laptól.
- **Egy szabály felületenként, a fájl elején** (`:is(...)`, egyetlen osztály erősségével). Így a komponensek későbbi, saját szabályai (belső margó, a 4 px-es jelentéscsík az állapotkártyán és a leletlistán, a kijelölés) felülírhatják:
  - **lépéskeret** (`.author`, `.solution-editor`): az oldal hátterén, a panel vonalával. Benne ülnek a panelek, ezért nem kaphatja a panel hátterét. Az első változatban megkapta, és a beágyazott panelek összefolytak vele; a képernyőkép-összevetés ezt mutatta meg;
  - **panel:** modelláttekintés, szabálypanel, modell-bizonyíték, szabálytábla, próbaszabályok, leletlista, feladat-állapot, súgótéma;
  - **beágyazott:** függőségtábla, szabálysor, táblalista, részletes magyarázat, szabálytípusok, kódpélda;
  - **lebegő:** menük és súgóbuborékok (`.menu-panel`), folyamatjelző.
- **A komponensek szabályaiból kikerült a saját keret, háttér, sarok és árnyék.** A közös `border-radius:0` felülíró lista is megszűnt; csak az értékelősávé maradt, mert az nem a három felület egyike, hanem értesítés.
- **Kívül maradt:**
  - az értesítések (egy rendszerük van, ADR-123);
  - a vezérlők (gombok, mezők, címkék);
  - a szabálytörlés megerősítése, mert az erősebb kerete jelentést hordoz.

## Két terv („design it twice”)

1. **Osztálykészlet a jelölésben** (`class="surface panel"` minden dobozon). Elvetve: kilenc nézetmodult és a súgót kellene módosítani, és a felület kétszer állna (osztály és komponens).
2. **Egy szabály felületenként, a komponensek listájával (választott).** A döntés egy helyen van, a jelölés nem változik. Egy új doboz a megfelelő listába kerül.

## Tervezési review (docs/design-review.md)

- **style.css:**
  - *elrejti* a felületek kinézetét;
  - egy komponens csak a térközét és a jelentését (csík) írja.
  - A felület-tokenek a témákból örökölnek; csak a lebegő háttér témafüggő külön.
- **Rögzített maradék:** a belső margók komponensenként eltérnek (10–23 px). Ezek a tartalom sűrűségét követik, nem a felületet; egységesítésük külön döntés volna.

## Bizonyíték

- **Képernyőkép-összevetés** (14 nézet, világos és sötét, asztal és telefon, a változtatás előtt és után):
  - minden nézetben legfeljebb 0,7% képpont változott;
  - kivétel a sötét menü (4–10%, szándékos: kiemelt háttér) és a sötét Próba lépés lenyitható kiértékelése (3–4%, beágyazott felület lett).
- **Számított stílusok mérése** minden dobozon, mindkét témában (előtte és utána). Az eltérések mind a fenti egységesítés következményei.
- **Az elrendezés-kapu és az akadálymentességi kapu** (kontraszt is) mindkét témában változatlanul zöld.
