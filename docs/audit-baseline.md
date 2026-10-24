# Baseline állapotfelmérés – 2026-10-24

Ez a dokumentum a javítások előtti állapotot rögzíti. A baseline task befejezése nem jelenti a TASK-01–TASK-18 feladatok teljesítését.

## Kiindulópont és környezet

- A felhasználó által kijelölt helyi repository: `C:\novy\ngdynamic-codeline`.
- Branch: `main`.
- Commit: `ae0d30b3f9eb8ff090ddebc89c14eef2cc6e3eb8`.
- Projektverzió: `7.0.0`.
- A kiinduló working tree tiszta volt.
- A helyi origin beállítás még `https://github.com/philofobreal/ngdynamic-codeline-demo.git`; nem változtattuk meg. A feladatban megadott aktuális repository: `philofobreal/developer-exercise`.
- Node.js: `25.2.1`; npm: `11.6.2`; helyi Python: `3.13.2`; TypeScript: `5.8.3`.
- Windows alatt, a sandboxon kívül futottak az ellenőrzések, mivel a kijelölt repository a chat írható munkamappáján kívül található.

## Futtatások és eredmények

| Ellenőrzés | Eredmény |
| --- | --- |
| `npm install --no-audit --no-fund` | Sikeres; a függőségek naprakészek, a lockfile nem változott. |
| `npm run check:all` | Sikertelen, kilépési kód: 1. A Node tesztfuttató 138 eredményt jelentett: 137 sikeres, 1 sikertelen tesztfájl. |
| A `check:all` részeként futó TypeScript-build | Sikeres. |
| A `check:all` részeként futó Pages-build | Sikeres; a statikus kiadás elkészült az `_site/` mappában. |
| Külön `npm run verify:models` | Sikeres: mind a 4 beépített referencia modellje, eredeti sorrendje és parserellenőrzése megfelelt. |
| Külön `npm run verify:pages` | Sikeres: build és 3/3 Pages-teszt. Ezek a teljes Node-körben is futó tesztek ismételt, célzott ellenőrzései. |
| `npm run test:browser` | Playwright telepítése után is indítási hiba: a Linuxos Chromium-útvonal nem létezik Windows alatt. |
| `npm run test:browser:server` | Ugyanez az indítási hiba. |
| Offline böngészőteszt ideiglenes Windows-illesztéssel | Sikeres: 1 teljes tesztszkript, változatlan állításokkal. |
| Valódi HTTP-alapú böngészőteszt ideiglenes Windows-illesztéssel | Sikeres: 1 teljes tesztszkript, változatlan állításokkal. |

A `check:all` az első hibás parancsnál leállt, ezért az utána következő referencia- és Pages-ellenőrzéseket külön indítottuk el. A teljes parancs ettől még nem sikeres.

## Bizonyított problémák

### Windowsos fájlútvonal a modell-visszaalkalmazási tesztben

A `tests/model-roundtrip.test.mjs:4` a `new URL(...).pathname` értékét adja át fájlrendszerútvonalként. Windows alatt az eredmény `ENOENT`, a naplóban szereplő hibás útvonal: `C:\C:\novy\ngdynamic-codeline\examples\`.

A fájl betöltése a benne szereplő három teszteset regisztrálása előtt leáll. Ezek ezért ebben a Node-futásban nem futottak le; a futtató egyetlen sikertelen tesztfájlként jelenti az esetet. A hordozható javításnál a `fileURLToPath` használatát kell ellenőrizni.

### Linuxhoz kötött böngészőindítás

Mindkét böngészőteszt `/usr/bin/chromium` útvonalról próbál indulni. Az offline teszt támogat `CHROMIUM` környezeti változót, a HTTP-teszt jelenleg rögzített útvonalat használ. A két npm-parancs eredeti alakjában ezen a Windows-környezeten nem működik.

A rendszer Python-környezetében kezdetben Playwright sem volt telepítve. A baseline-hoz külön ideiglenes virtuális környezet készült; globális Python-csomagot nem telepítettünk.

## A böngészős diagnosztikai futások pontos módja

- Ideiglenes Python-környezet: `%TEMP%\ngdynamic-baseline-playwright`.
- Telepített Playwright-verzió: `1.64.1`.
- Böngésző: a telepített `C:\Program Files\Google\Chrome\Application\chrome.exe`.
- Az ideiglenes `%TEMP%\ngdynamic-baseline-browser.py` indító `runpy.run_path` segítségével futtatja az eredeti tesztfájlokat.
- Az indító kizárólag a `BrowserType.launch` Linuxos végrehajtható állományútvonalát cseréli a fenti Chrome-ra, és a `Page.screenshot` fájlcélját irányítja a TEMP mappába. A tesztállításokat, alkalmazáskódot és HTTP-válaszokat nem módosítja.
- Mindkét illesztett futás `python -X utf8` módban történt. Az offline teszt a már meglévő HTTP-helyettesítését használta; a HTTP-teszt valódi Node-szerverhez kapcsolódott.
- Az indító és a virtuális környezet helyi diagnosztikai eszközök; a projektnek továbbra sincs működő, hordozható böngészőteszt-indítása vagy erre épülő CI-igazolása.

A sikeres HTTP-futás ellenőrizte a feladatkészítést, a dependency-szerkesztés hatását, a korábbi összeállítás megőrzését, a drag & drop utáni tartalmi multiplicitást, a nagy lista görgetését és néhány stílustulajdonságot. Az offline futás külön beszúrási sorrendet és beszúrásjelzőt is vizsgált. A fullscreen gomb létezését ellenőrzik, a tényleges fullscreen váltást és a vágólapműveletet nem; ezek teljes lefedettsége későbbi feladat.

## Naplók és változások

A teljes naplók a repository gyökerében találhatók, a meglévő `*.log` ignore-szabály miatt nem kerülnek verziókezelésbe:

- `baseline-check-all.log`
- `baseline-verify-models.log`
- `baseline-verify-pages.log`
- `baseline-browser-offline.log`
- `baseline-browser-server.log`
- `baseline-browser-offline-chrome.log`
- `baseline-browser-server-chrome.log`

A baseline során alkalmazásforrást, tesztet, workflow-t és függőségdeklarációt nem módosítottunk. A fordított, verziókezelt állományok sem változtak. Ez az új dokumentum a baseline task egyetlen verziókezelendő eredménye. Távoli repository-módosítás, push vagy Pages-deployment nem történt.

## Következő lépés

A felhasználó jóváhagyása után TASK-01: regexliterálok és más lexikai környezetek behúzási regressziós tesztjei, majd a toleráns lexikai állapotgép javítása. A fenti tesztinfrastruktúra-hibák a böngészős/CI munka során követendők; a baseline-ban még nem javítottuk őket.
