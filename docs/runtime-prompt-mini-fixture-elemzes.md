# A futásidejű mesterprompt lefuttatása és soronkénti vizsgálata (`runMiniFixture`)

Állapot: 2026-10-28. Döntés: [ADR-028](adr/028-runtime-precise-object-footprints.md).

## Mit csináltunk

1. **A prompt LLM-ként.** A „CodeLine v2 futásidejű függőségmodell” mesterpromptot (a felhasználó gépén, a repón kívül) a benne lévő `runMiniFixture` forrással lefuttattuk: a prompt eljárása szerint (A–I. lépés, 5–6. fejezet) kézzel készült egy CodeLine v2 modell. Eredmény: [runtime-prompt-mini-fixture.llm.json](runtime-prompt-mini-fixture.llm.json).
   - `strategy`: `manual-runtime-dependency-analysis`;
   - `semanticEquivalenceProven`: `false`;
   - minden nem triviális élhez magyar `ruleNotes`;
   - `evidence`, `provenance` és `dependencyPolicy` nincs, mert a prompt 5.7. pontja szerint ezeket egy kézi modell nem hamisíthatja.
2. **A modell formai ellenőrzése.** A core `compileCodeLineExercise` hibátlanul befogadja: a séma, a blokkhierarchia, az aciklikusság és az eredeti sorrend elfogadása rendben van.
3. **Összevetés a futásidővel.** A független orákulum minden vizsgált sorrendet le is futtat. A TS-forrást mindkét osztálymező-módban fordítja, és összeveti a visszatérési értéket (JSON), a kivételt és a mellékhatásokat. A v14 óta (ADR-029) a kulcssorrend csak akkor számít, ha a program maga listázza a kulcsokat; ez a program nem teszi.
   - A vizsgált sorrendek: a teljes egysoros szomszédság (minden sor minden helyre, minden párcsere), valamint modellenként 300 mintavett, a modell által megengedett teljes sorrend.
   - A forrás az orákulum fixture-jei közé került (`prompt-mini-fixture`).
4. **Ugyanez a projekt generátorával** a javítás előtt (v12) és után (v13).

| Modell | Vizsgált sorrend | Elfogad | Hibás elfogadás | Futásidőben azonos, mégis elutasít |
| --- | ---: | ---: | ---: | ---: |
| generátor v12 | 3 615 | 369 | 0 | **328** |
| LLM-modell (prompt szerint) | 3 615 | 697 | 0 | 0 |
| generátor v13 | 3 315 | 397 | 0 | 0 |
| LLM-modell, a v13 futás mintáján | 3 315 | 397 | 0 | 0 |

A két futás mintája eltér, mert a mintavétel a modellek saját megengedett sorrendjeiből dolgozik. A v13 és a kézi modell blokkszerkezettel lezárt sorrendi relációja **mind a 46 soron azonos**; ezt teszt rögzíti.

## Az állítás relevanciája

**Az állítás: ami futásidőben független, az egy blokkon belül szabadon rendezhető legyen.** Ez helytálló, és a prompt maga is előírja: „ne vezess be bizonyíthatóan felesleges sorrendi éleket”. A v12 ennél szigorúbb volt (lásd a fenti 328 sorrendet).

Két pontosítással igaz:

- **Független, ha bizonyítottan az.** Ismeretlen kód, közös objektum, alias vagy két lehetséges kivétel esetén a sorrend továbbra is kötött. Ezt a prompt is így kéri: „a helyes elfogadás fontosabb a maximális szabadságnál”.
- **A „futásidőben mindegy” a megfigyelhető viselkedésre értendő.** Az értékek, a kivételek és a mellékhatások számítanak. A kulcssorrend a felhasználó döntése alapján (2026-10-28, [ADR-029](adr/029-unobserved-instance-field-order.md)) csak akkor, ha a program maga listázza a kulcsokat. A v13 még kötötte a 3 → 4 → 5. sort; a v14 felszabadítja.

## Soronkénti vizsgálat

Jelölés: az LLM oszlop a kézi modell mai, ADR-029 szerinti állapota. A számok a közvetlen előzmények (`dependencies`). A „–” azt jelenti, hogy csak a blokkszerkezet köti a sort. A kézi modell a blokkszerkezetből adódó éleket nem írja ki, a generátor igen; a lezárt reláció ettől nem változik.

### Osztályok (1–28. sor)

| # | Sor | v12 | LLM | v14 | Indok |
| --- | --- | --- | --- | --- | --- |
| 1 | `type State = "idle" \| "active";` | – | – | – | típus, futásidőben nem létezik |
| 2 | `class User {` | – | – | – | a függvény nem fut a modul kiértékelésekor |
| 3 | `private _alias = "";` | 2 | – | 2 | blokkszerkezet |
| 4 | `state: State = "idle";` | 3 | – | 2 (v13: 3) | v14: a literál-kezdőértékű példánymezők szabadok, mert a program nem listázza a kulcsokat |
| 5 | `score = 0;` | 4 | – | 2 (v13: 4) | ugyanaz |
| 6 | `constructor(public readonly id: string, public name: string) {}` | 2 | – | 2 | a paramétertulajdonságok helye nem a sor helyétől függ |
| 7–9 | `set alias(value: string) { … }` | 2 | – | 2 | a prototípus-kulcsok sorrendjét a program nem listázza (ADR-020) |
| 10–12 | `get alias(): string { … }` | 2 | – | 2 | ugyanaz |
| 13–15 | `activate(): void { … }` | 2 | – | 2 | ugyanaz |
| 16–18 | `updateScore(value: number): void { … }` | 2 | – | 2 | ugyanaz |
| 19 | `}` | 18 | – | 18 | blokkszerkezet |
| 20 | `class Store<T> {` | – | – | – | független a `User`-től |
| 21 | `private readonly items: T[] = [];` | 20 | – | 20 | egyetlen mező |
| 22–27 | `add(…)`, `list()` | 20 | – | 20 | a prototípus-kulcsok sorrendje nem megfigyelt |
| 28 | `}` | 27 | – | 27 | blokkszerkezet |

Az osztályrészben a 4–5. sor kivételével a modellek egyeznek. Ezt a két kötést a v14 oldja fel (ADR-029); a kézi modell ehhez igazodott, a lezárt sorrendi reláció ma is azonos.

### `runMiniFixture` (29–46. sor)

| # | Sor | v12 | LLM | v13 = v14 | Indok | Értékelés |
| --- | --- | --- | --- | --- | --- | --- |
| 29 | `export function runMiniFixture(…) {` | – | – | – | blokknyitó | |
| 30 | `const store = new Store<User>();` | 29 | – | 29 | független konstrukció | |
| 31 | `const first = new User("u1", "Anna");` | **30** | – | 29 | független konstrukció | v12 túlkötött |
| 32 | `const second = new User("u2", "Bela");` | **31** | – | 29 | független konstrukció | v12 túlkötött |
| 33 | `first.alias = "A";` | **32** | 31 | 31 | a `first` kötése (TDZ); a setter csak a `_alias`-t írja, a `trim()` string-metódus | v12 túlkötött |
| 34 | `second.activate();` | **33** | 32 | 32 | a `second` kötése; csak a `state`-et írja | v12 túlkötött |
| 35 | `store.add(first);` | 30, 31, **34** | 30, 31 | 30, 31 | a tároló referenciát tárol, ezért az alias írása nem kötött hozzá | v12 túlkötött |
| 36 | `store.add(second);` | 30, 32, 35 | 32, 35 | 30, 32, 35 | a tárolási sorrend a visszatérési értéken látszik | helyes |
| 37 | `const bonus = 5;` | 29 | – | 29 | tiszta | helyes |
| 38 | `const nextScore = 40 + bonus;` | 37 | 37 | 37 | a `bonus` értékét olvassa | helyes |
| 39 | `first.updateScore(nextScore);` | **36**, 38 | 31, 38 | 31, 38 | csak a `score`-t írja, az `_alias`-tól független | v12 túlkötött |
| 40 | `if (second.state === "active") {` | **39** | 34 | 32, 34 | a feltétel a `state`-et olvassa, amit az `activate()` ír (RAW) | v12 túlkötött |
| 41 | `second.updateScore(90);` | 40 | – | 40 | a then-ág tagja | helyes |
| 42 | `} else {` | 41 | 41 | 41 | klauzulahatár | helyes |
| 43 | `second.updateScore(10);` | 42 | 42 | 42 | az else-ág tagja | helyes |
| 44 | `}` | 43 | – | 43 | blokkzáró | helyes |
| 45 | `return store.list();` | 44 | 33, 36, 39, 44 | 33, 36, 39, 44 | minden hatás a visszaadott állapoton látszik | helyes |
| 46 | `}` | 45 | – | 45 | blokkzáró | helyes |

A v12 a 31–40. sorokat egyetlen láncba fűzte. A v13-ban **szabadon felcserélhető** például:

- az `alias` és az `activate()`;
- az `alias` és az `add(first)`;
- az `alias` és az `updateScore` (ugyanaz az objektum, más mező);
- az `alias` vagy az `add(second)` és a teljes `if/else`;
- a három konstrukció egymással;
- a `bonus` / `nextScore` és bármely objektumművelet.

**Kötött marad:**

- az `add(first)` → `add(second)` (a tárolási sorrend);
- az `activate()` → az `if` (az `if` olvassa, amit az `activate()` ír);
- minden hatás → `return`;
- minden használat a deklarációja után.

## A javítás

A túlkötés négy okát és a döntéseket az [ADR-028](adr/028-runtime-precise-object-footprints.md) részletezi:

1. string-metódus bizonyítottan string értéken;
2. listaszintű `if/else`;
3. mezőszintű olvasás és írás;
4. egyetlen lehetséges kivétel nem köt.

Egy közben talált soundness-hibát is javítottunk: a `.length` olvasást a v12 bármely primitíven elfogadta.

## Korlátok

- A kampány és az orákulum minta, nem teljes bizonyítás. A 11 mozgatható utasítás 11! sorrendjét nem soroltuk fel.
- A hatásnyom útvonal- és értékfüggetlen. Egy konstans argumentummal soha nem teljesülő `throw`-ág még dobásnak számít.
- A kézi modell is csak egy elemzés: a helyességét az orákulum futásidejű összevetése támasztja alá, nem formális bizonyítás.
