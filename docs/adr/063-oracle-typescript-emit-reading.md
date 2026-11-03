# ADR-063 – A TypeScript második, független olvasata az orákulumban

Állapot: **elfogadva** (2026-11-03). Orákulum és mérés, az 5. fázis 3. tétele ([megbízhatósági terv](../megbizhatosagi-audit-terv.md)). Szűkíti a [formális szerződés](../formal-ordering-contract.md) A1 feltevését. A generátor és a validátor változatlan.

## Kontextus

JavaScriptre az orákulum Acornnal elemez, a generátor a TypeScript-parserrel, így a két kódút független. TypeScriptre viszont az orákulum is a TypeScript AST-jét járta be, saját kóddal. Egy TS-parser- vagy bejárási hiba (A1) így mindkét oldalon ugyanúgy megjelenhetett.

## Döntés

1. **Második olvasat:** a TypeScript szkript ES2022-es, natív osztálymezős (`useDefineForClassFields`) kimenetét Acornnal elemezzük. Ezt a JavaScript-ág P1 és P2 ellenőrzése ítéli meg: alak és hatáspár-sorrend (`emittedAnalysis`).
   - Egy jelölt csak akkor egyenértékű, ha a TS AST szerinti és a lefordított kód szerinti olvasat is egyezik a referenciáéval.
   - Eltérésnél az ok `emitted-order`.
2. **A törölt deklarációk** (típus, interfész, túlterhelési szignatúra, `declare`) a TS AST-nél maradnak, mert a kimenetben nem látszanak.
3. **Csak a natív mezős mód.** A `[[Set]]` mód a mezőket konstruktorbeli értékadássá alakítja. Ezt a JavaScript-ellenőrzés az osztálytag-politika (ADR-012, ADR-029) nélkül sorrendhez kötné. Az első próbán így 33 téves riasztást adott véletlen osztályprogramokon. A P3 továbbra is mindkét módot futtatja.
4. **A modul** egyelőre csak a TS-olvasatot kapja, mert a CommonJS-kimenet betöltő-előtagot tesz elé.

## Bizonyíték

- **A 33 TS-korpuszfixture** rögzített számai változatlanok.
- **A két olvasat minden szomszédos sorrendben egyezik:** 0 `emitted-order` ítélet a TS-korpusz minden fixture-jének minden egysoros áthelyezésén és páros cseréjén. Két független elemzés egyezése a mai korpuszon.
- **TS-kampány, 4 mag, minden fajta:** 0 hibás elfogadás.
- **Teszt:** [oracle-typescript-emit.test.mjs](../../tests/oracle-typescript-emit.test.mjs).

## Korlátok

- **A TypeScript-fordító közös marad:** a kimenetet ugyanaz a TypeScript állítja elő. Egy olyan parserhiba, amely a kimenetet is elrontja, mindkét olvasatban megjelenik; ilyenkor viszont a P3 futás eltér.
- **A modulok és a `[[Set]]` mód** második olvasata nyitott.
