# ngDynamic CodeLine v5 — matematikai modell, validáció és formázás

## 1. Cél és bizalmi határ

A szerkesztőben szabadon áthelyezhető **kódsorokat** jelenítünk meg, a megoldás viszont nem futtatódik. A tanulói beküldés a fizikailag összeállított `string[]` kódsorokat tartalmazza. A hiteles referencia **csak a szerveren** van; a böngészőben megjelenített CodeLine/adatmodell szerzői *előnézet*, nem a hitelesítendő szabályhalmaz forrása.

Két külön folyamat van:

1. **Szerzői oldal (összetettebb, nyelvspecifikus):** parserrel validált eredeti JS/TS kód → formázás → `CodeLineExercise` → `compileCodeLineExercise` → hitelesített referencia. Nem állítjuk, hogy a referencia futásidejű helyessége parserből bizonyítható.
2. **Tanulói oldal (olcsó, nyelvfüggetlen):** rendezett szövegsorok → tartalom- és szabályellenőrzés. Nincs `eval`, VM, JS/TS interpreter, AST-parse vagy programfuttatás a beküldött kóddal.

Az autorálás jelenlegi generátora **konzervatív**, szomszédos `dependencies` láncot épít, ha nem tud felelősen következtetni a felcserélhetőségre. Összetett blokkhatároknál (`});`, `} else {`, összetett TS deklarációk) blokkok nélküli `conservative-serial` modellre tér át. Ez tudatosan szűkebb megoldáshalmaz, nem általános szemantikai analízis.

## 2. A CodeLine és a normalizálás

```ts
interface CodeLine {
  id: number;              // technikai azonosító, nem szemantikai azonosság
  code: string;            // pontosan egy fizikai kódsor
  dependencies: number[];  // mindnek valahol korábban kell szerepelnie
  fixed: boolean;          // abszolút referenciapozíció
  functionBlock: number;   // funkciótulajdonos, 0 = top-level
}
interface StructuredCodeLine extends CodeLine {
  scopeId: string | null;  // lexikai blokk, nem csak függvény
  normalization?: 'indent' | 'exact';
}
```

- `indent`: kizárólag a **vezető** szóközök/tabok ignorálhatók; a köztes és lezáró karakterek maradnak. Csak akkor alkalmazható, ha a szerzői feldolgozás azt biztonságosnak minősítette.
- `exact`: minden karakter számít, például whitespace-érzékeny template literal vagy más nyelvi konstrukció esetén.
- `functionBlock` önmagában nem tárolja a `for`, `if`, `try` scope-ját, ezért szükséges a külön `scopeId` és a `blocks` tábla.
- A `fixed` nem pusztán UI-tilalom: a fordító minden előtte és mögötte lévő referenciatokenhez sorrendi élt ad, így a validátor is kikényszeríti az abszolút helyét.

## 3. Formális helyesség

Legyen:

- `T = {t₁,…,tₙ}` a hiteles referenciatokenek **előfordulásainak** halmaza;
- `S = (s₁,…,sₙ)` a beküldött kódsorok sorozata;
- `Nₜ(x)` az adott tokenhez tartozó engedélyezett normalizálás;
- `E_p` a kötelező, irányított megelőzési reláció az aktuális `p` profilban (több `after`, `edges`, `fixed`, blokknyitás/zárás);
- `B` a hiteles, egymásba ágyazott scope-hierarchia.

A megoldás elfogadható, ha **létezik** olyan bijekció

\[
 f : \{1,\dots,n\} \to T,
\]

amelyre egyszerre igaz:

1. **Tartalmi megfelelés**: minden `i` esetén `N_{f(i)}(sᵢ) = N_{f(i)}(code(f(i)))`.
2. **Részleges rendezés**: minden `(u,v) ∈ E_p` esetén `pos_f(u) < pos_f(v)` (nem követel szomszédságot).
3. **Lexikai struktúra**: a balról jobbra olvasott nyitó-/záróblokkok szabályos, egymásba ágyazott veremmel feldolgozhatók, és minden sor a kijelölt `scope`-ban van.
4. **Profilválasztás**: legalább egy `p` alternatív profil teljesíthető, a profilon belül minden szabály együttesen kötelező (**OR a profilok között; AND a szabályok között**).

Formulában:

\[
 Accept(S) \iff \exists p\;\exists f\in Bij(S,T): Content(f)\land Order(f,E_p)\land Scope(f,B).
\]

### 3.1 Azonos `}` sorok

Két `}` sor külön ID-val is ugyanahhoz a normalizált karakterlánchoz tartozhat. A validátor nem az ID-kat követeli vissza, hanem megvizsgálja, létezik-e olyan **globális** bijekció, amely a két sor hozzárendelésének cseréjével minden függőséget és scope-ot teljesít. Így a felcserélt tokenazonosító nem lesz hamis hiba, de egy hibás blokkba helyezett zárójel elutasítható.

### 3.2 Függőségi gráf

A kötelező megelőzéseket DAG irányított élei jelölik. Például `a → c`, `b → c` nem rögzíti `a` és `b` sorrendjét. Egyszerre több előzmény szükséges; egyetlen előd nem írná le pontosan ezt a követelményt. A modellnek nincs futásidejű adatfüggőség-felismerése: az élek szerzői igazolást igényelnek.

### 3.3 Miért nem elég egy DAG mindenre?

A DAG lineáris kiterjesztései fejezik ki a megengedett sorrendeket, de a `A-B-C VAGY C-B-A` megoldáshalmaz nem írható le pontosan egyetlen részleges rendezéssel. Erre szolgál az alternatív `profiles` OR-kapcsolata, a `blocks` és a `fixed` szabályok. Opcionális tokenek, tetszőleges szöveges átírás vagy teljes szemantikai ekvivalencia **nem** része a mostani sor-rendezős modellnek.

## 4. Algoritmus implementációja

A [`src/core/code-line.ts`](../src/core/code-line.ts) adapter:

1. ellenőrzi az ID-k egyediségét, a `dependencies`, `functionBlock`, `scopeId`, `fixed` mezőket;
2. a számazonosítókat a belső `n:<id>` kulcsokra fordítja;
3. a `fixed` pozíciót megelőzési élekkel kódolja;
4. a `blocks`, `edges`, `profiles` szabályokat a `src/core/model.ts` fordítónak adja át;
5. visszautasítja a körkörös függőséget, hiányzó blokkot, inkonzisztens hierarchiát, hibás referenciaadatot.

A [`src/core/validator.ts`](../src/core/validator.ts) ellenőrzés:

1. beküldési séma és elemszám, maximális sorhossz, egyetlen fizikai sor/token;
2. minden beküldési pozícióhoz `Cᵢ` jelölthalmaz képzése a tartalmi egyenértékűségből;
3. lehetetlen sorok és (amennyiben egyértelmű) multiplicitás korai kizárása;
4. egy profilon belül korlátos DFS + MRV (legkevesebb lehetséges jelölt először), az élek azonnali részleges ellenőrzésével;
5. teljes hozzárendelésnél pontos scope-veremellenőrzés;
6. az első elfogadható teljes hozzárendelés tanúja alapján `accepted`.

Egyedi, nem ismétlődő kódoknál a hozzárendelés egyszerű, így a gráfellenőrzés a tokenek és élek számában közel lineáris: `O(N+E)`. **Ismétlődő soroknál az általános bijekciókeresés legrosszabb esetben exponenciális**, és a jelenlegi algoritmus nem garantál polinomiális időt. A `maxStates` alapértelmezés szerint 30 000, maximum 1 000 000. A keresési keret kimerülése **`indeterminate`**, soha nem hamis `rejected`.

A négy státusz: `accepted`, `rejected`, `indeterminate`, `invalid_reference`. A `rejected` az adott hiteles referencia szerinti szabálysértést, **nem** a program általános szemantikai hibáját bizonyítja.

## 5. A formázás és a vizuális sorrend különválasztása

### 5.1 Szerzői formázás

| Nyelv | Elsődleges formázó | Indok |
|---|---|---|
| JavaScript | JS Beautify 1.13.13 (böngésző); TS Language Service tartalék a szerveren | A meglévő ngDynamic örökség, 5 szóközös indent; JS grammar |
| TypeScript | TypeScript Language Service 5.8.3 | TS AST/típusannotációk és generikus szignatúrák megőrzése |

A szerveres `POST /api/author/format` diagnosztikát futtat, és a formázott forráskódot visszaparzolja. A szerzői `compile` lépésnél a parser és a lexer az ismert TS/JS struktúrákat dolgozza fel. Ez **nem** a tanulói beküldés kiértékelésének része.

### 5.2 Rendezési megjelenítés — a képen jelzett hiba

A v4 `_____code_line_end_;` jelölőt illesztett minden befejezetlen kódsor mögé, majd JS Beautify után darabolta a kimenetet. Hiányos kifejezéseknél (pl. függvényhívás, tömbspread, `});`, generikus TS szignatúra) a formázó **több fizikai sort helyezhetett egy draggable tokenbe**, vagy átmozgathatott sorhatárokat. A sorszám/gutter viszont továbbra is egy tokent jelölt: ebből jött a képen látható összeolvadás és a páros/páratlan sorok csúszása.

**V5 javítás:** rendezés közben TS-re a szerzői oldalon már formázott eredeti token szövege jelenik meg (nem küldjük félig kész TS-kódot a JS Beautify-hoz). JS-nél a megoldást csak akkor formázzuk újra JS Beautify-jal, ha (i) a fizikai sorok száma megegyezik; (ii) a sorok `trim()` tartalma pozíciónként ugyanaz; (iii) nem keletkezik új sor a tokenen belül. Minden más esetben megtartjuk az eredeti sorok karaktereit, az eredeti behúzással. Egy vizuális sor mindig egy tokent jelent. Ez biztonságos kompromisszum: **egy hiányos vagy hibás rendezési állapotban az automatikus újraindentálás nem garantált**. A kész programot a szerzői szerkesztőben a nyelvazonos formázóval újra lehet formázni.

A Prism alapértelmezett CSS-e a `.token.operator`/`.token.entity` elemekre `hsla(0,0%,100%,.5)` hátteret adott, innen jöttek a `=`, `=>`, `+` mögötti szürke négyzetek. Ezt a v5 a betöltött témában és a felületre scope-olt stílusban is átlátszóra állítja. A `<pre>` minden esetben `white-space:pre`, `overflow-x:auto`, fizikai egysoros magasságot kap.

## 6. UI interakciók és scrollmegőrzés

A `render()` újraépíti az alkalmazás DOM-ját, ezért a v4-ben minden drop `scrollTop=0` eredménnyel járt. A v5:

- render előtt eltárolja a két `.drop-zone[data-zone]` függőleges és vízszintes scrollértékét, feladat-ID + zónanév kulccsal;
- render és sorszám/gutter frissítés után **visszaállítja** a `scrollTop` és `scrollLeft` értékeket;
- a drop, nyilakkal történő átrendezés és + / − gomb is a közös renderútvonalat használja;
- a 100%-os szélességű `#app` nem korlátozódik 1200 pixelre; a fullscreen API és a CSS fallback változatlanul működik.

Nagyobb DOM/scrollmagasság-változásnál az utolsó érték a böngésző által támogatott maximumra korlátozódik; a v5 pixelpozíciót, nem sorankort rögzített horgonyt őriz meg.

## 7. Más nyelvek és a JS Beautify

**Más nyelveket nem érdemes JavaScriptre fordítani csak azért, hogy a JS Beautify kezelhesse őket.** A transzpiláció megváltoztatja az AST-t, megsemmisítheti az eredeti kommenteket, importokat, nyelvi idiomákat, behúzást, sőt egyes szintaktikai szerkezeteket. JS Beautify nem általános nyelvi formázó. TypeScript esetén is a natív TypeScript Language Service a helyes megoldás.

Bővítéshez szükséges adapterek, nyelvenként:

```ts
interface LanguageAdapter {
  language: string;
  parseAndValidate(source: string): Promise<void>;
  format(source: string, indentSize: number): Promise<string>;
  tokenize(source: string): Promise<StructuredCodeLine[]>;
  normalize(line: StructuredCodeLine): string;
  verifyModel(model: CodeLineExercise): Promise<void>;
}
```

Javaslat: Pythonhoz Black/Ruff, Javához google-java-format, C#/Roslyn, Rusthoz rustfmt, Go-hoz gofmt; mind szerzői/izolált környezetben. A kész, ellenőrzött modell ugyanarra a **nyelvfüggetlen szerveroldali** validátorra adható át, amely nem értelmezi a beküldött programnyelvet. Pythonban az indentáció **szintaktikai elem**, tehát `normalization:'indent'` nem alkalmazható automatikusan; más nyelvekben template-/string-kontextusnál is `exact` szükséges.

## 8. Tesztelés és korlátok

Futtatás: `npm install && npm run check`; UI-integrációhoz `npm run test:browser` (telepített Chromium szükséges).

A v5 regressziók ellenőrzik: a formázó soha nem csúsztat két tokent egy fizikai vizuális sorra; a TypeScript kódsorokat nem küldi JS Beautify-n keresztül; a formázó nem változtat meg token-tartalmat; a Prism operátorok háttere átlátszó; a hosszú, scrollos dropzóna mozgatás után megtartja a pozíciót; fullscreen és másolás gombok megjelennek; a teljes mellékelt `CopyFieldUtilityService` metódusai formázásból és modellgenerálásból változatlanul tesztelhetők.

A browser test külön elérhető környezeti teszt; ha Chromium nem indul a rendszerben, a teszt **nem tekinthető lefutottnak**. A szerver hitelesítést, rate limitinget, perzisztens tárolást és éles telepítési keményítést még igényel.
