# ADR-155 – Önálló bemutató oldal: egy fájl, néhány kész feladat, szerzői elemzés nélkül

Állapot: **elfogadva** (2026-11-14). A felhasználó kérése: „lehetne-e olyan standalone oldalt összeállítani, ami pár előre kidolgozott feladatra csak validálna, és a dependenciákat is lehetne mutatni a sorok között?”, majd „az önálló bemutató oldal legyen az első”. Kockázati osztály: megjelenítés, dokumentáció és eszközök. A validátor, a szerzői elemzés, a szabályok és az értékelés nem változott.

## Kontextus

- **A cél egy vállalati bemutató:** az oldal megmutatható és átadható legyen úgy, hogy a fejlesztés lényege ne legyen letölthető.
- **A Pages-kiadás erre nem jó:** a teljes motort szállítja, a szerzői elemzést is ([ADR-154](154-public-server-practice-only.md)).
- **A szerveres kiadás erre sok:** tárhely, üzemeltetés és kitelepítés kell hozzá (NY-60).
- **A gyakorláshoz a szerzői elemzés nem kell.** A kész modellben a sorfüggőségek adatként állnak; az ellenőrzéshez a validátor elég. A kézzel írt motorforrásból a szerzői elemzés kb. 696 KB, a validátormag kb. 184 KB (a generált sémaellenőrző nélkül).

## Döntés

### 1. Egy fájl: `npm run build:standalone` → `_standalone/codelinesorter.html`

- **Lemezről és bármely statikus tárhelyről megnyitható;** semmit nem tölt be máshonnan (stílus, betűkészlet, kiemelő, formázó és a lap kódja a fájlban van).
- **Alapértelmezett válogatás** (szintenként és nyelvenként egy-egy, öt feladat): `celsius-js`, `grade-ts`, `fib-memo-js`, `stack-ts`, `algo-bfs-js`. Más válogatás: `npm run build:standalone -- stack-ts grade-ts`.
- **A katalógus és a publikálási szabály a szerveré:** amit a szerver nem szolgálna ki, az ide sem kerül; a lista a szerver saját összefoglalója.
- **A modellből kimarad az `authoring` mező** (stratégia, eredet, bizonyíték, tippek): a validátor nem olvassa.
- **A kód tömörített, forrástérkép nélkül.** Ez lassítja a visszafejtést, nem akadályozza meg.
- **A `_standalone/` mappa nem követett** (mint az `_site/`); mellé kerül az `inputs.json`, a csomagba került fájlok jegyzéke.

### 2. A gyakorló motor ([practice-api.ts](../../src/standalone/practice-api.ts))

- **Ugyanazokat a műveleteket adja, mint a szerver API-adaptere** ([api.ts](../../src/workbench/api.ts)); a csomagolás az adapter helyére teszi, a lap változatlan.
- **Az ellenőrzés a szerveré:** a mag diagnózisa ugyanazzal a keresési kerettel és a tanulói felfedéssel ([ADR-027](027-disclosure-and-author-authorization.md), [ADR-147](147-learner-rule-panel-after-a-check.md)). A sorok közti szabályok az első ellenőrzés után nyithatók meg, ahogy a szerveren.
- **Szerzői szolgáltatás nincs:** az `authorAccess` válasza „nem”, ezért a lap csak gyakorlás ([ADR-154](154-public-server-practice-only.md)); a szerzői műveletek hibát adnak.
- **Local Demo** (AGENTS.md): a lap így nevezi magát; a szállított feladatok szabályai a fájlban vannak, az ítélet nem hitelesített eredmény.

### 3. Határ az architektúra-kapuban (`standalone-boundary`)

A `src/standalone` modulja csak a saját moduljait és a mag nyilvános interfészét (`dist/index.js`) importálhatja, és nem nevezhet meg DOM- vagy hálózati globálist. A szerzői elemzés, a szerver és a lap moduljai tiltottak.

## Mit lát, aki a fájlt megkapja

| Benne van | Nincs benne |
| --- | --- |
| a mag: a validátor (illesztés, részleges rendezés, rögzített helyek, keresési keret, diagnózis), a modellséma, és a mag többi része, amennyit a csomagoló nem tud elhagyni (szabályszerkesztés, modellellenőrzés) | a szerzői elemzés: ami a forrásból levezeti a szabályokat |
| a szállított feladatok kész szabályai | a többi feladat, és bármelyik szabályának eredete és bizonyítéka |
| a lap megjelenítő kódja (a szerzői felületé is, használaton kívül) | a TypeScript-fordító, a szerver, a tesztek, az orákulum, a dokumentáció |

A kész szabályokból a levezetés módszere részben kikövetkeztethető; a válogatás ezért legyen szűk.

## Két terv („design it twice”)

1. **A Pages-kiadás összecsomagolása egy fájlba.** Elvetve: a Local Demo motorja (`pages-api.js`) statikusan importálja a szerzői elemzést, vele a fordítót is; pont az kerülne a fájlba, amit ki akarunk hagyni.
2. **Külön gyakorló motor a mag nyilvános interfészére, a szerveradapter műveleteivel (választott).** A lap nem változik; a szerzői kód hiányát a csomag bemeneti jegyzéke bizonyítja, nem a bizalom.
3. **Szerveroldali kirajzolás statikus HTML-be.** Elvetve: az ellenőrzés akkor is a böngészőben futna, a lapot pedig át kellene írni.

## Tervezési review (docs/design-review.md)

- **practice-api.ts:** *elrejti,* hogy a feladatok a betöltéskor egyszer lefordulnak, és hogy az ellenőrzés a mag diagnózisa a tanulói felfedéssel. *Interfésze:* `createPracticeApi(feladatok)` → a lap API-ja. *Hívója* a csomagolás által írt kétsoros adapter.
- **build-standalone.mjs:** *elrejti,* hogyan lesz a lapból egy fájl, mi marad ki a modellből, és hol lép a gyakorló motor az adapter helyére. *Interfésze:* `buildStandalone(azonosítók)` és a parancs. Eszköz, a testvérei (`build-pages.mjs`, `publish-examples.mjs`) mintájára `.mjs`.
- **Nincs harmadik listaforma:** a feladatlista a szerverkatalógus `list()` válasza, építéskor.
- **design, rögzítve:** az ellenőrzés két sora és a keresési keret (50 000 állapot) három helyen áll (`catalog.mjs`, `pages-api.js`, `practice-api.ts`). Egy tulajdonos a magban lenne a helyes; az a mag interfészét szélesítené, ezért külön döntés (NY-62). Az egyezést teszt tartja.
- **design, rögzítve:** a súgóoldal külön dokumentum, a fájlban nincs benne; a rá mutató hivatkozásokat a csomagolás egy stílusszabállyal elrejti, a buborékok megmaradnak.
- **design, rögzítve:** az ellenőrzés a fő szálon fut (nincs worker). A szállított feladatokon ez ezredmásodpercek kérdése; nagy modellnél a lap a keresés idejére megállna.

## Bizonyíték

- **Egységteszt** ([standalone.test.mjs](../../tests/standalone.test.mjs)):
  - a csomag bemenetei között nincs szerzői elemzés, fordító, szerver vagy másik API-adapter; minden bemenet a `public/` vagy a `dist/` alól jön;
  - a fájl semmit nem tölt be máshonnan, és nincs benne forrástérkép-hivatkozás;
  - a szállított modellekben nincs `authoring` mező, a levezetésük ujjlenyomata sincs a fájlban, a soraik és a szabályaik változatlanok, és a nem választott feladatok nincsenek a fájlban;
  - a nem kiszolgált feladat nem szállítható;
  - a gyakorló motor listája és ítélete megegyezik a szerverkatalóguséval (feladatonként négy beadás: a referencia, egy csere, egy hiányos és a fordított sorrend);
  - a műveletek neve egyezik a szerveradapterével; szerzői szolgáltatás nincs;
  - az architektúra-határ elutasítja a szerzői modul, a mag belső modulja és a hálózat használatát.
- **Böngészős sor** ([browser-standalone.playwright.py](../../tests/browser-standalone.playwright.py), `npm run test:browser:standalone`, a `test:browser:all` része), asztali gépen és telefonon, a fájlt lemezről megnyitva: csak gyakorlás; a referencia elfogadva, egy szabályt sértő csere indokkal elutasítva; a szabálypanel megnyílik; nincs lapon belüli hiba, és a lap semmit nem kér máshonnan.
- **Mérés:** a fájl 882 KiB; a csomagban 59 bemeneti modul van.
- **Teljes kör:** `npm run gate` (az eszközlánc változott).

## Nyitott

- **Az ellenőrzés egy tulajdonosa a magban** (NY-62): a három egyező hívás összevonása.
- **A válogatás a felhasználó döntése;** az alapértelmezés javaslat.

## Korlát

- **A validátor és a szállított feladatok szabályai olvashatók a fájlból.** Aki ezt sem akarja kiadni, annak a szerveres kiadás kell ([ADR-154](154-public-server-practice-only.md)).
- **A modellséma a mag része, ezért a fájlban van:** belőle a modell mezőinek neve és a szabályverziók címkéje (például `scoped-effect-analysis-v58`) kiolvasható. Ezek nevek, nem a levezetés kódja.
- **Új feladat a fájlban nem készíthető.**
- **A fájlban az akadálymentességi átvizsgálás nem futott külön;** a lap a gyakorló nézet, amelyet a meglévő sor vizsgál.
