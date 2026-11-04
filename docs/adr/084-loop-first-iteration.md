# ADR-084 – A ciklus első köre külön (v48)

Állapot: **elfogadva** (2026-11-04), szabályverzió `scoped-effect-analysis-v48`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-01 tétele, a felhasználó kifejezett kérésére. Az [ADR-070](070-loop-body-at-most-once.md) és az [ADR-072](072-certain-overwrites.md) két korábbi elvetését (ciklusgörgetés, tagonkénti kiterítés) egy szűk alakban vizsgálja újra.

## Kontextus

A `flow-*-7` tanúban egy ciklus első körét a törzs feltétele kihagyja:

```js
a.attach(shared);
let seen = 0;
for (const entry of boxes) {      // boxes = [a, b]
  if (seen > 0) {
    entry.note('again');
  }
  seen = seen + 1;
}
```

- **Mi történik futáskor:** az első kör az `a`-n fut, de nem ír, mert `seen === 0`. A második a `b`-n fut és ír.
- **Mit lát az értelmező:** a törzset egyszer értelmezi, az `entry` minden elemet felvehet, a `seen` ismeretlen. Ezért úgy veszi, hogy a ciklus az `a` naplójába is írhat, és az `a.attach(shared)` nem kerülhet a ciklus mögé.
- **Mérés:** nyelvenként 1 rés.

**Az előzmény:** az ADR-070 a ciklusgörgetést elvetette (két kört kellene kezelni), az ADR-072 a tagonkénti kiterítést (a hatásnyom tagonként nőne). A jegyzék ezért a tételt egy második tanúhoz kötötte. A felhasználó kérésére ez az ADR mégis megcsinálja, egy szűk alakban.

## Döntés ([object-footprints.ts](../../src/author/object-footprints.ts), [statement-ordering.ts](../../src/author/statement-ordering.ts))

1. **Az első kör külön.** Egy `for…of` első köre külön értelmezett, ha:
   - a ciklus egyetlen saját tömbliterálon megy végig;
   - a tömböt a létrehozó utasításán kívül egyetlen listautasítás sem írja (elemcelláját csak a létrehozás írta);
   - nem futott rajta `unshift`, `pop` vagy `shift`;
   - a ciklusváltozó egy név, és a törzsben nincs ugrás;
   - a törzs olvas legalább egy olyan lista szintű lokálist, amelynek az értéke a ciklus elején ismert (2. pont).

   Ekkor az első kör a tömb első elemét köti, és az ismert lokálisokat a kezdőértékükkel. A többi kör a többi elemet köti, a lokálisok ott ismeretlenek, mint eddig.
2. **Ismert kezdőérték** (`FootprintHost.entry`): egy lista szintű lokális értéke a ciklus elején ismert, ha:
   - egyetlen deklarációs utasítása ugyanabban a listában, a ciklus előtt áll, és literál a kezdőértéke;
   - a deklaráción kívül csak a ciklus írja, beágyazott függvényen és osztályon kívül.
3. **Összetett értékadás.** Az első kör a kezdőértékű lokálist a keret környezetébe veszi. Ott egy összetett értékadás (`seen += 2`) ugyanúgy primitív marad, mint a `++`/`--`, ha a régi érték és a jobb oldal primitív. Egy objektum operandus a `valueOf`-ját futtatná, ezért az ismeretlen marad.
   - A teljes ellenőrzés a véglegesítés előtt ezt a hiányt fogta meg: az ADR-048 `primitive-locals` tanúja (`seen += 2`) e nélkül rés lett volna.
   - A javítás után a 1 368 generált modell (katalógus és kampány) bájtra azonos, ezért a lenti kampány rá is érvényes.
4. **A többi változatlan.** Az ismert őrfeltétel (ADR-032) az első körben választ ágat. A biztos írás (ADR-072) a többi körre a maradék tagokat veszi „minden tag”-nak, és csak ha a tömb minden eleme egy saját objektum.

## Helyességi érv

- **A kezdőérték.** A ciklus olvassa a lokálist, ezért a deklaráció utáni adatfüggőség minden elfogadott sorrendben előtte tartja. Más utasítás nem írja, így a ciklus elején a deklaráció literálja áll benne.
- **A körök.** A tömb elemei a literál elemei, a literál sorrendjében:
  - a létrehozás után semmi nem írta;
  - nem futott rajta sorrendet változtató tömbművelet;
  - a törzs írása pedig kizárja a hatásnyomot (ADR-070).

  Az első kör tehát pontosan az első elemen, a kezdőértékekkel fut. A többi kör a többi elemen fut, és ott a lokálisok értéke minden ismert értéket lefed.
- **A hatásnyom** a két értelmezés uniója, így minden kör hatását tartalmazza.
  - Az első elemet a többi kör csak akkor köti, ha a literál megismétli. Ilyenkor ott is szerepel, és a hatása nem marad ki (ezt a negatív eset mutatja).
  - Az első elemre az egyszeri értelmezéshez képest csak az az írás marad el, amelyet az első kör kezdőértékei szerint az őrfeltétel kizár.

## Mérés

**Kampány, 12 mag, v47 → v48.** A futás a v50 kódján ment, ezért az [ADR-086](086-regular-expression-literal.md) és az [ADR-087](087-erased-method-signatures.md) változását is tartalmazza.
- **`strict` és `hostile` környezet, mind a 7 fajta:**
  - a `flow` rése nyelvenként 1 → 0, az elfogadott sorrend nyelvenként +1 (JS 1 881 → 1 882, TS 2 292 → 2 293);
  - a többi csoport sorra azonos a v47-tel;
  - összesen 366 124 sorrend, 16 039 elfogadott, 28 rés, 0 hibás elfogadás.
- **A maradék 28 rés** mind az `inherit` JS fajtáé (`class-evaluation-order`), és a v44 óta változatlan. Ezek nem valódi rések. A program a régi (`[[Set]]`) mezőmódban máshogy fut, mert ott a mezőt az ős settere kapja. Ezt a módot csak az `es2015` környezet futtatja ([ADR-062](062-oracle-environments-and-for-in.md)), és a `strict`+`hostile` mérés nem tartalmazza.
  - Külön mérve: `strict` és `strict,sloppy` mellett 28 rés, `strict,es2015` mellett 0.
  - `classFields: 'define'` beállítással ugyanez a csoport 0 rést ad és 572 elfogadott sorrendet ([ADR-075](075-standard-class-fields-setting.md)).
- **Környezetváltozatokkal** (`strict`, `es2015`, `sloppy`; `inherit` és `class`, mindkét mezőmódban): 0 hibás elfogadás. A `classFields: 'define'` mód 4 rése az [ADR-083](083-accessor-field-in-key-chain.md) árnyékolt ősé.

## Bizonyíték

[loop-first-iteration.test.mjs](../../tests/loop-first-iteration.test.mjs):
- **az őrfeltétel kihagyja az első kört:** az `a.attach(shared)` a ciklus mögé kerülhet, a csere elfogadott és egyenértékű;
- **négy negatív eset**, mindegyikben egy feltétel sérül, és a csere indokoltan elutasított:
  - egy másik utasítás is írja a számlálót;
  - egy nyílfüggvény írja a számlálót;
  - a tömbbe a létrehozása után `push` ír;
  - a literál az első elemet később megismétli;
- **összetett értékadás:** a `seen += 1` számlál, mint a `seen = seen + 1`, a csere elfogadott; a `seen += entry` (objektum operandus) indokoltan nem;
- mindegyiken 0 hibás elfogadás.

## Tervezési review (ADR-037)

- **Tulajdonosok:**
  - a „kezdőérték” tudása az utasításrendezésé (`entry`, a kötések írásainak térképéből);
  - a kiterítés az értelmezőé.

  A `FootprintHost` egy opcionális műveletet kapott (`entry`); ez az egyetlen interfészbővítés, és csak az utasításrendezés tölti ki.
- **Design twice:**
  - *Teljes kiterítés minden tagra, erős frissítéssel:* elvetve, az ADR-072 okából: a hatásnyom tagonként nőne, és a lokálisok körről körre követése új értelmezőfogalom (erős frissítés) lenne.
  - *A rés elfogadása:* ez volt a javaslat (a jegyzék feltétele: második tanú). A felhasználó a megvalósítást kérte, és ez a változat a meglévő fogalmakkal (első elem, ismert érték, egy kör) megoldható.
- **Adósság:** az értelmező (NY-12) egy újabb esetággal nőtt. A ciklus-kezelés most három utat ismer: egyszer futó (ADR-070), minden tagon (ADR-072), és az első kör külön. Ez a három egy jövőbeli „kör-értelmező” egységbe vonható.
