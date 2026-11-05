# ADR-102 – Olvasási egység és saját objektum művelete felcserélhető a `valid` szerződés alatt (v52)

Állapot: **elfogadva** (2026-11-05), szabályverzió `scoped-effect-analysis-v52`. A felhasználó kérése: „folytasd a param rés javításával”. Kiegészíti az [ADR-050](050-input-contract.md) bemeneti szerződését és az [ADR-025](025-local-object-effect-footprints.md) objektum-hatásnyomait.

## Kontextus

Az [ADR-099](099-valid-plain-operations.md) mérése után a `valid` szerződésű `param` kampányban a JavaScript-rés 13-ról 26-ra nőtt. A többletet egyetlen program (7-es mag) adta, 19 réssel:

```js
function evaluate(data, limit) {
  const out = [];
  const c0 = data.a;
  …
  const c3 = Object.keys(data).length;
  out.push(c0);
  const c5 = Object.keys(data).length;
  …
}
```

Az `out.push(c0)` minden olvasási egységhez képest sorrendben maradt, pedig a `c3` és a `c5` sora nem érheti el az `out` tömböt. Két ok együtt kötötte:
1. **A hatásnyom hiánya.** A hatásnyom-értelmező egy lista szintű névről csak három esetet ismert: saját objektum, konstruktorparaméter (külső érték, `OTHER`), primitív. A `c0` (`const c0 = data.a`) egyik sem volt, ezért az `out.push(c0)` nem kapott hatásnyomot, és ismeretlen gát lett.
2. **Az olvasási egység és a hatásnyom párja.** Hatásnyommal sem volt szabály arra, hogy egy olvasási egység (ADR-050) és egy saját objektumon dolgozó utasítás felcserélhető-e.

## Döntés

Csak a `valid` szerződés alatt, és csak ha a szerződés a programra alkalmazható (ADR-050, 3. pont). Az alapszerződés (`any`) változatlan.

1. **Külső egyszerű adat a hatásnyomban** ([object-footprints.ts](../../src/author/object-footprints.ts), új `FootprintHost.plainData`; megvalósítás: [statement-ordering.ts](../../src/author/statement-ordering.ts)). Külső érték (`OTHER`: tárolható, de nem lehet rajta műveletet végezni) az a kötés, amely:
   - egy nem írt, egyszerű nevű, nem maradék paraméter; vagy
   - egy `const`, amelynek kezdőértéke:
     - nem `new` és nem tömb- vagy objektumliterál (ezekből saját objektum lesz);
     - csak olvas (`readOnly`);
     - csak ilyen kötéseket, nem deklarált beépítetteket és a saját visszahívásainak paramétereit nevezi meg, `this`-t nem.

   A vizsgálat rekurzív, körfigyeléssel; kötésenként egyszer fut.
2. **Olvasási egység és hatásnyom** (`objectOrder`). Egy hatásnyom nélküli olvasási egység és egy hatásnyommal bíró utasítás felcserélhető, kivéve ha:
   - a hatásnyom dobhat (`may-throw`);
   - a hatásnyom külső kódot futtat, amely a beolvasott adatot írhatja (`external-call-order`).

## Helyességi érv

- **Az olvasási egység nem éri el a saját objektumot.** Az ADR-025 szökési szabálya szerint egy saját objektum, amelyet hatásnyom nélküli utasítás nevez meg, kiszökik, és onnan egyetlen utasítás sem kap rá hatásnyomot. Egy hatásnyom nélküli olvasási egység tehát csak olyan saját objektumot érhet el, amelynek a nevét nem írja le.
  - **Más néven** csak akkor érhetné el, ha egy kötés a saját objektumot tartja. Az 1. pont ezt zárja ki: a külső adatként kezelt kötés kezdőértéke semmilyen nem külső kötést nem nevez meg, tehát saját objektumot sem. A tárolt hivatkozást (`data.keep = out`) a szökési szabály kezeli: az az utasítás a külső értéken nem végezhet műveletet, nincs hatásnyoma, így az `out` kiszökik.
  - **A külső adat** a `valid` szerződés szerint érvényes egyszerű adat; a lista saját objektuma a hívás előtt nem létezett, így a paraméter nem lehet az. A nem írt paraméter végig ugyanazt az értéket tartja.
- **A hatásnyommal bíró utasítás** csak a saját objektumokat olvassa és írja (ADR-025), külső adatot nem. A dobás és a külső hívás sorrendben marad.
- **A kettő tehát** diszjunkt állapoton dolgozik. Minden elfogadott sorrendben ugyanazt az objektum- és kötésállapotot látják; a név szerinti adatfüggőség (például `c0` → `out.push(c0)`) változatlanul köt.
- **Az orákulum** nem változott: futtatással és saját osztályozóval ítél, és a rés éppen azokat a sorrendeket mutatta, amelyeket a generátor fölöslegesen elutasított.

## Mérés

- **Pillanatkép:** a v51-es pillanatképben is meglévő 1 392 modellből 6 változott, mind `valid` szerződéssel generálva (a 7-es `param` mag mindkét nyelven, és a `value-guards-unknown` fixture, ahol az elfogadott sorrendek száma változatlan, 14). Az alapszerződésnél egy sem, ezért az alapszerződésű kampány érvényes marad; a gyors kampány alapvonalában csak a címke változott.
- **Kampány a `valid` szerződésen** (12 mag, mind a 7 fajta, `strict`, `es2015` és `sloppy` környezet): 0 hibás elfogadás minden csoportban.
  - **A `param` fajta:** 491 → 516 elfogadott sorrend nyelvenként; a rés 26 → 7 (4 319 → 4 325 mért sorrend).
  - **A 7-es mag:** 47 → 72 elfogadott sorrend, 19 → 0 rés.
  - **A maradék 7 rés** (2-es mag: 1, 10-es mag: 6) más mechanizmus: a bemenet írása (`data.a = c0`) egy külső hívás (`record(…)`) mellett. Ez nem saját objektum, ezért ez a szabály nem érinti.
  - **A többi fajta** változatlanul 0 hibás elfogadással fut.
- **Monotonitás:** 334 program (a katalógus minden fixture-je `valid` szerződéssel, a korpusz `valid` fixture-jei és a 24 `param` kampányprogram), 362 572 sorrend. 102 sorrendet csak a v52 fogad el, a v51 által elfogadottak közül a v52 egyet sem utasít el.
- **Korpusz:** 132 fixture, 0 hibás elfogadás; az alapvonal nem változott.
- **Példák:** a 16 példa közül egyiknek sem változott a szabálykészlete, csak a szabályverzió címkéje.

## Bizonyíték

[valid-own-object-reads.test.mjs](../../tests/valid-own-object-reads.test.mjs):
- **pozitív:** a kampány tanúja; az `out.push(c0)` a ciklus és az `Object.keys(data)` olvasások elé és mögé is kerülhet, 0 réssel;
- **az alapszerződés változatlan:** ugyanaz a program kötött marad;
- **negatív:** a saját tömb más néven: álnév (`const alias = out`), burkoló tömb (`[out]`), tárolt hivatkozás (`data.keep = out`), feltételes érték (`c0 ? out : data.items`), visszahívás (`v > out.length`), belső rész (`out.list`). Mindegyik kötött marad, mindegyiken 0 a hibás elfogadás.

A teszt tanúja a v51 generátorral (HEAD munkafa) elbukik, a negatív esetek ott is kötöttek.

## Tervezési review (ADR-037)

- **Tulajdonos:**
  - a bemeneti szerződés tudása (mi a külső egyszerű adat) az utasításrendezésé, amely a `facts`-et és a `readOnly`-t is birtokolja;
  - a hatásnyom-értelmező csak egy kérdést tesz fel (`plainData`), a szerződésről nem tud.
- **Interfész:** a `FootprintHost` egy választható metódussal bővült; egyetlen hívója van. Rejtve marad: a szerződés alkalmazhatósága, a kezdőérték vizsgálata és a gyorsítótár.
- **Design twice:**
  - *Minden `const` külső érték, amely nem saját objektum:* elvetve. Az álnév (`const alias = out`) így elfedné a saját tömböt.
  - *Az olvasási egység saját hatásnyomot kap (a beolvasott külső adat mint objektum):* elvetve. A külső adat nem a lista saját objektuma; az ADR-099 is így döntött a ciklusnál.
