# ADR-034 – Vezérlési szerkezetek hatásnyoma a függvénytörzsben (v17)

Állapot: implementálva (2026-10-29). Policyverzió: `scoped-effect-analysis-v17`. Az [ADR-025](025-local-object-effect-footprints.md), [ADR-028](028-runtime-precise-object-footprints.md) és [ADR-032](032-value-sensitive-guards.md) hatásnyomát terjeszti ki. A validátor, a séma és a tanulói értékelés változatlan.

## Kontextus

Az ADR-028 óta a listaszintű, egyszerű `if/else` kap hatásnyomot. Az `else if` lánc, a `switch`, a `try` és a ciklus viszont barrier maradt. Így egy saját objektumon dolgozó elágazás vagy ciklus minden más utasítást sorrendhez kötött.

## Döntés

### 1. Új szerkezetek

Egy függvénykörnyezet listájában ezek is hatásnyomot kapnak, ha a tartalmuk az elemezhető részhalmazba esik, és belőlük nem lép ki `return`:

- **`if / else if / else` lánc.** Rekurzívan; az ismert feltétel (ADR-032) csak a kiválasztott ágat futtatja.
- **`switch`.** Minden ág futhat (a továbbcsorgás is), a feltétel és a `case` értékek kiértékelődnek. A címke nélküli `break` a `switch`-ből lép ki.
- **`try / catch / finally`.**
  - A `try`-ban lehetséges dobást a `catch` elnyeli.
  - A `catch` csak akkor fut, ha a `try` dobhat; a kötött változója külső érték (`other`).
  - A `finally` mindig fut.
  - `catch` nélkül a `try` dobása kijut.
- **`for…of` saját tömbön.**
  - A ciklus a tömb minden elemét olvassa, a ciklusváltozó az elemek uniója.
  - A címke nélküli `break` és `continue` a cikluson belül marad.
  - **Véget érés:** ha a ciklusmag a bejárt tömböt írja, a ciklus nem biztosan ér véget, ezért az utasítás ismeretlen marad.
  - A programban szereplő `Symbol.iterator` a bejárást átírhatja, ezért kizárja az elemzést.

### 2. Ismert érték ciklusban

A ciklusmagban értékadást kapó helyi változók ismert értéke a mag kiértékelése előtt elveszik. Egy későbbi kör ugyanis mást láthat. Nélküle egy `if (seen > 0) throw …` a második körben dobó ciklust nem dobónak látnánk.

**A kupac fixpontja** mostantól azt is változásnak tekinti, ha egy mező ismert értéke elveszik. Így az objektumonként összevont értékszemantika (ADR-032) az utasítások sorrendjétől függetlenül, determinisztikusan áll be.

### 3. Sor-tulajdonlás

Egy összetett utasítás az első sorát (a nyitó kapcsos zárójelig) és az utolsó blokkja záró sorát birtokolja.

- **`switch`:** a `case` sorai egy többsoros egységet alkotnak saját blokk nélkül. A CodeLine v2 az ilyen egységet a szomszédaihoz lezárja (ADR-009, dokumentált projekciós veszteség). A `switch` hatásnyoma ezért szemantikai okot már nem ad, de a lezárás megmarad.

### 4. Kimarad

- **A számlálós `for`, a `while` és a `do`:** a véget érésük nem bizonyítható.
- **A címkés ugrás, a `for…in`, az `await` és a `yield`:** nem elemezhető.
- **Helyi `let` változókat író szerkezetek:** a lista szintjén továbbra is barrier.

## Független orákulum

A helyi objektumművelet alakjai kiegészülnek (TypeScript és JavaScript):

- `else if` lánc;
- `switch` értékekkel és címke nélküli ugrással;
- `try/catch/finally`;
- `for…of` saját objektumon, ahol a ciklusváltozó a magban a saját objektum álneve.

Sorrendjükről a futásidejű P3 dönt.

## Bizonyíték

[control-flow-footprints.test.mjs](../../tests/control-flow-footprints.test.mjs) és hat új fixture. Az objektumhatás-csomag minden fixture minden elfogadott egysoros mozgatását a futásidejű orákulummal ellenőrzi.

**Lefedett esetek:**

- `else if` lánc;
- `switch` (JS és TS, a lezárás pontos okával);
- `try/catch` szemben a `try/finally`-val;
- `for…of` és a tömbírás;
- a második körben dobó ciklus;
- konzervatív esetek: a bejárt tömb írása, címkés `break`, korai `return`.
