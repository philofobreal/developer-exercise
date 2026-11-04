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

A generátor a `let l3 = v1 + 1` és a `var v5 = 6` sort, illetve a `var v5 = 6` és a `const c6 = l3 + 1` sort is egymáshoz köti (`effectful-or-unknown-initializer`). Az okai a szigorú bemeneti szerződésből (`inputs: 'any'`) következnek:
- **A külső hívás:** a `record` külső kód, és átírhatja a szkript globális `v1` változóját egy saját `valueOf`-ot futtató objektumra. Ekkor a `v1 + 1` kódot futtat, amely megfigyelheti, hogy a `v5` már értéket kapott-e.
- **A korábbi szkript:** definiálhatott a `v5` nevén accessort a globális objektumon, és a program `var` deklarációja ezt megtartja. Ekkor a `v5 = 6` egy settert futtat, amely átírhatja az `l3`-at. A `c6 = l3 + 1` ezért a `v5` után kódot futtathat.

Az orákulum `record`-ja jóindulatú, és korábbi szkript sincs, ezért a mérés ezeket résnek látta. Valójában a szerződés által indokolt kötések.

Ugyanez fordítva is igaz: a szigorú szerződés ezen oldalát eddig egyetlen orákulumváltozat sem próbálta. Ha a generátor itt túl laza volna, a hibás elfogadás rejtve maradna.

## Döntés

1. **Új környezetváltozat: `hostile`** ([semantic-oracle.mjs](../../tests/support/semantic-oracle.mjs), `hostileRecord`).
   - **Korábbi szkript:** egy, a program előtt futó szkript a program minden felső szintű `var` nevére konfigurálható accessort definiál a globális objektumon. A program `var` deklarációja ezt megtartja.
   - **A beavatkozás:** a `record` minden hívás után, és minden ilyen setter minden értékadás után, a program minden primitív felső szintű változóját (`var`, `let`; a `const` írása elbukik, és ez nem baj) egy megfigyelő objektumra cseréli.
   - **A megfigyelő objektum** ugyanarra az értékre konvertálódik vissza (`valueOf`, `toString`), és minden konverziókor a nyomba írja az összes felső szintű változó pillanatnyi értékét.
   - **Az eredmény:** egy konverzió vagy egy setter így olyan külső kódot futtat, amely a program többi írásának sorrendjét megfigyeli.
2. **Hatókör:**
   - **Modulok:** csak szkriptekre. Egy modul kötéseit külső kód nem éri el, ezért ott a `record` csak rögzít.
   - **Az érvényes adat szerződése:** az `inputs: 'valid'` szerződés ilyen külső kódot nem ígér (ADR-050), ezért ott a változat kimarad.
   - **Ha a referencia nem fut le ebben a környezetben**, a változat nem számít, ahogy minden környezetváltozatnál (ADR-062).
3. **A kampány** a `--environments=strict,hostile` kapcsolóval futtatja. A szabálycsaládot érintő változásnál (ADR-074 tanulsága) ez is a futtatandó környezetváltozatok része.

## Helyességi érv

A változat csak olyan külső kódot futtat, amelyet a szigorú szerződés megenged:
- **a `record` írja a globálisokat:** egy külső függvény eléri a szkript globális változóit, a `let`-eket is, mert a szkriptek közös globális lexikai környezetben futnak;
- **egy korábbi szkript accessort definiál:** a `var` deklaráció egy már létező, konfigurálható globális tulajdonságot nem definiál újra.

Ha egy elfogadott sorrend ebben a környezetben másként fut, az a szerződés megsértése, tehát hibás elfogadás. Ha egy elutasított sorrend másként fut, az elutasítás indokolt.

A változat nem teljes ellenfél: objektumargumentumokat nem módosít, és nem minden lehetséges konverziót vált ki. Ezért amit nem talál, az nem bizonyítottan egyenértékű, csak ebben a környezetben az.

## Mérés

*A kampány lefutása után kitöltve.*

## Bizonyíték

[hostile-environment.test.mjs](../../tests/hostile-environment.test.mjs):
- **konverzió a külső kód után:** a `v5`/`l3` csere a jóindulatú orákulumban rés, a rosszindulatúban indokolt;
- **egy korábbi szkript settere:** a `c6`/`v5` csere indokolt; a tanúnak 0 rése és 0 hibás elfogadása marad;
- **`inputs: 'valid'`:** a csere elfogadott, a változat kimarad, 0 hibás elfogadás;
- **modul:** a `record` csak rögzít, 0 hibás elfogadás.

## Tervezési review (ADR-037)

- **Tulajdonos:** az orákulum környezetkezelése.
  - Az ellenfél kódját egy függvény állítja elő (`hostileRecord`).
  - A korábbi szkript ugyanabban a kontextusban, a program előtt fut.
  - A generátor, a mag és az osztályozó nem változott.
- **Design twice:**
  - *A generátor lazítása a `script` résre:* elvetve, mert a kötés a szerződés szerint helyes.
  - *A rés átsorolása szándéknak:* elvetve. A szándék a referencia intencióját jelenti (ADR-043, ADR-067). Ez itt valódi viselkedés egy megengedett környezetben, ezért indokolt elutasítás, és ezt csak egy olyan orákulum mutathatja, amely ezt a környezetet futtatja.
