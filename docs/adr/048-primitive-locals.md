# ADR-048 – Primitív lokálisok a hatásnyomban (v25)

Állapot: **elfogadva** (2026-10-31), szabályverzió `scoped-effect-analysis-v25`. A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 4. fázisának mért tétele.

## Kontextus

**A mért ok:** a v24 után a `flow` csoport egyik gyakori mintája egy ciklusban számolt lokális volt:

```js
let seen = 0;
for (const entry of boxes) {
  if (seen > 0) entry.note('again');
  seen = seen + 1;
}
```

**Miért kötött ma:**
- a `seen` olvasása nem volt primitív, mert a változót nem csak `++`/`--` írta (ADR-019);
- az írása a hatásnyomban ismeretlen kód volt;
- így a ciklus nem kapott hatásnyomot, a `boxes` és rajta át minden objektum megszökött, és minden más művelet barrier lett (`while`, `for…of`, `if`).

## Döntés

1. **Primitív lokális** (`statement-ordering`, egyetlen előzetes számítás): olyan függvénylokális `let`/`var`, amelynek minden írása primitív értéket tárol. Az írás lehet:
   - kezdőérték;
   - `=` vagy aritmetikai összetett értékadás primitív jobb oldallal;
   - `++`/`--`.

   A halmaz a legnagyobb, erre a szabályra zárt halmaz, ezért egy értékadás olvashatja magát a kötést (`seen = seen + 1`). A számítás köreiben a primitív-gyorsítótár minden kör után ürül, mert egy kör megcáfolhat egy kötést.
2. **Olvasás:** a primitív lokális olvasása primitív. Így egy ilyen olvasás tiszta egység lehet, és a hatásnyomban is primitív érték.
3. **Írás a hatásnyomban** (`FootprintHost.assignable`): a lista szintjén egy hatásnyomos utasítás írhatja a lista függvényének primitív lokálisát. A kötés olvasása és írása az utasítás olvasási, illetve írási halmazába kerül, így RAW/WAR/WAW köti, mint egy lokális írást.
4. **Orákulum (JS és TS):** az objektumművelet törzsében a lista saját `let`/`var` kötésének `=` vagy aritmetikai összetett írása megengedett; a P3 dönt.
5. **Szabályverzió:** v25.

## Helyességi érv

- **Indukció a futás lépésein:** a kötés kezdetben primitív (a kezdőérték primitív, és a kötés olvasása a deklaráció után áll). Minden írás primitív operandusokból számol primitívet; a koerciós operátorok primitíveken nem futtatnak kódot. A kötés értéke tehát mindig primitív.
- **A sorrendjét a kötésütközés őrzi:** az író és az olvasó utasítások név szerinti RAW/WAR/WAW miatt sorrendben maradnak. Egy beágyazott függvény, amely írja, csak barrieren át futhat, és a barrier sorrendben marad.

## Bizonyítékok

- **Tesztek:** [primitive-locals.test.mjs](../../tests/primitive-locals.test.mjs), mindegyik az orákulummal ellenőrizve.
  - **Szabad:** a számláló ciklus és az összetett értékadás objektumművelet, ezért egy független objektum művelete elé kerülhet (JS és TS).
  - **Kötött:** a deklaráció a ciklus előtt, a későbbi olvasó utána marad.
  - **Konzervatív:** egy valaha objektumot kapó lokális nem primitív, így a ciklus ismeretlen marad.
- **Mérés (12 mag, azonos új orákulum):**

  | Csoport | v24 generátor | v25 generátor |
  | --- | ---: | ---: |
  | flow JS | 16,0% | 10,6% |
  | flow TS | 12,0% | 8,3% |

  A többi csoport változatlan, hibás elfogadás nincs.
- **Korpusz:** a `prec-try-catch-finally` rése 1-ről 0-ra esett (egy egyenértékű sorrend most elfogadott); a korpusz-baseline tudatosan újrarögzítve, más érték nem változott.
