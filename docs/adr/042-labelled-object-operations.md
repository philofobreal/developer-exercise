# ADR-042 – Címkés objektumműveletek (v21)

Állapot: **elfogadva** (2026-10-30), szabályverzió `scoped-effect-analysis-v21`. A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 4. fázisának 6. tétele („a `switch`, a `try` és társaik maradékai, mért esetenként”).

## Kontextus

**A mért ok:** a v20 utáni generatív mérésben a `flow` csoport fő maradék oka a címkés ciklus volt:

```js
outer: for (const entry of boxes) {
  entry.rename('r3');
  break outer;
}
```

**Miért kötött ma:**
- a hatásnyom-értelmezés (ADR-034) csak a címke nélküli `break`/`continue`-t ismerte, ezért a címkés utasítás hatásnyom nélkül maradt;
- a nevezett objektumok (`boxes`, és rajta át `a`, `b`, `c`) megszöktek;
- így a független konstrukciók is sorrendhez kötődtek (`effectful-or-unknown-initializer`).

**Az orákulum ugyanígy:** a P2 objektumművelet-definíciója (`jsObjectOperations`, `tsObjectOperations`) sem ismerte a címkés utasítást, ezért külső hatásnak (ciklusnak) vette.

## Döntés

1. **Generátor** ([object-footprints.ts](../../src/author/object-footprints.ts)):
   - a listaszintű címkés utasítás az a művelet, amelyet címkéz (`for…of`, `switch`, `if`, `try` vagy egysoros kifejezés-utasítás);
   - a törzsben a körülvevő címkére mutató `break`/`continue` ugyanúgy értelmeződik, mint a címke nélküli: a folytatás értelmezése csak hatást ad hozzá.
2. **Sortulajdon** ([statement-ordering.ts](../../src/author/statement-ordering.ts)): a címkés összetett utasítás első és utolsó sora a címkézett utasítás nyitó és záró kapcsos zárójeléig tart (`compoundBraces`).
3. **Orákulum** ([semantic-oracle.mjs](../../tests/support/semantic-oracle.mjs)): a címkés objektumművelet az általa címkézett művelet, és a címkés ugrás a körülvevő címkére megengedett. Ugyanazt a P3-összevetést kapja, mint a címke nélküli.
4. **Ami barrier marad:**
   - a többsoros címkés blokk (`outer: { … }`);
   - a címkés `while`/`for`, mert a terminálásuk nem bizonyított (4. tétel);
   - a listán kívüli címkére mutató ugrás.
5. **Szabályverzió:** v21.

## Helyességi érv

- **A címke nem futtat kódot:** a címkés utasítás pontosan úgy fut, mint a címkézett utasítás. Egyetlen különbség, hogy a rá mutató `break`/`continue` elhagyja vagy folytatja.
- **Az ugrás túlbecsülhető:** az értelmezés az ugrás után is folytatja a törzset. Ez csak olvasást és írást ad hozzá, a hatásnyom tehát bővebb. Az ADR-034 ugyanígy kezeli a címke nélküli ugrást.
- **A ciklus véget ér:** a saját tömbön futó `for…of` nem írja a tömböt; ezt a hatásnyom ellenőrzi.

## Bizonyítékok

- **Tesztek:** [labelled-footprints.test.mjs](../../tests/labelled-footprints.test.mjs), mindegyik az orákulummal ellenőrizve.
  - **Szabad:** címkés ciklus egy másik objektum műveletével; beágyazott ciklusból a külső címkére mutató `continue`; címkés egysoros művelet; TypeScript.
  - **Azonos kényszerek:** a címkés `switch` kényszerei megegyeznek a címke nélküliével.
  - **Kötött:** a ciklus írja, amit a későbbi művelet olvas (objektumütközés).
  - **Barrier marad:** címkés többsoros blokk, címkés `while`.
- **Mérés azonos mércével:** az orákulum változása miatt a régi és az új baseline közvetlenül nem összevethető. A régi orákulum a címkés ciklust a P2 alapján ítélte meg, ezért több sorrendet „indokoltnak” számolt. Az új orákulummal mérve, gyors konfiguráció:

  | Csoport | v20 generátor | v21 generátor |
  | --- | ---: | ---: |
  | flow JS | 19 rés (24,4%) | 17 rés (21,8%) |
  | flow TS | 7 rés (10,1%) | 4 rés (5,8%) |
  | többi | változatlan | változatlan |

  **Újrarögzítés:** a baseline a v21-gyel és az új orákulummal lett újrarögzítve. A régi orákulummal mért értékekhez képest a flow JS 15,7%-ról, a flow TS 4,6%-ról nőtt. Ez nem romlás: az új orákulum ezeket a sorrendeket futásidőben ítéli meg, ezért a generátor meglévő túlbecsléseit is látja.
- **Maradék:** a `flow` rések három forrásból jönnek:
  - a teljes ciklus túlbecslése (a `break outer` utáni elemeket is értelmezi);
  - a `while` miatti szökés;
  - a lezárt `switch` egység (`sealed-unit`).
