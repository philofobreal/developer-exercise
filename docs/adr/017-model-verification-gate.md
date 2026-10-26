# ADR-017 – Model Verification Gate

Állapot: implementálva (a Semantic Ordering Precision epic V1 munkacsomagja, a kritikai felülvizsgálat 4.2 és 4.5 pontja alapján). A validátor és minden ítélet változatlan; a gate semmilyen kódot nem futtat.

## Kontextus

A befogadás ellenőrzi:

- a séma és a gráf konzisztenciáját;
- a scope-okat;
- hogy a modell elfogadja a saját referenciáját.

Azt viszont nem mondja meg, hogy egy konkrét, új forrásból generált (vagy importált) modell **mennyire tekinthető igazoltnak**: mit vezetett le ténylegesen az elemzés, hol volt konzervatív, mi veszett el a v2-projekcióban, és mit állít a rendszer bizonyítottként, illetve csak tesztekkel alátámasztottként.

## Döntés

A lánc mostantól: forráselemzés → kényszergenerálás → **modellminősítés** → befogadás → validáció.

### 1. Projekciós veszteség (generáláskor)

A [code-line-projection.ts](../../src/author/code-line-projection.ts) összeveti az adapter relációit a kész modellel. Ugyanazon listán belül (azonos tartalmazó egység, scope és klauzulaszegmens) minden olyan egységpárt megszámol, amelyet az elemzés rendezetlenül hagyott, a modell viszont rendez.

- **Számítás:** bitkészletes elérhetőség, 500 soron is olcsó (a CopyField teljes generálása 55 ms).
- **Rögzítés:** az eredmény az evidence része (`evidence.projectionLoss`: darabszám és legfeljebb 20 példa), a digesthez kötve.
- **Mért értékek:**
  - CopyField: 0;
  - korpusz: 8 pár, mind ismert ok miatt: az ADR-009 lezárása a lyukas egység körül, illetve overload-csoport törölt tagok között.

### 2. Újralevezetés (szerzői oldal)

A `verifyAuthorModel` ([engine.ts](../../src/author/engine.ts)) a modell saját forrását a rögzített import-emittel újragenerálja. Ezután az eredményt pontosan összeveti a modellel:

- a függőségeket soronként;
- a nem szerzői éleket;
- a nem szerzői okokat.

**Eredmény:** ha mindhárom egyezik, `match`; ha bármelyik eltér, illetve más a szerkezet, `differs`. Így sem egy kézi módosítás, sem egy hamisított proveniencia nem minősülhet elemzési eredménynek.

**Mit ad még az újragenerálás:** az aktuális elemzőverziót és a megbízható projekciós veszteséget.

### 3. A core gate

A `verifyModel(model, input)` ([model-verification.ts](../../src/core/model-verification.ts)) nyelvfüggetlen.

**Ellenőrzések:**

| Ellenőrzés | Tartalom |
| --- | --- |
| befogadás | séma, gráf, scope |
| referencia | a saját referenciát elfogadja-e |
| keretalkalmasság | legfeljebb 100, egyenletesen elosztott szomszédos csere a produkciós kereten (50 000 állapot) belül eldől-e |
| proveniencia | állapota (ADR-014/015) |
| újralevezetés | `match` / `differs` |
| elemzőverzió | aktuális vagy elavult |
| nyelvi audit | ADR-016 |
| fallbackek | konzervatív kényszerek, kódonként |
| projekciós veszteség | az újragenerálásból |
| szerzői szűkítés | szerzői szabályok, `fixed` sorok és profilok száma |

**Státusz:**

| Státusz | Feltétel |
| --- | --- |
| `analysis-verified` | minden kényszer újralevezetett; nincs fallback, projekciós veszteség és szerzői szabály; az elemző aktuális |
| `conservative` | mint fent, de fallback, projekciós veszteség vagy elavult elemző miatt érvényes sorrendet is elutasíthat |
| `author-modified` | szerzői szabályok, `fixed` sorok vagy OR-profilok szándékosan szűkítik a generált modellt (a generátor egyiket sem állítja elő) |
| `unverified` | hiányzó, részleges vagy kötetlen proveniencia; nincs újralevezetés vagy eltér; nyelvi hiba a referenciában |

**`publishable`:** a referencia elfogadott, és egyetlen vizsgált szomszéd sem `indeterminate`. Ez a formális szerződés élesítési feltétele.

**Állítások** (`claims`), mindegyik egyértelmű alappal:

- `checked`: most, erre a modellre megállapítva (referencia, keret, újralevezetés, nyelvi audit);
- `tested`: a generátor emberi bizonyításvázlatán és véges, független empirikus ellenőrzésén alapul, nem modellenkénti bizonyítás. Ez az alapja a soundnessnek, és fallback nélküli modellnél a completenessnek is;
- `not-established`: nem megállapított;
- `refuted`: cáfolt.

### 4. Bekötés

- **Szerver:** a gate minden szerzői draftnál fut, a válasz `verification` mezője; mindig újraszámolt, nem a kérésből vett. A megbízható példáknál is lefut, és rögzül.
- **Pages:** ugyanaz a függvény fut helyben is: újralevezetés van, a nyelvi audit `not-run`.

**Nem tilt, hanem minősít.** A meglévő példák és importált modellek proveniencia nélküliek, ezért `unverified` státuszúak, de publikálhatók. A katalógus ma nem utasít el `unverified` modellt. Hogy egy éles telepítés mit követeljen meg, az a jogosultsági és publikálási politika (F2) döntése.

## Következmények és korlátok

- **A szomszédság mintavétel:** legfeljebb 100 szomszédos cserét vizsgál, nem teljes keresést.
- **Nem modellenkénti bizonyítás:** a soundness forrása továbbra is a generátor vázlatos bizonyítása és a véges tesztkampány. Ezért ez `tested`, sosem `checked`.
- **A szerzői szabályok** (D1) és a lazítások a gate-en át minősülnek újra. A lazítások kezelése a D1 folytatásakor kerül be.
- **Megjelenítés:** a gate eredményét a D2 jeleníti meg a szerzőnek.
