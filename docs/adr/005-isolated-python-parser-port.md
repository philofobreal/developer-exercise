# ADR-005 – Izolált CPython szerzői parserport, első Python-szelet

Állapot: első könyvtári szelet implementálva és platformon ellenőrizve; termékbekötés/release még nyitott. Alap: main `b779c6c`, a PR #2 merge-je után; közös checkout, `codex/python-authoring` ág. A [Python-terv](../python-adapter-plan.md) PY-01/PY-02 feladata indult el. PY-03–PY-11 és a teljes Python termékfunkció továbbra is külön munka. [Pontos bizonyíték és nyitott feltételek](../python-parser-platform.md).

## Döntés

Rögzített Pyodide 314.0.7 / CPython 3.14.2 parser, Node-ban saját child processben, böngészőben module workerben. Ugyanaz a fix author-audit lekérdezés használ ast/tokenize/symtable-t; a forrás argumentum, nem végrehajtandó script. A parser eredménye verziózott, szigorúan ellenőrzött, JSON-szerializálható AST/token/binding DTO. A Python-adapter később ebből képez IR-t; a core és a tanulói kiértékelés nem importál parsert.

Az infrastruktúra strict TS a src/python alatt; a parserport és DTO a src/author/python-parser.ts-ben. A fix CPython auditprogram egy megbízható, verziózott lekérdezésszöveg TS-konstansban, nem a felhasználótól érkező program. Csak ez a konstans adható runPython-nak; később a betöltött auditfüggvény kapja a source stringet argumentumként. Nincs exec/eval/literal_eval, source-import vagy source-ból származó csomagletöltés. A compile csak szerzői scope-/szintaktikai audit, az előálló code objectet nem hajtjuk végre.

Időtúllépés, AbortSignal és close megszakítja az izolált folyamatot/workert. Az ugyanabban a parserpéldányban függő kérések együtt hibával lezárulnak; új kérés friss runtime-ot indíthat. A megszakítás nem tanulói minősítés. A worker nem teljes biztonsági sandbox; az erőforráskorlátok és a megbízható parserprogram tartják szűken a feladatot.

## CSP és artifact gate

A helyi Chromium-próba a meglévő script-src self policy mellett nem tudott runtime-ot indítani; a folyamatot külső határidő zárta le. Ugyanaz a kód kizárólag a worker válaszára tett script-src self + wasm-unsafe-eval mellett működött, JavaScript unsafe-eval nélkül. A fő alkalmazás biztonsági fejléce változatlan. Ebben a szeletben nincs új production HTTP végpont vagy UI-opció: a worker CSP-policy és Node/Pages parity külön helyi fixture-hostban, valódi Chromiumban igazolt platformkapu. A termékbekötés PY-06/PY-08 feladata.

A runtime npm lockfile-ban rögzített; a build hash-manifesztből ellenőrzi és a tesztfixture-be helyben másolja a szükséges fájlokat. Nincs runtime CDN-hozzáférés. A teljes programcsomagot nem tesszük Gitbe vagy az eddigi Pages artifactba; a parser-probe artifact a test-results alatt készül. A meglévő build-pages.mjs kizárólag packaging wiringként kizárja a dist/python könyvtárat, ezt artifactteszt védi. Licencek és upstream forrásazonosság megőrizve.

## Ellenőrzés és következő határ

Node/Chromium ugyanazt a DTO-t kell adja (runtime/grammar, Unicode, tokenek, AST és binding scope). Szintaktikai hiba, top-level return/break és global/nonlocal scope-audit, payload-korlát, malformed DTO, cancellation/timeout/restart és mellékhatásmentesség regressziót kap. A JS/TS és a v2/v3 mag teljes kapui megmaradnak.

A DTO nem CodeLineExercise és nem IR. Ebből a commitból még nem következik Python feladatgenerálás, UI-választó, unit-drag, session v3 vagy megengedett sorrendlazítás. A rögzített taskstátuszok a Python-tervben és a platformbizonyíték dokumentumában lesznek frissítve.
