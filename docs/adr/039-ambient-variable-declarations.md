# ADR-039 – A `declare` változódeklaráció pozíciófüggetlen (v18)

Állapot: implementálva (2026-10-29). Policyverzió: `scoped-effect-analysis-v18`. A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 4. fázisának 0. és 1. tétele. A validátor, a séma (additív enumbővítés) és a tanulói értékelés változatlan.

## Kontextus

- **Szabályhiba (terv 3.4):** a szkriptszintű `declare const d: number;` `erased-declaration-shape` barrier lett, pedig az `interface`-hez hasonlóan minden TypeScript-emit törli.
  - **Az ok:** a törlődő ág a nevet a csomóponton kereste, a változóutasítás viszont a deklarációlistán hordozza.
  - **Következmény:** a generatív mérésben ez a TS-szkriptek indokolatlan elutasításainak egyik fő oka volt.
- **Tervezési adósság (ADR-038):** a kibocsátó helyek a kód mellett kézzel is megadták a kategóriát.

## Döntés

### 0. A kategória egyetlen tulajdonosa a jegyzék

- **Az emitterek csak kódot neveznek meg:** az `OrderingReason` már csak `{before, code}`.
- **A kategóriát egy hely vezeti le:** a projekció a proveniencia kiírásakor a `categoryOf(code)` hívással kéri a jegyzéktől.
- **Megszűnt két rejtett kategóriaszabály:**
  - a `statement-ordering` objektumütközés-szabálya (`may-throw` → `effect`, egyébként `data`);
  - a `type-member-ordering` fázisszabálya.
- **Bizonyíték:** 237 katalogizált program generált modellje (sorok, függőségek, élek, proveniencia) bájtra azonos a változás előtt és után.

### 1. `declare` változók

**Pozíciófüggetlen** a `declare const/let/var` (és az `export declare`) utasítás, ha teljesül két feltétel:
- minden deklarátora egyedi azonosító;
- a sorait birtokolja: egysoros, vagy egyetlen deklarátor objektumtípus-literállal, mint az `interface`.

**Konzervatív marad** (`erased-declaration-shape` vagy közös sorú forrássorrend):
- a destrukturáló alak;
- a más kóddal sort megosztó alak.

## Következmények

- **Tesztek:**
  - [declare-erasure.test.mjs](../../tests/declare-erasure.test.mjs): a v18 és a formális szerződés egyezése; pozitív esetek (`const`, `let`, `var`, több deklarátor, `export`, többsoros); negatív esetek (destrukturálás, közös sor); orákulumos helyesség, eltérés nélkül;
  - a jegyzék új bizonyító programja (`code-erased-destructuring`).
- **Változásfelerősítés megszüntetése:** a jelenlegi szabályverziót a generátor exportálja (`DEPENDENCY_POLICY`), a tesztek ezt használják. Egy verzióemelés így egy helyen változik, a konkrét értéket egy teszt rögzíti.
- **A mért hatás** a [CHANGELOG](../../CHANGELOG.md)-ban és a generatív baseline-ban.
