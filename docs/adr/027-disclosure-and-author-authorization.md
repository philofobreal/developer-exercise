# ADR-027 – Felfedési politika, szerveroldali szerzői jogosultság és publikálási szabály (F2)

Állapot: implementálva (F2.1–F2.3). Az [ADR-026](026-learner-feedback-and-row-marks.md) mechanizmusára épül. A validátor döntése nem változik.

## Kontextus

Az F1 után három kérdés maradt nyitva:

- **Szerzői API:** a szerver szerzői végpontjai hitelesítés nélkül futottak, a jogosultság csak abból következett, hogy a szerver alapból a 127.0.0.1 címen figyel.
- **Felfedés:** a felfedési szint két helyen, beégetve szerepelt (szerver és Pages).
- **Publikálás:** a katalógus minden modellt kiszolgált, a minősítés csak tájékoztató volt.

## Döntés

### 1. Szerzői jogosultság a szerveren (F2.1)

A döntést a `src/server/author-gate.ts` hozza, kizárólag a kérésből. UI-jelző, lekérdezési paraméter, süti vagy tanulói import nem ad jogot.

| Mód | Feltétel |
| --- | --- |
| mindig | a cross-site kérés (`Sec-Fetch-Site`) és az idegen `Origin` tiltott (CSRF), tokennel is |
| `CODELINE_AUTHOR_TOKEN` nélkül | csak loopback kliens, loopback hosztnévvel (`localhost`, `127.0.0.1`, `[::1]`); ez a DNS-rebinding ellen is véd |
| `CODELINE_AUTHOR_TOKEN`-nel | kötelező az `Authorization: Bearer <token>`, időben állandó összehasonlítással, a helyi gépen is |

- **Válaszok:** hiányzó vagy hibás token esetén 401, egyéb elutasításnál 403. A tanulói végpontok (`/api/exercises`, `/api/evaluate`) nyitottak maradnak.
- **Figyelmeztetés:** ha a szerver nem loopback címen figyel és nincs token, indításkor figyelmeztetést ír ki.

### 2. Egyetlen felfedési politika (F2.2)

A `channelFeedback(report, channel, learnerFeedback)` a core-ban van, és a szerver és a Pages ugyanígy hívja.

| Csatorna | Szerző | Tanuló |
| --- | --- | --- |
| szerzői előnézet | `provenance` | a feladat tanulói szintje |
| tanulói értékelés | nincs | a feladat tanulói szintje |

- **A tanulói szint:** a szerző kifejezett, feladatonkénti döntése (`learnerFeedback`). Az alapértelmezés `positions`, ez emelhető `rules`-ra. Ismeretlen vagy magasabb tárolt értéknél `positions` érvényes. A tanuló soha nem kap `provenance` szintet.
- **Az indoklás külön rész:** a diagnosztika indoklása (`reasons`) külön mező. A `provenance` szint alatt törlődik vele együtt a `rule.categories` is. Az indoklásból képzett kód (`pedagogical-rule`, `structural-placement`) ott `order-direct` lesz. Így a `rules` szint a megsértett sorpárt nevezi meg, de azt nem, hogy miért áll.
- **Csak a megsértett párok:** a tanuló a gráfból csak a ténylegesen megsértett párokat kapja meg, a teljes gráfot nem.

### 3. Publikálási szabály (F2.3)

A `publicationRefusal(verification, policy)` dönti el, mit szolgál ki a megbízható katalógus.

- **`publishable` (alapértelmezés):** a modellt csak akkor szolgálja ki, ha a referencia és a szomszédos cserék a produkciós keretben eldönthetők.
- **`verified-only` (`CODELINE_PUBLICATION`):** ezen felül az `unverified` modellt sem. Az `analysis-verified`, a `conservative` és az `author-modified` publikálható.
- **Kihagyás:** a kihagyott modell a `catalog.skipped` listába kerül, és a szerver indításkor kiírja. A fájlhoz semmi nem nyúl: a régi modellek függőségeit csak explicit refresh kötheti újra.
- **Ha semmi nem marad:** a szerver nem indul el.
- **Minősítés a listában:** a feladatlista minden feladatnál megadja a minősítést (`verification`).

## Következmények

- **Tesztek:**
  - [author-gate.test.mjs](../../tests/author-gate.test.mjs): loopback, DNS-rebinding, cross-site, idegen origin, UI-jelző, token, IPv6;
  - [diagnostics.test.mjs](../../tests/diagnostics.test.mjs): az indoklás leválasztása és a csatornapolitika;
  - [trust-boundary.test.mjs](../../tests/trust-boundary.test.mjs): az emelt tanulói szint negatív szivárgási tesztje;
  - [catalog-publication.test.mjs](../../tests/catalog-publication.test.mjs): a szabály minden ága, valamint az, hogy egy fájl sem íródik át.
- **Pages:** helyi demó marad. A teljes modell a böngészőben van, ezért a felfedési politika ott csak a tanulói élményt adja vissza, biztonsági határt nem. A publikálási szabály és a szerzői kapu a szerverre vonatkozik.
- **Korlátok:**
  - a beépített felület tokent nem küld, ezért token módban a szerzői API csak API-kliensből érhető el, a felület szerzői része a helyi gépen működik;
  - a `learnerFeedback` csak a JSON-ban állítható, a felületen nincs kapcsolója;
  - a feladatlista minősítéséhez a felületen nincs jelvény;
  - a token egyetlen közös titok, felhasználónkénti jogosultság nincs.
