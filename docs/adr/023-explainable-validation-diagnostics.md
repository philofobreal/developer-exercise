# ADR-023 – Magyarázható validáció: bizonyítás alapú diagnosztika a core-ban

Állapot: implementálva (E1). A validátor döntése, a CodeLine-séma, a policyverzió (`scoped-effect-analysis-v11`) és a bizalmi határ változatlan. A tanulói felület (F1) és a részletességi szabályozás (F2) erre épül, de ebben a lépésben nem változik. Kiterjesztette: [ADR-030](030-block-bounds-and-verified-single-move.md) (blokkhatár-becslés, ellenőrzött egylépéses javítás).

## Kontextus

A `validateSubmission` négy státuszt ad (`accepted`, `rejected`, `indeterminate`, `invalid_reference`) egy rövid okkal (`reason`) és néha pozíciókkal. Elutasításnál a tanuló és a szerző sem tudja meg, melyik szabály sérült.

A pontos ok megnevezése nem triviális:

- **Tartalomalapú párosítás:** a validátor tartalom alapján keres bijekciót a beküldött sorok és a referenciasorok között. Az azonos szövegű sorok különböző referenciaazonosítókhoz tartozhatnak, ezért egy UI-sorazonosító nem bizonyítja, melyik referenciasor áll egy helyen.
- **Nincs tanú:** elutasításnál nincs teljes tanú-hozzárendelés (`matchedTokenIds`).
- **Profilok:** az OR-profilok közül egynek a kudarca nem bizonyít globális elutasítást.
- **Keresési ágak:** a keresés egyes ágainak konfliktusai nem a globális elutasítás okai.

## Döntés

### 1. Egyetlen bíró

Az új `diagnoseSubmission(compiled, submission, options)` maga hívja a `validateSubmission`-t ugyanazokkal a beállításokkal. A jelentés `verdict` mezője ennek változatlan eredménye. A diagnosztika soha nem dönt az elfogadásról.

- **`accepted`:** nincs diagnosztika.
- **`indeterminate`:** csak egy `search-budget` értesítés: a megoldás nem minősíthető hibásnak.
- **`invalid_reference`:** csak egy `invalid-reference` értesítés: ez nem a tanuló hibája.
- **`rejected`:** csak bizonyított konfliktus nevezhető meg; ha ilyen nincs, általános, korrekt magyarázat jön.

A tartalmi illesztés a `content-match.ts` modulba került (`matchContent`). Ezt használja a validátor is, így a validátor és a diagnosztika ugyanazokból a jelöltpozíciókból dolgozik. A validátor viselkedése ettől nem változott.

### 2. Mit jelent a „bizonyított”

Egy diagnosztika akkor `proven`, ha **minden** tartalomkonzisztens hozzárendelésben igaz, és **egymagában** kizárja az elfogadást.

- **Tartalom:**
  - egy sor tartalma semmivel nem egyezik (`unknown-content`);
  - egy tartalmi csoportban (az egymással felcserélhető sorok) a beküldött és a referenciasorok száma eltér (`extra-line`, `missing-line`, vegyes behúzási csoportnál `wrong-multiplicity`);
  - egy rögzített sor nincs a helyén, vagy egy tartalom csak egy foglalt rögzített helyen állhatna (`fixed-position`).
- **Sorrend:** egy `a → b` szabály minden hozzárendelésben sérül, ha `a` minden lehetséges (jelölt) helye `b` minden lehetséges helye után van (`min P(a) > max P(b)`).
  - Ez duplikált tartalomnál is érvényes. Ilyenkor a diagnosztika a csoport pozícióit nevezi meg (`positionScope: 'some'`), de egyetlen sort sem tesz meg bűnösnek (`references` csak a biztosan azonosított sorokat tartalmazza).
  - A közvetlen szabály kódja eredete szerint `order-direct`, `scope-boundary` (blokkszabály), `unit-split` (egységen belüli), `pedagogical-rule` (csak szerzői ok) vagy `structural-placement` (szerkezeti ok).
- **Tranzitív (`order-transitive`):** a közös szabályok lezárásában fordított pár. Csak akkor jelenik meg, ha nincs olyan bizonyított közvetlen sértés, amely egy összekötő láncon már megmagyarázza. A diagnosztika a legrövidebb láncot is megadja.
- **Blokk:** ha a sor és a blokk két határsora is egyértelmű helyű, a blokk belseje ismert intervallum. Idegen sor benne, vagy saját sor rajta kívül: `scope-boundary`. A v2-blokkok és a v3-konténerek határeseményei ugyanígy kezelhetők.
- **v3-egység:** ha minden sora egyértelmű helyű, de nem folytonos: `unit-split`.
- **Profilok:** a profilspecifikus konfliktus csak akkor kerül a jelentésbe (`profile-conflict`, profilonként egy), ha **minden** profilban van bizonyított konfliktus. Különben a jelentés nem nevez meg okot.

Ha nincs bizonyított ok, egy `unexplained-rejection` (`general`) diagnosztika mondja meg, miért nem nevezhető meg pontosan: azonos tartalmú sorok, alternatív profilok, vagy több szabály együttes hatása. A jelentés `explained: false`.

### 3. Diagnosztikai szerződés

Minden diagnosztika a következőket tartalmazza:

- stabil kód, súlyosság (`error` | `notice`) és bizonyossági szint (`proven` | `general`);
- nulla alapú megoldáspozíciók, hatókörrel (`all` | `some` | `none`), és a bizonyítottan azonosított referenciasorok;
- a megsértett szabály (`before`, `after`, eredet, a profil és a lánc);
- rövid és részletes szöveg, bizonyíték, korlátok és javítási irány;
- felfedési szint (`verdict` < `positions` < `rules` < `provenance`).

A felfedési szint mondja meg, mit árul el az adott diagnosztika. Az F2 ez alapján vágja a jelentést a megjelenítés helye szerint.

**Szövegek:**

- A szövegek determinisztikus magyar sablonok; runtime AI nincs.
- Szemantikai indok (adat, mellékhatás, konzervatív, szerzői, szerkezeti) csak kötött provenienciából jelenik meg (ADR-014, ADR-015). A `codeLineDiagnosticReasons(model)` ezt adja, és üres, ha a proveniencia hiányzik vagy elavult.
- Proveniencia nélkül a szöveg csak annyit mond: „a feladat egyik sorrendi szabálya köti”.

### 4. Javítási javaslatok

A javaslat bizonyossági szintje:

| Szint | Jelentés |
| --- | --- |
| `verified` | a módosított megoldást a validátor elfogadja |
| `partial` | a bizonyított ütközés megszűnik, de más hiba maradhat (a szöveg ezt ki is mondja) |
| `guidance` | irány, ellenőrzés nélkül |

Csak két egyértelmű helyű sor közötti ütközésre készül mozgatásos javaslat, a rendező beszúrási szemantikájával (`moveLine`). A rögzített helyek maradnak, a mozgatható szomszédok tolódnak, csere nincs. Legfeljebb 3 ütközésre, ütközésenként 2 jelölttel, külön validátorkerettel (`repairStates`, alapértelmezés 5000 állapot).

### 5. Erőforráskeret

- **Lépéskeret:** a `maxSteps` (alapértelmezés 1 000 000, felső korlát 50 000 000) explicit lépéskeret. Beleszámít a tartalmi elemzés, a lezárás (bitkészlet), a párvizsgálat és a javítások validátorállapotai.
- **Kimerülés:** a validátor ítélete változatlan. A jelentés megtartja a már bizonyított okokat, és egy `diagnostic-budget` értesítéssel jelzi a részlegességet. Hamis bizonyosság nem jelenik meg.
- **Megjelenítés:** legfeljebb 12 diagnosztika, pozíció szerint rendezve. Ha legalább ennyi közvetlen sértés van, a tranzitív lezárás el sem indul.

## Következmények

- **Új modulok:** `src/core/diagnostics.ts`, `src/core/content-match.ts`. Az utóbbi a validátor és a diagnosztika közös tartalmi illesztése. A core továbbra sem ismer böngészőt, parsert vagy hálózatot.
- **Tesztek** ([diagnostics.test.mjs](../../tests/diagnostics.test.mjs), 17 eset):
  - a 09.4 regressziói: egyszerű és tranzitív sértés, azonos tartalmú sorok, több bijekció, OR-profilok, rögzített hely és blokk, előfordulási szám, v3-egység és -konténer, érvénytelen referencia, `indeterminate`, diagnosztikai keret, helyes megoldás, részleges és ellenőrzött javítás;
  - két metamorf ellenőrzés (09.5). Az első a három példa minden (illetve 400 véletlen) permutációján fut: a verdikt bitre azonos a validátoréval; minden bizonyított szabálysértés teljesül az összes tartalomkonzisztens bijekcióban (brute force); a bizonyított azonosságok minden bijekcióban a megnevezett helyen állnak; minden `verified` javítást a validátor elfogad. A második: az azonosítók átnevezése sem a verdiktet, sem a kódokat és pozíciókat nem változtatja;
  - 500 soros lánc és erősen duplikált modell a kereten belül (helyi mérés: 14 ms, illetve 55 ms).
- **Nem része az E1-nek:**
  - a tanulói megjelenítés, a soronkénti jelölés és az elavult aszinkron diagnózis érvénytelenítése (F1);
  - a felfedési szabályozás és a negatív szivárgási tesztek (F2).

  A szerver és a Pages ezért még nem küld diagnosztikát.
- **Korlátok:**
  - a bizonyítás jelöltpozíció-alapú. Több szabály együttes hatása (például két azonos sor, amelyeknek ugyanannak a sornak kell megelőznie) nem bizonyítható így; ilyenkor általános magyarázat jön. Ez óvatos, nem téves;
  - az OR-profilok magyarázata csak profilonként egy konfliktust nevez meg.
