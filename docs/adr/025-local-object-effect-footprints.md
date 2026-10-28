# ADR-025 – Helyi objektumok hatásnyoma: soronként valódi függőségek (v12)

Állapot: implementálva (2026-10-28). Policyverzió: `scoped-effect-analysis-v12`. Pontosította: [ADR-028](028-runtime-precise-object-footprints.md) (v13: mezőszint, `if/else`, string-metódusok, egyetlen kivétel). A validátor, a CodeLine-séma és a tanulói parsermentes értékelés változatlan.

## Kontextus

A felhasználó azt kérte (2026-10-28), hogy a generátor úgy építse fel a függőségi gráfot, ahogy egy LLM tenné a felhasználó „CodeLine v2 futásidejű függőségmodell” mesterpromptja alapján. A prompt fájlja a felhasználó gépén van, ez a repó nem tartalmazza; a prompt specifikáció, nem futásidejű szolgáltatás. A kérés lényege:

- **Soronként:** minden sor szemszögéből a ténylegesen szükséges megelőző sorok.
- **Pontos mennyiség:** se indokolatlanul sok, se túl kevés kapcsolat.
- **Hűség:** az elrendezés pontosan ott romoljon el, ahol a program viselkedése is megváltozna.

A prompt a helyességet a megfigyelhető viselkedéshez köti: visszatérési érték, objektumállapot, tárolók tartalma és sorrendje, mellékhatások, kivételek. Konkrét referenciaesetet is ad:

- **Kötelező:** `first.alias = …` → a `store.list()` megfigyelés, valamint `store.add(first)` → `store.add(second)`.
- **Nem kötelező:** `first.alias` → `store.add(first)`, ha a tároló csak referenciát tárol, és `first.alias` → `second.activate()`, ha a két példány bizonyítottan különböző.

A mai elemző (ADR-008, -013, -019) minden mellékhatásos utasítást (hívás, mezőírás, `new`) **barrier**-nek vesz. Egy listán belül a barrierek egymáshoz képest teljes forrássorrendben állnak, ezért a fenti szabadság egyike sem érhető el. A metódustörzsek nem látszanak, ezért a hívás ismeretlen. Ez a túlkötés fő forrása.

## Döntés

### 1. Hatásnyom egy függvény utasításlistájában

Egy függvénykörnyezet utasításlistáján (a script/modul szintje kivétel, mint az ADR-019-ben) a barrier-utasítások egy része **hatásnyomot** kap: mely helyi objektumokat olvassa és írja, dobhat-e kivételt, és fut-e ismeretlen kód.

**Helyi objektum:** egy `const x = new C(…)` vagy `const x = []` lefoglalás az adott listában, ahol:

- `C` a fájlban deklarált, elemezhető osztály;
- `x` csak elemezhető műveletekben szerepel: fogadóként, elemezhető metódus argumentumaként, vagy a lista `return`-jében.

Minden más előfordulás **szökés**: ilyenkor az `x`-et érintő utasítások hatásnyoma ismeretlen.

**Elemezhető utasítás:**

- `const x = new C(a…)`: a konstruktor törzse, `this = x`;
- `x.f = v`: setter vagy deklarált mező írása;
- `x.m(a…)`: az `m` metódus törzse;
- `x.push(v)` egy helyi tömbön.

Az argumentum primitív literál, primitív `const` vagy helyi objektum lehet.

**Elemezhető törzs:** csak ezeket tartalmazza:

- `this` mezőinek olvasása és írása;
- a mezőkben tárolt, a törzsben vagy a konstruktorban létrehozott tömbök ismert metódusai: `push`, `map`, `filter`, `join`, `length`, `includes`, `indexOf`, `slice`, kifejezéstörzsű nyílfüggvény-callbackkel;
- paraméterek tárolása;
- az elemek mezőinek és gettereinek olvasása;
- saját elemezhető metódus hívása;
- `if`, helyi `const` és `throw new Error(…)`.

Minden más (globális vagy ismeretlen hívás, `record`, `console`, statikus állapot, implicit konverzió objektumon, `extends`, prototípus-módosítás a fájlban) ismeretlen kódnak számít, és az utasítás barrier marad.

**Tartalmazás:** a tárolt referenciák (paraméter mezőbe vagy tömbbe) folyamatérzéketlen *tartalmazás* relációt adnak. Ha egy törzs a tartalmazott elemek mezőit olvassa, az a tartalmazott objektumok olvasása. Például a `store.list()` a `first` és a `second` aliasát olvassa.

### 2. Mikor kommutál két utasítás

Két hatásnyommal rendelkező utasítás akkor cserélhető fel, ha:

- **nincs objektumütközés:** egyik sem írja azt, amit a másik olvas vagy ír (RAW, WAR, WAW objektumszinten, a tartalmazással kiterjesztve);
- **nincs kivételhatás:** egyik sem dobhat;
- **nincs kötésütközés:** a kötésszintű ütközés (ADR-013) is hiányzik.

A kötésbemenet (`x` deklarációja → `x` használata) védett élként megmarad. A `return`, a vezérlésátadás, az ismeretlen kód és minden más barrier változatlanul rendez. A tiszta egységek és a barrierek viszonya az ADR-019 szerint marad.

### 3. Megjegyzések

Egy megjegyzés áthelyezése a programot sosem rontja el, ezért az egyetlen, teljes megjegyzést tartalmazó fizikai sor szabad a saját blokkján belül. Ez utasításlistában és osztálytörzsben egyaránt érvényes.

Kötött marad:

- egy többsoros `/* … */` megjegyzés minden sora, mert a belseje kóddá válhatna, vagy kód válhatna megjegyzéssé;
- az irányelv-megjegyzés (`@ts-`, `/// <…>`, `//#`, `@jsx`), mert a szomszédjára hat;
- a JSDoc (`/** … */`), mert az utána álló deklarációt dokumentálja, és eszközökre, deklarációs emitre (`@internal`) vagy JS-típusellenőrzésre is hat. A nyilvános TS-mintatár „14-comments” példája ezt rögzíti.

A felismerés a fordító saját megjegyzés-tartományaiból dolgozik, nem szövegmintából (`comment-rows.ts`). Ha a szerző egy megjegyzést helyhez akar kötni, szerzői szabályt vesz fel rá (ADR-018, a kapcsolatkapcsolóval egy mozdulat, ADR-024).

### 4. Független orákulum

A független orákulum P2 szintje egy szintaktikus kivételt kap. Két „helyi objektumművelet” sorrendjét nem a P2, hanem csak a futásidejű P3 dönti el.

- **Helyi objektumművelet:** a fogadó azonos listában `new` + helyi osztály vagy `[]` által lefoglalt `const`, az argumentumok azonosítók vagy literálok.
- **Megfigyelés:** a P3 a visszatérési értéket, a kivételt, a `record` naplót, valamint a helyi objektumok teljes végállapotát (JSON) hasonlítja össze.
- **Függetlenség:** az orákulum hatásnyomot nem számol. A generátor elemzésétől független marad, és a futásidejű összevetés a bizonyíték.

### 5. Bizonyíték

- **A prompt referenciaesete:** a `build()` törzse 7 utasítás, 5040 lehetséges sorrend. A v12 pontosan 136-ot fogad el, és a futásidejű orákulum szerint pontosan ez a 136 viselkedik az eredetivel azonosan: itt se fölösleges, se hiányzó kapcsolat nincs. A v11 ugyanitt 1 sorrendet engedett.
- **Generált függőségek:** `first.alias` ← `first`; `store.add(first)` ← `first`, `store`; `second.activate()` ← `second`; `store.add(second)` ← `second`, `store`, `store.add(first)`; `return` ← minden hatás.
- **[object-programs.mjs](../../tests/fixtures/object-programs.mjs)** (8 minta) és **[object-footprints.test.mjs](../../tests/object-footprints.test.mjs)**:
  - kötött marad: a másoló tároló, a megosztott napló, két dobó utasítás, ismeretlen kód, alias, a deklaráció előtti használat és a `return` utáni hatás;
  - minden mintán minden egysoros mozgatás, amelyet a modell elfogad, megőrzi a viselkedést;
  - 13 generált program, 981 elfogadott sorrend: mindegyik ekvivalens.
- **Generatív kampány** (`--kinds=object`, 60 JS és 60 TS program): 473 836 sorrend, 21 770 elfogadott, **0 hibás elfogadás**.
- **Korpusz** (64 minta, 17 273 sorrend): 0 hibás elfogadás. A rés (34) és az elfogadások száma változatlan, mert a korpuszban nincs helyi objektum.
- **Frissített elvárások:** csak a policycímke (v11 → v12) és a megjegyzés-szabály. Ahol egy teszt a megjegyzést használta konzervatív példának, ott többsoros megjegyzést kapott, az egysorosra pozitív állítás került.

## Korlátok

- A tartalmazás folyamatérzéketlen, ezért konzervatív: egy objektum, amelyet a lista bármely pontján tárolnak, mindenhol tartalmazottnak számít.
- Az öröklés, a statikus állapot, a closure-ök, az aszinkron kód és a nem saját metódusok nem elemzettek, ezek barrierek maradnak.
- A script- és modulszint nem kap hatásnyomot.
- Az irányelv-megjegyzés (például `// @ts-ignore`) a következő sorra hat, de a CodeLine v2 a szomszédságot nem tudja kifejezni. Ha két utána álló utasítás felcserélhető, az irányelv a másikra kerülhet; ez a v12 előtt is így volt.
- A típusellenőrzés (TypeScript) és a futás közben ismeretlen környezet (beépített prototípusok módosítása) feltevései: a fájl nem módosít prototípust, és nem használ reflexiót. Ha mégis, a hatásnyom teljesen kimarad.
