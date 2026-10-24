# Soronkénti elemzés a képen látható evaluate függvényhez

A sor-ID-k az alábbi rögzített referencia sorait azonosítják; az aktuális megoldássorszám nem ID. A teljes modell: `tests/fixtures/evaluate-ordering.model.json`, a forrás: `tests/fixtures/evaluate-ordering.js`.

| ID | Forrás | Szükséges előzmények | JS-hatás és mozgatás |
| --- | --- | --- | --- |
| 1 | `function evaluate() {` | nincs | Függvény-/scope-nyitó; a 2–6. sor a törzséhez tartozik, a 7. zárja. |
| 2 | `const note = 'ready';` | scope-nyitó | Önálló konstans; a 3–5. sorokhoz képest szabad, de a return előtt inicializálódjon. |
| 3 | `const a = 10;` | scope-nyitó | A b és note deklarációjától független; a c kiértékelése előtt inicializálódjon. |
| 4 | `const b = 20;` | scope-nyitó | Az a és note deklarációjától független; a c kiértékelése előtt inicializálódjon. |
| 5 | `const c = a + b;` | 3, 4 | Mindkét kötés értékét olvassa. Bármelyik elé helyezve TDZ/ReferenceError lép fel. Nincs szomszédsági feltétel. |
| 6 | `return { c, note };` | 2, 5 | Kiolvassa c és note értékét, majd befejezi a függvény futását. a és b tranzitívan szükséges. |
| 7 | `}` | a törzs összes sora | A függvény záróhatára; a blokkszerződés írja elő a helyét. |

A 2–4. sor kifejezett dependencies tömbje üres lehet: a compiler a scope-korlátokat külön levezeti. A scope élei nem keverendők a változóérték-függőségekkel. A generátor adhat redundáns nyitóhorgonyt is, de a megengedett sorrendeknek azonosnak kell lenniük.

Az eredmény nyolc megengedett törzssorrend: a/b felcserélhető (2 lehetőség), a note a három másik deklaráció négy hézagában helyezhető el (4 lehetőség), return az utolsó. A teljes hét sor 5040 permutációját vizsgáljuk. A strukturális elvárás része a referencia lexikai scope-jának megtartása: egy eredetileg lokális deklaráció globálisba költöztetése akkor sem megengedett, ha egyetlen próbafuttatás véletlenül azonos eredményt ad.

A futásidejű összehasonlítás kizárólag ellenőrzött, rögzített tesztfixture-ökre vonatkozik. A tanulói értékelés továbbra sem futtat vagy parse-ol kódot.


## Beágyazott blokkok és vezérlés

Az elemző a SourceFile, Block és ModuleBlock utasításlistáit külön dolgozza fel. A belső deklaráció `dependencies` mezője a szimbólumfeloldással megtalált külső sor-ID-kra is hivatkozhat: például a belső `const c = a + b` külső a/b deklarációkat olvas. A `scopeId` eközben a belső blokké marad. A függőségi él nem jogosít fel scope-váltásra.

Egy összetett utasítás bejáratát a nyitó-/kezdősora, kijáratát a záró-/utolsó sora képviseli. A szülői utasításlistában az előzmények a bejárat elé, az utána következő korlátok a kijárat mögé kerülnek. A belső lista a saját szabályait alkalmazza. Így nem egyetlen globális szomszédsági lánc írja le az összes beágyazást. A primitív konstansokat olvasó tiszta belső blokk/if egység mozgatható, ha minden külső kötés előbb inicializálódik; mellékhatást/vezérlésátadást tartalmazó egység konzervatív korlát marad.

A primitív inicializálójú egyszerű let deklarációk is felcserélhetők, ha más szabály nem kapcsolja őket össze. A módosítható kötésből olvasó kifejezéseknél az elemző nem tételez fel állandó értéket: azok és az értékadások sorrendje megmarad. A var, destrukturálás, getter/property access, using/await using és nem támogatott kifejezés szintén konzervatív. `with` jelenlétében a fájl teljesen megtartja a forrássorrendet, mert a lexikai szimbólumfeloldás önmagában nem írja le a dinamikus névfeloldást.

Az `a` és `b` adatfüggősége az őket ténylegesen olvasó c sorban akkor is látható marad, ha valamely szintetikus vezérlési él miatt tranzitívan levezethető lenne. Csak a felesleges szintetikus éleket csökkentjük; importált/kézzel szerkesztett szabályokat nem írunk át.

A validátor scope-verme a már hozzárendelt, összefüggő kezdősorozatot keresés közben is ellenőrzi. A későbbi hozzárendelések által helyrehozhatatlan scope-hibát azonnal elutasítja. Ez azonos szövegű kapcsos zárójelekből álló sok blokk esetén is megakadályozza a felesleges permutációkeresést. A még nem eldönthető hozzárendeléseknél továbbra is érvényes a bounded search és az indeterminate.

## Mit jelent a hívások körüli sorrendi korlát?

```javascript
const a = 10;
const b = 20;
log('first');
save(a + b);
```

Az első két sor felcserélhető. A `log` és `save` sorrendje megmarad: naplózás, fájl-/hálózati írás, közös állapot módosítása és kivétel megfigyelhető eltérést okozhat. Az ismeretlen függvény teljes mellékhatását nem ismerjük.

A jelenlegi szabály ennél szándékosan szigorúbb: az ismeretlen hatású hívás a vele egy utasításlistában álló többi utasításhoz képest is megtartja eredeti helyzetét. A fenti a/b deklarációt ezért nem engedjük a log mögé sem. Ez az adott egyszerű példában lehetne biztonságos, de az elemző nem végez teljes closure-, eval-, alias-, kivétel- és mellékhatásbizonyítást. Ezt konzervatív elutasításnak nevezzük; nem állítjuk, hogy minden így elutasított program JavaScriptben is hibás.

```javascript
let total = 0;
addToTotal();
return total;
```

Itt az átrendezés közvetlenül az eredményt is megváltoztathatja. A return vezérlési korlát: az elé kerülő értékadás/hívás másképp történik meg vagy ki is maradhat. Beágyazott try/catch/finally és ciklus esetén ezek az összetett egységnek, illetve a saját belső utasításlistájuknak is korlátai.

Nincs titkos függvénynév-lista: a `log`, `save`, `record` és más ismeretlen hívások ugyanazt a konzervatív szabályt kapják. Teljes, kontextusfüggő szemantikai ekvivalenciát nem helyettesít egy dependencies tömb.

## Bizonyítási határ és ellenőrzés

A rögzített képi fixture mind az 5040 sorpermutációján független Acorn AST-vizsgálat + valódi JavaScript-futtatás eredményét vetjük össze a kézi modellel és a generált modellel. A scope-t megőrző és helyes eredményű változatok száma pontosan 8.

A háromszintű fixture 240 belső permutációja és 289 forrás/cél pozíciópárja (a helyben hagyást is beleértve) külön ellenőrzött. A sor-áthelyezéses kör egyrészt megköveteli, hogy minden elfogadott sorrend helyes JS-eredményt és hatássorrendet adjon; másrészt külön, független AST-alapú szerződés vizsgálja az ismeretlen hívásokhoz képest megőrzött sorrendet. A futásidejű azonosság és az óvatos szerzői megengedhetőség két külön feltétel, nem keverjük őket.

További fix fixture-ök: let inicializálás, olvasás/írási konfliktus, compound assignment, két hívás sorrendje, if, shadowing, beágyazott függvény, ciklus, throw/catch/finally és dinamikus with. A tesztek nem jelentenek bizonyítást minden tetszőleges JavaScript-program szemantikai ekvivalenciájára. Az általános validátor a modell összes kényszerét ellenőrzi; a bizonytalan automatikus elemzés konzervatív szabályt ad.

Az inicializálás, blokk és return nyelvi szabályaihoz az [ECMAScript specifikációját](https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html) használtuk; a fenti dependency-/scope-politika ezekre épülő feladatspecifikus modell.
