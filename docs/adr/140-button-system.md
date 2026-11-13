# ADR-140 – Gombrendszer: lecsapott, ahol dönt; kerekített, ahol dolgozik; összevont, ahol szűk

Állapot: **elfogadva, megvalósítás folyamatban** (2026-11-12; a D1 kész 2026-11-13-án, lásd lent). A felhasználó kérte a gombok újragondolását egy saját mintaoldal (lekerekített, lecsapott sarkú gombok) alapján, és a bemutatott javaslatot jóváhagyta: „jó, tetszik. tartsuk meg, rögzítsük és ütemezzük be”. A javaslat oldala: <https://claude.ai/artifact/MEDMKex5kLG4uBp2eRnTpU> (privát). Kockázati osztály: megjelenítés. Az [ADR-104](104-spectral-design-system.md) (F1) és az F1b karakter (ferde, lecsípett gombok) továbbvitele; az UI1 gombkomponensét (4 szerep, 3 méret) tartja meg.

## Döntés

- **Egy gombkomponens, két sziluett:**
  - **lecsapott:** a bal felső és a jobb alsó sarok lágyított vágással (14 px; nagyban 16, kicsiben 11, a lépéslapon 18), a másik kettő 6 px-es kerekítés. Az irány és a döntés gombja:
    - a módváltó (a mostani ferde módgombok helyett, így a felirat nem dől);
    - a lépéslapok (kész, aktív, zárolt);
    - a lépés fő művelete (Modell készítése, Tovább a próbához, Ellenőrzés).
  - **kerekített** (8 px, kicsiben 6 px): minden eszköz és kapcsoló, azaz az eszközsor, a sorgombok, a fejléc eszközei és a szegmentált választók.
- **Nézetenként legfeljebb egy kitöltött lecsapott gomb.** A gyakorlásban és a Próba lépésben ez a sárga „Ellenőrzés”, a lépésekben a kék fő művelet.
- **Bekapcsolt állapot** (`aria-pressed`): halvány kék lap, kék vonal és egy 2 px-es alsó jelzővonal, így nem csak a szín jelzi.
- **Állapotok minden családban:** alap, lenyomva, dolgozik (az ikon forog, a felirat nem változik), letiltva (az ok mellette, ADR-120), törlés vagy hiba (piros szöveg, piros vonal).
- **Méretek a meglévő tokenekre:**
  - nagy (48 px): a lépés fő művelete; a lépéslap 58 px;
  - közepes (40 px): alapértelmezett;
  - kicsi (32 px): eszközsor; a sorgomb asztalon 28 px, érintőképernyőn 44 px.
- **Összevont menü csak telefonon:**
  - a fejléc munkamenet-, téma- és teljes képernyő-gombja egy menügomb alá kerül (44 px-es sorok, ikon és teljes szöveg; Escape és külső kattintás zár, a fókusz visszatér);
  - a gyakorlás eszközsorán a Mintamegoldás és a Sor szabályai kint marad, az Újrakezdés, a Fókusz és a kezelési súgó a „Továbbiak” alá kerül;
  - a két mód és a fő művelet mindig kint van;
  - asztalon nincs összevonás.
- **Megvalósítás:**
  - CSS `corner-shape` (`superellipse(.35)` a vágott sarkon), `@supports` mögött. Ahol a böngésző nem ismeri, a gomb egyenletesen 10 px-esen kerekített: a forma egész marad, csak a vágás hiányzik.
  - Nincs gombonkénti SVG és JavaScript: a munkafelület minden rajzoláskor újraíródik (ADR-127), és egy listában több száz sorgomb áll.

## Két terv („design it twice”)

1. **A mintaoldal technikája: SVG-lap minden gomb mögött, méretfigyelővel újrarajzolva.** Elvetve: minden rajzolás után több száz SVG-t kellene újraépíteni, és a gomb kinézete JavaScripttől függene.
2. **CSS `corner-shape`, fokozatos javítással (választott).** A sziluett a stíluslapé, a jelölés csak a szerepet (osztályt) mondja meg.

## Ütemezés

A megvalósítás az NY-37 tétel ([nyitott-tetelek.md](../nyitott-tetelek.md)), hat lépésben:

- **D1:** komponens és tokenek;
- **D2:** módváltó és lépéslapok;
- **D3:** fő műveletek;
- **D4:** eszközök, sorgombok, választók;
- **D5:** telefonos összevont menük;
- **D6:** kapuk és lezárás.

Mindegyik lépés külön push: `npm run gate` ([ADR-142](142-fast-deploy-and-local-gate.md)) és képernyőkép-összevetés.

## D1: a komponens kerekített sziluettje és állapotai (2026-11-13)

- **Kerekített minden eszköz:** minden `.btn`, kivéve a lépés fő műveletét (`.primary`, a lecsípett sarka a D3-ig marad), és a menügombok.
  - A sugár a gomb magasságát követi: 36 px-től 8 px, 28 px-nél 6 px (`min(8px, magasság × 0,22)`), így a kis gomb magától kisebb sugarat kap.
  - Az összetartozó választók (`.segment`) csak a külső sarkukon kerekítettek; a végleges alakjuk a D4-é.
  - A módváltó és a lépéslapok változatlanok (D2).
- **Bekapcsolt gomb** (`aria-pressed`): halvány kék lap, kék vonal és 2 px-es jel a felirat alatt. A fókusz és a teljes képernyő gombja eddig teli kék volt, a „Sor szabályai” halvány: most egyformák.
- **Letiltott gomb:** egyetlen tompa lap, akár `:disabled`, akár okkal letiltott (`aria-disabled`, ADR-120). Eddig az egyik 55%-os, a másik 50%-os átlátszóságú volt.
- **Dolgozó gomb** nem látszik letiltottnak: a forgó jel mutatja, hogy dolgozik.
- **Lenyomva** a lap 1 px-t mozdul.
- **A magasságok nem változtak.** A 48/40/32 px-es méretek a D3-ban (fő művelet) és a D4-ben (eszközök) jönnek, ahol a családjuk alakot kap.

### Eltérés a D1 tervétől

- **A lecsapott sziluett osztálya a D2-be került,** az első használatához: a D1-ben egyetlen gomb sem viselte volna, így ellenőrizni sem lehetett volna. A böngésző támogatását megmértem: a helyi Chromium (153) ismeri a `corner-shape`-et és a `superellipse()` értéket.

### Tervezési review (D1)

- **Egy helyen él** a kerekítés, a bekapcsolt jel és a letiltott lap (a `style.css` gombkomponens-szakasza, az ADR-117 szabályai mellett). A fókusz-, a teljes képernyő- és a szabálypanel-gomb saját bekapcsolt szabályai megszűntek.
- **A méretet továbbra is a hely mondja meg** (`--control-h`, ADR-117); a sugár ebből számol, külön méretosztály nincs.
- **Rögzített maradék:** a sorgombok (`.rule-toggle`, `.pin-toggle`) saját bekapcsolt stílusa a D4-ig marad.

### Bizonyíték (D1)

- **Elrendezés-kapu** ([browser-layout.playwright.py](../../tests/browser-layout.playwright.py)), minden nézetben, hat képernyőméreten, mindkét témában:
  - minden látható eszköz sugara a magasságához illik;
  - minden bekapcsolt gomb viseli a 2 px-es jelet;
  - fókusz módban a fókuszgomb bekapcsolt.

  Mutációs próba: a kerekítés nélkül a kapu elbukik („tools without the component's rounding”).
- **Böngészős teszt** (`button_states`, [browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py)):
  - a kétféle letiltott gomb egyformán néz ki, és más, mint az alap;
  - a dolgozó gomb nem néz ki letiltottnak;
  - a bekapcsolt gomb lapja más, és jelet visel.
- **Képernyőkép-összevetés:** 28 nézet előtte és utána (asztal és telefon, világos és sötét).
