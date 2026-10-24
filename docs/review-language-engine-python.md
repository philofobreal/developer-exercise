# Language Engine, munkafelületek és Python parser – review

Dátum: 2026-10-24. Hatókör: a `96da72e8241a2c99e13053dfcfd9797e2bdc3060` main-alaptól a `87f64578e8126f2c6b099253e671734a3fbd4047` Python-parser commitig készült fejlesztés, majd az alábbi javítások második átnézése. Ez a közreműködő által végzett kód-/dokumentációreview és reprodukció; nem független emberi jóváhagyás vagy formális helyességbizonyítás.

## Lefedett határok

- IR/v3 típusok és sémák, compiler/lowering, unitpartíció, virtuális konténerek, binding metaadat, fixed/profil/budget és v2 bridge kompatibilitás; renderterv és display-határ.
- Typed adapterregiszter, async portok és atomi author admission; referencia-/megoldásdraft, könyvtárváltás, input-/fájl-/clipboard-/hálózati folytonosság; Node/Pages wiring és bizalmi határ.
- Python source-as-data audit, strict protokoll/DTO, rögzített verzió/hash/licenc, lexical/AST korlátok és process/worker deadline-/cancel-/restart-életciklus; tesztcsomagolás és CSP.
- AGENTS/governance, ADR-001–005, architektúra, migrációs/taskterv, használati szerződés, README/changelog/platformstátusz és CI generated-source/tested-artifact lánc.

## Reprodukált és javított megállapítások

| Prioritás | Hiba / következmény | Javítás és regressziós bizonyíték |
| --- | --- | --- |
| P2 | Natív IR-ben minden megmaradt span helyes lehetett akkor is, ha egy eredeti utasítás vagy üres sor kimaradt a sor-/unitlistából. Az admission így csökkent tartalmú feladatot fogadott be. | Teljes, sorrendi fizikai sorlefedés natív stratégián; végső LF külön sor nélkül. Hiányzó köztes/záró sor és üres sor negatív tesztje, LF pozitív tesztje: [core regresszió](../tests/language-engine-core.test.mjs). A legacy v2 kihagyás-/trimkompatibilitás megmarad. |
| P2 | A sparse JS display-tömb üres indexeit a `some` átugrotta; az eredeti kódsor helyén `undefined` juthatott ki. | Minden eredeti index ellenőrzése; hiányos javaslatnál teljes eredeti unit. Ugyanott sparse-array regresszió. |
| P2 | Böngészős átmeneti runtime-modulhiba elutasított loader promise-t hagyott a workerben; ugyanazon parserport minden későbbi kérése is hibás lett. | `runtime_error` lezárja az actort és a függő kéréseket, a következő kérés új izolált runtime-ot nyit. Mock-életciklus és valódi első `pyodide.mjs` 503 → második kérés siker: [parser Node](../tests/python-parser.test.mjs), [Chromium platform](../tests/browser-python.playwright.py). |
| P2 | A JSON/session import guardja csak a `File.text` után keletkezett. Közben szerkesztett referencia vagy újabb művelet után a régi fájl még aktiválhatott előnézetet. | Közös typed szerzői kérésgeneráció a teljes I/O előtt; fájl, clipboard, minta, formatter és admission ugyanazt a határt használja. Snapshot-/sorrend-/away-back unitregresszió és valódi késleltetett model/session olvasás mindkét hoston: [workspace](../tests/author-workspace.test.mjs), [workbench](../tests/browser-workbench.playwright.py). |
| P2 | A source-/tokenkereten belüli, ~41 ezer karakteres széles Python lista túl nagy AST-je `invalid_protocol` hibát okozott. | AST-előállítás közös csomópont-/listabudgettel, túlméretes szerializált DTO `resource_limit` eredménnyel. Node/Chromium nagy lista negatív és utána kis forrás pozitív regresszió. |
| P3 | A Python-terv és a Language Engine használati dokumentumának bevezetése még nem létező parserről írt, miközben a platformdokumentum már implementált könyvtárat mutatott. | README, terv, szerződés és platformjelentés egységesítve: parser/platform létezik; natív adapter, source mapper és termékbekötés nyitott. A történeti alaptesztek számai történeti címkét kaptak. |

A részleteket és a legacy wiring indoklását az [ADR-006](adr/006-explicit-dependency-refresh-and-review-guards.md) rögzíti. A javítások után a felülvizsgált határokban nem maradt ismert P1/P2 hiba; a lent felsorolt integrációs/release-feladatok ettől még nyitottak.

## A beküldött képi eset

Ez külön kompatibilitási eset: a soros `dependencies` lánc alapján a validátor helyesen utasította el a képi `1,3,5,2,4,6,7` sorrendet. A `dependencyHints` nem felülíró szabály. Csendes importlazítás helyett explicit, auditált szerzői függőségfrissítés készült. Kód/ID/fixed/blokk/kézi élek/profilok és kompatibilis kitöltés megmaradnak; a normál import megtartja a soros láncot. [Magyarázat és javított JSON](evaluate-legacy-serial-case.md).

A [függőségfrissítés tesztje](../tests/dependency-refresh.test.mjs) az összes 5040 permutációt független pozíciós feltételekkel ellenőrzi, 8 megengedett sorrenddel. Külön védi az önkényes numerikus ID-kat, scope/function ID-kat, sourceLine eredetadatot, fixedet, kézi éleket és profilokat, atomi strukturális elutasítást és a letölthető modell egyezését. A [Pages API](../tests/pages-api.test.mjs) és a valós Node/Pages böngészős próba a régi elutasítást és az explicit frissítés utáni elfogadást is ellenőrzi.

## Ellenőrzés és korlátok

- `npm run check:all`: 375/375 Node-teszt, strict build, 68 produkciós fájl architektúrakapuja, 9 TS-gazdás böngészőkimenet, 4 publikált referencia auditja; UTF-8 és lokális dokumentációlinkek.
- `npm run test:browser:all`: offline és valódi HTTP alkalmazás, 32 Node/Pages mátrix-, 36 drag- és 29 workbench-eset; alútvonalas v3/bridge/Schema/modulgráf; Python platformparity. Külön célzottan is lefutott a workbench és Python-kör.
- Python: 58 teljes DTO-eset Node és két Chromium-host között, további 27 generált newline/indent/literal-kombináció; timeout/cancel/close, strict-CSP elutasítás, helyi/lazy assetek és meleg offline audit; új transient-loader és AST-budget regresszió.
- A lokális sandbox localhost-kapcsolatát EACCES blokkolta, ezért a teljes HTTP-/browser-kör engedélyezett tesztkörnyezetben futott. Tesztet nem hagytunk ki vagy gyengítettünk. A részletes logok, trace-ek és képernyőképek a lokális/CI `test-results` diagnosztikában vannak; a távoli új head ellenőrzési állapotát a PR checkje mutatja.

A v2 tanulói validator nem kapott parsert, futtatást vagy második gráfalgoritmust. A trusted/preview/local-demo, eredeti fixed pozíció, tartalmi multiplicitás, exact literal whitespace, profil-OR, közös bounded keresés és indeterminate szerződés megmarad. A függőségfrissítés csak explicit author művelet.

**Nyitott:** PY-03 source mapper/unit, PY-04 scope/container/compound politika, PY-05 natív Python → IR adapter, PY-06–PY-10 API/attempt/persistence/UI és kiadás; PY-11 opcionális sorrendlazítás. A termék worker-route CSP-je, OS-szintű erőforráslimit, hideg betöltési UX és kiadási licenc/support review külön kapu. A jelenlegi tesztek nem állítják a teljes Python grammar/minden kombináció, a szemantikai ekvivalencia, a teljes TypeScript-migráció vagy a WCAG megfelelés bizonyítását. [Aktuális taskstátusz](python-parser-platform.md).
