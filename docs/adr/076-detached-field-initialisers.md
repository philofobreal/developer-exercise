# ADR-076 – A példányt el nem érő mezőkezdőérték nem köti a laza mezőket (v42)

Állapot: **elfogadva** (2026-11-04), szabályverzió `scoped-effect-analysis-v42`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-22 tétele, az (a) ok. Kiegészíti az [ADR-029](029-unobserved-instance-field-order.md) és az [ADR-068](068-binding-context-member-phases-early-exit.md) laza mezőit, és az [ADR-040](040-unknown-calls-and-unescaped-objects.md) elvét (a ki nem szökött objektumot külső kód nem éri el) alkalmazza a félig felépített példányra.

## Kontextus

Az `inherit` kampány réseinek legnagyobb oka ez a minta (ADR-074):

```js
class Item9 extends Base9 {
  f0 = 6;
  f1 = record('f1') ?? 7;
  f2 = 7;
}
```

Az `f1` kezdőértéke kódot futtat, ezért a tagrendezés minden laza mező (`f0`, `f2`) után kötötte: a kód megfigyelhetné, mely mezők jöttek már létre. A `record` viszont csak egy szöveget kap, és a félig felépített példányt nem éri el. A laza mezők létrejöttének sorrendjét így nem láthatja.

## Döntés ([type-member-ordering.ts](../../src/author/type-member-ordering.ts))

1. **Leválasztott mező:** egy példánymező, amelynek a kezdőértéke kódot futtat, de nem nevezheti meg a példányt. Feltételek:
   - a kezdőértékben nincs `this`, `super`, `eval` vagy `arguments`, egy beágyazott függvényben sem;
   - a mező neve egyedi, nem `accessor`, `declare` vagy `abstract`, és nincs dekorátora;
   - a mező létrehozása nem futtathat settert (ADR-073: privát név, vagy az őslánc accessorai között nincs ilyen név; `define` módban mindig így van, ADR-075);
   - a program nem listázza a kulcsokat, és a fájl nem módosít prototípust, és nem használ reflexiót.
2. **Csendes konstrukció.** A példány a mező futása előtt nem szökhet ki. Ezért az osztály minden őse:
   - fájlon belüli, egyszer deklarált osztály, dekorátorok nélkül, és a lánc accessornevei ismertek;
   - az ősök konstruktorában és példánymezőinek kezdőértékében nincs `this`;
   - `[[Set]]` módban egy ős mezője sem viseli a lánc egyik accessorának nevét, mert akkor az értékadás settert futtat a példányon;
   - a lánc egyik paramétertulajdonsága sem viseli egy accessor nevét, mert a TypeScript ezt mindkét módban értékadással hozza létre.
3. **A saját korábbi tagok.** A mező csak akkor leválasztott, ha előtte egyetlen olyan saját tag sem áll, amely kódot futtat, és nem leválasztott. Ilyen tag kiszivárogtathatta a példányt, például `f0 = keep(this)`.
4. **A rendezés:**
   - a leválasztott mező a többi kódot futtató tag után áll, ahogy eddig (a külső hívások sorrendje és a dobás megmarad);
   - a laza mezőkhöz viszont nem kötött: nem követi őket, és a laza mezők sem követik őt, csak a legutóbbi nem leválasztott tagot.

## Helyességi érv

- **Mikor futnak a mezők.** Egy osztály példánymezői a konstrukció elején jönnek létre:
  - alaposztályban a konstruktor paraméterei és törzse előtt;
  - leszármazottban közvetlenül a `super()` visszatérése után.

  Előttük csak az ősök konstrukciója és a saját korábbi tagok futnak. A leszármazott konstruktorában a `super()` előtt a `this` nem érhető el.
- **A példány elérhetősége.** A példányt külső kód csak úgy érheti el, ha egy referencia kijutott rá. A referencia forrása a `this`, a `super` által futtatott kód, vagy egy setter, amelyet egy értékadás a példányon futtat. A 2. pont az ősök konstrukciójában mindhármat kizárja, a 3. pont a saját korábbi tagokban, az 1. pont magában a kezdőértékben.
- **A rendezés.** A leválasztott mező minden kódot futtató taghoz képest kötött. Egy laza mező (ADR-029) csak a kulcsát hozza létre, kódot nem futtat. Ha egy ilyen mező a leválasztott mező elé vagy mögé kerül, az csak a példányon látszana, a példány pedig a leválasztott mező futásakor senki számára nem elérhető. A dobás a félig felépített példányt elérhetetlenül hagyja.
- **A kulcssorrend** csak felsorolással látszik; ilyenkor laza mező sincs (`enumeratedKeys`).

## Mérés

**Teljes kampány, 12 mag, 7 fajta, 2 nyelv**, v41 → v42 (az alapbeállítás, csak `strict` környezet):

| Csoport | Elfogadott | Rés | Hibás elfogadás |
| --- | --- | --- | --- |
| `inherit` JS | 358 → 395 | 133 → 108 | 0 |
| `inherit` TS | 374 → 412 | 77 → 52 | 0 |
| a többi 6 fajta | változatlan | változatlan (48) | 0 |

**Környezetváltozatokkal** (`strict`, `es2015`, `sloppy`; `inherit` és `class`):

| Csoport | `either` rés | `define` rés | Hibás elfogadás |
| --- | --- | --- | --- |
| `inherit` JS | 105 → 80 | 56 → 13 | 0 / 0 |
| `inherit` TS | 77 → 52 | 58 → 15 | 0 / 0 |
| `class` JS/TS | 0 / 19, változatlan | 0 / 19, változatlan | 0 / 0 |

- **Mindkét mód (`either`):** a maradék rés nagy része az NY-22 (b) oka: az ős azonos nevű settere minden literál mezőt köt, akkor is, ha más mezőt figyel.
- **Csak szabványos mód (`define`):** a maradék nyelvenként 13 és 15 rés. Az NY-22 (c) ok: az ős duplikált accessorai és az ős mezőjével azonos nevű accessor (`unclassified-member`, `duplicate-definition-order`), valamint egy-egy másoló mező.
- **Korpusz és gyors alapérték:** változatlan, csak a szabályverzió címkéje.

## Bizonyíték

[detached-fields.test.mjs](../../tests/detached-fields.test.mjs), az orákulum mindkét mezőmódban és az ES2015-ös lefordításban is fut:
- **a leválasztott mező** a laza mezőkkel mindkét irányban felcserélhető, mindkét nyelven;
- **öt negatív eset** a kiszökésre, mindegyikben a csere indokoltan elutasított, vagyis az orákulum szerint a futás tényleg eltér:
  - az ős konstruktora tárolja a `this`-t;
  - egy korábbi saját mező kiadja a `this`-t;
  - a kezdőérték egy `this`-t használó nyílfüggvényt ad át;
  - `[[Set]]` módban az ős mezőjének értékadása a leszármazott setterét futtatja (`define` módban ugyanez a csere elfogadott);
  - a TypeScript paramétertulajdonsága az ős setterét futtatja;
- mindegyiken 0 hibás elfogadás.

## Tervezési review (ADR-037)

- **Tulajdonos:** a tagrendezés. A „leválasztott” tény egy egységjelző (`detached`), a „csendes konstrukció” egy függvény az őslánc meglévő ismeretén (`declarations`). Interfész nem változott.
- **Design twice:**
  - *A hatásnyom-elemzés (ADR-025) kiterjesztése a mezőkezdőértékekre:* elvetve. Az objektummodell öröklő osztályt nem modellez, és a kérdés nem a külső kód hatása, hanem csak a példány elérhetősége.
  - *Csak primitív argumentumú hívás:* elvetve. Szűkebb, és nem a lényeget mondja ki: egy objektum argumentum is ártalmatlan, ha nem a példány, és egy argumentum nélküli hívás is veszélyes, ha a példány már kiszökött.
- **Mélység:** a rendezőciklus egy második „legutóbbi” térképet kapott (`barrier`): a laza mezők ezt követik, a többi tag a régit. Az ősláncot most két függvény járja be (`baseAccessors` és `quietConstruction`). Az összevonásuk egy későbbi refaktorálás, mert a két kérdés feltételei eltérnek.
