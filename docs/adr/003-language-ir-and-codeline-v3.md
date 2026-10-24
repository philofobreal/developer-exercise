# ADR-003 – Language IR és CodeLine v3, fokozatos bevezetés

Állapot: megvalósítva, Python-adapter előtti könyvtári alap. Alap: main `96da72e8241a2c99e13053dfcfd9797e2bdc3060`.

## Megőrzött döntések

Az [AGENTS](../../AGENTS.md), [governance](../ai-governance.md), [ADR-001](001-typescript-workbench-and-boundaries.md), [ADR-002](002-fixed-positions.md) és a [termékszerződés](../business-technical-contract.md) érvényben marad. A v2 JSON, referenciák, JS/TS binding-/statement-ordering elemzés, absolute fixed pozíció, tartalmi bijekció, profilok, közös keresési budget, exact payload és trusted/preview/local-demo határ nem változik. Nem történik teljes TS- vagy UI-migráció.

## Döntés

A verziózott, szerializálható Language IR v1 a nyelvi elemzés eredménye; a CodeLineExercise v3 feladatazonosítót és revíziót ad hozzá. Egy CodeLine v3 továbbra is egy fizikai sor, de több sor egy atomi mozgatható unitba tartozhat. A source span UTF-16 offseteket, egytől induló sort és nullától induló oszlopot használ, félig nyílt intervallummal. Ez az eredeti forrásra mutat, soha nem az aktuális megoldáspozícióra.

A syntactic container és a binding scope külön hierarchia. Egy Python if-suite például új konténer, de önmagában nem új binding scope. A binding scope szerzői eredetadat, nem runtime névfeloldás. A konténerhatárok rendezett before/after unit események; virtuális DEDENT-hez nem gyártunk `}` tartalmú tanulói tokent. Több esemény is kötődhet ugyanahhoz az egységhez. A dependencies/edges/profiles unitazonosítókra hivatkoznak; fixed az egység eredeti fizikai kezdőhelyét rögzíti, nem osztja ketté a sorrendet.

A v3 fordító ugyanabba az ExerciseDefinition/validateSubmission magba vetít. A mag opcionális strukturális kiterjesztése az atomi, szomszédos unitokat és a rendezett határeseményeket kezeli. Nincs külön v3 kereső, parser vagy nyelvi kapcsoló a validátorban. A v2 útvonal ezt a kiterjesztést nem használja.

A typed author engine regisztere explicit, megbízható alkalmazáskódként regisztrált adaptereket fogad. Nincs plugin-URL, feltöltött futtatható kód vagy automatikus discovery. Az adapter belseje rejti a parser AST-jét és infrastruktúráját. Az engine alak-/referencia-/önellenőrzést végez az adapter eredményén. A JS/TS bridge a meglévő generátort és auditot injektált szűk porton használja, nem számolja újra a v2 importált szabályait. A runtime core-import kizárólag e typed author belépőnek engedett; a többi author algoritmus korábbi importhatára megmarad.

A render-előkészítés egy tiszta core projekció: fizikai sorok, unitazonosítók, biztonságos display policy, grading-gráf nélkül. A semantic indent policy kizárólag exact sorokkal használható; a jelenlegi öt szóközös JS/TS formatter nincs ráeresztve új nyelvekre. A meglévő UI/HTTP/persistence továbbra is v2-t használ; a v3 API külön, opt-in fejlesztői belépő. Ez a Python-adapter implementációjának kezdőpontja, nem kész Python termékfunkció.

## Alternatívák és következmények

Nem vezetünk minden nyelvet JS AST-n át, mert elveszítené a suite- és whitespace-jelentést. Nem általánosítjuk hallgatólagosan a v2 scopeId-t binding scope-pá. Nem cseréljük a működő JS/TS elemzést új parserre. A virtuális határokhoz nem kell üres vagy mesterséges source token, így a beküldés változatlanul fizikai string[] és tartalomalapú.

A v2 bridge csak a megtartott függvényekből képez binding scope metaadatot; nem állít teljes JS/TS binding IR-t. A v3 engedélyezett sorrendjei továbbra is szerzői korlátokat igazolnak, nem általános szemantikai ekvivalenciát. Az adapter author-time kódja megbízható; a szerzői elemzés sandboxolása külön élesítési feladat.

Taskok, elfogadási feltételek, Python-átadás és tesztbizonyíték: [migrációs terv](../language-engine-migration.md).

A későbbi review pontosította a natív source-hűség admissionjét: minden fizikai sor, az üres sor is kötelező; az opcionális végső LF csak sorhatár. Hiányos/sparse display-javaslat nem válhat renderelt eredménnyé. A v2 bridge dokumentált kihagyásai és whitespace-kompatibilitása megmarad.
