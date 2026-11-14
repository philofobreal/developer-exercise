# ADR-140 – Gombrendszer: lecsapott, ahol dönt; kerekített, ahol dolgozik; összevont, ahol szűk

Állapot: **lezárva** (2026-11-14, D6; elfogadva 2026-11-12-én). A megvalósítás kilenc lépésben elkészült; hogy a döntésből mi áll ma és mi változott útközben, azt a [Lezárás](#lezárás-d6-2026-11-14) szakasz mondja meg. **A sziluett-szabályt az [ADR-143](143-plates-and-soft-surfaces.md) módosította (2026-11-13):** a lecsapott sarok minden feliratos gombé, nem csak a döntés gombjaié; a D2–D4 lépések ott vannak újraosztva. **A rajzolás technikája is ott változott (D3b):** a lap `clip-path: shape()` kivágás egy rétegen, sík tónussal; továbbra is JavaScript és gombonkénti SVG nélkül. A felhasználó kérte a gombok újragondolását egy saját mintaoldal (lekerekített, lecsapott sarkú gombok) alapján, és a bemutatott javaslatot jóváhagyta: „jó, tetszik. tartsuk meg, rögzítsük és ütemezzük be”. A javaslat oldala: <https://claude.ai/artifact/MEDMKex5kLG4uBp2eRnTpU> (privát). Kockázati osztály: megjelenítés. Az [ADR-104](104-spectral-design-system.md) (F1) és az F1b karakter (ferde, lecsípett gombok) továbbvitele; az UI1 gombkomponensét (4 szerep, 3 méret) tartja meg.

## Döntés

- **Egy gombkomponens, két sziluett:**
  - **lecsapott:** a bal felső és a jobb alsó sarok lágyított vágással (14 px; nagyban 16, kicsiben 11, a lépéslapon 18), a másik kettő 6 px-es kerekítés. Az irány és a döntés gombja:
    - a módváltó (a mostani ferde módgombok helyett, így a felirat nem dől);
    - a lépéslapok (kész, aktív, zárolt);
    - a lépés fő művelete (Modell készítése, Tovább a próbához, Ellenőrzés).
  - **kerekített** (8 px, kicsiben 6 px): minden eszköz és kapcsoló, azaz az eszközsor, a sorgombok, a fejléc eszközei és a szegmentált választók.
- **Nézetenként legfeljebb egy kitöltött lecsapott gomb.** A gyakorlásban és a Próba lépésben ez a sárga „Ellenőrzés”, a lépésekben a kék fő művelet.
- **Bekapcsolt állapot** (`aria-pressed`): halvány kék lap, kék vonal és egy 2 px-es alsó jelzővonal, így nem csak a szín jelzi. *Módosítva: a 2 px-es jelzővonal megszűnt, gombban nincs aláhúzás ([ADR-153](153-no-underline-seamless-stripe-aligned-row-icons.md)); a jel a lap és a vonal.*
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
- **D5:** telefonos összevont menük (kész: [ADR-145](145-narrow-screen-menus.md));
- **D5b:** a munkaterület egy keret, állítható szabálypanel (kész: [ADR-146](146-workspace-frame-and-rule-panel-split.md));
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

## Lezárás (D6, 2026-11-14)

A felhasználó jóváhagyta a lezárást („mehet az NY-44 és NY-45 közös kidolgozása, de előtte a D6”). Ez a szakasz azt rögzíti, mi áll a döntésből, mi változott útközben, és mi őrzi.

### A lépések

| Lépés | Mi készült | Commit | Hol van leírva |
| --- | --- | --- | --- |
| D1 | kerekített eszközök, állapotonként egy megjelenés | c9ccbdc | ez az ADR |
| D2 | letört lap minden feliratos gombon | f08e111 | [ADR-143](143-plates-and-soft-surfaces.md) |
| D3 | lágy felületek, mezők, állapotcímkék, választócsoportok | 793947f | ADR-143 |
| D3b | sík tónusú lap, valódi letörés két kerekített csúccsal | a5841bb | ADR-143 |
| D4a | a többi gomb, a fókuszkeret a lapot követi, távolságok | 185e534 | ADR-143 |
| D4b | semmi 12 px alatt, a kód 13 px | b490a50 | ADR-143 |
| D5 | telefonon egy fejlécmenü, mért eszközfeliratok | 672ed97 | [ADR-145](145-narrow-screen-menus.md) |
| D5b | a munkaterület egy keret, állítható szabálypanel | f02132d | [ADR-146](146-workspace-frame-and-rule-panel-split.md) |
| D6 | lezárás | ez a commit | ez a szakasz |

### A döntés és ami ma áll

| A döntés 2026-11-12-én | Ami ma áll | Miért változott |
| --- | --- | --- |
| lecsapott sarok csak az irány és a döntés gombjain | lecsapott sarok **minden feliratos** gombon; a felirat nélküli (ikon- és sor-) gomb kerek | a felhasználó döntése a D2 bemutatója után (ADR-143) |
| nézetenként legfeljebb egy kitöltött gomb | legfeljebb **kettő** (a lépés fő művelete és az aktív lépéslap) | a lépéslap is kitöltött lett; a kapu kettőt enged |
| bekapcsolt állapot: halvány kék lap, kék vonal, 2 px-es jelzővonal | így áll | – |
| állapotok minden családban (alap, lenyomva, dolgozik, letiltva, törlés) | így áll; a letiltott gomb üres lap hajszálvonallal | a sík arc mellett a letiltott állapotnak más jel kellett (D3b) |
| telefonon a munkamenet, a téma és a teljes képernyő egy menü alatt | a munkamenet és a téma egy ☰ alatt; **a teljes képernyő kint maradt**; a menügomb mindig ikon | a felhasználó döntése a D5 bemutatója után (ADR-145) |
| telefonon az Újrakezdés, a Fókusz és a súgó a „Továbbiak” alatt | az Újrakezdés és a súgóhoz vezető sor a ⋯ alatt, ahol súgó is van; **a Fókusz kint maradt**; a felirat ott látszik, ahol a sorban elfér | a felhasználó döntése; a felirat mért, nem töréspont (ADR-145) |
| CSS `corner-shape`, ahol a böngésző ismeri | `clip-path: shape()` egy rétegen; régebbi böngészőben lekerekített téglalap | a `corner-shape` csak Chromiumban élt, és a letörés csúcsa nem volt kerekíthető (D3b) |
| nincs gombonkénti SVG és JavaScript | így áll | – |

Ami a döntésben nem szerepelt, de a gombrendszerrel együtt készült el: a lágy felületek és a felülettokenek (D3), a tipográfia alsó határa (D4b), a listacím sávjának lekerekített alja, a nyelvjelvények színe (NY-48), a munkaterület kerete és a szabálypanel elválasztója (ADR-146).

### Ami őrzi

- **Elrendezés-kapu** ([browser-layout.playwright.py](../../tests/browser-layout.playwright.py)), 75 eset, minden nézetben és mindkét témában: a lap körvonala (letörés felirattal, kerek anélkül); sík arc, amelyen a felirat olvasható (4,5:1); legfeljebb két kitöltött gomb; egy betűtípus-stílus és legfeljebb három magasság; a fókuszkeret a lapot követi; a felületek sarka a tokené, és semmi szögletes nem áll benne; pirula alakú állapotcímkék; egy csoportot alkotó választók; 12 px-es alsó határ, 13 px-es kód; a munkaterület kerete; a nyelvjelvények színe.
- **Munkafelület-csomag** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py)): a gombok állapotai (`button_states`), a telefonos menük (`header_menu`, `toolbar_menu`), a keret és az elválasztók (`rules_split`).
- **Akadálymentességi vizsgálat** és a **stíluslap egységtesztje** (lezárt blokkok, nincs 12 px alatti betű).

### Képernyőkép-összevetés

A lezáráskor 16 nézetről készült kép a gombmunka előtti állapotból (15105c9) és a mostaniból, egymás mellett: a három szerzői lépés, a gyakorlás ellenőrzés előtt és után (sötét és világos téma, 1440×900), valamint telefonon (390×844) a Próba, a gyakorlás és a fejlécmenü. A képeket a felhasználó megkapta; a tárolóba nem kerültek be. A mostani állapot képeit az elrendezés-kapu minden futáskor újra elkészíti (`test-results`).

### Ami nyitva maradt

- **Régi stílusszabályok** a lap szabályai alatt (például a menügomb régi kerete és háttere): hogy melyik halott már, azt nem mértem ki, ezért nem töröltem. Törlésük külön lépés lenne, nézetenkénti stílus-összevetéssel.
- **A súgóoldal** saját stíluslapot használ; a gombrendszer szabályai ott annyiban élnek, amennyiben a közös tokenekből következnek. A kapu a súgóoldal gombjait nem méri.
- **Régebbi böngészők** a letörés helyett lekerekített téglalapot mutatnak (ADR-143, rögzített maradék).
