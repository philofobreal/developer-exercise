# ADR-052 – Ki nem írt tulajdonságnevek (v27)

Állapot: **elfogadva** (2026-11-02), szabályverzió `scoped-effect-analysis-v27`. Hibajavítás: a generátor hibás sorrendet fogadott el. Pontosítja az [ADR-020](020-unobserved-key-order.md) és az [ADR-029](029-unobserved-instance-field-order.md) megfigyelési feltételét, valamint az [ADR-050](050-input-contract.md) bemeneti szerződésének kapuját.

## Kontextus

A feladatkorpusz ([ADR-051](051-task-corpus-and-linear-shapes.md)) építése közben felmerült, hogy a kulcsfelsorolás felismerése szöveges: a program akkor listázhat kulcsot vagy reflektálhat, ha a forrás kiírja a nevet (`keys`, `entries`, `stringify`, `getOwnPropertyNames`, `Reflect`, `Function`, `eval`, …). Az ADR-020 helyességi érve ki is mondja: „a program által futtatott kód sem érheti el őket név nélkül”.

Ez nem igaz. Célzott próba a v26-on:

```js
class Box {
  constructor() {
    this.a = 1;
    this.b = 2;
  }
}
function evaluate() {
  const list = Object['ke' + 'ys'];
  return list(new Box());
}
```

A generátor a két `this` írást felcserélhetőnek vette (a program „nem listáz kulcsot”), az orákulum futásidőben (P3) eltérést látott: `["a","b"]` helyett `["b","a"]`. **3 hibás elfogadás 115 szomszédos sorrendből.** Ugyanígy kerülhető meg a `valid` szerződés szöveges kapuja (az `Object['define' + 'Property']` meghívása az `Object['proto' + 'type']` objektumra), és a `constructor` olvasása elvezet a `Function`-höz, tehát szövegből fordított kódhoz.

## Döntés

1. **Új modul** ([property-names.ts](../../src/author/property-names.ts)), egyetlen kérdéssel: `readsUnspelledNames(file)`. A program használ-e, összehasonlításon és számoláson túl, olyan értéket, amelyet a forrásban ki nem írt nevű tulajdonságként olvasott?
   - **Forrás:** `o[k]` olvasás, ha a kulcs nem ártalmatlan, továbbá a `constructor` minden olvasása (`.constructor`, `['constructor']`) és a számított kulcsú destrukturálás.
   - **Ártalmatlan kulcs:** literál (a szövege a forrásban van, ott a névszabályok látják); literálok közti választás; szám (szám nem alakul API-névvé). A számot név szerint, fixponttal követjük: `let i = 0; … i++`, `j = i - 1`, `a[i + 1]` ártalmatlan; a `name += 'ys'` nem.
   - **Szivárgás:** az érték meghívása; átadása argumentumként; tárolása (tömb- vagy objektumliterál, property-írás); visszaadása, dobása; a `call`/`apply`/`bind`; írás bele; egy időzítőnek adott szöveg. Az értéket kapó név (`const v = o[k]`) minden olvasása ugyanígy vizsgálandó.
   - **Ártalmatlan használat:** összehasonlítás, aritmetika, konverzió (sablon, `typeof`), feltétel, kulcsként használat, további olvasás belőle. Ugyanilyen a kiírt nevű metódus hívása rajta (`groups[v].push(x)`), de az eredményét tovább követjük, mert például a `valueOf` magát az értéket adja vissza.
   - A neveket név szerint követjük, scope-feloldás nélkül; ez csak szigorít.
2. **Hatás:** ha a válasz igen,
   - az `observesKeyOrder` igaz, tehát a metódusok és függvények kulcssorrendje (ADR-020), és vele a példánymezőké (ADR-029) is kötött;
   - a `valid` bemeneti szerződés nem alkalmazható (ADR-050), megjegyzéssel.
3. **Megjegyzés hossza:** a „nem alkalmazható” megjegyzés rövidebb lett. A TypeScript-osztályos program `valid` szerződéssel és Proxyval eddig 1 047 karakteres megjegyzést kapott, a séma korlátja 1 000, így a generált modell befogadhatatlan volt (a v26 óta fennálló hiba). A leghosszabb kombinációra regressziós teszt van.

## Elvetett változat

**Minden nem ártalmatlan kulcsú `o[k]` számít** (szivárgáselemzés nélkül): egyszerű és helyes, de a `valid` szerződés hasznát a tipikus tömb- és rácskódon elviszi. Mérve: `algo-bfs-js-valid` 25 → 5, `contract-grid-reads` 14 → 1 elfogadott szomszéd. A `grid[r][c] === 1` értéke csak összehasonlításba kerül, kódot nem futtathat.

## Helyesség

Egy ki nem írt nevű olvasás csak egy értéket ad. Kód akkor fut miatta, ha:

- az értéket meghívják (közvetlenül, `call`/`apply`/`bind` révén, vagy egy metódusán át, amely visszaadhatja);
- vagy olyan helyre kerül, ahol az elemzés nem követi tovább (argumentum, tárolás, visszatérés).

Az összehasonlítás, az aritmetika és a konverzió beépített függvényen futó konverziót hív (`Function.prototype.toString`), vagy a program saját, kiírt nevű metódusát. Ez utóbbit az ADR-050 konverziós szabálya fedi.

Minden más út kiírt nevet használ, és azt a meglévő szöveges szabályok látják.

## Mérés

- **Tanúk** ([property-names.test.mjs](../../tests/property-names.test.mjs)): 11 elérési út (hívás, alias, callback, `call`, tárolás, visszatérés, destrukturálás, logikai operátor, felhalmozott név, `valueOf`, `constructor.constructor`), egy időzítő és egy szerződéskapu-megkerülés. Mindegyik felismerve, a csere elutasítva, az orákulum szerint megfigyelhető, a modell hibás elfogadás nélkül.
- **Korpusz:** 103 fixture-ből egyetlenegy érintett, a `contract-proxy-fallback`, amely a Proxy miatt eddig is szigorú volt; a rögzített számok bájtra azonosak.
- **Generatív programok:** a 200 magos katalógus 1 952 programjából csak ugyanez az egy érintett, ezért a gyors baseline-ban csak a címke változott.
- **Teljesítmény:** egy fájlbejárás és egy névszintű fixpont, a többi elemzéshez képest elhanyagolható.

## Korlátok

- **Szivárgásnak számít a visszatérés is.** A `function get(o, k) { return o[k]; }` tehát szigorít, akkor is, ha a hívó csak összehasonlít.
- **Az orákulum nem implementálja függetlenül a szivárgáselemzést.** A P4-e továbbra is a szöveges szabályt követi, ezért ilyen programban a kulcssorrend eltérését csak a P3 (a probe futása) látja. A tanúk mindegyikét a P3 elkapja; az orákulum független megerősítése az 5. fázis tárgya.
- **A `valid` szerződés feltevése** a bemeneti adatokra vonatkozik. A program által képzett névre nem; azt ez a szabály szigorítja.

## Tervezési review (ADR-037)

- **Mélység:** a modul egyetlen logikai kérdésre felel, két hívóval (`observesKeyOrder`, `inputFacts`). A szivárgáselemzés és az ártalmatlan kulcs fogalma rejtve marad; a hívók nem ismerik.
- **Rögzített megállapítás 1:** a csak számot tároló nevek követése részben átfed a `statement-ordering` primitívlokális-elemzésével ([ADR-048](048-primitive-locals.md)). A kérdés más (szám-e, nem az, hogy primitív-e), és a két elemzés más egységen dolgozik, ezért most nem vontuk össze. Jelölt egyesítés.
- **Rögzített megállapítás 2:** a `readsUnspelledNames` hosszú, belső closure-ökkel. A szerződés a modul fejlécében áll. Felbontás (névgyűjtés, ismert érték, szivárgás) későbbi refaktor, viselkedésváltozás nélkül.
- **Kétszeri bejárás:** a két hívó egymástól függetlenül kérdez, ezért egy generálás kétszer járja be a fájlt. A mért költség elhanyagolható; gyorsítótár nem indokolt.
