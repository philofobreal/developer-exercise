# ADR-012 – Osztálykiértékelési fázisok és accessorpárok

Állapot: implementálva. Bizonyítottan helyes lazítás, az ADR-008/010 szabályainak szűkítése nélkül. A validátor, a CodeLine-séma jelentése, a tanulói parsermentes értékelés és a bizalmi határ változatlan.

## Kontextus

A generatív kampány 550 programján nem volt hibás elfogadás, de 3 524 indokolatlan elutasítás igen. Ezek közül megszámoltam azokat, amelyek két szomszédos egység cseréjéből adódnak. Osztályprogramokon a leggyakoribb okok:

| Cserélt egységek | Rés (60 JS- és 25 TS-program) | Mi a szabály oka |
| --- | ---: | --- |
| getter ↔ setter, accessor ↔ metódus vagy mező | kb. 90 | az azonos nevű get/set pár „duplikált névnek” számított, ezért teljesen kötött volt |
| példánymező ↔ static mező, static accessor mező | kb. 25 | minden futásidejű mező egyetlen láncban volt |
| számított nevű metódus ↔ mező | kb. 20 | a számított nevű tag minden futásidejű egységhez képest kötött volt |
| duplikált nevű metódus ↔ bármi, overload-szignatúrák | kb. 25 | **szándékosan marad**: a későbbi definíció felülír, a szignatúrák sorrendje pedig típusszintű jelentést hordoz |

A szkriptszintű `let`/`var`/`const` rések szintén szándékosak. A szkriptszintű kötés a globális scope-on át szövegből futtatott kóddal (`Function`, indirekt `eval`) is írható, és ez szintaktikusan nem látszik.

## Döntés

A [type-member-ordering.ts](../../src/author/type-member-ordering.ts) a ClassDefinitionEvaluation három időpontját különbözteti meg (ECMA-262, ClassDefinitionEvaluation és DefineField):

1. **`key`:** a tagok definiálása forrássorrendben; ekkor értékelődnek ki a számított kulcsok, és ekkor jönnek létre a metódusok és accessorok.
2. **`static`:** a ciklus után, forrássorrendben, a static mezők inicializálói és a static blokkok.
3. **`instance`:** példányosításkor, forrássorrendben, a példánymezők inicializálói egy másik objektumon.

**Szabályok:**

- **R1 – accessorpár:** pontosan egy getter és egy setter, törzzsel, azonos névvel és azonos (static vagy példány) elhelyezéssel, egyetlen tulajdonságot alkot.
  - Mindkét fele definíció, ezért a mezőkhöz képest szabad (ADR-008).
  - A kulcsláncban (ADR-010) a két fél egy csoport: mindkettő követi az előző kulcsot és megelőzi a következőt, egymás közt viszont tetszőleges sorrendben állhatnak.
  - Ha egy másik kulcs áll a két fél között, nincs csoportosítás, és mindkét fél külön lánctag marad.
- **R2 – static és példányfázis:** a nem számított nevű, nem dekorált, komment nélküli mező a saját fázisában (`static` vagy `instance`) marad sorrendben; a static blokk `static`. A két fázis egysége egymáshoz képest szabad.
- **R3 – számított nevű metódus:** a törzzsel rendelkező, számított nevű metódus vagy accessor `key` fázisú: a mezőkhöz képest szabad, a többi `key` egységhez és minden fázis nélküli egységhez képest kötött, és a kulcsláncban marad.
- **Kötött marad minden más:** komment, overload-csoport, duplikált név, dekorált tag, számított nevű mező és index-szignatúra. Fázis nélküli egységként ezek minden egységhez képest kötöttek.

**Él:** egy futásidejű U egység minden korábbi V egységet követ, amellyel van közös fázisa, illetve amelynek vagy U-nak nincs fázisa. A redundáns éleket a meglévő tranzitív redukció eltávolítja.

**Policy-címke:** új, additív `scoped-effect-analysis-v8`. A régi modellek és címkék érvényesek; importkor nincs újraszámítás. A szerzői magyarázat (`authoring.note`, legfeljebb 1000 karakter) leírja a párt és a fázisokat.

## Helyességi érvelés

- **R1:**
  - Az első fél definíciója létrehozza a kulcsot (`enumerable: false`, `configurable: true`, accessor). A második fél ugyanerre a kulcsra részleges descriptorral definiál, így a meglévő másik fél megmarad.
  - Mindkét sorrendben ugyanaz a {get, set} accessor jön létre, ugyanazzal a descriptor-fajtával, és a kulcs az első fél helyén keletkezik.
  - A csoport mindkét fele megelőzi a következő kulcsot, és követi az előzőt, így a kulcs relatív helye nem változik.
  - Mezőinicializáló vagy static kód a definíciók előtt soha nem fut (ADR-008).
- **R2:**
  - A static inicializálók a definíció végén futnak, a példányinicializálók csak `new` hatására.
  - Ha egy static inicializáló példányt hoz létre (`static sample = new C()`), a példányinicializálók ennek a static egységnek az időpontjában futnak, a saját forrásbeli helyüktől függetlenül.
  - Ekkor minden példánymező-definíció már ismert, mert azokat a definíció gyűjti össze.
  - A kulcsok más objektumon jönnek létre: a példányon, illetve a konstruktoron.
  - TypeScriptben, `useDefineForClassFields: false` mellett, a példányinicializálók a konstruktorba kerülnek, a static mezők pedig az osztály után kapnak értéket, mindkettő forrássorrendben; ez ugyanezt a szétválasztást adja.
- **R3:**
  - A számított metóduskulcs a definíciós ciklusban értékelődik ki, minden static és példányinicializáló előtt.
  - A számított kulcsok egymás közti sorrendje és a kulcslánc megmarad.
  - A számított nevű mező kötött marad. A TypeScript `useDefineForClassFields: false` mellett a kulcsát egy static blokkban számolja ki (`static { _a = k(); }`), így a kulcs kiértékelése a két emit-módban más fázisba esik.

Ez emberi érvelés a specifikáció lépésein, nem gépi bizonyítás. A független ellenőrzés empirikus (lásd lent).

## Ellenőrzés

- **Reprodukció** ([class-phase-ordering.test.mjs](../../tests/class-phase-ordering.test.mjs)): mindhárom szabály JS-ben és TS-ben, mindkét osztálymező-módban. Benne van a példányt létrehozó static mező esete, az indokolt elutasítások, az egyetlen dokumentált konzervatív eset (a setter a következő metódus mögé kerül), és a fixture-ök összes blokkmozgatásának soundness-ellenőrzése.
- **Korpusz és generatív kampány:** [formális szerződés, ADR-012](../formal-ordering-contract.md#adr-012-osztálykiértékelési-fázisok-és-accessorpárok).

## Vizsgált alternatívák

- **A szkriptszintű `let`/`var` const-ként kezelése:** elvetve. A szövegből futtatott kód általi írás szintaktikusan nem zárható ki.
- **A mezők inicializálótisztaság szerinti szabaddá tétele** (például egy privát és egy publikus mező literál-inicializálóval): elhalasztva. Ehhez mezőszintű olvasási és írási elemzés kell a `this`-re.
- **A „legalább az egyik fél előzze meg” feltétel a párra:** precedencia-élekkel nem fejezhető ki, ezért a konzervatív „mindkét fél” feltétel marad.
