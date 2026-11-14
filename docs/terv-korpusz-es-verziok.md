# Terv: verzióhoz kötött JS-, TS- és RxJS-anyag egy fában (NY-44, NY-45)

Állapot: **jóváhagyva** (2026-11-14): a felhasználó mind a hét ajánlást elfogadta („jóváhagyom mind a hét ajánlást, mehet a G1”), és kérte az előre látható adósságok beütemezését (10. szakasz). Ez kidolgozás: kódváltozás nincs benne. A felhasználó kérései szó szerint a [jegyzékben](nyitott-tetelek.md) állnak (NY-44, NY-45). A terv az [NY-40 tervét](terv-typescript-tananyag.md) magába foglalja: az lesz a TypeScript-ág.

**A terv négy dolgot ad:**
1. **Technológiajelölés:** minden feladat megnevezi, mely nyelvből, libraryből és frameworkből áll, verzióval. A jelölés mért, nem becsült, és a 16 meglévő feladat is megkapja.
2. **Fa a gyakorló listában:** témakör → modul → lecke, a mostani feladatokkal együtt.
3. **Anyag:** 20 JavaScript-, 20 TypeScript- és 8 RxJS-lecke, amelyek a 16 meglévő feladatra és egymásra épülnek. Minden lecke egyben tesztkorpusz.
4. **Eszközlánc:** újabb TypeScript-fordító, újabb szabványos könyvtár az ellenőrzéshez, RxJS-típusok.

A 8. szakasz hét döntését a felhasználó az ajánlás szerint hozta meg.

## 1. Amit a mérés mutat (2026-11-14)

A próbák a munkakönyvtáron kívül futottak, a repóban semmi nem változott. A számok a mai állapotra igazak (`scoped-effect-analysis-v57`, TypeScript 5.8.3, Node 22.23).

### 1.1 A 16 szállított feladat

| | Érték |
| --- | --- |
| Nyelv és szint | JavaScript 12 (5 kezdő, 5 közepes, 2 haladó); TypeScript 4 (1 kezdő, 2 közepes, 1 haladó) |
| Legújabb használt szintaxis | ES2015: 11 feladat; ES5: `grade-ts`; ES2020: `word-count-js` (`??`) |
| Legújabb használt könyvtári elem | ES5: 11 feladat; ES2015: 5 feladat |
| TypeScript-elemek | `abstract`, generikus, `interface`, `implements`, paraméter-tulajdonság; mind TS 1.6 vagy régebbi |

**A korpusz ma lényegében ES2015-ig tart.** A 88 megvizsgált nyelvi és könyvtári elemből 18 fordul elő:

| Kiadás | Előfordul / vizsgált | Ami hiányzik (példák) |
| --- | --- | --- |
| ES2015 | 14 / 32 | sablonliterál, generátor, `import`/`export`, számított kulcs, `Promise`, `Symbol`, `Array.from`, `find`, `startsWith` |
| ES2016 | 1 / 2 | hatványozás (`**`) |
| ES2017 | 0 / 5 | `async`/`await`, `Object.values`, `Object.entries`, `padStart` |
| ES2018 | 1 / 3 | `for await`, `finally` |
| ES2019 | 0 / 6 | `flat`, `flatMap`, `Object.fromEntries`, kötés nélküli `catch` |
| ES2020 | 1 / 7 | `?.`, `BigInt`, `Promise.allSettled`, `matchAll` |
| ES2021 | 0 / 5 | `??=`, `replaceAll`, `Promise.any`, számelválasztó |
| ES2022 | 1 / 8 | `#privát` tag, `static` blokk, `.at`, `Object.hasOwn`, hiba `cause` |
| ES2023 | 0 / 6 | `toSorted`, `toReversed`, `with`, `findLast` |
| ES2024 | 0 / 3 | `Object.groupBy`, `Map.groupBy`, `Promise.withResolvers` |
| ES2025 | 0 / 11 | halmazműveletek (`union`, `intersection`), iterátor-segédek (`take`, `drop`), `Promise.try`, `RegExp.escape` |

**A próba korlátai:**
- A 88 elem válogatás, nem a nyelv egésze. A megvalósítás első lépése a tábla rögzítése forrással (4. szakasz).
- A könyvtári elemeket a próba név szerint kereste. A végleges mérés a típusellenőrző feloldására épül (2.3 szakasz).
- A három osztályos TS-feladat szintaxisa a próbában ES2022-nek látszott. Ez a próba hibája: a paraméter-tulajdonság fordítása osztálymezőt ad. A végleges mérés a TypeScript-fát olvassa, nem a lefordított kódot.

### 1.2 Mit enged át ma az első kapu

| Elem | TypeScript-forrásban | JavaScript-forrásban |
| --- | --- | --- |
| ES2022 (`.at`) | átmegy | átmegy |
| ES2023–ES2025 API (`toSorted`, `Object.groupBy`, `Set.union`) | **hiba** (2550: nincs ilyen tulajdonság) | átmegy, ellenőrzés nélkül |
| `satisfies`, `async`/`await`, generátor, `#privát`, `static` blokk | átmegy | átmegy |
| `using` | **hiba** (2318: nincs `Disposable` típus) | – |
| szabványos dekorátor | **hiba** (1241) | – |

Az ok: az ellenőrzés könyvtára `lib.es2022.full.d.ts`, dekorátornál pedig a régi (kísérleti) szabály szerint ellenőriz. A JavaScript-forrás alapértelmezésben csak kötéseket ellenőriz, ezért ott egy elgépelt metódusnév is átmegy.

**Következmény:** ma nem készíthető TypeScript-feladat ES2023 utáni könyvtári elemmel, `using`-gal vagy szabványos dekorátorral. Ez az NY-40 terv C0 lépésének (b) kérdésére a válasz; a (c) kérdésre részben (a kapu a futtatás előtt megállítja).

### 1.3 Mit futtat az orákulum gépe

A Node 22.23 futtatja: `toSorted`, `findLast`, `Object.groupBy`, `Promise.withResolvers`, halmazműveletek, iterátor-segédek, `Array.fromAsync`, `Symbol.dispose`.

Nem futtatja: `Promise.try`, `RegExp.escape`, `Float16Array`, a `using` szintaxist, a reguláris kifejezés módosítóit, a `Temporal`-t.

**Következmény:** az ES2025 egy része Node 22-n nem igazolható futtatással. A TypeScript `using` lefordítva fut (a segédkódnak csak `Symbol.dispose` kell).

### 1.4 TypeScript: mi a „legújabb”

| Verzió | Megjelent | Használható-e itt |
| --- | --- | --- |
| 5.8.3 | – | ezt használja ma a generátor, az ellenőrzés, az orákulum és a Local Demo |
| 6.0.3 | 2026-04-16 | **igen:** az utolsó, amelynek fordítója JavaScript-könyvtárként betölthető |
| 7.0.2 | 2026-07-08 | **nem:** natív program, betölthető fordítókönyvtár nélkül; böngészőben és a szerver folyamatában nem fut |

- **A terméknek a fordító könyvtárként kell:** a szerzői elemzés a folyamaton belül hívja, a Local Demo a böngészőben futtatja.
- **Mért:** a repó mind az öt fordítási konfigurációja hiba nélkül fordul a 6.0.3-mal (`--noEmit`). A viselkedés (generált szabályok, alapszint) nincs mérve; azt csak a teljes kör mutatja meg.
- **Mért méretek:** a fordító 9,07 MB helyett 9,14 MB. A szabványos könyvtár az ES2025-ös lánccal 1,89 MB helyett 2,94 MB (a Local Demo lustán tölti, [ADR-113](adr/113-local-demo-standard-library-and-source-check.md)).
- **Valószínű (másodlagos forrásból):** a 7.0 nyelve megegyezik a 6.0-éval; a 7.1 hoz új programozható felületet. Ha ez megjelenik és böngészőben is fut, az újabb váltás külön döntés.
- **Az Angular 22 fordítója TypeScript 6.0-t kér** (`>=6.0 <6.1`). A 6.0.3 tehát az Angular-ágnak is előfeltétele.

### 1.5 RxJS: mit tud ma az elemző

Próba: 12 soros program (`of`, `pipe(filter, map, scan)`, `subscribe`), RxJS 7.8.2.

- **Az ellenőrzés eredménye `unverifiable`:** az `rxjs` modul típusai nincsenek meg (2307). A modell elkészül, de a hivatkozásokat senki nem ellenőrizte.
- **A modell majdnem lineáris:** az `of(…)` utáni minden utasítást ismeretlen hívás köt (`effectful-or-unknown-initializer`), a `pipe` sorait a folytatósor-szabály. Egyetlen szabad pár marad (`minimum` és `rate`).
- **Ez helyes, de nem teljes.** A `pipe` operátorainak sorrendje valóban számít. Két független folyam létrehozása viszont felcserélhető lenne: a létrehozás lusta, hatása csak a feliratkozásnak van. Ezt a mai szabályok nem tudják.
- **Az értékelést ez nem érinti:** a tanuló sorrendjét a modell szabályai döntik el, kód nem fut és nem elemződik.

Verziók: `rxjs` 7.8.2 a legújabb stabil (2025-02-22); a 9.0.0-beta.1 előzetes (2026-10-09). A típusleírások 250 fájlban kb. 0,4 MB.

### 1.6 Söprés: 25 próbaprogram a korpuszból hiányzó elemekkel

A felhasználó kérdése: össze lehet-e ma rakni bármilyen szabályos forráskódból olyan feladatot, amely úgy értékel, ahogy a kód a valóságban fut? **A válasz: nem bármilyenből.** A söprés a korpuszból hiányzó elemeket vitte végig a generátoron, az első kapun és az orákulumon (ES2015–ES2025 kiadásonként, aszinkron kód, klasszikus vezérlés, hét TypeScript-program).

| Eredmény | Programok | Megjegyzés |
| --- | --- | --- |
| Nincs hibásan elfogadott sorrend | 21 | minden JavaScript-kiadás ES2015-től ES2025-ig; `async`/`await`, `for await`; `satisfies`, generikusok, leképezett típus, `enum`, osztálytagok, túlterhelés |
| **Valódi hibás elfogadás** | 1 | TypeScript `namespace`: az exportált tagok felcserélhetők, pedig a névtér objektumának kulcssorrendje megváltozik (`["penalty","total"]` → `["total","penalty"]`); futtatva igazolva. A függvények eredménye azonos. Jegyzék: NY-49 |
| Hamis jelzés, az orákulum hibája | 1 | saját osztály `[Symbol.iterator]` taggal: a tanú a saját `Reflect.get` hívását reflexiónak jelöli; a javított tanúval 0 hibás elfogadás. Jegyzék: NY-50 |
| Hamis jelzés, az orákulum túl szigorú | 1 | szabványos dekorátor: az alkalmazás sorrendjét szövegesen hasonlítja; a hatással járó dekorátor tagjait a modell köti (futtatva igazolva). Jegyzék: NY-50 |
| Nem mérhető | 1 | `using`: a Node 22 `vm` környezetében nincs `Symbol.dispose`. A Node 24 valószínűleg megoldja (G4) |

- **Az első kapu három TypeScript-programot állít meg** (`using`, szabványos dekorátor, ES2023 utáni könyvtári elem): 1.2.
- **Teljesség:** a 25 programban 2 mért rés (mindkettő ismeretlen hívás kezdőértékben). A legtöbb programnak kevés elfogadott sorrendje van: az alapértelmezett szigorú bemeneti szerződés mellett az ismeretlen hívások kötnek.
- **Amit ez nem bizonyít:** a söprés 25 kézzel írt program, nem bizonyítás. Egy hiba 25 programból azt mutatja, hogy a korpuszon kívüli elemek rejthetnek továbbiakat; ezért lesz minden lecke korpusz.

## 2. Technológiajelölés

### 2.1 A mező

Új, elhagyható mező a feladat modelljében, a `level` ([ADR-101](adr/101-exercise-levels.md)) mintájára:

```json
"technologies": [
  { "id": "ecmascript", "version": "2020" },
  { "id": "typescript", "version": "4.9" },
  { "id": "rxjs", "version": "7.8" }
]
```

- **Az `id` zárt készletből való:** a G1 óta `ecmascript` és `typescript` ([ADR-149](adr/149-technology-labels.md)); az `rxjs` a G8-ban, az `angular` később kerül bele. Új technológia a séma felsorolásának bővítése (visszafelé kompatibilis).
- **A jelölés címke, nem szabály.** Az értékelés nem olvassa. Importált feladat jelölése megjelenik, de a felület nem tekinti igazoltnak, amíg a szerzői elemzés újra meg nem mérte.

### 2.2 Mit jelent a verzió

| Fajta | A verzió jelentése | Honnan van |
| --- | --- | --- |
| Nyelv (`ecmascript`, `typescript`) | **a legújabb elem, amelyet a kód használ:** ettől a verziótól fut | mért (2.3) |
| Library, framework (`rxjs`, `angular`) | **amelyik verzió típusaival a kód ellenőrizve van** | a szállított típuscsomag verziója |

- A nyelvnél ez egyben a „bemutatott verzió”: a `?.`-t tanító feladat ES2020-as.
- **A szerző lefelé nem, fölfelé csak indokkal térhet el a mért értéktől.** Van, amit a fa nem mutat meg (például a TS 5.5 kikövetkeztetett típusőre a típusellenőrző viselkedése, nem szintaxis). Ilyenkor a lecke leírása nevezi meg a magasabb verziót, és a teszt megköveteli az indokot.
- **A szerző felső határt választhat** („készüljön legfeljebb ES2020-ra, TypeScript 5.4-re”). Az első kapu ekkor a határ könyvtárával ellenőriz, és megnevezi, melyik sor lépi túl. A kérés „verziószámmal kiválasztható” részének ez a megfelelője a feladatkészítésnél.

### 2.3 A mérés (szerzői elemzés)

Új modul a szerzői elemzésben, egy függvénnyel (forrás és nyelv be, technológialista ki). Amit elrejt:
- **Szintaxis:** a TypeScript-fa csomópontjaiból táblázat adja a kiadást (például opcionális láncolás → ES2020; `satisfies` → TS 4.9). A fa a forrásé, nem a lefordított kódé.
- **Könyvtár:** a típusellenőrző minden hivatkozást a deklarációjáig követ. A deklaráció fájlja megmondja a kiadást (`lib.es2023.array.d.ts` → ES2023). Ez pontos, nem névegyezés.
- **Library:** az `import` forrása nevezi meg (`'rxjs'`); a verzió a típuscsomagé.

Korlát, rögzítve: a típusellenőrző viselkedésében megjelenő újdonságot (2.2) a mérés nem látja.

### 2.4 Visszamenőleg

- **A 16 szállított feladat** egy eszközzel kapja meg a jelölést, a forrásából mérve. A szabályok, a sorok és a revízió nem változnak (ahogy az [ADR-147](adr/147-learner-rule-panel-after-a-check.md) közlési szintjénél).
- **Eltérés-teszt:** minden szállított feladat jelölése megegyezik a mért értékkel, vagy indokoltan magasabb. Új feladat jelölés nélkül nem szállítható.
- **A szerző saját feladatai** (piszkozat, mentett vagy importált modell): a jelölés a megnyitáskor és minden újraelemzéskor frissül. Jelölés nélküli importált modell „jelöletlen” címkét kap, amíg a szerző meg nem nyitja.

### 2.5 A felületen

- **Jelvények** a feladat címénél és a listában, a nyelvjelvény (NY-48) mellett: „ES2020”, „TS 4.9”, „RxJS 7.8”.
- **Szűrő** a gyakorló lista fölött: technológia és verzió. Két olvasat van (8. szakasz, 7. döntés): „pontosan ez a verzió” és „ez vagy korábbi”.
- **Összesítő:** mely technológiákból és verziókból áll az összes feladat (technológia × verzió → darabszám), a sorai szűrnek.
- **A szerzőnél:** a Kód lépés mutatja a mért listát, és itt állítható a felső határ.
- A három felületi elem **bemutatóval indul,** két változattal, ahogy a gombrendszernél.

### 2.6 Két terv („design it twice”)

1. **Szabad címkék** (`tags: string[]`). Elvetve: a verziók nem összehasonlíthatók, elgépelés ellen nincs védelem, a „legfeljebb ES2020” szűrés nem írható meg.
2. **Jelölés a katalógusban, a feladaton kívül.** Elvetve: az exportált vagy importált feladat elveszítené, és a szerző saját feladatának nem lenne jelölése.
3. **Mező a modellben, zárt készlettel, mérve (választott).**

## 3. A fa

### 3.1 Honnan jön a szerkezet

**Tananyagjegyzék a katalógusban** (egy fájl: témakörök, modulok, a leckék sorrendje és az „épít rá” kapcsolat), nem mező a feladatban.

- A fa és az előfeltétel a tananyag tudása, nem a feladaté: ugyanaz a feladat önállóan is megáll, importálva is.
- Az NY-40 terv jegyzéke (`buildsOn`) ugyanez az adat; a kettő egy fájl lesz.
- **Elvetett terv:** `series` és `order` mező minden feladatban. A modulok címe és sorrendje minden feladatban megismétlődne, és egy modul átnevezése minden feladat újrakiadását kérné.
- A lista ma is hierarchikus mezőnyilvántartásból rajzol ([fields.ts](../src/workbench/fields.ts)); a csoportokat ma a szint adja. A fa ugyanezt a nyilvántartást tölti fel, mélyebb szerkezettel.

### 3.2 A fa tartalma

```text
JavaScript
  Alapok                 5 meglévő (celsius, greeting, rectangle, even-odd, vowels) + 2 új
  Gyűjtemények           5 meglévő (stats, stats-reduce, profiles, word-count, fib-memo) + 6 új
  Szöveg és számok       2 új
  Null-biztonság, hibák  2 új
  Osztályok              3 új
  Aszinkron              3 új
  Algoritmusok           2 meglévő (algo-bfs, algo-sort-search)
  Záró projekt           2 új
TypeScript
  Ráhangoló              4 meglévő (grade, stack, class-inventory, class-accounts)
  Könyvtár M1–M10        20 új (az NY-40 terve)
RxJS
  Folyamok               8 új
Saját feladatok          ami a jegyzékben nem szerepel, szint szerint, mint ma
```

- **A szint megmarad** jelvényként és szűrőként; a csoportosítást a fa veszi át.
- **Az előfeltétel ajánlás, nem zár:** a lecke megmutatja, mire épít („Előtte: …”), és a megoldott feladat jelet kap. Zárolás nincs; ha kell, az pedagógiai döntés.
- **A fa nézete bemutatóval indul** (két változat: lenyíló ágak egy oszlopban; témakörfülek modul-listával), telefonon is.

## 4. Az anyag

Minden lecke az NY-40 terv 4. szakaszának csomagja: forrás, tanári szöveg, próbák, szándék (kötött és szabad sorpárok). Minden lecke korpusz; szállított feladat csak a mérés és a felhasználó döntése után lesz belőle.

**A lefedettség mérőszáma:** rögzített elemtábla (ES2015–ES2025 és a TypeScript 2.0–6.0 elemei, forrással: az ECMA-262 kiadásai és a TypeScript kiadási jegyzetei). Egy elem akkor fedett, ha legalább egy lecke vagy feladat használja. A jelentés generált; amit a lánc nem tud kezelni, az indokkal áll a táblában, nem marad ki szó nélkül.

### 4.1 JavaScript-ág: „Sportnap” (20 lecke)

Egy futó tartomány: iskolai sportnap eredménytáblája (versenyző, futam, pontszám, ranglista). A meglévő feladatok a modulok elején állnak ráhangolóként.

| # | Modul | Bemutatott kiadás | Mit tanít | Épít rá | Útvonal |
| --- | --- | --- | --- | --- | --- |
| 1 | Alapok | ES2015 | sablonliterál, alapértelmezett paraméter | `greeting-js` | ship? |
| 2 | Alapok | ES2015 | destrukturálás, számított kulcs, rövidített tulajdonság | 1, `rectangle-js` | ship? |
| 3 | Gyűjtemények | ES2016 | `find`, `findIndex`, `includes`, `Array.from` | `stats-js` | ship? |
| 4 | Gyűjtemények | ES2017 | `Object.entries`, `Object.values`, `padStart` (táblázat) | 3, `stats-reduce-js` | ship? |
| 5 | Gyűjtemények | ES2019 | `flat`, `flatMap`, `Object.fromEntries` | 4 | ship? |
| 6 | Gyűjtemények | ES2023 | `toSorted`, `toReversed`, `with`, `findLast`: másolat és helyben módosítás | 5, `algo-sort-search-js` | ship? |
| 7 | Gyűjtemények | ES2024 | `Object.groupBy`, `Map.groupBy` | 6, `word-count-js` | ship? |
| 8 | Gyűjtemények | ES2025 | halmazműveletek, iterátor-segédek (`take`, `drop`) | 7 | ship? |
| 9 | Szöveg és számok | ES2021 | `startsWith`, `repeat`, `**`, `replaceAll`, számelválasztó | 1, `vowels-js` | ship? |
| 10 | Szöveg és számok | ES2020 | `matchAll`, `BigInt` | 9 | ship? |
| 11 | Null-biztonság, hibák | ES2021 | `?.`, `??`, `??=`, `\|\|=` | 2, `word-count-js` | ship? |
| 12 | Null-biztonság, hibák | ES2022 | `try`/`catch`/`finally`, kötés nélküli `catch`, hiba `cause` | 11 | ship? |
| 13 | Osztályok | ES2015 | osztály, getter, `static`, öröklés | 2 | ship? |
| 14 | Osztályok | ES2022 | `#privát` tag, `static` blokk, `Object.hasOwn`, `.at` | 13 | ship? |
| 15 | Osztályok | ES2015 | `Symbol.iterator`, generátor | 13 | corpus |
| 16 | Aszinkron | ES2018 | `Promise` lánc, `finally` | 12 | corpus |
| 17 | Aszinkron | ES2021 | `async`/`await`, `Promise.all`, `allSettled`, `any` | 16 | corpus |
| 18 | Aszinkron | ES2025 | `for await`, `Promise.withResolvers`, `Promise.try` | 17 | corpus |
| 19 | Záró projekt | ES2024 | ranglista: csoportosítás, rendezés, formázás | 4, 6, 7 | ship? |
| 20 | Záró projekt | ES2025 | napi jelentés: osztály, halmazok, hibakezelés | 8, 12, 14 | ship? |

**Indokkal kimarad** (a lánc egy fájlt elemez, és a futás nem lehet véletlenszerű): `import`/`export`, dinamikus `import`, felső szintű `await`, importattribútum, `WeakRef`, `globalThis`. Az elemtáblában „nem fedhető” jelöléssel állnak.

### 4.2 TypeScript-ág: „Könyvtár” (20 lecke)

Az [NY-40 terv](terv-typescript-tananyag.md) 3. szakasza változatlanul. Ami hozzájön:
- a négy meglévő TS-feladat „Ráhangoló” modulként a fa elején;
- minden lecke megkapja a jelölését (például a 4. lecke `satisfies` miatt TS 4.9, a 14. `NoInfer` miatt TS 5.4, a 17. `using` miatt TS 5.2);
- a 17. (`using`) és a 18. (szabványos dekorátor) lecke a 6. szakasz eszközlánc-lépése után mérhető (1.2).

### 4.3 RxJS-ág: „Folyamok” (8 lecke, RxJS 7.8)

Csak szinkron források (`of`, `from`, `Subject`), időzítő nélkül: a futás így ismételhető.

| # | Mit tanít | Rendezési jelenség | Épít rá |
| --- | --- | --- | --- |
| 1 | `of`, `from`, `subscribe`; az észlelő három ága | a feliratkozás előtt nincs érték | JS 2 |
| 2 | `pipe`: `map`, `filter` | az operátorok sorrendje megfigyelhető | 1 |
| 3 | `scan`, `reduce`, `tap` | állapot a folyamban; a `tap` hatása a helyén | 2 |
| 4 | két független folyam, `merge`, `combineLatest` | a két létrehozás felcserélhető (ma kötött: mért rés) | 3 |
| 5 | `Subject`, `BehaviorSubject` | feliratkozás az érték kibocsátása előtt vagy után | 1 |
| 6 | `catchError`, `EMPTY`, `finalize` | hiba utáni hatások sorrendje | 3 |
| 7 | `switchMap`, `concatMap` szinkron belső folyammal | a belső folyam helye a láncban | 4 |
| 8 | kis állapottár: `BehaviorSubject`, `scan`, `distinctUntilChanged` | több feliratkozó és több kibocsátás együtt | 5, 7 |

**Két lépésben:**
1. **Típusok és leckék, a generátor változatlan.** A modellek helyesek, de szigorúak (1.5). A mérés megmutatja, hány valóban felcserélhető sorpárt utasítanak el.
2. **Csak mért résre:** a library ismert hívásainak leírása a szerzői elemzésben (a létrehozás és a `pipe` lusta, a `subscribe` a hatás), az orákulum bizonyítékával, új szabályverzióval. Ez generátortétel lesz a jegyzékben, saját ADR-rel.

### 4.4 Angular

Ebben a tervben csak a jelölés készlete ismeri (`angular`, framework). Leckék később: a sablon nem JS- vagy TS-sor, a függőséginjektálás és a dekorátorok elemzése pedig külön felmérést kér. A 6.0.3-as fordító (6. szakasz) az előfeltétele.

## 5. Mit mér a tesztsor

Az NY-40 terv 5. szakasza érvényes mindhárom ágra (jegyzék, fordítás, szándék, alapszint, szállítás). Ami hozzájön:

- **Jelölés:** a szállított feladatok eltérés-tesztje (2.4); a mérőmodul egységtesztjei elemenként; importált jelölés nem lesz igazolt (bizalmi határ).
- **Lefedettség:** a generált jelentés egyezik a rögzítettel; fedetlen elem csak indokkal állhat.
- **Fa:** a jegyzék minden hivatkozása létező feladatra mutat; az „épít rá” kör nélküli; a jegyzéken kívüli feladat a „Saját feladatok” alá kerül.
- **Felület:** a szűrő, az összesítő és a fa böngészős tesztje asztalon és telefonon, akadálymentességi vizsgálattal.
- **Eszközlánc:** a fordítóváltás után az alapszint és a szállított modellek változatlanok; ha egy szabály változik, az megáll és döntést kér.

## 6. Lépések

Minden lépés külön jóváhagyás után indul, saját ADR-rel és tervezési review-val. A tervezett következő szabad ADR-szám a 149.

| Lépés | Tartalom | Kockázati osztály | Kész, ha |
| --- | --- | --- | --- |
| **G1 Jelölés** (kész, [ADR-149](adr/149-technology-labels.md)) | mező és készlet (mag), mérőmodul (szerzői elemzés), a 16 feladat jelölése, a lista megkapja | mag, szerzői elemzés | teljes kör zöld; eltérés-teszt |
| **G2 Jelölés a felületen** | bemutató (jelvények, szűrő, összesítő, két változat) → választás → megvalósítás | megjelenítés | böngészős tesztek, a11y |
| **G3 A fa** | tananyagjegyzék, a 16 feladat elhelyezése, bemutató (két változat) → megvalósítás | megjelenítés, katalógus | böngészős tesztek |
| **G4 Eszközlánc** | TypeScript 6.0.3; az ellenőrzés könyvtára ES2025; `using` és szabványos dekorátor az ellenőrzésben; a CI Node-verziója | szerzői elemzés, orákulum, eszközök | teljes kör zöld, változatlan alapszint; Local Demo méretek mérve |
| **G5 Tananyag-infrastruktúra** | az NY-40 C1 lépése, három ágra; egy-egy próbalecke | mérés | a korpuszban három lecke |
| **G6 JS és TS, A fázis** | JS 1–12, TS M1–M4 | mérés, példák | mérési jelentés; szállítási döntés |
| **G7 JS és TS, B–C fázis** | JS 13–20, TS M5–M10 | mérés, példák | ugyanaz |
| **G8 RxJS** | típusok az ellenőrzéshez (szerver és Local Demo), 8 lecke korpuszként, rés mérése | szerzői elemzés, mérés | jelentés; döntés a szállításról és a 4.3 második lépéséről |
| **G9 Lezárás** | lefedettségi jelentés, a rések jegyzéktételként, CHANGELOG | dokumentum | a jegyzékben NY-40, NY-44, NY-45 lezárva vagy maradéka megnevezve |

- **Sorrend:** a G1–G3 a mai eszközlánccal elvégezhető, és már a 16 feladaton látható eredményt ad. A G4 a G6 ES2023 utáni leckéi előtt kell.
- **Idő:** a G1, a G4 és minden tananyaglépés a teljes kört futtatja (kb. 12 perc lépésenként).

## 7. Kockázatok

- **A fordítóváltás megváltoztathat szabályt.** A típusellenőrzés tiszta (mért), de a generátor a fordító fáját és típusait olvassa. Ha az alapszint elmozdul, a G4 megáll, és a különbség a felhasználó elé kerül.
- **A Local Demo nő:** a szabványos könyvtár kb. 1 MB-tal, az RxJS-típusok kb. 0,4 MB-tal. Mindkettő lustán töltődik; az RxJS-típusok csak akkor, ha a forrás az `rxjs`-t importálja.
- **Az RxJS-leckék szigorúak maradhatnak.** Ha a 4.3 második lépése nem igazolható az orákulummal, a leckék korpuszként megmaradnak, és a szállításuk a felhasználó döntése.
- **A jelölés nem bizonyítja, hogy a kód egy régi környezetben fut.** Azt mondja meg, melyik kiadás elemeit használja. Régi futtatókörnyezet nincs a tesztsorban.
- **Az elemtábla válogatás.** A „teljes lefedettség” a rögzített táblára értendő, nem a nyelv egészére; a tábla bővíthető, és a jelentés megnevezi a forrását.
- **A 48 lecke sok mérés:** minden fázis hozhat helyességi hibát vagy rést. A hibás elfogadás megállítja a fázist (ahogy az NY-40 terve rögzíti); a rés jegyzéktétel lesz.

## 8. Döntések a felhasználónak

| # | Kérdés | Ajánlás | A másik út ára |
| --- | --- | --- | --- |
| 1 | Mit jelentsen a verzió a jelölésben? | nyelvnél a mért legújabb használt elem; librarynél az ellenőrzéshez használt verzió; a szerző felső határt választhat (2.2) | szabadon írható verzió: a keresés megbízhatatlan |
| 2 | TypeScript-fordító | váltás 6.0.3-ra (G4); a 7.0 nem tölthető be (1.4) | 5.8.3 marad: nincs Angular-ág, a „legújabb TypeScript” az 5.8 |
| 3 | Az ellenőrzés könyvtára és a CI Node-verziója | könyvtár ES2025; Node 24 a CI-ben, hogy a `Promise.try`, a `RegExp.escape` és a `using` szintaxis is futtatható legyen (valószínű, hogy a Node 24 tudja; a G4 első mérése dönti el) | Node 22 marad: az ES2025 három eleme „nem fedhető” |
| 4 | RxJS | `rxjs` 7.8.2 fejlesztési függőségként (típusok és orákulum), típuscsomag a Local Demóban; előbb leckék, a generátor csak mért résre | típusok nélkül: az RxJS-feladat hivatkozásait senki nem ellenőrzi |
| 5 | A fa adata és az előfeltétel | tananyagjegyzék a katalógusban; az előfeltétel ajánlás, zárolás nélkül (3.) | mező a feladatban: átnevezés minden feladatot érint |
| 6 | Az anyag terjedelme | 20 JS + 20 TS + 8 RxJS lecke; Angular később (4.) | kevesebb lecke: alacsonyabb lefedettség, gyorsabb mérés |
| 7 | Mit jelentsen a szűrő verziója? | alapértelmezés: pontosan ez a verzió („mit hozott az ES2020”); kapcsolóval: ez vagy korábbi | csak az egyik olvasat: a másik kérdés megválaszolatlan |

## 9. Nem része

- A generátor vagy a validátor módosítása a mért rések miatt (a 4.3 második lépése is külön tétel).
- Tananyag-nézet a tanulónak (a lecke szövege a felületen).
- Más nyelv (Python), más library.
- A 16 szállított feladat sorainak vagy szabályainak módosítása; csak a jelölést kapják meg.
- Futásidejű függőség a szerveren vagy a Local Demóban az értékeléshez: az értékelés változatlanul nem futtat és nem elemez tanulói kódot.

## 10. Előre látható adósságok és ütemezésük

A felhasználó kérése (2026-11-14): minden adósság, amelyet a terv lépései előre láthatóan hátrahagynak, kapjon tételt és helyet az ütemezésben. A tételek a [jegyzékben](nyitott-tetelek.md) állnak.

| Tétel | Mi marad hátra | Miért marad | Mikor |
| --- | --- | --- | --- |
| **NY-49** | TypeScript `namespace`: hibásan felcserélhető exportált tagok (1.6) | most talált generátorhiba; új szabályverzió kell | **a G1 után, a G2 előtt** (helyesség) |
| **NY-50** | az orákulum három korlátja: hamis reflexiójelzés `Symbol.` olvasásra, szöveges dekorátor-összevetés, `Symbol.dispose` hiánya | nélkülük a 15., 17. és 18. TS-lecke hamis hibát vagy semmit nem mér | a G5 előtt; a `Symbol.dispose` a G4-gyel |
| **NY-51** | **RxJS teljes lefedettsége:** a nyilvános felület 173 exportjából a 8 lecke 17-et használ. Hátra van: a lusta létrehozás modellje, az időalapú operátorok (virtuális idő az orákulumban), a forró és hideg folyam, az ütemezők, a teljes operátortábla, és egy kampányfajta, amely RxJS-programokat generál. A cél: bármilyen oktatói RxJS-kódra helyes és minél teljesebb modell | a G8 csak a szinkron magot fedi | a G8 mérése után, három lépésben: lusta létrehozás → idő → teljes tábla és kampány |
| **NY-52** | **Általános library-ismeret:** típuscsomag szállítása és a hívások leírása library-nként egységes módon, méretkerettel a Local Demóban | a G8 az RxJS-t egyedi esetként köti be | a második library (Angular) előtt |
| **NY-53** | **Verziók karbantartása:** több library-verzió egymás mellett (RxJS 8 vagy 9 stabil megjelenésekor); a natív TypeScript-fordító, amint betölthető felületet ad; évente az új ECMAScript-kiadás (elemtábla, könyvtár, Node) | a G4 és a G8 egy-egy verziót rögzít | eseményhez kötve; évente júliusban felülvizsgálat |
| **NY-54** | **A jelölés mérési korlátai:** a típusellenőrző viselkedésében megjelenő újdonság (kézi jelölés indokkal); típus nélküli JavaScript-fogadón a metódus neve alapján dönt; régi futtatókörnyezetben nem fut próba | a mérés egy fordítóval és egy futtatóval dolgozik | a G6 mérései után, ha a kézi jelölések száma indokolja |
| **NY-55** | **Kimaradó nyelvi elemek:** modulok és több fájl, felső szintű `await`, dinamikus `import`, időzítők és eseményhurok, `WeakRef` | a lánc egy fájlt elemez, a futás nem lehet véletlenszerű | a G9 után külön terv (a többfájlos feladat sémaváltozás) |
| **NY-56** | **Angular-ág:** sablon, függőséginjektálás, dekorátorok, jelek | a terv csak a jelölés készletébe veszi fel | a G4 és az NY-52 után: felmérés és terv |
| **NY-57** | **Tananyag a tanulónak, a szerző saját fája:** a lecke szövege a felületen; a szerző saját feladatainak fába rendezése; haladás több eszközön | a G3 a szállított tananyag fáját adja | a G3 után, bemutatóval |

**A helyesség legfontosabb forrása változatlanul a valódi tanári kód** (a felhasználótól várt anyag): a tananyag és a söprés nem pótolja.
