# ADR-033 – Kétlépéses ellenőrzött javítási javaslat

Állapot: implementálva (2026-10-29). Az [ADR-030](030-block-bounds-and-verified-single-move.md) egylépéses keresését bővíti. A validátor, a verdikt és a policyverzió változatlan; a diagnosztika csak magyaráz.

## Kontextus

Az ADR-030-ban rögzített rés: ha egy elrendezést egyetlen sor áthelyezése nem javít, a kiértékelő semmilyen javaslatot nem adott. Két egymástól független hiba esetén ez a jellemző.

## Döntés

A keresés sorrendje, egyetlen közös kerettel (`moveSearchStates`, alapérték 400 000 egység):

1. **Egylépéses áthelyezés a sávokba** (ADR-030). A sáv az a szakasz, ahová a sor a referencia-szomszédai alapján illik.
2. **Két lépés.**
   - Első lépés: legfeljebb 200 sávjelölt közül az a 16, amelyek után a legkevesebb szabály sérül minden hozzárendelésben.
   - Második lépés: a kapott elrendezés saját sávjaiból.
   - Minden jelöltet az ADR-030 előszűrője és a validátor ellenőriz.
3. **Bármely egylépéses áthelyezés**, növekvő távolság szerint.

**Új diagnózis:** `two-move-repair` (`notice`, `general`, `positionScope: 'some'`, `references: []`). A két lépés eredeti sorait nevezi meg; bűnöst nem állít.

**Javítás formája:** `fix.moves` a lépések sorrendje, mindegyik az előző utáni sorszámozásban. A `fix.move` az első lépés, így a régi kliensek változatlanul működnek. Az egylépéses javaslat `moves` mezője egyelemű.

**Felfedés:** az ADR-030 szabálya változatlan. A sorokat a tanuló `positions` szinten látja, a lépéseket csak `rules` szinttől.

## Eredmény

Két véletlen áthelyezéssel elrontott, megmagyarázatlan elrendezések (`move-search-scale.mjs`, helyi mérés):

| Sor | Megmagyarázatlan | Ellenőrzött javaslattal | p95 |
| ---: | ---: | ---: | ---: |
| 59 | 30 | 27 | 81 ms |
| 131 | 21 | 16 | 96 ms |
| 263 | 7 | 6 | 110 ms |
| 499 | 11 | 8 | 130 ms |

Összesen 57/69 (kb. 83%), ahol korábban egyik sem kapott javaslatot. A legrosszabb eset a keret miatt 500 soron is kb. 0,14 s.

## Mit nem old meg

- **Három vagy több lépés:** nem keresi.
- **Kétlépéses keresés:** nem teljes, csak a legígéretesebb első lépéseket próbálja.
- **Nem mindig van egyetlen „hibás” sor:** a javaslat kiút, nem ok.

## Bizonyíték

[diagnostics-localization.test.mjs](../../tests/diagnostics-localization.test.mjs):

- kétlépéses eset, ahol egyetlen áthelyezés sem elfogadható, kettő igen;
- az egylépéses `moves`;
- felfedés;
- rögzített hely;
- kimerült keret;
- **nyers erős ellenőrzés:** két blokkalak minden egy- és kétlépéses elrontására minden javaslatot sorrendben alkalmaz, és a validátorral ellenőriz.
