# Harmadik fél csomagjai és licencek

| Összetevő | Rögzített verzió | Licenc és kiadási hely |
| --- | --- | --- |
| PrismJS | A korábbi projektből átvett 1.25.0 assetek | MIT; `public/vendor/LICENSE-prism.txt` és az eredeti forrásfejlécek |
| JS Beautify | 1.13.13 | MIT; `public/vendor/LICENSE-js-beautify.txt`; a build a pontos npm-csomagból másolja a helyi böngésző-runtime-ot |
| TypeScript | 5.8.3 | **Apache-2.0**; `public/vendor/LICENSE-typescript.txt`; a Pages-build a compiler eredeti licencét is másolja |
| Acorn | 8.19.0 | MIT; `src/author/vendor/LICENSE-acorn.txt` és `public/vendor/LICENSE-acorn.txt` |
| Ajv | 8.20.0 | MIT; build/test függőség; standalone ellenőrzőt generál, saját licencét a generált forráshoz mellékeljük |
| @types/node | 22.20.5 | MIT; kizárólag fejlesztési típusdefiníció a governance buildhez, `node_modules/@types/node/LICENSE`; nem böngészős runtime |
| Playwright (Python) | 1.64.1 | Apache-2.0; tesztinfrastruktúra, nem kerül az alkalmazásba |
| Pyodide | 314.0.7 | MPL-2.0; izolált author parser-szelet, a termék Pages artifactjában még nincs. [Upstream licenc](licenses/LICENSE-pyodide.txt), [pinned hash-manifeszt](python-runtime-manifest.json) |
| CPython a Pyodide-ban | 3.14.2 | PSF és beépített upstream notice-ok: [eredeti CPython licenc](licenses/LICENSE-cpython.txt) |

A Pyodide-licenc a `b1e4fcc2488962f6360a97f19b9982d6fdb5d16f` upstream commit `LICENSE` fájlja; a CPython-licenc a `v3.14.2` tagből származik. A runtime csak az npm-lockfile és az öt fájlt ellenőrző manifeszt egyezésekor kerül a külön parser-teszthostba. A termékbe bekötés előtt a teljes runtime terjesztési/support-felülvizsgálat továbbra is kiadási feltétel, lásd [platformstátusz](python-parser-platform.md).

A Prism licencszövege a hivatalos [v1.25.0 tagből](https://github.com/PrismJS/prism/blob/v1.25.0/LICENSE) származik, blob SHA: `528949f42d9e142f1fd4b1c0e7dba074bba91ba2`. A korábbi dokumentáció tévesen MIT-nek nevezte a TypeScript licencét; a telepített compiler tényleges licence Apache-2.0.

Az npm közvetett függőségeit a `package-lock.json` integritáshash-ekkel és verziókkal rögzíti. Telepítés: `npm ci`. A JS Beautify régi verziója az eredeti működés összehasonlíthatósága miatt maradt meg; a formázó csak megjelenítési tanácsot ad, nem írhat tanulói tokentartalmat.

A helyi audit során az Ajv korábbi 8.17.1 verziójára jelzett [ReDoS advisory](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) miatt 8.20.0-ra frissítettük. A végleges `npm audit` eredményét az auditjelentés tartalmazza. Az audit pillanatnyi ismert csomagjelzéseket ellenőriz, nem teljes biztonsági bizonyítás.

Projektlicenc: nincs önkényesen választva; lásd a gyökérszintű `LICENSE-STATUS.md` fájlt. A harmadik felek licencei ettől függetlenül megmaradnak.
