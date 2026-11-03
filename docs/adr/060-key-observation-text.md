# ADR-060 – Pontosabb szöveges kulcsmegfigyelés (v31)

Állapot: **elfogadva** (2026-11-03), szabályverzió `scoped-effect-analysis-v31`. Pontosítja az [ADR-020](020-unobserved-key-order.md) és az [ADR-029](029-unobserved-instance-field-order.md) szöveges szabályát. A ki nem írt nevek elemzése ([ADR-052](052-unspelled-property-names.md), [ADR-053](053-folded-names-and-returns.md)) változatlan.

## Kontextus

Az ADR-020 és -029 szerint a program akkor figyeli meg a kulcsok létrehozási sorrendjét, ha a szövegében szerepel egy kulcslistázó vagy reflexiós név: `keys`, `values`, `entries`, `stringify`, `self`, `frames`, `global` és társaik. A szöveges illesztés minden előfordulást talált, a program saját neveit is.

**Példa:** a `task-ledger-js` feladat könyvelő osztályában van egy `this.entries = []` mező. Emiatt a konstruktor három mezőírása (`owner`, `balance`, `entries`) kötött volt, holott a program sehol nem listáz kulcsot (5 mért rés). Tanulói kódban a `values`, `entries`, `keys`, `self` és `frames` gyakori saját név.

## Döntés

A minták egy maszkolt szövegre illeszkednek. Ebben a következő előfordulások szóközzé válnak (a sortörés megmarad):

1. **megjegyzések;**
2. **a program saját deklarált nevei:** változó, paraméter, függvény, osztály, osztály- és objektumliterál-tag, típustag, enumtag, valamint az átnevező destrukturálás helyi neve;
3. **hivatkozás egy saját változóra,** ha a neve csak tulajdonságként létező API-név (`keys`, `values`, `entries`, `stringify`, `assign`, `getOwnPropertyNames`, `ownKeys`, `getOwnPropertyDescriptors`). Ilyen nevű globális nincs, ezért a csupasz hivatkozás a programé. Kivétel, ha van `with`.
4. **a program saját példányának tulajdonsága:**
   - `this.x` az osztálytörzsben;
   - `v.x`, ha `const v = new C(…)`, a `C` a fájl osztálya öröklés és értéket visszaadó konstruktor nélkül, a `v` neve a fájlban egyedi, és a hivatkozás a deklaráló blokkon belül van.

   Kivétel, ha egy metódus újraköthető: a szöveg `call`, `apply`, `bind`, `Reflect`, `prototype`, `setPrototypeOf`, `__proto__` vagy `with` elemet tartalmaz, egy metódust hívás nélkül olvasnak, vagy egy ki nem írt név ilyen lehet.

**Ami szöveges marad:** a sztring és a sablon, más érték tulajdonsága (`o.entries`), a destrukturált tulajdonság (`const {entries} = o`), a globális nevekre mutató hivatkozás, a spread és a `for…in`.

## Helyesség

Egy beépített kulcslistázó függvényt vagy a globális objektumot a program csak úgy érheti el, ha:
- kiolvassa egy tulajdonságból (`Object.entries`, `o.entries`): ez szöveges marad;
- ki nem írt névvel olvassa: az ADR-052/053 elemzése követi;
- egy globális névvel hivatkozik rá: szöveges marad;
- vagy a `with` és az újrakötés útját használja: ilyenkor nincs maszkolás.

A maszkolt előfordulások egyike sem ilyen út:
- a deklaráció nevet ad, nem olvas;
- a tulajdonságként létező API-név csupasz hivatkozása csak saját változó lehet;
- a saját példány tulajdonsága csak azt adja vissza, amit a program beleírt, és a beleíráshoz a fenti utak egyike kell.

## Bizonyíték

- **Új tesztek** ([key-observation-text.test.mjs](../../tests/key-observation-text.test.mjs)):
  - **nem számít:** a mező, a helyi változó, a megjegyzés, a `this.self` és a `this.frames`;
  - a könyvelő mezőírásainak cseréje elfogadott, 0 hibás elfogadással;
  - **továbbra is számít:**
    - `Object.entries` és `o['entries']`;
    - destrukturálás, ismeretlen érték tulajdonsága, `with`;
    - `call`, hívás nélkül olvasott metódus;
    - más objektumot visszaadó konstruktor, kétszer deklarált név;
    - objektumliterál tulajdonsága.
- **Korpusz:** a `task-ledger-js` és a `task-ledger-js-valid` 5–5 rése megszűnt (27 → 32 elfogadott szomszéd). A többi rögzített szám változatlan.
- **Generatív alapérték:** csak a címke változott.

## Korlátok

- **Globális nevű saját változó** (`self`, `frames`, `global`): csak a deklarációja maszkolt, a hivatkozásai szövegesek maradnak, mert a hatókört a modul nem oldja fel.
- **Az orákulum** szöveges szabálya változatlanul szigorúbb. Mellette fut a futásidejű elérési tanú ([ADR-058](058-oracle-reach-witness.md)), ezért a mérés a mostani lazítást a generátortól függetlenül ellenőrzi.

## Tervezési review (ADR-037)

- **Tulajdonos:** a `js-ts-ordering` modul, amelyhez a két minta is tartozik (`keyObservationText`).
- **Interfész:** a `namesMatch` egy opcionális szöveget kap, alapértéke a forrás. A szöveget a `jsTsOrderingRelations` egyszer számolja ki, és mindkét kérdéshez átadja.
- **Elrejtve:** a maszkolási szabályok és az újrakötés felismerése.
