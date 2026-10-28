# ADR-026 – Visszajelzés a diagnosztikából: két részletességi szint és soronkénti jelölés (F1)

Állapot: implementálva (F1). Az [ADR-023](023-explainable-validation-diagnostics.md) diagnosztikájára épül. A validátor döntése és a bizalmi határ változatlan.

## Kontextus

Az E1 óta a core minden ítélethez bizonyított okot vagy általános magyarázatot ad, és minden diagnosztikának van felfedési szintje (`verdict` < `positions` < `rules` < `provenance`). A felület eddig ebből semmit nem mutatott: a tanuló és a szerző is csak egy általános mondatot látott.

A részletes ok elárulhatja a szerveroldali szabályokat. A felfedési politika az F2 feladata, ezért az F1-nek biztonságos alapértéket kell adnia.

## Döntés

### 1. Az API dönti el, ki mit lát

Az értékelő végpontok a validátor helyett a `diagnoseSubmission`-t hívják. A válasz a változatlan ítélet, mellette a `feedback` mező: nézőnként egy-egy `discloseReport(report, szint)` eredmény.

| Végpont | `feedback.author` | `feedback.learner` |
| --- | --- | --- |
| szerzői előnézet (`/api/author/preview`, Pages `previewDraft`) | `provenance`: minden, kötött provenienciával | `positions` |
| megbízható értékelés (`/api/evaluate`, Pages `evaluate`) | nincs | `positions` |

**Mit lát a tanuló:** a `positions` szinten csak a saját beküldéséről szóló tények látszanak: ismeretlen sor, rögzített hely, érvénytelen beküldés, keretkimerülés és a hibás referencia. Minden szabályszintű részlet visszatartott, darabszámmal együtt.

**Ha minden hiba visszatartott:** az elutasítás egy általános sort kap a validátor saját üzenetével. Így nincs csupasz „hibás”, és nincs a szintnél több információ sem.

A trusted gráf továbbra sem utazik a tanulóhoz: a negatív teszt a válaszban `before`, `after`, `categories` és `origins` kulcsot sem enged.

**F2:** a tanulói szint emelése (például `rules`) az F2 politikája lesz; az F1 ehhez csak a mechanizmust adja.

### 2. A nézet csak választ

A megjelenítés a core-ból csak típust importálhat, ezért nem szűr. A gyakorló mód és a „Tanulói nézet” a `learner`, a szerzői előnézet az `author` visszajelzést mutatja. A korábban nyitott kérdés (külön kapcsoló kell-e a szerzői és a tanulói részletesség között) így megoldódott: a meglévő „Tanulói nézet” pontosan a tanulói szintet mutatja.

### 3. Két részletességi szint

- **Rövid:** az értékelősáv üzenete az első bizonyított hiba összefoglalója (ha nincs, az első diagnosztikáé); `role="status"`, élő régió.
- **Részletes:** a sáv alatti „Részletes magyarázat” (`details`, a nyitott állapota megmarad). Minden tételben:
  - az összefoglaló és a részletes szöveg;
  - a javítás a saját bizonyossági szintjével („Ellenőrzött javítás”, „Részleges javítás”, „Útmutatás”);
  - a szerzőnek a bizonyíték és a korlát;
  - ha a tétel sorokat nevez meg, egy „Ugrás” gomb.

### 4. Soronkénti jelölés

- **Melyik sor:** az értékelés a beküldött sorokkal együtt elküldi a sorok rendezőbeli helyét (`slots`), mert a diagnosztika pozíciói a kihagyott üres helyek nélküli listára vonatkoznak. A jelölés így a ténylegesen értékelt sorhoz kötődik, nem kliensoldali azonosítóhoz.
- **Hogyan:**
  - egy biztosan érintett sor (`positionScope: all`) piros sávot és háttérszínt kap;
  - egy „ezek egyike” sor (`some`) borostyán sávot;
  - a sor `aria-describedby`-vel a magyarázatra mutat, így képernyőolvasóval is elérhető.
- **Ugrás:** a gomb kiemeli az érintett sorokat, a legközelebbi helyre görget (`block: nearest`), és a fókuszt a sor fogantyújára viszi.
- **Elavulás:** bármely mozgatás, szerkesztés vagy modellváltás azonnal törli a riportot, és vele a jelölést; a késve érkező válasz generációs védelme változatlan. A DOM-kezelés nem keres a gráfban: csak a riport pozícióit jeleníti meg.

## Következmények

- **Tesztek:**
  - [diagnostics.test.mjs](../../tests/diagnostics.test.mjs): `discloseReport`;
  - [trust-boundary.test.mjs](../../tests/trust-boundary.test.mjs): negatív szivárgás a megbízható értékelésben, teljes részletesség a szerzői előnézetben;
  - workbench-böngészőcsomag, Node és Pages módban: jelölés, ugrás és fókusz, tanulói nézet, érvénytelenítés mozgatás után.
- **Korlátok:**
  - a tanuló az F2-ig csak a pozíciószintű tényeket látja;
  - a megoldáskód-szerkesztő nézet nem jelöl sorokat, csak a rendező.
