# ADR-088 – A futással nem megfigyelhető okkódot a regiszter jelöli (NY-14)

Állapot: **elfogadva** (2026-11-04). A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-14 tétele, amelyet az [ADR-068](068-binding-context-member-phases-early-exit.md) tervezési review-ja rögzített. Mérési és regiszterváltozás: a generátor és a szabályverzió (`scoped-effect-analysis-v50`) nem változik.

## Kontextus

A mérés osztályozója ([order-classification.mjs](../../tests/support/order-classification.mjs)) egy egyenértékű, mégis elutasított sorrendet akkor sorol szándéknak, nem résnek, ha minden megsértett kényszere olyan okkódú, amelyet egyetlen futás sem különböztet meg. Ezeket két kézi lista sorolta fel:
- `POLICY_INTENT` (`early-exit-order`, ADR-068): pedagógiai döntés;
- `TYPE_INTENT` (`overload-group`, ADR-079): csak a TypeScript típusellenőrzője látja.

Az okkódok egyetlen regisztere a [reason-codes.ts](../../src/author/reason-codes.ts) (ADR-038). Az ADR-068 azt rögzítette: ha lesz egy második ilyen okkód, a regiszter kapjon jelzést, és az osztályozó onnan olvasson. Az ADR-079 óta két lista van, a feltétel teljesült.

**A kockázat:** egy új okkód a regiszterbe kerül, de a kézi listába nem. Ilyenkor a mérés a szándékos elutasításait csendben résnek számolja, vagy fordítva: egy listában felejtett, már megfigyelhető kód a valódi réseket takarja el.

## Döntés

1. **A regiszter bejegyzése** egy opcionális mezőt kap: `unobservable?: 'policy' | 'type'`.
   - `early-exit-order`: `policy`;
   - `overload-group`: `type`.
2. **Az osztályozó** a két listát elhagyja, és a `reasonCode(code).unobservable` mezőt olvassa. A döntési szabály változatlan: a sorrend akkor `policy` (vagy `type`) szándék, ha minden megsértett pár legalább egy ilyen jelölésű okkódot visel.
3. **A regiszter tesztje** ([reason-codes.test.mjs](../../tests/reason-codes.test.mjs)):
   - a mező értéke csak `policy`, `type` vagy hiányzó lehet;
   - a jelölt kódok halmaza rögzített. Egy új jelölés a mérésben elutasításokat szándékká tesz, ezért review-t kíván, és a teszt ezt kikényszeríti.

## Bizonyíték

- **Viselkedésmegőrzés:**
  - a korpusz 110 fixture-jének alapvonala (`ordering-baseline.json`) bájtra azonos, a szándék szerinti elutasításokkal együtt;
  - a szándéktesztek változatlanul átmennek: [member-phases-and-early-exit.test.mjs](../../tests/member-phases-and-early-exit.test.mjs), [overload-headers.test.mjs](../../tests/overload-headers.test.mjs), [value-intent.test.mjs](../../tests/value-intent.test.mjs), [heap-intent.test.mjs](../../tests/heap-intent.test.mjs);
  - a generált modellek (1 368) bájtra azonosak, mert a generátor a mezőt nem olvassa.
- **Regiszter:** a [reason-codes.test.mjs](../../tests/reason-codes.test.mjs) jólformáltsági tesztje.

## Tervezési review (ADR-037)

- **Tulajdonos:** az okkód tulajdonságait (kategória, jelentés, ADR, megfigyelhetőség) egy helyen a regiszter tudja. Az osztályozónak nincs párhuzamos állapota.
- **Interfész:** a `ReasonCodeEntry` egy opcionális mezővel bővült. Egyetlen hívó olvassa (az osztályozó). A szerzői felület és a projekció nem változik.
- **Design twice:**
  - *Új kategória (`unobservable`) a `ConstraintCategory`-ban:* elvetve. A kategória a mag nyilvános sémájának része, és a projekció, valamint a gátcsere-szabály ezt olvassa. Az `overload-group` szerkezeti kényszer marad, csak nem megfigyelhető.
  - *Logikai jelző (`unobservable: true`) és a szándék fajtája külön:* elvetve. A mérés a két fajtát külön számolja (`intentBy.policy`, `intentBy.type`), ezért a jelző maga a fajta.
- **Ami marad:** a halott kód, az érték- és a heap-szándék (ADR-043, -067, -080) nem okkódhoz kötött, hanem a sorrendből számolt. Ezek az osztályozó saját fogalmai maradnak.
