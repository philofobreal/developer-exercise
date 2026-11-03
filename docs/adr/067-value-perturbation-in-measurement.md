# ADR-067 – Érték-perturbáció a mérésben: a véletlenül egyező értékek nem rések

Állapot: **elfogadva** (2026-11-03). Orákulum és mérés; a generátor, a validátor és a szabályverzió nem változik. A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 3.2 pontjának torzítását és az [ADR-064](064-monotone-while-loops.md) nyitott tételét zárja le. Az [ADR-043](043-dead-code-intent-policy.md) A-politikájának mérését teszi teljessé.

## Kontextus

Az ADR-043 döntése szerint a le nem futó kód sorrendjét úgy ítéljük meg, mintha lefutna. A semmit nem változtató írásét pedig úgy, mintha más értéket írna. A mérés eddig csak az elsőt ismerte fel, azt is csak akkor, ha a megsértett szabály egyik sora maga halott.

**Ami résnek számított, holott szándékhű elutasítás:**
- egy írás, amelyről egy elágazás vagy `switch` mindkét sorrendben ugyanúgy dönt, mert a két érték véletlenül azonos ágra visz. Például `a.tag = 't8'` a `switch (a.tag)` előtt, amikor `''` és `'t8'` is a `default` ágra fut;
- a biztos kivétel (3.2) miatt halott megfigyelés. A megsértett szabály két élő sort köt (például a konstruktor két mezőírását), de a kulcssorrendet olvasó `JSON.stringify` a dobás után már nem fut le;
- egy `switch` vagy elágazás fejsora, amely egy halott ág miatt köt. A szabály ilyenkor az élő fejsort nevezi meg, nem a halott sort.

Emiatt a `flow` és a dobó `object` programok rése felülbecsült volt. A mérés nem tudta szétválasztani a generátor valódi pontatlanságát (például a ciklus túlbecslését) a szándékos elutasítástól.

## Döntés

1. **A rögzített fixture literáljai az adatai.** Egy elutasított, futásidőben egyenértékű sorrend akkor is `intent` (ok: `value`), ha a program **egyetlen literálját** egy másik értékre cserélve a sorrend már másként viselkedik. A csere a változat referenciájához mérve történik, ugyanazzal az orákulummal.
   - A sorrend a program adatfüggését tanítja, nem egyetlen futás eredményét (ADR-043, 1. pont).
   - Ha egy egyetlen értéken múló változat megkülönbözteti, a megsértett szabályok között van valódi adatfüggés.
2. **A változatok** ([literal-variants.mjs](../../tests/support/literal-variants.mjs)):
   - **Literál:** szöveg-, szám- és logikai literál.
   - **Nem literál:** a típuspozíció, a modulspecifikátor, a direktíva, a tag- és kulcsnév, valamint a többsoros literál. Ezek nem adatok, vagy a csere megváltoztatná a forrás alakját.
   - **Az új érték:** a program egy másik, azonos fajtájú értéke, vagy egy friss érték. A szám nem lesz negatív.
   - **Sorrend:**
     - előbb a megsértett szabályok saját sorainak literáljai („az az írás vagy összehasonlítás más értékkel”), utána a program többi literálja („ugyanaz a sorrend más adattal”);
     - értékekből előbb a döntési értékek (`===`, `<` és társai operandusa, `case` címke).
   - **Keret:** elutasított sorrendenként legfeljebb 48 változat (`VALUE_VARIANTS`).
   - **Ami nem bizonyít:** ha a változat saját referenciája dob, kifut az időből vagy nem értelmezhető, az a változat semmit nem bizonyít.
3. **Az eredmény tanút ad:** sor, régi és új érték (`witness`). Az osztályozó az `intent` okát is megadja: `dead-code` vagy `value`. A kampány soronként ezt külön számolja (`intentBy`).
4. **Kapu a visszalépés ellen:**
   - **Probléma:** egy szigorúbb generátor új, fölösleges szabálya is megjelenhetne „értékfüggőként”.
   - **Gyors generatív mérés:** a résarány mellett az **ekvivalens-elutasítási arányt** is rögzíti: (rés + szándék) / (elfogadott + rés + szándék). Ez sem nőhet egyik csoportban sem.
   - **Korpusz:** a fixture-enkénti rögzítés a szándékos elutasítások számát is tartalmazza.

## Határok, őszintén

- **Egy literál, korlátos keret.** Ami csak két literál együttes cseréjével látszik, vagy a 48 változaton túl, az rés marad. A mérés így résben továbbra is felső becslés, szándékban alsó.
- **A tanú nem rendel okot a szabályhoz.** A változat azt mutatja, hogy a sorrend számít. Azt nem, hogy éppen melyik megsértett szabály miatt. A szomszédos mozgatásoknál minden átrendezett pár a mozgatott sort érinti, ezért a különbség oka a mozgatott sor egy függése.
- **Nem helyességi bizonyíték.** A hibás elfogadás mérése változatlan: azt mindig az eredeti programon ítéljük meg.
- **A paraméteres programok** literálcseréje ritkán számít, mert ott a bemenetet a próbák változtatják (ADR-061).

## Mérés

Előtte és utána ugyanazzal a v33-as generátorral, ugyanazokon a programokon és sorrendeken; csak az osztályozás változott.

**Teljes kampány, 12 mag, 6 fajta, 2 nyelv** (351 635 sorrend, előtte és utána is 0 hibás elfogadás):

| Csoport | Rés előtte → utána | Új `value` szándék | Résarány | Ekvivalens-elutasítási arány |
| --- | --- | --- | --- | --- |
| `flow` JS, nem dobó | 115 → 51 | 64 | 5,9% → 2,7% | 5,9% |
| `flow` TS, nem dobó | 115 → 51 | 64 | 4,9% → 2,2% | 4,9% |
| `flow` JS, dobó | 88 → 65 | 23 | 13,2% → 10,1% | 17,4% |
| `flow` TS, dobó | 22 → 21 | 1 | 3,0% → 2,9% | 7,2% |
| `object` JS, dobó | 71 → 0 | 71 | 15,2% → 0% | 19,5% |
| `object` TS, dobó | 27 → 0 | 27 | 5,2% → 0% | 9,6% |
| `function`, `class`, `script`, `param`, nem dobó `object` | változatlan | 0 | változatlan | |
| **Összesen** | **560 → 310** | **250** | | |

- **A `flow` maradéka:** főleg a ciklus túlbecslése (`object-write-after-write`: 40 + 46), valamint a `switch`, a `branch-contains-barrier` és a kötésbemenet.
- **Valódi generátorkorlátok, nem érintette az átsorolás:**
  - a nem dobó `object` programok 22 rése;
  - a `param` 12 rése;
  - a `class` TS overload-rése.
- **Korpusz:** a 35 rés és minden rögzített érték változatlan. 0 sorrend lett `value` szándék, mert a korpusz fixture-jei célzott tanúk, nem véletlenül egyező értékek.
- **Gyors alapérték:**
  - `flow` JS 8 → 3, `flow` TS 5 → 1;
  - dobó `object` JS 3 → 0, TS 1 → 0;
  - az ekvivalens-elutasítási arány minden csoportban az eddigi résarány, vagy a halott kód miatt annál magasabb.
- **Költség:** a 3 magos `flow`/`object` próba 1 perc 47 mp → 2 perc 2 mp.

## Bizonyíték

[value-intent.test.mjs](../../tests/value-intent.test.mjs):
- **`switch`:** a `switch` által nem észlelt írás `intent` (`value`), a tanú a `case` címke;
- **biztos dobás:** a csak a biztos dobás miatt rejtett írás `intent` (`value`);
- **valódi rés:** a ciklus túlbecslése (`for … of` + `break`) rés marad;
- **literálok:** nevek, típusok, direktívák és modulspecifikátorok kimaradnak, az összehasonlítás döntési érték.

[generative-metrics.test.mjs](../../tests/generative-metrics.test.mjs): az ekvivalens-elutasítási arány kapuja.

## Tervezési review (ADR-037)

- **Tulajdonos:** az osztályozó (`order-classification.mjs`) dönti el a fajtát, a literálok tudása a `literal-variants.mjs`-é. Az orákulum változatlan; a változatot ugyanazzal a `createOracle`-lel ítéljük meg.
- **Interfész:** a `classify` eredménye additívan bővült (`reason`, `witness`). A kampánysorok új mezői: `intentBy`, `equivalentRejectionRate`.
- **Design twice:**
  - *A halott-kód feltétel kiterjesztése az összetett utasítások fejsorára:* elvetve. Csak a harmadik esetet fedné, a véletlenül egyező értékeket és a dobás mögötti megfigyelést nem.
  - *Az orákulum megfigyelésének kiterjesztése a nem futó ágakra:* elvetve. Ehhez mesterségesen kellene futtatni olyan kódot, amelyet a program nem futtat. Ez új szemantikát vinne a referenciába.
