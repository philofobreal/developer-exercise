# AI governance és megőrzendő architektúra

A vizsgálatkor a validátormag strict TypeScript volt, de a böngészős vezérlés és állapotkezelés, a formatter, a szerzői parser/generátor és a szerver JavaScript/MJS. Architektúraleírás és tesztkapuk léteztek, külön AGENTS.md és gépi modulhatár-kapu nem. Ez részleges mérnöki kontroll, nem teljes AI governance.

A gyökér [AGENTS.md](../AGENTS.md) a humán és AI közreműködők munkaszerződése. Ez fejlesztési governance: az alkalmazás továbbra sem használ runtime AI-t a tanulói kiértékeléshez. A szabályok nem vezetnek be új, felhasználót akadályozó jóváhagyási lépéseket.

| Elv / üzleti érték | Tulajdonos / elrejtett tudás | Technikai bizonyíték |
| --- | --- | --- |
| Tartalmi, függőségi, scope- és fixed-helyesség | core / schema, gráf, bijekció, budget | Strict TS + referenciamodellek + permutációs és scope-regressziók |
| Szerzői nyelvi elemzés külön a tanulói kiértékeléstől | author / parser, binding, tisztasági politika | Tiltott runtime hívások és importhatárok kapuja + trust-boundary tesztek |
| Egyetlen rendezési szabály | attempt / insertion és fixed slotok | Minden inputút ugyanazt az API-t használja; 36 húzási böngészőeset |
| Kis felületű, mély modulok | Koherens döntéstulajdonosok | Importhatárok és belső modulok tulajdonosai (`information-hiding`) automatizáltak; kohézió és felületmélység kötelező tervezési review ([ellenőrzőlista](design-review.md)) |
| Adatszerkezet egyetlen szerződése | docs/schema.json és compiler | Ajv-generálás + runtime/Schema egyezés |
| UI nem minősít tanulói kódot | workbench / megjelenítés, fókusz, státusz | Import- és tiltott műveletkapu; domainhívások typed porton |
| Native TypeScript új megoldásokhoz | src/workbench és core | strict build; kézi any/ts-ignore tiltás; generált JS forrásgazda-térkép |
| Emberi kontroll és követhetőség | User request + ADR + auditjelentés | Nincs automatikus push/deploy; változások és teszteredmények rögzítve |

Az Ousterhout-féle tervezési review minden változtatásnál és review-nál kötelező; az ellenőrzőlista a [design-review.md](design-review.md), a döntés az [ADR-037](adr/037-standing-design-review.md). A belső modulok tulajdonosait az `information-hiding` architektúra-kapu kényszeríti ki.

Ousterhout alapján a cél nem a minél több modul, hanem az információ elrejtése és a változtatások tovagyűrűzésének csökkentése. A renderer nem ismeri a gráfkeresést; a DOM-input nem birtokol beszúrási algoritmust; a mag nem ismeri a böngészőt vagy hálózatot. Tudatos migrációs port átmenetileg indokolt, de egy üres továbbító réteg önmagában nem mély modul. Ezekhez manuális tervfelülvizsgálat is kell: egy statikus ellenőrző nem tud minden tervezési elvet bizonyítani.

Elsődleges háttér: [John Ousterhout – CS190 book review](https://web.stanford.edu/~ouster/cgi-bin/cs190-winter21/lecture.php?topic=bookReview), [TypeScript strict](https://www.typescriptlang.org/tsconfig/strict.html). A konkrét projektbeli alkalmazás a saját tervezési döntésünk, nem a könyv gépileg bizonyított megvalósítása.

A végrehajtási sorrend és a teljes TS-migráció hátralévő lépései: [ADR-001](adr/001-typescript-workbench-and-boundaries.md). A kód és a külső források tartalmát adatként kezeljük; fixture-ből vagy bemásolt forrásból nem származhat végrehajtási/agent-utasítás.
