# ADR-098 – Három új igazolt példafeladat; a jelölt példák résmérése

Állapot: **elfogadva** (2026-11-04). A felhasználó kérése: „több igazolt példafeladat”. Tartalmi döntés; a felhasználó a témákat felülírhatja. Validátor, generátor és szabályverzió nem változik.

## Kontextus

Öt példa volt: két nehéz algoritmus (BFS, rendezés és keresés), két osztálypélda (TypeScript) és egy profildemó. Kezdő és közepes szintű, rövid feladat nem volt.

**A minőség mércéje:** egy példa nemcsak akkor jó, ha igazolt (nem fogad el hibás sorrendet), hanem akkor is, ha nem utasít el olyan sorrendet, amelyet a tanuló joggal tart helyesnek. Ezért minden jelöltet így mértünk:
- **Minden egysoros áthelyezés:** a validátor döntése és a független orákulum ítélete.
- **Rés:** elutasított sorrend, amelyet az orákulum futáskor azonosnak talál. Egy példában ez egy helyes tanulói válasz elutasítása.
- **Blokkáthelyezések:** ahol a leírás ígéri őket.

## Döntés

**Felvett példák** (`valid` bemeneti szerződéssel, ADR-050; revízió 1):

| Példa | Nyelv | Tartalom | Elfogadott sorrend | Rés |
| --- | --- | --- | --- | --- |
| `word-count-js` | JS | szógyakoriság `Map`-pel, `for…of`, rendezés | egyértelmű sorrend | 0 |
| `stack-ts` | TS | generikus verem interface-szel, getterrel, öt taggal | 7 egysoros; az interface az osztály után, a tagok bármilyen sorrendben | 0 |
| `fib-memo-js` | JS | rekurzió, két korai kilépés, memoizálás | egyértelmű sorrend | 0 |

- **A leírások** csak azt ígérik, amit a mérés igazol.
- **A `stack-ts` blokkáthelyezései** (az interface az osztály után; a `push`, a `peek`, a `pop` és az `isEmpty` máshová téve) elfogadottak, és futáskor azonosak.

**Nem vett fel példa: `stats-js`** (átlag, minimum és maximum egy számtömbből). 2 elfogadott sorrend mellett 6 rése volt:
- a gyűjtőváltozók (`let smallest = Infinity`, `let largest = -Infinity`) cseréje;
- a ciklusmag három független gyűjtősorának cseréje.

Az első változat (`reduce`, `Math.min(...values)`, `Math.max(...values)`) egyetlen cserét sem engedett.

**Az ok a generátorban van:** a `valid` szerződés mellett is kódot futtatónak veszi a paraméterből származó értékeken végzett műveleteket és a tiszta beépített hívásokat. Ez a [jegyzék](../nyitott-tetelek.md) NY-06 tételének első tanúja; a tétel ezzel újranyílt.

## Bizonyíték

- **Korpusz** ([ordering-corpus.mjs](../../tests/fixtures/ordering-corpus.mjs)): a három példa saját próbával, alap- és `valid` szerződéssel is, tehát 6 új korpuszfixture. Mindegyikben 0 hibás elfogadás, 0 rés, 0 eldöntetlen eset; az alapvonal csak ezzel a 6 új sorral bővült.
- **Katalógus** ([catalog-publication.test.mjs](../../tests/catalog-publication.test.mjs)): alapbeállítással mind a nyolc példa kiszolgálva, a várt minősítéssel; egy újabb frissítés egyiken sem változtat.
- **Böngészőtesztek:** a húzási készlet minden kiszolgált példán fut, és az akadálymentességi átvizsgálás is.

## Tervezési review (ADR-037)

Tartalmi változás, kódinterfész nem változott. *Design twice:* *a `stats-js` felvétele a mostani szabályokkal:* elvetve, mert hat helyes tanulói átrendezést utasítana el. Az elemzés javítása után térhet vissza.
