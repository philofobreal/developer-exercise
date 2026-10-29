# A példafeladatok migrációja – tételes eltéréslista (döntésre vár)

Állapot: **részben alkalmazva.**
- A `class-inventory-ts` frissítése jóváhagyás után alkalmazva (2026-10-29).
- A többi négy példa döntésre vár, a fájljaik változatlanok. A lista a [megbízhatósági terv](megbizhatosagi-audit-terv.md) 1. fázisának 3. lépéséhez készült. Az alapja az explicit „Sorfüggőségek újraszámítása” (`refreshAuthorModel`) a mai generátorral, `scoped-effect-analysis-v17` szabályverzióval.

**Módszer:**
- **Vizsgált sorrendek:** minden egysoros áthelyezés és páros csere, valamint mindkét modell 300–300 véletlen lineáris kiterjesztése.
- **Összevetés:** minden sorrendre a régi és a frissített modell döntése.
- **Eltérő döntés:** ahol a kettő eltér, azt a futásidejű orákulum minősíti:
  - két szerződésen belüli bemenettel;
  - a kulcssorrendet a program maga nem sorolja fel, ezért az nem számít (ADR-029).

## Összefoglaló

| Példa | Frissíthető? | Minősítés utána | Új elfogadás | Elvesztett elfogadás | Javaslat |
| --- | --- | --- | --- | --- | --- |
| [class-inventory-ts](../examples/class-inventory-ts.json) | igen | `analysis-verified` | 0 | 0 | **alkalmazva**, a viselkedés nem változott |
| [class-accounts-ts](../examples/class-accounts-ts.json) | igen | `analysis-verified` | 8 (mind helyes) | 248 (mind `effect-order`) | döntés: szigorúbb lesz |
| [algo-bfs-js](../examples/algo-bfs-js.json) | igen | `author-modified` (2 rögzített sor) | 0 | 301 (289 `effect-order`, 12 valóban azonos) | döntés: jóval szigorúbb lesz |
| [algo-sort-search-js](../examples/algo-sort-search-js.json) | **nem** | – | – | – | új feladatként kell felvenni |
| [profiles-js](../examples/profiles-js.json) | **nem** | – | – | – | a forrást vagy a profilt kell újragondolni |

**Fogalmak:**
- **`effect-order`:** az orákulum szintaktikus hatásrend-ellenőrzése szerint a sorrend eltér, mert két esetleg kivételt dobó vagy hatásos művelet cserélődik fel.
  - Ilyen például a `grid.length` és a `grid[0].length` cseréje. `grid = null` esetén a két hibaüzenet eltér.
  - Érvényes bemeneten a program ugyanazt adja. A régi modell tehát a mai szabály szerint nem egyenértékű sorrendeket is elfogadott.
- **Valóban azonos:** az orákulum futtatással is azonosnak találta. Az elutasítás ilyenkor a generátor túlszigorúsága, vagyis teljességi rés.

## Példánként

### class-inventory-ts – alkalmazva, változás nélkül

A közvetlen függőségek két helyen térnek el, de a lezárt rendezés azonos. 1917 vizsgált sorrendből egyetlen döntés sem változik.

**Hogyan alkalmaztuk:**
- **Módszer:** az explicit `refreshAuthorModel` futott.
- **Feltétel az íráshoz:** a fájl csak akkor íródott ki, ha mind a négy azonos volt: a függőségek és a blokkszerkezet együttes tranzitív lezártja, a blokkok, a sorok és az azonosítók (id, revízió, cím, leírás).
  - **A lezárt megbízható mérce:** az elfogadott sorrendek halmaza csak ettől függ, ezért nem változhatott.
  - **A revízió maradt 2:** a mentett tanulói elrendezések ezért érvényesek maradnak.
- **Mi került be:** a v17 proveniencia és bizonyíték (`authoring`).
- **Tesztelés:** a [catalog-publication](../tests/catalog-publication.test.mjs) igazolja, hogy egy újabb frissítés semmit nem változtat. A meglévő orákulumtesztek (`complex-scope-ordering`, `reflection-ordering`, `ordering-properties`) változatlanul zöldek.

| Sor | Elhagyott közvetlen függőség | Új közvetlen függőség |
| --- | --- | --- |
| 23 `return total;` | – | 19 `let total = 0;` |
| 34 `}` | 17 `}`, 24 `}` | – |

### class-accounts-ts – frissíthető, szigorúbb lesz

| Sor | Elhagyott közvetlen függőség | Új közvetlen függőség |
| --- | --- | --- |
| 3 `private readonly history: string[] = [];` | 2 `protected balance = 0;` | 1 `abstract class Account {` |
| 6 `this.balance += amount;` | – | 5 `deposit(amount: number): void {` |
| 7 `this.history.push('+' + amount);` | – | 6 `this.balance += amount;` |
| 8 `}` | 6 `this.balance += amount;` | – |
| 14 `this.history.push('-' + amount);` | 12 `}` | 13 `this.balance -= amount;` |
| 15 `return true;` | 13 `this.balance -= amount;` | – |
| 21 `}` | 8 `}`, 16 `}`, 19 `}` | – |
| 22 `class CreditAccount extends Account {` | – | 1 `abstract class Account {` |
| 23 `constructor(owner: string, private readonly credit: number) {` | – | 22 `class CreditAccount extends Account {` |
| 26 `protected limit(): number {` | – | 22 `class CreditAccount extends Account {` |
| 29 `}` | 25 `}` | – |

**Új elfogadás (8):**
- A két mezőt (`balance`, `history`) a régi modell sorrendhez kötötte, az új nem.
- A metódusok záró sorai egymáshoz képest szabadok.
- Az orákulum szerint mind a 8 helyes.

**Elvesztett elfogadás (248):**
- **Tartalom:** a metódustörzsben a `this.balance` írása és a `this.history.push(…)` hívás felcserélése (`7 6`, `14 13`).
- **Miért ellentmondásos:** a két művelet futásidőben `amount`-tól függetlenül azonos eredményt ad.
- **Miért köti mégis sorrendhez a v17:** a `push` ismeretlen metódushívás, és a `'+' + amount` konverziója is kódot futtathat.
- **Pedagógiai kérdés:** a tanuló ezt joggal tarthatja azonosnak. A [terv](megbizhatosagi-audit-terv.md) 4. fázisa (szökésanalízis, ismert beépített metódusok) éppen ezt a rést célozza.

### algo-bfs-js – frissíthető, jóval szigorúbb lesz

| Sor | Elhagyott közvetlen függőség | Új közvetlen függőség |
| --- | --- | --- |
| 2 `const rows = grid.length;` | – | 1 `function shortestPath(grid, start, goal) {` |
| 3 `const cols = grid[0].length;` | – | 2 `const rows = grid.length;` |
| 4 `const directions = …;` | – | 1 `function shortestPath(…) {` |
| 5 `const visited = new Set([start.join(',')]);` | – | 3 `const cols = grid[0].length;` |
| 6 `const queue = [[start[0], start[1], 0]];` | – | 5 `const visited = …;` |
| 7 `while (queue.length > 0) {` | 2, 3, 5 | – |
| 13 `const nextRow = row + dr;` | – | 12 `for (const [dr, dc] of directions) {` |
| 14 `const nextCol = col + dc;` | – | 13 `const nextRow = row + dr;` |
| 15 `const key = nextRow + ',' + nextCol;` | 13 | – |
| 16 `const inside = …;` | 13, 14 | 15 `const key = …;` |
| 17 `if (!inside \|\| grid[nextRow][nextCol] === 1 \|\| visited.has(key)) {` | 15 | – |
| 21 `queue.push([nextRow, nextCol, distance + 1]);` | 19 `}` | 20 `visited.add(key);` |
| 22 `}` | 20 `visited.add(key);` | – |

**Mit változtat:**
- A régi modell a bevezető `const` sorokat (2–6) szabadon engedte. Az új mindet láncba köti, mert mind olvas egy paramétert, és dobhat (`grid.length`, `grid[0].length`, `start.join`, `start[0]`).
- **Elvesztett elfogadás:** 301. Ebből 289 a mai szabály szerint valóban eltérő. 12 futásidőben azonos (például `nextRow` és `nextCol` cseréje); ott az új modell túlszigorú.
- **Megmarad:** a 2 rögzített sor.
- **Minősítés:** `author-modified`.

### algo-sort-search-js – nem frissíthető

- **Mi változott:** a mai generátor egy új, beágyazott blokkot lát a 22–26. sorban, az `else if` láncot a 17–27. blokkon belül.
- **Eltérő scope:** ezért a 23–25. sor (`low = mid + 1;`, `} else {`, `high = mid - 1;`) más scope-ba kerül.
- **Miért nem frissíthető:** a v2 sorazonosság és blokkszerkezet nem változhat csendben.
- **Teendő:** a régi 4 kézi él sorsáról is dönteni kell. Választható út:
  - **(a)** a feladatot új azonosítóval vagy revízióval újragenerálni, „Referenciaforrás alkalmazása új feladatként”;
  - **(b)** a régi modellt meghagyni, és a `verified-only` mellett elfogadni, hogy kimarad.

### profiles-js – nem frissíthető

- **Az ütközés:** a frissítés körkörös feltételt talál a `reverse` profilban. A mai generátor a `first(); middle(); last();` ismeretlen függvényhívásokat sorrendhez köti, a fordított profil pedig ennek ellentmond.
- **Miért nem menthető profillal:** a generált szabály lazítása az ADR-018 szerint `unverified` marad, a szerzői nyilatkozat nem bizonyíték.
- **Választható út:**
  - **(a)** a példa forrását olyan sorokra cserélni, amelyek sorrendje valóban szabad (például független `const` deklarációk). Ekkor a két profil szerzői szűkítés, `author-modified`.
  - **(b)** a példát `unverified`-ként meghagyni. `verified-only` mellett ekkor kimarad.

## Döntési pontok

1. **class-inventory-ts:** alkalmazva.
2. **class-accounts-ts és algo-bfs-js:** a frissítés a mai szabály szerint helyesebb, de sok korábban elfogadott tanulói választ utasítana el. Két út van:
   - most frissíteni;
   - a 4. fázis lazításait (szökésanalízis, ismert beépített metódusok) megvárni, és utána frissíteni.
3. **algo-sort-search-js és profiles-js:** a fenti (a) vagy (b) út.
4. **A `verified-only` alapértelmezés:** csak akkor kapcsolható be, ha a fenti döntések után legalább a kiszolgálni kívánt példák nem `unverified`-ek.
