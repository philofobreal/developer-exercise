# Formázási felelősségek és tartalommegőrzés

## Teljes szerzői forrás

A `src/author/languages.mjs` nyelvi adaptere auditálja a teljes referenciát. JavaScriptnél Acorn ellenőrzi a JS-grammatikát (script vagy module), a TypeScript compiler AST-je szolgáltatja a közös struktúrát. TypeScriptnél a saját parser ellenőrzi a szintaxist. A külön Formázás művelet mindkét nyelvnél a TypeScript Language Service-t használja; itt sorokat is lehet tördelni. Az Alkalmazás az akkor megadott forrásból hoz létre CodeLine-elemeket, és nem hív automatikusan teljes forrásformázást.

## Részleges tanulói összeállítás

`formatForIDE(rows,{language})` megjelenítési projekció, ugyanannyi elemmel, mint a bemenete. Az `attempt.js` a még üres fizikai pozíciókat külön őrzi, majd visszailleszti őket. Nem az eredeti referenciasorrend, hanem az aktuális tokenrend határozza meg a kontextust.

- `lexical-indenter.js`: toleráns állapotgép; code/string/comment/regex/template módok, karakterosztály és escape, interpolációs és zárójelvermek. A kontrollzárójel és az értéket befejező zárójel külön slash-kontextust ad. A hibás regex EOL-nál lezárul, nem nyel el további blokkokat. Rossz zárójel nem pattint le idegen keretet.
- `legacy-beautifier.js`: az eredeti JS Beautify 1.13.13 konfiguráció és `_____code_line_end_;` segédjelölés. A jelölő kizárólag a formázó ideiglenes szövegében él. Ütköző marker, eltérő sorszám, széttördelt sor, kivétel vagy no-op formatter esetén nincs megbízható javaslat.
- `formatter.js`: JS-nél a megbízható Beautify-prefixel korrigálható a lexikai mélység; nem követel mechanikus egyenlőséget. Csak behúzási prefixet használ, a formázó által visszaadott tokentartalmat soha. Érvénytelen egyedi hintnél lexikai fallback. TS, `exact`, backticket vagy folytatott stringet tartalmazó bemenetnél konzervatívan a lexikai projekció dönt.

Öt szóköz az alap. Minden `indent` sorra `display.replace(/^[ \t]*/, '') === code.replace(/^[ \t]*/, '')`: csak az ASCII szóköz/tab előtag változhat. A sor eleji NBSP, EM SPACE és BOM is megmarad, mert a validátor ezeket tartalomnak tekinti. `exact` sorra minden kódegység azonos. A többsoros literál nyers tartalmi sorainak vezető whitespace-e is változatlan. A megjelenítési eredmény nem lesz az automatikus értékelés bemenete; a validátor az eredeti elem tartalmát kapja.

## Eltérés az eredeti ngDynamic eljárástól

Az eredeti konfiguráció és marker-alapú darabolás fennmaradt, és valódi JS Beautify-val összehasonlító teszt vizsgálja. A marker nem kerülhet a domainmodellbe, és egy draggable elem nem bontható szét vagy vonható össze. A teljes forrás újraformázása külön szerződés; a hibás vagy hiányos program vizuális behúzását nem tesszük függővé sikeres parsingtól.

Teszt: `tests/lexical-context.test.mjs`, `tests/legacy-comparison.test.mjs`, a korábbi live-indent, formatter-contract és 31 TS-tag regressziói.

## Korlátok

A hiányos program slash-kontextusa nem minden hibás tokenfolyamnál dönthető el egyértelműen; ez a projekció best effort, nem parserhelyettesítő. JSX/TSX, proposal-szintaxis és más nyelvek külön adaptert igényelnek. A garantált szerződés a sor- és tartalommegőrzés, nem minden hibás program ideális esztétikai formázása.

A Tab billentyű pontos szerkesztési viselkedése, a fixed pozíció és a másolás/értékelés kapcsolata: [üzleti és technikai szerződés](business-technical-contract.md).
