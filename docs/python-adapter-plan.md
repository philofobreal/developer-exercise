# Python-adapter és termékintegráció – megvalósítási terv

Állapot: kizárólag terv, 2026-10-24. Python parser, adapter, függőség vagy nyelvválasztó-opció ebben a változásban nem készül. A [Language IR alap](language-engine-migration.md) T01–T07 eredménye és az [ADR-003](adr/003-language-ir-and-codeline-v3.md) a kiindulópont. A korábbi P01–P03 feladatot az alábbi PY-taskok bontják végrehajtható részekre.

## Döntési javaslat

A Python szerzői elemzés CPython `ast`, `tokenize`, `symtable` komponensekre épüljön, ne JS/TS-transzpilációra vagy behúzást találgató regexekre. A Python-adapter strict TypeScriptben fordítsa a verziózott parsereredményt Language IR v1-re. A referenciát a meglévő `LanguageEngine` és v3 compiler fogadja be. A tanulói validátorhoz ne kerüljön Python runtime vagy új nyelvspecifikus algoritmus.

Az egységes Node/Pages működés első vizsgálandó megoldása ugyanaz a rögzített Pyodide/CPython build mindkét author környezetben: Node-ban izolált parserfolyamat, böngészőben modul-worker. A letöltés, worker/process és timeout infrastruktúrát a composition root rejti egy parserport mögé; a core és a nyelvi algoritmus nem importál Node-, hálózati vagy DOM-eszközt. A hivatalos worker API ezt az elkülönítést támogatja; a worker a UI válaszkészségének védelme, önmagában nem biztonsági sandbox. [Pyodide worker dokumentáció](https://pyodide.org/en/stable/usage/webworker.html).

A kutatáskor ellenőrzött jelölt Pyodide 314.0.7; a 314-es sorozat Python 3.14-re váltott. Az első cél ezért Python 3.14, nem egy meg nem határozott „Python 3”. PY-01-ben a tényleges runtime patchverziót, artifact hash-t, csomaglicenceket, Node- és Chromium-kompatibilitást kell rögzíteni; az oracle ugyanazt a Python-verziót használja. A mai CI Python 3.13-as browser-tesztinfrastruktúrája ettől külön fogalom. [Pyodide kiadási jegyzetek](https://pyodide.org/en/stable/project/changelog.html).

Ez ajánlott megoldás, még nem méréssel elfogadott függőségválasztás. Ha a CSP, helyi/offline csomagolás, memória vagy betöltési költség nem felel meg, PY-01 lezárása helyett új ADR szükséges. Tartalék a szerveroldali natív CPython ugyanazon parserprotokollal, és a Pages Python-autorálás őszintén letiltott capability-je a parity elkészültéig. Más grammarre történő néma fallback nem megengedett. Egy alternatív TS/WASM parser külön CPython-differenciáltesztet és scope-auditot igényelne.

## Feldolgozás, végrehajtás nélkül

Az author worker fix, verziózott parserprogramot töltsön be. A forrás argumentumként/JSON-adatként jusson bele; ne legyen scriptbe interpolálás, forrásból importált modul, `loadPackagesFromImports(source)`, `exec(source)`, `eval(source)` vagy tanulói kód futtatása. A megoldásellenőrzés egyáltalán ne érje el ezt a portot.

A szerzői audit lépései:

1. Meglévő 50000 karakteres forrás-, 500 fizikai soros és sorhosszkorlát ellenőrzése; LF-konverzió, a literalpayload whitespace-ének megőrzésével, általános trim nélkül.
2. `ast.parse` a rögzített grammarrel. Külön compiler/scope-audit is kell: az AST önmagában például elfogadhat környezetében érvénytelen `return` utasítást. A teljes `compile` ellenőrzés csak szerzői adatból, végrehajtás nélkül készíthet eldobott code objectet; ez nem `exec` hívás. Ezt explicit author határ és negatív teszt védje. [CPython AST auditkorlátok](https://docs.python.org/3.14/library/ast.html#ast.parse).
3. Tokenizálás a már auditált forráson, kommentekkel, logikai/fizikai sorhatárokkal és INDENT/DEDENT eseményekkel. Hibás vagy félkész tanulói programra nem használjuk; a hivatalos tokenizer szerződése is érvényes Python-forrást feltételez. [tokenize](https://docs.python.org/3.14/library/tokenize.html).
4. Kötési elemzés `symtable` és AST együttműködésével. Az adapter eredménye nem a runtime környezet szimulációja. [symtable](https://docs.python.org/3.14/library/symtable.html).
5. DTO alak-/verzióellenőrzés → strict TS IR-projekció → `compileCodeLineExerciseV3` → referenciasorrend önellenőrzése → atomi admission. Bármely hibánál a korábbi alkalmazott feladat/próba megmarad.

A parserport javasolt kérése: protokollverzió, requestId, source, grammarVersion. Válasza: runtimeVersion, AST/token/binding DTO és helyhez kötött diagnosztika; AST-könyvtári objektumot, Python-proxyt, code objectet nem ad át a renderernek. A DTO séma külön author-protokoll, nem új grading-szabály. Időtúllépéskor a worker/folyamat megszakítható és újraindítható; ez author hiba, nem hibás tanulói megoldás.

## IR-leképezés és szükséges modell-döntések

| Python-eset | Tervezett reprezentáció és elfogadási feltétel |
| --- | --- |
| Fizikai sor | Eredeti tartalom, `normalization: exact`, félig nyílt UTF-16 source span. Nem `ast.unparse` vagy `untokenize` visszagenerált szöveg |
| Többsoros kifejezés, explicit/implicit folytatás | Az összes fizikai sor egy atomi unit, belső sorrend és szomszédság kötelező |
| Többsoros string, docstring, f-string/t-string | Payload, üres sorok, tabok és eredeti karakterek megőrizve; az eredeti source slice a hiteles szöveg, nem a token visszaírása |
| Dekorátor és többsoros fejléc | Összefüggő dekorátorlista és dekorált fejléc egy unit; a hozzá tartozó kommentekkel együtt |
| `if/elif/else`, loop/else, try/except/else/finally, with | Suite-onként syntactic container; clause-fejlécek sorrendjét explicit élek védik. Ezek nem pusztán indentation-mélységek |
| INDENT/DEDENT, EOF | Unit before/after határesemények; EOF-nál az utolsó valódi unit után belülről kifelé zárunk. Nem készül mesterséges `}` vagy sentinel-sor |
| Module/function/class, closure, comprehension | Külön binding scope adatok. Az `if` suite nem új névtér. A class és a metódus névfeloldását nem lehet egy egyszerű szintaktikai parent-walkkal helyettesíteni |
| Egysoros suite, pontosvesszős több utasítás | Egyetlen, szét nem vágható fizikai unit. Nem fabrikálunk virtuális source sorokat vagy több draggable elemet egy fizikai sorból |
| Komment/üres sor | Multiline literalban mindig payload. Egyébként dokumentált, determinisztikus kötés a következő utasításhoz; fájlvégi komment az előzőhöz. Önkényesen lebegő komment nincs az első kiadásban |
| Ismeretlen/összetett konstrukció | Teljesen auditált forrásnál konzervatív, eredeti sorrendű atomi egység, vagy konkrét „nem támogatott autorálás” diagnosztika. A forrásra vagy scope-ra vonatkozó részleges találgatás nem kész eredmény |

A source mapper külön kockázat: az AST oszlop UTF-8 byteoffset, a tokenizer oszlop Unicode code point, a projekt IR-je UTF-16. Soronkénti, tesztelt konverzió kell; a tab karakteroffset és vizuális indent nem azonos fogalom. Kötelező fixture: magyar ékezet, emoji, kombináló karakter, CRLF, tab, BOM/encoding cookie. A forrásfájlok első körben UTF-8-ként importálhatók, ettől eltérő encoding egyértelmű diagnosztikát kap. [AST koordináták](https://docs.python.org/3.14/library/ast.html#ast.AST), [tokenizer koordináták](https://docs.python.org/3.14/library/tokenize.html#tokenize.TokenInfo).

A binding scope IR-parent hierarchiája metaadat; nem tudja önmagában a Python összes lookup-szabályát. Egy uniton belüli comprehension, default argument, annotation vagy dekorátor több kötési környezetet is érinthet. Ezek feloldása az adapter belső AST/symtable tudása marad; az IR unit.bindingScopeId a unit külső értékelési környezete, a belső olvasásokból csak igazolt unit-élek kerülnek ki. Nem erőltetünk minden AST node-ot egyetlen, újraértelmezett scopeId-ba. [Python névkötési modell](https://docs.python.org/3.14/reference/executionmodel.html).

A headerhez kötött nyitó esemény és a body-unitok containerId-ja már megőrzi a suite-tagságot; a clause-sorrend külön éleket igényel. Korlát viszont, hogy az EOF záró eseménye ma konkrét utolsó unithoz kötődik. Ha később éppen ezt a unitot is szabadon mozgatnánk a törzsön belül, a zárás vele mozdulna, és egyébként helyes sorrendek is elutasíthatók lennének. Az első kiadás serial politikája ezt elkerüli. A lazítás előtt explicit EOF/compound-end anchor vagy dokumentált végső unit szükséges, kompatibilitási ADR-rel és negatív/pozitív oracle-tesztekkel. Nem oldjuk meg mesterséges tanulói zárósorral.

## Dependency- és behúzási politika

Az első Python kiadás eredeti sorrendet követelő, konzervatív unit-DAG-ot generál. A scope- és binding-adatok már ekkor pontosak, de nem szolgálnak indokolatlan sorrendlazításra. Assignment nem JS `const`: egy név újraköthető, olvasása lehet UnboundLocalError, annotáció/dekorátor/default argument és osztálytörzs is járhat hatással. Hívás, import, attribútum/indexelés, mutáció, async/yield, kivételkezelés és ismeretlen művelet sorrendi korlát marad. A `global`/`nonlocal`, comprehension és match binding külön regressziót kap.

Később önálló PY-11 feladat engedhet szűk, bizonyítottan biztonságos részhalmazt. Kézi profil/DAG szerkesztés szerzői döntés marad, ugyanazzal a szemantikai felelősséggel, mint JS/TS-ben. Az ellenőrző továbbra is tartalmi bijekciót, unitot, konténert, fixed pozíciót és profiléleket vizsgál, egy közös bounded budgettel.

Pythonban a render policy `semantic / preserve / tabWidth: 4`; minden sor exact. Nincs JS Beautify vagy toleráns JS/TS lexical indenter. A referencia editor Tab-beállítása 4, a JS/TS meglévő 5 szóköze megmarad. A próba élő renderje nem indentál át; a clipboard és export pontos forrássorokat őriz. A kezdeti plugin `format: false` capability-t ad: a teljes dokumentum formázása külön, később auditált formatterport, nem csendes whitespace-módosítás.

## Termék- és tárolási integráció

A jelenleg javított referencia-/megoldás-munkafolyamat marad: 01 a feladat és szabályai, 02 annak próbája. A Python-választó csak akkor jelenjen meg, ha a parser capability ténylegesen elérhető; betöltés, megszakítás és konkrét hiba látszódjon. A worker és WASM csak Python-autoráláskor töltődjön; JS/TS és meglévő feladat megnyitása ne töltsön Python runtime-ot. A referenciaforrás teljes elemzése kizárólag alkalmazáskor/explicit author műveletben történjen.

A v3-at nem lehet egyszerűen a mai v2 attemptnek átadni: többfizikaisoros unit, string ID és eltérő source-/solution-pozíció van. A typed attempt domainben a mozgás unit-szinten atomi, a render/gutter fizikai sorszintű; a fixed unit fizikai tartománya rögzített. Native, pointer, touch, keyboard és sorvezérlő ugyanazt az insertion API-t használja. A beküldés a sorok lapított string[] tartalma, kliens-ID-igazolás nélkül.

A v3 session új, explicit verziót és unit/row ID-ellenőrzést kap; a v1/v2 meglévő export/import olvasható marad. Report, trusted gráf vagy runtime AST nem importálható hiteles szabályként. V3 → v2 automatikus downgrade nincs. A szerver catalog verziódiszkriminált, klónozott admission snapshotot tartson; az API új verziózott megjelenítési envelope-ot adjon, a régi v2 kliensprotokoll megtartásával. Pages ugyanezt a compiler/validator kódot használja, Local Demo státusszal.

A Pyodide fájlok rögzített helyi buildartifactként, licencekkel és hash-manifesztben kerüljenek be. Nincs élő CDN-, pip- vagy tanulói importból kezdeményezett csomagletöltés. A CSP és WASM működése release gate; nem oldjuk meg globális unsafe-eval engedélyezésével. [Pyodide helyi terjesztés](https://pyodide.org/en/stable/usage/downloading-and-deploying.html).

## Taskok és elfogadási kapuk

| Task | Függőség | Konkrét eredmény / kész feltétel |
| --- | --- | --- |
| PY-01 – parser/platform spike és ADR | T01–T07 | Rögzített runtime/grammar/hash/licenc; Node/Pages azonos diagnosztika és AST; CSP/offline, cold/warm idő és memória mérve. E nélkül nincs nyelvi feature bekapcsolva |
| PY-02 – parserport és erőforráshatár | PY-01 | Strict DTO/verzió, worker/process életciklus, requestId/cancel/timeout; source mint adat; stale válasz nem aktivál feladatot |
| PY-03 – source mapper és unitok | PY-02 | UTF-8/code point/UTF-16 konverzió; multiline literal/folytatás/dekorátor/komment; minden fizikai source tartalom auditálva |
| PY-04 – konténer/binding/compound politika | PY-03 | INDENT/DEDENT/EOF; suite vs binding scope; clause ownership negatív tesztek; unsupported-policy és scope-metaadat jelentése ADR-ben |
| PY-05 – konzervatív natív adapter | PY-04 | `language: python`, IR v1, v3 admission, serial DAG és author diagnostics; referenciasorrend elfogadva, megváltozott payload elutasítva |
| PY-06 – verziózott catalog/API | PY-05 | Trusted/preview/local-demo határ; v2/v3 fordítás és display envelope; learner evaluate Python parserportja tiltott/teszttel lehetetlen |
| PY-07 – typed unit attempt és persistence | PY-06 | Atomi unit-insertion/fixed, v3 session integritás, v1/v2 visszaolvasás; régi mentések változatlanul működnek |
| PY-08 – UI, editor és clipboard | PY-07 | Capability-vezérelt nyelvválasztó, Python 4/JS 5 Tab, preserve render, helyi syntax highlight; source/JSON/próba ugyanahhoz a feladathoz kötve |
| PY-09 – Node/Pages oracle és browser mátrix | PY-03–PY-08 | Alábbi tesztek zöldek; régi JS/TS suite teljesen megmarad; pontos runtime- és support-manifeszt |
| PY-10 – fokozatos kiadás | PY-09 | Feature flag, példafeladatok, dokumentált támogatási mátrix, tested Pages artifact; adatvesztés nélküli visszaállítás és emberi architektúra-review |
| PY-11 – opcionális sorrendlazítás | PY-10 | Önálló bizonyított részhalmaz és független orákulum; nem feltétele az első korrekt Python-kiadásnak |

Nincs automatikusan vállalt naptári határidő: PY-01 mérése és a választott támogatási részhalmaz után becsülhető felelősen. Javasolt mérési cél a forráskorláton belüli meleg autorálás p95 egy másodpercen belül és nem blokkolt UI; a hideg WASM-betöltés külön mérőszám. A böngészőn nem ígérünk mérés nélküli kemény memóriakorlátot; a szerveren a parserfolyamat OS-szintű erőforráskorlátozása a telepítési feltétel része.

## Tesztmátrix és kész definíció

- Parser: helyes/hibás grammar, scope-audit, `return`/`break` környezet, mixed indent, tab/space, BOM, új grammarverzió elutasítása, túl mély vagy nagy source és timeout. A Python program mellékhatását jelző fixture author audit után sem fut le.
- Forrás: Unicode, CRLF, hiányzó végső newline, stringpayload üres sora, f-/t-string, dekorátor és többsoros fejléc; a token-stringből történő visszaépítés helyett byte-/karakterpontos source roundtrip.
- Struktúra: if/elif/else, loop/else, with, try/except*/else/finally, match/case, nested def/class, EOF több DEDENT, egysoros suite. Tiltott sibling suite-csere, elvándorló clause, szétszakított unit és áthelyezett fixed unit.
- Binding: shadowing, module/function/class, closure, global/nonlocal, comprehension, annotation/default/decorator; Python namespace nem JS blokkscope. A bizonytalan részhalmaz nem kap szabadabb DAG-ot.
- Validátor: független unit-permutációs orákulum kis fixture-ökön; tartalmi multiplicitás, több szükséges előzmény, profilszabályok, exact indent, közös budget és indeterminate. A natív Python compile-orákulum csak fix, korlátos tesztforráson futhat, nem tanulói értékelésként.
- Böngésző: Node és Pages alútvonal, offline assetek, késői worker-válasz, libraryváltás, source/JSON draft, pointer/touch/keyboard, hosszú és többsoros unit, scroll, gutter, clipboard, session és mobilnézet.
- CI: régi `check:all` + összes browser-suite, parserparity, licenc/hash, generated-source gate, v2 mentés és új v3 példamodellek publikálási auditja; kizárólag a tesztelt artifact telepíthető.

Az első Python verzió csak PY-01–PY-10 után kész. Az adapter könyvtári működése PY-05-nél még nem teljes termékintegráció. Az általános szemantikai ekvivalencia és a Python minden jövőbeli verziója nem része a kész definíciónak. Ebben a munkában az összes PY-task tervezett, implementációjuk nem indult el.
