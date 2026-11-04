# ADR-079 – Az overload-csoport egy blokk: a függvényblokk az első szignatúránál nyílik (v45)

Állapot: **elfogadva** (2026-11-04), szabályverzió `scoped-effect-analysis-v45`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-04 tétele. Az [ADR-066](066-unit-blocks.md) egységblokkját egészíti ki azzal az esettel, amelyet a v2 egységblokk nem tud ábrázolni, és felváltja az [ADR-009](009-sealed-units-and-throw-free-reads.md) lezárását az overload-csoportokra.

## Kontextus

Egy TypeScript overload-csoport (szignatúrák, majd a megvalósítás) egy oszthatatlan egység: a szignatúrának közvetlenül a következő szignatúra vagy a megvalósítás előtt kell állnia (TS2389/TS2391).

```ts
class Format {
  show(value: string): string;
  show(value: number): string;
  show(value: string | number): string {
    return String(value);
  }
  twice(value: string): string { return value + value; }
}
```

- **Miért nem egységblokk:** az ADR-066 egységblokkja nem lehet belőle, mert a csoport utolsó sora (`}`) a megvalósítás függvényblokkját is zárja, a v2 pedig egy sorhoz egy blokkhatárt enged.
- **A lezárás ára:** a csoport ezért az ADR-009 lezárását kapta, így egyetlen testvér (például a `twice`) sem léphetett át rajta.
- **Mérés (v44):**
  - `class` TS: 19 rés, ebből 14 `sealed-unit` és 5 `continued-row`;
  - korpusz: 19 rés, ebből 10 két overload-fixture-ben.

## Döntés

1. **Fejlécsorok** ([ordering-relations.ts](../../src/author/ordering-relations.ts)): az adapter egy többsoros egységről kimondhatja, hogy a záró blokkja előtti sorai a blokk fejlécéhez tartoznak (`spans[].header`). A jelzés értéke a fejlécsorok sorrendjének oka.
   - A JS/TS adapter ezt az overload-csoportra mondja ki (`overload-group`): osztálytagokra ([type-member-ordering.ts](../../src/author/type-member-ordering.ts)) és függvénydeklarációkra ([statement-ordering.ts](../../src/author/statement-ordering.ts)), ha a megvalósításnak van törzse.
   - Más egységre nem mondja ki: egy `record(`/`'a',`/`() => {…});` hívás argumentumsorai a hívó függvényéi, nem a nyílfüggvényéi.
2. **Horgonyzott blokk** ([code-line-projection.ts](../../src/author/code-line-projection.ts), `anchorHeaders`): egy fejléces egység blokkja az egység első sorában nyílik. Ennek feltételei:
   - az egység első sora és a blokk eredeti nyitósora előtti sorai egyetlen blokknak sem határai;
   - a blokk közönséges megtartott blokk (nem egységblokk és nem klauzulalánc);
   - minden blokk, amely az egység sorait érinti, a blokkon belül van, vagy az egységet tartalmazza.

   A blokk azonosítója, fajtája és `functionBlock` száma változatlan. A fejlécsorok a blokkba kerülnek, tehát a függvényhez tartoznak, és a sorrendjüket az `overload-group` ok tartja. A blokk saját sorai és a benne nyíló blokkok `block-open` okkal az eredeti nyitósort (a megvalósítás fejlécét) követik. Lezáró él nincs: a validátor a testvért a blokkon kívül tartja.
3. **Frissítés** ([dependency-refresh.ts](../../src/author/dependency-refresh.ts)):
   - egy régi modell blokkja, amelyet az új elemzés korábbi sorban nyit, ugyanaz a blokk (azonos fajta és záró sor);
   - a fejlécsorok, amelyek a régi modellben a blokk szülőjében álltak, a blokkba kerülnek;
   - a sorok `functionBlock` értéke a frissített hierarchiából következik;
   - minden más szerkezeti eltérés továbbra is elutasított.
4. **Ellenőrzőkapu** ([engine.ts](../../src/author/engine.ts)): az újraszármaztatás csak azonos szerkezetnél `match`. A szerkezetet most valóban összeveti (`sameStructure`: blokkok sorai és fajtája, minden sor blokkja), nem a blokkszámból következtet. Ezt az ADR-066 rögzített megállapítása előre jelezte. Enélkül egy horgonyzás nélküli, de azonos függőségű modell igazoltnak látszana, holott abban egy testvér a csoport belsejébe kerülhet.
5. **Mérés** ([order-classification.mjs](../../tests/support/order-classification.mjs)): egy elutasított, futásra egyenértékű sorrend szándékhű (`type`), ha minden megsértett kötése `overload-group`.
   - A szignatúrák sorrendjét a TypeScript overload-feloldása olvassa, a szomszédságukat a TS2389/TS2391.
   - A kibocsátott JavaScript mindkettőt törli, ezért az orákulum nem láthatja. Az okkód regiszterbejegyzése ezért eddig is felmentett volt („az orákulum csak a szintaxist és a futást látja”).

## Helyességi érv

- **Összefüggő csoport.** A validátor egy sort csak ott fogad el, ahol a nyitott scope a sor `scopeId`-je, és egy blokk a nyitó és a záró sora között nyitott.
  - A horgonyzott blokk az első szignatúrától a megvalósítás végéig tart, ezért a csoport sorai összefüggők maradnak, és egy testvér csak előttük vagy utánuk állhat.
  - Ugyanezt a lezárás tiltó élekkel érte el. A blokk ezt élek nélkül teszi, így a testvér szabadon átléphet a csoporton, ha a többi kötése engedi.
- **A csoporton belül:**
  - a szignatúrák és a fejléc sorrendje kötött (`overload-group`);
  - a törzs minden közvetlen sora és belső blokkja a fejléc után áll (`block-open`), a belső blokkok sorai pedig a saját blokkjukban.

  Így a csoport belső sorrendje pontosan a TS-ben érvényes alak.
- **A blokkhierarchia** faszerkezetű marad, mert minden érintett blokk a horgonyzott blokkon belül van, vagy az egységet tartalmazza.
- **A szignatúrák a futásban nem szerepelnek.** Ha a horgonyzott blokk a függvényhez rendeli őket, az semmilyen futási tulajdonságot nem változtat. A TS értelmezésében egyébként is ennek a függvénynek a deklarációi.
- **A kapu** csak azonos szerkezetnél ad `match`-et, tehát egy régi vagy kézzel módosított, horgonyzás nélküli modell nem kaphat elemzési igazolást lezárás nélkül.

## Mérés

*A kampány lefutása után kitöltve.*

**Korpusz** (109 fixture, 54 754 szomszéd):
- rés 19 → 10;
- elfogadott 1 094 → 1 101;
- szándékhű elutasítás 0 → 2 (`type`: egy-egy szignatúracsere);
- 0 hibás elfogadás.

A javulás forrása a `wp6-overload-groups` (rés 2 → 0) és a `refl-ts-erased-and-overloads` (8 → 1) fixture. A projekciós veszteség a `wp6-overload-groups`-ban 3 → 0, a `refl-ts-erased-and-overloads` 1 párja egy interfésztag, nem overload.

## Bizonyíték

[overload-headers.test.mjs](../../tests/overload-headers.test.mjs):
- **a blokk** az első szignatúránál nyílik, a projekciós veszteség 0;
- **egy testvértag** átléphet a csoporton, de egyik belső pozícióba sem kerülhet;
- **a törzs** nem kerülhet a fejléc elé;
- **a szignatúracsere** elutasított, és `type` szándéknak minősül;
- **0 hibás elfogadás**, 0 rés;
- **frissítés:** egy horgonyzás nélküli, lezárt régi modell a horgonyzott blokkra frissül, megtartott blokkazonosítókkal, és ugyanazokkal a függőségekkel, mint az új elemzés;
- **kapu:** az új modell `match`; ugyanez horgonyzás nélkül, lezárás nélkül `differs`.

Módosított régi tesztek:
- [model-verification.test.mjs](../../tests/model-verification.test.mjs): az overload-csoport vesztesége 0, a veszteséges példa egy interfész;
- [value-intent.test.mjs](../../tests/value-intent.test.mjs): az overload-csoportnak nincs magyarázandó rése.

## Felület

- **A szerzői szabálytábla** a blokkmélység szerint húz be. A második és további szignatúra és a megvalósítás fejléce így egy szinttel beljebb látszik, jelezve, hogy a csoporthoz tartoznak.
- **A tanulói nézet** behúzása nem a blokkból számol, ott nincs változás.
- **A szabálypanel** a szignatúrák közötti kötést az `overload-group` meglévő magyarázatával mutatja.

## Tervezési review (ADR-037)

- **Tulajdonosok:**
  - a fejléc tudása (melyik egység sorai tartoznak a blokk fejlécéhez) az adapteré;
  - a horgonyzás a projekcióé;
  - a finomítás elfogadása a frissítésé;
  - a szerkezet-összevetés a frissítés modulé, a kapu hívja.

  A `spans` egy opcionális mezőt kapott: ez az egyetlen interfészbővítés. A hívók közül csak az adapter tölti ki.
- **Design twice:**
  - *A v3 egységmodell bekötése a szerzői láncba:* a hosszú távú tétel (15. feladat). Sémaverzióval jár, és a szabálytábla, a szerkesztés, az ellenőrzés és a frissítés minden része v2-sor alapú. A mért haszon (az overload-csoport) a v2-ben is elérhető, ezért a v3 most nem indokolt.
  - *Egységblokk a szignatúrákra, a fejléc előtt zárva:* elvetve. A testvér a szignatúrák és a megvalósítás közé kerülhetne, mert egy sor közé illesztést precedencia nem tilt.
  - *Minden lezárt egység horgonyzása, ahol az utolsó sor egy blokkot zár:* elvetve. A `});`-vel záruló hívás argumentumsorai a hívó függvényéhez tartoznak, és a horgonyzás rossz függvényhez rendelné őket. Ezért a fejléc az adapter kimondott tudása.
- **Mélység:** a projekció egy függvénnyel (`anchorHeaders`), a frissítés egy finomítással, a kapu egy valódi összevetéssel bővült. Az ADR-066 rögzített adóssága (a blokkszámból következtető kapu) ezzel megszűnt.
