# ADR-095 – Koppintásos áthelyezés, a beszúrási adapter TypeScriptre migrálva

Állapot: **elfogadva** (2026-11-04). A felhasználó jóváhagyta a koppintásos áthelyezést, és kérte, hogy a mobilon túl rövid kódsorokra kevés ráfordítással legyen megoldás. Megjelenítési és interakciós változás; validátor, generátor, modell és API nem változik.

## Kontextus

- **Mobilon** a rendezés eddig húzással, illetve a `+`, a fel, a le és a vissza gombokkal ment. Egy 25 soros feladatnál ez sok koppintás, és a húzás két egymásba ágyazott görgetési terület között nehézkes.
- **390 képpont szélesen** egy megoldássorból a fogantyú (44 képpont, érintési célméret), a sorszám és a három sorvégi gomb után 177 képpont maradt a kódnak.
- **A beszúrási adapter** (`public/app/drag-insert.js`) kézzel írt, régi JavaScript volt, TypeScript-forrás nélkül. Az AGENTS.md szerint régi JS-t csak rögzített migrációval szabad bővíteni.

## Döntés

1. **Migráció:** a modul szigorú TypeScriptre került ([drag-insert.ts](../../src/workbench/drag-insert.ts)), és a `public/app/drag-insert.js` mostantól fordítói kimenet. A meglévő három bemeneti út (natív húzás, saját mutatós húzás, billentyűzet) viselkedése változatlan; ezt a meglévő böngészőtesztek mutatják. A régi, TypeScript-forrás nélküli modulok száma 7 → 6.
2. **Koppintásos áthelyezés** érintéssel és tollal (`pointerType` `touch` vagy `pen`):
   - **Kijelölés:** koppintás egy sor fogantyújára. A sor körvonalat kap, a listák jelzik, hogy koppintást várnak, és egy élő régió felolvassa a teendőt.
   - **Lerakás:** koppintás egy üres helyre kitölti azt. Koppintás egy foglalt sorra a felezőszabály szerint elé vagy mögé teszi a kijelölt sort, ugyanúgy, mint a húzás. Megoldásbeli sor esetén a forráslistára koppintva visszakerül.
   - **Megszakítás:** koppintás ugyanarra a fogantyúra, az Escape, vagy egy listán kívüli koppintás. Egy gomb megnyomása a saját műveletét végzi, és megszünteti a kijelölést.
   - **Váltás:** egy kijelölt forrássor után egy másik forrássor fogantyúja arra a sorra vált át.

   A beszúrás ugyanazt a tartományfüggvényt (`insertBetweenSlots`) használja, mint a többi út. A beszúrás tehát nem csere, és a rögzített helyek érintetlenek maradnak.
3. **Kevesebb gomb kis érintőképernyőn** (`pointer: coarse` és legfeljebb 650 képpont): a fel és le gombok elrejtve, mert a koppintásos áthelyezés kiváltja őket. A `+` és a vissza gomb marad.

**Ami tudatosan nem került bele:** sortördelés mobilon. A húzás geometriája a fix sormagasságra épül; a hosszabb sorokat a lista vízszintes görgetése mutatja meg.

## Mérés

- **A látható kód szélessége** egy megoldássorban, 390 × 844 képpont, érintéssel: 177 → 245 képpont (+38%).

## Bizonyíték

- **[browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py), „tap to pick, tap to place”**, valódi érintéssel (`tap`), 390 képpont szélesen:
  - kijelölés és bejelentés;
  - megszakítás ugyanazzal a fogantyúval;
  - lerakás egy üres helyre, a pozíció bejelentésével;
  - visszahelyezés a forráslistára;
  - a fel gomb nem látható;
  - nincs vízszintes kilógás.
- **A teljes böngészőkészlet** a migrált modullal: natív húzás, egeres húzás felső és alsó felezéssel, érintéses húzás, billentyűzet és a 44 húzási eset.

## Tervezési review (ADR-037)

- **Tulajdonos:** a bemeneti utak egyetlen adapterben élnek, közös `finish` és `position` függvénnyel; a koppintás nem tart párhuzamos beszúrási logikát. A modell változása továbbra is csak lerakáskor történik.
- **Interfész:** változatlan (`createInsertionDrag({root, onInsert, onReturn})`, `{clear}`); a hívó (`ui.js`) nem változott.
- **Design twice:**
  - *A koppintás egérre is:* elvetve. Egy fogantyúra kattintás asztali nézetben váratlanul kijelölési módba vinne.
  - *A koppintás a sor teljes területére a fogantyú helyett:* elvetve. A sor a vízszintes görgetés felülete, a koppintás így ütközne a görgetéssel.
