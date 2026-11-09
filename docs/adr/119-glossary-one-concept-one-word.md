# ADR-119 – Egy fogalom, egy szó: szótár és íráskönyv

Állapot: **elfogadva** (2026-11-09; a felhasználó a szótárt jóváhagyta). Kockázati osztály: megjelenítés. A felület-audit U2 pontja.

## Kontextus

A felület-audit (2026-11-09) mért feliratai alapján:
- **Az „Ellenőrzés” három műveletet jelölt:** a tanulói megoldás értékelését, a forrás nyelvi vizsgálatát („Forrás ellenőrzése”) és a modell minősítését („Minősítés és ellenőrzések”).
- **A „betöltés” háromfélét:**
  - fájlt nyitott meg („JSON betöltése”);
  - a piszkozatot élesítette („Modell betöltése → Szabályok”);
  - mentett munkát hozott vissza („Visszatöltés”).
- **A „Visszaállítás” nem állított vissza semmit:** kiürítette a megoldást.
- **A Próba „Szabályok” gombja** a kijelölt sor szabálypanelét nyitotta, nem a Szabályok lépést.
- **Két név ugyanarra:** „Forrásváltozás elvetése” és „Változások elvetése”.
- **Angol–magyar keverék:** „Fájl export”.

## Döntés

- **A szótár a [docs/szotar.md](../szotar.md):** fogalom, jelentés, hely, és a kivont régi szó. Az íráskönyv szabályai:
  - főnévi akcióalak;
  - „…” fájlválasztó vagy párbeszéd előtt;
  - mondatkezdő nagybetű;
  - a továbblépést ikon jelzi, nem nyíl a feliratban.
- **A felület feliratai a szótár szerint változtak**, a súgó- és hibaszövegekkel együtt (`view.ts`, `preflight-settings.ts`, `ui.js`, `rules-gate.ts`), valamint a README, a munkafolyamat-leírás és a TypeScript-példatár oldala.
- **A „JSON megnyitása” a fájlé (JSON megnyitása…).** A Szabályok elavultsági sávjának JSON-fülre vivő gombja „JSON szerkesztése” lett.
- **Nem változik:** a *Local Demo*, a *Preview Validation* és a *Trusted Server Validation* (AGENTS.md szerződés), valamint az *Ellenőrzés* a tanulói gombon.

## Két terv („design it twice”)

1. **Forrásszintű tiltás a régi szavakra (választott).** Egy egységteszt a felület forrásaiban keresi a kivont szavakat, és a fájlműveletek „…” végződését is ellenőrzi.
   - Olcsó, és minden `check:all` futáskor él.
   - A kivont szó a teszt hibaüzenetében az új szót is megnevezi.
2. **Böngészős tiltás a kirajzolt feliratokra (elvetve).**
   - Csak a meglátogatott nézeteket látná, és lassú.
   - A forrásszintű ellenőrzés mindent lefed, ami szövegként a felületre kerülhet.

## Bizonyíték

[glossary.test.mjs](../../tests/glossary.test.mjs):
- nincs kivont szó a felület forrásaiban;
- a sorpanel gombja „Sor szabályai”, nem „Szabályok”;
- minden import és export felirata „…”-ra végződik.

A böngészős tesztek adatattribútumokkal választanak ki elemeket, ezért nem változtak; egy szövegelvárás („nem találtam hibát”) a megmaradt szóra épül.
