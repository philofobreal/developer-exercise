# ADR-080 – Mérés: az eldobott objektumba írás sorrendje szándék, nem rés

Állapot: **elfogadva** (2026-11-04). A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-19 tétele. Csak a mérés változik, a generátor és a szabályverzió nem (`scoped-effect-analysis-v45` marad). Az [ADR-071](071-statement-positioned-heap-cells.md) döntését valósítja meg a mérésben, az [ADR-043](043-dead-code-intent-policy.md) A-politikájának és az [ADR-067](067-value-perturbation-in-measurement.md) értékváltozatának mintájára.

## Kontextus

Az ADR-071 óta a nem dobó `object` programok egyetlen maradék oka ez (`object-*-7`, nyelvenként 11 rés):

```js
a.note('n2');        // this.log.push(text): a.log még a konstruktor tömbje
a.note('n3');
…
a.attach(shared);    // a.log = shared: a konstruktor tömbjére többé semmi nem hivatkozik
```

- **Futáskor nem látszik:** a két `note` cseréje nem változtat a futáson, mert a konstruktor tömbjét az `attach` után senki nem éri el.
- **A generátor ezt az ADR-071 döntése szerint szándékosan köti.** Az A-politika szerint a halott kód sorrendje úgy számít, mintha lefutna. Ugyanígy az eldobott objektumba írás sorrendje úgy számít, mintha valaki megfigyelné: a napló bejegyzéseinek sorrendje a referencia szándéka.
- **A mérés ezt eddig nem tudta elkülöníteni,** ezért résként számolta.

A jegyzék a mérési elkülönítést egy második tanúhoz kötötte. Helyette ez az ADR előbb megméri, hogy a szabály minden fajtában csak ezt a mintát fogja-e meg (lásd a mérést). Ez a feltétel célját, a valódi rések elfedésének kizárását, közvetlenül vizsgálja.

## Döntés

1. **Megfigyelt heapváltozat** ([heap-variant.mjs](../../tests/support/heap-variant.mjs)).
   - **A forrás átalakítása:** a referencia minden tömbliterálja, objektumliterálja és `new` kifejezése `__keep(…)` hívásba kerül. A destrukturáló célok kimaradnak, mert ott a csomagolás a szintaxist rontaná.
   - **A sorok:** a beszúrások sortörést nem adnak, így a változat sorai egy az egyben a referencia sorai. Egy tanulói sorrend ezért a változaton is lejátszható.
   - **Két segédsor:**
     - a `__keep` gyűjti az objektumokat;
     - a `__seen` a próba után rögzíti őket.

     A nyomot az orákulum a futás végén sorosítja, így az objektumok végállapota is az eredmény része.
2. **Új szándékok** ([order-classification.mjs](../../tests/support/order-classification.mjs)): egy elutasított, futásra egyenértékű sorrend szándékhű (`heap`), ha a megfigyelt heapváltozaton másként viselkedik. Sorrend:
   - a `dead-code`, `policy`, `type` és `value` okok előnyt élveznek, a `heap` csak utánuk következik;
   - aszinkron fixture-nél nincs változat;
   - ha a változat referenciája hibás, a sorrend rés marad.
3. **Nem változik:**
   - a generátor, a szabályok és a szabályverzió;
   - az elfogadott sorrendek, és a hibás elfogadás megítélése;
   - a gyors kapuban rögzített egyenértékű-elutasítási arány: a szándékhű elutasítást a résekkel együtt számolja (ADR-067). Egy szigorúbb generátor így nem rejtőzhet szándékként.

## Helyességi érv

A szabály csak már elutasított és egyenértékűnek talált sorrendet sorol át. Az elfogadottak megítélése, köztük a hibás elfogadásé, nem változik.

Az átsorolás feltétele, hogy a sorrend a referencia valamely objektumán más végállapotot hagyjon. Ez az A-politika kérdése a heapre: a referencia objektumaiba írt sorrend a referencia szándéka, akkor is, ha az objektumot a program később eldobja.

Ha a sorrend semmilyen objektumállapotot nem változtat, például egy tiszta deklaráció kerül egy hívás mögé, az átsorolás nem történik meg, és a sorrend rés marad.

## Mérés

**Elfedési próba:** a kampány mind a 7 fajtája, 12 mag, 2 nyelv. Minden rés és minden `heap` szándékú elutasítás besorolását összevetettük:

| Fajta | `heap` szándék | Rés marad |
| --- | --- | --- |
| `object` JS / TS | 11 / 11 (mind `object-*-7`, az NY-19) | 0 / 0 |
| `script` JS | 0 | 5 |
| `inherit` JS / TS | 0 / 0 | 28 / 2 |
| `flow` JS / TS | 0 / 0 | 1 / 1 |
| `function`, `class`, `param` | 0 | 0 |

A szabály tehát pontosan az NY-19 mintáját sorolja át, mást nem.

**Egy második tanú a tesztekben:** az `escape-bound-shadowed-callee` ([escape-witnesses.test.mjs](../../tests/escape-witnesses.test.mjs)).
- A `b.call(1)` dob, mert az elfedő `record` paraméter nem függvény.
- A próba csak a hibaüzenetet adja vissza, a csere viszont megváltoztatja, mit tart az `a`, amikor a program eldobja.
- Eddig a teszt túlzó óvatosságnak (résnek) minősítette, most `heap` szándék.

**Teljes kampány** (v46, `strict` és `hostile`): az `object` nem dobó csoportjai 11 + 11 rés helyett 0 rés, 11 + 11 `heap` szándék.

**Két mérési hiba, amelyet az elfedési próba talált, és amelyet a végleges változat kijavított:**
1. **Szétterítés a segédsorban:** az első segédsor szétterítést (`...`) használt. Az orákulum ezt kulcsfelsorolásnak vette, ezért a változatban a mezők sorrendje is számított, és az `inherit` JS 28 rése tévesen szándék lett. A végleges segédsor nem terít szét.
2. **A statikus elemzés:** az orákulum statikus hatássorrend-elemzése (P2) a `__keep(…)` hívásokat ismeretlen hívásnak vette, és elvesztette a saját objektummodelljét. Ezért a `flow-*-7` rését is szándéknak sorolta. A végleges változatot az orákulum csak futás alapján ítéli meg (`runtimeOnly`). Az eredeti forrást a teljes orákulum már egyenértékűnek találta, a változat csak a heap végállapotát kérdezi.

## Bizonyíték

[heap-intent.test.mjs](../../tests/heap-intent.test.mjs):
- **a változat** minden létrehozott objektumot ugyanazon a soron csomagol, a destrukturáló célokat érintetlenül hagyja; ha a program nem hoz létre objektumot, nincs változat;
- **NY-19:** az `object-*-7` két `note` hívásának cseréje mindkét nyelven `heap` szándék;
- **negatív eset:** a `wp6-sealed-continued-callback` lezárási rése (ADR-066) rés marad, mert egyetlen objektum állapotát sem változtatja.

## Tervezési review (ADR-037)

- **Tulajdonos:** a mérés.
  - A változat előállítása egy modul (`heap-variant.mjs`), a szándékba sorolás egy függvény az osztályozóban (`heapDependent`).
  - A generátor, a mag és az orákulum interfésze nem változott.
- **Design twice:**
  - *Elérhetőségi elemzés a generátorban, amely az eldobott tömb írásait felszabadítaná:* elvetve. Az ADR-071 döntése szerint a sorrend szándék, ezért a generátornak kötnie kell.
  - *Csak az eldobott objektumok megfigyelése:* elvetve. Ehhez a mérésnek futás végi elérhetőséget kellene számolnia. Az összes objektum megfigyelése egyszerűbb, és a mérés szerint ugyanazt a halmazt adja.
  - *Csak tömbök megfigyelése:* elvetve. A minta objektummezőre írva is ugyanaz.
