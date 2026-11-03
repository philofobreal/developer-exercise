# ADR-054 – A megsértett szabály oka és feloldása a szerzői előnézetben

Állapot: **elfogadva** (2026-11-02). Megjelenítés és szerzői elemzés. Szabályverzió nem változik, a validátor és a tanulói nézet változatlan. Kiegészíti az [ADR-021](021-author-rule-panel.md) szabálypanelét és az [ADR-026](026-learner-feedback-and-row-marks.md) visszajelzését.

## Kontextus

A Pages-en a szerző egy kulcsokat listázó programban (`Object['ke' + 'ys']`) felcserélte a konstruktor két kulcslétrehozó sorát, és ezt kapta: „Hibás · A(z) 4. sor a(z) 3. sor előtt kell állnia.” Az ítélet helyes, mert a program kimenete `["a","b"]`-ről `["b","a"]`-ra változik. A felület viszont:

- **nem mondta meg az okot:** a részletes magyarázat csak a kategóriát adta („ugyanazt az adatot olvassa vagy írja”), a szabálypanel a nyers kódot (`object-write-after-write`);
- **nem mutatta a szerző útját:** a feloldás (eltávolítás policy-felülírással, ADR-018) létezett, de csak az tudhatott róla, aki ismeri a panelt;
- **pontatlan okot írt:** az `object-write-after-write` jelentése „két írás ugyanarra a saját objektummezőre” volt, holott itt két *különböző* mező új kulcsot hoz létre.

## Döntés

1. **Okjelentések a szabálylappal** (`AuthorRuleSheet.meanings`, interfész-szélesítés): a szerzői motor a lap minden okkódjához hozzáteszi a jelentését az okkódjegyzékből (ADR-038).
   - **Elrejtve marad:** a jegyzék és a kódok kategóriája; a megjelenítés csak a kapott szöveget mutatja, és az ok-kód párosítást nem ismeri.
   - **Változó hívók:** a szerver és a Pages API változatlanul az `authorRuleSheet`-et adja tovább. A korábban mentett, jelentés nélküli lapnál a felület a kódot mutatja.
   - **Miért kell:** a jelentés az elemzés tudása, a felület nem kérdezheti meg az elemző modulokat (architektúrakapu).
2. **Pontosabb jelentés:** `object-write-after-write` = „két írás ugyanarra a saját objektumra: ugyanarra a mezőre, vagy új kulcsot hoz létre, miközben a program felsorolja a kulcsokat, így a létrehozás sorrendje látszik”. A kód és a kategória nem változik, ezért a modellek és a minősítés sem.
3. **„Miért?” blokk a kiértékelő sávban** (`renderRuleCause`, a szabálypanel modulja). Csak a szerző saját előnézetében, elutasított ítéletnél jelenik meg, és a legelső bizonyított diagnózis szabályláncának első közvetlen szabályát mutatja. Tartalma:
   - a két kódsor a referencia-azonosítójával;
   - a szabály osztálya és oka;
   - a feloldás lépése osztályonként, az ADR-018 megerősítési szintjei szerint (szerkezeti: nem oldható fel; bizonyított és ismeretlen eredetű: policy-felülírás; konzervatív: nem bizonyított lazítás; szerzői: megerősítés nélkül);
   - egy gomb, amely megnyitja a sor szabályait a Próba lépés paneljén. A gomb a meglévő `data-rule-line` vezérlőutat használja.
4. **A szabálypanel** az okkód mellett a jelentést is mutatja.

## Biztonság és felfedés

- **A tanuló semmit nem lát belőle:** a blokk a szabálypanel kontextusától függ, és az a tanulói nézetben, illetve idegen feladatnál üres (ADR-026, F2).
- **Minden szöveg escape-elve kerül a HTML-be.**
- **Az ítélet és a diagnózis nem változik.**

## Bizonyíték

- **Egységtesztek** ([author-rule-panel.test.mjs](../../tests/author-rule-panel.test.mjs)):
  - a lap minden jegyzékbeli kódjához pontosan a jegyzék jelentése tartozik;
  - a blokk osztályonként a helyes feloldási lépést adja;
  - láncnál az első közvetlen szabályt mutatja;
  - nem létező szabályra, tanulói nézetben, előnézet nélkül és szabálylap nélkül üres;
  - a panel mutatja a jelentést.
- **Böngésző** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py), Node és Pages módban). Az előző helyzet végigjátszva:
  - érvényes bemeneti szerződés, megjegyzés nélkül;
  - a csere elutasítva, a blokkban az ok és a lépés;
  - tanulói nézetben nincs blokk;
  - a gomb megnyitja a #4 panelt, ahol a jelentés is látszik;
  - eltávolítás policy-felülírással, indoklással, utána „Elfogadva”.
- `check:all` 1003/1003; `test:browser:all` mind a 8 csomag zöld.

## Tervezési review (ADR-037)

- **Tulajdonosok:**
  - az okjelentés a szerzői elemzésé (jegyzék);
  - a szabály megjelenítése és a feloldás szövege a szabálypanel modulé;
  - a kiértékelő sáv csak meghívja a blokkot, ezért nem keletkezett új modul vagy továbbító réteg.
- **Rögzített megállapítás:** a `liftStep` szövege tükrözi, hogy a mag (`applyRuleEdits`) melyik szabályosztályhoz milyen megerősítést kér. Ez ugyanannak a döntésnek két leírása. A tényleges eltávolításkor a mag dönt, és a panel a mag saját üzenetét mutatja, így eltérés esetén a szerző a helyes kérést látja. A blokk szövegét az egységteszt köti a bizonyított esethez. Pontosabb megoldás, ha a mag az osztályhoz tartozó megerősítési szintet maga adja ki (például a `DirectConstraint` mezőjeként). Ez magszintű interfészváltozás, külön döntés. **Lezárva:** [ADR-065](065-design-debt-removal-and-module-split.md), a `DirectConstraint.removal` mezővel.
