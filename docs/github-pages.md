# GitHub Pages kiadás

Repository: [philofobreal/developer-exercise](https://github.com/philofobreal/developer-exercise). A helyes célútvonal: [https://philofobreal.github.io/developer-exercise/](https://philofobreal.github.io/developer-exercise/).

## Helyi ellenőrzés

```sh
npm ci
npm run gate
```

A `gate` egyszer épít (ebből lesz az `_site/` statikus kiadás), aztán azt futtatja, amit a változás igényel ([ADR-142](adr/142-fast-deploy-and-local-gate.md)). A teljes kör: `npm run gate -- --full` (vagy külön a `npm run check:all` és a `npm run test:browser:all`). Önálló build: `npm run build:pages`. A böngészős kör előfeltétele a README-ben dokumentált Python/Playwright telepítés.

Az artifact relatív belépési útvonalakat, helyi Prismet, JS Beautify-t, TypeScript compilert, Acorn JS-parsert, tiszta strukturális validátort, példafeladatokat és a publikált `schema.json` fájlt tartalmazza. Node-szerver nem kerül bele. A valódi HTTP-alapú teszt `/developer-exercise/` alól tölti be; a sikeres gyökérútvonalas megnyitás önmagában nem elég.

## GitHub Actions

Két, egymástól független workflow fut ([ADR-142](adr/142-fast-deploy-and-local-gate.md)):

**`.github/workflows/pages.yml` („Publish Pages”)**, a `main`/`master` ágra érkező pushra vagy kézi indításra:

1. Lockfile alapján telepít (`npm ci`), és megépíti az `_site/` kiadást (`npm run build:pages`).
2. Ellenőrzi, hogy a generált kimenetek egyeznek a forrásukkal.
3. Feltölti és telepíti a Pages-artifactot.

Teszt nem fut benne: a telepítés a push után néhány perccel kész.

**`.github/workflows/ci.yml` („Verify”)**, minden pushra, pull requestre vagy kézi indításra:

1. Lockfile alapján telepít, előkészíti a Python/Chromium környezetet.
2. Futtatja a teljes Node-kört és a referenciaauditot (`check:all`), majd minden böngészős sort (`test:browser:all`).
3. A diagnosztikai artifactot mindig megőrzi.

Az ellenőrzés a telepítést **nem tartja vissza**: mellette fut, és később jelez. Ha piros, javítani kell, de a webhely addigra frissült; a hibát a push előtti helyi kapu tartja távol. Egy újabb push megszakítja az előző, még futó ellenőrzést.

A Pages-beállításban **GitHub Actions** legyen a kiadási forrás. A telepítő job `pages: write`, `id-token: write` jogosultságot kap; az építő és az ellenőrző job csak olvasási jogosultságot.

A helyi Git origin még mutathat korábbi névre; ellenőrzés: `git remote -v`. A távoli beállítást a helyi audit nem módosítja automatikusan. Új repository létrehozása nem szükséges.

## Demó és szerver eltérése

Pages: **Local Demo / Preview Validation**. Minden referencia és szabály eljut a böngészőbe; az elfogadás nem hitelesített vizsgaeredmény. Node: **Trusted Server Validation**. A tanulói kérés csak feladatazonosítót, verziót és kódsorokat ad; szabályt nem határoz meg. Mindkét mód külön, nem hiteles szerzői előnézetet kezel, és referenciaimportkor szintaktikai auditot futtat.

Az audit során helyi buildet és HTTP-alapú statikus ellenőrzést végzünk. Ez nem igazolja a távoli GitHub-beállításokat vagy egy tényleges Actions-futás/deployment sikerét.
