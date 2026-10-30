# ADR-040 – Ismeretlen hívás primitív argumentummal a metódustörzsben (v19)

Állapot: **elfogadva** (2026-10-30), szabályverzió `scoped-effect-analysis-v19`. A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 4. fázisának 2. tétele (2a–2c és 2e kész; a 2d, az objektumot átadó argumentum, nyitott).

## Kontextus

**A mért fő ok:** a generatív kampányban az indokolatlan elutasítások fő oka az `ExpressionStatement` barrier (510 eset a neighbourhood-mérésben).

**A konkrét minta:** egy metódus a törzsében ismeretlen globális függvényt hív primitív argumentummal, például `shout() { record('shout', this.name); }`. Az [ADR-025](025-local-object-effect-footprints.md) hatásnyom-értelmezése v18-ig ilyenkor feladta:
- az utasítás nem kapott hatásnyomot;
- az objektum megszökött;
- onnantól az objektum minden művelete barrier volt, és a független objektumok műveleteit is sorrendhez kötötte.

### Mit mond a szerződés (az orákulum P2/P3 szabálya)

Az első elképzelés az volt, hogy minden nem dobó, hatásnyomos utasítás felcserélhető egy ismeretlen hívással. **Ez ellentmond a szerződésnek, ezért elvetettük.**

- **Két saját objektumon végzett művelet:** a sorrendjüket az orákulum futtatással ítéli meg (P3). Ilyen pár például a `b.shout()` és az `a.add(1)`.
- **Listaszintű ismeretlen hívás:** például a `record('start')` külső hatás, és minden nem hatásmentes utasítással kötött marad (P2).

## Döntés

1. **Külső hívás:** a hatásnyom-értelmezés a metódus-, konstruktor- és accessortörzsben (és az ott futó nyílfüggvény-callbackben) elfogad egy `f(…)` hívást, ha:
   - `f` nem a törzs lokális neve vagy paramétere;
   - a program nem deklarálja `f`-et, vagy csak ambiensen (`declare function`);
   - `f` nem `eval` (a közvetlen `eval` látja a törzs `this`-ét és lokálisait), és nem `arguments`;
   - minden argumentum primitív érték, objektumreferencia és ismeretlen érték nélkül. Az argumentum olvashat saját mezőt (`this.name`), ez olvasási hatásnyom;
   - nincs spread-argumentum és opcionális hívás.

   A hatásnyom `external` jelölést kap, és `mayThrow` értéke igaz. A hívás eredménye ismeretlen érték (`OTHER`), amellyel végzett minden további művelet ismeretlen kód marad. Az objektum nem szökik meg.
2. **Ütközés** ([`footprintConflicts`](../../src/author/object-footprints.ts)):
   - két `external` hatásnyom kötött, új indokkóddal: `external-call-order` (`effect`);
   - egy `external` hatásnyom kivételként viselkedik akkor is, ha a hívást `try/catch` fogja meg, mert a külső kód nem is térhet vissza. Egy másik esetleg dobó hatásnyommal ezért `may-throw` köti;
   - egy elkapott (nem dobó) külső hívás és egy lokális írás csak akkor kötött (`external-call-order`), ha az írás a függvényen kívül deklarált kötést olvas, mert azt a külső kód átírhatja;
   - a többi pár az eddigi szabály szerint dől el: objektumütközés vagy két lehetséges kivétel köti.
3. **Listaszintű ismeretlen hívás:** barrier marad, a P2 szerint (a lista saját szintjén `frame.self` nincs).
4. **Szabályverzió:** v19. A régi címkéjű modellek változatlanok, újragenerálás csak explicit frissítésre történik.

## Helyességi érv

- **A saját objektum nem érhető el a külső kódból:**
  - csak a lista saját, meg nem szökött objektuma kap hatásnyomot;
  - minden saját objektum neve a listában van, és a beágyazott függvényben való említés szökés;
  - a külső kód csak primitíveket kap, és a program nem deklarálja, így nem closure-e a listának.
- **Kivétel és nem-terminálás:** a dobó vagy véget nem érő külső hívás után a saját objektum állapota nem figyelhető meg, mert a lista `return`-je nem fut le. Ami ilyenkor megfigyelhető (melyik kivétel, illetve kivétel vagy végtelen futás), azt a `may-throw` köti.
- **Külső hatások:** a nyomkövetés és a globális állapot sorrendjét két külső hívás között az `external-call-order`, listaszintű hívással szemben a barrier-szabály őrzi.
- **Környezeti feltevés:** a külső kód a program környezetéhez tartozik, és nem írja át a program saját osztályait vagy a beépített prototípusokat. Ugyanezt a feltevést teszi a hatásnyom már a v12 óta, például a `push` értelmezésekor. A reflektív forrásszöveg (`.prototype`, `Reflect`, `Proxy` és társai) továbbra is kikapcsolja a hatásnyomokat.

## Bizonyítékok

- **Orákulum-igazítás:** a független orákulum statikus P2-je eddig sorrendhez kötötte az objektumműveletet és a lokális írást. A v12 szerződéssora szerint ezek kommutálnak, ha a művelet nem dob. Mostantól a P2 ezt a párt csak névütközés alapján köti, a többit a P3 futásidejű összevetése dönti el, ahogy két objektumművelet esetén is. Az eltérés v12 óta fennállt, csak a mért programokban nem volt lokális írás objektumművelet mellett. A korpusz- és a generatív mérés változatlan.

- **Tanúk:** [escape-programs.mjs](../../tests/fixtures/escape-programs.mjs) és [escape-witnesses.test.mjs](../../tests/escape-witnesses.test.mjs), mindegyik orákulummal ellenőrizve:
  - `escape-free-shout-beside-writes`: v18-ban 11 indokolatlan elutasítás (10 `ExpressionStatement`), v19-ben 0;
  - szabad párok: rögzítő konstruktor, rögzítő callback, elkapott külső hívás, függvénylokálist olvasó lokális írás, ambiens TypeScript-függvény;
  - konzervatív (orákulum szerint egyenértékű) pár: elkapott külső hívás és szkriptszintű kötést olvasó lokális írás (`external-call-order`);
  - kötött párok: listaszintű hívás (`ExpressionStatement`), két külső hívás (`external-call-order`, a konstruktorban is), külső hívás és dobás (`may-throw`, elkapott hívással is), callback és írás (`object-read-after-write`);
  - ismeretlen marad: közvetlen `eval`, objektum argumentum, a program által deklarált hívott függvény, paraméterrel árnyékolt név.
- **Indokkód-bizonyíték:** az `external-call-order` indokolt, a `prompt-unknown-call` fixture két `activate()` hívásának cseréje.
- **Gyors generatív mérés** (indokolatlan elutasítási arány, v18 → v19):
  - JS objektumprogramok: 26,6% → 10,9%;
  - JS objektumprogramok dobó referenciával: 43,2% → 32,4%;
  - TS objektumprogramok: 11,3% → 0%;
  - TS objektumprogramok dobó referenciával: 16,7% → 3,3%;
  - a többi csoport változatlan, nincs hibás elfogadás.

## Nyitott kérdések

- **2d – objektumot átadó argumentum:** például `record(this.log)`. Ez ma szökés, mert a külső kód megtarthatja és később módosíthatja a referenciát.
- **A program által deklarált hívott függvény:** a törzse elemezhető volna (a 3. tétel hatásösszegzése).
- **Beépített globálisok:** a tiszta beépítettek (például `Math.max`) külön kódcsaládot kaphatnak. Ma a tulajdonságon át hívott függvény ismeretlen kód, a puszta névvel hívott beépített (például `String(x)`) külső hívás.
