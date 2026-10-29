# ADR-035 – A nyelvi hiba mindig blokkolja a publikálást; egy kapu a szervernek, az ellenőrzőnek és a Pages-nek

Állapot: implementálva (2026-10-29). Az [ADR-017](017-model-verification-gate.md) kapuját és az [ADR-027](027-disclosure-and-author-authorization.md) publikálási szabályát szigorítja. A validátor, a séma, a tanulói értékelés és a példamodellek változatlanok.

## Kontextus

A [megbízhatósági audit](../megbizhatosagi-audit-terv.md) P0 megállapítását reprodukáltuk:

- **A nyelvi hiba nem blokkolt.** Egy típushibás referencia (`const label: string = 42;`) `audit=errors` és `unverified` minősítést kapott. Az alapértelmezett `publishable` módban a szerver mégis kiszolgálta, mert a `publishable` jelző csak a referenciát és a szomszédos cseréket vizsgálta.
- **Három külön kapu volt:**
  - a szerver a `publicationRefusal` szabályt használta;
  - a `verify-models` csak a sémát, a saját referenciát és a szintaxist nézte;
  - a Pages-build minden példát kapu nélkül másolt.
- **A szabály beolvasása nem volt szigorú.** Ha a `CODELINE_PUBLICATION` értéke elírt volt, a szerver csendben a gyengébb `publishable` módra állt.

## Döntés

### 1. A nyelvi hiba publikálási akadály

A `verifyModel` a modellt csak akkor jelöli `publishable`-nek, ha teljesül három feltétel:

- a referencia elfogadott;
- a szomszédos cserék a produkciós keretben eldőlnek;
- a nyelvi audit nem `errors`.

A `publicationRefusal` minden politikában először a nyelvi hibát vizsgálja, és meg is nevezi. Ezért egy kézzel összerakott, `publishable: true` állítású ellenőrzés sem csempészhet át nyelvi hibát.

| Audit | Publikálható? | Minősítés |
| --- | --- | --- |
| `ok` | igen | a többi feltételtől függ |
| `unverifiable` (hiányzó projektkontextus) | igen | az állítás `not-established` |
| `not-run` (pl. a Pages standard library nélkül) | igen | az állítás `not-established` |
| `errors` | **nem, egyik politikában sem** | `unverified`, az állítás `refuted` |

A szerzői előnézet változatlanul megmutatja a hibás referenciát és a minősítését: az előnézet nem publikálás.

### 2. Egy kapu, egy politika

- **Katalógus:** az `ExerciseCatalog.open` dönt, és minden rekordhoz feljegyzi a fájlnevet.
- **Szabálybeolvasás:** a `publicationPolicy(value)` olvassa a `CODELINE_PUBLICATION` értékét. Üres vagy hiányzó érték esetén `publishable`; ismeretlen értékre hibát dob, nem szolgál ki többet.
- **[server.mjs](../../server.mjs):** a katalógust és a szabálybeolvasót használja.
- **[verify-models.mjs](../../scripts/verify-models.mjs):**
  - ugyanazt a katalógust nyitja meg, és minden példa minősítését kiírja;
  - **ha bármelyik példát elutasítja, a `check` elbukik**;
  - opcionális argumentuma a vizsgált mappa.
- **[publish-examples.mjs](../../scripts/publish-examples.mjs):**
  - a Pages-build csak a katalógus által kiszolgált modelleket másolja;
  - a `manifest.json` csak ezeket sorolja fel;
  - a `publication.json` rögzíti a politikát, a kiszolgált modellek minősítését és a kihagyott modellek okát.

## Következmények

- **Tesztek:**
  - [publication-gate.test.mjs](../../tests/publication-gate.test.mjs): minden auditérték; a szabály mindkét politikában; elírt politikaértékek; a katalógus mindkét politikában; a fail-closed üres katalógus; a Pages-kiválasztás; a `verify-models` kilépési kódja;
  - [model-verification.test.mjs](../../tests/model-verification.test.mjs): a típushibás referencia `publishable=false`;
  - [pages-build.test.mjs](../../tests/pages-build.test.mjs): a manifest pontosan a kiszolgált modelleket tartalmazza, és minden példa vagy kiszolgált, vagy indokkal kihagyott.
- **A mai példák:** mind nyelvileg hibátlanok, ezért az alapértelmezés továbbra is mindet kiszolgálja.
  - A `class-inventory-ts` jóváhagyott frissítés után `analysis-verified`, a másik négy `unverified`.
  - A `verified-only` alapértelmezés a többi példa felülvizsgált migrációja után jöhet ([eltéréslista](../peldak-migracioja.md)).
- **Pages:** helyi demó marad. A kapu a build idején dönt; a böngészőben futó demó nem biztonsági határ.
- **Korlát:** a Pages a nyelvi auditot standard library nélkül futtatja (`not-run`). A build viszont a szerver auditorát használja, ezért a típushibás példa a Pages-re sem kerül ki.
