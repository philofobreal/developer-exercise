# ADR-029 – A kódot nem futtató példánymezők sorrendje csak kulcsokat listázó programban kötött (v14)

Állapot: implementálva (2026-10-28). Policyverzió: `scoped-effect-analysis-v14`. Az [ADR-012](012-class-evaluation-phases-and-accessor-pairs.md) mezőfázisait és az [ADR-020](020-unobserved-key-order.md) megfigyelési szerződését bővíti a példánymezőkre. A validátor, a CodeLine-séma jelentése és a tanulói parsermentes értékelés változatlan. A már importált modellek függőségei csak kifejezett frissítésre (ADR-006) kapják meg az új címkét.

## Kontextus

A felhasználó a `runMiniFixture` példán (2026-10-28) megkérdezte, miért hibás a `state: State = "idle";` és a `score = 0;` sor felcserélése. A mérés szerint:

- **Fordítás:** strict TypeScript mellett mindkét változat 0 hibával fordul.
- **Értékek:** mindkét osztálymező-módban azonosak.
- **Különbség:** csak a példány saját kulcsainak létrehozási sorrendje (`Object.keys`, `JSON.stringify`). Ezt a v13 (ADR-012, P4) a megfigyelhető viselkedés részének vette.

A felhasználó döntése (a felkínált választás alapján): **a példánymezők kulcssorrendje alapból ne számítson**. Csak akkor számítson, ha a program maga listázza a kulcsokat, vagy ha egy inicializáló egy másik mezőt olvas. Ez ugyanaz a szerződés, amelyet az ADR-020 a metódusokra már bevezetett.

## Döntés

### 1. Laza példánymező

Egy osztály példánymezője **laza**, ha:

- egyszerű (nem számított, nem dekorált, megjegyzés nélküli) nevű, és a név egyedi az osztálytörzsben;
- nem `static`, nem `accessor` mező;
- **nincs kezdőértéke**, vagy a kezdőértéke **kódot nem futtat**: string-, szám-, BigInt- vagy template-literál, `true`/`false`/`null`, előjeles szám, illetve ezekből álló tömb- vagy objektumliterál (nem számított kulcsokkal, `__proto__` nélkül);
- és a program **nem listázza a kulcsokat**.

Két laza mező egymáshoz képest szabad. Minden más, konstrukciókor futó egység (például a `b = this.a + 1` vagy a `c = f()` mező) továbbra is követi az összes előtte álló laza mezőt, és a laza mezők is követik az előttük álló ilyen egységet. A fázisok közti szabadság (ADR-012) és az ADR-009 szerinti pozíciófüggetlen konstruktor változatlan.

Az `abstract` mező semmit nem bocsát ki, ezért a feltételek mellett szintén laza. Az ADR-012 óta konzervatív kezelése így feloldódik.

### 2. Mikor listázza a program a kulcsokat

Kötött marad a sorrend, ha a forrás szövegében (stringben is, ami csak szigorúbb):

- reflexiós API vagy a globális objektum neve szerepel (ADR-020: `getOwnPropertyNames`, `Reflect`, `globalThis` stb.);
- kulcslistázó, szerializáló, másoló vagy kiíró név szerepel: `keys`, `values`, `entries`, `stringify`, `assign`, `structuredClone`, `console`, `inspect`;
- bármilyen spread (`...`) vagy `for … in` van benne.

A szöveg szerinti felismerés szándékosan durva. Egy tömb `values()` hívása is kötöttséget ad, ami helyes, csak szigorúbb.

### 3. A megfigyelési szerződés pontosan

**A szerződés a program saját kódjára vonatkozik.** Ha egy hívó kívülről sorolja fel a visszaadott objektum kulcsait (például egy pillanatkép-teszt vagy egy naplózó), az ennek a feladatnak nem része. Ez ugyanaz a határ, mint a metódusok prototípus-kulcsainál (ADR-020). Ha egy feladatban a JSON-kimenet pontos alakja a cél, a szerző a sorrendet szerzői szabállyal köti (ADR-018, kapcsolatkapcsoló: ADR-024), vagy a programba írja a megfigyelést.

## Független orákulum

Az orákulum ugyanezt a szerződést saját implementációval követi:

- **P4:** a példánymezők kulcsai halmazként hasonlítanak, ha a fixture nem listáz kulcsokat. A felismerés ugyanazzal a szöveges szabállyal történik.
- **P3:** a visszatérési értéket és a naplót kulcsrendezett JSON-ként veti össze.
- **Fixture-ök:** azokat, amelyek próbája maga hívott `JSON.stringify`-t (`prompt-mini-fixture`, `prompt-one-thrower`), objektumot visszaadó próbára írtuk át. Így a szerializálást az orákulum végzi.

A generátor felismerése legalább olyan tág, mint az orákulumé. Ami a generátornál szabad, azt az orákulum sem tekinti kulcslistázó programnak.

## Következmények

- **`01-user-account` minta:** a kezdőérték nélküli `name` és `id` mező felcserélhető. A suite próbája rendezett kulcshalmazt figyel, az elvárt cserék frissültek.
- **Megmaradó szigorúság:** a konstruktorban a `this.name = name;` és a `this.id = id;` sorrendje továbbra is kötött. A `this`-re írás utasításszintű barrier, és `useDefineForClassFields: false` mellett ez hozza létre a kulcsokat. Ez ismert completeness-rés; a teszt pontosan rögzíti.
- **Változatlan:** a statikus mezők sorrendje (a konstruktor felsorolható kulcsai), az `accessor` mezők és a saját objektumokra írt új kulcsok (ADR-028, egész objektum) kötöttek maradnak.
- **Nem változik:** a TS-mintatár többi modelljében csak a címke és a tömörített magyarázó szöveg.
