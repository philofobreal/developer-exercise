# ADR-140 – Gombrendszer: lecsapott, ahol dönt; kerekített, ahol dolgozik; összevont, ahol szűk

Állapot: **elfogadva, megvalósítás ütemezve** (2026-11-12). A felhasználó kérte a gombok újragondolását egy saját mintaoldal (lekerekített, lecsapott sarkú gombok) alapján, és a bemutatott javaslatot jóváhagyta: „jó, tetszik. tartsuk meg, rögzítsük és ütemezzük be”. A javaslat oldala: <https://claude.ai/artifact/MEDMKex5kLG4uBp2eRnTpU> (privát). Kockázati osztály: megjelenítés. Az [ADR-104](104-spectral-design-system.md) (F1) és az F1b karakter (ferde, lecsípett gombok) továbbvitele; az UI1 gombkomponensét (4 szerep, 3 méret) tartja meg.

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

Mindegyik lépés után teljes ellenőrzés és képernyőkép-összevetés jön.
