# ADR-071 – A heap cellája tudja, melyik listautasítás írta (v37)

Állapot: **elfogadva** (2026-11-03), szabályverzió `scoped-effect-analysis-v37`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-02 tétele. Pontosítja az [ADR-025](025-local-object-effect-footprints.md) folyamérzéketlen heapjét.

## Kontextus

A saját objektumok heapje eddig egy mező (vagy egy tömb elemei) minden értékét egyetlen halmazba gyűjtötte, függetlenül attól, melyik utasítás írta. A nem dobó `object` programok mind a 22 + 22 rése egyetlen tanúban jelent meg (`object-javascript-7`, `object-typescript-7`):

```js
const shared = [];
shared.push('s0');
a.note('n2');        // this.log.push(text): a.log még a konstruktor tömbje
a.note('n3');
…
a.attach(shared);    // this.log = log: csak itt lesz a.log === shared
a.note('n7');
```

A modell szerint az `a.note('n2')` a `shared`-be is írhat, mert az `a.log` mezőbe valamikor a `shared` kerül. Ezért a `shared.push('s0')` nem kerülhetett mögé.

**Okok tanúk szerint (v36, 12 mag, nyelvenként):**

| Minta | Rés | Ok |
| --- | --- | --- |
| `shared.push('s0')` ↔ `a.note('n2')` | 11 (+1 együtt a következővel) | a későbbi `attach` értéke látszik a korábbi olvasásban |
| `a.note('n2')` ↔ `a.note('n3')` | 10 (+1) | a konstruktor tömbje az `attach` után elérhetetlen, írásainak sorrendje nem látszik |

## Döntés

1. **Pozíció a cellában** ([object-footprints.ts](../../src/author/object-footprints.ts)): a heap cellája (egy objektum egy mezője, egy tömb elemei) minden értéket annak a listautasításnak a pozíciójával tárol, amely beírta.
   - A konstruktorlista kezdőállapota (ADR-031) a −1. pozíción áll.
   - Egy utasításon belül (ciklus, hívott metódusok, visszahívások) minden írás ugyanazon a pozíción van, tehát a ciklus látja a saját későbbi köreinek írásait is.
2. **Olvasás:** az `i`. utasítás egy cellából csak az `i`-nél nem későbbi pozíciójú értékeket látja.
   - Ha ilyen nincs, a mezőolvasás ismeretlen (eddig: a később beírt értéket kapta, holott futáskor a mező még nem létezett), a tömbelem üres.
   - A `JSON.stringify`, az `Object.keys/values/entries` és a tömbbejárás ugyanígy olvas.
3. **Szökés:** egy megszökő objektum *minden* valaha tárolt értéke megszökik, pozíciótól függetlenül (változatlan).
4. **A második minta** (az eldobott tömb írásainak sorrendje) **marad kötött**, és a jegyzékben új mérési tételként (NY-19) szerepel. Lásd a helyességi érv utáni pontot.

## Helyességi érv

- **Minden író és olvasó rendezett.** Ha az `s` utasítás olvas egy cellát, és a `t` utasítás írja, akkor:
  - ha mindkettőnek van hatásnyoma, a mezőszintű ütközés (ADR-028) élt húz közéjük: egy mezőt író utasítás a mezőt vagy az egész objektumot írja, és mindkettő ütközik a mező olvasásával;
  - ha a `t`-nek nincs hatásnyoma, az objektum megszökik, és az `s`-nek sem lesz hatásnyoma: mindkettő barrier, és a barrierek sorrendje kötött.

  Az él a referencia sorrendjét tartja meg, tehát minden elfogadott sorrendben az `s` előtt pontosan a referencia szerint előtte álló írók futnak le.
- **A pontosítás nem bontja meg ezt a rendezést.** A szűkítés csak azt veszi ki az `s` hatásnyomából, amit egy *későbbi* író értéke hozna be. Azt a cellát, amelyet az `s` olvas, továbbra is olvassa, így az élei az íróival megmaradnak.
- **Friss objektumok.** A saját objektumokat a lista minden futása újra létrehozza (`const x = new C(…)`, literál), és egy hívásban létrehozott belső objektum is a saját absztrakt azonosítóján él (tulajdonos és hely szerint). Egy korábbi futás állapota csak szökéssel érhető el, ami kizárja a hatásnyomot.
- **Ismert érték (ADR-032):** ha a pozícióig látható érték egyetlen literál, az `if` csak az általa választott ágat értelmezi. Ez helyes, mert a feltétel olvassa a cellát, és minden más író a rendezés szerint előtte vagy utána fut.

**Az eldobott tömb írásai (NY-19).** Az `a.note('n2')` és az `a.note('n3')` cseréje futáskor nem látszik, mert az `attach` után a konstruktor tömbjére már semmi nem hivatkozik. Az elfogadásához a generátornak azt kellene bizonyítania, hogy egy objektum a lista végén elérhetetlen. Ez új, a hívásokon átnyúló elérhetőségi elemzés lenne.

Az A-politika (ADR-043) a halott kód sorrendjét úgy ítéli meg, mintha az a kód lefutna. Ennek mintájára az eldobott objektumba írást is úgy kell nézni, mintha valaki megfigyelné: a napló bejegyzéseinek sorrendje a referencia szándéka. A generátor ezért kötve tartja ezt a sorrendet. A mérés viszont ezt még nem tudja elkülöníteni, ezért résként számolja.

## Mérés

**Teljes kampány, 12 mag, 6 fajta, 2 nyelv** (351 664 sorrend, előtte és utána is 0 hibás elfogadás), v36 → v37:

| Csoport | Rés | Elfogadott sorrend |
| --- | --- | --- |
| `object` JS, nem dobó | 22 → 11 | 2 128 → 2 139 |
| `object` TS, nem dobó | 22 → 11 | 2 588 → 2 599 |
| `flow` JS, nem dobó | 15 → 13 | 1 845 → 1 849 |
| `flow` TS, nem dobó | 15 → 13 | 2 256 → 2 260 |
| többi (a dobó programok is) | változatlan | változatlan |
| **Összesen** | **100 → 74** | **14 843 → 14 873** |

- **Korpusz:** változatlan (19 rés). A gyors alapértékben csak a szabályverzió címkéje változott, mert a tanú a 7-es mag.
- **Az `object` maradéka:** 11 + 11 rés, mind az eldobott tömb mintája (NY-19).
- **A `flow` maradéka:** 13 + 13 rés (NY-01).

## Bizonyíték

[heap-positions.test.mjs](../../tests/heap-positions.test.mjs):
- **a későbbi írás nem látszik:** az `a.note` az `a.attach(shared)` előtt nem ütközik a `shared.push`-sal;
- **az író és az olvasó rendezett:** az `a.attach` nem kerülhet az `a.note` elé;
- **az írás utáni olvasás látja:** a `shared.push` nem kerülhet a későbbi `a.note` mögé;
- **a ciklus látja a saját köreit:** a második kör már a `shared`-be ír, ezért a `shared.push` nem kerülhet a ciklus mögé (enélkül hibás elfogadás lenne);
- **ismert érték a pozícióig:** a feltétel csak a választott ágat értelmezi, a későbbi `rename` rendezett marad vele;
- mindegyiken 0 hibás elfogadás.

## Tervezési review (ADR-037)

- **Tulajdonos:** a pozíció a heap rejtett tudása. A cellát a `field`, az `items` és az `addField`/`addElements` éri el; a hatáselemzés és az utasításrendezés interfésze nem változott.
- **Design twice:**
  - *Teljesen folyamérzékeny heap (állapot utasításonként):* elvetve. Minden utasítás után másolni kellene a heapet, és a ciklusoknál külön fixpont kellene. A pozíciós cella ugyanazt a pontosságot adja, mert a rendezés miatt csak a referencia szerinti előzmények számítanak.
  - *Csak a mezők, a tömbelemek nélkül:* elvetve. Ugyanaz az érv mindkettőre áll, és két különböző szabály nehezebben érthető.
- **Mélység:** a változás egy fogalom (pozíció) a meglévő cellákon. Az NY-12 tervezési adósság (a heap és az értelmező egyetlen closure) nem nőtt, de nem is csökkent.
