# A régi evaluate-modell és a képen látható sorrend

A [beküldött v2 modell](../tests/fixtures/evaluate-legacy-serial.model.json) soros láncot ír elő: `1 → 2 → 3 → 4 → 5 → 6 → 7`. A képen a sor-ID-k sorrendje `1, 3, 5, 2, 4, 6, 7`, ezért a változatlan modell alapján helyesen elutasított. A `dependencyHints` tájékoztató szerzői metaadat; nem írja felül a `dependencies`, `edges` vagy `profiles` szabályait.

A jelenlegi JS/TS generátor ennél a szűk, primitív `const` példánál már kötésalapú részleges sorrendet készít. A régi JSON importja szándékosan megtartja a régi szabályokat. A korrekcióhoz az **Adatmodell → Sorfüggőségek újraszámítása** gombot kell használni. A művelet az ott látható JSON-t auditálja és újraelemzi, majd teljes admission után alkalmazza; kompatibilis kitöltés megmarad és újraértékelődik. Az új függőségek:

| ID / kód | Előfeltétel-ID-k |
| --- | --- |
| 1 / function evaluate | nincs |
| 2 / const a | 1 |
| 3 / const b | 1 |
| 4 / const c = a + b | 2, 3 |
| 5 / const note | 1 |
| 6 / return { c, note } | 4, 5 |
| 7 / záró kapcsos zárójel | 6 |

A [javított, importálható JSON](evaluate-legacy-serial.corrected.json) ugyanezt tartalmazza, az eredeti feladatazonosítóval és 2-es revízióval. A kód, sor-ID-k, blokkok, scope-ok, fixed mezők és a normalizálás változatlanok. Az `authoring.provenance` mező (ADR-014) minden új függőség okát rögzíti, például a `return { c, note };` sor előzményeinél `data` / `binding-input` és `effect` / `ReturnStatement`; a validációt nem befolyásolja. A szerzői API saját előnézetazonosítót ad az importhoz.

A frissítés a sorfüggőségeket cseréli. A kézi `edges` és `profiles` korlátok megmaradnak, a generátor strukturális élei hozzáadódhatnak, ezért egy kézzel szigorított modell továbbra is elutasíthatja ezt a sorrendet. Eltérő fizikai sor- vagy blokkstruktúrán a függőségfrissítés hibával leáll; ilyenkor a teljes Referenciaforrás alkalmazása külön szerzői döntés. A korábbi JSON előtte exportálható. Ez nem általános szemantikai ekvivalenciabizonyítás vagy a validátor lazítása.

A regresszió mind az 5040 permutációt külön pozíciós feltételekkel veti össze: pontosan 8 elfogadott. A túl korai `c` és `return` elutasított. Node catalog, Pages API és mindkét valódi böngészős felület ellenőrzi a régi import és az explicit frissítés különbségét. Döntés: [ADR-006](adr/006-explicit-dependency-refresh-and-review-guards.md).
