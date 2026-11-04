# ADR-077 – Az ős settere csak az általa elért mezőket köti (v43)

Állapot: **elfogadva** (2026-11-04), szabályverzió `scoped-effect-analysis-v43`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-22 tétele, a (b) ok. Pontosítja az [ADR-073](073-base-chain-fields-and-defaults.md)/[ADR-074](074-inherit-campaign-kind.md) ősláncfeltételét, és az [ADR-076](076-detached-field-initialisers.md) leválasztott mezőjére épül.

## Kontextus

A `[[Set]]` mezőmódban (ES2015-re fordított JavaScript, TypeScript `useDefineForClassFields: false`) az `f4 = 9` mező értékadás. Ha az ősnek `f4` nevű settere van, az fut le a példányon. Az ADR-073 ezért az ilyen mezőt kódot futtató tagnak vette, és minden laza mező után kötötte.

```js
class Base8 {
  set f3(value) {
    record('set f3', value, this.f1);
    this._f3 = value;
  }
}
class Item8 extends Base8 {
  f0 = 5;
  f1 = 6;
  f2 = this.f1;
  f3 = 7;
  f4 = 8;
}
```

A setter csak az `f1`-et olvassa és az `_f3`-at írja. Az `f0`, az `f2` és az `f4` létrejöttét nem látja, mégis mind kötött volt. A v42 után ez az `inherit` kampány réseinek nagy része volt: JS 108, TS 52.

## Döntés ([type-member-ordering.ts](../../src/author/type-member-ordering.ts))

1. **A setter hatásnyoma** (`thisNames`): azok a példánynevek, amelyeket a setter olvas, illetve ír. Csak akkor ismert, ha a setter a `this`-t kizárólag `this.név` alakban használja, és:
   - a hozzáférést nem hívja meg (`this.m()` a példányt a metódusnak adná);
   - nem beágyazott függvényben áll (egy `this`-t használó nyílfüggvény kiszöktetné a példányt);
   - a név nem a lánc accessora (egy getter vagy setter további kódot futtatna);
   - nincs `super`, `eval` vagy `arguments`.

   A TypeScript típusburkai (`(this as any).f1`, `this!`, `<any>this`) nem változtatnak ezen, mert nem kerülnek a kibocsátott kódba. Privát név (`this.#x`) a leszármazott nyilvános mezőivel nem ütközhet, ezért nem számít.
2. **Olvasás és írás:**
   - az egyszerű `=` bal oldala írás;
   - az összetett értékadás (`+=`, `??=` …), a `++`/`--`, a `delete`, a destrukturáló és a `for … in/of` cél olvasás és írás is;
   - minden más olvasás.
3. **A setter mező leválasztott** (ADR-076), a setter hatásnyomával. Feltételek:
   - a konstrukció csendes;
   - a kezdőérték nem nevezi meg a példányt;
   - a legközelebbi ős, amelynek ilyen nevű tagja van, pontosan egy setterrel (és legfeljebb egy getterrel) definiálja.

   Ha a legközelebbi ilyen tag metódus vagy mező, az adattulajdonság, és az értékadás kódot nem futtat. Ilyenkor a hatásnyom üres.
4. **A rendezés:** egy laza mező a mező nevét írja, a másoló mező (ADR-073) a forrását olvassa is. Egy leválasztott mező és egy laza mező akkor kötött (a referencia sorrendjében), ha egyikük ír egy nevet, amelyet a másik olvas vagy ír. A többi laza mezőhöz képest a setter mező szabad, a kódot futtató tagokhoz képest kötött marad.
5. **Szöveges literál nevű accessor:** egy `['k5']` nevű accessor neve ismert (`k5`). Eddig minden számított nevű accessor ismeretlenné tette az ősláncot, ezért a leszármazott minden mezője kötött volt.

## Helyességi érv

- **Mit érhet el a setter.** A setter a példányt csak a `this`-en át éri el. Az 1. pont szerint ezt csak névvel megadott tulajdonság olvasására és írására használja. Ezek egyike sem futtat kódot: a név nem accessor, és a fájl nem módosít prototípust. A példányt sehová nem adja tovább, és a külső kód, amelyet hív, csak értékeket kap.
- **Konstrukció közben** a példány addig nem szökött ki (csendes konstrukció, ADR-076), és a setter sem szökteti ki. Ezért amit a setter futása a példányon megfigyelhet vagy megváltoztathat, az pontosan a hatásnyom nevei.
- **A sorrend.** Egy laza mező csak a saját kulcsát hozza létre, értéket ír, kódot nem futtat. Ha a neve nem szerepel a setter hatásnyomában, a két tag cseréje sem a setter megfigyeléseit, sem a végállapotot nem változtatja meg.
  - Két olvasás egymáshoz képest szabad.
  - Az írás–olvasás és az írás–írás pár kötött, mert a sorrend dönti el a látott vagy a megmaradó értéket.
  - A kulcsok sorrendje csak felsorolással látszana, ilyenkor viszont laza mező nincs.
- **`[[Define]]` módban** a setter nem fut, a mező csak a kulcsát hozza létre. Ha az ős accessorát elfedi, az csak a mezőt érinti, és ezt a mező sorrendje nem változtatja meg. Az orákulum mindkét módot futtatja.
- **A 3. pont legközelebbi tagja:** az `OrdinarySet` a láncon az első ilyen nevű tulajdonságot használja. Egy ős mezője a példány saját adattulajdonsága, egy metódus írható adattulajdonság a prototípuson, és egyik sem futtat kódot. A csak getterrel definiált név `[[Set]]` módban dobna, ezért ismeretlen marad.

## Mérés

**Teljes kampány, 12 mag, 7 fajta, 2 nyelv** (alapbeállítás, `strict` környezet), v42 → v43:

| Csoport | Elfogadott | Rés | Hibás elfogadás |
| --- | --- | --- | --- |
| `inherit` JS | 395 → 488 | 108 → 44 | 0 |
| `inherit` TS | 412 → 459 | 52 → 18 | 0 |
| a többi 6 fajta | változatlan | változatlan (48) | 0 |
| **Összesen** (366 024 sorrend) | **15 746 → 15 886** | **208 → 110** | **0** |

**Környezetváltozatokkal** (`strict`, `es2015`, `sloppy`; `inherit` és `class`):

| Csoport | `either` rés | `define` rés | Hibás elfogadás |
| --- | --- | --- | --- |
| `inherit` JS | 80 → 16 | 13, változatlan | 0 / 0 |
| `inherit` TS | 52 → 18 | 15, változatlan | 0 / 0 |
| `class` JS/TS | 0 / 19, változatlan | 0 / 19, változatlan | 0 / 0 |

- **A `strict` JS rés (44) és a környezetváltozatos rés (16) különbsége:** 28 sorrendet a generátor helyesen köt, mert a setter olvassa a mezőt. A `strict` környezet natív `[[Define]]` mezőket futtat, ott a setter nem fut, ezért a mérés ezeket résnek látja. Az ES2015-ös kibocsátásban viszont a csere valóban eltér.
- **A „mindkét mód” és a „csak szabványos” beállítás különbsége** így nyelvenként 3 rés. A v40-ben ez még 92 (JS) és 62 (TS) volt.
- **A maradék** az NY-22 (c) oka: az ős mezőjével azonos nevű vagy duplikált accessor, és egy-egy másoló mező.
- **Korpusz:** változatlan. **Gyors alapérték:** az `inherit` JS csoport rése 23 → 9, a többiben csak a szabályverzió címkéje változott.

## Bizonyíték

[setter-footprints.test.mjs](../../tests/setter-footprints.test.mjs). Az orákulum mindkét mezőmódban és az ES2015-ös kibocsátásban is fut, és minden esetben 0 a hibás elfogadás.

Elfogadott cserék:
- **a setter egy mezőt olvas:** a setter mező csak ahhoz a mezőhöz kötött, a többi laza mezővel felcserélhető;
- **olvasás és olvasás:** az olvasott mező másolata szabad a setter mezőhöz képest;
- **TypeScript:** a `(this as any).g` ugyanaz az olvasás.

Kötött cserék (a csere indokoltan elutasított):
- **a setter ír egy mezőt:** egy későbbi azonos nevű laza mező mögötte marad;
- **összetett és destrukturáló cél:** írásnak számít;
- **`this.peek()`:** metódushívás a példányon;
- **`this`-t használó nyílfüggvény:** kiszökteti a példányt;
- **egy ős getterének olvasása:** további kódot futtat.

## Tervezési review (ADR-037)

- **Tulajdonos:** a tagrendezés.
  - A hatásnyom egy kis érték (`Footprint`: olvasott és írt nevek), az egységeken két opcionális mezővel (`touches`, `footprint`).
  - A rendezőciklus egyetlen predikátummal (`meets`) dönti el a kötést.
  - Interfész nem változott.
- **Design twice:**
  - *A setter törzsének teljes hatáselemzése az objektummodellel (ADR-025):* elvetve. Az objektummodell öröklő osztályt nem modellez, a kérdés pedig csak a példány neveire vonatkozik.
  - *Az olvasások és írások összevonása:* elvetve. A mért `random-inherit-*-8` tanúban a setter és a másoló mező ugyanazt a mezőt olvassa, és összevonva ez fölösleges kötés lenne.
- **Mélység és adósság:** az ős feloldását egyetlen függvény végzi (`baseOf`), erre épül a három bejáró (`baseAccessors`, `quietConstruction`, `setterFootprint`). A `baseAccessors` eddig külön oldotta fel az őst; most ugyanazt a `baseOf`-ot használja, változatlan eredménnyel. A három bejáró más-más kérdésre felel (accessornevek, csendes konstrukció, a legközelebbi azonos nevű tag), ezért külön maradnak.
