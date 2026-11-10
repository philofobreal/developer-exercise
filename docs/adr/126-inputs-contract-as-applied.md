# ADR-126 – A bemeneti szerződés: kérve és hatályosan (NY-29)

Állapot: **elfogadva** (2026-11-10). Kockázati osztály: szerzői elemzés (csak magyarázó adat, szabályváltozás nélkül), megjelenítés, és a modell sémája.

## Kontextus

- **Hogyan dönt ma az elemzés:**
  - az új feladat „érvényes egyszerű adat” bemenettel indul (ADR-106);
  - ha a program maga megváltoztathatja, mit csinál egy tulajdonság olvasása (Proxy, prototípus, `eval`, számított nevű accessor, nem kiírt néven elért horog), az elemzés szigorú marad (ADR-050).
- **Mit látott ebből a tanár:**
  - egy hosszú, általános bekezdést a szabályok fölött („…a program módosíthatja az olvasást (Proxy, prototípus, eval, képzett név), ezért szigorú”);
  - a beállítássávban viszont azt, hogy „érvényes egyszerű adat”, mert a modell a *kért* értéket rögzítette.
  
  Azt nem tudhatta meg, melyik sora miatt.
- **Mért eset:** a 436 soros TypeScript-mintánál a 190. sor `func: Function` típusneve viszi vissza a szerződést (lásd lent, NY-34).

## Döntés

- **A szerzői elemzés megnevezi az okot** (`input-contract.ts`, `InputBlocker`). Az első talált ok:
  1. horog a szövegben, a sorával és a szöveggel;
  2. különben számított nevű accessor, a sorával;
  3. különben nem kiírt néven elért név (`globalThis['Pro' + 'xy']`), sor nélkül, mert nincs egyetlen hely.
- **A modell bizonyítéka rögzíti:** `authoring.evidence.environment.inputsOverride = {effective: 'any', reason, line?, text?}`.
  - A séma bővült; a mező zárt, más kulcs nem fér bele.
  - A `inputs` továbbra is a kért értéket őrzi (a munkamenet és a JSON-import ebből állítja vissza a kérést, `recordedContract`).
- **A megjelenítés:** az Elemzés és szabályok lépés beállítássora (`renderInputsContract`) így szól: „Bemenetek: **érvényes egyszerű adat → szigorú lett**, mert a [7. sor] „Proxy”: ezzel a program megváltoztathatja, mit csinál egy tulajdonság olvasása.”
  - A sorszám gomb; a Kód lépés a sornál nyílik meg (ADR-122).
  - Mellette ⓘ, a súgó Bemenetek témájával.
- **Nincs szabályverzió-váltás:**
  - a szabályok nem változtak; a teszt bizonyítja, hogy a függőségek azonosak a szigorú elemzésével;
  - a mező magyarázat, értékelés nem olvassa;
  - verzióváltás minden meglévő modellt „régebbi szabályverzió”-nak minősítene ok nélkül;
  - a régi modelleknél a mező hiányzik, és a felület annyit mutat, mint eddig.

## Két terv („design it twice”)

1. **Az ok a modell bizonyítékában (választott).** A munkamenettel és a JSON-nal együtt utazik, és ugyanaz marad, amíg a modell.
2. **Az ok csak a modellkészítés válaszában (elvetve).** Munkamenet- vagy JSON-betöltés után elveszne, és újra kellene elemezni.

## Tervezési review (docs/design-review.md)

- **input-contract.ts:**
  - továbbra is egyedül dönti el, alkalmazható-e a szerződés;
  - mostantól azt is megmondja, mi miatt nem (`blockerOf`);
  - a hívó nem ismétli a vizsgálatot.
- **ordering-relations.ts:**
  - az elemzés a saját környezetéről talált tényt (`environment`) a szabályokkal együtt adja tovább;
  - a generátor egy helyen fűzi a bizonyítékhoz.
- **preflight-settings.ts:** a beállítás nevei és a magyarázata egy helyen; a nézet csak kéri.

## Ami kiderült: NY-34

A TypeScript-minta szerződését a `func: Function` *típusnév* viszi vissza. A horogvizsgálat a szöveget nézi, és a típushelyzetet nem különíti el; a TypeScript típusa pedig nem fut. A javítás elemzésváltozás (szabályverzió, mérés), ezért külön tétel lett a jegyzékben.

## Bizonyíték

- **Egységteszt:** [inputs-override.test.mjs](../../tests/inputs-override.test.mjs):
  - a három ok sorral és szöveggel;
  - nem kért és alkalmazható szerződésnél nincs mező;
  - a szabályok azonosak;
  - a séma befogadja a mezőt, idegen kulcsot nem;
  - a TS mintán a `Function`;
  - a megjelenítés escape-eléssel és ⓘ-vel.
- **Böngészős teszt:** [browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py) `inputs_override`: a sor kiírja az okot, a sorra kattintva a Kód lépés kijelöli; tiszta kódnál csak az érték áll.
