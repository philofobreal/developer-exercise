# ADR-031 – A konstruktor `this`-e saját objektum (v15)

Állapot: implementálva (2026-10-28). Policyverzió: `scoped-effect-analysis-v15`. Az [ADR-025](025-local-object-effect-footprints.md) és az [ADR-028](028-runtime-precise-object-footprints.md) hatásnyomát terjeszti ki, az [ADR-029](029-unobserved-instance-field-order.md) megfigyelési szerződésével. A validátor, a séma és a tanulói értékelés változatlan.

## Kontextus

Az ADR-029 lezárásakor rögzített rés: a `01-user-account` mintában a `this.name = name;` és a `this.id = id;` sorrendje kötött maradt. A futásidőben mindkét sorrend ugyanazokat az értékeket adja, csak a kulcsok létrehozási sorrendje tér el (`useDefineForClassFields: false` mellett). A program viszont nem listázza a kulcsokat, tehát a felhasználó elve szerint a két sor szabad. Az ok: a `this`-re írás utasításszintű barrier volt, a `this` nem kapott hatásnyomot.

## Döntés

### 1. A `this` mint saját objektum

Egy osztály konstruktorának törzsében a `this` a lista saját objektuma, ha az osztály az ADR-025 szerint elemezhető:

- nincs `extends`, dekorátor, absztrakt mód, `accessor` mező;
- a tagnevek egyértelműek.

A törzs ugyanabból az állapotból indul, amelyet a konstrukció hagy maga után. A mezőinicializálók és a paramétertulajdonságok a törzs előtt futnak. Egy paramétertulajdonság értéke kívülről érkezik.

**Paraméter:** a konstruktor paramétere külső érték (`other`). Eltárolható, de rajta végzett művelet (például `a + b`, ami egy objektum `valueOf`-ját hívhatja) ismeretlen kód, és az utasítás barrier marad.

**Szökés:** a `this` kiszökik, ha egy utasítás hatásnyom nélkül nevezi meg. Ilyen például a `register(this)`, a `return` vagy egy ismeretlen hívásba adott nyílfüggvény. Ilyenkor minden, a `this`-t érintő utasítás barrier marad. A beágyazott, nem nyíl függvény és osztály `this`-e másik objektum.

**Dobás:** ha a konstruktor dob, a `new` sikertelen, és a ki nem szökött `this` senki számára nem látszik. Az ADR-028 egyetlen-kivétel szabálya ugyanúgy érvényes.

### 2. Új kulcs a megfigyelési szerződés szerint

Az ADR-028 a saját objektumra írt új kulcsot egész objektumnak vette, mert a kulcssorrend megfigyelhető. Az ADR-029 óta a kulcssorrend csak a kulcsokat listázó programban számít. Ezért kulcsokat nem listázó programban az új kulcsot létrehozó írás mezőszintű, kulcsokat listázóban továbbra is egész objektum. Ez a lokális objektumokra (ADR-028) is érvényes.

## Független orákulum

**Helyi objektumművelet** a nem származtatott osztály konstruktorában (TS és JS):

- a `this.p = érték`;
- a `this.m(értékek)`.

**Az „érték” köre bővült** (P2):

- egyszerű érték, saját objektum mezője;
- template, tömb- és objektumliterál;
- aritmetika és összehasonlítás ezekből.

Egy saját objektumokon dolgozó `if/else` ágában `throw new Error(érték)` is állhat. Két ilyen művelet sorrendjét az ADR-025 elve szerint csak a futásidejű P3 dönti el. A tényleges hatásuk a saját objektumokon marad, amelyet a P3 lát.

## Következmények

- **`01-user-account`:** a konstruktor két `this`-írása felcserélhető; a teszt a rést már nem rögzíti, hanem pontos egyezést vár (8/8 kombináció).
- **`04-declare-fields`:** a két értékadás felcserélhető, a próba rendezett kulcshalmazt figyel.
- **`07-repeat-write`:** az azonos mező kétszeri írása kötött marad. Most már pontos okkal: mezőszintű WAW.

**Nem változik:**

- a származtatott osztály konstruktora;
- a kulcsokat listázó program;
- a paramétereken végzett művelet;
- a kiszökő `this`.

## Bizonyíték

[constructor-footprints.test.mjs](../../tests/constructor-footprints.test.mjs) és kilenc új fixture az [object-programs.mjs](../../tests/fixtures/object-programs.mjs)-ben. Az objektumhatás-csomag minden fixture minden elfogadott egysoros mozgatását a futásidejű orákulummal ellenőrzi.

**Lefedett esetek:**

- független írások;
- olvasás írás után;
- kiszökő `this`;
- kulcsokat listázó program;
- származtatott osztály;
- metódushívás a `this`-en;
- paraméteren végzett művelet;
- dobó ellenőrzés;
- TypeScript paramétertulajdonság.
