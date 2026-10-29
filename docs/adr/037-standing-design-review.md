# ADR-037 – Állandó Ousterhout-féle tervezési review és belső modulok tulajdonosai

Állapot: elfogadva (2026-10-29). Az [AGENTS.md](../../AGENTS.md) „Ousterhout-style architecture” szakaszát és az [AI governance](../ai-governance.md) elveit teszi végrehajthatóvá.

## Kontextus

A projekt eddig is az Ousterhout-féle moduláris architektúrát követte, de a gyakorlatban csak elvként. A 2. fázis ([ADR-036](036-implied-order-and-interchangeable-units.md)) első változatában ezért két hiba csúszott át a helyességi teszteken:

- **Időbeli csatolás és szivárgás:** a keresésszűkítő modul a validátor tömbjeire épült, és a hívónak négy párhuzamos állapotot kellett kézzel szinkronban tartania.
- **Duplikált szabályok:**
  - a tranzitív lezárt két helyen, ugyanúgy volt megírva;
  - az „azonos tartalom” szabálya a kapuban `trim()`-mel tért el a validátorétól.

A helyességi tesztek ezeket nem fogják meg. A tervezési minőséget kimondva kell vizsgálni.

## Döntés

1. **Kötelező tervezési review:** minden változtatásnál (tervezéskor és a commit előtt) és minden kódreview-ban le kell futtatni a [tervezési review ellenőrzőlistáját](../design-review.md). A megállapítás kategóriája `design`. Ez a felhasználói utasítást nem helyettesíti, és nem vezet be új jóváhagyási lépést.
2. **Belső modulok tulajdonosai (`information-hiding` kapu):**
   - A core azon moduljait, amelyek egyetlen döntést rejtenek el meghatározott hívók számára, az [architektúra-szabályok](../../scripts/architecture-rules.ts) tulajdonoslistája rögzíti.
   - Ezeket a modulokat csak a felsorolt tulajdonosok importálhatják; az `index.ts` sem exportálhatja tovább őket.
   - Új hívót csak tudatos tervezési döntéssel lehet felvenni.

   | Belső modul | Tulajdonos | Elrejtett döntés |
   | --- | --- | --- |
   | `src/core/placement.ts` | `validator.ts` | a részleges hozzárendelés szabályai és szűkítései |
   | `src/core/reachability.ts` | `placement.ts`, `diagnostics.ts` | a tranzitív lezárt számítása |
3. **A refaktorálás része a tervezés is:** egy refaktorálás akkor kész, ha a tervezési review megállapításai javítva vannak, vagy kimondva rögzítve (ADR, hátralévő munka).

## Következmények

- **Tesztek:** az [architecture.test.mjs](../../tests/architecture.test.mjs) negatív esetei igazolják, hogy:
  - idegen modul nem importálhatja a belső modult;
  - az `index.ts` nem exportálhatja tovább;
  - a tulajdonos importja megengedett.
- **Korlát:** a kapu csak az importokat látja. A mélységet, a kohéziót, a szivárgást és a nevek minőségét továbbra is emberi vagy ügynöki review ítéli meg az ellenőrzőlista alapján.
