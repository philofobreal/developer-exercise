# ADR-043 – A le nem futó kód sorrendje a szándékot követi (A-politika)

Állapot: **elfogadva** (2026-10-30), felhasználói döntés alapján. A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 4. fázisának 5. tétele. A generátor és a szabályverzió nem változik; a pedagógiai politika (`E_pol`) és a mérés pontosodik.

## Kontextus

Két sorrend lehet futásidőben azonos úgy, hogy a különbség csak hatástalan kódban van:

- **Le nem futó kód:** egy biztos kivétel utáni sorok, egy nem választott ág vagy egy soha meg nem hívott metódus törzse.
- **Semmit nem változtató írás:** azonos érték újraírása, vagy olyan érték, amelyet senki nem olvas ki.

```js
a.rename('');      // mindig kivételt dob
b.add(3);          // soha nem fut le
b.flush();         // soha nem fut le; kiolvasná, amit b.add(3) ír
```

**A dilemma:** a `b.flush()` és a `b.add(3)` felcserélése futásidőben nem látszik. A tanuló sorrendje mégis más adatfüggést fejez ki. A generátor ma is elutasítja, mert úgy elemez, mintha a kód lefutna. Az orákulum viszont egyenértékűnek látja, ezért a mérés résnek számolta.

**A döntés gazdája:** pedagógiai kérdés, a felhasználó döntötte el (A változat).

## Döntés

1. **Politika (`E_pol`):** a referencia futásában le nem futó kód és a semmit nem változtató írás sorrendjét úgy ítéljük meg, mintha lefutna, illetve mintha más értéket írna. A sorrend a program adatfüggéseit tanítja, nem egyetlen futás eredményét.
2. **A tanulónak nincs változás:** a generátor eddig is így elemzett.
3. **Mérés:**
   - Az orákulum megmondja, mely sorokat futtatja a rögzített referencia (`judge.executedRows()`). A lista minden utasítását egy `__hit(sor)` hívással jelöli meg (a direktívák és a TS-ben törlődő deklarációk kivételével), és a referenciát egyszer lefuttatja.
   - Egy sor akkor futott le, ha a legbelső, őt lefedő listautasítás lefutott.
   - Az osztályozó új fajtája, az `intent`: elutasított, futásidőben egyenértékű sorrend, amelynek minden megsértett kényszere legalább egy le nem futó sort érint. Ez szándékhű elutasítás, nem completeness-rés, és nem számít bele a résarányba.

## Határok, őszintén

- **A le nem futó kódban az orákulum nem ad futásidejű bizonyítékot.** Az ottani döntést (elfogad vagy elutasít) a statikus elemzés hozza. Ha a generátor ott pontatlan (például a konstruktorban létrehozott mezők miatt egész objektum írását látja), a mérés ezt nem résként, hanem `intent`-ként mutatja.
- **A semmit nem változtató írást a mérés nem választja külön.** A politika rájuk is érvényes, de a lefedettség nem ismeri fel őket, ezért résként maradnak a mérésben.
- **A lefedettség egy futásra szól:** egy másik bemenettel futó ág itt halottnak látszik. A rögzített, bemenet nélküli fixture-öknél ez a teljes viselkedés.

## Bizonyítékok

- **Tesztek:** [dead-code-intent.test.mjs](../../tests/dead-code-intent.test.mjs):
  - lefedettség kivétel után, nem választott ágban és `case`-ben, soha nem futó törzsben, TypeScriptben;
  - a direktíva nincs megjelölve;
  - `intent` a halott kód cseréjére;
  - élő kódban az elfogadás és a rés változatlan.
- **Gyors generatív baseline:**
  - dobó JS-objektumprogramok: 12 → 6 rés (32,4% → 19,4%);
  - `function` csoport: 13 → 12 rés (26,5% → 25%);
  - a többi csoport változatlan.
- **Korpusz:** a rögzített értékek nem változtak.
