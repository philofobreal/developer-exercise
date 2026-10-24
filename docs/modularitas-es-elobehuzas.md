# ngDynamic v6 – élő behúzás, modulhatárok és korrekt validáció

## Mi romlott el v5-ben?

A v5 `public/formatter.js` meghívta a JS Beautify-t egy összeillesztett kódszövegen, **de eldobta az eredményt**, ha a formázó sorszerkezete vagy valamelyik kódsor tartalma eltért a referencia tokenhatáraitól. TypeScriptre eleve kihagyta a formázást. Ez akadályozta meg az élő indentálást éppen az eredeti ngDynamic legértékesebb használatánál: hiányos és hibásan rendezett kódnál.

## A v6 szerződése

Legyenek a feladat állandó tokenjei `t_i = (id_i, code_i, normalization_i)`, a tanuló állapota pedig egy pozíciókat tartalmazó sorozat `A = [id_1, null, id_2, ...]`.

A megjelenítő `F(A)` eredménye ugyanannyi fizikai sor, mint a nem üres pozíciók száma. Bármely `i` pozícióra, amely nem `exact`:

```
stripLeadingWhitespace(F(A)[i]) = stripLeadingWhitespace(code(A[i]))
```

`exact` esetén minden karakter változatlan. A validátor **nem** használja `F(A)` eredményét. A megjelenítés kizárólag a behúzást számolja újra.

### 1. Teljes forráskód formázása – szerzői oldal

- JavaScript: `js-beautify` v1.13.13; az eredeti projekt ötszóközös beállításaival.
- TypeScript: TypeScript Language Service. A generikusok, type literalok, tuple-ök, visszatérési típusok JavaScript-formázóval nem kezelhetők megbízhatóan.
- A referenciaadat modellje mentés előtt AST- és modell-validáción megy át.

### 2. Részleges/tetszőleges sorrendben összeállított kód – tanulói oldal

A `formatForIDE(rows, { language })` az összes aktuális, már behelyezett kódsor alapján újra megállapítja a behúzást. Nem számol az eredeti sorpozícióval, így a `function`, `for`, `if` vagy `}` mozgatására az összes következő sor megjelenítése azonnal változhat.

- A JS-adapter **megtartja** az eredeti `_____code_line_end_;` jelölőt és a beállításokat, de csak formázási segédinformációként. Nem írja át a tokeneket.
- A toleráns lexikai motor kezeli a kapcsos, szögletes és kerek zárójelek nyitását-zárását, köztük a `});` kombinációkat is; a stringekben és kommentekben található zárójeleket nem számítja.
- Ha a JS Beautify átszabja a sorhatárokat, a motor **nem ad vissza hibás sor-/token-hozzárendelést**, hanem a saját szintaxis-környezeti indenterét használja.
- A TypeScript tanulói nézet a toleráns szkennerre épül; **nem** hívja meg a JS Beautify-t hibás/részleges TS programokon.
- A kódrészletek normálizálása kizárólag megjelenítési behúzást érint. Ez nem nyelvi helyességellenőrzés.
- A már a szerkesztőben jelen lévő üres helyek nem változtatják meg az egymás után behelyezett kódelemek kontextusát.

Ezzel a v6 nem egyszerűen „visszakapcsolja a JS Beautify-t” minden sorra. A régi, fontos viselkedést visszaadja, miközben az újabb modell token- és sorazonossági invariánsait megőrzi.

**Korlát:** a toleráns motor nem AST-parser. Regexliterálok összetett mintái, multiline interpolált template literálok, JSX, TSX és olyan nyelvek, ahol a whitespace szintaktikai elem, speciális adaptert igényelnek. Ezt nem lehet garantáltan megoldani a JavaScript-behúzó általánosításával.

## A kiértékelés matematikai modellje változatlan

A referencia tokenhalmaza `T`, a beküldött *tartalom* sorozata `S`.

A megoldás akkor elfogadott, ha létezik egy kölcsönösen egyértelmű leképezés `f: S → T`, amelyre:

1. A sorok normalizált tartalma megegyezik (`indent` vagy `exact`).
2. Minden `u → v` függőségre `pos(f^{-1}(u)) < pos(f^{-1}(v))`.
3. A `fixed` sorok referencia szerinti pozíciója változatlan.
4. A blokkhatárokhoz tartozó `scope`-verem helyesen épül fel és záródik le.
5. Legalább egy megengedett alternatív profil összes szabálya teljesül.

A keresés korlátos; ha nem állapítható meg döntés a megadott költségkereten belül, az eredmény **`indeterminate`**, nem hibásként elutasított megoldás.

A forráskód végrehajtása vagy JS/TS-értékelése a validátorban nem történik. A referencia modell hitelességéért továbbra is a szerzői folyamat felel. A formázás sem jóváhagyást, sem elutasítást nem okozhat.

## Ousterhout: A Philosophy of Software Design – az alkalmazott elvek

- **Deep modules:** `formatter.js` külső interfésze `formatForIDE`, a megvalósítás mögötte rejti a lexer állapotot, sentinel-t és nyelvi eseteket. Nem sok apró, rosszul absztrahált wrapperre bontjuk.
- **Information hiding:** a megjelenítő csak pozíciókat és tokentartalmat kap. Nem ismeri a függőségi gráfot; a HTTP-réteg nem ismeri a validátor belső algoritmusát.
- **Low cognitive load:** a `createAttemptController()` magába zárja az ID-k mozgatását, fix sorokat, sorpozíciókat és szerkesztői visszaalakítást. A DOM-eseménykezelő csak kifejezi a felhasználói szándékot.
- **Separate general purpose from special purpose:** JavaScript/TypeScript szerzői formázás külön szolgáltatás, tanulói részleges behúzás külön szerződés.
- **Handle errors deliberately:** a referenciát fordításkor validáljuk; a szerverhez nem jut el a felhasználó által átírt hiteles modell; a keresési limit `indeterminate`.
- **Strategic programming:** a tesztek a modulok garantált viselkedését (tokeneket megőrző reindent, függőségi modell) rögzítik, nem belső függvényhívásokhoz kötődnek.

## Modulok

| Fájl | Nyilvános felelősség |
|---|---|
| `public/formatter.js` | Egyetlen, stabil IDE formázó interfész |
| `public/formatting/lexical-indenter.js` | Részleges JS/TS szintaxis-környezeti behúzás |
| `public/formatting/legacy-beautifier.js` | Régi konfiguráció + sentinel alapú hint |
| `public/app/attempt.js` | A megoldás állapota; mozgás, csere, szerkesztői visszaalakítás |
| `public/app/view.js` | Renderelés és Prism-szintaxiskiemelés |
| `public/app/ui-utilities.js` | Sorszámgutter, másolás, scrollmegőrzés |
| `public/app/api.js` | Formázó, generáló, validáló HTTP szerződések |
| `public/ui.js` | Eseménykoordináció és képernyőállapot |
| `src/server/catalog.mjs` | Hiteles referenciák és szerzői előnézetek kezelése |
| `src/server/http.mjs` | HTTP, védelem, statikus erőforrások |
| `src/core/*.ts` | Adatmodell-validáció és matematikai kiértékelés |
| `src/author/*.mjs` | Szerzői parserek és modellgenerálás |

## Regressziós tesztek

- `npm run check` – TypeScript build, unit/integrációs tesztek és referencia modellek ellenőrzése.
- `tests/live-indent.test.mjs` – JS/TS, zárójelek, kommentek, hibás sorrend, sentinel és adatvesztés tiltása.
- `tests/live-ts-method-format.test.mjs` – a mellékelt TS service 31 külön osztálytagja, teljes 436 soros reprezentáció, mozgatás és szerkesztés.
- `tests/validator.test.mjs` – egyenértékű sorok, függőségek, scope, `fixed`, alternatív profilok.
- `tests/http-flow.test.mjs` – szerzői és értékelő API.

A grafikus böngészős teszteket a jelenlegi futtatókörnyezet Chromium-hozzáférési korlátozása miatt külön kell futtatni: `npm run test:browser`. A CLI-tesztek sikeressége **nem** bizonyítja a böngészős interakciók végponttól végpontig helyességét.
