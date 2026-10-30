# ADR-046 – Ciklusok a saját objektumokon (v23)

Állapot: **elfogadva** (2026-10-31), szabályverzió `scoped-effect-analysis-v23`. A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 4. fázisának 4. tétele (bizonyítottan véget érő ciklusok).

## Kontextus

**A mért ok:** a `flow` csoport két ciklusalakja ismeretlen kód volt, ezért a bennük nevezett objektumok megszöktek:

```js
for (let i = 0; i < 2; i++) { a.bump(); }
while (a.count < 3) { a.bump(); }
```

**Az orákulum is így ítélt:** a P2 objektumművelet-definíciója nem ismerte a `while`/`for` ciklust, ezért külső hatásnak vette.

## Tervezési változatok

- **Csak a bizonyíthatóan véget érő ciklus.** A `while`-hoz monotonitást kellene bizonyítani (a feltétel mezőjét csak növelő törzs, felső korlát); ez törékeny és szűk.
- **Minden ciklus hatásnyomot kap, a nem bizonyítottan véget érő „esetleg nem ér véget” jelölést** (`mayHang`). Ezt választottuk.
  - **Miért helyes:** a ciklus csak azt olvassa, amit a vele ütköző írások állítanak be, és azok sorrendben maradnak. Így minden elfogadott sorrendben ugyanúgy fut le vagy akad el.
  - **Mit nem lát a végtelen futás:** az elakadást csak egy kivétel, egy külső hívás vagy egy másik elakadás különbözteti meg. A saját objektumok állapota a lista `return`-je nélkül nem látszik.

## Döntés

1. **Hatásnyom** ([object-footprints.ts](../../src/author/object-footprints.ts)): a `while`, a `do…while` és a `for` a saját objektumokon hatásnyomot kap.
   - A `for` feje üres vagy blokkhatókörű deklaráció lehet.
   - A feltételt, a törzset és a léptetést egyszer értelmezi. A ciklus által írt lokálisok ismert értéke elvész, ez lefed minden iterációt.
   - A címke nélküli és a körülvevő címkére mutató `break`/`continue` megengedett.
   - A lokális számláló `++`/`--` léptetése primitív marad.
2. **Terminálás:** bizonyított, ha a ciklus `for (let i = <szám>; i < <szám>; i++)` alakú (`<=`, illetve csökkenő irányban `>`, `>=` és `i--`), és a törzs nem írja `i`-t.
   - Minden más ciklus `mayHang`.
   - Az ütközésben a `mayHang` úgy köt, mint egy lehetséges kivétel: `may-throw` egy másik kivétellel, külső hívással vagy elakadással. A jegyzék jelentése ennek megfelelően bővült.
3. **Sortulajdon:** a ciklus első sora a törzs nyitó kapcsos zárójeléig, az utolsó a záróig tart (`do…while`-nál a `} while (…);` sorig).
4. **Orákulum** ([semantic-oracle.mjs](../../tests/support/semantic-oracle.mjs), JS és TS):
   - a `while`, a `do…while` és a `let` fejű, `++`/`--` léptetésű `for` objektumművelet, ha a feltétele érték, és a törzse objektumműveletekből áll;
   - a törzsben a ciklus saját fejváltozójának írása is megengedett;
   - a saját objektumból induló, nem számított tulajdonságlánc (például `a.log.length`) is érték, ahogy a generátorban; ez az `if` feltételeire is igaz volt, csak a mérésben eddig nem fordult elő;
   - a P3 dönt.
5. **Ami barrier marad:** a külső változót író fej (`for (i = 0; …)`), a nem blokkhatókörű fej, és a `return`-t tartalmazó ciklus.
6. **Szabályverzió:** v23.

## Bizonyítékok

- **Tesztek:** [loop-footprints.test.mjs](../../tests/loop-footprints.test.mjs), mindegyik az orákulummal ellenőrizve.
  - **Szabad:**
    - a számlálós ciklus egy külső hívással, növekvő és csökkenő irányban is;
    - a `while` és a `do…while` egy másik objektum műveletével;
    - TypeScript.
  - **Kötött:** a ciklus írja, amit a későbbi művelet olvas.
  - **Konzervatív (mért rés, `may-throw`):** a `while`, illetve a számlálót író törzs egy külső hívással; mindkettő valójában véget ér.
  - **Barrier marad:** a külső változót író fej.
- **Mérés azonos (új) orákulummal, 12 mag:**

  | Csoport | v22 generátor | v23 generátor |
  | --- | ---: | ---: |
  | flow JS | 22,2% | 15,0% |
  | flow JS, dobó | 23,6% | 17,6% |
  | flow TS | 18,7% | 11,8% |
  | flow TS, dobó | 7,5% | 5,6% |

  - Hibás elfogadás nincs.
  - **Miért nem a régi számokhoz mérünk:** az orákulum változása miatt a régi orákulumhoz mért értékek nem összevethetők. A ciklusok P3-as megítélése több egyenértékű sorrendet tár fel (ugyanaz a jelenség, mint az ADR-042-nél).
- **Gyors baseline (újrarögzítve):** flow JS 19,2% → 14,8%, flow TS 5,8% → 9,3%. Az utóbbi növekedés az orákulum változásából jön: a ciklusokat most a P3 ítéli meg, és több egyenértékű sorrendet lát. Azonos orákulummal a v23 mindkét csoportban javít (táblázat).
- **Maradék:** a `while`-hoz a terminálás nem bizonyított, ezért kivétellel vagy külső hívással kötött (mért `may-throw` rés).
