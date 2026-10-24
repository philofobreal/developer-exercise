# A mellékelt `CopyFieldUtilityService` metódusonkénti regressziós tesztje

- Input: `tests/fixtures/copy-field-utility.service.ts` (eredeti felhasználói fájl, 482 fizikai sor / 436 nem üres sor).
- A TypeScript AST 31 metódust, konstruktort vagy arrow property-t azonosít.
- A teszt mindegyikre külön `node:test` esetet futtat.
- **Metódustesztenként**: osztályba ágyazott TS-részlet parse → TypeScript language service 5-space format → AST névazonosság → újraformázási idempotencia → CodeLine modell → referencia elfogadva → módosított sorrend elutasítva (ha eltérő tartalmú sorok vannak).
- **Teljes fájl**: TS parse → TS format → AST 31 tagjának neve és darabszáma változatlan → CodeLine generálás 436 sorra → `conservative-serial` modell → szerveres értékelés elfogadja a referenciát, elutasítja a megváltoztatott importot.
- API integráció: `/api/author/format` → `/api/author/compile` → `/api/author/preview` elfogadó és elutasító ág → hibás TS syntax 400.
- JS Beautify (JavaScript ág): adapter tesztje ellenőrzi az 5 szóközös konfigurációt és a `_____code_line_end_;` határoló továbbadását. Valós CDN-es JS Beautify böngészős integráció **nem ellenőrizhető offline tesztben**.

**Miért nem a JS Beautify formázza a TypeScriptet?** A JS Beautify alapvetően JavaScript formatter; komplex TS generikus szignatúrákra, tuple return type-okra és metódustípusokra nem vállalunk szintaktikai garanciát. Ezeket a TypeScript saját formattere kezeli. A Source → CodeLine fázis a feldolgozhatatlan összetett blokkhatárnál nem hamis scope-ot generál, hanem a bizonyítottan konzervatív teljes sorrendre esik vissza.

Korlát: a TS parser szintaxist ellenőriz, nem típushelyességet; a különböző metódusok működését a projektből hiányzó függőségek miatt nem futtatjuk.
