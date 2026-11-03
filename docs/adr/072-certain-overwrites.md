# ADR-072 – A biztos felülírás elrejti a mező korábbi értékeit; halott kód okozta kötés a mérésben (v38)

Állapot: **elfogadva** (2026-11-03), szabályverzió `scoped-effect-analysis-v38`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-01 tétele (a `flow` maradéka). Kiegészíti az [ADR-071](071-statement-positioned-heap-cells.md) pozíciós heapcelláit, az [ADR-032](032-value-sensitive-guards.md) ismert ágait és az [ADR-043](043-dead-code-intent-policy.md) A-politikáját.

## Kontextus

A v37 után a `flow` nem dobó programjaiban nyelvenként 13 rés maradt, négy tanúban:

| Tanú | Rés | Ok |
| --- | --- | --- |
| `flow-*-12` | 6 | `for (const entry of boxes) { entry.tag = 't5'; … }`, majd `switch (b.tag) { case 't7': a.attach(shared); … }`. A ciklus minden elemre `'t5'`-öt ír, de a heap a konstruktor `''` értékét is látja, ezért a `case 't7'` ágat is értelmezi. |
| `flow-*-6` | 2 | Ugyanez egy `if (c.tag === 't6')` ággal. |
| `flow-*-5` | 3 | Egy `catch` ág, amely csak akkor futna, ha a külső `record()` dobna. A generátor helyesen köt, mert külső kód dobhat; a fixture-ben a `catch` sosem fut. |
| `flow-*-7` | 1 + 1 | Egy halott `catch` kötési bemenete, és egy ciklus, amelynek az első körét a törzs feltétele kihagyja (`if (seen > 0)`). |

## Döntés

### Generátor (v38, [object-footprints.ts](../../src/author/object-footprints.ts))

1. **Biztos írás.** Egy listautasítás akkor írja *biztosan* egy objektum mezőjét, ha az írás olyan kódban áll, amely mindig lefut, amikor az utasítás normálisan befejeződik. Ilyen kód:
   - az utasítás egyenes vonalú kódja, és a meghívott metódusok, setterek és konstruktor egyenes vonalú eleje, ha a fogadó egyetlen ismert objektum;
   - egy ismert feltételű `if` választott ága;
   - egy `for … of` törzse, ha a ciklus egy saját tömbliterál minden tagján végigmegy. Feltételek:
     - a tömb elemei egy-egy saját objektumok;
     - nem futott rajta `unshift`, `pop` vagy `shift`;
     - a törzsben nincs ugrás (`break`, `continue`, `return`).

     Ilyenkor a ciklusváltozón át végzett írás (a kötés szimbóluma szerint) minden tagra biztos.

   Nem biztos:
   - a feltételes ág (ismeretlen feltétellel);
   - a `switch`, a `try`, a `while`, a `do` és a `for` törzse;
   - a rövidzáras kifejezés jobb oldala és a visszahívások;
   - egy getter törzse;
   - az, ami egy olyan ugró utasítás után áll, amely kihagyhatja a blokk maradékát.
2. **Láthatóság.** Az `i`. utasítás egy mezőcellából csak azokat az értékeket látja, amelyeket a legutóbbi, `i` előtti biztos író vagy annál későbbi utasítás írt be.
   - A biztos-író tény a fixpont köreiben csak szűkülhet.
   - Egy hatásnyom nélküli utasításnak nincs ilyen ténye.
3. **Getter eredménye.** Ha egy törzs egyenes vonalú elejét egy `return` zárja, a törzs eredménye pontosan a visszaadott érték, nem az unióban egy ismeretlen primitív is.
   - Eddig ez minden getter ismert értékét elveszítette, így az ADR-032 ismert ága getteren át nem működött.
4. **`switch` ismert értékkel.** Ha a diszkrimináns és minden `case` címke ismert, a törzs értelmezése a megfelelő címkénél kezdődik (ha nincs ilyen, a `default`-nál), és onnan a végéig tart, a fall-through miatt.

### Mérés ([order-classification.mjs](../../tests/support/order-classification.mjs))

5. **Halott kód okozta kötés (A-politika).** Az elutasított, de egyenértékű sorrend akkor is szándékhű (`dead-code`), ha a modell elfogadja, miután a referencia sosem futó, egysoros kifejezés-utasításait üres utasításra (`;`) cseréljük.
   - A sorok száma így nem változik, a változat ugyanazokkal a beállításokkal generálódik.
   - Ez az ADR-043 szabálya: a halott kód sorrendje úgy számít, mintha lefutna. Eddig csak az számított szándékhűnek, ha maga a megsértett él érintett halott sort.
   - Csak olyan függvény halott sorai számítanak, amely maga lefutott (az első utasítása végrehajtódott). Egy sosem hívott függvény törzsének nincs olyan helye, ahol „mintha lefutna”. Ott a kötés egy elemzési előfeltételből jön: például a [script-reads.test.mjs](../../tests/script-reads.test.mjs) esetében a változót egy függvény írja. Ezért rés marad.

## Helyességi érv

- **A legutóbbi biztos író.** Az `s` olvasó és a cella minden írója rendezett (ADR-071). Két író egymással is rendezett, mert mindkettő írja a cellát (írás-írás ütközés). Így minden elfogadott sorrendben az `s` előtt a referencia szerinti előzmények futnak, a referencia sorrendjében.
  - A legutóbbi biztos író (`k`) befejeződött, különben az `s` nem futna: egy listautasítás dobása vagy végtelen ciklusa a listát is elhagyja.
  - A `k` befejeződésekor a cellában egy `k`-ban beírt érték áll.
  - Utána már csak a `k` és az `s` közötti írók írhattak bele.
- **A biztos kód.** Egy listautasítás normálisan csak akkor fejeződhet be úgy, hogy egy kódrészt kihagy, ha ugrik (`break`, `continue`, `return`) vagy ág választ. A dobás és a végtelen ciklus nem befejeződés.
  - A szabály minden ágat, ugrást, `try`-t és ciklust bizonytalannak vesz, egyetlen kivétellel: a minden tagon ugrás nélkül végigmenő `for … of`-ot.
  - Az ilyen ciklus minden tagra lefut, mert:
    - a tagok a literál elemei;
    - a `push` csak hozzáfűz;
    - a sorrendet változtató tömbművelet, vagy az iterált tömb írása a törzsben, kizárja a hatásnyomot (ADR-070).
- **A ciklusváltozó** a kötés szimbólumával azonosított, így egy árnyékoló belső név nem számít a ciklusváltozónak.
- **A `switch`:** egy ismert diszkrimináns `===` szerint választja a kezdő címkét. A kihagyott címkék kiértékelése ismert literálokon nem jár hatással.
- **A mérés (5. pont)** csak egyenértékű és már elutasított sorrendet sorol át. Ha a halott kód nélkül is van kötés, a sorrend rés marad.

## Mérés

**Teljes kampány, 12 mag, 6 fajta, 2 nyelv** (351 664 sorrend, minden lépésben 0 hibás elfogadás):

| Csoport | v37 | v38, csak a generátor | v38, az 5. ponttal |
| --- | --- | --- | --- |
| `flow` JS, nem dobó: rés | 13 | 5 | 1 |
| `flow` TS, nem dobó: rés | 13 | 5 | 1 |
| `flow` JS/TS, nem dobó: elfogadott | 1 849 / 2 260 | 1 881 / 2 292 | 1 881 / 2 292 |
| `flow` JS/TS, nem dobó: szándékhű | 80 / 80 | 56 / 56 | 60 / 60 |
| többi | változatlan | változatlan | változatlan |
| **Összes rés** | **74** | **58** | **50** |
| **Összes elfogadott** | **14 873** | **14 937** | **14 937** |

- **A generátor nyeresége:** nyelvenként 8 rés és 32 elfogadott sorrend. A 24 korábban szándékhű elutasítás most elfogadott, mert a szándékhűségük egy másik literálértéken múlt. Ugyanezt az elvet az ADR-032 már alkalmazza az ismert őrfeltételekre.
- **A mérés nyeresége:** nyelvenként 4 rés, mind halott `catch` (3 a `flow-*-5`, 1 a `flow-*-7` tanúban).
- **Korpusz:** változatlan (19 rés). A gyors alapérték egyik `flow` TS szándékhű sorrendje elfogadott lett.
- **A `flow` maradéka:** nyelvenként 1 rés, `flow-*-7`. A `for (const entry of boxes) { if (seen > 0) { entry.note(…); } seen = seen + 1; }` első körét a feltétel kihagyja, így az `a` naplójába nem ír. Ehhez a ciklus első körét külön kellene értelmezni (ciklusgörgetés), amit az ADR-070 elvetett. A jegyzékben NY-01 maradékként szerepel.

## Bizonyíték

[strong-updates.test.mjs](../../tests/strong-updates.test.mjs):
- **a minden tagon végigmenő ciklus felülír:** a kizárt `case` nem köt;
- **a getter ismert értéke:** a kizárt `if` ág nem köt;
- **negatív esetek**, ahol a régi érték választhatná az ágat:
  - `break` a ciklusban (az `adr072-break` esetben a lazább szabály hibás elfogadást adna);
  - ismeretlen feltételű ág;
  - `try` blokk;
- mindegyiken 0 hibás elfogadás.

A mérés (5. pont) ugyanebben a fájlban:
- **csak egy sosem futó `catch` okozta kötés:** szándékhű, `dead-code`;
- **élő kód okozta kötés (az NY-19 eldobott tömbje):** rés marad.

A [value-guards.test.mjs](../../tests/value-guards.test.mjs) dokumentált veszteségét (`value-guards-merged`) a biztos felülírás megszüntette: a két `check()` cseréje elfogadott, és az orákulum egyetért.

## Tervezési review (ADR-037)

- **Tulajdonosok:**
  - a biztos írás és a láthatóság a heapé (`mustAt`, `members`, `field`);
  - a „biztos kód” fogalma az értelmezőé (`certain`, `every`, `top` a keretben).

  A hatáselemzés és az utasításrendezés interfésze nem változott.
- **Design twice:**
  - *Teljes folyamérzékeny heap erős frissítéssel:* elvetve, ugyanazért, amiért az ADR-071-ben.
  - *A ciklus kiterítése tagonként:* elvetve. A törzset tagonként kellene értelmezni, és a hatásnyom is tagonként nőne. A „minden tag” tény és a ciklusváltozó szimbóluma ugyanezt adja egyetlen értelmezéssel.
- **Mélység és adósság:** a keret három új mezőt kapott. Ez az NY-12 adósságot (a heap és az értelmező egyetlen closure) mélyíti; a jegyzékben ott marad.
