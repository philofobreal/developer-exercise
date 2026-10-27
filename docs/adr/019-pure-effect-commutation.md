# ADR-019 – Tiszta egység és hatás-barrier kommutációja; számlálóváltozók

Állapot: implementálva (`scoped-effect-analysis-v10`). A validátor, a CodeLine-séma jelentése, a tanulói parsermentes értékelés és a bizalmi határ változatlan. A már importált modellek függőségei nem generálódnak újra; az új szabályt csak új generálás vagy explicit „Sorfüggőségek újraszámítása” hozza.

## Kontextus

A tanulói felületen a `binarySearch` példa két első sora nem volt felcserélhető a szerzői előnézetben, amely a forrásból generált modellt használja:

```js
let low = 0;
let high = sorted.length - 1;
```

Ugyanígy elutasított volt az `insertionSort` ciklusmagjában a `const current = values[i];` és a `let j = i - 1;` cseréje. Egy JavaScript-szakember mindkettőt ekvivalensnek tartja, és a futás is az. A kézzel hangolt könyvtári modell elfogadta, a generált nem.

**Ok, a v9 P2 szerint:**

- Egy listán belül minden olyan pár kötött, amelynek legalább egyik tagja *külső* hatású.
- A `sorted.length` property-olvasás, amely getter lehet, ezért barrier. A `values[i]` ugyanígy.
- A `let low = 0;` tiszta, mégis a barrierhez kötődött.
- A `let j = i - 1;` nem is számított tisztának. Az `i`-t a `for` fejléce `++`-szal írja, ezért nem volt „primitívnek” bizonyítva, márpedig koerciós operátor (`-`) csak primitív operanduson tiszta.

A szabály biztonságos volt, de túl erős. A barrier által futtatott ismeretlen kód egy tiszta, blokkszintű, lokális deklarációt csak akkor figyelhet meg, ha:

- closure-ön át látja, vagy
- a barrier szintaktikusan hivatkozik rá, vagy
- a barrier a vezérlést a lista elhagyására viszi, amivel a deklaráció végrehajtása is megváltozik.

## Döntés

### 1. Tiszta egység és barrier kommutációja (P2 pontosítása)

Egy függvényszintű lista `pure` egysége (U) és barrierje (B) között nincs él, ha mind teljesül:

1. **Kontextus:** U listája függvénykontextusban van (nem szkript- vagy modulszinten), és a kontextus nem használja az `arguments`-et (sloppy módban a paramétert aliasolja). A `with` és a közvetlen `eval` eddig is az egész fájlt elemzetlenné tette.
2. **Vezérlés:** B nem hagyhatja el önmagát korán:
   - nincs benne `return`, `throw`, `yield` vagy `await`;
   - nincs benne kifelé ugró `break` vagy `continue`;
   - nem `for await` és nem `using` deklaráció. A `using` erőforrást regisztrál, az `await using` a blokk végén vár.

   A belső függvény- és osztálytörzs nem számít.
3. **B fajtája:** hatás-barrier, vagy alakkonzervatív barrier (`declaration-shape`, `shared-or-continued-rows`). A többsoros, lyukas egységet a lezárás (ADR-009) továbbra is a forrásbeli oldalán tartja; ezt a projekciós veszteség méri (ADR-017).
4. **U saját kötései:** U minden írása U-ban deklarált `let`/`const`/osztály (nem `var` és nem `using`). Egyikre sem hivatkozik:
   - más függvénykontextus (closure, mezőinicializáló, static blokk);
   - B, sem kötés, sem név szerint.
5. **U olvasott kötései:** U minden olvasott kötése ebben a függvénykontextusban deklarált, és nem írja:
   - más kontextus (kötés és név szerint);
   - B, sem kötés, sem név szerint.

**A névalapú feltétel:** a névegyezés egy árnyékoló kötésnél is tilt. Ez csak szigorít, viszont pontosan ugyanazt a szabályt adja, mint a független orákulum, amely kötésfeloldás nélkül, név szerint dönt.

**Helyesség:**

- U nem futtat kódot és nem dob (ADR-008/009).
- B két esetben ér véget:
  - **rendes befejezés:** U kötései és olvasott értékei ugyanazok, mert B nem írja őket, és closure sem írhatja;
  - **kivétel:** a vezérlés elhagyja a blokkot, U blokkszintű kötése pedig a blokk után csak closure-ön át lenne látható, ilyen viszont nincs. Egy `catch` vagy `finally` nem látja a blokkszintű kötést.
- B semmit nem láthat U-ból, mert nem hivatkozik U kötéseire, és closure sem hivatkozik rájuk.
- Ezért a csere egyetlen kötés értékét, a hatásnaplót és a kivételt sem változtatja meg.

**Szándékosan kötött marad**, akkor is, ha a futás nem különböztetné meg:

- a `return`/`throw`/`break` utáni halott kód. Pedagógiailag nem ekvivalens egy deklarációt egy `return` mögé tenni;
- a `var`;
- a szkriptszint.

### 2. Számlálóváltozó primitív értéke

Egy `let`/`var` kötés olvasása primitív, ha:

- a kezdőértéke primitív (BigInt nélkül), és
- minden további írása `++` vagy `--`, kötés szerint az egész fájlban.

Ez igaz a sima `for` fejléc egyetlen deklarációjára is. Indok: a `++`/`--` számon számot ad, ezért a `i - 1` nem futtathat `valueOf`-ot és nem dob. A `for-in`/`for-of` változója kimarad.

## Az orákulum

A [semantic-oracle.mjs](../../tests/support/semantic-oracle.mjs) P2-je saját, a generátortól független, Acorn-, illetve TS-AST-alapú implementációval követi a szabályt:

- `commutation()`, `jsRefs`/`tsRefs`, `jsTransfers`/`tsTransfers`;
- név szerint, kötésfeloldás nélkül;
- blokkszintű függvénydeklarációt (Annex B) nem enged át.

Az [ordering-semantics.test.mjs](../../tests/ordering-semantics.test.mjs) korábbi, saját régi P2-másolata helyett ugyanezt az orákulumot használja.

## Következmények

- **Policy-címke:** `scoped-effect-analysis-v10` (additív sémabővítés). A v10 P2-je szigorúan bővebb a v9-énél.
- **A régi modellek** a saját címkéjükkel maradnak érvényesek. A minősítési kapu (ADR-017) a v9-es modellt `outdated` elemzőverzióval jelzi.
- **Mérés:** lásd a [formális szerződést](../formal-ordering-contract.md#adr-019-tiszta-egység-és-hatás-barrier-kommutációja).
- **Projekciós veszteség:** néhány új szabadságot a lezárás (ADR-009) nem enged át. A CopyFieldben ez 3 pár, a `wp6-hoisted-into-continued-call` fixture-ben egy további pár. A gate ezeket `conservative` státusszal jelzi.

## Ami nem változott (nyitott döntés)

A következő szigorítások nem ennek az ADR-nek a tárgyai:

- **A reflektált kulcssorrend (P4, ADR-010):** a szkriptszintű függvények egymás közti sorrendje és a metódusok sorrendje kötött marad, mert az `Object.keys(globalThis)` és a prototípus kulcssorrendje megfigyelhető.
- **A paraméterek property-olvasásai** (getter, proxy) barrierek maradnak.

Ezek feloldása a megfigyelhető állapot definíciójának megváltoztatása, tehát külön policydöntés.
