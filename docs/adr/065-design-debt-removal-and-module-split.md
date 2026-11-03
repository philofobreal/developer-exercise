# ADR-065 – Tervezési adósság: a megerősítési szint a magból, modulbontások

Állapot: **elfogadva** (2026-11-03). Viselkedésváltozás nélküli tervezési javítás (ADR-037). Lezárja az [ADR-052](052-unspelled-property-names.md), [ADR-053](053-folded-names-and-returns.md), [ADR-054](054-rule-cause-in-author-preview.md), [ADR-056](056-rule-kinds-batch-lifting.md), [ADR-059](059-read-only-builtins.md) és [ADR-064](064-monotone-while-loops.md) rögzített tervezési megállapításait. Szabályverzió nem változik.

## 1. A megerősítési szint a magból

**Kontextus.** A felület (`rule-panel.ts`) egy saját táblázatban ismételte meg, hogy melyik szabályosztály eltávolítása milyen megerősítést kér. Ugyanezt a mag (`applyRuleEdits`) ellenőrzi. Ugyanannak a döntésnek két leírása volt. Ezen kívül négy helyen az `editability === 'hard'` vizsgálat felelt arra a kérdésre, hogy eltávolítható-e a szabály.

**Döntés.**
- A `DirectConstraint` új mezőt kap: `removal: 'impossible' | 'none' | 'unproven-relaxation' | 'policy-override'` (additív interfészbővítés).
- **Egyetlen leképezés:** a `removalRequirement` a `constraint-explanation` modulban van, amely a szabályosztályt is megállapítja. A szabályszerkesztés ezt kényszeríti ki. Az `Acknowledgement` típus ebből vezetődik le.
- **Elrejtve:** az osztály és a megerősítés kapcsolata.
- **Változó hívók:**
  - a szabálypanel: a feloldás szövege, a kötegelt feloldás megerősítése, a lakat jelzés;
  - a kapcsolattábla;
  - a régi vezérlő egy sora.

  Egyik sem tart saját táblázatot.
- **Miért kell:** a felület nem kérdezheti meg a mag belső modulját (architektúrakapu). A válasz ezért adatként, a szabálylappal érkezik.

**Bizonyíték.** Új teszt ([rule-editing.test.mjs](../../tests/rule-editing.test.mjs)): két példamodell minden közvetlen szabályára ellenőrzi, hogy a kiírt `removal` pontosan az, amit a szerkesztés megkövetel.
- Ha a szabály `impossible`: a szerkesztés `hard-constraint` hibát ad.
- Ha nem eltávolítható megerősítés nélkül: `needs-acknowledgement` hibát ad, ugyanazzal a szinttel, és ezzel a szinttel elfogadja.

## 2. A `property-names` modul felbontása

**Kontextus.** A modul egyetlen, kb. 250 soros függvény volt belső closure-ökkel.

**Döntés.** Ugyanabban a fájlban három fázis, a nyilvános interfész (`unspelledNames`, `namesMatch`) változatlan:
1. **`surveyNames`:** ki milyen értéket kap, hol olvassák, és mi a ki nem írt nevű olvasás;
2. **`foldKeys`:** konstansösszevonás, a kulcs által választható nevek;
3. **`followEscapes`:** szivárgáskövetés.

A közös szintaktikai segédeket a `syntaxOf` adja, a fázisok egy `Survey` értéken keresztül kapcsolódnak. A fájl maradt egyetlen modul, mert egyetlen döntést rejt el; csak a belső felépítése lett követhető.

## 3. A ciklusok véget érése saját modulban

**Kontextus.** Az `object-footprints.ts` az ADR-064-gyel tovább nőtt. A véget érés két érve (a számláló `for` és a monoton `while`) nagyrészt szintaktikus, és független az absztrakt heap állapotától.

**Döntés.** Új modul: `loop-termination.ts`, egyetlen kérdéssel (`loopEnds`).
- A hatáselemzés egy `LoopObjects` értéket ad át: az elemezhető osztályok metódusai név szerint, és hogy egy azonosító pontosan melyik saját objektum.
- Az `assignedNames` is ide került, mert a ciklusérv és a hatáselemzés is használja.

## 4. Az ADR-048 primitívlokális-elemzés és a névösszevonás: nem vonjuk össze

**Megvizsgálva:** mindkét elemzés azt követi, milyen értéket kaphat egy lokális. Mégis más kérdésre felelnek:
- **ADR-048** (`statement-ordering`): hatókörrel feloldva, a TypeScript szimbólumain keresztül kérdezi, hogy egy függvénylokális *mindig primitív-e*. Pontossága azon múlik, hogy két azonos nevű változót nem kever össze.
- **Névösszevonás** (`property-names`): hatókör nélkül, név szerint kérdezi, hogy egy kulcs *milyen szövegeket* vehet fel, legfeljebb 64 értékig. A helyességi érve (ADR-053) épp az, hogy a név szerinti gyűjtés csak bővíti a halmazt.

**Döntés:** nem vonjuk össze őket. Egy közös modul két üzemmódot kapna (hatókörös és név szerinti), két különböző érvvel. Ez sekély, csatolt interfész lenne, és bármelyik oldal változása a másik helyességi érvét érintené.

## Bizonyíték (egész ADR)

- **Különbségvizsgálat:**
  - 598 katalógusprogram × 2 bemeneti × 2 kulcssorrend-beállítás = **2392 generált modell függőségei** bitre azonosak a refaktor előtt és után;
  - a `unspelledNames` 838 programon azonos.
- **Mérés:** a korpusz és a generatív alapértékek változatlanok. `check:all` és `test:browser:all` zöld.

## Nyitott

Az `object-footprints.ts` többi része (absztrakt heap, értelmező) továbbra is egy closure. Ezek közös, változó állapoton dolgoznak (mezők, elemek, objektumfajták, fixpont-jelző). A szétbontásukhoz egy állapotobjektumot kellene minden függvényen átvinni, ami ma nem csökkentené a hívók által látott összetettséget. Rögzített, nem sürgős megállapítás.
