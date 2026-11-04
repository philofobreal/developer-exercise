# ADR-085 – Az objektumheap saját modul (NY-12)

Állapot: **elfogadva** (2026-11-04). A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-12 tétele, amelyet az [ADR-065](065-design-debt-removal-and-module-split.md) rögzített, és az ADR-071, -072 és -084 mélyített. Viselkedésmegőrző refaktorálás: a szabályverzió marad (`scoped-effect-analysis-v48`).

## Kontextus

Az [object-footprints.ts](../../src/author/object-footprints.ts) egyetlen closure-ban tartotta a heapet és az értelmezőt. A heap állapota (pozíciós cellák, biztos felülírások, tömbliterál-tények) tizenkét változóban és nyolc segédfüggvényben élt. Az értelmező ezeket közvetlenül olvasta és írta, és a fixpont `changed` jelzőjét is ő állította minden olyan helyen, ahol egy tény nőtt.

Minden új heaptény (ADR-070 első elem, ADR-071 pozíció, ADR-072 biztos felülírás és tagok, ADR-084 sorrend) újabb párhuzamos térképet és újabb állítási helyet hozott. Ez az Ousterhout-féle „információszivárgás”: a heap tudása az értelmező minden ágában jelen volt.

## Döntés

1. **[footprint-values.ts](../../src/author/footprint-values.ts):** az absztrakt érték algebrája.
   - `Value`, `Literal`, `PRIM`, `STR`, `OTHER`, `union`, `literal`, `objects`;
   - a cellák elnevezése (`WHOLE`, `at`, `objectOf`).
2. **[object-heap.ts](../../src/author/object-heap.ts), `ObjectHeap`:** a heap egyetlen tulajdonosa. Elrejti:
   - **hogyan tárol egy cella** (értékek a beíró listautasítás pozíciójával), és **mit lát belőle** az aktuális utasítás (a pozícióig, a legutóbbi biztos felülíró óta);
   - **a biztos felülírások szűkítését** a fixpont köreiben (`enter`/`leave`);
   - **a tömbliterál-tényeket:** tagok, első elem, átrendezés, sorrend, és ezek érvényességét (az első elem érvénytelen átrendezés után, a sorrend csak addig ismert, amíg más utasítás nem írta a tömböt);
   - **a fixpont jelzőjét** (`changed`): minden tény a saját növekedését jelzi, kívülről csak az objektumazonosság és a szökés jelez (`touch`).
3. **Az értelmező** a heapet a műveletein át hívja (`field`, `items`, `addField`, `addElements`, `literal`, `first`, `members`, `inOrder`, `reshape`, `held`…), áteresztő réteg nélkül. A saját állapota a keret (`Frame`), az objektumazonosság (`kinds`, `fresh`) és a szökés (`escaped`).

## Bizonyíték

- **Bájtra azonos viselkedés:** 1 368 generált modell (a teljes fixture-katalógus `either`/`define` és `any`/`valid` beállítással, valamint a kampány mind a 7 fajtája, 12 mag, 2 nyelv, mindkét mezőmódban) a refaktorálás előtt és után bájtra azonos. Összevetett mezők: sorok, blokkok, élek, proveniencia, projekciós veszteség.
- **Az egyetlen lényegi változás:** a tömbliterál elemeit az értelmező most egyszer értékeli ki (eddig a sorrendtényhez másodszor is). A kiértékelés hatásmentes, a modellek azonosak.
- **Architektúra:** a `verify-architecture` elfogadja az új modulokat. A hatásnyom tesztjei változatlanul átmennek.

## Tervezési review (ADR-037)

- **Mélység:** az `ObjectHeap` egy fogalmat rejt (mit lát egy listautasítás egy objektumból), és a hívónak nincs párhuzamos állapota.
  - A régi `changed = true` szétszórt állításai (11 hely) eltűntek.
  - A „ki látja melyik értéket” szabály (ADR-071, -072) egy helyen van.
- **Interfész:** a művelet szélesebb a kívánatosnál (körülbelül húsz). A tömbtényeké (`literal`, `first`, `members`, `reshaped`, `reshape`, `inOrder`) egy csoportba vonható, ha újabb tömbtény jönne. Most mindegyiknek egy-két hívója van, ezért külön osztályba vonásuk üres réteg lenne.
- **Ami marad:** az értelmező (`block`, `expression`, `call`, `invoke`…) továbbra is egy closure a fájlban. A keretmezők (`certain`, `every`, `top`, `must`, ADR-072) az értelmező saját fogalmai, nem a heapéi.
  - A ciklusok három útja (egyszer futó, minden tagon, első kör külön; ADR-070, -072, -084) egy „kör-értelmezőbe” vonható. Ennek nincs mért haszna, és a jegyzékben nem nyitott tétel.
- **Design twice:**
  - *A heap mint immutábilis érték, utasításonként másolva:* elvetve. Az ADR-071 pozíciós cellája ugyanezt adja másolás nélkül.
  - *Az értelmező felbontása is (kifejezések, utasítások, hívások külön modulba):* elvetve. A részek kölcsönösen rekurzívak (`expression` ↔ `call` ↔ `invoke` ↔ `block`), és a felbontás csak a closure-t cserélné egy hatparaméteres kontextusobjektumra.
