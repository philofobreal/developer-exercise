# ADR-069 – Mélyen ellenséges bemenet a mérésben; számnevű és duplikált metódusú saját osztály (v35)

Állapot: **elfogadva** (2026-11-03), szabályverzió `scoped-effect-analysis-v35`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-03 tétele (hatásösszegzés) újramérve és szűkítve. Kiegészíti az [ADR-061](061-oracle-multiple-inputs.md) próbáit és az [ADR-025](025-local-object-effect-footprints.md) objektummodelljét.

## Kontextus

A NY-03 tételhez a v34-es kampány 31 rést rendelt (`effectful-or-unknown-initializer`). A tanúk szerint ezek közül egyik sem `var v = f()` alakú, és egyik sem a hatásösszegzés hiánya.

| Csoport | Rés | A tényleges ok |
| --- | --- | --- |
| `param` JS/TS | 12 + 12 | `const c2 = c0 + c1;` és `const c3 = data.b + '3';`: „bármilyen bemenet” mellett mindkettő gettert vagy konverziót futtathat. A generátornak igaza van; az orákulum próbái nem adtak olyan bemenetet, amelyben a `data.items.length` is konverziót naplózó objektum. |
| `script` JS | 5 | `let l3 = v1 + 1`, ahol `v1` szkriptszintű `var`. A szerződés szerint más szkript is írhatja (ADR-009), ezért ez tudatos konzervatív szabály. |
| `class` JS/TS | 1 + 1 | `new Item()` és `new Local()`: az osztály a saját objektum modelljéből kimaradt, mert számnevű (`0() {}`) vagy kétszer definiált metódusa volt. |

## Döntés

1. **Mélyen ellenséges bemenet (mérés):** a paraméteres programok „bármilyen bemenet” próbái egy rekurzív Proxyt is kapnak.
   - **Naplóz:** minden olvasást, írást, kulcslistázást (`ownKeys`), `in` vizsgálatot, iterációt és konverziót (`Symbol.toPrimitive`).
   - **Olvasás:** újabb ilyen Proxyt ad vissza.
   - **Konverzió:** a következő számot adja, így két konverzió sorrendje az értékekben is látszik.

   A `valid` szerződés próbái változatlanok, mert az sima adatot ígér.
2. **Saját osztály:**
   - **Számnév:** a számnevű metódus a kanonikus számkulcsát kapja (`0`, `1.0` → `1`).
   - **Duplikált metódus:** az azonos nevű metódusok közül a *későbbi* a prototípus metódusa, egy hívás azt futtatja. Ez megfelel a ClassDefinitionEvaluation sorrendjének (ADR-068).
   - **Kiesik továbbra is** a mező, getter vagy setter névütközése.
3. **A NY-03 többi része (felső szintű függvények összegzése):** a mérésben jelenleg nincs rá eset. Spekulatív bonyolultságot nem építünk be (ADR-037); a tétel a jegyzékben „nem mért haszon” jelzéssel marad.

## Helyességi érv

- **1. pont:** a próba csak az orákulumot erősíti. Egy elfogadott sorrend, amelyet a próba megkülönböztet, hibás elfogadásként jelenik meg. Ilyen nem volt: a 212 + 212 elfogadott sorrend mind kiállta.
- **2. pont, számnév:** a `0` és a `'0'` ugyanaz a tulajdonságkulcs, a numerikus literál kulcsa a `ToString(ToNumber)`.
- **2. pont, duplikált metódus:** a prototípuson az utolsó `DefineMethodProperty` marad. A korábbi definíció törzse sosem fut, tehát hatásnyoma sincs. A negatív teszt ezt rögzíti: ha az elemzés az első, üres törzset venné, hibásan engedné a cserét.

## Mérés

**Teljes kampány, 12 mag, 6 fajta, 2 nyelv** (351 664 sorrend, előtte és utána is 0 hibás elfogadás), v34 → v35:

| Csoport | Rés | Elfogadott sorrend | Mi változott |
| --- | --- | --- | --- |
| `param` JS/TS | 12 + 12 → 0 | változatlan (212 + 212) | mérés: mind indokolt elutasítás |
| `class` JS | 1 → 0 | 883 → 884 | saját osztály (2. pont) |
| többi | változatlan | változatlan | |
| **Összesen** | **175 → 150** | **14 790 → 14 791** | |

- **Korpusz:** változatlan (19 rés).
- **Gyors alapérték:** `param` JS/TS 3 → 0.
- **A `class` TS maradék `effectful-or-unknown-initializer` rése** (`new Item10()`, overload és paramétertulajdonság) a NY-18 tétel.

## Bizonyíték

[deep-hostile-and-class-model.test.mjs](../../tests/deep-hostile-and-class-model.test.mjs):
- **mély próba:** a korábbi `param` rés (`c2`/`c3` csere) indokolt elutasítás lett;
- **`valid` szerződés:** nem kap mély próbát;
- **számnevű és duplikált metódusú osztály:** két ilyen `new` sorrendje szabad;
- **„a későbbi nyer”:** a `bump()` második definíciójának írása köti az olvasást;
- mindegyiken 0 hibás elfogadás.

## Tervezési review (ADR-037)

- **Tulajdonosok:**
  - a próbák tudása a programgenerátoré (`random-programs.mjs`);
  - a kulcs- és metódusfeloldás az objektummodellé (`nameOf`, `classInfo`).

  Interfész nem változott.
- **Design twice, a NY-03 hatásösszegzés:** elvetve, mert a mért réseken nem javít, és új, hívásláncon átívelő elemzést vinne be.
