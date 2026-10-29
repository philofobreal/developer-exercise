# ADR-040 – Ismeretlen hívás primitív argumentummal a metódustörzsben (javasolt)

Állapot: **javasolt** (2026-10-29). A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 4. fázisának 2. tétele. A 2a részfeladat (tervezés és tanúk) kész; a 2b–2e részfeladatok még hátravannak.

## Kontextus

**A mért fő ok:** a generatív kampányban az indokolatlan elutasítások fő oka az `ExpressionStatement` barrier (510 eset a neighbourhood-mérésben).

**A konkrét minta:** egy metódus a törzsében ismeretlen globális függvényt hív primitív argumentummal, például `shout() { record('shout', this.name); }`. Az [ADR-025](025-local-object-effect-footprints.md) hatásnyom-értelmezése ilyenkor feladja:
- az utasítás nem kap hatásnyomot;
- az objektum megszökik;
- onnantól az objektum minden művelete barrier, és a független objektumok műveleteit is sorrendhez köti.

### Mit mondott a szerződés (az orákulum P2/P3 szabálya)

Az első elképzelés az volt, hogy minden nem dobó, hatásnyomos utasítás felcserélhető egy ismeretlen hívással. **Ez ellentmond a szerződésnek, ezért elvetettük.**

- **Két saját objektumon végzett művelet:** a sorrendjüket az orákulum csak futtatással ítéli meg (P3). Ilyen pár például a `b.shout()` és az `a.add(1)`.
- **Listaszintű ismeretlen hívás:** például a `record('start')` külső hatás, és minden nem hatásmentes utasítással kötött marad (P2).

A tanúk ezt mérik ([escape-programs.mjs](../../tests/fixtures/escape-programs.mjs), [escape-witnesses.test.mjs](../../tests/escape-witnesses.test.mjs)):

| Program | Mai állapot (v18) | Cél |
| --- | --- | --- |
| `escape-free-shout-beside-writes` | 11 indokolatlan elutasítás, ebből 10 `ExpressionStatement` | a `shout()` körüli független műveletek szabadok |
| `escape-bound-list-level-call` | a `record('start')` ↔ `a.add(1)` csere jogosan elutasított | változatlan |
| `escape-bound-two-shouts` | két külső hívás cseréje jogosan elutasított (más nyomkövetés) | változatlan |
| `escape-bound-both-throw` | két esetleg dobó utasítás cseréje jogosan elutasított | változatlan |

## Javasolt döntés (2b)

1. **Hívás a metódustörzsben:** a hatásnyom-értelmezés engedi az ismeretlen globális függvény hívását a metódus-, konstruktor- és accessortörzsben, ha minden argumentuma primitív (`Value.prim`, objektum nélkül).
   - **A hatásnyom:** az olvasott mezők (például `this.name`) és egy új jelölés: `external`, vagyis ismeretlen kódot futtat.
   - **Dobás:** az ismeretlen kód dobhat, ezért a hatásnyom `mayThrow` értéke igaz.
   - **Szökés:** az objektum nem szökik meg. Az ismeretlen kód csak primitíveket kap, a saját objektumot nem érheti el.
2. **Ütközés:** két `external` hatásnyom egymáshoz képest kötött marad. Ehhez új indokkód kell: `external-call-order` (`effect`), regisztrálva és bizonyítva.
   - **A többi pár:** az eddigi szabály érvényes; az objektumütközés és két esetleges dobás sorrendet köt.
3. **Listaszintű ismeretlen hívás:** barrier marad, a P2 szerint.
4. **Szabályverzió:** v19. Új szabályverzió-címke, formális szerződés, új ADR-állapot.

## Helyességi érv

- **A saját objektum nem érhető el kívülről:** csak a lista saját, meg nem szökött objektuma kap hatásnyomot. Ilyen objektumot hatásnyom nélküli utasítás nem említ, és primitív argumentumon keresztül sem érhető el. Az ismeretlen kód tehát nem olvassa és nem írja.
- **Kivétel és nem-terminálás:** egy dobó vagy véget nem érő külső hívás után a saját objektum állapota nem figyelhető meg, mert a lista `return`-je nem fut le. A dobás sorrendje csak két esetleg dobó utasítás között számít, és ezeket a `may-throw` köti.
- **Külső hatások:** a nyomkövetés és a globális állapot sorrendjét az `external-call-order` (két külső hívás között) és a barrier-szabály (listaszintű hívással szemben) őrzi.

## Nyitott kérdések a 2b előtt

- **Argumentumok:** mezőt olvasó, primitív argumentum (például `record(this.name)`) a 2b-ben. Objektumot átadó argumentum szökés marad, ez a 2d tétel.
- **Kódcsalád:** a beépített globálisok (például `Math.max`) külön, tiszta kódcsaládot kaphatnak. Ez nem része a 2b-nek.
