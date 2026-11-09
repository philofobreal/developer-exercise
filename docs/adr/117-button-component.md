# ADR-117 – Egy gombkomponens: négy szerep, méret-tokenek

Állapot: **elfogadva** (2026-11-09). Kockázati osztály: megjelenítés. A felület-audit U1 pontja; az [ADR-104](104-spectral-design-system.md) tokenjeire és az [ADR-116](116-landscape-phone-layout.md) elrendezés-kapujára épül.

## Kontextus

Mérés a teljes felületen (2026-11-09, 17 nézet, 1440 × 900 és 390 × 844 érintéssel):
- **Gombstílusok:** 34 különböző asztalon, 32 telefonon. A stílust a magasság, a betű, a súly, a belső margó, a keret, a sarok és a forma együtt adja.
- **Egy gombon belül is sokféle érték:** 13 magasság (22–64 px), 3 betűméret, 4 súly, 13 belső margó, 4 sarokív.
- **Az ok:** 61 stílusszabály állított gombra magasságot, margót vagy betűt, környezetenként felülírva egymást (`.editor-tools button`, `.pane-clipboard button`, `.primary` saját margója stb.).
  - Ugyanaz a szerep eltérően nézett ki: a Modell készítése 39 px, 11 px-es félkövér betűvel; a Tovább a próbához 39 px, 12 px-essel; a Saját feladat ebből 30 px.
- A `tool()` volt a 48 akciógomb közös gyártója, de nem adott közös osztályt.

## Döntés

- **Egy komponensosztály: `.btn`.**
  - A `tool()` minden gombra rárakja; a sorvégi gombok saját gyártót kapnak (`rowTool`), mert azok a kódsor komponensei.
  - A szabálypanel akciógombjai és a megoldás leletének ugrógombja is `.btn`.
- **A geometriát tokenek adják** (`style.css`, egy helyen):
  - `--control-h`: 36 px, érintésen 44, fekvő telefonon 40;
  - `--control-h-sm`: 28 px, érintésen 36;
  - `--control-px`: 12 px; `--control-fs`: 13 px; 600-as súly; 16 px-es ikon.
  - A környezet csak a méretet mondja meg (például `.editor-tools {--control-h:var(--control-h-sm)}`), betűt és margót nem állít.
- **A rokon vezérlők ugyanazt a geometriát kapják:** szegmensgomb, fül, menügomb, módváltó.
- **Szerepek osztályként:**
  - fő: `primary`, kék, lecsípett sarok;
  - tanulói ellenőrzés: `primary check`, sárga;
  - másodlagos: az alapértelmezés;
  - harmadlagos: `link-action`, csak szöveg;
  - veszélyes: `danger`.
- **Kívül marad, mert saját komponens:** lépéssor, feladatlista, kódsorok és vezérlőik, szabálytípus-chipek, kinyitható szakaszok fejléce. Utóbbiakat az U4 (panelanatómia) egységesíti.

## Két terv („design it twice”)

1. **Komponensosztály és méret-tokenek (választott).**
   - A gombok geometriájának egy tulajdonosa van, a hívó (`tool()`) egy osztályt ad.
   - Új gombot csak ezen át lehet készíteni.
2. **Tokenek a globális `button` szabályon (elvetve).**
   - Kisebb diff lett volna.
   - Viszont a lépéssor, a feladatlista, a kódsorok és a chipek is `<button>` elemek, egy globális magasság szétverte volna őket.

## Bizonyíték

- **Mérés a változás után:**
  - minden `.btn` egy betűstílusban (13 px, 600-as súly), asztalon két magasságban (36 és 28 px);
  - az összes `<button>` stílusa 34-ről 16-ra csökkent; a maradék a saját komponenseké (sorok, lépések, feladatok, chipek).
- **Elrendezés-kapu** ([browser-layout.playwright.py](../../tests/browser-layout.playwright.py)): hat képernyőméret, két téma, és minden nézetben:
  - az akciógombok egy betűstílusúak;
  - legfeljebb három magasságúak (alap, kicsi, fejléc).
  - A régi stíluslappal a kapu elbukik (asztalon 5 magasság: 30, 34, 38, 39, 40 px).

## Következmények

- **Új akciógomb csak `tool()`-lal készülhet.** A kapu jelzi, ha valaki saját magasságot vagy betűt ad egy gombnak.
- **A Saját feladat ebből harmadlagos szöveggomb lett.** Másodlagos művelet, nem verseng a tanuló munkájával.
