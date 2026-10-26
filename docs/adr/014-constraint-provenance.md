# ADR-014 – Kényszer-proveniencia és szerkeszthetőségi osztályok

Állapot: implementálva (a Semantic Ordering Precision epic C1 munkacsomagja, EPIC-04). A validátor, a CodeLine-séma kötelező része, a tanulói parsermentes értékelés és a bizalmi határ változatlan. A generált függőségek nem változnak, ezért a policy-címke marad `scoped-effect-analysis-v9`.

## Kontextus

A generátor eddig csak azt rögzítette, hogy két sor között van-e él, azt nem, hogy miért. A szerzői szabályszerkesztő (D1/D2) és a magyarázható diagnosztika (E1/F1) viszont csak akkor működhet felelősen, ha minden élről tudni lehet:

- a kód szemantikája követeli-e (adat, hatás);
- a struktúra (blokk, többsoros egység);
- egy dokumentált policy (reflektált kulcssorrend, szkriptszintű globálisok);
- vagy csak az elemzés konzervatív (komment, nem támogatott alak, elhagyott blokk).

Ezt a különbséget a modellnek tartósan hordoznia kell, mert a szerzői felület és a core nem futtathat AST-elemzést egy importált modellen.

## Döntés

### 1. Okok a nyelvi elemzésben

Az [ordering-relations.ts](../../src/author/ordering-relations.ts) `OrderingEntry` eleme opcionális `reasons: {before, category, code}[]` mezőt kap. A `combineOrderingRelations` és az új `mergeOrderingEntries` soronként uniót képez, ismétlődés nélkül. Az okokat ott állítjuk elő, ahol a döntés születik:

| Forrás | Kategória / kód |
| --- | --- |
| kiértékelési idejű olvasás, írási cél deklarációja | `data` / `binding-input` |
| RAW, WAR, WAW konfliktus | `data` / `read-after-write`, `write-after-read`, `write-after-write` |
| barrier (hívás, vezérlésátadás, modulbetöltő import, hatásos inicializáló…) | `effect` / a barrier oka (`ExpressionStatement`, `module-import`…) |
| overload-csoport | `structure` / `overload-group` |
| nem támogatott alak (`declaration-shape`, `shared-or-continued-rows`…) | `conservative` / az alak neve |
| szkriptszintű globális lánc (ADR-010) | `policy` / `script-global-order` |
| komment és más nem utasítás sor | `conservative` / `opaque-row` |
| blokknyitó, ha a sornak nincs más előzménye | `structure` / `block-open` |
| osztálytag ugyanabban a kiértékelési fázisban (ADR-012) | `effect` / `class-evaluation-order` |
| fázis nélküli osztálytag (dekorált, duplikált, komment…) | `conservative` / `unclassified-member` |
| reflektált kulcssorrend (ADR-010/012) | `policy` / `reflected-key-order` |
| típustag-futam a rendezett szomszédai között | `conservative` / `type-member-barrier` |

Egy élnek több oka is lehet; ezek mind megmaradnak. Ha két barrier között van él, mindkét oldal oka rögzül.

### 2. Okok a projekcióban

A [code-line-projection.ts](../../src/author/code-line-projection.ts) az okokat sorazonosítókra vetíti, és hozzáadja a sajátjait:

- **Forrásbeli előd egy fel nem sorolt sornál:**
  - blokkzáró sor: `structure` / `block-close`;
  - többsoros egység folytatósora: `unit` / `continued-row`;
  - minden más: `conservative` / `source-order`, például elemzetlen fájl (`with`, `eval`) vagy nem szétválasztható lista.
- **Klauzulalánc:** `structure` / `clause-boundary`, `clause-segment`, `clause-separator`.
- **Lezárás (ADR-009):** `unit` / `sealed-unit`.
- **Elhagyott blokk soros zárolása:** `conservative` / `shared-boundary-lock`.

A tranzitív redukció után csak a megmaradt függőségek és élek okai kerülnek a modellbe. Ha egy adapter nem ad okot egy élre, az `unknown` / `adapter-unspecified` jelölést kap; a JS/TS adapternél ez nem fordul elő (teszt).

### 3. A modell metaadata

Új, additív séma- és típusmező: `authoring.provenance: {before, after, category, code}[]`, legfeljebb 10 000 elemmel.

- `category` ∈ `data`, `effect`, `structure`, `unit`, `policy`, `author`, `conservative`, `unknown`.
- `code` rövid azonosító (`^[A-Za-z][A-Za-z0-9-]*$`, legfeljebb 64 karakter).
- Ha a generált lista meghaladná a korlátot, a generátor elhagyja a mezőt; a modell ilyenkor `absent` proveniencia-állapotú, nem érvénytelen.

**Ez nem értékelési szabály:**

- A `compileCodeLineExercise` csak az alakját ellenőrzi.
- A lefordított szabályok és minden ítélet a mező nélkül, illetve átírt mezővel is azonos (metamorf teszt).

**Érvényesség:** a proveniencia csak a hozzá kötött sorokra érvényes ([ADR-015](015-evidence-binding-and-analysis-environment.md)); eltérés esetén `unbound`.

**Refresh:** a „Sorfüggőségek újraszámítása” az újragenerált okokat az eredeti sorazonosítókra képezi. A régi okokat eldobja; a megtartott eredeti élek oka `unknown` lesz.

### 4. Nyelvfüggetlen magyarázat a core-ban

A [constraint-explanation.ts](../../src/core/constraint-explanation.ts) `explainConstraints(model)` függvénye először befogadja a modellt (érvénytelen modellt nem magyaráz). Utána soronként visszaadja:

- a közvetlen előzményeket és utódokat, mindegyiknél az eredetet (`dependency`, `edge`, `block`), az okokat és a szerkeszthetőségi osztályt;
- a tranzitív előzményeket és utódokat;
- a scope-ot, a `functionBlock`-ot és a `fixed` jelzőt;
- összesítve: proveniencia-állapot (`complete` / `partial` / `absent`), az ok nélküli élek száma (`unexplained`) és a modellben nem létező élre mutató bejegyzések száma (`stale`, figyelmen kívül hagyva).

**Blokktagság:** közvetlenül a blokkhierarchiából jön, ezért mindig `structure` / `block-member`, illetve `block-pair`.

**Szerkeszthetőség** (egy él osztálya a legerősebb okáé):

| Osztály | Kategóriák | Jelentés |
| --- | --- | --- |
| `hard` | `structure`, `unit` | csak a szerkezettel együtt változhat |
| `proven` | `data`, `effect`, `policy` | a kód vagy a dokumentált policy követeli |
| `conservative` | `conservative` | pontosabb elemzés vagy explicit szerzői döntés feloldhatja |
| `pedagogical` | `author` | a szerző szándéka, szabadon módosítható |
| `legacy` | `unknown` | régi vagy importált modell, nincs magyarázat |

**Profilok:** az OR-kapcsolatú profilélek magyarázata az E1 diagnosztika része.

## Következmények és korlátok

- **Megbízhatóság:** a proveniencia szerzői állítás, nem bizonyíték. Egy importált modell tetszőleges okot írhat bele. Ezért:
  - a core csak a ténylegesen létező élekhez rendel okot;
  - a döntés (validáció) soha nem függ tőle;
  - a trusted szerver nem tekinti bizonyítéknak.
- **Kódok:** a `code` nem lokalizált szöveg, hanem stabil azonosító; a magyar megjelenítés az F1 feladata.
- **Elhagyott blokk:** a blokk-szintű éleket (`edges`) is lefedi a proveniencia (`shared-boundary-lock`).
- **Méret:** a CopyField teljes modelljében 451 függőség 582 okkal szerepel, egyetlen `unknown` nélkül.
