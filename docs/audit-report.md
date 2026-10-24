# ngDynamic Developer Exercise – végleges helyi audit

Dátum: 2026-10-24. Helyi repository: `C:\novy\ngdynamic-codeline`, branch: `main`. Kiinduló commit: `ae0d30b3f9eb8ff090ddebc89c14eef2cc6e3eb8`, verzió: 7.0.0. A felhasználó kezdetben taskonkénti megállást kért, majd felhatalmazott az összes task folyamatos végrehajtására, és hozzáadta a TASK-19 vágólapfunkciót.

A kiinduló working tree tiszta volt; felhasználói commitolatlan módosítást nem írtunk felül. A munka ebben a helyi working tree-ben található. Commit, push, távoli repository-módosítás, release vagy deployment nem történt. A korábban az üres chat-munkamappába klónozott példány nem a módosítások helye.

## Taskonkénti státusz

| Task | Státusz és tényleges eredmény |
| --- | --- |
| TASK-01 | Javítva. Toleráns lexikai állapotgép külön regex-, karakterosztály-, escape-, string-, komment- és template/interpolációs kontextussal. Kontrollzárójelek, kulcsszónevű property-k és függvénykifejezések utáni osztás is tesztelt. Az eredeti `/}/` hiba reprodukciója először elbukott, majd sikeres lett. |
| TASK-02 | Javítva. Az eredeti 1.13.13 JS Beautify-konfiguráció és sentinel megtartva, helyi verziózott assettel. Biztonságos hint önállóan korrigálhatja a lexikai mélységet; eltérő sorhatár, markerütközés vagy hiba lexikai fallbacket ad. Valódi könyvtárral történik összehasonlítás. |
| TASK-03 | Javítva, explicit reprezentációs korláttal. AST-hierarchia a teljes service-ben is megmarad. A közös fizikai sorhatárt használó intervallumok külön kötelező sorrendéleket kapnak; a megtartott szülő/gyermekblokkok nem vesznek el. Az `omittedBlocks` metaadat és a felület jelzi a határkorlátot. |
| TASK-04 | Javítva. Külön szerzői referenciaaudit Node-on és Pages-ben: séma/struktúra, nyelvi szintaxis, literal-whitespace, referencia-önellenőrzés. Hibás `const a = ;` nem aktiválható; a régi modell fennmarad. A tanulói értékelés nem hív parsert. |
| TASK-05 | Javítva. Egyetlen JSON Schemából Ajv standalone runtime készül. A gráf-, scope-, egyediség-, profil-, fixed- és méretellenőrzés a strukturális fordítóban egészíti ki. A séma és Ajv/runtime egyezését külön regressziók védik. |
| TASK-06 | Megvalósítva és helyben futtatva. Hordozható Python/Playwright-indítás, valódi HTTP E2E, Pages-alútvonal és kibővített mátrix bekerült a CI-ba. A tényleges távoli GitHub Actions-futás nincs elindítva/igazolva. |
| TASK-07 | Megvalósítva. Natív DnD, mouse/pen pointer, tényleges touch és billentyűzet ugyanazt a beszúrási domaint használja. Fókusz, élő státusz, megszakítás, autoscroll, fixed-védelem és mobilos érintési célméret. Az animáció közbeni hit-test tényleges transzformációt kompenzál. |
| TASK-08 | Megvalósítva. Local Demo / Preview Validation, Preview Validation és Trusted Server Validation elkülönül. A Pages-felület külön jelzi, hogy az eredmény nem hiteles vizsgaeredmény. |
| TASK-09 | Megvalósítva. Modell- és munkamenet-file export/import, szigorú sorazonossági és fixed-ellenőrzés, kézi localStorage-mentés/visszatöltés. Riport nem importálható. A még nem alkalmazott JSON-draft nem írja felül az exportált aktív modellt. |
| TASK-10 | Megvalósítva. Nyilvános típusregiszter és hierarchikus render-API, konkrét referencia/előnézet csoporttípussal. Új fieldtípus tesztje renderer-módosítás nélkül működik. Az értékelés külön modulban maradt. |
| TASK-11 | Javítva. README, Pages-dokumentáció és csomagmetaadatok a `philofobreal/developer-exercise` repositoryt és helyes Pages-célt írják le. A Git remote-ot nem módosítottuk. A baseline dokumentum történeti megfigyelése szándékosan őrzi a régi remote címét. |
| TASK-12 | Javítva. A nullkarakteres README-vég megszűnt. UTF-8 dokumentáció és automatikus NUL-/UTF-8-/helyi linkellenőrzés került a check/CI körbe. |
| TASK-13 | Megvalósítva. Egy verify job tesztel és épít; a reusable Pages-workflow kizárólag a sikeresen ellenőrzött artifactot publikálhatja. Nincs egymástól független, duplán tesztelő push-workflow. A YAML helyben parserrel ellenőrzött. |
| TASK-14 | Megvalósítva. Szemantikai bizonyítás és strukturális elfogadás külön fogalom a UI-ban és a dokumentációban. Az adapter lexikai szimbólumkötés-alapú deklaráció/használat-jelzéseket ad, shadowing-teszttel. Ezek nem lazítanak automatikusan sorrendi szabályt. |
| TASK-15 | Megvalósítva. Külön szerzői életciklus-, persistence-, input-, clipboard-, renderer- és API-felelősségek; aktívmodell/draft elválasztás és elavult async riportok védelme. A CSS egyetlen token-/komponens-/állapot-/responsive rendszer, egymásra rakott verziópatch-ek és `!important` nélkül. Asztali és mobil képernyőképet is ellenőriztünk. |
| TASK-16 | Megvalósítva JS/TS-re. Regisztrálható parse/format/tokenize/structure/whitespace/függőségjelzés adapterek; a szerzői folyamat ezeket használja. Új nyelvhez dokumentált adapter-, Schema- és UI-kiegészítés kell. Python/egyéb nyelv teljes implementálását nem állítjuk. |
| TASK-17 | Megőrizve és bővítve. A 31 osztálytag és a teljes 436 soros service regressziói megmaradtak, AST-hierarchia-elvárással. Parserellenőrzés, típusellenőrzés, formázás, strukturális validáció és futásidejű viselkedés állításai külön szerepelnek. |
| TASK-18 | Technikailag rendezve; a saját projektlicenc tulajdonosi döntés maradt. Harmadik fél licencei és TypeScript notice megőrizve; TypeScript helyesen Apache-2.0. Pontosan rögzített dependency-k, stabil publikált Schema-azonosító. Nincs önkényesen választott saját licenc. |
| TASK-19 | Megvalósítva. Másolás és beillesztés a szerzői forráshoz, JSON-modellhez, megoldásszerkesztőhöz és rendezőhöz; külön forrássor-másolás. Siker-/hibajelzés, tiltott olvasásnál kézi beillesztési útmutató, méretkorlát, fixed-védelem és explicit szerzői alkalmazás. A platform sorvégeit LF-re normalizáljuk, a sorok belső whitespace-e megmarad. |

## Architekturális döntések

- A nyelvspecifikus összetettség a szerzői adapterben marad. JavaScriptnél Acorn védi a tényleges JS-grammatikát, a közös struktúrához TypeScript AST-t használunk. A teljes JS/TS formázás TypeScript Language Service; ez nem típusellenőrzés.
- A lexikai preview és a teljes forrásformázás külön szerződés. A Beautify csak a megjelenítési prefixet befolyásolhatja; sorazonosítót és tokentartalmat nem. A valós értékelés nem a vizuálisan formázott szöveget kapja.
- AST-intervallumokból csak egyértelmű fizikai határú blokkok lesznek. A `} else {` jellegű többhatárú sorok teljes modellezését nem színleljük; lokális, dokumentált sorrendvédelem szűkíti az érintett tartományt. Egy új boundary-event séma későbbi bővítés lehet.
- A Schema a mezőalak egyetlen forrása, a TypeScript-fordító a referenciális és gráfinvariánsoké. Generált, browser-safe standalone ellenőrző fut Node-on és Pages-ben is.
- A fixed pozíciókat lineáris számú horgonyél kényszeríti ki. A referencia tartalmi kulcsainak indexelése ismételt normalizálás helyett előfeldolgozás. A bijekciós elfogadási feltétel és a determinisztikus `indeterminate` megmarad.
- A szerzői állapot és a még szerkesztett JSON elválik; import és sikertelen módosítás nem sértheti az aktív modellt. Késve érkező értékelés nem írhatja felül egy újabb mozgatás visszajelzését.
- A tárolás, vágólap, mezőrenderelés és beviteli módok nem birtokolnak hiteles értékelési szabályt. A szerver szerzői előnézete továbbra sem vizsgacsatorna.

## Ellenőrzési eredmények

A végleges futás környezete: Windows, Node.js 25.2.1, npm 11.6.2, Python 3.13.2, Playwright 1.64.1, helyi Chrome 156.0.8078.47. A CI Node.js 22 / Ubuntu környezetet deklarál, de távoli futást nem indítottunk.

| Parancs/ellenőrzés | Eredmény |
| --- | --- |
| `npm run check:all` | **200/200 Node-teszt sikeres**, 0 sikertelen, 0 kihagyott; TypeScript- és Pages-build sikeres. |
| Referenciaaudit a fenti parancsban | **4/4** modell, szerkezet, referenciasorrend és nyelvi szintaxis sikeres. |
| UTF-8 / NUL / helyi Markdown-link ellenőrzés | Sikeres a check:all részeként. |
| `npm run test:browser:all` | **3/3 szkript sikeres**: offline, valódi HTTP, bővített Node/Pages mátrix. A mátrix **24/24 külön nevesített esetet** futtat. |
| `npm audit --json` | **0 ismert jelzett sérülékenység** a végső telepített dependency-fában. |
| CI/Pages YAML parserellenőrzés | **2/2** fájl szintaktikailag érvényes, PyYAML 6.0.3 segítségével. Ez nem egy teljes távoli Actions-futás. |
| `git diff --check` | Sikeres; a Windows Git esetleges LF/CRLF figyelmeztetése nem tartalmi diffhiba. |

A három eredeti modell-visszaalkalmazási tesztet blokkoló Windows `.pathname` hibát `fileURLToPath` javítja. A korábban Linuxhoz rögzített böngészőindítás most hordozható; a végső tesztekhez nincs ideiglenes monkeypatch. A Python-csomagok elkülönített ideiglenes venvben lettek telepítve, a globális Python-környezet nem változott.

Az új esetek között tényleges CDP-touch, egér/pointer, billentyűzet, másolás/beillesztés, fullscreen, export/import, reload utáni helyi visszaállítás, azonos `}` ID-k cseréje, fixed szerkesztés tiltása, azonnali dependency-újraértékelés, hibás JS/TS, statikus Pages-alútvonal és a teljes service szerepel. A tiltott vágólapolvasás ágát célzott hibainjektálás ellenőrzi. A képernyőolvasó-támogatás ARIA-/fókuszszerződését ellenőriztük, valós OS-képernyőolvasós tanúsítást nem végeztünk.

Korábban elbukó diagnosztikai futások is történtek: ezeket a baseline és a tasknaplók őrzik. A fenti zöld eredmények a végső kódra vonatkoznak, nem a hibás köztes futások átminősítései.

Teljes helyi naplók: `audit-final-node.log`, `audit-final-browser.log`, `audit-final-dependencies.log`. Böngészőképek és trace: `test-results/` (Git által ignorált). A korábbi állapot részletei: [baseline](audit-baseline.md).

## GitHub Pages és kiadás

A publikálható `_site/` helyben elkészült. Relatív belépési útvonalak és helyi compiler/lexer/formatter/Prism mellett valódi HTTP-n, `/developer-exercise/` alól ellenőriztük. A Schema stabil `$id` címe a kiadás `schema.json` állományára mutat.

A CI a Node- és teljes böngészős ellenőrzés után töltheti fel pontosan ezt a könyvtárat. A deploy a verify jobtól függ; sikertelen ellenőrzéskor nincs publikálás. A reusable Pages workflow nem épít új, eltérő artifactot.

Távoli GitHub Pages-publikálás nem történt. A GitHub beállítások, jogosultságok és egy későbbi Actions-futás sikere helyi ellenőrzésből nem állítható.

## Fennmaradó korlátok és tulajdonosi döntések

1. A saját projektlicenc nincs kiválasztva. [LICENSE-STATUS](../LICENSE-STATUS.md) rögzíti a szükséges tulajdonosi döntést; harmadik fél licenceit megőriztük.
2. A Node backend szerverellenőrzött szabályokat használ, de nem tartalmaz bejelentkezési/jogosultságkezelési rendszert, tartós adatbázist vagy üzemi auditnaplót. Hiteles vizsgaszolgáltatáshoz ezek és a referencia szakmai jóváhagyása szükségesek.
3. A strukturális elfogadás és parserellenőrzés nem bizonyít szemantikai ekvivalenciát. A teljes külső service típushelyességét és futásidejű viselkedését a hiányzó külső projektfüggőségek miatt nem állítjuk.
4. Közös fizikai soron levő többszörös blokkhatár esetén explicit, szűkítő intervallumfallback marad. JSX/TSX és más nyelvek teljes támogatása nincs implementálva.
5. Hibás/hiányos forrásnál a vizuális lexer best effort; minden hibás program ideális esztétikai behúzása nem ígérhető. Sor- és tokentartalom-megőrzés kötelező.
6. A helyi ellenőrzés Chromium/Chrome-alapú. Firefox/WebKit és valós képernyőolvasó teszt nem történt. A vágólapolvasás böngészőjogosultságtól és biztonságos kontextustól függ; tiltásnál a UI kézi beillesztést javasol.

## Későbbi fejlesztési lehetőségek

Külön séma többszörös soron belüli boundary-eseményekhez; további valódi nyelvi adapterek; szemantikai és mellékhatás-elemző plugin; Firefox/WebKit és képernyőolvasós tesztkör; üzemi autentikáció, tartós szerzői publikálási folyamat és naplózás. Ezek nem részei a jelenleg késznek jelölt funkcióknak.

## Rövid changelog

Regex-/template-biztos live behúzás; önálló, ellenőrzött Beautify-hintek; AST-hierarchia és szerzői szintaktikai audit; egységes séma; pointer/touch/billentyűzetes beszúrás; módjelzések; export/import és helyi mentés; bővíthető field- és nyelvi adapterek; egységes CSS; ellenőrzött artifactra épülő CI; UTF-8 dokumentáció és licencek; TASK-19 vágólapgombok. Részletes változáslista: [CHANGELOG](../CHANGELOG.md).

## Módosított fájlok és indoklás

| Fájl | Indoklás |
| --- | --- |
| `.github/workflows/ci.yml` | Egyszeri verify, teljes böngészőkör, gated artifact/deployment. |
| `.github/workflows/pages.yml` | Egyszeri verify, teljes böngészőkör, gated artifact/deployment. |
| `.gitignore` | Generált tesztartifactok, Python-venv és cache kizárása. |
| `CHANGELOG.md` | Átadott módosítások, távoli kiadás állítása nélkül. |
| `LICENSE-STATUS.md` | Hiányzó saját licencdöntés dokumentálása. |
| `README.md` | Valós használat, tesztek, mentés, vágólap és kiadási/bizalmi határok. |
| `dist/code-line.d.ts` | Újrafordított mag, generált Schema-checker és típus-/sourcemap kimenet. |
| `dist/code-line.js` | Újrafordított mag, generált Schema-checker és típus-/sourcemap kimenet. |
| `dist/code-line.js.map` | Újrafordított mag, generált Schema-checker és típus-/sourcemap kimenet. |
| `dist/model.js` | Újrafordított mag, generált Schema-checker és típus-/sourcemap kimenet. |
| `dist/model.js.map` | Újrafordított mag, generált Schema-checker és típus-/sourcemap kimenet. |
| `dist/schema-check.d.ts` | Újrafordított mag, generált Schema-checker és típus-/sourcemap kimenet. |
| `dist/schema-check.js` | Újrafordított mag, generált Schema-checker és típus-/sourcemap kimenet. |
| `dist/schema-check.js.map` | Újrafordított mag, generált Schema-checker és típus-/sourcemap kimenet. |
| `dist/types.d.ts` | Újrafordított mag, generált Schema-checker és típus-/sourcemap kimenet. |
| `dist/validator.js` | Újrafordított mag, generált Schema-checker és típus-/sourcemap kimenet. |
| `dist/validator.js.map` | Újrafordított mag, generált Schema-checker és típus-/sourcemap kimenet. |
| `docs/architecture.md` | Tényleges implementáció, szerződés, teszteredmény, deployment vagy licenc dokumentálása. |
| `docs/audit-baseline.md` | Tényleges implementáció, szerződés, teszteredmény, deployment vagy licenc dokumentálása. |
| `docs/audit-report.md` | Tényleges implementáció, szerződés, teszteredmény, deployment vagy licenc dokumentálása. |
| `docs/github-pages.md` | Tényleges implementáció, szerződés, teszteredmény, deployment vagy licenc dokumentálása. |
| `docs/language-adapters.md` | Tényleges implementáció, szerződés, teszteredmény, deployment vagy licenc dokumentálása. |
| `docs/modularitas-es-elobehuzas.md` | Tényleges implementáció, szerződés, teszteredmény, deployment vagy licenc dokumentálása. |
| `docs/schema.json` | Tényleges implementáció, szerződés, teszteredmény, deployment vagy licenc dokumentálása. |
| `docs/security.md` | Tényleges implementáció, szerződés, teszteredmény, deployment vagy licenc dokumentálása. |
| `docs/ts-method-regression.md` | Tényleges implementáció, szerződés, teszteredmény, deployment vagy licenc dokumentálása. |
| `docs/v7-integracio-es-modell-szerkesztes.md` | Tényleges implementáció, szerződés, teszteredmény, deployment vagy licenc dokumentálása. |
| `docs/validacios-modell-es-formazas.md` | Tényleges implementáció, szerződés, teszteredmény, deployment vagy licenc dokumentálása. |
| `docs/vendor.md` | Tényleges implementáció, szerződés, teszteredmény, deployment vagy licenc dokumentálása. |
| `package-lock.json` | Pontos, integritáshash-es dependency-fa. |
| `package.json` | Rögzített eszközök, egyszeri check-folyamat, böngészős parancsok, repository-metaadatok. |
| `public/app/api.js` | Önálló állapot-, input-, vágólap-, persistence-, nézet- vagy API-felelősség. |
| `public/app/attempt.js` | Önálló állapot-, input-, vágólap-, persistence-, nézet- vagy API-felelősség. |
| `public/app/author-session.js` | Önálló állapot-, input-, vágólap-, persistence-, nézet- vagy API-felelősség. |
| `public/app/clipboard.js` | Önálló állapot-, input-, vágólap-, persistence-, nézet- vagy API-felelősség. |
| `public/app/drag-insert.js` | Önálló állapot-, input-, vágólap-, persistence-, nézet- vagy API-felelősség. |
| `public/app/pages-api.js` | Önálló állapot-, input-, vágólap-, persistence-, nézet- vagy API-felelősség. |
| `public/app/persistence.js` | Önálló állapot-, input-, vágólap-, persistence-, nézet- vagy API-felelősség. |
| `public/app/ui-utilities.js` | Önálló állapot-, input-, vágólap-, persistence-, nézet- vagy API-felelősség. |
| `public/app/view.js` | Önálló állapot-, input-, vágólap-, persistence-, nézet- vagy API-felelősség. |
| `public/fields.js` | Nyilvános hierarchikus típusrendszer, konkrét group rendererrel. |
| `public/formatter.js` | Lexikai állapotgép, biztonságos Beautify-hint és sor-/literalvédelem. |
| `public/formatting/legacy-beautifier.js` | Lexikai állapotgép, biztonságos Beautify-hint és sor-/literalvédelem. |
| `public/formatting/lexical-indenter.js` | Lexikai állapotgép, biztonságos Beautify-hint és sor-/literalvédelem. |
| `public/index.html` | CDN helyett rögzített helyi Beautify-asset. |
| `public/style.css` | Egységes design tokenek, komponensek, inputállapotok, responsive/fullscreen. |
| `public/ui.js` | Életciklus és eseménykoordináció, import/clipboard, async riportvédelem. |
| `public/vendor/LICENSE-acorn.txt` | Helyi, rögzített upstream asset vagy megőrzött licenc/notice. |
| `public/vendor/LICENSE-js-beautify.txt` | Helyi, rögzített upstream asset vagy megőrzött licenc/notice. |
| `public/vendor/LICENSE-prism.txt` | Helyi, rögzített upstream asset vagy megőrzött licenc/notice. |
| `public/vendor/LICENSE-typescript.txt` | Helyi, rögzített upstream asset vagy megőrzött licenc/notice. |
| `public/vendor/NOTICE-typescript.txt` | Helyi, rögzített upstream asset vagy megőrzött licenc/notice. |
| `public/vendor/beautify.js` | Helyi, rögzített upstream asset vagy megőrzött licenc/notice. |
| `scripts/build-pages.mjs` | Determinista build/Schema/vendor szinkron, referencia- és dokumentumellenőrzés. |
| `scripts/sync-schema.mjs` | Determinista build/Schema/vendor szinkron, referencia- és dokumentumellenőrzés. |
| `scripts/sync-vendor.mjs` | Determinista build/Schema/vendor szinkron, referencia- és dokumentumellenőrzés. |
| `scripts/verify-docs.mjs` | Determinista build/Schema/vendor szinkron, referencia- és dokumentumellenőrzés. |
| `scripts/verify-models.mjs` | Determinista build/Schema/vendor szinkron, referencia- és dokumentumellenőrzés. |
| `server.mjs` | Valós v7 indítási felirat. |
| `src/author/audit.mjs` | Nyelvi adapter, AST-generálás, formázás vagy külön referenciaaudit. |
| `src/author/errors.mjs` | Nyelvi adapter, AST-generálás, formázás vagy külön referenciaaudit. |
| `src/author/generator.mjs` | Nyelvi adapter, AST-generálás, formázás vagy külön referenciaaudit. |
| `src/author/languages.mjs` | Nyelvi adapter, AST-generálás, formázás vagy külön referenciaaudit. |
| `src/author/ts-format.mjs` | Nyelvi adapter, AST-generálás, formázás vagy külön referenciaaudit. |
| `src/author/vendor/LICENSE-acorn.txt` | Pontosan rögzített Acorn runtime és upstream licenc. |
| `src/author/vendor/acorn.mjs` | Pontosan rögzített Acorn runtime és upstream licenc. |
| `src/core/LICENSE-ajv.txt` | Séma, gráfintegritás, fixed horgonyok, indexelt bijekciós keresés vagy licenc. |
| `src/core/code-line.ts` | Séma, gráfintegritás, fixed horgonyok, indexelt bijekciós keresés vagy licenc. |
| `src/core/model.ts` | Séma, gráfintegritás, fixed horgonyok, indexelt bijekciós keresés vagy licenc. |
| `src/core/schema-check.ts` | Séma, gráfintegritás, fixed horgonyok, indexelt bijekciós keresés vagy licenc. |
| `src/core/types.ts` | Séma, gráfintegritás, fixed horgonyok, indexelt bijekciós keresés vagy licenc. |
| `src/core/validator.ts` | Séma, gráfintegritás, fixed horgonyok, indexelt bijekciós keresés vagy licenc. |
| `src/server/catalog.mjs` | Szerzői admission, szerveres szabálytulajdonlás, kontrollált HTTP-réteg. |
| `src/server/http.mjs` | Szerzői admission, szerveres szabálytulajdonlás, kontrollált HTTP-réteg. |
| `tests/author-audit.test.mjs` | Hibareprodukció, regresszió, hordozható HTTP/Pages/clipboard böngészőteszt. |
| `tests/browser-matrix.playwright.py` | Hibareprodukció, regresszió, hordozható HTTP/Pages/clipboard böngészőteszt. |
| `tests/browser-v7-offline.playwright.py` | Hibareprodukció, regresszió, hordozható HTTP/Pages/clipboard böngészőteszt. |
| `tests/browser-v7.playwright.py` | Hibareprodukció, regresszió, hordozható HTTP/Pages/clipboard böngészőteszt. |
| `tests/browser_support.py` | Hibareprodukció, regresszió, hordozható HTTP/Pages/clipboard böngészőteszt. |
| `tests/clipboard.test.mjs` | Hibareprodukció, regresszió, hordozható HTTP/Pages/clipboard böngészőteszt. |
| `tests/language-adapters.test.mjs` | Hibareprodukció, regresszió, hordozható HTTP/Pages/clipboard böngészőteszt. |
| `tests/legacy-comparison.test.mjs` | Hibareprodukció, regresszió, hordozható HTTP/Pages/clipboard böngészőteszt. |
| `tests/lexical-context.test.mjs` | Hibareprodukció, regresszió, hordozható HTTP/Pages/clipboard böngészőteszt. |
| `tests/model-roundtrip.test.mjs` | Hibareprodukció, regresszió, hordozható HTTP/Pages/clipboard böngészőteszt. |
| `tests/pages-api.test.mjs` | Hibareprodukció, regresszió, hordozható HTTP/Pages/clipboard böngészőteszt. |
| `tests/persistence-registry.test.mjs` | Hibareprodukció, regresszió, hordozható HTTP/Pages/clipboard böngészőteszt. |
| `tests/requirements-browser.txt` | Hibareprodukció, regresszió, hordozható HTTP/Pages/clipboard böngészőteszt. |
| `tests/schema-contract.test.mjs` | Hibareprodukció, regresszió, hordozható HTTP/Pages/clipboard böngészőteszt. |
| `tests/trust-boundary.test.mjs` | Hibareprodukció, regresszió, hordozható HTTP/Pages/clipboard böngészőteszt. |
| `tests/ts-methods.test.mjs` | Hibareprodukció, regresszió, hordozható HTTP/Pages/clipboard böngészőteszt. |


## Utókövetés – indítási portütközés

A felhasználó indítási képernyőképén az EADDRINUSE hibát a Plexus Engine meglévő Vite-folyamata okozta: az 5173-as portot foglalta. Ezt a folyamatot nem állítottuk le.

A `src/server/listen.mjs` legfeljebb tíz egymást követő portot próbál, kizárólag az implicit alapport esetén. Explicit PORT esetén nincs automatikus címváltás. A belépési pont érthető hibaüzenetet ír, nem kezeletlen error-eseménnyel áll le, és a ténylegesen kiosztott portot naplózza (PORT=0 esetén is). A README és a changelog frissült.

Az új `tests/server-start.test.mjs` valódi foglalt sockettel ellenőrzi a fallbacket, a másik szolgáltatás megőrzését, az explicit portot, a próbálkozási korlátot, a hibás portértéket és a belépési pont hibaüzenetét. A teljes `npm run check:all` eredménye immár **205/205 sikeres Node-teszt**, négy sikeres referenciaaudittal és dokumentumellenőrzéssel; napló: `startup-check-all.log`. A fenti eredeti 200-as szám az audit korábbi lezárását rögzíti.

A tényleges helyi ütközés mellett végzett indítási próbán a szerver http://127.0.0.1:5174 címen válaszolt, és a négy feladatot sikeresen kiszolgálta. A próba saját folyamatát utána leállítottuk.


## Utókövetés – natív húzás megszakad minden példában

A felhasználói hibát mind a négy beépített példában valódi böngészős kódszöveghúzással reprodukáltuk, a megoldáson belüli rendezésnél is. A natív eseménysor dragstart után pointercancel eseményt tartalmazott. A közös inputadapter ezt feltétel nélkül a teljes húzási munkamenet törlésének tekintette, ezért a dragover már nem fogadta a célt, és drop sem történt. A korábbi mesterséges DragEvent-teszt és a fogantyús pointerteszt ezt az átmenetet nem fedte le.

A `public/app/drag-insert.js` most külön kezeli a natív és a saját pointergesztus tulajdonlását. A dragstart átveszi a munkamenetet; pointercancel csak a hozzá tartozó aktív pointerazonosító gesztusát szakíthatja meg. A natív elhelyezés is a közös fókusz- és státuszvisszajelzést használja. A fixed sorok és a beszúrási tartományszabályok megmaradtak.

Az új `tests/browser-drag.playwright.py` Node és alútvonalas Pages módban mind a négy példát ellenőrzi: forrásból beszúrás és megoldáson belüli rendezés, valódi natív kódszöveghúzás és fogantyús egérmozgatás. Ellenőrzi a pontos sorrendet, a teljes sorhalmaz megőrzését, a fixed sorokat, a beszúrásjelzőt, az idegen pointercancel figyelmen kívül hagyását és a tényleges touchCancel utáni helyreállást. A 36 eset a `test:browser:all` és ezzel a meglévő CI-folyamat része.

A javítás után a `npm run check:all` eredménye **205/205 sikeres Node-teszt**, négy sikeres referenciaaudit és 14 dokumentum ellenőrzése. A `npm run test:browser:all` mind a négy szkriptje sikeres: offline, HTTP, 24 esetű Node/Pages mátrix és 36 esetű húzási regresszió. Naplók: `drag-check-all.log`, `drag-browser-all.log`. Távoli push vagy deployment nem történt.


## Utókövetés – dependencies távolsági szemantikája

A teljes fordítási útvonal ellenőrzése igazolta, hogy a CodeLine dependencies mezője kötelező megelőzést jelent: minden felsorolt sor pozíciója kisebb a függő sorénál. A validátor nem követel közvetlen szomszédságot; a felsorolás sorrendje sem rögzíti az előzmények egymás közötti sorrendjét. Futásidejű módosítás nem kellett.

A `tests/code-line.test.mjs` új regressziója öt sor mind a 120 permutációját ellenőrzi, két eltérő dependencies-tömbsorrenddel, összesen 240 értékeléssel. Mindkét változatban pontosan a 40 helyes elrendezést fogadja el, a közbeékelt független sorokat is; bármelyik előzmény későbbi helyét elutasítja. A teljes `npm run check:all` eredménye **206/206 sikeres Node-teszt**, négy referenciaaudit és 14 dokumentum ellenőrzése; napló: `dependencies-check-all.log`.

A modell dokumentációja konkrét elfogadott/elutasított példákkal és a generátor kezdeti soros függőségi láncának magyarázatával bővült. A fixed, scope, edges és profiles további feltételei továbbra is érvényesek.


## Utókövetés – kötésalapú függőségek és egyértelmű sorazonosság

A kért ipari gyakorlat felé tett változtatás megtartja a CodeLine v2 ID-alapú függőségi DAG-ját, és külön kezeli az eredeti forráshelyet (`sourceLine`) és az aktuális megoldáspozíciót. Teljes forráskódot vagy kódszöveget nem használunk idegen kulcsként: a referencia soronkénti `code` mezője már a szükséges kanonikus tartalom. A függőségek az adott feladatverzióban változatlan sor-ID-kra mutatnak.

A generátor az egymást követő, egysoros, egyszerű primitív const deklarációk között TypeScript szimbólumfeloldással állítja elő a valódi előzményéleket. Két független deklaráció felcserélhető, az őket használó deklaráció mindkettő után, köztes független sorokkal is elfogadható. Hívások, tulajdonságelérések, módosítások, ismeretlen kötések, vezérlési korlátok és explicit erőforráskezelő using/await using deklarációk megtartják a konzervatív sorrendet. A csoportok nem léphetnek át a környező korlátokon. A meglévő modellek és kézzel szerkesztett függőségek importja nem generálja újra vagy lazítja a szabályokat. A full service és mind a 31 metódus regressziója megmaradt.

A sikeres validátorválasz `matchedTokenIds` mezője pozíciónként közli a megbízható referenciatokenekből számított érvényes tanút; kliens által állított ID nem írhatja felül a tartalmi, multiplicitási és gráfvizsgálatot. Azonos kódsoroknál több helyes tanú is lehetséges. A saját Adatmodell nézet ID/forráshely/kód/dependencies táblázatot kapott, sikeres ellenőrzéskor pedig a soronkénti megfeleltetés is megnyitható. Rejtett szerverfüggőségeket a riport nem ad ki. A tanulói értékelési útvonal továbbra sem parse-ol vagy futtat kódot.

A végső helyi `npm run check:all` **235/235 sikeres Node-tesztet**, négy referenciaauditot és 14 dokumentum ellenőrzését adta. A teljes böngészős kör sikeres: offline, HTTP, immár **28 esetű** Node/Pages mátrix és **36 esetű** drag regresszió. A négy új mátrixeset JS/TS nyelven és Node/Pages módban végigjárja az automatikus függőségképzést, a köztes sorokat, az ID/forráshely táblázatot, a megfeleltetést és a hibás sorrend elutasítását. Naplók: `binding-check-all.log`, `binding-browser-all.log`; képek: `test-results/dependencies-*.png`. A korábbi szigorú generátorra épülő életciklustesztek most kifejezetten szerző által szigorított modellt használnak, így az eredeti szigorítás/lazítás tesztcél megmaradt. Távoli push vagy deployment nem történt.


## Utókövetés – a képi függvény teljes permutációs és beágyazási auditja

A felhasználó által kért soronkénti levezetés a tesztek előtt elkészült: `docs/evaluate-ordering-analysis.md`, `tests/fixtures/evaluate-ordering.js`, `tests/fixtures/evaluate-ordering.model.json`. Minden sor szerepe, adatfüggősége, scope-/return-korlátja külön rögzített. A c sor a és b ID-jától, a return c és note ID-jától függ; a nyitó/záró határokat a scope-szerződés érvényesíti. A független note szabadon helyezhető el a négy deklaráció között. A hét sor összes **5040** permutációját a kézi és generált modellel, független Acorn AST-scope-vizsgálattal és a rögzített fixture tényleges JavaScript-futtatásával ellenőriztük: **pontosan nyolc** érvényes sorrend. A korábbi generátor már ezt a lapos esetet is helyesen osztályozta; itt a redundáns szintetikus előzmények csökkentek.

A javítás előtti tesztek tényleges hibát mutattak a külső konstansokat olvasó belső deklarációknál: szükségtelen soros előzmény miatt helyes beágyazott sorrendeket elutasított a generált gráf. Napló: `ordering-red.log`. Az új `src/author/statement-ordering.mjs` scope-onként kompozicionális utasításgráfot képez. Megkülönbözteti a tiszta primitív inicializálást, a valódi kötésolvasást, az összetett blokk be-/kijáratát és az óvatos hatás-/vezérlési korlátokat. Külső scope-konstansok és shadowing szimbólumazonosság alapján oldódnak fel. Egyszerű primitív let inicializálások is lehetnek függetlenek, de módosítható értékek olvasását nem tekintjük állandónak. With esetén a forrás sorrendje marad. A ténylegesen olvasott előzmények megmaradnak, csak redundáns szintetikus élek csökkennek. Az importált/kézi modellek szabályait nem generáljuk újra.

Külön validátorhiba-reprodukció: kilenc testvérblokk hibás egymásba helyezése az azonos `}` tokenek keresése miatt 2000 állapotnál indeterminate eredményt adott (`ordering-pruning-red.log`). A már hozzárendelt összefüggő prefix scope-ellenőrzése most a helyrehozhatatlan ellentmondást korán kizárja; a regresszió 100 állapot alatti elutasítást követel. A valóban nem eldönthető esetek továbbra is indeterminate eredményűek.

A háromszintű fixture **240** belső sorrendjét és **289 forrás/cél pozíciópárját** is vizsgáljuk. További fix programok: let deklaráció, olvasás/írás és compound assignment, hívási sorrend, if, shadowing, beágyazott függvény, ciklus, throw/catch/finally, with. Az elfogadott kódok futásidejű eredményének/hatássorrendjének azonossága és a konzervatív hívási szerződés két külön tesztfeltétel. Ismeretlen hívást más, vele egy listában szereplő utasítás sem léphet át automatikusan; ezt a kért részletes dokumentáció példákkal kifejti. Nem állítunk teljes szemantikai ekvivalenciabizonyítást minden tetszőleges JS-programra.

A teljes helyi `npm run check:all` eredménye **248/248 sikeres Node-teszt**, négy referenciaaudit és 15 dokumentum ellenőrzése (`ordering-check-all.log`). A teljes `npm run test:browser:all` sikeres: offline, HTTP, **32 esetű** Node/Pages mátrix és **36 esetű** húzási regresszió (`ordering-browser-all.log`). A négy új böngészős eset három szinten, JS/TS × Node/Pages kombinációkban ellenőrzi a megengedett sorrendet, a kiértékelési ID-megfeleltetést és a tiltott scope-kimozgatást. A 31 service-metódus és a teljes 436 soros TypeScript-regresszió is megmaradt. A VM-futtatás kizárólag előre rögzített, korlátos tesztfixture-ökre vonatkozik; a tanulói értékelési útvonal továbbra sem futtat és nem parse-ol kódot. Push vagy deployment nem történt.


## Utókövetés – munkafolyamat-központú UI/UX és AI governance

A felhasználói cél alapján két szerzői bemenet kapcsolódik egy közös próbaállapothoz: **Forráskód** (beillesztés, JS/TS-fájlfeltöltés, formázás, alkalmazás) és **Adatmodell** (közvetlen JSON-szerkesztés, import/export, alkalmazás). A négy meglévő minta továbbra is elérhető. A sikeresen alkalmazott forrás teljes szerkeszthető modellt ad; az alkalmazott JSON a forrásnézetet is frissíti. A forrás újragenerálása felülírja az előző kézi modellszabályokat; ezt a felület jelzi. Az import és az alkalmazás továbbra is az eredeti séma-, referencia- és admission-kapun halad át.

A Rendező az aktív próbálkozást mutatja; a Kódszerkesztő draftja nézetváltáskor megmarad, és alkalmazás után ugyanebben a rendezőben ellenőrizhető. A még nem alkalmazott szerkesztő mellett nincs eleve blokkolt Ellenőrzés gomb. A kapcsolódó másolás/beillesztés műveletek a megfelelő objektumhoz kerültek; az ismétlődő megoldásmásoló gomb egy vezérlővé egyesült. A mentés külön eszközcsoport. A státusz gépelés közben frissül, a műveleti foglaltság megelőzi a dupla kiértékelést, a nézetváltás és render megőrzi a fókuszt és a szerkesztési állapotot.

A Tanulói preview ugyanazt a megoldói rendezőt/szerkesztőt és kiértékelést használja, szerzői szabályok, mintakitöltés és technikai megfeleltetési táblák nélkül. Ez prezentációs elkülönítés: nem új jogosultsági rendszer és nem hiteles vizsgacsatorna. A Trusted Server / Local Demo / Preview Validation bizalmi szerződések megmaradtak. Reszponzív sötét felület, fókuszjelzés, manuális billentyűzetes tabváltás, Ctrl/Cmd+Enter, érintési célméretek és csökkentett mozgás támogatás készült. A részletes folyamatok: [UI/UX](ui-ux-workflows.md).

Az új prezentációs implementáció a src/workbench strict TypeScript forrásaiból fordul; a hozzá tartozó nyolc böngészős JS-fájl generált kimenet. Az AGENTS.md, az [AI governance](ai-governance.md) és az [ADR-001](adr/001-typescript-workbench-and-boundaries.md) rögzíti a megőrzendő üzleti és architekturális szerződéseket, Ousterhout információrejtési és kis felületű, mély modulokra vonatkozó megközelítését, valamint a döntések tulajdonosait. Új natív TS-kapu ellenőrzi az importirányokat, tiltott végrehajtási műveleteket, kézi any/ts-ignore használatot, a legacy-leltárt, a generált fájlok forrásazonosságát és a governance dokumentumok helyi linkjeit. A kohézió és modulmélység emberi felülvizsgálatot is igényel. Nincs runtime AI vagy új külső kódküldés.

P0–P2 elkészült. A teljes repo nem TypeScript: P3 a régi üzleti frontend, P4 a szerzői elemzés és szerver, P5 a formatter és buildeszközök fokozatos migrációja. A sorrend és a portok kiváltása az ADR-ben rögzített, ezek továbbra is nyitott munkák.

Végleges helyi ellenőrzés: **259/259 sikeres Node-teszt**, négy referenciaaudit, 17 UTF-8 dokumentum és helyi linkjeik, továbbá 51 production fájl / nyolc TS-forrásgazdájú böngészőmodul architektúrakapuja. A teljes öt szkriptes böngészős kör sikeres: offline, HTTP, **32** Node/Pages mátrixeset, **36** húzási eset és **16** új munkafolyamat-eset. Az új kör mindkét kiszolgálási módban vizsgálja a modellből és forrásfájlból indulást, a két szerzői nézet egyezését, a preview-visszatérést, a draftmegőrzést, a billentyűzetet, fókuszt és a helyi másolást; külön vizsgálja az aszinkron duplaküldés-védelmet és a 320/390/768px mobilnézeteket. A npm audit ismert sérülékenységeinek száma **0**. Naplók: ui-final-node.log, ui-final-browser.log. Vizuálisan ellenőrzött képek: test-results/ux-node-workspace.png, ux-node-author.png, ux-model.png, ux-editor.png, ux-learner.png, ux-mobile-320.png.

Két tesztinfrastruktúra-pontosítás: a hosszú lista scrolltesztje a tényleges sormagasság alapján választ látható sort, így a nagyobb célméret nem okoz Playwright-féle automatikus görgetést. A rögzített fixture-ök VM-orákuluma 1000ms korlátot használ, és a timeoutot infrastruktúrahibaként továbbdobja; nem téveszti szemantikai elutasításnak. Production futtatás vagy validációs budget nem változott. Távoli push vagy deployment nem történt.


## Kiadás előtti review – üzleti szerződés és javítások

A felhasználó kifejezetten kérte a dokumentáció, üzleti működés, validáció, alapmodell, behúzás, sorrendezés és sorhelyrögzítés átfogó ellenőrzését a commit/push/main egyesítés előtt. A fenti korábbi szakaszok történeti állapotok; a fixed horgonyéleire vonatkozó korábbi leírásokat az alábbi pozícióalapú javítás váltja fel.

### Talált és javított eltérések

- **Fixed túlkorlátozás:** a horgonyélek a rögzített sor abszolút helyén túl a többi sort az eredeti oldalukhoz kötötték. A független 120 permutációs teszt ezt reprodukálta (review-fixed-red.log). Most a belső fixedPosition csak a rögzített token helyét korlátozza; pontosan a 24 változatlan középső fixed helyű sorrend elfogadott. A külső CodeLine v2 JSON nem változik. Ütköző és érvénytelen belső pozíciók, 500 rögzített sor, duplikált kódtartalomhoz tartozó tanú és érthető hibavisszajelzés külön tesztelt. [ADR-002](adr/002-fixed-positions.md).
- **Fixed melletti fel/le gomb:** a fizikai szomszédra célzás helyett a legközelebbi mozgatható sorhelyre céloz. A közös attempt beszúrási algoritmus változatlan, a rögzített helyet nem módosítja. Node/Pages böngészőteszt ellenőrzi a fixed túloldalára rendezést és az elfogadást.
- **Késői formázás:** a késleltetett válasz felülírhatta a közben továbbírt kódot; a böngészős reprodukcióban newer helyett outdated forrás jelent meg (review-race-red.log). Natív TypeScript állapotőr ellenőrzi a DOM-szerkesztőt, szöveget, feladatot, nézetet, nyelvet, próbálkozást és generációt. Késői siker és hiba csak a hozzá tartozó változatot érintheti. A késői értékelési hiba szintén nem írhat az újabb próbálkozás riportjába.
- **Dokumentált formázási út:** pontosítottuk, hogy a teljes Formázás külön művelet; az Alkalmazás nem formázza át hallgatólagosan a forrást. Az élő behúzás vizuális projekció és nem a tanulói értékelés bemenete.
- **Reprodukálható build:** a Pages compiler a lockfile alapján telepített helyi csomagból származik; a globális npm-fallback megszűnt. A kihasználatlan formatter-importokat eltávolítottuk.

### Dokumentáció és review terjedelme

Az [üzleti és technikai működési szerződés](business-technical-contract.md) összeköti a felhasználói célt, a két szerzői adatút és a tanulói kiértékelés különbségét, a modellmezők pontos jelentését, AND/OR és tetszőleges távolságú függőségeket, a tartalmi bijekciót, beágyazott scope-ot, fixed abszolút helyet, beszúrást, Tab/Shift+Tab jelenlegi öt szóközös működését, explicit formázást és az élő behúzást. Tartalmazza a draft/mentés/preview határait, felelősségeket és a követelmény–forrás–teszt megfeleltetést.

A README, architektúra, modell-életciklus, biztonsági, validációs, formatter-, UI/UX-, teszt- és deployment-leírás egyeztetve. A governance és mindkét ADR linkellenőrzött. A vizsgálat a kézi production változásokat, generálási forrásgazdákat, külső csomaglicenceket, HTTP/Pages trust határt és CI artifactláncot is lefedi. Az ismert credential-minták publikálandó fájlokon végzett ellenőrzése nem talált egyezést; ez nem teljes titokkeresési bizonyítás.

A teljes TypeScript-migráció P3–P5 lépései továbbra is nyitottak. A tanulói preview prezentációs elkülönítés, a strukturális validáció nem teljes szemantikai bizonyítás; a projektlicenc tulajdonosi döntése nincs önkényesen pótolva. Ezek dokumentált meglévő határok, nem teljesített képességként feltüntetett funkciók.

### Végleges helyi kapuk és kiadási nyom

A végleges helyi Node-kör **265/265 sikeres teszt**, négy referenciaaudit, 18 UTF-8 root/docs dokumentum és helyi linkjeik; az AGENTS és rekurzív ADR-dokumentumok a governance-kapuban külön ellenőrzöttek. Az architektúrakapu 51 production fájlt és nyolc TypeScript-forrásgazdájú böngészőmodult vizsgál. Npm audit: **0 ismert sérülékenység**.

A teljes böngészős kör öt szkriptből áll: offline, valódi HTTP, **32** Node/Pages mátrixeset, **36** valódi húzási eset és **21** workbench folyamat. Az első teljes kiadás előtti naplók: premerge-check-all.log és premerge-browser-all.log. Az utolsó Unicode-prefix javítást is tartalmazó végső kör: unicode-review-node.log és unicode-review-browser.log. A távoli PR/CI és az egyesítés konkrét állapotát a Git/GitHub kiadási nyom rögzíti; a korábbi szakaszok „nem történt push/deployment” megjegyzései a helyi audit akkori lezárására vonatkoznak.


Utolsó tartalmi review: a trimStart a vezető nem ASCII whitespace-et is eltávolította, miközben a validátor csak ASCII szóköz/tab előtagot normalizál. A regresszió JS és TS, Beautify és lexikai utak mellett NBSP/EM SPACE/BOM előtagokkal reprodukálta a veszteséget (review-unicode-red.log). A két meglévő formatter-kifejezés a validátorral azonos ASCII-prefixre javult. Így a kirajzolás–másolás–visszaillesztés nem változtatja meg ezt a tartalmat. Az öt fő commit után ez külön, hatodik javító commitként követhető, a felhasználó által kért kiadás részeként.


Az első távoli Linux CI a Node- és architektúrakapun átment, majd a Playwright fullscreen-várakozásán CSP EvalError hibát jelzett (Actions run 40090680405). Az expression-string alak implicit evalt igényelt az ottani Chromiumban. A három wait_for_function feltétel explicit JavaScript függvénnyé alakult; a szerver script-src self CSP-je változatlan. Ez külön tesztinfrastruktúra-javító commit, és nem a produkciós biztonsági szabály lazítása. A teljes Windows kör mellett a végső GitHub CI bizonyítja a Linux kompatibilitást.
