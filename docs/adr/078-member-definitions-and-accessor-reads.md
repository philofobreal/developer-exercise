# ADR-078 – Tagdefiníciók azonos néven, getteren át olvasó kezdőérték, privát laza mező (v44)

Állapot: **elfogadva** (2026-11-04), szabályverzió `scoped-effect-analysis-v44`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-22 tétele, a (c) ok. Kiegészíti az [ADR-012](012-class-evaluation-phases-and-accessor-pairs.md) accessorpárját, az [ADR-068](068-binding-context-member-phases-early-exit.md) azonos kulcsú definícióit és az [ADR-077](077-base-setter-footprints.md) hatásnyomát.

## Kontextus

A v43 után az `inherit` kampány maradék rései (környezetváltozatokkal: JS 16, TS 18) hat tanúban jelentek meg, öt okkal:

| Tanú | Ok |
| --- | --- |
| `random-inherit-typescript-4` | A `get ['k3']()` számított nevét a szabály kiértékelendő kulcsnak vette (`key` fázis), holott egy szöveges literál kódot nem futtat. |
| `random-inherit-javascript-4` | Az ősben egy getter–setter pár és egy azonos nevű mező áll. A pár nem volt pár (a név háromszor szerepel), ezért a definíciók kötöttek maradtak. |
| `random-inherit-*-3` | Getter, setter, majd egy azonos nevű metódus. A lánc mindhármat sorba kötötte, pedig az egymás melletti getter és setter bármely sorrendben ugyanazt a tulajdonságot adja. A leszármazott `f0 = 3` mezőjét is kötötte, mert az azonos nevű tagok vegyesek. |
| `random-inherit-*-1` | Az `f0 = this.f2` egy ős gettert olvas, amely csak `this._f2`-t olvas. A szabály minden ilyen kezdőértéket kódfuttatónak vett. |
| `random-inherit-*-12` | A program kiírja a példányt (`JSON.stringify`), ezért egyik mező sem volt laza, a privát `#h6` sem, holott azt semmilyen kulcslistázás nem látja. |
| `random-inherit-typescript-7` | `accessor f0` és egy getter–setter pár ugyanazon a néven az ősben (marad, lásd lent). |

## Döntés ([type-member-ordering.ts](../../src/author/type-member-ordering.ts))

1. **Szöveges literál számított név.** Egy osztálytag `['k']` vagy `` [`k`] `` neve maga a `k` kulcs; a kiértékelése kódot nem futtat. Minden szabály, amely a tag nevét használja (pár, azonos kulcs, laza mező, őslánc), így kezeli. Más számított név változatlanul a `key` fázisban, sorrendben kiértékelt.
2. **Pár azonos nevű mező mellett.** Egy getter és egy setter, törzzsel és azonos elhelyezéssel, akkor is egy tulajdonság (ADR-012), ha ugyanazon a néven mezők is állnak. A mező futáskor a példányon vagy a konstruktoron hoz létre tulajdonságot, nem a prototípuson. A mező maga kötött marad: `[[Set]]` módban a saját setter fut.
3. **Getter és setter az azonos kulcsú láncban.** Az azonos kulcsú definíciók lánca (ADR-068) egy egymás melletti getter–setter párt egy csoportnak vesz: a kettő egymáshoz képest szabad, a következő definíció mindkettőt követi.
4. **Amit egy hozzáférés futtat** (`resolve`).
   - Egy `this.név` olvasás vagy írás a példányon:
     - adattulajdonságot ér, ha egy ős mezője már létrehozta;
     - különben a láncon a legközelebbi osztály azonos nevű prototípustagjait.
   - Ezek közül az számít, amit a definíciók sorrendje utoljára hagy:
     - metódus vagy `accessor` mező: adat;
     - getter és setter: annak a fele, amelyiket a hozzáférés használja.
   - A getter, illetve a setter törzsét ugyanazzal az elemzéssel nézzük, ciklusvédelemmel.
   - Elutasított, ha a név:
     - csak getterrel definiált, és írják;
     - körbe hivatkozik;
     - ismeretlen láncban áll.
   - A definíciók sorrendjét a lánc köti, ezért a referencia szerinti utolsó definíció minden elfogadott sorrendben ugyanaz.
5. **A kezdőérték is hatásnyomot kap.** Egy mezőkezdőérték, amely a példányt csak `this.név` alakban használja, leválasztott mező (ADR-076). A hatásnyoma az olvasott és írt nevekből és a 4. pont szerint futó kódból áll, az ADR-077 rendezésével. A privát nevek is számítanak: egy még nem létező saját privát mező olvasása dob.
6. **Privát laza mező kulcslistázásnál is.** Ha a program listázza a kulcsokat, a nyilvános mezők nem lazák. A kódot nem futtató privát mező viszont laza marad, a kódot nem futtató nyilvános mező pedig leválasztott, üres hatásnyommal. A nyilvános mezők így egymáshoz képest a kulcsuk sorrendjében maradnak, a privát mezőkhöz képest szabadok. A csendes konstrukció (ADR-076) ezért már nem feltételezi, hogy a program nem listáz kulcsot.

## Helyességi érv

- **1. pont:** a `ComputedPropertyName` egy literál esetén a `ToPropertyKey` a literál szövege, és kódot nem futtat. A tag ugyanaz, mintha a nevét így írták volna.
- **2. pont:** a getter és a setter az osztály definíciójakor kerül a prototípusra, a pozíciójától függetlenül, minden mező előtt. A mező tulajdonsága egy másik objektumon jön létre (példány vagy konstruktor). A futása a 4. pont szerint a saját settert futtathatja; ezért a mező sorrendje a többi taghoz képest továbbra is kötött.
- **3. pont:** a `DefineProperty` egy accessor felére a meglévő accessortulajdonság másik felét megtartja, adattulajdonságot pedig egészében lecserél.
  - Két egymás melletti, különböző fél bármelyik sorrendben ugyanazt a teljes accessort hagyja, mert közöttük nincs más azonos kulcsú definíció.
  - A felsorolhatóság és a konfigurálhatóság mindkét félnél azonos.
  - A kulcs létrejöttének sorrendjét a tükrözött kulcsok lánca (ADR-020) külön védi.
- **4. pont:** az `OrdinaryGet`/`OrdinarySet` a példány saját tulajdonságával kezd, utána a prototípuslánc első azonos nevű tulajdonságát használja.
  - Egy ős mezője a leszármazott mezői előtt létrejött. Csendes konstrukcióban egyetlen ős mezője sem futtat settert, és a nevét a hozzáférés hatásnyoma tartalmazza.
  - A saját osztály mezője a hozzáférés idejétől függően létezik, vagy még nem. Ezért a hozzáférés neve mindig a hatásnyomban van, és az azonos nevű mezővel kötött.
- **5. pont:** a leválasztott mező helyességi érve (ADR-076) azon múlik, hogy a kód a példányt nem adja ki, és ezt a `this.név` alak biztosítja. Amit a példányon megfigyel vagy változtat, az pontosan a hatásnyom: a getter- és settertörzseket ugyanez az elemzés zárja le.
- **6. pont:**
  - A privát nevek nem tulajdonságkulcsok: sem a `JSON.stringify`, sem az `Object.keys`, sem a `Reflect.ownKeys` nem listázza őket, és a `structuredClone` sem másolja.
  - Egy privát mezőt csak a saját osztály kódja lát. Az ilyen kód vagy kódfuttató tag (a laza mezőket követi), vagy leválasztott mező, amelynek a hatásnyoma a privát nevet tartalmazza.

## Mérés

**Teljes kampány, 12 mag, 7 fajta, 2 nyelv** (alapbeállítás, `strict` környezet), v43 → v44:

| Csoport | Elfogadott | Rés | Hibás elfogadás |
| --- | --- | --- | --- |
| `inherit` JS | 488 → 537 | 44 → 28 | 0 |
| `inherit` TS | 459 → 514 | 18 → 2 | 0 |
| a többi 6 fajta | változatlan | változatlan (48) | 0 |
| **Összesen** (366 095 sorrend) | **15 886 → 15 990** | **110 → 78** | **0** |

**Környezetváltozatokkal** (`strict`, `es2015`, `sloppy`; `inherit` és `class`):

| Csoport | `either` rés | `define` rés | Hibás elfogadás |
| --- | --- | --- | --- |
| `inherit` JS | 16 → 0 | 13 → 0 | 0 / 0 |
| `inherit` TS | 18 → 2 | 15 → 6 | 0 / 0 |
| `class` JS/TS | 0 / 19, változatlan | 0 / 19, változatlan | 0 / 0 |

- **A `strict` JS 28 rése** mind a mérés torzítása (ADR-077): a setter az ES2015-ös kibocsátásban fut és olvassa a mezőt, a natív mezőknél nem. Környezetváltozatokkal 0.
- **A maradék TypeScript-rés** (2, illetve `define` mellett 6) egyetlen tanú, a `random-inherit-typescript-7`, lásd lent.
- **Korpusz:** változatlan. **Gyors alapérték:** az `inherit` JS rése 9 → 2, a TS-é 7 → 0.
- **A `class` TS 19 rése** az NY-04 (`sealed-unit`, `continued-row`), nem ennek a tételnek a része.

## Bizonyíték

[member-footprints.test.mjs](../../tests/member-footprints.test.mjs), az orákulum mindkét mezőmódban és az ES2015-ös kibocsátásban is fut, mindegyiken 0 hibás elfogadás:
- **literál név:** a két `get ['k…']` szabad; a kiértékelt `[record(…)]` kulcs sorrendje indokoltan kötött;
- **pár mező mellett:** a getter és a setter, illetve a getter és a mező is szabad; a mező és a setter által olvasott `g` cseréje indokoltan kötött;
- **getter–setter–metódus lánc:** a getter és a setter felcserélhető; a metódus a getter elé téve indokoltan elutasított;
- **getteren át olvasó kezdőérték:** a getter által nem olvasott mező szabad; az olvasott mező, illetve egy `this.peek()` hívás indokoltan kötött;
- **az utolsó definíció dönt:** ha a metódus van utoljára, a leszármazott mező szabad; ha a setter, indokoltan kötött;
- **privát mező kulcslistázásnál:** a privát mező szabad, a nyilvános kulcsok sorrendje indokoltan kötött; egy saját privát mező olvasása a létrehozása elé téve indokoltan elutasított.

## Ami marad

`random-inherit-typescript-7`: az ősben `accessor f0` és egy getter–setter pár ugyanazon a néven. Az `accessor` mező két része két dolgot tesz: a definíciókor accessort telepít, futáskor pedig a tárolóját tölti. Egyetlen szabály sem modellezi ezt a kettősséget azonos nevű definíciók között, és a minta ritka. A jegyzékben az NY-22 maradékaként szerepel.

## Tervezési review (ADR-037)

- **Tulajdonos:** a tagrendezés.
  - A `resolve` egyetlen függvényben rejti az OrdinaryGet/Set láncbejárását és az azonos kulcsú definíciók végállapotát.
  - Az `instanceFootprint` a getter- és settertörzsekre, valamint a kezdőértékekre ugyanaz.
  - Az ADR-077 `setterFootprint`-je ebbe olvadt (`resolve(név, 'write')`).
  - Interfész nem változott.
- **Design twice:**
  - *A végállapot helyett minden azonos nevű tag uniója:* elvetve. A `random-inherit-*-3` tanúban a metódus utoljára áll, és az unió a setter kódját is futónak venné.
  - *A privát mezők külön, a kulcslistázástól független szabálya:* elvetve. A meglévő laza mező és a leválasztott mező ugyanezt fejezi ki, csak a feltételük nem tudott a privát nevekről.
- **Mélység:** az ADR-077 két bejárója (`setterFootprint`, `thisNames`) egy általánosabbá vált (`resolve`, `instanceFootprint`). A fogalmak száma nem nőtt.
