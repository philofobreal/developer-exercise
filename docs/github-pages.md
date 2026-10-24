# GitHub Pages kiadás

Repository: [philofobreal/developer-exercise](https://github.com/philofobreal/developer-exercise). A helyes célútvonal: [https://philofobreal.github.io/developer-exercise/](https://philofobreal.github.io/developer-exercise/).

## Helyi ellenőrzés

```sh
npm ci
npm run check:all
npm run test:browser:all
```

A `check:all` elkészíti az `_site/` statikus kiadást. Önálló build: `npm run build:pages`. A böngészős kör előfeltétele a README-ben dokumentált Python/Playwright telepítés.

Az artifact relatív belépési útvonalakat, helyi Prismet, JS Beautify-t, TypeScript compilert, Acorn JS-parsert, tiszta strukturális validátort, példafeladatokat és a publikált `schema.json` fájlt tartalmazza. Node-szerver nem kerül bele. A valódi HTTP-alapú teszt `/developer-exercise/` alól tölti be; a sikeres gyökérútvonalas megnyitás önmagában nem elég.

## GitHub Actions

A `.github/workflows/ci.yml` push, pull request vagy kézi indítás esetén:

1. Lockfile alapján telepít (`npm ci`), előkészíti a Python/Chromium környezetet.
2. Egyszer futtatja a teljes Node-kört és a referenciaauditot; ugyanebből a buildből származik az `_site/`.
3. Futtatja mind az öt böngészős szkriptet: offline, valódi HTTP, Node/Pages mátrix, drag és szerzői/preview munkafolyamatok.
4. Siker után, kizárólag `main`/`master` ágon és nem PR-eseménynél feltölti az ellenőrzött Pages-artifactot.
5. A `needs: verify` függőségű deploy job meghívja a `.github/workflows/pages.yml` újrafelhasználható workflow-t. Az nem épít és nem tesztel újra; ugyanazt az artifactot publikálja.

Sikertelen build vagy bármely teszthiba után nincs Pages-feltöltés/deployment. A diagnosztikai artifact ettől függetlenül megőrződik. A Pages-beállításban **GitHub Actions** legyen a kiadási forrás. A deploy job `pages: write`, `id-token: write` jogosultságot kap; a tesztjob csak olvasási jogosultságot.

A helyi Git origin még mutathat korábbi névre; ellenőrzés: `git remote -v`. A távoli beállítást a helyi audit nem módosítja automatikusan. Új repository létrehozása nem szükséges.

## Demó és szerver eltérése

Pages: **Local Demo / Preview Validation**. Minden referencia és szabály eljut a böngészőbe; az elfogadás nem hitelesített vizsgaeredmény. Node: **Trusted Server Validation**. A tanulói kérés csak feladatazonosítót, verziót és kódsorokat ad; szabályt nem határoz meg. Mindkét mód külön, nem hiteles szerzői előnézetet kezel, és referenciaimportkor szintaktikai auditot futtat.

Az audit során helyi buildet és HTTP-alapú statikus ellenőrzést végzünk. Ez nem igazolja a távoli GitHub-beállításokat vagy egy tényleges Actions-futás/deployment sikerét.
