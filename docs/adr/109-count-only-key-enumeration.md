# ADR-109 – A kulcsok csak darabszámát olvasó felsorolás nem köti a kulcsírások sorrendjét

Állapot: **elfogadva, megvalósítás alatt** (2026-11-08). Kockázati osztály: szerzői elemzés. Az [ADR-029](029-unobserved-instance-field-order.md) és az [ADR-055](055-key-order-setting.md) szűkítése. Az ADR-108 E9 korpuszának 11-es esete (ismert pontatlansági rés) zárja le.

## Kontextus

- **A mai szabály ([js-ts-ordering.ts](../../src/author/js-ts-ordering.ts) `enumeratesKeys`):** ha a program szövegében bárhol szerepel kulcsfelsoroló név vagy forma (`keys`, `values`, `entries`, `stringify`, `assign`, `structuredClone`, `console`, `inspect`, spread, `for…in`), az egész program „kulcsfelsorolónak” számít (`enumeratedKeys`).
  - Ilyenkor az [object-footprints.ts](../../src/author/object-footprints.ts) minden kulcsot létrehozó írást egész objektumra vonatkozó írásként rendez.
  - A megfigyelt kulcssorrend („Számít”, `keyOrder: observed`) így az írások egymás közötti sorrendjét is köti.
- **A rés:** az `Object.keys(o).length` csak azt figyeli meg, hány kulcs van, a sorrendjüket nem. A szabály mégis rögzíti a kulcsírások sorrendjét, ezért egy helyes elrendezést elutasíthat. Túl szigorú, de sosem veszélyes: tévesen semmit nem fogad el.

**Mérés a változás előtt** (2026-11-08; `const o = {}; o.a = 1; o.b = 2;` után egy megfigyelés, „Számít” mód):

| Megfigyelés | A két írás cseréje | Megfigyelés a második írás elé |
| --- | --- | --- |
| `Object.keys(o).length`, `values`, `entries` ugyanígy | kötött | kötött |
| `Object.keys(o)[0]`, `Object.keys(o)`, `.join()` | kötött | kötött |
| `JSON.stringify(o).length` (a hossz sorrendtől függ) | kötött | kötött |
| `[...Object.keys(o)].length`, `for…in` | kötött | kötött |
| `const ks = Object.keys(o); ks.length` | kötött | kötött |
| nincs felsorolás (`o.a + o.b`) | szabad | kötött |

A megfigyelés minden esetben az írások után marad. A kulcsok létezését (mely kulcs van már meg) más szabály védi, nem az `enumeratedKeys`.

## Döntés

**A darabszám-olvasás nem felsorolás.** Kivétel a felsorolás alól az a hívás, amelynek az eredményét a program kizárólag a `.length` olvasására használja, közvetlenül:
- `Object.keys(x).length`, `Object.values(x).length`, `Object.entries(x).length`;
- egyetlen, nem kiterjesztett argumentummal.

Ezek a helyek kimaradnak a kulcsmegfigyelés szövegéből (`keyObservationText`). Ha a programban nincs más felsoroló név vagy forma, a program nem kulcsfelsoroló, és a kulcsírások egymás közötti sorrendje szabad.

**Csak ott, ahol biztosan a beépített `Object`-ről van szó.** A kivétel nem érvényes, ha a fájlban:
- `Object` nevű kötés van (változó, paraméter, függvény, osztály, import), vagy `Object`-nek értéket ad;
- `with` utasítás van.

Ha egy saját `Object.keys` mégis felsorolna, annak a helye (`Object.keys = …`) nem darabszám-olvasás, ezért a szöveg továbbra is felsorolónak jelöli. A globális objektumot és a reflexiót név szerint már az ADR-020 szabálya elkapja.

**Ami kötött marad, szándékosan:**
- **Álnév (`const ks = Object.keys(o); ks.length`):** a tömb továbbkerülhet, a használatát a szöveges szabály nem követi.
- **Bármi más használat** (indexelés, a tömb visszaadása vagy továbbadása, spread, `join`, iterálás).
- **A `JSON.stringify(...).length`:** a szerializált szöveg hossza ugyan független a kulcsok sorrendjétől, de a stringify-t más formában is használhatja a program, és ezt a szöveges szabály nem különbözteti meg. Nem bővítjük.

**Mi nem változik:** a megfigyelés továbbra is az írások után marad. Csak a kulcsírások *egymás közötti* sorrendje szabadul fel.

## Két terv („design it twice”)

1. **Szöveges kivétel a meglévő szabályban (választott).**
   - Egy helyen, a kulcsmegfigyelés szövegének összeállításakor rejti el a darabszám-olvasást.
   - Az interfész nem változik (`enumeratesKeys` ugyanaz a kérdés).
   - A döntés tulajdonosa ugyanaz a modul, amely ma is eldönti, mi számít felsorolásnak.
2. **Objektumonkénti felsorolás-adatfolyam (elvetve).**
   - Csak azoknak az objektumoknak a kulcsírásai lennének kötöttek, amelyek felsorolásba kerülnek.
   - Pontosabb, de álnév- és szökéselemzést kíván, és az ADR-029 programszintű döntését cserélné le. Ez újratervezés, nem rés-zárás.

## Következmények

- A generált szabályok változnak azokban a programokban, amelyek csak darabszámot olvasnak, ezért új szabályverzió kell (`DEPENDENCY_POLICY`). A szállított modellek hatását a verify-models és az árnyékfuttatás mutatja meg (K3).
- **Bizonyíték:**
  - esetkorpusz a fenti táblázat soraival: a darabszám-olvasás szabad, a többi kötött marad, a megfigyelés az írások után marad;
  - árnyékolt `Object` és `with` mellett kötött;
  - a szerzői elemzés kockázati osztályának mérési sorai.
- **Mellékmegfigyelés, nem e döntés része:** „Nem számít” módban a `for…in` és az álnéven át olvasott hossz mellett is kötött a csere.
