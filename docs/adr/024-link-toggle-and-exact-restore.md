# ADR-024 – Kapcsolatkapcsoló a sorokon és a lazítás pontos visszaállítása

Állapot: implementálva. Az [ADR-022](022-stepwise-author-flow.md) összekötő körét váltja fel kapcsolóval, és az [ADR-018](018-typed-rule-editing.md) lazítását teszi visszafordíthatóvá. A validátor, a szerkeszthetőségi biztonság és a bizalmi határ változatlan.

## Kontextus

A felhasználó jelezte (2026-10-28), hogy a kör (összekötő pötty) működése nem érthető: csak új kapcsolatot tud létrehozni, nem mutatja a meglévőket, és megszüntetni nem lehet vele. A kérés lényege:

- **Kiinduló sor:** egy sor körére kattintva a vele kapcsolatban álló sorok kipipálódnak, a kapcsolat színével.
- **Megszüntetés:** egy pipára kattintva a kapcsolat megszűnik.
- **Visszaállítás:** ugyanazokat a kattintásokat megismételve a kapcsolat visszaáll.
- **Egységesség:** mindez ipari mintára, minden drag-and-drop felületen.

A core-ban egy generált szabály eltávolítása eddig csak egy lazítási bejegyzést hagyott (`relaxations`: pár és szerkeszthetőség). Ugyanannak a párnak az újbóli felvétele szerzői szabályt hozott létre, a lazítás megmaradt, és a minősítés „Nem igazolt” maradt. Ez nem visszaállítás volt.

## Döntés

### 1. A kör kapcsoló (WAI-ARIA toggle button)

- **Nincs kiinduló sor:** minden soron egyszerű kör van. Rákattintva a sor lesz a kiinduló sor (zöld, „kijelölt”), és megnyílik a panelje.
- **Van kiinduló sor:** minden más sor körét a kiinduló sorhoz fűződő közvetlen kapcsolata jelöli. Minden állapotnak saját akadálymentes neve van.

| Állapot | Jelölés | `aria-pressed` | Kattintás |
| --- | --- | --- | --- |
| a sornak a kiinduló előtt kell állnia | kék pipa | `true` | megszünteti |
| a sornak a kiinduló után kell állnia | borostyán pipa | `true` | megszünteti |
| szerkezeti (blokk, egység) | lakat, szaggatott keret | `true` | nem szüntethető meg; a panel megmondja, miért |
| nincs közvetlen kapcsolat | üres, szaggatott kör | `false` | létrehozza (a referencia sorrendjében) |

**Egy választás után** a pipák eltűnnek, és a panel a kiinduló soron marad, a hatásjelentéssel. A kiinduló kör újbóli megnyomása vagy az Escape befejezi a választást.

**Húzás:** egy körről egy másik sorra húzás ugyanez a kapcsoló: kapcsolat nélküli sorra húzva létrehoz, kapcsolódó sorra húzva megszüntet. Sort nem mozgat.

**Felületek:** mindez a Szabályok lépés tábláján és a Próba lépésben mindkét zónában (felhasználható sorok, megoldás) ugyanígy működik. A gyakorló mód és a tanulói nézet semmit nem kap belőle (`rulesAvailable`).

**Megerősítés:** a megszüntetés ugyanaz a típusos `remove-rule` szerkesztés, mint a panelen. Ha a core megerősítést kér (konzervatív vagy bizonyított szabály), a panel a kiinduló sornál ugyanazt a megerősítést kéri, indoklással. A szerzői szabály azonnal megszűnik. A szerkezeti szabályt a felület nem is küldi el.

### 2. A lazítás visszafordítható

A `RuleRelaxation` új, opcionális `removed` mezője rögzíti, mit vett ki az eltávolítás:

- `origins`: hol állt a szabály (`dependency` és/vagy `edge`);
- `reasons`: a tárolt, nem szerzői proveniencia (kategória és kód);
- `note`: a párhoz írt szabálymegjegyzés.

Egy lazított pár `add-rule` szerkesztése **visszaállítás**:

- a szabály az eredeti helyére kerül (függőségnél a sorrendben, proveniencia a sor szerinti helyére);
- visszakerülnek az okok és a megjegyzés;
- a lazítás törlődik.

Az oda-vissza út így pontos: a modell a revízión kívül azonos az eltávolítás előttivel, a minősítés is visszaáll.

- **Régi lazítás:** egy `removed` nélküli (ADR-024 előtti) lazításnál nincs mit visszaállítani. A pár szerzői szabály lesz, a lazítás törlődik, mert a pár ismét kötött.
- **Refresh:** a refresh újraalkalmazott lazításának `removed` mezője az újragenerált elemzés okait rögzíti.

A séma (`docs/schema.json`) és a generált ellenőrző ezt a mezőt kifejezetten leírja. Az ismeretlen mező továbbra is tilos.

## Következmények

- **Tesztek:**
  - [rule-editing.test.mjs](../../tests/rule-editing.test.mjs): pontos oda-vissza út (modell és minősítés), régi lazítás; a régi pontos alak-ellenőrzések az új mezővel bővültek;
  - [workbench-flow.test.mjs](../../tests/workbench-flow.test.mjs): a kapcsoló minden állapota és a kapcsolat keresése mindkét irányból;
  - workbench-böngészőcsomag, új eset Node és Pages módban: pipák és színek, szerkezeti lakat, létrehozás → megszüntetés → visszaállítás, bizonyított szabály megerősítéssel és pontos visszaállítással, billentyűzet, húzás a próbarendezőn (sor nem mozdul), Escape.
- **Korlát:** a pipák csak a közvetlen kapcsolatokat mutatják. Egy csak tranzitívan kötött pár üres kör; rákattintva közvetlen szerzői szabály lesz belőle, ami a sorrendet nem szigorítja.
