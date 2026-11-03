# ADR-053 – Kiszámítható nevek és visszaadott értékek (v28)

Állapot: **elfogadva** (2026-11-02), szabályverzió `scoped-effect-analysis-v28`. Pontosítja az [ADR-052](052-unspelled-property-names.md) szabályát; a helyesség iránya (inkább szigorú) nem változik.

## Kontextus

A Pages-en végzett kipróbálás és a saját ellenőrzés két túlszigorúságot mutatott a v27-ben:

1. **Félrevezető megjegyzés.** Az ADR-052 tanúpéldájában (`const list = Object['ke' + 'ys']; return list(new Box());`) a „Bemenetek: érvényes egyszerű adat” választásra a modell azt írta: „Az érvényes bemenet szerződése nem alkalmazható …”. A programnak nincs is bemenete, és a név konstansként kiszámítható: `keys`. Ez kulcslistázás, nem olvasást módosító horog. A v27 viszont minden ki nem írt nevet úgy kezelt, mintha bármely API lehetne.
2. **A visszatérés mindig szivárgásnak számított.** A `const first = grid[start[0]][start[1]]; return [rows, cols, first];` mintájú, tipikus rácskódnál ezért a `valid` szerződés nem érvényesült, és a `rows`/`cols` csere elutasított lett. Hibás elfogadást ez nem okozott, de a v26-hoz képest szigorúbb volt.

**A tanúpélda sorrendi döntése helyes, nem túlszigorú.** A `this.a`/`this.b` csere a kimenetet `["a","b"]`-ről `["b","a"]`-ra változtatja, bemeneti szerződéstől függetlenül. Minden más mozgatás (köztük az osztály és a függvény blokkcseréje) elfogadott. A 120 vizsgált sorrendből egyik sem rés.

## Döntés

1. **Konstans nevek összevonása:** a modul a nevek lehetséges értékeit is kiszámítja (legkisebb fixpont, halmazonként legfeljebb 64 elem).
   - Kiszámítja: literál, szám, sablon helyettesítéssel, `+`, literálok közti választás, `||`/`&&`/`??`, `typeof`.
   - A felhalmozódó (ciklusban növő) vagy ismeretlen név: bármely név. A `constructor` továbbra is bármely API (a `Function` felé vezet).
   - **Új interfész:** `unspelledNames(file)` a használt, ki nem írt nevek listáját adja vagy `'any'`-t; a `namesMatch(file, nevek, minta)` pedig úgy illeszti a hívók névmintáit (kulcslistázás, reflexió, horgok), mintha a nevek a forrásban állnának. A boolean `readsUnspelledNames` megszűnt.
2. **Visszatérés a hívásig követve:**
   - **Nevesített függvény** (deklaráció, vagy változóba tett függvénykifejezés) visszatérési értéke minden hívásának eredményeként követendő. Ha a függvény nevét híváson kívül használják (például callbackként átadják), az szivárgás. Ha a programon belül senki nem hívja, az érték a programon kívülre megy; az ADR-020 és az ADR-029 szerint a külső megfigyelő nem része a feladatnak.
   - **Osztálymetódus** visszatérését a `.név(…)` hívásoknál követjük. Kivétel, ha a nevét a nyelv maga hívja (`get`, `has`, `next`, `then`, `toString`, `valueOf`, `toJSON`, …).
   - **Objektumliterál metódusát** nem követjük, mert az objektummal együtt elmehet (Proxy-kezelő, iterátor).
3. **A program saját literáljai:** a tömb- vagy objektumliterálba tett érték a literállal együtt követendő.
   - **Tömbliterálon** a kiírt nevű metódus hívása megengedett, kivéve a callbacket hívókat (`map`, `forEach`, `sort`, …).
   - **Objektumliterálon** a metódushívás szivárgás, mert a tulajdonság maga lehet az érték.
   - **Írás a saját literálba** nem szivárgás. Az ismeretlen értékbe írás (például egy beépített prototípusba) szivárgás marad.

## Helyesség

- **Az összevont név pontosan** azokat a tulajdonságokat választhatja, amelyeket a kiszámított halmaz felsorol. A nevek értékkészletét név szerint gyűjtjük, minden értékadással, scope-feloldás nélkül, és a `var` előzetes `undefined` értékével is. Ez csak bővíti a halmazt.
- **Egy visszaadott érték a programban csak a hívás eredményén át jelenhet meg**, és azt ugyanaz az elemzés követi. A függvény más útja (átadás, implicit hívás) szivárgás.
- **A literálban tartott értékhez** csak a literálon át lehet hozzáférni. Minden ilyen olvasás „ismeretlen” értéket ad, amelyre a legszigorúbb szabály vonatkozik.

## Mérés

- **Tesztek** ([property-names.test.mjs](../../tests/property-names.test.mjs)), 15 elérési úttal:
  - az ADR-052 tanúi: konstans `keys`;
  - új tanúk: objektumliterál, segédfüggvény visszatérése, sablon, paraméterként kapott név;
  - implicit hívások: `next`, Proxy `get`, `then`.
  - Mindegyik kulcslistázónak számít, a csere elutasított, az orákulum szerint megfigyelhető, hibás elfogadás nélkül.
  - Új pozitív esetek: a tanúpélda `valid` szerződéssel megjegyzés nélkül fut; a visszaadott rácsolvasás mellett a `rows`/`cols` csere elfogadott; a hibás elfogadás mindkettőnél 0.
- **Korpusz:** a 103 fixture rögzített értéke változatlan.
- **Generatív katalógus** (1 952 program): egyetlen program sem kap „bármely név” eredményt. A kiszámított nevek (például `k3`, `left`, `0`) egyik névlistához sem illeszkednek.

## Korlátok

- **A paraméteren át érkező név ismeretlen.** A hívási helyek argumentumait nem követjük.
- **A felhalmozódó név** (ciklusban `+=`) bármely név.
- **Az orákulum P4-e** továbbra sem implementálja függetlenül ezt az elemzést (5. fázis).

## Tervezési review (ADR-037)

- **Interfész:** a modul egy boolean helyett a használt neveket adja. A döntés, hogy egy név API-e, a hívóknál maradt (kulcslistázás és reflexió a `js-ts-ordering`-ben, horgok az `input-contract`-ban), a `namesMatch` pedig egy helyen illeszti a mintát a szövegre és a nevekre. Így egyik hívó sem duplikálja a másik névlistáját. Hívók: a `js-ts-ordering` (egyszeri számítás, két kérdés) és az `input-contract`.
- **Elrejtve:** a konstansösszevonás, a szivárgáselemzés, a literálok és a visszatérések követése.
- **Rögzített megállapítás (lezárva, [ADR-065](065-design-debt-removal-and-module-split.md)):** a modul mérete kb. 280 sor egyetlen függvényben, belső closure-ökkel. A fejléc a szerződést írja le. A felbontás (névgyűjtés, összevonás, szivárgás) viselkedésváltozás nélküli refaktor; elkészült.
