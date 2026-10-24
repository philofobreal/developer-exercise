# Strukturális helyesség és normalizálás

## Két külön ellenőrzési útvonal

Szerzői oldal: teljes referenciaforrás → nyelvi parser → formázás és AST-modell → Schema/struktúra/szintaxis/eredeti sorrend audit → publikálható referencia vagy nem hiteles előnézet.

Tanulói oldal: szerverben tárolt szabályok + a beküldött kódsorok tartalma → strukturális bijekciókeresés. Nincs kódfuttatás, TypeScript-fordítás vagy parser a tanulói értékelésben.

## Adatmodell

```typescript
interface CodeLine {
  id: number;
  code: string;
  dependencies: number[];
  fixed: boolean;
  functionBlock: number;
}
interface StructuredCodeLine extends CodeLine {
  scopeId: string | null;
  sourceLine?: number;
  normalization?: 'indent' | 'exact';
}
```

Az `id` technikai azonosság, nem a program szemantikai identitása. A `dependencies` valamennyi megadott előzményt követeli meg, tetszőleges távolságra. A `fixed` az abszolút referenciasor-pozíciót jelenti. A `functionBlock` a megtartott függvénytulajdonost, a `scopeId` a reprezentált közvetlen lexikai konténert jelöli.

A JSON Schema a mezőalakot, felsorolt normalizálási módokat, egyedi függőségeket és méretkorlátokat ellenőrzi. A TypeScript-fordító külön vizsgálja az egyedi sor-/blokkazonosítókat, a létező hivatkozásokat, a funkciótulajdonost, a hierarchia és a függőségi gráf körmentességét, a blokkhatárok scope-ját és a profilokat. A két réteg kiegészíti egymást; a Schema nem fejez ki minden gráfinvariánst.

## Matematikai elfogadási feltétel

Legyen `T` a referencia tokenelőfordulásainak halmaza, `S = (s₁,…,sₙ)` a beküldött sorozat, `Nₜ` a token normalizálása, `Eₚ` egy profil kötelező éleinek halmaza, `B` a blokkhierarchia.

Az elfogadáshoz léteznie kell egy `f: {1,…,n} → T` bijekciónak és legalább egy `p` profilnak úgy, hogy:

1. Minden pozícióra `N_f(i)(sᵢ) = N_f(i)(code(f(i)))`.
2. Minden `u → v` élre `pos_f(u) < pos_f(v)`.
3. A blokknyitók és -zárók szabályos scope-vermet alkotnak, minden sor a kijelölt konténerben van.
4. A fixed tokenek eredeti abszolút helyükön állnak; a fordító belső fixedPosition korlátra vetíti őket, a keresés csak a megfelelő pozíción engedi a rögzített token hozzárendelését. A többi token nem kap implicit oldalkorlátot.

`Accept(S) ⇔ ∃p ∃f ∈ Bij(S,T): Content(f) ∧ Order(f,Eₚ) ∧ Scope(f,B) ∧ Fixed(f)`.

A profilok között OR, egy profilon belül AND a kapcsolat. `a → c` és `b → c` önmagában nem rögzíti `a` és `b` sorrendjét. Ezzel a modell részleges rendezést enged, nem feltétlenül egyetlen megoldást.

Például az 50-es sor `dependencies: [10, 20]` értékével a `10, 30, 20, 40, 50` és a `20, 40, 10, 30, 50` sorrend is megfelel a függőségeknek. Az `50, 10, 20, 30, 40` és a `10, 50, 20, 30, 40` nem felel meg. A tömb sorrendje nem számít, az összes felsorolt előzménynek korábban kell állnia. Más szabályok (scope, fixed, edges, profiles) ettől függetlenül korlátozhatják a teljes elrendezést.

A generátor scope-onként, kompozicionálisan dolgozza fel az utasításlistákat. Az egysoros, primitív const deklarációk valódi kötésfeloldásból kapnak előzményeket, a külső scope-ban létrehozott konstansokra is hivatkozhatnak. Az egyszerű primitív let inicializálások is lehetnek függetlenek; a módosítható let értékéből olvasó kifejezést viszont nem kezeli állandóként. A TypeScript szimbólumai megkülönböztetik a shadowingot. A megtartott blokkhatárok a sorok lexikai helyét ettől függetlenül korlátozzák.

A hívások, módosítások, vezérlésátadások, ismeretlen kifejezések és kommentegységek a saját utasításlistájukban konzervatív sorrendi korlátot képeznek; az ilyen belső hatás az összetett utasítást a szülőben is korláttá teszi. A tiszta belső blokkok önálló egységként rendezhetők a külső kötésfüggőségeik szerint. A szintetikus élek tranzitív redundanciája csökken, a ténylegesen olvasott sorok explicit függősége megmarad. Közös fizikai sorhatárnál az AST-intervallumfallback továbbra is érvényes. With esetén a forrássorrend megmarad.

Teljes soronkénti példa, a 5040 permutáció ellenőrzése, a beágyazási szabályok és a hívási korlát részletes magyarázata: [evaluate függvény elemzése](evaluate-ordering-analysis.md).

Az `id` az adott feladatverzión belüli állandó azonosság: átrendezéskor nem számozzuk újra, a dependencies ezt hivatkozza. A generátor által rögzített opcionális `sourceLine` az eredeti fizikai forrássor 1-től induló száma, üres sorokkal együtt; csak tájékoztató adat. Nem lehet vele szabályt vagy azonosságot felülírni. Új forrásgenerálás új modellt hoz létre; nem ígérünk globális, szerkesztéseken átívelő ID-állandóságot. A meglévő modellek és kézzel megadott függőségek továbbra is változatlanul importálhatók.


Két azonos normalizált tartalmú `}` sor technikai ID-ja felcserélhető, ha létezik a teljes gráfot és scope-ot egyszerre teljesítő tartalmi hozzárendelés. A validátor nem kéri vissza az eredeti ID-kat. Siker esetén a `matchedTokenIds` mező a beküldött pozíciók sorrendjében tartalmazza a szerveren kiszámított referencia-token-ID-kat (CodeLine esetén `n:<id>`). Ez egy érvényes tanú, azonos tartalmú soroknál nem feltétlenül az egyetlen. A kliens által állított megfeleltetés nem vesz részt az értékelésben. A UI lenyitható táblázatban mutatja a pozíciót, referencia-ID-t, forrássort és a saját modell előzmény-ID-it. Hiányzó vagy duplikált tartalom ettől még elutasítandó.

## Normalizálás és keresés

`indent`: kizárólag a vezető szóköz és tab ignorálható; a sor belseje és vége számít. `exact`: minden kódegység számít. Többsoros template/string payload sorai, köztük az üres sorok, csak exact módban publikálhatók. Új nyelveknél a whitespace biztonságát a saját adapternek kell meghatároznia.

A referenciasorok normalizált kulcsok szerint előindexeltek. A keresés tartalmi multiplicitás-ellenőrzést, MRV/függőségi sorrendezést, a már hozzárendelt prefix korai scope-ellenőrzését és determinisztikus visszalépést használ. A költségkeret az összes profilon közös; a kimerülése `indeterminate`, soha nem automatikus `rejected`.

- `accepted`: találtunk minden szabályt teljesítő tanút.
- `rejected`: a tartalom vagy a teljesen végigvizsgált szabályrendszer nem felel meg.
- `indeterminate`: a keret vagy infrastruktúra miatt nincs megbízható döntés.
- `invalid_reference`: a referencia szerződése hibás; ez nem tanulói hiba.

## Strukturális és szemantikai helyesség

Az automatikus modell csak az elemzés által támogatott tiszta részekben oldja fel a forrássorrendet. Az AST megtartja a reprezentálható hierarchiát. Közös fizikai soron összefutó blokkhatároknál csak az érintett intervallumok kapnak kötelező sorrendéleket; ezt az `authoring` metaadat és a felület jelzi.

A deklaráció/használat-jelzések nem veszik figyelembe teljeskörűen a mellékhatásokat, kivételeket, aliasokat, inicializálási sorrendet vagy időfüggést. A dependencyHints önmagában nem engedélyez automatikus szemantikai szabadságot; a külön statementOrdering végzi a dokumentált, korlátozott lazítást. Kézi dependency-/profilváltoztatás és alternatív megoldás tesztelése lehetséges; a szemantikai helyesség hitelesítése a szerző feladata.

Részletek: [formázás](modularitas-es-elobehuzas.md), [adapterek](language-adapters.md), [architektúra](architecture.md), [tesztállítások](ts-method-regression.md).


## Tervezési alapok

A csomópont-ID + kötelező előzmények modell irányított körmentes gráfot és annak topologikus sorrendjeit írja le. Ez a szokásos megelőzési szemantika, nem távolság- vagy szomszédsági követelmény: [Python graphlib hivatalos leírás](https://docs.python.org/3/library/graphlib.html). A szerzői kötésfeloldás a rögzített TypeScript-verzió `Program`/`TypeChecker`/`getSymbolAtLocation` API-jára épül: [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API). Az ID, forráshely és kódtartalom különválasztása, valamint a szűk automatikus lazítás ezekre épülő projektbeli tervezési döntés, nem egyetlen kötelező ipari séma.

A fixed korábbi horgonyéleinek túlkorlátozását az [ADR-002](adr/002-fixed-positions.md) javítja. A teljes munkafolyamat és tabulálás: [üzleti és technikai szerződés](business-technical-contract.md).
