# ADR-100 – Hat kezdő szintű igazolt példafeladat

Állapot: **elfogadva** (2026-11-05). A felhasználó kérése: kezdő szintű példák. Tartalmi döntés; a témákat a felhasználó felülírhatja. Az [ADR-098](098-three-new-verified-examples.md) mércéjét és az [ADR-099](099-valid-plain-operations.md) (v51) szabályait használja. Validátor, generátor és szabályverzió nem változik.

## Döntés

**Hat új példa,** mind `valid` bemeneti szerződéssel (ADR-050), revízió 1, `analysis-verified`. Mindegyik egy-egy kezdő alapfogalmat tanít:

| Példa | Nyelv | Fogalom | Szabad sorrend |
| --- | --- | --- | --- |
| `celsius-js` | JS | állandók és egy képlet | a két állandó felcserélhető |
| `rectangle-js` | JS | független számítások | a három számítás bármilyen sorrendben |
| `greeting-js` | JS | szövegösszefűzés, adatfüggőség | a teljes név és a monogram felcserélhető; a hossz a teljes név után |
| `even-odd-js` | JS | ciklus és elágazás | a két számláló felcserélhető |
| `vowels-js` | JS | ciklus szövegen, `includes` | a három előkészítő sor bármilyen sorrendben |
| `grade-ts` | TS | korai visszatérés, a feltételek sorrendje | egyetlen helyes sorrend (a határokat felülről kell vizsgálni) |

A leírások csak azt ígérik, amit a mérés igazol.

**A minőségi feltétel** ugyanaz, mint az ADR-098-ban. Minden egysoros áthelyezés két ítéletet kap: a validátor döntését és a független orákulumét. A példa csak akkor kerül be, ha a hibás elfogadás 0, és a rés is 0 (rés: elutasított, de futáskor azonos sorrend).

## Mérés

- **Jelöltmérés** (minden egysoros áthelyezés): mind a hat jelölt 0 hibás elfogadással és 0 réssel került be; egyiket sem kellett elvetni.
- **Korpusz** ([ordering-corpus.mjs](../../tests/fixtures/ordering-corpus.mjs)): a hat példa saját próbával, alap- és `valid` szerződéssel is, tehát 12 új fixture.
  - Mindegyikben 0 hibás elfogadás, 0 eldöntetlen eset.
  - A `valid` változatokban 0 rés.
  - Az alapszerződéssel a `rectangle-js` és a `greeting-js` rést mutat (3, illetve 1). Ez várt: ugyanaz a kód tetszőleges bemenetre szigorúbb, a példák `valid` szerződéssel jelennek meg.
  - Az alapvonal csak ezzel a 12 sorral bővült.
- **Katalógus:** alapbeállítással mind a 16 példa kiszolgálva, 0 kihagyva.

## Tervezési review (ADR-037)

Tartalmi változás, kódinterfész nem változott. **Nyitott kérdés, rögzítve:** 16 példánál a gyakorló feladatlista hosszú, és ma fájlnév szerint rendez. Egy szint szerinti csoportosítás (kezdő, közepes, haladó) a modellbe vagy a katalógusba új mezőt kérne, ezért külön döntés.
