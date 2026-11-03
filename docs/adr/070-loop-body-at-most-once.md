# ADR-070 – A legfeljebb egyszer futó `for … of` törzs csak az első elemet látja (v36)

Állapot: **elfogadva** (2026-11-03), szabályverzió `scoped-effect-analysis-v36`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-01 tétele. Pontosítja az [ADR-034](034-list-level-control-flow-footprints.md) és az [ADR-046](046-loops-over-own-objects.md) ciklusszabályát.

## Kontextus

A saját tömbön futó `for … of` hatásnyoma eddig a tömb *minden* elemére érvényes volt. Erre azért volt szükség, mert a tömb elemeit a modell folyamérzéketlenül gyűjti. Egy gyakori tanulói alak:

```js
outer: for (const entry of boxes) {
  entry.rename('r3');
  break outer;
}
b.rename('r9');
```

A törzs pontosan egyszer fut le, az első elemmel (`a`). A modell mégis úgy látta, hogy `b`-t is írhatja, ezért a `b.rename('r9')` nem kerülhetett a ciklus elé.

**Mérés a változás előtt (v35, 12 mag):** a `flow` JS/TS nem dobó programjainak 40 + 40 rése. Ebből objektumütközés 35 + 21 + 17, nyelvenként.

## Döntés

1. **A ciklusalak** ([loop-termination.ts](../../src/author/loop-termination.ts), `atMostOnce`). A törzs legfeljebb egyszer fut, ha:
   - az utolsó utasítása egy `break`, amely ezt a ciklust hagyja el (címke nélkül, vagy a ciklus saját címkéjével);
   - és a törzsben nincs erre a ciklusra visszatérő `continue`. Ilyen a beágyazott cikluson kívüli, címke nélküli `continue`, és a ciklus címkéjét nevező `continue` bármilyen mélységben (konzervatívan).
2. **A heap** ([object-footprints.ts](../../src/author/object-footprints.ts)): egy saját tömbliterál első elemét a modell megjegyzi.
   - Ha a tömbön `unshift`, `pop` vagy `shift` futhat, az első elem ismeretlenné válik („átrendezett”). Más tömbmódosítást az elemzett részhalmaz eddig sem enged; az ilyen objektum megszökik.
   - A fixpont újrafut, ha egy tömb átrendezetté válik.
3. **Az egyesítés:** ha a ciklus egyetlen saját tömbön fut, a törzs legfeljebb egyszer fut, és a tömb első eleme ismert, akkor a ciklusváltozó csak az első elem.
   - A tömb egészének olvasása továbbra is a hatásnyom része.
   - A `while` és a `for` ciklusra nem vonatkozik.
4. **Orákulum (P2):** a független orákulum objektumművelet-modellje eddig csak saját azonosítón futó `for … of`-ot ismert. Most az értékekből álló tömbliterálon futót is ismeri (JS és TS). Ennek ciklusváltozója konzervatívan bármelyik saját objektum lehet.
   - Ezt egy célzott tanú hozta elő: a törzsben egy `for (const other of [1]) { continue; }` volt.
   - A generátor az ADR-034 óta kezeli ezt az alakot. Az orákulum az egész külső ciklust ismeretlen hatásnak vette, és `effect-order` hibás elfogadást jelzett, holott a futás szerint a két sorrend egyenértékű volt.
5. **Érték-perturbáció (mérés, ADR-067):** a megsértett sor által *lezárt* blokk sorai is előre kerülnek, nem csak az általa nyitottéi. Egy `}` sor az egész utasítását képviseli; a döntő literál (például egy `if ('k' === 'k')` feltétele) a nyitó sorban áll.

## Helyességi érv

- **Egy kör:** a `for … of` egy körben az iterátor első elemével futtatja a törzset. A törzs a végén lévő `break`-hez ér, vagy előbb kilép (`return`, `throw`, külső `break`). Másodszor nem fut, mert nincs rá visszatérő `continue`.
- **Az első elem:** a saját tömbliterál első eleme a létrehozáskor kiértékelt érték. Csak az `unshift`, a `pop` és a `shift` változtathatja meg, ezeket a modell figyeli. Az indexes írás, a `splice` és a többi módosítás kívül esik az elemzett részhalmazon. Az ilyen tömb megszökik, és a ciklusnak sincs hatásnyoma.
- **A tömb iterátora:** saját, nem szökött tömbről van szó, és a rögzített környezetben a beépített tömbiterátor fut (ADR-034).

## Mérés

**Teljes kampány, 12 mag, 6 fajta, 2 nyelv** (351 664 sorrend, előtte és utána is 0 hibás elfogadás), v35 → v36:

| Csoport | Rés | Elfogadott sorrend |
| --- | --- | --- |
| `flow` JS, nem dobó | 40 → 23 | 1 827 → 1 845 |
| `flow` TS, nem dobó | 40 → 23 | 2 238 → 2 256 |
| `flow` JS/TS, dobó | 0 → 0 | 579 → 587, 717 → 725 (8 + 8 korábbi halott-kód szándék most elfogadott) |
| többi | változatlan | változatlan |
| **Összesen** | **150 → 116** | **14 791 → 14 843** |

- **Korpusz:** változatlan (19 rés).
- **Gyors alapérték:** `flow` JS 3 → 0, `flow` TS 1 → 0.
- **Az 5. pont (mérés) után:** a `flow` nem dobó rése nyelvenként 23 → 15, az elfogadás változatlan. A teljes rés így **116 → 100**.
- **A `flow` maradéka:** 15 rés nyelvenként, objektumütközés. Lásd a jegyzék NY-01 sorát.

## Bizonyíték

[loop-once.test.mjs](../../tests/loop-once.test.mjs):
- **csak az első elemet látja:** címke nélküli és címkés `break`, valamint belső ciklus `continue`-val;
- **minden elemet láthat:** feltételes `break`; `continue` a `break` előtt;
- **`shift()` a ciklus előtt:** az első elem `b` lesz, ezért kötött;
- mindegyiken 0 hibás elfogadás.

[value-intent.test.mjs](../../tests/value-intent.test.mjs): a valódi rés példája a ciklus túlbecsléséről az overload-csoportra váltott.

## Tervezési review (ADR-037)

- **Tulajdonosok:**
  - a ciklusalak tudása a ciklusérvek moduljáé (ADR-065: `loopEnds` mellett `atMostOnce`);
  - az első elem és az átrendezés a heapé.

  A hatáselemzés csak a választ kérdezi.
- **Design twice:**
  - *Az első kör külön értelmezése (ciklusgörgetés):* elvetve. Az értelmezőben két kört kellene kezelni, a mostani egy boolean és egy heap-tény.
  - *Az elemek sorrendérzékeny követése:* elvetve. Az egész heapet folyamérzékennyé tenné.
