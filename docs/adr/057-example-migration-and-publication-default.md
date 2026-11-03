# ADR-057 – A régi példák migrációja és a publikálási alapértelmezés

Állapot: **elfogadva** (2026-11-03). Pedagógiai és publikálási döntés, a felhasználó jóváhagyásával („az ajánlásaid mentén csináld meg”). Lezárja a [migrációs eltéréslista](../peldak-migracioja.md) döntési pontjait. Szabályverzió nem változik (`scoped-effect-analysis-v29`).

## Kontextus

Öt példafeladatból négy régi, kézzel írt modell volt, proveniencia nélkül, ezért „Nem igazolt” minősítéssel futott. Minden példánál ugyanaz a kérdés: a régi tanári megoldókulcs érvényes maradjon, vagy a bizonyítható szabály? A bizonyítható szabály korábban elfogadott tanulói válaszokat utasíthat el. Egy már felvett feladat függőségeinek átírása az AGENTS.md szerint jóváhagyáshoz kötött.

## Döntés

1. **`algo-bfs-js`: frissítve, „érvényes egyszerű adat” bemeneti szerződéssel** ([ADR-050](050-input-contract.md)).
   - A régi modell rögzített két sora megmarad, ezért a minősítés „Szerzői döntéssel módosított” (`author-modified`), nem „Nem igazolt”.
   - **Egy tanári pár elveszik:** a `visited.add(key)` / `queue.push(…)` csere elutasított lesz. Futásidőben azonos, de a `Set` nincs modellezve, és az orákulum hatásrend-ellenőrzése is eltérőnek minősíti. Nem tartottuk meg szerzői lazításként, mert a lazítás a modellt „Nem igazolt” minősítésre vinné vissza (ADR-044).
   - **A revízió 1-ről 2-re nő,** mert a szabályok változtak. A régi revízióra mentett tanulói elrendezést a felület nem tölti vissza, így semmi nem fut le csendben más szabállyal.
   - **A leírás javítva:** már nem ígéri a cserét.
2. **`class-accounts-ts`: változatlan, „Nem igazolt”.** A frissítés két, a tanuló által joggal azonosnak tartott cserét utasítana el (`this.balance += …` / `this.history.push(…)`). A 4. fázis tételeinek kell előbb ezt a rést szűkíteniük: az objektum ismert beépített hívásba kerülése (2d) és az öröklő osztály mezői.
3. **`algo-sort-search-js` és `profiles-js`: változatlan, „Nem igazolt”.** Az átírás mindkettőnél új tananyag lenne:
   - az egyik új blokkszerkezetet kap, ezért új azonosítóval kellene felvenni, és a mentett elrendezések elvesznének;
   - a másiknak a forrását kellene cserélni.
4. **A publikálási alapértelmezés marad `publishable`.**
   - A `verified-only` (`CODELINE_PUBLICATION`) választható, de nem alapértelmezett.
   - Ma három példa kiesne vele a katalógusból. A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 1. fázisának 4. lépése ezért nyitva marad, és az utolsó „Nem igazolt” példa megoldásakor tér vissza.

**Kiegészítés (2026-11-03):** a 2d (ADR-059) után a `class-accounts-ts` újramérve. A frissítés a tanár 480 megengedett sorrendjéből továbbra is 360-at utasítana el, mert az öröklő osztályt az elemzés nem modellezi. A 2. pont döntése ezért marad; a részletek az [eltéréslistában](../peldak-migracioja.md) vannak.

## Mérés (v29, a frissítés előtt)

Vizsgált sorrendek:
- minden egysoros áthelyezés és páros csere, összesen 950;
- a tanár által megengedett mind a 123 sorrend: az öt deklaráció 120 permutációja és három csere.

Eredmény:
- **Új elfogadás:** 0. **Elvesztett elfogadás:** 1, a fenti csere.
- **A tanári sorrendek közül** csak ez az egy elutasított. A deklarációk 120 permutációja, a `nextRow`/`nextCol` és a `key`/`inside` csere elfogadott marad.
- **A modell teljes lineáris kiterjesztései:** 960 helyett 480; a különbség pontosan ez a csere.
- **Ellenőrzés:**
  - a frissített modell újraszármaztatása egyezik (`rederivation: match`), és egy újabb frissítés semmit nem változtat;
  - a független futásidejű orákulum minden kiterjesztést ekvivalensnek talál.

A v26-os mérés ugyanezt az egy kötött tanári párt mutatta; a v27–v29 szabályváltozásai ezen nem rontottak.

## Következmény

- **Katalógus alapértelmezéssel:** mind az öt példa kiszolgálva; minősítésük 1 `analysis-verified`, 1 `author-modified`, 3 `unverified`.
- **`verified-only` mellett:** két példa marad (`class-inventory-ts`, `algo-bfs-js`). A fail-closed teszt a megmaradt három régi modellel fut.
- **Tesztek:**
  - [complex-scope-ordering](../../tests/complex-scope-ordering.test.mjs): 480 kiterjesztés, a csere `rejected`, de `equivalent` (dokumentált konzervatív elutasítás);
  - [catalog-publication](../../tests/catalog-publication.test.mjs): a két frissített példa és minősítésük;
  - [publication-gate](../../tests/publication-gate.test.mjs): régi modellként a `profiles-js`.
