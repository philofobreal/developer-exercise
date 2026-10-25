# ngDynamic CodeLine – Developer Exercise

Keretrendszer nélküli feladatkészítő és kódsorrendező, strict TypeScript strukturális validátorral és új prezentációs réteggel, valamint Node.js backenddel. A korábbi üzleti modulok egy része még JavaScript/MJS; átállásukat külön migrációs terv rögzíti. Angular-függőség nincs. Az eredeti [ngDynamic](https://github.com/philofobreal/ngDynamic) oktatási koncepciójára épül.

- Repository: [philofobreal/developer-exercise](https://github.com/philofobreal/developer-exercise)
- A GitHub Pages célcíme: [statikus demó](https://philofobreal.github.io/developer-exercise/)
- [Üzleti és technikai szerződés: modell, validáció, Tab, behúzás, beszúrás és fixed](docs/business-technical-contract.md)
- [Auditjelentés és taskstátuszok](docs/audit-report.md), [változások](CHANGELOG.md)
- [Language IR v1 / CodeLine v3: migrációs terv és Python-handoff](docs/language-engine-migration.md), [szerződések és használat](docs/language-engine-contract.md). Az alap opt-in könyvtári API; Python parser/adapter és v3 UI/persistence még nincs implementálva.
- [Python-adapter részletes megvalósítási terve](docs/python-adapter-plan.md): parser/platform, IR-leképezés, termékintegráció, taskfüggőségek és tesztkapuk; az első parser-szelet elkészült, a natív adapter és a termékbekötés nyitott.

## Helyi használat

Node.js 20+ szükséges; a CI Node.js 22-t használ. A függőségek verzióját a lockfile rögzíti.

```sh
git clone https://github.com/philofobreal/developer-exercise.git
cd developer-exercise
npm ci
npm run check:all
npm start
```

Alapértelmezett cím: `http://127.0.0.1:5173/`. Ha a port foglalt, az indítás legfeljebb tíz egymást követő portot próbál, és kiírja a tényleges címet (például `http://127.0.0.1:5174/`). A `HOST` és `PORT` környezeti változóval felülírható; kifejezetten megadott `PORT` esetén nincs automatikus váltás. A telepítés után a formázó, Prism és szerver helyben működik; CDN nem szükséges.

## Szerzői folyamat

1. A **Referenciaforrás** nézetben adj meg teljes, helyes JavaScript- vagy TypeScript-forrást. A külön Formázás gombot a nyelvi adapter és a TypeScript Language Service szolgálja ki; az Alkalmazás nem formázza át hallgatólagosan a forrást.
2. Az **Alkalmazás → Rendezés** AST-alapú, kezdetben sorrendhű modellt készít. A teljes `CopyFieldUtilityService` a TS-minta gombbal betölthető.
3. Az **Adatmodell** nézetben módosíthatók a `dependencies`, `edges`, `profiles` és más szerzői szabályok. A `dependencies` valamennyi kötelező előzményt jelenti, nem közvetlen szomszédot.
4. A modell csak sémaellenőrzés, strukturális fordítás, JS/TS-szintaktikai audit és a referenciasorrend önellenőrzése után válik aktívvá. Hibánál a korábbi aktív állapot megmarad.
5. Dependency-only módosításnál a kitöltés megmarad, és automatikusan újraértékelődik.

A deklaráció/használat-jelzések lexikai kötéseken alapuló szerzői támpontok. Nem bizonyítanak mellékhatásmentességet vagy szemantikai felcserélhetőséget. Az alternatív megoldások ellenőrzése és hitelesítése szerzői felelősség.

## Rendezés és formázás

A sorok beszúrással mozognak; a köztes elemek eltolódnak. A rögzített sorok a referenciahelyükön maradnak; a többi sor átléphet a két oldaluk között, ha más szabály nem tiltja. Használható natív drag & drop, pointer/érintés, a fel/le gombok, illetve a mozgatófogantyú billentyűzetes vezérlése: **szóköz/Enter → nyilak/Home/End → Enter**, megszakítás: **Escape**.

A részleges, akár hibás JS/TS-kód vizuális behúzása öt szóközzel követi az aktuális sorrendet. Minden bemeneti elemhez egy megjelenített sor tartozik; ID és valódi tokentartalom nem változik. Regexek, stringek, kommentek és template-interpolációk külön lexikai állapotot kapnak. Az `exact` sorok és a többsoros literálok payloadja változatlan marad.

A JS Beautify 1.13.13 eredeti konfigurációja és `_____code_line_end_;` jelölős algoritmusa a JS-előnézet tanácsadó rétege. A TypeScriptet és a whitespace-érzékeny literálokat a lexikai réteg védi; bizonytalan sorhatár vagy formatterhiba kontrollált fallbacket eredményez. [Részletes formatter-szerződés](docs/modularitas-es-elobehuzas.md).

## Vágólap

A forráskód-, megoldás- és JSON-szerkesztőben másolás és beillesztés gomb található. A rendező Megoldás panelje közvetlen másolást/beillesztést, a forrássorok panelje másolást kínál. A szerzői kód és modell beillesztése nem aktivál automatikusan új feladatot; a rendezőbe illesztés a fixed sorok és sorpozíciók domainellenőrzésén megy át. A gombok sikert vagy hibát jeleznek, a böngésző olvasási tiltásánál a kézi Ctrl+V/⌘V használatát ajánlják.

## Mentés

- Az **Adatmodell** nézetből **JSON export/import** érhető el; új feladat közvetlenül JSON-ból is indítható.
- **Munkamenet export/import**: a kitöltés és saját feladat esetén a szerzői modell is menthető.
- **Helyi mentés/visszatöltés**: kifejezett felhasználói művelet, az adott böngésző localStorage tárhelyén. Újratöltés után a visszatöltés gombbal állítható helyre.
- Hiteles szerverfeladat importja csak a szerver által kiadott azonosítóhoz és verzióhoz tartozó próbálkozást állítja vissza. Kliensoldali szabályt vagy korábbi értékelési jelentést nem emel hiteles forrássá.

## Ellenőrzések

```sh
npm run check:all           # build, minden Node-teszt, négy referenciaaudit
npm run verify:pages        # külön, célzott Pages-build és artifacttesztek
python -m venv .venv
```

A virtuális környezet aktiválása után:

```sh
python -m pip install -r tests/requirements-browser.txt
python -m playwright install chromium
npm run test:browser:all
```

Windows PowerShell alatt az aktiválás: `.\.venv\Scripts\Activate.ps1`; POSIX shellben: `. .venv/bin/activate`. Windows alatt a meglévő Chrome/Edge is használható. A `CHROMIUM` változóval konkrét böngészőútvonal adható meg. Linux CI-ban a workflow `playwright install --with-deps chromium` parancsot futtat.

A böngészős kör valódi HTTP-alapú Node- és alútvonalon kiszolgált Pages-teszteket, valamint kiegészítő offline DOM-tesztet tartalmaz. A `npm run test:browser:drag` külön is futtatja a négy beépített példa valódi kódszöveg- és fogantyúhúzásait, továbbá a pointermegszakítás regresszióit (36 eset). Ez a kör a `test:browser:all` része is. Képernyőképek és Playwright trace: `test-results/`. A tesztek pontos értelmezése: [TypeScript- és tesztlefedettség](docs/ts-method-regression.md).

## Feladatkészítés, próba és preview

A könyvtárban a meglévő minták és a saját előnézeted érhető el. A **Referenciaforrás** nézetbe JS/TS fájlt tölthetsz be vagy kódot illeszthetsz; az **Adatmodell** nézetből közvetlen JSON-nal is indulhatsz. Alkalmazás után ugyanaz a rendező és kiértékelés teszteli a feladatot. A **Tanulói preview** a megoldói eszközöket mutatja, szerzői szabályok és mintakitöltés nélkül. A draftok nézetváltáskor megmaradnak. [Részletes UI/UX munkafolyamat](docs/ui-ux-workflows.md).

Az új felület és governance-ellenőrzés strict TypeScriptben készült. A régi JS/MJS modulok további migrációja külön, rögzített lépéssor: [AI governance](docs/ai-governance.md), [architekturális döntés és prioritások](docs/adr/001-typescript-workbench-and-boundaries.md). `npm run check:all` az architektúrakaput is futtatja; az új UI-kör külön: `npm run test:browser:workbench`.

## Függőségek és sorazonosság

A **Referenciaforrás → TypeScript példatár** 24 letölthető forrást és modellt kínál: interface/type/declare mezők, constructor, setter, öröklés, computed/static/private tagok, overloadok, kommentek, whitespace, fixed és profilok. A [UserAccount-eset elemzése és a tesztmátrix](docs/typescript-ordering-analysis.md) megmutatja, miért cserélhetők a típusmezők, és miért maradnak sorrendtartók a megfigyelhető class-műveletek. A pontos képi sorrendhez külön, explicit name/id érték szerinti kézi modell is letölthető.

Régi, soros függőségekkel exportált JSON-hoz az **Adatmodell → Sorfüggőségek újraszámítása** explicit művelet használható. A normál import megőrzi az összes szabályt. A [képen szereplő evaluate-esethez](docs/evaluate-legacy-serial-case.md) külön magyarázat és importálható javított JSON készült. A teljes fejlesztés technikai és dokumentációs felülvizsgálata: [review és javítások](docs/review-language-engine-python.md).

A `dependencies` az előzménysorok állandó ID-jait tartalmazza: mindegyiknek korábban kell állnia, tetszőleges távolságra. A generátor scope-onként alakítja gráffá a tiszta primitív deklarációkat, a külső konstanskötéseket is feloldva; a hatásoknál és vezérlésátadásnál konzervatívan megőrzi a sorrendet. A képi példa összes 5040 sorrendjéről, a beágyazásról és a hívási korlátról külön [soronkénti elemzés](docs/evaluate-ordering-analysis.md) készült. A saját modellben lenyitható ID/forrássor/kód/előzmény táblázat segíti a szerkesztést; sikeres ellenőrzés után külön táblázat mutatja a kiértékelő által talált soronkénti megfeleltetést. A `sourceLine` tájékoztató forráshely, nem azonosság. Részletek és korlátok: [validációs modell](docs/validacios-modell-es-formazas.md).

## Kiadás és bizalmi határ

Az eddigi szakaszok, az összes ág review-ja és a kész/nyitott határ: [fejlesztési összegzés és integráció](docs/development-summary-and-integration.md).

A Python-integráció első könyvtári szelete külön author parserport: rögzített CPython, izolált Node-folyamat/worker és közös edge-case korpusz. Python-feladatgenerálás és UI még nincs. [Implementált határ és ellenőrzések](docs/python-parser-platform.md), [teljes taskterv](docs/python-adapter-plan.md). Célzott ellenőrzés: `npm run test:python`, majd `npm run test:browser:python`.

`npm run build:pages` a publikálható statikus demót az `_site/` mappába készíti. A **Local Demo / Preview Validation** a böngészőben fut, eredménye nem hitelesített vizsgaeredmény. A **Trusted Server Validation** a Node-szerveren tárolt szabályokat használja, tanulói kódot nem futtat és nem parse-ol. A saját szerzői előnézet egyik üzemmódban sem hiteles vizsgacsatorna.

A projekt nem tartalmaz bejelentkezési rendszert vagy üzemi jogosultságkezelést. Éles vizsgaszolgáltatáshoz ezeket a [biztonsági szerződés](docs/security.md) szerint külön kell biztosítani.

A CI egyszer teszteli és építi a kiadást; a sikeresen ellenőrzött artifact kerülhet a Pages deploy jobhoz. [Deployment-leírás](docs/github-pages.md). A helyi audit nem indít távoli publikálást.

További dokumentáció: [architektúra](docs/architecture.md), [matematikai modell](docs/validacios-modell-es-formazas.md), [nyelvi adapterek](docs/language-adapters.md), [modell-életciklus](docs/v7-integracio-es-modell-szerkesztes.md), [JSON Schema](docs/schema.json), [harmadik fél licencei](docs/vendor.md), [hiányzó projektlicenc-döntés](LICENSE-STATUS.md).
