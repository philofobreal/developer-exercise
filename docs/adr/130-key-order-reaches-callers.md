# ADR-130 – „Számít”: a hívó is felsorolhatja a kulcsokat (v56, NY-36)

Állapot: **elfogadva** (2026-11-10). A szemantikát a felhasználó választotta (A változat: „a »Számít« a hívó felsorolását is jelenti”). A szállított anyagról a mérés után a felhasználó döntött (a javaslat szerint): a `class-accounts-ts` (rev 4) kulcssorrend-beállítása „Nem számít” lett, mert a leírása szerint a két mező sorrendje a szerző szándéka szerint nem számít; a függőségei így nem változtak (27 elfogadott szomszéd marad). A három TS minta a forrásából újragenerálódik, az új, szigorúbb szabályokkal. Kockázati osztály: szerzői elemzés, valamint orákulum és mérés. Az [ADR-029](029-unobserved-instance-field-order.md) és az [ADR-128](128-object-literal-rows-and-runtime-hooks.md) kiterjesztése.

## Kontextus

- **ADR-029 óta** a kulcsok létrehozási sorrendje „Számít” mellett is csak akkor volt kötött, ha a program szövege felsorolja a kulcsokat (`Object.keys`, `JSON.stringify`, `for…in`, spread, `console`).
- **Egy hívó azonban felsorolhatja őket** a kapott objektumon: tesztkód, egy másik szkript, a konzol.
- **Orákulumtanúk** (a próbahívás `JSON.stringify`-ja), v55-ös szabályokkal:

  | Tanú | Hibásan elfogadott sorrend |
  | --- | --- |
  | visszaadott osztálypéldány mezői, JS és TS | 3 + 3 |
  | konstruktorbeli `this.x = …` írások | 3 |
  | visszaadott objektumba írt kulcsok | 2 |

- **A szállított `class-accounts-ts`** v55-ös modellje egy példányt kiíró hívó mellett **51 hibás sorrendet** fogadott el. A leírása ígérte is, hogy „a két mezővel együtt bármilyen sorrendben állhatnak”.
- **Az orákulum** ugyanezt a szűk értelmezést mérte: a próbahívás eredményét kulcsrendezetten hasonlította, ha a program maga nem sorolt fel.

## Döntés

- **„Számít” mellett** egy kulcs létrehozási sorrendje kötött, ha a program vagy a hívó felsorolhatja.
  - **Szabad marad, ami bizonyítottan bent marad** ([object-reach.ts](../../src/author/object-reach.ts)):
    - **objektumliterál:** függvényen vagy blokkon belüli változóban áll, és csak nem hívott tagelérés éri el (ADR-128, ide költözött);
    - **osztálypéldány:**
      - az osztályt kívülről nem érik el: nem exportált, és szkriptben nem felső szintű, ahol globális kötés, amelyet a hívó maga is példányosíthat;
      - csak `new C()` egy ilyen változóba, statikus tagelérés vagy egy szintén bent maradó alosztály `extends`-e hivatkozik rá;
      - a lánc minden osztályában a `this` csak tagelérés tárgya, és hívásban csak a lánc saját metódusai szerepelnek;
    - **osztályérték (statikus kulcsok):** ugyanígy, `extends` nélkül.
    - Típuspozíció (`p: Point`) nem hivatkozás. `eval` vagy `with` mellett semmi nem marad bent.
  - **Osztálymezők** (`type-member-ordering`): a mező „laza” (sorrendje szabad), ha a kulcsát senki nem sorolhatja fel: a példány-, illetve az osztályszintű döntés szerint.
    - Új kivétel: az `accessor` mező. A tárolója privát, a getter/setter párja a prototípuson van, így a példány kulcsfelsorolásában nem látszik.
    - A prototípus-kulcsok sorrendje (`reflected-key-order`) változatlanul csak akkor kötött, ha a program felsorolja őket.
  - **Saját objektumba írás** (`object-footprints`): egy új kulcs írása az egész objektum írásának számít, ha az objektum kifelé látható:
    - a lista `return`-je magát az objektumot adja tovább (nem csak egy tagját olvassa);
    - vagy az építés alatti példányról van szó, amelynek osztálya nem marad bent;
    - vagy egy ilyen objektum tárolja.
- **Orákulum:** „Számít” mellett a próbahívás eredményének (és a `record()` argumentumainak) kulcssorrendje része az eredménynek. Csak „Nem számít” mellett hasonlít kulcshalmazt.
- **Korpusz:** két fixtúra kapott hívói próbát, mert a meglévő próbájuk szándékosan sorrendfüggetlen volt (`Object.keys(account).sort()`):
  - `class-accounts-ts`: `JSON.stringify(new CreditAccount('Ana', 50))`;
  - `contract-ts-this-reads`: `JSON.stringify(new Basket())`.

## Finomítások a teljességért (mért rések alapján)

- **Ősmező:** egy mező, amelynek nevét az ősláncban egy mező már létrehozta, nem hoz létre új kulcsot, ezért a sorrendje egy felsoroló hívó számára sem látszik (az orákulum rést jelzett rá a `class-field-chain` tesztben).
- **`abstract` és `declare` mező:** futásidőben semmit nem hoz létre, ezért kivétel.
- **`accessor` mező:** a tárolója privát, a getter/setter a prototípuson van, ezért szintén kivétel.
- **A `return` értékfolyama:** az objektum csak akkor jut ki, ha a visszaadott érték maga lehet vagy tartalmazhatja.
  - Továbbadja: csoportosítás, `||`/`&&`/`??`, vessző, feltételes ág, tömb- és objektumliterál, tagelérés, hívás.
  - Nem adja tovább: aritmetika, összehasonlítás, `typeof`, sablon, és az ADR-109 szerinti `Object.keys(o).length`.

## A tesztek átállítása

- **A kommutálási mechanizmust vizsgáló tesztek** (ADR-029, 031, 060, 073–078; konstruktor-, setter-, tag- és mezőmód-lábnyom) szkriptszintű osztályokon futnak, amelyeket „Számít” mellett a hívó példányosíthat. Ezek „Nem számít” beállítással futnak tovább, az orákulummal együtt, mert azt vizsgálják, milyen kód fut. Ahol egy teszt a felsorolás hatását vizsgálja, ott „Számít” maradt.
- **Új állítások** rögzítik a „Számít” melletti viselkedést:
  - a szkriptszintű osztály független konstruktorírásai kötöttek;
  - a függvényen belüli osztály mezői szabadok;
  - az `abstract` mező mindkét beállításnál szabad.
- **A „nyolc kombináció” teszt:** „Számít” mellett a hívó által látott kulcssorrenddel mér (2 elfogadott), „Nem számít” mellett a kulcshalmazzal (8).
- **A `values-only` TS minta** a saját leírása szerint („a kulcssorrend nem része ennek a feladatnak”) mostantól `keyOrder: 'ignored'`-ként rögzül, és így bizonyított szűkítés.
- **A `01-user-account` és `04-declare-fields` minta** elvárásai és leírásai az új szabályt követik.
- **A kézi futásidejű mesterpélda** a „Nem számít” generálással pontosan egyezik.
- **A súgó `Osztálymezők létrehozása` példája** „Nem számít” kulcssorrenddel mutatja be a mezőmódot.

## Két terv („design it twice”)

1. **„Számít” mellett minden kulcssorrend kötött (elvetve).** Egyszerű, de a bent maradó objektumok (helyi számítás, csak tagolvasás) szabadságát is elvenné: a teljesség sérülne.
2. **Kijutáselemzés (választott).** Ami bizonyítottan bent marad, szabad; minden más kötött. Az elemzés szándékosan szűk, a tévedés iránya a szigorúság.

## Mérés

- **Tanúk:** 8 orákulumprogram ([key-order-reach.test.mjs](../../tests/key-order-reach.test.mjs)): 0 hibás elfogadás, 0 rés. A bent maradó változatok (helyi objektum, függvényen belüli osztály, `accessor` mező) szabadok.
- **Korpusz** (szomszédos sorrendek):
  - elfogadott: 1190 → 1144;
  - rés: 20 → 19 (új nincs; a `ch-multiline-object` rése bezárult);
  - indokolt elutasítás: +19, hívói próbával;
  - szándékos: 2 → 30, mind `heap` okú: az orákulum objektumállapot-megfigyelése megkülönbözteti őket (pl. `this.balance` és `this.owner` írásának sorrendje, a TS `private` mezők, amelyek valódi kulcsok).
- **Generatív kampány:** rés 4 → 2, szándékos elutasítás 14 → 55 (az `inherit` csoportokban: szkriptszintű osztályok, amelyeket a hívó példányosíthat).
- **Szállított anyag:**

  | Anyag | Változó sorok | Elfogadott szomszédos sorrend |
  | --- | --- | --- |
  | `class-accounts-ts`, ha „Számít” maradt volna (`history` mező) | 1 | 27 → 19 (1059-ből); döntés: „Nem számít” (rev 4), 27 marad |
  | TS minta `01-user-account` | 2 | 8 → 5 |
  | TS minta `01-user-account.values-only` | 5 | 6 → 4 |
  | TS minta `04-declare-fields` | 1 | 5 → 4 |
  | a többi 15 példa és 21 minta | 0 | – |

## Tervezési review (docs/design-review.md)

- **object-reach.ts:**
  - *elrejti*, mikor marad bent egy objektum, egy osztály példányai és az osztályérték;
  - *interfésze:* három kérdés;
  - fájlonként gyorsítótárazva, három hívó használja (literál, tag, lábnyom).
- **type-member-ordering.ts, object-footprints.ts:** a „felsorolható-e” döntés osztályonként, illetve objektumonként jön. Az ADR-029 szövegalapú feltétele (`enumeratedKeys`) beleolvad, nem párhuzamos.
- **Rögzített maradék:**
  - a prototípus-kulcsok (metódusok) sorrendjét a hívó `getOwnPropertyNames(C.prototype)` hívással is láthatná. Ez változatlanul csak akkor kötött, ha a program maga reflektál; a „Számít” súgószövege a felsorolható kulcsokról szól.
  - modulban a nem exportált felső szintű literál konzervatívan kötött marad.
