# ADR-064 – Bizonyítottan véget érő `while` ciklus (v32)

Állapot: **elfogadva** (2026-11-03), szabályverzió `scoped-effect-analysis-v32`. A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 4. fázisának 4. tétele. Kiegészíti az [ADR-046](046-loops-over-own-objects.md) ciklusszabályát.

## Kontextus

Az ADR-046 óta a saját objektumokon dolgozó ciklus hatásnyomot kap. A véget érést viszont csak a literál korlátú számláló `for` ciklusra bizonyítottuk. Minden más ciklus „lefagyhat” (`mayHang`), ezért egy lehetséges kivétellel vagy egy külső hívással (nyomkövetés) sorrendhez kötött. A legjellemzőbb tanulói minta, a `while (a.count < 3) { a.bump(); }`, így minden ilyen sorral kötött maradt.

**Mérés a változás előtt** (12 mag, JS, nem dobó referencia): a `flow` fajta 141 réséből 46 `may-throw` okú volt.

## Döntés

1. **Bizonyítottan véget ér** a `while (x.f < K)` ciklus (`<=`, illetve a megfordított `K > x.f` és `K >= x.f`; `do…while` is), ha `x` saját objektum, `K` számliterál, és:
   - **az `f` mindig szám:** a fájlban minden írása számliterál, pozitív lépés (`.f = .f + c`, `.f += c`, `.f++`) vagy `+`-tól eltérő aritmetika (`-`, `*`, `/`, `%`, `**`, `--`, `-=` …). Minden deklarációja számliterál vagy kezdőérték nélküli. Nincs ilyen nevű getter, setter vagy paraméterproperty, és nincs számított kulcsú írás;
   - **a ciklusban csak nő:** a magban és minden metódusban, amelyet a mag tranzitívan név szerint hívhat, az `f` minden írása pozitív lépés;
   - **minden körben nő:** a mag a korai kilépést engedő első utasítás (`continue`, `break`, `return`, `throw`, összetett utasítás) előtt növeli az `x.f`-et. Ezt vagy közvetlenül teszi, vagy egy olyan metódushívással, amelynek elöl álló egyszerű utasításai növelik a `this.f`-et.

   **Miért elég ez:** ha az `f` nem definiált, a teszt azonnal hamis. A BigInt lépés kivételt dob, ami szintén véget vet a ciklusnak. Egy szám pozitív lépésekben véges sok kör után eléri a korlátot.
2. **A bizonyított ciklus nem `mayHang`.** Így felcserélhető egy külső hívással és egy lehetséges kivétellel, ha egyébként nem ütközik velük.
3. **Az orákulum P2-je is pontosabb:** a saját objektum mezőjének összetett értékadása (`+=`, `-=`, `*=`, `/=`, `%=`) és `++`/`--` művelete helyi objektumművelet, mint az `=`. A generátor eddig is így kezelte. A futásidejű eltérést a P3 veti össze.
4. **A paraméteres programok** „bármilyen bemenet” mellett egy kombinált ellenséges próbát is kapnak: rögzítő getterek, amelyek rögzítő `valueOf`/`toString` objektumot adnak. Így egy olvasás és egy implicit konverzió sorrendje egy futásban is látszik.

## Mérés

- **Kampány, 12 mag, JS (`flow`, nem dobó referencia):**
  - rés: 141 → 115;
  - ebből a `may-throw` okú: 46 → 2;
  - elfogadott sorrend: 1 801 → 1 827;
  - 0 hibás elfogadás.
- **Paraméteres programok, 12 mag, `any`:** a rés nyelvenként 19 → 12, 0 hibás elfogadás. Ez a pontosabb próbák érdeme, nem a generátoré.
- **Korpusz:** a rögzített számok változatlanok.
- **Generatív gyors alapérték:** a `flow typescript` csoport rése 6 → 5.

## A `flow` maradéka – mérés, nem generátorhiba

A megmaradt `flow`-rések nagy része olyan objektumolvasás, amelynek az eredménye mindkét sorrendben ugyanazt a döntést adja, például `if (c.tag === 't6')`, ha a `tag` értéke `''` vagy `'t3'`. Ezek az [ADR-043](043-dead-code-intent-policy.md) A-politikája alá esnek: a nem választott ág és a döntést nem változtató írás sorrendjét úgy ítéljük meg, mintha számítana. Ezért szándékhű elutasítások. A mérés azért számolja őket résnek, mert a megsértett szabály a lefutó elágazásfejet köti, nem a halott sort. A generátort itt nem lazítjuk, mert az ellentmondana a pedagógiai döntésnek. A mérés pontosítása (érték-perturbáció) az [ADR-067](067-value-perturbation-in-measurement.md)-ben kész.

**A 3. tétel (hatásösszegzés):** 12 magon a szkriptszintű `effectful-or-unknown-initializer` rés 5. Ehhez nem nyúltunk.

## Bizonyíték

- **[while-termination.test.mjs](../../tests/while-termination.test.mjs):**
  - **véget ér:** metódus, közvetlen `+=`, `++`, `do…while`, nem kapcsolódó írás a magban, nullázás a cikluson kívül;
  - **nem bizonyított:** nullázó metódus a ciklusban, ismeretlen lépés, feltételes növelés, csökkentő írás, szöveges mezőérték, számított kulcsú írás;
  - mindegyiknél 0 hibás elfogadás.
- **[loop-footprints.test.mjs](../../tests/loop-footprints.test.mjs):** az ADR-046 eddig résként rögzített `while` esete most szabad.

## Tervezési review (ADR-037)

- **Tulajdonos:** az objektumhatás-elemző (`monotone` a `counted` mellett); az interfész nem változott.
- **Rögzített megállapítás:** az `object-footprints.ts` tovább nőtt, és a modul egyetlen nagy closure. A véget érés érvei saját modulba kerültek ([ADR-065](065-design-debt-removal-and-module-split.md)); a heap és az értelmező felbontása nyitott.
