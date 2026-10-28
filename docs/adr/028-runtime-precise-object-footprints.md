# ADR-028 – Futásidőhöz igazított hatásnyom: string-metódusok, mezőszint, `if/else`, egyetlen kivétel (v13)

Állapot: implementálva (2026-10-28). Policyverzió: `scoped-effect-analysis-v13`. Az [ADR-025](025-local-object-effect-footprints.md) hatásnyomát pontosítja. A validátor, a CodeLine-séma és a tanulói parsermentes értékelés változatlan. A régi címkéjű modellek a régi szabállyal maradnak érvényesek; az új címkét csak új generálás vagy kifejezett frissítés (ADR-006) adja.

## Kontextus

A felhasználó a „CodeLine v2 futásidejű függőségmodell” mesterpromptját saját bemenettel (`runMiniFixture`) adta át, és azt kérte, hogy:

- a promptot LLM-ként lefuttatva készüljön modell;
- ezt soronként vizsgáljuk meg;
- a generátor ne legyen túl szigorú. Egy blokkon belül a futásidőben egymástól független sorok legyenek szabadon rendezhetők.

A v12 generátor ezen a bemeneten szinte teljes forrássorrendi láncot adott. A rögzített 3615 sorrendből (teljes egysoros szomszédság és mintavett teljes sorrendek) 369-et fogadott el, hibás elfogadás nélkül. Közben **328 olyan sorrendet utasított el, amelyet a futásidejű orákulum azonosnak lát**. A prompt szerint kézzel készített modell ([runtime-prompt-mini-fixture.llm.json](../runtime-prompt-mini-fixture.llm.json)) ugyanezen a halmazon 0 hibás elfogadást és 0 indokolatlan elutasítást adott. Az állítás tehát releváns volt.

A túlkötésnek négy, egymástól független oka volt.

1. **String-metódus a setterben.** A `this._alias = value.trim()` hívás fogadója primitív érték, amit a v12 ismeretlen kódnak vett. Emiatt a teljes hatásnyom-elemzés kiesett.
2. **Listaszintű `if/else`.** Hatásnyomot csak deklaráció és kifejezés-utasítás kaphatott. Az `if` ismeretlen maradt, és mivel a `second` benne szerepelt, a `second` „kiszökött”. Így a konstrukciója is barrier lett.
3. **Objektumszintű olvasás és írás.** A `first.alias = "A"` (`_alias` mező) és a `first.updateScore(…)` (`score` mező) ugyanazt az objektumot írja, ezért a v12 sorrendhez kötötte őket.
4. **Egyetlen lehetséges kivétel.** Ha két utasításból bármelyik dobhatott, a sorrend kötött maradt. Ez a felhasználó korábbi képernyőképén látott #32 → #33 → #34 lánc egyik lehetséges oka.

## Döntés

### 1. String-metódusok bizonyítottan string értéken

Az absztrakt érték új jelzőt kap: `text`, vagyis minden primitív, ami az érték lehet, string. String-literál, template és stringet tartalmazó `+` ad ilyen értéket; az unió megőrzi. Egy ilyen fogadón csak ezek a metódusok elemezhetők:

| Metódus | Argumentum | Eredmény |
| --- | --- | --- |
| `trim`, `trimStart`, `trimEnd`, `toUpperCase`, `toLowerCase` | nincs | string |
| `includes`, `startsWith`, `endsWith`, `indexOf`, `lastIndexOf` | string | primitív |
| `concat` | string | string |
| `slice`, `substring`, `charAt` | numerikus literál | string |

A korlátozás oka: ezek nem dobnak, és nem futtatnak kódot. A szám, Symbol vagy BigInt argumentum konverziója dobhatna, a regex-argumentum kódot futtathatna, ezért ezeket kizárjuk. A `String.prototype` módosítását a meglévő reflexiós szűrő (`.prototype`, `defineProperty` stb.) kizárja. Ha a fogadó nem bizonyítottan string (például `first.alias = 5` után `value.trim()`), a hívás ismeretlen kód marad.

**Szigorítás:** a `.length` olvasás eddig minden primitíven elemezhető volt, pedig `null.length` és `undefined.length` dob. Mostantól csak bizonyítottan string értéken elemezhető. Emiatt a v13 nem szigorúan bővebb a v12-nél: ebben az egy esetben szűkebb, de helyesebb.

### 2. Listaszintű `if/else` hatásnyoma

Egy függvénykörnyezet listájában az `if` (opcionális `else`-szel, blokktörzsekkel) hatásnyomot kap. Ennek feltételei:

- a feltétele és mindkét ága az ADR-025 elemezhető részhalmazába esik;
- belőle nem lép ki `return` (a beágyazott függvényeken kívül).

A hatásnyom a két ág uniója, vagyis útvonalfüggetlen felső becslés. A sor-tulajdonlás az `if` első (`if (…) {`) és utolsó (`}`) sorára vonatkozik; az ágak sorai a saját blokkjukban maradnak.

### 3. Mezőszintű olvasás és írás

Az olvasás és az írás `objektum::mező` kulcsot kap. Egész objektum (`*`) kerül rögzítésre:

- a létrehozásnál;
- a tömbműveleteknél;
- minden olyan írásnál, amely új kulcsot hozhat létre (nem deklarált mező, vagy objektumliterál-objektum).

A kulcssorrend ugyanis megfigyelhető, például `JSON.stringify` révén. A deklarált, inicializált osztálymező és a paramétertulajdonság a konstrukciókor jön létre, ezért írásuk mezőszintű. A kezdőérték nélküli mező mindkét `useDefineForClassFields` módban csak egész objektumként számít, mert a régi kibocsátás nem hozza létre a kulcsot. Két kulcs akkor ütközik, ha azonos objektumhoz tartozik, és a mezőjük azonos, vagy valamelyik `*`.

### 4. Kivétel csak kivétellel versenyez

Két hatásnyomos utasítás csak akkor kötött `may-throw` okból, ha **mindkettő** dobhat; ekkor a sorrend dönti el, melyik kivétel jut ki. Ha csak az egyik dobhat:

- a másik nem dob, és csak a lista saját, ki nem szökött objektumait éri el;
- a `return` a dobás ágán nem fut, ezért ezek az objektumok a blokk elhagyása után senki számára nem láthatók;
- ha a dobás feltétele vagy üzenete a másik által írt állapotot olvassa, azt a mezőszintű RAW/WAR ütközés köti.

A lokális íráshoz (ADR-013) képest a dobó utasítás kötött marad, mert egy függvénylokális kötést egy `finally` vagy `catch` láthat.

## A mesterprompt bemenetén

| Sor | v12 közvetlen előzmény | v13 közvetlen előzmény | Ok |
| --- | --- | --- | --- |
| `first.alias = "A"` | `second` konstrukciója | `first` | kötésbemenet, `_alias` mező |
| `second.activate()` | `first.alias` | `second` | `state` mező |
| `store.add(first)` | `store`, `first`, `activate()` | `store`, `first` | a tároló csak referenciát tárol |
| `store.add(second)` | `store`, `second`, `add(first)` | ugyanaz | a tárolási sorrend megfigyelhető |
| `first.updateScore(nextScore)` | `add(second)`, `nextScore` | `first`, `nextScore` | `score` mező |
| `if (second.state === "active") {` | `updateScore(first)` | `second`, `activate()` | a feltétel a `state`-et olvassa (RAW) |
| `return store.list();` | az `if` vége | `alias`, `add(second)`, `updateScore`, az `if` vége | a visszaadott állapot |

A v13 modell blokkszerkezettel lezárt sorrendi relációja mind a 46 soron azonos a kézi, prompt szerinti modellével. Ezt a [object-footprints.test.mjs](../../tests/object-footprints.test.mjs) rögzíti. Ugyanezen a mintán a v13 és a kézi modell egyaránt 397 sorrendet fogad el a 3315-ből, 0 hibás elfogadással és 0 indokolatlan elutasítással. A soronkénti vizsgálat: [runtime-prompt-mini-fixture-elemzes.md](../runtime-prompt-mini-fixture-elemzes.md).

## Független orákulum

Az orákulum P2-kivétele (ADR-025, „helyi objektumművelet”) egy alakkal bővül. Az a `if/else` is ilyen művelet, amelynek feltétele egy saját objektum mezőjének szigorú (`===`, `!==`) összevetése egy egyszerű értékkel, és mindkét blokkága csak helyi objektumműveletekből áll. Két ilyen művelet sorrendjét csak a futásidejű P3 dönti el. Az orákulum hatásnyomot továbbra sem számol.

A TypeScript-fixture `export` kulcsszava miatt az orákulum a modult CommonJS-be fordítja, ha a kimenetben `export` van; a deklarációk így szkriptkötések maradnak. Minden más fixture kimenete változatlan.

## Vizsgált alternatívák

- **Értékérzékeny dobáselemzés:** az `if (!id) throw …` konstans argumentummal soha nem dob. Ehhez a feltételeket konstansokkal kellene kiértékelni. Ez külön, nagyobb lépés; a mostani bemeneten nem kell.
- **Az ismeretlen hívás egészének tisztának vétele, ha a TypeScript-típus `string`:** elvetve. Egy `any`-n át érkező szám esetén a `trim()` dob, a típus nem futásidejű garancia.

## Következmények

- A TS-mintatár 24 modelljében csak a policy- és elemzőcímke változott. Ezekben nincs olyan alak, amelyet az új szabályok érintenek.
- A [formális szerződés](../formal-ordering-contract.md) verziótáblája új sort kap.
- Korlát: a hatásnyom továbbra is útvonal- és értékfüggetlen. Ciklus, `switch`, `try` és `else if` lánc listaszinten barrier marad.
