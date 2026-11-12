# Terv: egymásra épülő TypeScript-tananyag, egyben tesztkorpusz (NY-40)

Állapot: **terv, jóváhagyásra vár** (2026-11-12). A felhasználó kérése: új, egymásra épülő oktatási anyag TypeScript nyelven, amely valódi programozási témakört tanít, és egyszerre a validátor és a modellképzés tesztkorpusza. A terv úgy készült, hogy egy másik kódoló ügynök (például az OpenAI Codex) a repóban önállóan folytathassa.

Kockázati osztályok ([ai-governance.md](ai-governance.md)):
- **orákulum és mérés:** új korpusz, új alapszint;
- **dokumentáció és eszközök:** tananyag, építőeszköz;
- **szerzői elemzés:** csak ha a C0 felmérése után a felhasználó külön jóváhagyja.

A generátor, a validátor és a felület ebben a feladatban **nem változik**.

## 0. Ha ügynökként veszed fel ezt a szálat

1. **Olvasd el, ebben a sorrendben:**
   - [AGENTS.md](../AGENTS.md);
   - [architecture.md](architecture.md);
   - [ai-governance.md](ai-governance.md);
   - [design-review.md](design-review.md);
   - [formal-ordering-contract.md](formal-ordering-contract.md);
   - [nyitott-tetelek.md](nyitott-tetelek.md);
   - ez a fájl.

   Az AGENTS.md szabályai minden itteni lépésnél érvényesek.
2. **Kiinduló állapot:** `npm ci`, majd `npm run check:all`. Zöldnek kell lennie, mielőtt bármit változtatsz. Ha nem zöld, állj meg, és jelentsd.
3. **Jóváhagyási pontok.** Ezeknél kérdezd meg a felhasználót, és várj a válaszra:
   - a tananyag témaköre és sorrendje (C0);
   - a szintbesorolás (`level`);
   - mely leckék kerülnek a szállított feladatok közé;
   - minden push;
   - minden függőség- vagy verziófrissítés (TypeScript, `lib`);
   - meglévő példák függőségeinek átírása.

   Ezek pedagógiai vagy publikálási döntések (AGENTS.md, ADR-049).
4. **Tilos:**
   - kézzel írni vagy javítani az `examples/*.json` modelleket;
   - kézzel írni a `tests/fixtures/ordering-baseline.json` alapszintet;
   - gyengíteni egy tesztet, hogy egy lecke átmenjen;
   - a generátort vagy a validátort ebben a feladatban módosítani;
   - tanulói beküldést futtatni vagy elemezni.

   Futtatás kizárólag a rögzített, korlátos fixture-ökön történhet, az orákulumban.
5. **Commit:**
   - a commit üzenete a változást írja le;
   - a végén `Co-Authored-By:` sor a közreműködő modell nevével (AGENTS.md);
   - minden fájl LF sorvégű (`npm run check` ellenőrzi).

## 1. Az alapelv: a tananyag nem a validátorhoz igazodik

A kettős szerep egy kockázatot hordoz. Ha a tananyagot úgy írjuk, hogy a validátor szeresse, akkor a korpusz azt méri, amit már tudunk, és a tanár nem azt kapja, amit tanítani akar. Ezért:

- **Pedagógia előbb.**
  - Minden lecke a témakörből és az előző leckékből következik.
  - A forrás olyan, amilyet egy jó tanár írna: tiszta, idiomatikus, modern TypeScript.
  - A validátor viselkedése nem szempont a megírásakor.
- **Nincs igazítás.** A mérés után a leckét nem írjuk át azért, hogy jobb számot adjon. Ha a modell nem igazolható, vagy rés van benne:
  - a lecke a korpuszban marad (`route: "corpus"`);
  - a rés új nyitott tétel lesz (NY-…) a generátornak;
  - a szállításról a felhasználó dönt.
- **Elkülönített eredet.** A korpuszban az új leckék eredete `curriculum`, nem `task` és nem `library`. A mérés így nem keveri össze őket a valódi tanári kóddal: ez a feladat **nem pótolja** a „Valódi tanári kód mérése” tételt, mert ugyanaz a szerző írja, aki a mérést.

## 2. Kényszerek (mért tények, 2026-11-12)

| Tény | Következmény | Bizonyosság |
| --- | --- | --- |
| A repó TypeScript-verziója **5.8.3** (`package.json`); ezt használja a generátor, a referencia-audit, az orákulum és a Local Demo is | A „legújabb TypeScript” ebben a feladatban az 5.8-ig megjelent nyelvi elemeket jelenti. Újabb fordító bevezetése külön, jóváhagyásköteles feladat: a nyelvi elemzés, a Local Demo csomagja és az orákulum kibocsátása együtt változik | biztos |
| A referencia-audit a **`lib.es2022.full.d.ts`** könyvtárral ellenőriz (`src/author/reference-audit.ts`) | ES2023+ API-k (`toSorted`, `findLast`, `Object.groupBy`, `Symbol.dispose`) ma ismeretlen névként jelennek meg az első kapun. Ha egy lecke ilyet használ, a C0-ban mérni kell, mit tesz vele a kapu; a `lib` emelése a felhasználó döntése | biztos (a kód), valószínű (a kapu pontos reakciója) |
| Dekorátor jelenlétekor az audit **`experimentalDecorators: true`** módba vált | A szabványos (TC39, TS 5.0) dekorátorokat a régi szabály szerint ellenőrzi. Dekorátoros lecke csak a C0 mérése után, és csak korpuszként | biztos (a kód) |
| Az orákulum a TypeScriptet **ES2022 célra** fordítja és Node-ban futtatja; a CI **Node 22** | `using` és `await using` a fordító segédkódjával fut, `Symbol.dispose` csak akkor van, ha a Node 22 biztosítja. A C0-ban egy próbán kell ellenőrizni | valószínű |
| A generátor korlátai: legfeljebb 500 sor, soronként 2048 karakter, 50 KB | A leckék jóval ez alatt vannak | biztos |
| A megjegyzések és az összetett sorok konzervatívak (a szállított példák jegyzete szerint) | A forrásban nincs megjegyzés; minden magyarázat a lecke szövegében van | biztos |
| A gyakorló lista szint szerint csoportosít (`level`), a csoporton belül a katalógus sorrendjében | „Tanfolyam” vagy sorozat szerinti csoportosítás nincs. A sorrendet a fájlnév (`ts-lib-01-…`) adja. Egy `series` mező sémaváltozás lenne: külön döntés, nem része | biztos |
| A tanuló a feladatból csak a címet és a leírást (`description`) látja | A lecke szövege tanári anyag (`curriculum/typescript/*.md`). Tananyag-nézet a felületen külön döntés | biztos |

**„Legújabb” gyakorlat, ami ma is belefér:**
- **Csak törölhető típusszintaxis**, az `--erasableSyntaxOnly` (TS 5.8) szellemében:
  - nincs `enum`, `namespace`, paraméter-tulajdonság és `import =`;
  - enum helyett literál-unió és `as const` objektum;
  - ezt egy lecke kifejezetten megtanítja.
- **Modern nyelvi elemek:** `satisfies`, `const` típusparaméter, `NoInfer`, kikövetkeztetett típusőr (TS 5.5), `readonly` tömbök, `#privát` mezők, `accessor`, `override`, a megkülönböztetett unió kimerítő `never`-ellenőrzéssel.
- **Csak a C0 mérése után:** `using` és a szabványos dekorátorok, a fenti két sor miatt.

## 3. A tananyag: „Könyvtár” – egy projekt, tíz modul

**Egy futó tartomány:** egy iskolai könyvtár kölcsönzési rendszere (könyv, olvasó, kölcsönzés, előjegyzés, késedelmi díj, jelentés). Minden modul az előző típusaira és fogalmaira épít. A gyakorló feladat mégis önálló: a forrás az elején megismétli a szükséges típusokat. Így a korábbi leckék egymástól független deklarációi is rendezendő sorok lesznek.

Az oszlopok jelentése:
- **Mit tanít:** a programozási témakör.
- **Rendezési jelenség:** amit a lecke a validátornak ad. Előre megírt *szándék*, nem ígéret; a mérés dönt.
- **Útvonal:**
  - `ship?`: a mérés után dönthető el, szállítható-e;
  - `corpus`: eleve csak korpusz.

| # | Azonosító | Szint | Mit tanít | Épít rá | Rendezési jelenség | Útvonal |
| --- | --- | --- | --- | --- | --- | --- |
| **M1 Alapok** | | | | | | |
| 1 | `ts-lib-01-label` | kezdő | típusos paraméter és visszatérés, `const`, sablonliterál | – | független `const` sorok szabadok; a `return` a végén | ship? |
| 2 | `ts-lib-02-late-fee` | kezdő | számítás, `Math.max`/`min`, segédfüggvény | 1 | adatlánc (`days` → `fee` → `return`) kötött; két konstans és két függvény szabad | ship? |
| **M2 Típusok modellezése** | | | | | | |
| 3 | `ts-lib-03-book-status` | kezdő | `type`, `interface`, opcionális és `readonly` mező, literál-unió, `as const` objektum enum helyett, `switch` és `never` | 1–2 | típustagok szabadok; a `switch` ágai a helyükön | ship? |
| 4 | `ts-lib-04-member-kinds` | közepes | megkülönböztetett unió, szűkítés (`in`, `typeof`, diszkriminátor), `satisfies Record<…>` | 3 | a `satisfies` objektum tulajdonságsorai szabadok, ha a kulcssorrend nem számít | ship? |
| **M3 Gyűjtemények** | | | | | | |
| 5 | `ts-lib-05-catalog-search` | közepes | `filter`, `map`, `sort` összehasonlítóval, másolat rendezés előtt (`[...items]`) | 3–4 | a másolás megelőzi a rendezést (mutáció) | ship? |
| 6 | `ts-lib-06-loans-by-member` | közepes | `Map<string, Loan[]>` csoportosítás, `Set` egyedi értékekre | 5 | `Map`- és `Set`-műveletek sorrendje; a `Set` ma nincs modellezve, várható konzervatív kötés (korpuszérték) | ship? |
| 7 | `ts-lib-07-summary` | közepes | `reduce` összesítő objektumra, `Object.entries`, a kulcssorrend mint megfigyelhető viselkedés | 5–6 | a „Számít / Nem számít” kulcssorrend-beállítás mindkét értékkel mérve | ship? |
| **M4 Null-biztonság és hibák** | | | | | | |
| 8 | `ts-lib-08-find-or-fail` | közepes | `?.`, `??`, saját hibaosztály (`extends Error`), `try`/`catch`/`finally` | 5 | a dobás előtti és utáni hatások sorrendje kötött | ship? |
| 9 | `ts-lib-09-result-type` | közepes | `Result<T, E>` unió kivétel helyett, kikövetkeztetett típusőr `filter`-rel | 8 | tiszta függvények szabadok, adatláncok kötöttek | ship? |
| **M5 Osztályok** | | | | | | |
| 10 | `ts-lib-10-member-class` | közepes | osztály `#privát` mezővel, getter, `static` számláló, `readonly`, `implements` | 3–4 | tagok sorrendje szabad; a `static` mező inicializálása megfigyelhető | ship? |
| 11 | `ts-lib-11-loan-desk` | haladó | állapotot módosító metódusok (kölcsönzés, visszahozás), invariáns ellenőrzése | 8, 10 | példányállapot írás–olvasás sorrendje (heap) | ship? |
| 12 | `ts-lib-12-items-inheritance` | haladó | absztrakt ősosztály, `super`, `override`, polimorfizmus | 10–11 | öröklés: a mai elemzés konzervatív (ADR-025), várható rés | corpus |
| **M6 Generikusok** | | | | | | |
| 13 | `ts-lib-13-repository` | haladó | `Repository<T extends { id: string }>`, `keyof`, `Partial`, `Pick`, frissítés részobjektummal | 10 | generikus osztály metódusainak sorrendje; objektum-szétterítés | ship? |
| 14 | `ts-lib-14-typed-fields` | haladó | `const` típusparaméter, leképezett típus, `NoInfer` | 13 | sok törölhető típussor: szabadok, ha a futó kód nem függ tőlük | ship? |
| **M7 Iterátorok és generátorok** | | | | | | |
| 15 | `ts-lib-15-paging` | haladó | `function*` lapozás, `for…of`, `Symbol.iterator` saját osztályon | 5, 13 | a `Symbol.` a futó kódban szigorú bemeneti szerződést ad (NY-34); a `yield` sorrendje kötött | corpus |
| **M8 Aszinkron** | | | | | | |
| 16 | `ts-lib-16-reservations-async` | haladó | `async`/`await`, `Promise.all`, már teljesült ígéretek (időzítő nélkül) | 9, 13 | `await` utáni hatások sorrendje; az orákulum `asynchronous` módja | corpus |
| **M9 Erőforrás és metaprogramozás (kísérleti)** | | | | | | |
| 17 | `ts-lib-17-using-session` | haladó | `using` és `[Symbol.dispose]`, fordított lezárási sorrend | 11 | a `using` deklarációk sorrendje megfigyelhető (LIFO); C0-függő | corpus |
| 18 | `ts-lib-18-logged-methods` | haladó | szabványos metódusdekorátor | 10 | dekorátorok kiértékelési sorrendje; C0-függő | corpus |
| **M10 Záró projekt** | | | | | | |
| 19 | `ts-lib-19-loan-service` | haladó | a `Repository`, a `Result` és a díjszámítás összekötése egy szolgáltatásban | 2, 9, 11, 13 | több osztály és függvény együtt; nagyobb modell (25–35 sor) | ship? |
| 20 | `ts-lib-20-report` | haladó | jelentés: csoportosítás, rendezés, formázás, kulcssorrend | 6–7, 19 | kulcsfelsorolás és rendezés együtt | ship? |

**Fázisok:**
- **A:** M1–M4, 9 lecke.
- **B:** M5–M7, 6 lecke.
- **C:** M8–M10, 5 lecke.

Minden fázis végén mérési jelentés és a felhasználó döntése következik a szállításról, csak utána jön a következő fázis.

## 4. Egy lecke csomagja

**Könyvtár:** `curriculum/typescript/`. Új felső szintű mappa, ezért a C1-ben ellenőrizni kell, kell-e bejegyzés a [architecture-policy.json](architecture-policy.json) fájlba és a governance-tesztbe.

| Fájl | Tartalom |
| --- | --- |
| `NN-slug.ts` | **A referencia.** Pontosan az a kód, amit a tanuló rendez: LF, 2 szóközös behúzás, soronként egy utasítás, megjegyzés és tesztkód nélkül |
| `NN-slug.md` | **A lecke szövege a tanárnak:** a fogalom magyarázata; miért szabad vagy kötött egy-egy sorpár; gyakori hibás sorrend és miért hibás; kapcsolódás az előző leckéhez; 2–3 kérdés a tanulónak |
| `manifest.json` | **Leckénként:** `id`, `file`, `module`, `order`, `level`, `title` (magyar), `description` (magyar, a tanuló látja), `concepts`, `buildsOn`, `probes`, `settings`, `intent`, `route` |
| `tsconfig.json` | `strict`, `noEmit`, `erasableSyntaxOnly`, `target: ES2022`, `lib: ["ES2022"]`, a referencia-audittal egyezően. Ha a C0 jóváhagyott eltérést, azt itt is rögzíteni kell |

**A `manifest.json` egy leckéje:**

```json
{
  "id": "ts-lib-02-late-fee",
  "file": "02-late-fee.ts",
  "module": "M1",
  "order": 2,
  "level": "beginner",
  "title": "Késedelmi díj",
  "description": "Rendezd sorba a késedelmi díjat számoló programot. A két konstans és a két függvény sorrendje szabad.",
  "concepts": ["typed-parameters", "helper-function", "math"],
  "buildsOn": ["ts-lib-01-label"],
  "probes": [
    "[lateFee({ title: 'A', dueDay: 10, returnedDay: 9 }), lateFee({ title: 'B', dueDay: 10, returnedDay: 13 }), lateFee({ title: 'C', dueDay: 1, returnedDay: 40 })]"
  ],
  "settings": {"inputs": "valid", "keyOrder": "observed", "classFields": "either"},
  "intent": {
    "free": [["const DAILY_FEE", "const MAX_FEE"], ["readonly title", "readonly dueDay"], ["function lateDays", "function lateFee"]],
    "bound": [["const days", "const fee", "data"], ["const fee", "return Math.min", "data"]]
  },
  "route": "ship?"
}
```

**A sorpárok megadása:**
- Az `intent` párjai a sor elejével hivatkoznak, levágott behúzással; a manifest-teszt ellenőrzi, hogy minden hivatkozás pontosan egy sort talál.
- A blokkok (például `function lateDays`) a nyitó sorukkal szerepelnek, és egységként értendők.
- A `bound` harmadik eleme az ok: `data`, `effect`, `throw`, `key-order`, `pedagogy`.

**A hozzá tartozó `02-late-fee.ts`:**

```ts
type Loan = {
  readonly title: string;
  readonly dueDay: number;
  readonly returnedDay: number;
};
const DAILY_FEE = 50;
const MAX_FEE = 1000;
function lateDays(loan: Loan): number {
  const late = loan.returnedDay - loan.dueDay;
  return Math.max(0, late);
}
function lateFee(loan: Loan): number {
  const days = lateDays(loan);
  const fee = days * DAILY_FEE;
  return Math.min(fee, MAX_FEE);
}
```

**Írási szabályok minden leckére:**
- **Determinisztikus.** Nincs benne:
  - `Date.now`, `new Date()` paraméter nélkül, `Math.random`;
  - időzítő, I/O, hálózat;
  - nyelvi beállítástól függő `Intl`- vagy `toLocale…`-hívás;
  - `console`-ra épülő eredmény.

  Az eredményt a próbák kifejezései adják vissza.
- **Korlátos.** Minden ciklus a próbák bemenetén véges; a rekurzió mélysége legfeljebb 100.
- **Méret:** 10–35 sor; a záró projekt legfeljebb 40.
- **Elnevezés:** angol azonosítók és magyar karakterláncok, a meglévő példák szerint.
- **Sorpárok:** legalább egy valóban szabad és egy valóban kötött sorpár. A kötött pár különbségét a próbáknak meg kell figyelniük, különben az orákulum nem tudja igazolni. Ezért a próbák lefedik a fő ágakat, a szélső esetet és a hibás utat is.
- **A `valid` szerződés:** legalább egy próba csak egyszerű adatot ad át (szám, szöveg, tömb, sima objektum), mert a korpusz a leckét a `valid` szerződéssel is méri (ADR-050).
- **Fordítás:** a forrás a `curriculum/typescript/tsconfig.json`-nal hibátlanul fordul.

## 5. Bekötés: mit mér a tesztsor

1. **`tests/fixtures/curriculum-programs.mjs`** (új):
   - beolvassa a manifestet és a forrásokat;
   - leckénként két fixture-t ad `origin: 'curriculum'` eredettel: egyet `any`, egyet `valid` bemeneti szerződéssel;
   - a fixture-ök a `probe`/`probes` mezőt és a lecke `settings` értékeit kapják.

   Az [ordering-corpus.mjs](../tests/fixtures/ordering-corpus.mjs) ugyanúgy beemeli, mint a `taskPrograms`-ot. Kézi lista nincs: új lecke a manifesttel együtt kerül be.
2. **Alapszint:**
   - parancs: `node tests/ordering-metrics.mjs --baseline`;
   - a diffben csak az új `ts-lib-…` kulcsok jelenhetnek meg; meglévő kulcs nem változhat (ezt a commit előtt ellenőrizni kell, és a jelentésben rögzíteni);
   - a [semantic-corpus.test.mjs](../tests/semantic-corpus.test.mjs) ezután minden leckére abszolút helyességet ellenőriz: nincs helytelenül elfogadott sorrend, nincs eldöntetlen, nincs kimerült keret.
3. **`tests/curriculum.test.mjs`** (új):
   - **Manifest:** érvényes, az azonosítók egyediek, a `buildsOn` csak korábbi leckére mutat, minden `intent`-hivatkozás pontosan egy sort talál.
   - **Fordítás:** minden forrás hibátlanul fordul a lecke `tsconfig`-jával (a `typescript` API-jával, nem külső folyamattal).
   - **Szándék, kötött pár:**
     - a generált modell a `bound` párok cseréjét elutasítja;
     - ha elfogadja, a teszt bukik, és az orákulum dönti el, hogy a szándék volt hibás, vagy a validátor helytelen.
   - **Szándék, szabad pár:**
     - ha a modell a `free` pár cseréjét elutasítja, az teljességi rés;
     - a rések a rögzített `curriculum-gaps.json` alapszintben vannak, változásuk felülvizsgált frissítést kér (mint az `ordering-baseline.json`).
   - **Szállított lecke:**
     - minden `ship` útvonalú leckéhez van `examples/<id>.json`;
     - ugyanabból a forrásból készült (egyező `sourceDigest`);
     - a szintje egyezik a manifestével;
     - a minősítése `analysis-verified`, `conservative` vagy `author-modified`.
4. **Szállítás** (csak a felhasználó jóváhagyása után):
   - az `examples/<id>.json` a **`scripts/build-curriculum.ts`** eszközzel készül, amely a szerver `createDraft` útját hívja (generátor, első kapu, minősítés), nem kézzel. TypeScriptben készül, a `dist-tools` fordítási útján, mint a `build-typescript-samples.ts`;
   - utána: `node scripts/verify-models.mjs`;
   - frissül a [catalog-publication.test.mjs](../tests/catalog-publication.test.mjs) `refreshed` listája és az [exercise-levels.test.mjs](../tests/exercise-levels.test.mjs) `LEVELS` listája. Ez utóbbi a felhasználó által jóváhagyott besorolás, csak a jóváhagyása után változhat.

## 6. Lépések

| Lépés | Tartalom | Kimenet | Kész, ha |
| --- | --- | --- | --- |
| **C0 Felmérés és jóváhagyás** | Kis próbák a scratch-ben (nem kommitolva): (a) a TS 5.8.3 elemzi-e a tervezett elemeket; (b) mit tesz az első kapu `toSorted`, `Symbol.dispose`, szabványos dekorátor esetén; (c) fut-e a `using` az orákulumban Node 22-n; (d) az orákulum `asynchronous` módja egy `Promise.all` leckén. A tananyagtábla bemutatása a felhasználónak | Táblázat a jelentés elején; a felhasználó döntése a témakörről, a sorrendről, a szintekről és a kísérleti leckékről | A felhasználó jóváhagyta; a kísérleti leckék sorsa eldőlt |
| **C1 Infrastruktúra** | Mappa, `tsconfig`, manifest és típusa, `curriculum-programs.mjs`, `curriculum.test.mjs`, `build-curriculum.ts`; egyetlen lecke: `ts-lib-02-late-fee`. ADR-142 (a tananyag mint korpusz, az eredet szétválasztása, a rések alapszintje) | Zöld `check:all`, egy lecke a korpuszban | Az ADR tervezési review-ja kész (két terv, mit rejt el a modul, hívók) |
| **C2 A fázis** | M1–M4 leckéi a szöveggel; mérés; alapszint; jelentés | `docs/tananyag-meres.md` (leckénként: sorrendek, elfogadott, rés, minősítés, a rések oka) | A jelentés a felhasználónál; a szállítás eldőlt |
| **C3 B fázis** | M5–M7 | A jelentés bővül | Ugyanaz |
| **C4 C fázis** | M8–M10, a C0 döntése szerint | Ugyanaz | Ugyanaz |
| **C5 Lezárás** | A rések nyitott tételként (generátor típus, mért hatással); CHANGELOG; a jegyzékben NY-40 lezárva | Új NY-sorok | `check:all` zöld; a böngészős sor csak akkor kell, ha a felület változott (itt nem) |

**Parancsok:**

```bash
npm run check:all
```

```bash
node tests/ordering-metrics.mjs --baseline
```

```bash
node scripts/verify-models.mjs
```

## 7. Mitől lesz jó tananyag (a felhasználó céljához)

- **Valódi témakör.** A tíz modul egy kezdő–haladó TypeScript-kurzus gerince: típusok, adatmodellezés, gyűjtemények, hibakezelés, osztályok, generikusok, iterátorok, aszinkron kód, erőforrás-kezelés. Mindez egy működő alkalmazás felépítésén keresztül.
- **A rendezés tanít.** Minden leckében az a kérdés, *miért* állhat egy sor máshol: adatfüggés, mellékhatás, kivétel, kulcssorrend. Ez az a gondolkodás, ami a programozásban hordozható. A lecke szövege ezt magyarázza el a tanárnak, a `description` egy mondatban a tanulónak.
- **Rögzített maradék:**
  - a tanuló ma nem látja a lecke szövegét a felületen;
  - nincs sorozat szerinti csoportosítás;
  - a szintek mellett a fájlnév adja a sorrendet.

  Mindhárom külön felületi vagy séma-döntés.

## 8. Nem része

- A generátor vagy a validátor módosítása a mért rések miatt: ezek külön NY-tételek, saját ADR-rel és szabályverzióval.
- TypeScript- vagy `lib`-frissítés.
- Tananyag-nézet, sorozat mező, más nyelvű (JavaScript, Python) változat.
- A meglévő 16 szállított példa módosítása.
