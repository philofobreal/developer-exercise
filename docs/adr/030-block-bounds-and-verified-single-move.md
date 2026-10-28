# ADR-030 – Blokkhatár-becslés azonos tartalmú határsorokkal és ellenőrzött egylépéses javítás

Állapot: implementálva (2026-10-28). Az [ADR-023](023-explainable-validation-diagnostics.md) diagnosztikáját bővíti. A validátor, a verdikt, a CodeLine-séma és a tanulói parsermentes értékelés változatlan. A diagnosztika továbbra is csak magyaráz, nem dönt. A kétlépéses keresést az [ADR-033](033-two-move-repair.md) adja hozzá.

## Kontextus

A felhasználó (2026-10-28) a `runMiniFixture` feladatban a `score = 0;` mezőt a `set alias(value: string) {` sor alá, a setter törzsébe tette. A kiértékelő csak ennyit mondott: „A pontos ok nem nevezhető meg biztosan, mert az azonos tartalmú sorok többféleképpen párosíthatók”. A kérdései:

- miért nem azonosítható a hiba;
- van-e rá tervezett task;
- megvalósítható-e, hogy a kiértékelő minden esetben jól azonosítson;
- mekkora ennek a költsége a szerveren és a böngészőben.

**Ok.** Az ADR-023 csak akkor bizonyított blokkhibát, ha a blokk nyitó **és** záró sora is egyértelmű helyű. A setter záró sora egy `}`, amelyből a programban sok van, ezért a blokkot a diagnosztika kihagyta. Tervezett task erre nem volt; az ADR-023 a korlátot leírta.

**Mérés a javítás előtt** a 46 soros modell összes egysoros áthelyezésén: 1995 elutasított elrendezésből 1013 (51%) kapott bizonyított okot.

## Döntés

### 1. Blokkhatár-becslés

Egy határsor, amelynek tartalma másokkal azonos, bármelyik jelölt helyén állhat. Ezért nem egy pontot, hanem egy tartományt használunk.

**Biztosan bent:** a sor a nyitó legkésőbbi lehetséges helye után és a záró legkorábbi lehetséges helye előtt áll.
**Biztosan kint:** a sor minden lehetséges nyitó előtt vagy minden lehetséges záró után áll.

**Jól formáltság:** egy blokk a nyitó sora után zárul. Ezért:

- egyértelmű nyitónál a záró alsó korlátja az első jelölt a nyitó **után**;
- egyértelmű zárónál a nyitó felső korlátja az utolsó jelölt a záró **előtt**.

Ahol a határok fordítva állnak, ott a nyitó → záró szabály sérül, és azt a meglévő szabály-diagnózis bizonyítja. Ha a blokknak nincs jól formált olvasata, a becslés semmit sem állít róla.

**A szerződés pontosan:** az új, egysoros blokkállítás minden olyan tartalomkonzisztens hozzárendelésben igaz, ahol a blokkok a nyitó soruk után zárulnak. A többiben egy másik bizonyított szabály sérül. A bizonyíték szövege ezt meg is nevezi.

### 2. Ellenőrzött egylépéses javítás

Ha bizonyított ok nincs, a diagnosztika egy olyan egysoros áthelyezést keres, amelyet a validátor elfogad. Ha talál, `single-move-repair` diagnózist ad:

- `notice`, `general` bizonyosság, `positionScope: 'some'`, `references: []`;
- ellenőrzött kiút, nem bizonyított bűnös, és ezt a szöveg is kimondja;
- a jelentés `explained` értéke `false` marad.

**Keresés:**

1. **Igazítás:** minden beküldött sor a saját tartalmának első szabad referenciasorát kapja, beküldési sorrendben.
2. **Leghosszabb növekvő futam:** a referencia-sorrendben álló sorok leghosszabb futama (patience sorting) marad a helyén.
3. **Jelöltek:** minden futamon kívüli sort csak a futam szomszédai közötti sávba próbálunk áthelyezni. Az azonos tartalmú sorok felcserélhetők, ezért a sávba bármelyik azonos tartalmú sort kipróbáljuk. Egy elcsúszott `}` ugyanis az összes későbbi `}` igazítását eltolja.
4. **Tartalék:** a többi áthelyezés, növekvő távolság szerint.

**Előszűrő:** egy áthelyezés teljes validálása előtt a sorok jelöltlistáját ugyanúgy átrendezzük. Ha egy közös szabály minden hozzárendelésben sérül (`min P(a) > max P(b)`), a validálás elmarad. A rögzített sor máshová vitt jelöltje csak tágítja a tartományt, így a szűrő elfogadható áthelyezést sosem dob el.

**Keret:** saját keret (`moveSearchStates`, alapérték 400 000 egység, a validálás állapotai és a sorszámmal arányos munka). Ez független a diagnosztika keretétől. Kimerülése csak a javaslatot hagyja el, `diagnostic-budget` értesítést nem ad.

### 3. Felfedés

A javaslat sorát a tanuló `positions` szinten is látja („ez a sor máshová kerülve elfogadható megoldást ad”). A célhelyet viszont csak `rules` szinttől kapja meg, mert hogy hová tartozik egy sor, az szabályszintű tudás. A `discloseReport` a `move`-ot tartalmazó javítást `rules` alatt elhagyja.

## Eredmény

**A 46 soros modell összes egysoros áthelyezésén:**

| | Előtte | Utána |
| --- | ---: | ---: |
| bizonyított ok | 1013 / 1995 (51%) | **1730 / 1995 (87%)** |
| megmagyarázatlan, ellenőrzött javaslattal | – | 265 (mind) |
| diagnózis átlag / maximum | – | 0,6 ms / 7 ms |

**Költség méret szerint** (helyi Windows, Node 25 és Chrome, ms):

| Sor | Tipikus hiba (60 véletlen), átlag / p95 | Javaslattal | Nincs egylépéses javítás (keret kimerül), Node | Ugyanez, Chrome |
| ---: | ---: | ---: | ---: | ---: |
| 47–59 | 1 / 1 | 1–11 | 49–63 | 38–45 |
| 131 | 3 / 3 | 1–2 | 71–91 | 51–59 |
| 263 | 4 / 6 | 3–5 | 82–90 | 57–71 |
| 499 | 8 / 13 | 8–10 | 87–137 | 64–96 |

Az első, naiv változat (minden áthelyezés távolság szerint, előszűrő nélkül) 263 soron 2,6–2,9 s-os tüskéket adott. Ez a szerveren az eseménykört, a böngészőben a felületet blokkolta volna; ezért cseréltük le. A mostani legrosszabb eset 500 soron is 0,15 s alatt marad. Tesztkeret: 2 s, terhelt CI-re méretezve.

## Mit nem old meg

- **Nem mindig van egyetlen hibás sor.** Ha két egyforma sor közül bármelyik mozdítható, vagy az elrendezés többféleképpen javítható, nincs egyetlen bűnös. Ilyenkor a diagnosztika „ezek egyike” szinten marad.
- **Csak egylépéses javítás.** A két vagy több lépésben javítható elrendezés javaslat nélkül marad. A keret ezt a keresést szándékosan nem engedi.
- **Útvonalfüggetlen becslés.** A blokkbecslés csak a jól formált olvasatokra érvényes, ahogy fent leírtuk.

## Bizonyíték

- [diagnostics-localization.test.mjs](../../tests/diagnostics-localization.test.mjs):
  - a bejelentett eset;
  - másik metódusba tett törzssor;
  - nyitó elé tett tag;
  - fordított határok (nincs blokkállítás);
  - **nyers erős helyesség:** két blokkalakon minden egy- és kétlépéses áthelyezésre minden bizonyított blokkállítást minden jól formált hozzárendelésben, minden szabály-diagnózist minden hozzárendelésben, minden javaslatot a validátorral ellenőriz;
  - a mini modell minden elutasított áthelyezése magyarázott vagy javaslatot kap (több mint 80% bizonyított);
  - nincs egylépéses javítás, kimerült keret;
  - rögzített helyek;
  - felfedési szintek;
  - 500 soros időkeret.
- [diagnostics.test.mjs](../../tests/diagnostics.test.mjs): a két kétértelmű eset most javaslatot is kap, bűnös megnevezése nélkül.
- Kézi mérőeszköz: [move-search-scale.mjs](../../tests/support/move-search-scale.mjs).
