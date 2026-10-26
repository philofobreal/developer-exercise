# ADR-013 – Lokális írások, klauzulaláncok és importok

Állapot: implementálva (a Semantic Ordering Precision epic B1–B3 munkacsomagja). A validátor, a CodeLine-séma jelentése, a tanulói parsermentes értékelés és a bizalmi határ változatlan. A már importált modellek függőségei nem generálódnak újra.

## Kontextus

A teljes `CopyFieldUtilityService` (482 fizikai sor, 436 CodeLine) a `76382c7`-en minden vizsgált cserét elutasított. Három különálló ok volt:

1. **Értékadás = barrier.** Minden `ExpressionStatement` akadály volt, így a 248–249. sor két független lokális értékadása (`processedLearningContentFields = processedFields;`, `processedTestField = [];`) sem cserélhető. A dokumentált P2 is minden értékadást hatásnak tekintett.
2. **Közös fizikai blokkhatár.** A `} else {` sor egyszerre zárja az egyik és nyitja a másik blokkot. A v2-ben egy sor nem lehet két blokk határa, ezért a generátor mindkét blokkot elhagyta, és a teljes intervallumot soros láncba kötötte. A fájlban így 8 blokk (négy `if/else` pár) és 30 soros él keletkezett.
3. **Import = barrier.** Minden importdeklaráció akadály volt, a csak típusként használtak is (5–7. sor).

## Döntés

### 1. Lokális írások és konfliktusok (P2 pontosítása)

**Lokális írás** az `x = e` utasítás, ha:

- x egyetlen `let`/`var` deklarációra oldódik fel (kötésazonosság, nem név);
- a deklaráció ugyanabban a függvénykontextusban van, mint az írás, és az írás előtt áll;
- a deklaráció nem szkriptszintű (a globális scope szöveg által futtatott kóddal is írható), nem `switch`-klauzulában van, és nem `const`, `using` vagy ciklusfejbeli deklaráció;
- e tiszta: dobásmentes, nem futtat felhasználói kódot (ADR-008 szerinti `pure`).

Minden tiszta és lokális író egység szimbólumszintű olvasási és írási halmazt kap. A deklaráció a saját kötését írja; a blokk és az `if` a gyerekek halmazainak unióját, a zárt függvénytörzsek olvasásai nem számítanak. Két ilyen egység között akkor van él, ha RAW, WAR vagy WAW konfliktus áll fenn. Ha egy blokk vagy `if` minden része tiszta vagy lokális író, maga is lokális író egység marad, így a listák közötti konfliktus is rendezett. Az írás a célkötés deklarációjától védett élt kap, mert TDZ előtt nem futhat.

**P2 (pontosított):** egy utasításlistában minden olyan pár relatív sorrendje megmarad, amelynek legalább egyik tagja *külső* hatású, kivéve a pozíciófüggetlen tagokat. A függvénylokális `let`/`var`/paraméter írása hatásmentes jobb oldallal *lokális* hatás: csak az ugyanazt a kötést olvasó vagy író párokhoz képest kötött.

**Helyesség:**

- Egy lokális írás csak a saját kötését módosítja, és nem dob.
- Két konfliktusmentes tiszta vagy lokális író egység felcserélése után minden kötés ugyanazt az értéket látja: ugyanazok az olvasások ugyanazokat az írásokat követik, és nincs közös írási cél.
- Külső hatás (hívás, property-írás, `await`, kivétel, vezérlésátadás) továbbra is akadály, ezért egy kötést zárványként olvasó függvény csak akadálynál fut, és az íráshoz képest a sorrendje megmarad.
- Ciklustörzsben a független utasítások iterációnként is kommutálnak.

### 2. Klauzulaláncok a projekcióban

- **Az adapter jelöl:** a JS/TS `jsTsStructure` az `if/else`, `try`, `catch` és `finally` klauzula blokkját `clause` jelöléssel adja át.
- **A projekció összefűz:** a [code-line-projection.ts](../../src/author/code-line-projection.ts) azokat a klauzulákat, amelyek határsora pontosan kettejük közös sora, egyetlen megtartott konténerré fűzi. A közös sorok szeparátorok. Feltétel, hogy a lánc első és utolsó sora ne legyen közös más blokkal; ha ez nem teljesül, marad a korábbi elhagyás és sorosítás.
- **Kényszerek:**
  - minden szeparátor követi az előző határt és az előző szegmens minden legfelső szintű sorát;
  - a következő szegmens minden legfelső szintű sora követi a szeparátort;
  - a mélyebben fekvő sorok a beágyazott blokk nyitóján át tranzitívan követik.
- **Eredmény:** ez pontosan ugyanazt a nyelvet fogadja el, mint a v3 határeseményes reprezentáció (a `} else {` unit lezárja az egyik és megnyitja a másik konténert). Minden sor a saját klauzulájában marad, a klauzulán belül pedig a sorrendi elemzés dönt. A v2 → v3 projekció ezért pontos; natív JS/TS → v3 út ehhez nem kell.
- **Migráció:** a projekció egésze, a blokkmegtartással, a scope-pal, a `functionBlock`-kal, a lezárással és a redukcióval együtt, strict TypeScript modulba került (ADR-001 P4 része). A `generator.mjs` ezután csak bemenetellenőrzés és adapterhívás; kizárólag a projekciós modult importálhatja (architektúrakapu).

### 3. Importok explicit emit-kontextussal

A generátor `importEmit` bemenete (csak TypeScriptre):

- **`verbatim`** (alapértelmezés, ismeretlen build esetén is): mint `verbatimModuleSyntax` mellett. Csak az `import type …` törlődik, minden más import megmarad, és modulbetöltésként kötött. Az `import { type A } from 'm'` is marad (`import {} from 'm'`).
- **`elide-unused`:** a TypeScript alapértelmezett emitje. Az az import törlődik (pozíciófüggetlen), amelynek egyetlen kötése sem szerepel értékpozícióban. Típuspozíció: típuscsomópont, `implements`, interfész-`extends`, `typeof` típuslekérdezés. Az `export { X }` értékhasználatnak számít.
- **Dekorátort tartalmazó fájl:** az `emitDecoratorMetadata` típusannotációból értékhivatkozást csinálhat, ezért az `import type`-on kívül minden import kötött.
- **Mellékhatás-import** (`import './x'`) és **JavaScript-import:** mindig modulbetöltés, kötött.

A modulbetöltő importok egymáshoz képesti sorrendje megmarad. Az ES-modulok hoistolását (az import a törzs előtt értékelődik ki) nem használja ki a szabály, mert CommonJS-emitben a `require` a deklaráció helyén fut.

## Független ellenőrzés

- **Orákulum:** a [semantic-oracle.mjs](../../tests/support/semantic-oracle.mjs) a pontosított P2-t saját implementációval ellenőrzi, JS-re Acornnal, TS-re saját AST-bejárással. A kötéseket egy függvényen belül név szerint azonosítja: az árnyékolás legfeljebb összevonhat kötéseket, ami több konfliktust jelent, vagyis a biztonságos irányba téved.
- **Importok:** a [import-ordering.test.mjs](../../tests/import-ordering.test.mjs) a TypeScript tényleges emitjét használja bizonyítéknak. Minden egysoros importpár cseréje pontosan akkor elfogadott, ha az emit által megtartott importok sorrendje nem változik; ez mindkét kontextusban, a teljes `CopyFieldUtilityService`-en és kézzel írt eseteken is teljesül.
- **Végponttól végpontig:** a [local-write-ordering.test.mjs](../../tests/local-write-ordering.test.mjs) a teljes fájlból generált és ténylegesen validált modellen igazolja, hogy a 248↔249 csere elfogadott, a 305↔306 (`UUID()`) elutasított, és egy sor sem léphet át a másik klauzulába. Ide tartoznak a RAW/WAR/WAW, a hívás mögötti zárvány, a hatásos jobb oldal, a külső kötés, az `else if` és a `try/catch/finally` esetei is, mindegyik az orákulummal és teljes szomszédsági és blokkmozgatási soundness-ellenőrzéssel.

## Mérés

[Formális szerződés, ADR-013](../formal-ordering-contract.md#adr-013-lokális-írások-klauzulaláncok-és-importok):

- korpusz (64 fixture): 0 hibás elfogadás; a rések száma K45: 5 → 4, W9: 7 → 4, P3: 7 → 1;
- generatív kampány (560 program): 0 hibás elfogadás, a rések száma 2 072 → 1 959, a lokális írásokat és `else`-határokat tartalmazó függvényprogramokon 166 → 53.

## Következmények és korlátok

- **Policy-címke:** additív `scoped-effect-analysis-v9`. A régi címkék és modellek érvényesek; csak explicit „Sorfüggőségek újraszámítása” generál újra.
- **Konzervatív marad:**
  - a paraméter mint írási cél, az összetett értékadás (`+=`), a `++`/`--`, a property-írás és a szkriptszintű írás;
  - a több deklarációt tartalmazó utasítás;
  - a modulbetöltő importok egymáshoz és a többi utasításhoz képest.
- **Az orákulum szélesebb lokális írást enged** (paramétert, ciklusfejbeli `let`-et is), így ott completeness-rés maradhat.
- A natív JS/TS → Language IR v3 út továbbra sem szükséges; a Python a natív v3 úton marad (ADR-011).
