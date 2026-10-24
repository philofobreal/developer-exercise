# Changelog

## Unreleased – 2026-10-24 audit

- Teljes fejlesztési review: natív IR teljes fizikai forráslefedése, ritkás renderjavaslat elutasítása, Python loaderhiba utáni újrapróbálás és nagy AST erőforrás-diagnosztika javítva. A szerzői guard már a fájl-/clipboard-/hálózati I/O előtt rögzül; késői JSON/session-import nem ír felül újabb referenciát. A dokumentáció parser/adapterszelet-státuszai egységesítve. [Review és bizonyíték](docs/review-language-engine-python.md).
- Régi v2 soros modellekhez explicit Sorfüggőségek újraszámítása: typed author port, Node/Pages admission, megmaradó ID/kód/fixed/kézi élek/profilok és kompatibilis kitöltés. A képi evaluate-eset 5040 permutációs regresszióval, API- és böngészős tesztekkel, javított JSON-nal dokumentált. Normál import és learner validáció változatlan.

- A mainre zárt alapok után megkezdett Python-integráció: pinned Pyodide 314.0.7 / CPython 3.14.2 author parserport, izolált process/worker, strict DTO, cancel/timeout/restart, hash/licenc artifactkapu és 58 esetes Node/Chromium korpusz (+27 generált kombináció). Teljes Python IR-adapter, UI és release továbbra is nyitott; [pontos státusz](docs/python-parser-platform.md).

- Részletes Python-adapter integrációs terv: PY-01–PY-11 taskok, parser/platform döntési kapu, IR-leképezés, verziózott termékintegráció és tesztmátrix. Ebben a tervcommitban Python-adapter még nincs implementálva.

- Referencia-/próbamunkafolyamat javítása: a kézzel gépelt referencia megmarad, feladatonként külön source/JSON draft, egyértelmű Referenciaforrás/Megoldáskód nézetek és pending jelzések, explicit rendezőből újratöltés, késői admission elleni védelem. Strict TS workspace-politika, ADR-004 és Node/Pages böngészős regressziók.

- Language IR v1 és opt-in CodeLine v3 alap: fizikai source span, atomi többsoros unit, külön syntactic container/binding scope, virtuális határesemények, indent policy. Ugyanaz a bounded bijekciós validátor, strict TS adapterregiszter, JS/TS v2 bridge, gráfmentes render port, Schema-/permutációs-/adapter-/Chromium-contract tesztek és CI generáltkód-kapu. V2 UI, API, importált szabályok és governance megőrizve. Python parser/adapter és v3 termékintegráció nyitott; [terv és állapot](docs/language-engine-migration.md).

- Unicode whitespace előtagok tartalommegőrzése a live formatterben: csak ASCII szóköz/tab normalizálható, a validátor szerződésével egyezően.
- Kiadás előtti review: fixed pozíció közvetlen korláttal, implicit oldalkorlát nélkül; késői formázási és hibás kiértékelési válaszok nem írnak felül újabb munkát. Új üzleti/technikai szerződés és ADR-002.
- Munkafolyamat-központú UI/UX: forrás-/JSON-belépés, forrásfájl-betöltés, külön tanulói preview, megmaradó editor-draftok, hozzáférhető tabs/shortcut/fókusz/busy és mobilfelület; új megjelenítési források strict natív TypeScriptben.
- AI governance, AGENTS, Ousterhout-alapú döntéstulajdonosok és TS-migrációs ADR; natív TS architektúrakapu import-/strictness-/végrehajtási korlátokkal, generált forrásgazdákkal és negatív regressziókkal.

- Scope-onként kompozicionális függőséggenerálás: külső konstanskötések, beágyazott egységek és adat-/vezérlési korlátok; 5040 képi sorpermutációs JS-orákulum, háromszintű regressziók és korai prefix-scope-ellenőrzés az azonos kapcsos zárójelek miatti kereséshez.

- Kötésalapú részleges sorrend az egyszerű primitív const deklarációk között; állandó ID-alapú függőségek, opcionális sourceLine és szerver által számított matchedTokenIds megfeleltetés, szerzői/kiértékelési táblázatokkal. A meglévő modellek szabályai megmaradnak.

- Natív drag-and-drop javítása minden példánál: a böngésző által küldött pointercancel nem törli többé a natív húzást; 36 valódi Node/Pages böngészős regressziós eset.

- Indítási portütközés javítása: implicit alapportnál korlátos fallback, explicit PORT-nál olvasható hiba; más alkalmazás folyamatát nem állítjuk le.

- TASK-19: másolás/beillesztés a szerzői forráshoz, JSON-modellhez, megoldásszerkesztőhöz és rendezőhöz; forrássor-másolás, hibavisszajelzés és fixed-védelem.

- Regex-, komment-, string- és template-tudatos, öt szóközös toleráns behúzás; exact és nyers literálsorok védelme.
- Valódi JS Beautify összehasonlító regresszió, helyi assetek és kontrollált lexikai fallback.
- AST-alapú JS/TS blokkhierarchia; globális struktúravesztés helyett dokumentált intervallumfallback.
- Külön szerzői szintaktikai referenciaaudit, JS-specifikus Acorn parser és működő nyelvi adapterregiszter.
- Egyetlen JSON Schemából generált runtime-ellenőrző; duplikált függőségek, integritás és erőforráskorlátok egységesítése.
- Hatékonyabb fixed-horgonyélek és referenciasor-indexelés; megőrzött bounded search és indeterminate.
- Natív, pointeres, touch és billentyűzetes beszúrás; fókusz/státuszüzenet és animációközi célzás javítása.
- Explicit Local Demo / Preview / Trusted Server validációs módok.
- Modell- és munkamenet-export/import, kézi helyi mentés, szigorú próbálkozásintegritás.
- Bővíthető mezőregiszter, külön szerzői életciklus és persistence, egységes CSS.
- Hordozható HTTP/Pages Playwright-mátrix és egyszeri verify → ellenőrzött artifact → deploy CI-lánc.
- UTF-8 README, helyes repository/Pages útvonalak, pontos tesztállítások és megőrzött harmadikfél-licencek.

A helyi audit lezárásakor távoli push, release és deployment nem történt; a később külön kért kiadási szakasz nyoma a Git/GitHub történetben követhető. Projektlicenc választása továbbra is tulajdonosi döntés.
