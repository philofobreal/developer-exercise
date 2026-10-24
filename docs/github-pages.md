# GitHub Pages – nyilvános demó és szerveres rendszer

## Két futtatási mód

1. **Node.js alkalmazás** (`npm start`): a referenciafeladatok és az értékelési szabályok a szerveren maradnak. A `POST /api/evaluate` és a szerzői API valós szerveroldali kiértékelést végez.
2. **GitHub Pages demó** (`npm run build:pages`): az `_site/` statikus mappa kerül publikálásra. A böngészőben ugyanaz a `dist/validator.js` és `dist/code-line.js` validációs mag fut, helyi szerzői generátorral és TypeScript Language Service-szel. A szabályok **nyilvánosan letölthetők**, a feladatokat a böngésző maga ellenőrzi; ezért ez NEM hiteles, visszaélésektől védett vizsgarendszer.

A demó megőrzi a feladatkészítőt, a forráskód és JSON szerkesztését, a modell újraalkalmazását, a beszúró drag & drop-ot, az élő behúzást, a copy-t és a fullscreen-t. Az állapotot nem tárolja tartósan. A TypeScript compiler helyben a vendor mappából töltődik, nem a GitHub Pages-en futó Node szerverről.

## Publikálás új repositoryból

1. GitHubon hozz létre **Public**, üres repositoryt `ngdynamic-codeline-demo` néven a `philofobreal` fiók alatt. (Ne add hozzá automatikusan a README-t vagy licencet.)
2. A projektgyökérben futtasd:

```bash
git init
git branch -M main
git add .
git commit -m "feat: ngDynamic CodeLine v7 and Pages demo"
git remote add origin https://github.com/philofobreal/ngdynamic-codeline-demo.git
git push -u origin main
```

3. A repository **Settings → Pages → Build and deployment → Source** mezőjében válaszd a **GitHub Actions** opciót. A `.github/workflows/pages.yml` a push után ellenőrzi a teszteket, elkészíti az `_site` buildet és közzéteszi az oldalt.
4. Nyisd meg az Actions-t és ellenőrizd a `Test and deploy GitHub Pages demo` workflow sikerét.
5. A várható URL: `https://philofobreal.github.io/ngdynamic-codeline-demo/` (csak a sikeres publikálás után használható).

A GitHub Pages a repository jogosultságai és fiókbeállításai szerint engedélyezhető; szükség lehet a Pages workflow környezetének engedélyezésére.

## Tesztelés

```bash
npm install
npm run check:all
python3 -m http.server 9000 --directory _site
```

A demó böngészőben: `http://localhost:9000/`. Ne `file://` útvonalon nyisd meg, mert az ES modulok és a `fetch` használata HTTP-t igényel.

## Biztonsági korlát

A GitHub Pages **nem** futtatja a Node.js API-t. A szerveroldali értékelésnek külön, hitelesített HTTPS-backendre kell kerülnie, és a kliensnek akkor a megfelelő API végpontot kell használnia. A GitHub Pages demó elfogadása nem hivatalos pontszám. Az elkészített statikus buildet ne használd éles tanulói értékelésre.
