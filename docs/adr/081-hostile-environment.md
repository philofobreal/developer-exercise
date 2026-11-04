# ADR-081 – Orákulum: rosszindulatú környezet a szigorú bemeneti szerződéshez

Állapot: **elfogadva** (2026-11-04). Csak a mérés változik, a generátor és a szabályverzió nem (`scoped-effect-analysis-v45` marad). Az [ADR-062](062-oracle-environments-and-for-in.md) környezetváltozatait bővíti, és az [ADR-050](050-input-contract.md) szerződésének alapértelmezett (`any`) oldalát teszi mérhetővé.

## Kontextus

A `script` JS kampány maradék rései mind egy tanúban jelentek meg (`random-script-javascript-2`, 5 rés):

```js
var v1 = 2;
record('r2', 3);
let l3 = v1 + 1;
…
var v5 = 6;
const c6 = l3 + 1;
```

A generátor a `let l3 = v1 + 1` és a `var v5 = 6` sort, illetve a `var v5 = 6` és a `const c6 = l3 + 1` sort is egymáshoz köti (`effectful-or-unknown-initializer`).

Az első kötés a szigorú bemeneti szerződésből (`inputs: 'any'`) következik:
- a `record` külső kód, és átírhatja a szkript globális `v1` változóját egy saját `valueOf`-ot futtató objektumra;
- ekkor a `v1 + 1` kódot futtat, amely megfigyelheti, hogy a `v5` már értéket kapott-e.

Az orákulum `record`-ja jóindulatú, ezért a mérés ezt résnek látta, holott a szerződés által indokolt kötés.

Ugyanez fordítva is igaz: a szigorú szerződés ezen oldalát eddig egyetlen orákulumváltozat sem próbálta. Ha a generátor itt túl laza volna, a hibás elfogadás rejtve maradna.

## Döntés

1. **Új környezetváltozat: `hostile`** ([semantic-oracle.mjs](../../tests/support/semantic-oracle.mjs), `hostileRecord`).
   - **A beavatkozás:** a `record` minden hívás után a program minden primitív felső szintű változóját (`var`, `let`; a `const` írása elbukik, és ez nem baj) egy megfigyelő objektumra cseréli.
   - **A megfigyelő objektum** ugyanarra az értékre konvertálódik vissza (`valueOf`, `toString`), és minden konverziókor a nyomba írja az összes felső szintű változó pillanatnyi értékét.
   - **Az eredmény:** egy konverzió így olyan külső kódot futtat, amely a program többi írásának sorrendjét megfigyeli.
   - **A futtatókörnyezet érintetlen:** a program előtt senki nem definiál újra beépítettet vagy a program globális neveit (lásd a 4. pontot).
2. **Hatókör:**
   - **Modulok:** csak szkriptekre. Egy modul kötéseit külső kód nem éri el, ezért ott a `record` csak rögzít.
   - **Az érvényes adat szerződése:** az `inputs: 'valid'` szerződés ilyen külső kódot nem ígér (ADR-050), ezért ott a változat kimarad.
   - **Ha a referencia nem fut le ebben a környezetben**, a változat nem számít, ahogy minden környezetváltozatnál (ADR-062).
3. **A kampány** a `--environments=strict,hostile` kapcsolóval futtatja.
4. **A szerződés határa:** a szigorú szerződés a programba érkező értékekre és a külső függvények hívás közbeni viselkedésére szól, nem egy előre megbabrált futtatókörnyezetre.
   - Ha egy korábbi szkript a program `var` neveire accessort tehetne, vagy beépítettet írhatna felül (például az `Array.prototype.push`-t), szinte semmilyen sorrendcsere nem volna biztonságos.
   - Az ellenfél első változata ilyen accessorokat is definiált, és a kampány `script` JS fajtájában 114 hibás elfogadást talált. Mind egy `var` értékadás miatt, amelyet a generátor joggal tekint kódot nem futtatónak.
   - A végleges ellenfél ezért ezt a részt nem tartalmazza. A szabálycsaládot érintő változásnál (ADR-074 tanulsága) ez is a futtatandó környezetváltozatok része.

## Helyességi érv

A változat csak olyan külső kódot futtat, amelyet a szigorú szerződés megenged: egy külső függvény eléri a szkript globális változóit, a `let`-eket is, mert a szkriptek közös globális lexikai környezetben futnak.

Ha egy elfogadott sorrend ebben a környezetben másként fut, az a szerződés megsértése, tehát hibás elfogadás. Ha egy elutasított sorrend másként fut, az elutasítás indokolt.

A változat nem teljes ellenfél: objektumargumentumokat nem módosít, és nem minden lehetséges konverziót vált ki. Ezért amit nem talál, az nem bizonyítottan egyenértékű, csak ebben a környezetben az.

## Mérés

**Teljes kampány, 12 mag, 7 fajta, 2 nyelv, `--environments=strict,hostile`:**
- **v45-ön** (az [ADR-082](082-script-bindings-since-declaration.md) előtt), a `function`, `class`, `param`, `script` és `inherit` fajtán: 0 hibás elfogadás. A `script` JS 5 réséből 3 indokolt elutasítás lett, 2 rés maradt (NY-24).
- **v46-on**, mind a 7 fajtán: 366 123 sorrend, 0 hibás elfogadás.
  - A `script` JS 0 rés.
  - A rés 59 → 32 (a többi változás az [ADR-080](080-observed-heap-intent.md) és az ADR-082 hatása).
- **Az első ellenfél** (korábbi szkript accessorokkal) a `script` JS-ben 114 hibás elfogadást mutatott. Ez az ellenfél hibája volt (4. pont), nem a generátoré.

A szigorú bemeneti szerződés globális változókra vonatkozó oldalát ez a mérés vizsgálja először. Hibás elfogadást nem talált.

## Bizonyíték

[hostile-environment.test.mjs](../../tests/hostile-environment.test.mjs):
- **konverzió a külső kód után:** a `v5`/`l3` csere a jóindulatú orákulumban rés, a rosszindulatúban indokolt;
- **érintetlen futtatókörnyezet:** a `c6`/`v5` csere rés marad (NY-24), a tanúnak 2 rése és 0 hibás elfogadása van;
- **`inputs: 'valid'`:** a csere elfogadott, a változat kimarad, 0 hibás elfogadás;
- **modul:** a `record` csak rögzít, 0 hibás elfogadás.

## Tervezési review (ADR-037)

- **Tulajdonos:** az orákulum környezetkezelése.
  - Az ellenfél kódját egy függvény állítja elő (`hostileRecord`).
  - A korábbi szkript ugyanabban a kontextusban, a program előtt fut.
  - A generátor, a mag és az osztályozó nem változott.
- **Design twice:**
  - *A generátor lazítása a `script` résre:* elvetve, mert a kötés a szerződés szerint helyes.
  - *Korábbi szkript a program neveire definiált accessorokkal:* elvetve (4. pont). Túllép a szerződésen, és a generátor helyes szabályait hibás elfogadásnak mutatta.
  - *A rés átsorolása szándéknak:* elvetve. A szándék a referencia intencióját jelenti (ADR-043, ADR-067). Ez itt valódi viselkedés egy megengedett környezetben, ezért indokolt elutasítás, és ezt csak egy olyan orákulum mutathatja, amely ezt a környezetet futtatja.
