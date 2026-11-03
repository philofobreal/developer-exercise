# ADR-073 – Az őslánc a [[Set]] mezőmódban; a másoló mező; az alapértékes paraméter (v39)

Állapot: **elfogadva** (2026-11-03), szabályverzió `scoped-effect-analysis-v39`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-18 és NY-20 tétele. Javít egy hibás elfogadást az [ADR-029](029-unobserved-instance-field-order.md) és az [ADR-068](068-binding-context-member-phases-early-exit.md) laza mezőinél. Kiegészíti az [ADR-025](025-local-object-effect-footprints.md) objektummodelljét.

## Kontextus

Két rés maradt a `class` TS kampányban, mindkettő egyetlen tanúval:

| Tétel | Tanú | Ok |
| --- | --- | --- |
| NY-20 | `random-class-typescript-1`: `#h3 = 4` és `f7 = this.f5` | Az `f7` inicializálóját a modell kódfuttatónak veszi, ezért minden laza mező (`#h3`) után köti. Az `f5` viszont saját adatmező, amely az `f7` előtt már létrejött, így az olvasása nem futtat kódot. |
| NY-18 | `random-class-typescript-10`: `new Item10()` és `new Local()` | Az `Item10` konstruktorának paramétertulajdonsága alapértékes (`readonly c3: number = 4`). Az értelmező minden alapértékes paramétert ismeretlennek vett, ezért az osztály kimaradt az objektummodellből. |

**Hibás elfogadás menet közben.** Az NY-20 vizsgálatakor kiderült, hogy a laza mező szabálya (ADR-029, ADR-068) TypeScriptben hibás elfogadást ad:

```ts
class B { set f5(value: number) { record('set', (this as any).g); } }
class A extends B { f5 = 6; g = 7; }
```

A TypeScript `[[Set]]` mezőmódjában (`useDefineForClassFields: false`) az `f5 = 6` értékadás, és meghívja az ős setterét, amely a `g`-t olvassa. A két mező cseréje tehát megváltoztatja a futást, a generátor mégis elfogadta. A kampány ezt nem foghatta meg, mert a véletlen osztályprogramok ősosztályainak nincs accessora (NY-21).

## Döntés ([type-member-ordering.ts](../../src/author/type-member-ordering.ts), [object-footprints.ts](../../src/author/object-footprints.ts))

1. **Az őslánc accessorai.** Egy osztály ősláncából csak az accessorok nevei számítanak: `get`, `set` és `accessor` mező. Egy metódus, mező vagy paramétertulajdonság írható adattulajdonság, és az értékadás kódfuttatás nélkül létrehozza helyette a saját tulajdonságot. A nevek csak akkor ismertek, ha:
   - minden `extends` egy azonosító;
   - az azonosító a fájlban pontosan egyszer deklarált, és osztálydeklaráció;
   - egyik ősnek sincs számított nevű accessora.

   Ha bármelyik feltétel sérül, a nevek ismeretlenek. A számított nevű metódus nem számít (`random-class-typescript-2`: az első változat ezért 5 elfogadott sorrendet fölöslegesen elutasított).
2. **Laza mező TypeScriptben.** A mező csak akkor laza, ha a neve privát, vagy az őslánc accessorneveit ismerjük, és a mező neve nincs köztük.
   - Ez minden mezőnévre vonatkozik, mert a `[[Set]]` mód az egész láncon keres settert.
   - A `__proto__` nevű mező sosem laza.
   - JavaScriptben a mezők mindig `[[Define]]` szerint jönnek létre, ott a szabály változatlan.
3. **A másoló mező (NY-20).** Az `f = this.g` alakú mező laza, és csak a `g` után kell állnia, ha:
   - a `g` korábbi, egyedi nevű, sima mező ugyanabban az elhelyezésben (példány vagy static);
   - a `g` nem `accessor`, nem `declare`, és nincs dekorátora;
   - sem az `f`, sem a `g` nevét nem definiálhatja ős;
   - a program nem listázza a kulcsokat;
   - a fájl nem módosít prototípust, és nem használ reflexiót.
4. **Alapértékes paraméter (NY-18).** Egy metódus vagy konstruktor paraméterének alapértéke akkor fut, ha az argumentum hiányzik vagy `undefined` lehet.
   - A kiértékelés a hívott törzs hatókörében történik, a korábbi paraméterek már kötve vannak.
   - Ha az argumentum csak `undefined` lehet, a paraméter az alapérték értékét kapja. Ha csak lehet `undefined`, a kettő unióját.
   - A paramétertulajdonság a kötött értéket kapja, az alapértékkel együtt.

## Helyességi érv

- **A `[[Set]]` mód.** A mező inicializálója `this.f = v` értékadás. Ez az `OrdinarySet` szerint a prototípusláncon az első `f` nevű tulajdonságot keresi, és ha az accessor, annak setterét futtatja.
  - A saját osztály `f` nevű accessora kizárt (a név egyedi).
  - Az ősök accessorait az 1. pont adja; az ős metódusa vagy mezője írható adattulajdonság, ezért ott az értékadás saját tulajdonságot hoz létre.
  - Az `Object.prototype` `f` nevű tulajdonságát csak módosítással lehetne setterré tenni (a fájlszintű tiltás kizárja), vagy a `__proto__` az (kizárt).
  - Ha egyik sem áll fenn, az értékadás saját adattulajdonságot hoz létre vagy ír, és kód nem fut.
- **A másoló mező.** A `g` az `f` előtt saját adattulajdonsággá vált:
  - `[[Define]]` módban definícióval;
  - `[[Set]]` módban setter nélküli értékadással (az előző pont szerint).

  A `this.g` olvasása így nem futtat gettert. Az `f` létrehozása sem futtat kódot (2. pont), tehát az `f` inicializálója egyetlen más mezőt sem figyelhet meg, csak a `g` értékét olvassa. Ezért elég a `g` után állnia.
- **Az alapérték.** A JavaScript a hiányzó és az `undefined` argumentumra futtatja az alapértéket, a többire nem. Ha az argumentum lehet `undefined` is, az unió mindkét esetet lefedi. Az alapérték kifejezésének hatásai a hívás hatásnyomába kerülnek, ugyanúgy, mint a törzséi.

## Mérés

**Teljes kampány, 12 mag, 6 fajta, 2 nyelv** (351 664 sorrend, előtte és utána is 0 hibás elfogadás), v38 → v39:

| Csoport | Rés | Elfogadott sorrend | Mi változott |
| --- | --- | --- | --- |
| `class` TS | 21 → 19 | 931 → 933 | NY-20 (másoló mező) és NY-18 (alapértékes paraméter) |
| többi | változatlan | változatlan | |
| **Összesen** | **50 → 48** | **14 937 → 14 939** | |

- **A biztonsági javítás ára:** az első változat az ős minden tagnevét számolta, és a számított nevű metódust ismeretlennek vette. Ez a `random-class-typescript-2` tanúban 5 elfogadott sorrendet fölöslegesen elutasított. A végleges szabály csak az accessorokat számolja, és nincs vesztesége.
- **Korpusz:** változatlan (19 rés). A gyors alapérték egyik `class` TS csoportjának rése 5 → 4.
- **A `class` TS maradéka:** 19 rés, mind az NY-04 (14 `sealed-unit`, 5 `continued-row`).

## Bizonyíték

[class-field-chain.test.mjs](../../tests/class-field-chain.test.mjs), az orákulum mindkét mezőmódban fut:
- **az ős settere** az értékadáskor fut: a laza mezők sorrendje kötött (enélkül hibás elfogadás);
- **ha egyik ős sem definiálja a neveket:** a laza mezők felcserélhetők;
- **az ős azonos nevű metódusa, mezője vagy számított nevű metódusa:** adattulajdonság, a laza mezők felcserélhetők;
- **a másoló mező:** csak a forrása után kell állnia; a forrása elé helyezve indokoltan elutasított;
- **ha egy ős accessora a másolt névvel kódot futtathat:** a másoló mező sorrendje kötött;
- **az alapértékes paraméter:** az osztály az objektummodellben marad, két ilyen objektum művelete felcserélhető;
- mindegyiken 0 hibás elfogadás.

## Tervezési review (ADR-037)

- **Tulajdonosok:**
  - az őslánc és a mezőmód tudása a tagrendezésé (`baseNames`, `assignable`, `copySource`);
  - a paraméterkötés az értelmezőé (`bind`), amelyet a meghívás és a konstruktor is használ.

  Interfész nem változott.
- **Design twice, az őslánc:**
  - *a típusellenőrző feloldása:* elvetve, mert a tagrendezés eddig sem használ checkert, és a fájlon belüli egyedi deklaráció elég;
  - *a `[[Set]]` mód kizárása a környezetből:* elvetve, mert a szerződés mindkét mezőmódra szól (ADR-012).
- **Nyitott (NY-21):** a kampány véletlen osztályprogramjai nem generálnak ősosztálybeli accessort. Ezt a hibás elfogadást egy célzott próba hozta elő, nem a kampány.
