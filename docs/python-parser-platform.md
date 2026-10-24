# Python author parser – első implementált szelet

Kiindulás: a Language IR/v3 alap, a referencia-/próbajavítás és a Python-integrációs terv PR #2-ben mainre került (`b779c6c`). Az új `codex/python-authoring` ág az azonos közös checkoutban kezdte meg a [Python-terv](python-adapter-plan.md) megvalósítását. [ADR-005](adr/005-isolated-python-parser-port.md).

## Elkészült határ

- Author-only parserport: `src/author/python-parser.ts`, protokoll v1, Python grammar 3.14, CPython 3.14.2, Pyodide 314.0.7. A csomagverzió az npm-ben használt teljes verzió, nem Python-verzió. [Rögzített artifactmanifeszt](python-runtime-manifest.json).
- Node child process és böngészős module worker, közös request-/deadline-/cancel-/restart-/close-életciklussal. Lazy runtime, egyszerre legfeljebb 8 függő kérés; a megszakítás az azonos parserpéldány összes függő kérését hibával lezárja. Régi generáció válaszai nem kerülhetnek új kéréshez.
- Fix stdlib auditprogram: tokenizálás és lexikai budget, compiler/scope-audit, AST és symtable. A source függvényargumentum; nincs végrehajtása, importjainak betöltése vagy belőle kezdeményezett csomagletöltés. A parserport nem érhető el a jelenlegi termék/learner útból; külön negatív architektúrateszt védi ezt.
- Szigorú DTO-/válasz-/runtime-/forrás-/kérésazonosság-ellenőrzés. Az AST UTF-8 bájtos, a token és hibapozíció code point oszlopait **szándékosan natívan** adja vissza; ez még nem az IR UTF-16 source mappere.
- A runtime öt szükséges fájlja verzió-, méret- és SHA-256-ellenőrzés után a `test-results/python-site` fixture-hostba kerül. A termék `_site` artifactjába a parser runtime és a WASM ebben a szeletben nem kerül be. Pyodide és CPython upstream licencszövege megőrizve a `docs/licenses` alatt; a projekt saját licencstátusza változatlan.

A port Unicode source stringet fogad; CRLF/CR → LF konverziót végez, általános trimet nem. Korlát: 50000 UTF-16 kódegység, 500 fizikai sor, 2048 code point/sor; NUL, U+2028/U+2029 és pár nélküli surrogate nem támogatott. A már dekódolt stringben lévő BOM szintaktikai diagnosztika; a `.py` fájl importjának UTF-8/BOM/encoding-cookie szabálya PY-08 feladat. A nem UTF-8 cookie ebben a portban kommentadat, nem karakterkódolást választó utasítás.

A tokenizálás legfeljebb 64 egymásba ágyazott INDENT/zárójel és 50000 token keretét engedi; a DTO AST-/scope-/méretkorlátja további védelmet ad. A lexical preflight megelőzi a compilert: a túlmély zárójelezés Node és Chromium eltérő WASM stackhibája helyett közös `resource_limit` eredményt ad. Hibás forrásból a tokenizer csak szerzői diagnosztikát adhat, elfogadott DTO kizárólag teljes compile/AST/symtable audit után készül. A code objectet nem hajtjuk végre.

Az AST DTO előállítása is közös csomópont-/listahosszkeretet használ; a forrás- és tokenkereten belüli nagyon széles AST `resource_limit` diagnosztikát kap. A túl nagy szerializált válasz is erőforráshiba, a hibás protokollalak továbbra is `invalid_protocol`. A loader/runtime hibája lezárja az izolált actort, így a következő kérés ugyanazon parserporton új runtime-betöltést indíthat. Ezt valódi Chromium-teszt első modulbetöltésre adott 503 válasszal ellenőrzi; normál szintaktikai/erőforrás-diagnosztika után a működő runtime használható marad.

## Megismételhető bizonyíték

```sh
npm ci --no-audit --no-fund
npm run test:python
npm run test:browser:python
npm run check:all
npm run test:browser:all
```

A browserparancshoz a repository szokásos Playwright-környezete kell; `test:python` építi a helyi fixture-artifactot is. CI-ban a teljes Node-regresszió része a parserkör; az összes browser-suite után automatikusan fut a Node/Chromium parserparity is. A CI a hash-elt runtime-ot a lockfile-os npm installból veszi, működés közben nem CDN-ről.

A közös `tests/fixtures/python-parser-corpus.json` jelenleg 58 olvasható, névvel ellátott eset. Node és két browserhost minden AST-mezőt, tokent, scope-adatot és diagnosztikát teljes DTO-egyezéssel hasonlít. Témák: üres/comment-only forrás, Unicode/emoji/kombináló karakter, newline-változatok, EOF, nagy számok/bytes/complex/infinity/ellipsis, literál-whitespace, implicit/explicit folytatás, semicolon/inline suite, tab/formfeed/mixed indent, nested/global/nonlocal/closure, annotation és type-parameter scope, async/dekorátor, try/except*/else/finally, match/guard, comprehension/walrus/lambda, f-/t-string, mellékhatásosnak látszó de le nem futó program, érvénytelen kontrollátadás/scope és mélységkeret. Node alatt további 27 generált newline/indent/literal-kombináció, protokollrontás és erőforrás-/életciklus-eset fut.

A 3.14-es annotation scope-okat nem szűrjük ki. A suite nem új binding scope; a CPython scope-hierarchia nem helyettesíti majd az IR Python névfeloldási politikáját. Ez külön PY-04 döntési és regressziós feladat.

A helyi Windows/Chromium mérés egy futásában: Node cold ~1,34 s; scoped CSP worker cold ~1,47 s; Pages alútvonal cold ~1,51 s; korpuszon mért warm p95 ~1,6/2,0/2,5 ms. Az in-process Node-orákulum RSS-e ~52 → 134 MB, WASM heapje 30 MiB volt. Ezek mintamérések, nem SLA-k vagy kemény memóriakorlátok; a worker IPC és valódi feladatgenerálás költségét nem helyettesítik. A teljes UI-stresszkör után egy hideg worker túllépte az alapértelmezett 15 s határt; a platformparity teszt ezért explicit 30 s author-határidőt ad, a rövid deadline/cancel tesztek és a teljes DTO-egyezés megmaradnak. A port alapértelmezése 15 s, maximuma 60 s; a végleges author UX hideg betöltési kerete release-feladat. A browser worker teljes processzmemóriájára nincs hordozható mérés ebben a szeletben. A mindenkori részletes eredmény a CI diagnosztikai artifact `python-platform.json` fájlja.

A fő dokumentum CSP-je szigorú marad. Külön fixture igazolja: szigorú `script-src 'self'` alatt a worker nem használható, és deadline/hiba lezárja; csak a worker fő scriptjére adott `wasm-unsafe-eval` mellett működik, JavaScript `unsafe-eval` nélkül. Ugyanez alútvonalon és CSP nélküli statikus Pages-hoston is egyezik Node-dal. Minden külső hálózatkérés blokkolt, a runtime a helyi artifactból tölt. A már betöltött worker hálózat nélkül is auditál; hideg offline újratöltés/szervizmunkás nincs implementálva.

## Pontos taskstátusz és folytatás

| Task | Állapot |
| --- | --- |
| PY-01 | Könyvtári/platform kapu igazolt: runtime/grammar/hash, licencek, Node/Chromium parity, CSP, same-origin és idő/memória mintamérés. Éles worker-route CSP, üzemeltetési processzlimit és teljes kiadási licenc-/support-review a termékbekötés előtt még nyitott |
| PY-02 | Parserport és izolált életciklus implementálva, tesztelve; production bekötés még nincs |
| PY-03 | Következő: UTF-8/code point → UTF-16 source mapper, fizikai sorok és atomi unitok |
| PY-04–PY-05 | Nyitott: konténerek/binding/compound politika, konzervatív natív Python → IR adapter |
| PY-06–PY-10 | Nyitott: catalog/API, typed attempt/persistence, UI/editor/clipboard és kiadás |
| PY-11 | Opcionális, nyitott: külön bizonyított sorrendlazítás |

Ez **nem kész Python-adapter vagy Python-feladatkészítő**. Az 58+27 eset széles regressziós alap; nem a teljes Python grammar és minden kevert eset bizonyítása. A sor-/unit-/konténer-permutációs és tanulói termékregressziók PY-03–PY-09 alatt bővítik ugyanezt a példatárat.
