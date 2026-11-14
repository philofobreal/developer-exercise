# ADR-149 – Technológiajelölés: minden feladat megnevezi a nyelvét és annak verzióját, mérve (NY-44, NY-45, G1)

Állapot: **elfogadva** (2026-11-14). A [közös terv](../terv-korpusz-es-verziok.md) G1 lépése; a felhasználó jóváhagyta („jóváhagyom mind a hét ajánlást, mehet a G1”). Kockázati osztály: mag (séma, modell), szerzői elemzés (új mérőmodul), példák. A szabályverzió nem változott (`scoped-effect-analysis-v57`): a jelölés címke, az értékelés nem olvassa.

## Kontextus (mérve 2026-11-14-én)

- **A feladatról csak a nyelve látszott** (JavaScript vagy TypeScript). Hogy melyik kiadás elemeit használja, azt sem a szerző, sem a tanuló nem tudta meg, és keresni sem lehetett rá.
- **A felhasználó kérése:** minden feladat nevezze meg a technológiáit verzióval, feladatkészítéskor és kereséskor is, és ezt a már elkészült feladatok is kapják meg.
- **A 16 szállított feladat a mérés szerint:** 13 az ES2015, egy-egy az ES5, az ES2018 és az ES2020 elemeit használja; a négy TypeScript-feladat a TypeScript 1.0 és 2.0 elemeit.

## Döntés

- **Új, elhagyható mező a modellben:** `technologies`, a `level` ([ADR-101](101-exercise-levels.md)) mintájára. Elemei `{ id, version }` párok.
  - Az `id` zárt készletből való; most `ecmascript` és `typescript`. Új technológia (RxJS a G8-ban) a séma felsorolásának bővítése.
  - A `version` pontozott szám (`2020`, `4.9`, `7.8.2`).
- **A verzió jelentése a nyelveknél:** a legújabb elem, amelyet a kód használ.
  - `ecmascript`: a kiadás éve; `5` minden, ami az ES2015-nél régebbi.
  - `typescript`: a kiadás száma; `1.0` minden, ami annál régebbi.
- **A jelölést a szerzői elemzés méri,** nem a szerző írja be:
  - a szintaxist a forrás saját fájából, táblázat alapján (nem a lefordított kódból);
  - a szabványos könyvtár elemeit a típusellenőrző feloldásából: a deklaráló könyvtárfájl neve adja a kiadást (`lib.es2023.array.d.ts` → 2023);
  - a TypeScript segédtípusait (`Partial`, `Omit`, `NoInfer`…) név szerint, ha a név a könyvtáré.
- **Minden szerzői befogadás újra mér.** A kérésben vagy az importált modellben érkező jelölés nem marad meg: a szerver és a Local Demo a feladat soraiból számolja ki.
- **A lista viszi a jelölést** (szerver és Local Demo), a szint mellett.
- **A 16 szállított feladat megkapta a jelölést,** a saját soraiból mérve. A sorok, a szabályok és a revízió nem változtak.
- **A mag ellenőrzi a formát:** a séma az alakot, a modell befogadása azt, hogy egy technológia csak egyszer szerepel.

### Ami ebben a lépésben nincs

- **Felület nincs:** jelvény, szűrő és összesítő a G2, bemutatóval.
- **A szerző felső határa** („legfeljebb ES2020”) a G4-gyel jön, amikor az első kapu könyvtára választható lesz.
- **Library és framework** (RxJS, Angular) a G8-tól: ott a verzió a típuscsomagé, amellyel a kód ellenőrizve van.

## Korlátok (jegyzék: NY-54)

- **Amit a fa nem mutat, azt a mérés nem látja:** a típusellenőrző viselkedésében megjelenő újdonságot (például a TypeScript 5.5 kikövetkeztetett típusőrét).
- **Típus nélküli fogadón a metódus neve dönt** (`function f(xs) { return xs.toSorted(); }`): a legrégebbi kiadás, amely ilyen nevű tagot deklarál. Ez alsó becslés; ha a forrás maga ad ilyen nevű tagot egy objektumának, a név nem számít.
- **Szabványos könyvtár nélkül** (a Local Demo sikertelen letöltése) csak a szintaxis mérhető: alsó becslés.
- **A dekorátor a régi (kísérleti) mód szerint számít** (TypeScript 1.5), mert az első kapu ma így ellenőrzi; a szabványos dekorátor (5.0) a G4-gyel különül el.
- **A fordító még nem számozott könyvtárfájljai** (`lib.esnext.*`) táblázatból kapnak kiadást (ES2025: halmazműveletek, iterátor-segédek, `Promise.try`, `Float16Array`); ami a táblában nincs, a következő kiadásnak (2026) számít. A G4 fordítóváltása után ezek nagy része számozott fájl lesz.
- **A jelölés nem bizonyítja, hogy a kód egy régi környezetben fut.** Azt mondja meg, melyik kiadás elemeit használja.
- **Nem vizsgált szintaxis:** a paraméterlista záró vesszője (ES2017), a hashbang (ES2023), az ismétlődő nevű csoport a reguláris kifejezésben (ES2025).

## Két terv („design it twice”)

A jelölés helyére:
1. **Szabad címkék** (`tags: string[]`). Elvetve: a verziók nem összehasonlíthatók, elgépelés ellen nincs védelem.
2. **Jelölés a katalógusban, a feladaton kívül.** Elvetve: az exportált vagy importált feladat elveszítené.
3. **Mező a modellben, zárt készlettel, mérve (választott).**

A mérés helyére:
1. **A generátorban.** Elvetve: a generátor a sorrendről szól; a könyvtár olvasója infrastruktúra, amelyet a generátor ma nem kap meg.
2. **Az ellenőrzés (reference-audit) eredményének mezőjeként.** Elvetve: az ellenőrzés a választott könyvtár alatt mond ítéletet, a mérés a legújabb könyvtárral dolgozik; két külön tudás, és az ellenőrzés eredménye a kliensre és a bizonyítékba is eljut.
3. **Külön modul a szerzői elemzésben, az ellenőrzés mellé bekötve (választott).**

## Tervezési review (docs/design-review.md)

- **A mag `technology` modulja elrejti** a verziók sorrendjét (`4.10` újabb, mint `4.9`) és azt, mikor jól formált egy lista. Interfésze: a `Technology` típus, `compareVersions`, `newerVersion`, `technologiesProblem`.
- **A szerzői `technology-profile` modul elrejti** a szintaxis–kiadás táblát, a könyvtárfájl–kiadás megfeleltetést, a típus nélküli fogadó névalapú szabályát és a saját nevek kivételét. Interfésze egy gyár és egy függvény: `createTechnologyProfiler(fordító, könyvtár).profile(forrás, nyelv)`. A hívók semmit nem tudnak a táblákról.
- **A könyvtár portja közös az ellenőrzéssel** (`LibraryPort`): a szerver és a Local Demo egy olvasót ad mindkettőnek. A szerveren ezért az olvasó külön metódust kapott (`library()`), a Local Demóban külön függvényt (`libraryPort`).
- **design, rögzítve:** a gyorsítótárazott könyvtárfájlok kétszer élnek a memóriában (az ellenőrzésé és a mérésé), mert a két modul más célverzióval olvassa őket. Közös gyorsítótár az `LibraryPort` szélesítése lenne; a mért ár egy feladatra 5–10 ms, az első hívás kb. 200 ms.
- **design, rögzítve:** a `public/app/pages-api.js` (régi JS) két bekötő sorral bővült; a szabály típusos modulban van.
- **Visszavont első változat:** a hívás feloldott túlterhelése szerinti mérés. A próba megmutatta, hogy az `Object.keys({a: 1})` az ES2015-ös könyvtárfájl túlterhelésére oldódik fel, és ES5-ös kódot ES2015-nek jelölne.
- **Javítva útközben:** egy név lehet típus egy régi könyvtárfájlban és érték egy újabban (`interface Promise` az ES5-ösben, a `Promise` konstruktor az ES2015-ösben). A használat dönti el, melyik deklaráció számít; enélkül a `new Promise(…)` ES5-nek mérődött.
- **A mutációs próba két tanulsága:** egy fölösleges feltétel kikerült (a JavaScript-forrás TypeScript-számlálója sosem látszik); egy hiányzó teszt bekerült (függvényen belül deklarált saját típusnév).

## Bizonyíték

- **Egységtesztek** ([technology.test.mjs](../../tests/technology.test.mjs)):
  - a verziók sorrendje; a séma és a mag elfogad, illetve elutasít (11 hibás alak, kétszer megnevezett technológia); a szabályok a jelöléssel és nélküle azonosak;
  - a szintaxis kiadása elemenként (79 sor, könyvtárral és nélküle), köztük hét „annak látszik, de nem az” eset;
  - a könyvtári elemek kiadása (40 sor JavaScriptben és TypeScriptben);
  - a saját nevek kivétele, a típus nélküli fogadó, a könyvtár nélküli mérés;
  - a TypeScript elemei kiadásonként (60 sor);
  - **eltérés-teszt:** mind a 16 szállított feladat jelölése megegyezik azzal, amit a sorai mérnek;
  - a szerver és a Local Demo listája viszi a jelölést; a piszkozat mért; a hamis importált jelölés nem marad meg; a hiányzó megkerül.
- **Mutációs ellenőrzés:** 17 rontás a lefordított és a bekötött fájlokon, mind megbuktatja a teszteket (saját nevek, típus nélküli fogadó, számozatlan könyvtárfájlok, dekorátor-metaadat, TypeScript-mező, nem rögzítő csoport, felső szintű `await`, a legrégebbi deklaráció, típus és érték, kétszer megnevezett technológia, szöveges verzió-összevetés, megtartott importált jelölés és a lista a szerveren és a Local Demóban).
- **Teljes kör:** `npm run gate` (mag és szerzői elemzés: a teljes regresszió), változatlan alapszinttel.
- **Méret:** a Local Demo könyvtárcsomagja 1,94 MB-ról 2,05 MB-ra nőtt (a legújabb könyvtár fájljai); lustán töltődik, mint eddig ([ADR-113](113-local-demo-standard-library-and-source-check.md)).
