# ADR-113 – Szabványos könyvtár a Local Demóban és a forrás ellenőrzése modellkészítés nélkül

Állapot: **elfogadva** (2026-11-08). Kockázati osztály: szerzői elemzés (az első kapu bemenete) és megjelenítés. Az ADR-108 C16-szakaszát pontosítja.

## Kontextus

A felhasználó kérdése: mi kell ahhoz, hogy az elemzési beállítások ne legyenek tiltva, és a kód ellenőrzése már a Forrás lépésben megtörténjen, érthető segítséggel.

- **A tiltás oka (C16, ADR-108):**
  - a Local Demó (Pages) nem szállította a TypeScript szabványos könyvtárát (`lib.*.d.ts`), ezért ott a nyelvi ellenőrzés nem futott (`not-run`);
  - az első kapu így minden forrásra „nem eldönthető” volt;
  - ezért a „Tilt”, a checkJs és a szigorú TS-diagnosztika csak a szerveren volt választható.
- **Ellenőrzés csak modellkészítéssel:** az első kapu eddig csak a modell készítésekor futott. Ez a terv („Elemzés” modellkészítés nélkül) egy kimaradt pontja volt.

## Döntés

1. **Szabványos könyvtár a Pages-en:**
   - **Mit szállítunk:** a [build-pages.mjs](../../scripts/build-pages.mjs) a szerver nyelvi ellenőrzésének könyvtárát (`lib.es2022.full.d.ts` és az általa hivatkozott fájlok) egy fájlba csomagolja: `vendor/typescript-lib.json`.
     - Mérve: 63 fájl, 1,8 MB, tömörítve kb. 272 KB.
     - A szerzői mód amúgy is betölti a 8,7 MB-os fordítót.
   - **Betöltés:** a [pages-api.js](../../public/app/pages-api.js) az első szerzői műveletnél egyszer tölti be, és ebből olvas.
     - Ugyanazzal a könyvtárral ugyanazt az ellenőrzést futtatja, mint a szerver: a két környezet ugyanazt mondja.
     - Az ellenőrzést végző objektum egyszer készül el, a könyvtár forrásfájljait gyorsítótárazza.
   - **Környezet:** a feloldó a betöltés sikerétől függően kapja a környezetet (`languageAudit`).
     - Sikeres betöltésnél semmi sem „csak szerveren”.
     - Ha a betöltés nem sikerül (offline másolat, hálózati hiba), a C16-szabály érvényes, mint eddig: a „Tilt” elutasítva, a két szigorú diagnosztika inaktív, a felület jelzi.
2. **Forrás ellenőrzése** („Forrás ellenőrzése” gomb a Forrás lépésben):
   - csak az első kaput futtatja a választott beállításokkal: nyelvi ellenőrzés, kötések, objektumállapot;
   - nem készít modellt és nem tárol semmit: szerveren `POST /api/author/check` (`checkSource`), a Pages-en helyben, ugyanazzal a döntéssel;
   - a leletek a meglévő listába kerülnek (bizonyosság szövegesen, sorszám-gomb, eredet és kód), a lépéssor jelzi a „Hibás forrás” vagy a „Figyelmeztetés” állapotot;
   - tiszta eredménynél szöveges visszajelzést ad;
   - a Modell készítése továbbra is lefuttatja ugyanezt a kaput, ez nem csak tanács.

## Bizonyíték

- [pages-api.test.mjs](../../tests/pages-api.test.mjs):
  - a demó nyelvi ellenőrzése `ok`, a könyvtár a feltevések között;
  - semmi nem „csak szerveren”;
  - a TDZ- és a TS2322-hiba a forrás ellenőrzésénél is elakad;
  - a második kapu „passed”;
  - sikertelen betöltésnél: `not-run`, a „Tilt” csak szerveren (C16).
- [source-check.test.mjs](../../tests/source-check.test.mjs):
  - a leletek bizonyossággal;
  - draft nem készül;
  - a beállítás érvényesül;
  - a rossz opció 422;
  - HTTP-útvonal.
- [browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py), Node és Pages módban:
  - `source_check`: lelet, lépésállapot, tiszta eredmény, a Szabályok zárva marad;
  - `preflight_ui`: a Pages-en is választható a „Tilt”.
- [browser-typescript.playwright.py](../../tests/browser-typescript.playwright.py): a szándékosan hibás minta (TS2300) a Pages-en is elakad.
