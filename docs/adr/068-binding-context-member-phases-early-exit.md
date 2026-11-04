# ADR-068 – A függvénynév kötési kontextusa, duplikált definíciók, laza static mezők, korai kilépés (v34)

Állapot: **elfogadva** (2026-11-03), szabályverzió `scoped-effect-analysis-v34`. A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 4. fázisának 6. tétele (osztálytag-fázisok és a vezérlés maradéka). Pontosítja az [ADR-019](019-pure-effect-commutation.md), az [ADR-012](012-class-evaluation-phases-and-accessor-pairs.md) és az [ADR-029](029-unobserved-instance-field-order.md) szabályait.

## Kontextus

Az ADR-067 óta a mérés elválasztja a szándékhű elutasítást a réstől. A v33-as kampány (12 mag) rései okonként:

| Ok | Hol | Rés |
| --- | --- | --- |
| `branch-contains-barrier`, `ExpressionStatement` | `function` JS | 11 + 4 |
| `unclassified-member` | `class` JS | 7 |
| `class-evaluation-order` | `class` TS | 6 |
| `branch-contains-barrier` (`throw` az ágban) | `flow` | több |

A tanúk négy okot mutattak.

1. **Hibás kontextus-hozzárendelés (ADR-019).** Egy függvénydeklaráció saját neve (`function f1`) a névegyezés- és az íráskeresésben a függvény *törzsének* kontextusába került, nem abba, amelyben a kötés él. Ezért a `const c5 = typeof f1;` úgy látszott, mintha egy belső függvény írná az `f1`-et, és nem cserélhetett helyet egyetlen barrierrel sem.
2. **Duplikált metódusnevek (ADR-012).** A kétszer definiált metódus fázis nélküli volt, tehát minden taghoz kötött. Pedig minden metódus- és accessordefiníció az osztály definíciójakor települ, minden mezőinicializáló és static kód előtt.
3. **A static fázis.** Az ADR-029 a kódot nem futtató példánymezőt lazává tette, a static és az `accessor` mezőt szándékosan kihagyta. Helyességi ok nem volt rá, csak hatóköri.
4. **Korai kilépés (ADR-019).** Az ADR-019 pedagógiai döntése szerint egy tiszta deklaráció nem kerül egy `return`/`throw`/`break` mögé, akkor sem, ha a futás nem különböztetné meg. Ezt a szabályt a generátor a barrier általános okával jelölte. A szerző ezért nem látta a valódi okot, a mérés pedig résnek számolta.

## Döntés

1. **Kötési kontextus (`bindsIn`):** egy függvénydeklaráció neve a deklarációt körülvevő kontextusban köt, minden más előfordulás a saját kontextusában. Az ADR-019 feltételei (más kontextus írása, névegyezés) ezt használják. Ez hibajavítás, nem lazítás: a kötés ott él, ahol a specifikáció szerint létrejön.
2. **Duplikált definíciók:** ha egy név minden tagja teljes metódus- vagy accessordefiníció (törzzsel, nem számított névvel, dekorátor és megjegyzés nélkül, a sorait birtokolva), akkor:
   - minden ilyen tag definíció, tehát a mezőktől és a static kódtól szabad;
   - az azonos objektumon (prototípus vagy konstruktor) azonos nevű definíciók forrássorrendben kötöttek (`duplicate-definition-order`, adat). A későbbi felülírja a korábbit;
   - a kulcssorrend-lánc (ADR-010) változatlanul érvényes, ha a program listázza a kulcsokat.
3. **Laza static és `accessor` mező:** az ADR-029 lazasága a static fázisra és az `accessor` mezőre is érvényes, ha a mező:
   - egyedi nevű;
   - a kezdőértéke nem futtat kódot;
   - és a program nem listázza a kulcsokat.

   A fázis minden más, kódot futtató egysége az előtte álló laza mezők után marad.
   - **A static mező:** kulcsot hoz létre a konstruktoron. Ez csak felsorolással látszik, és azt a feltétel kizárja.
   - **Az `accessor` mező kezdőértéke:** privát tárolót tölt, kívülről nem látható. A get/set kulcsa a definíciókor jön létre, ezt a kulcssorrend-lánc kezeli.
4. **`early-exit-order` (pedagógiai, `policy` kategória):** ha egy tiszta egység és egy barrier cseréjét *kizárólag* az tiltja, hogy a barrier korán kiléphet, ez a szabály oka. A szabály maga nem változik.
   - **A mérésben:** az osztályozó azt a sorrendet, amelynek minden megsértett szabálya ilyen, szándéknak számolja (`intent`, ok: `policy`), mert futás nem különbözteti meg.
   - **A szerzői felületen:** a szabály eltávolítása ugyanazt a megerősítést kéri, mint eddig (`proven`).
5. **Mérés (orákulum):** az érték-perturbáció (ADR-067) a megsértett sorok által nyitott blokkok literáljait a többi elé veszi. A keret 96 változat. A `case` címke vagy az ágfeltétel dönti el, hogy a halott ág lefut-e.

## Helyességi érv

- **1. pont:** a `function f() {}` kötése a körülvevő függvény (vagy blokk) környezetében jön létre (FunctionDeclarationInstantiation). A törzs nem írja, csak árnyékolhatja. Egy belső, azonos nevű *deklaráció* továbbra is tilt, mert annak a `bindsIn`-je a belső kontextus.
- **2. pont:** a ClassDefinitionEvaluation minden metódust és accessort a mezőinicializálók és a static elemek kiértékelése előtt definiál. A definíciók sorrendje csak az azonos kulcson számít (az utolsó nyer), illetve a kulcsok létrehozási sorrendjében, amit a kulcssorrend-lánc tart. Számított név nincs, tehát kódot sem futtat.
- **3. pont:**
  - **A laza mezők között** nem fut kód, így egyik sem figyelheti meg a másikat. Minden kódot futtató egység utánuk marad.
  - **A kulcsaik sorrendje** csak felsorolással látszik, ezt pedig a feltétel kizárja.
  - **A TypeScript emitje:** `useDefineForClassFields` mellett és nélküle is ugyanez igaz, mert a kezdőérték literál.
- **4. pont:** viselkedésváltozás nélkül csak az okkód lett pontosabb.

## Mérés

**Teljes kampány, 12 mag, 6 fajta, 2 nyelv** (351 664 sorrend, előtte és utána is 0 hibás elfogadás), v33 + ADR-067 → v34:

| Csoport | Rés | Elfogadott sorrend | Mi változott |
| --- | --- | --- | --- |
| `function` JS | 15 → **0** | 564 → 602 | kötési kontextus (1. pont) |
| `class` JS | 8 → 1 | 863 → 883 | duplikált definíciók (2. pont) |
| `class` TS | 26 → 21 | 926 → 931 | laza static/`accessor` mező (3. pont); a maradék 19 overload |
| `flow` JS/TS, nem dobó | 51 → 40 | változatlan | mérés: `policy` 6, blokkon belüli literálok |
| `flow` JS/TS, dobó | 65 → 0, 21 → 0 | változatlan | mérés (5. pont) |
| többi | változatlan | változatlan | |
| **Összesen** | **310 → 175** | **14 727 → 14 790** | |

- **Korpusz (109 fixture):**
  - rés 35 → 19, elfogadott sorrend 1 078 → 1 094;
  - a `refl-ts-accessor-fields` 16 rése szűnt meg;
  - 0 hibás elfogadás.
- **Gyors alapérték:** a `function javascript` rése 3 → 0, minden más csoport változatlan.
- **A példák szabályai** és a TypeScript-mintakatalógus szabályai nem változtak; csak a szabályverzió-címke és a szerzői megjegyzés szövege.
- **A `flow` maradéka:** 35 + 21 + 17 objektumütközés, a ciklus túlbecslése.

## Bizonyíték

[member-phases-and-early-exit.test.mjs](../../tests/member-phases-and-early-exit.test.mjs):
- **hoistolt függvény olvasása:** átlép egy barriert, de nem lép át, ha egy closure írja a kötést;
- **duplikált metódusok:** a mező átlép rajtuk, a két definíció cseréje elutasított (az orákulum szerint is más az eredmény);
- **static és `accessor` mezők:** szabadok, de `Object.keys(Local)` mellett kötöttek;
- **korai kilépés:** `early-exit-order` okot kap, és szándékként számít;
- mindegyiken 0 hibás elfogadás.

## Tervezési review (ADR-037)

- **Tulajdonosok:**
  - az utasításelemzés (`bindsIn` a `context` mellett, egy helyen);
  - a tagelemzés (`definitionOnly`, `sameKey`, fázisonkénti laza lista);
  - az osztályozó (`POLICY_INTENT`).

  Interfész nem változott, csak egy okkód és egy egységmező (`sameKey`) került be.
- **Design twice:**
  - *Az ADR-019 korai kilépési szabályának elhagyása:* elvetve. Pedagógiai döntés, a felhasználó politikája szerint (ADR-043) a halott kódot úgy ítéljük meg, mintha lefutna.
  - *Duplikált nevek a kulcssorrend-láncban külön kezelve:* nem kell, a lánc már tartalmazza őket.
- **Rögzített megállapítás:** a `POLICY_INTENT` egy kézi lista az osztályozóban. Ha több pedagógiai okkód lesz, a jegyzék (`reason-codes.ts`) kapjon egy „futással nem megfigyelhető” jelzést, és az osztályozó onnan olvassa. Ezt az [ADR-088](088-unobservable-reason-codes.md) megvalósította.

## Nyitott

- **A ciklus túlbecslése:** a `flow` fő maradéka. A `for … of` egy `break` után is minden elemre érvényes hatásnyomot kap. Ez a 4. fázis tétele.
- **Overload-csoport:** v3 egységmodell.
- **`f7 = this.f5`:** a mező kezdőértéke egy esetleges gettert olvas, ezért jogosan kötött.

## Utóirat (ADR-073, v39)

A static és accessor laza mezőkre is vonatkozik az ősláncfeltétel; a korábbi saját adatmezőt másoló mező (`f7 = this.f5`) laza, nem elfogadott korlát. Részletek: [ADR-073](073-base-chain-fields-and-defaults.md).
