# ADR-022 – Léptetéses szerzői folyamat, külön gyakorló mód és vizuális szabálytábla

Állapot: implementálva (U1). A kör összekötőből kapcsolatkapcsoló lett: [ADR-024](024-link-toggle-and-exact-restore.md). A validátor, a CodeLine-séma, a szerzői API, a tanulói parsermentes értékelés és a bizalmi határ változatlan. Az [ADR-004](004-reference-and-attempt-workspaces.md) feladatonkénti szerzői munkaterületét felváltja; a próbálkozás és a referencia szétválasztása megmarad.

## Kontextus

A felhasználó jelezte (2026-10-27), hogy a négy egyenrangú tab („01 · Referencia és szabályok”: Referenciaforrás, Adatmodell; „02 · Megoldás és próba”: Rendező, Megoldáskód) és az oldalsó példalista POC/MVP szempontból érthetetlen. A nézetek között nincs valódi, stabil állapotkapcsolat, és frissítés vagy újragenerálás után a kapcsolódó állapotok nem frissülnek.

A kódban ennek okai:

- **Nincs állapotgép:** az, hogy egy nézet melyik modellből indul, elszórt feltételeken múlt (`previews.has(active)`, piszkos jelzők, `state.view`). A Rendező és az Adatmodell bármikor elérhető volt, modell nélkül is.
- **Egyetlen lista két szerepre:** a feladatkönyvtár egyszerre volt gyakorlólista és a szerzői munkaterület választója (feladatonkénti forrás- és JSON-piszkozat, ADR-004). Egy kattintás referenciát, munkaterületet és próbát is váltott.
- **Nincs elavulásjelzés:** egy forrás- vagy JSON-módosítás után a többi nézet szó nélkül a régi modellt mutatta.

## Döntés

### 1. Két mód

- **Feladat készítése** (kezdőoldal): egyetlen szerzői projekt (`author-workspace.ts`).
- **Gyakorlás:** a trusted feladatok listája tanulói nézettel.

A módváltás megőrzi mindkét mód saját nézetét és aktív feladatát. A gyakorlás nem ír a szerzői projektbe. Egy példa csak kezdőpont: a betöltése (`startFromExample`) nem alkalmazott forráspiszkozatot ad.

### 2. Három lépés, egy aktív

A lépések: Forrás (`author`) → Szabályok (`model`) → Próba (`sort` | `edit`). A [flow.ts](../../src/workbench/flow.ts) az egyetlen hely, amely tudja:

- **zárolás:** a Szabályok és a Próba lépéshez alkalmazott modell kell;
- **elavulás:** egy nem alkalmazott forrás- vagy JSON-változás mellett a későbbi lépések elavultak;
- **landolás:** hová lép egy sikeres alkalmazás (forrásból → Szabályok, JSON, szabály vagy refresh → marad, munkamenet → Próba);
- **mely nézet érhető el** gyakorló vagy tanulói módban.

A nézetek és a kezelők ezt kérdezik meg, nem vezetik le maguk.

**Egyetlen igazságforrás:** minden származtatott nézet (tábla, panel, JSON, minősítés, próba) az alkalmazott modellből és a vele kapott válaszból (`authorInsight`) épül. Egy sikeres alkalmazás ezért egyszerre frissíti őket. Az elavult állapot látható sávot kap, és a sáv a feloldást is felkínálja: újraépítés, elvetés vagy a JSON megnyitása.

### 3. Vizuális szabálytábla a Szabályok lépésben

A [rule-board.ts](../../src/workbench/rule-board.ts) a referencia sorait modellsorrendben, blokkmélység szerinti behúzással mutatja. Mellette a D2 szabálypanelje jelenik meg, amely így a próbarendezőből ide költözött.

- **Ívek:** a kijelölt sor közvetlen szabályai, kérésre az összes nem szerkezeti szabály, egy SVG-sávban rajzolva. A pozíciókat renderelés után mérjük, mert a CSP nem enged inline stílust.
- **Összekötés:** egy sor körgombját egy másikra húzva (Pointer Events: egér, toll, érintés), vagy két billentyűzetes aktiválással. A két sor közé `add-rule` szerkesztés kerül, a referencia sorrendje szerinti iránnyal; a döntés a core-é (ADR-018).
- **Kattintáselnyelés:** a húzás utáni kattintást csak mutatóeszközről (`detail > 0`) és csak rövid ideig nyeljük el. Így egy gyors újrarenderelés után sem nyelődik el egy későbbi billentyűzetes aktiválás.

### 4. Szabályok a próbarendezőn is (2026-10-27, felhasználói kérés)

A szerző a Próba lépésben, rendezés közben és után is látja és szerkeszti a szabályokat, ugyanazokkal az eszközökkel, mint a táblán.

- **Gombok minden soron:** a felhasználható és a megoldás sorain is van láncszem (kijelölés, panel) és kör (összekötés). A szerkesztett, referenciaazonosító nélküli tanulói sornak nincs ilyen gombja.
- **Ívek a rendezőben:** a sorok a szerző *aktuális* elrendezésében állnak. Az ívek a sorok vezérlőitől balra, a zónán belül, a jelenlegi pozíciók között rajzolódnak, és minden mozgatás után újra. Egy fordított irányú ív azt mutatja, hogy a jelenlegi azonosítók szerint a sorrend ellentétes a szabállyal; az ítélet továbbra is a validátoré (az azonos tartalmú sorok azonosítója cserélődhet). A két zóna közötti kapcsolatot a sorkiemelés jelzi.
- **Panel:** a D2-panel a rendező alatt jelenik meg.
- **Azonnali újraértékelés:** egy szabályszerkesztés megtartja a kitöltést (kompatibilis modell), és azonnal újraértékeli.
- **Görgetés és fókusz:** minden befogadás (szabályszerkesztés, refresh, újraépítés) új előnézet-azonosítót ad, de ugyanaz a szerzői projekt marad. A görgetés, a fókusz és a nyitott részletek memóriája ezért egy állandó kulcshoz kötött (`continuityKey` a `flow.ts`-ben), nem az előnézet azonosítójához. A rendező görgetése így egy szabályszerkesztés után is megmarad, mint egy húzás után; a szabálypanel saját görgetése is (`data-scroll-memory`). Javított hiba (2026-10-27, felhasználói jelzés): korábban minden szabályszerkesztés után a megoldás panel a tetejére ugrott.
- **Húzás:** a sorok natívan húzhatók, ezért a körgombról induló húzás elnyomja a natív sormozgatást (`dragstart` a capture fázisban). A fogantyúval történő rendezés változatlan.
- **Tanulói elkülönítés:** a gyakorló mód és a tanulói nézet nem kap gombot, ívet, panelt vagy sávot (`rulesAvailable`).

### 5. Megőrzött szerződések

- **Piszkozatok:** nem alkalmazott piszkozat nem vész el. A szabályszerkesztés megtartja a forráspiszkozatot, és nem indul el nem alkalmazott JSON mellett.
- **Késői válaszok:** a kérésgeneráció mostantól az alkalmazott előnézetet köti, nem az aktív feladatot, így a módváltás nem szakít meg szerzői kérést.
- **Egyéb:** a tanulói elkülönítés, a munkamenet-export, -import és helyi mentés (a Forrás lépésből is visszatölthető), a vágólap, valamint a natív, pointeres, érintéses és billentyűzetes egyenértékűség változatlan.

## Következmények

- **Új modulok:** `flow.ts`, `rule-board.ts`; az `author-workspace.ts` egyetlen projektet kezel. Mindhárom szerepel az architektúra-szabály generált listájában.
- **Új teszthorgok:** `data-mode`, `data-step`, `data-goto`, `data-rules-view`, `data-source-kind`, `data-rule-connect`, `data-board-line`. A böngészős tesztek ugyanazokat az utakat az új navigációval járják be.
- **Új tesztek:**
  - [workbench-flow.test.mjs](../../tests/workbench-flow.test.mjs) (8 eset, köztük a próbarendező vezérlőinek elszigetelése és az állandó folytonossági kulcs);
  - az átírt [author-workspace.test.mjs](../../tests/author-workspace.test.mjs);
  - a workbench-böngészőcsomag 43 esete, köztük: zárolás, újraépítés és JSON utáni frissülés minden lépésben, projekt a gyakorlás mellett, összekötés egérrel és billentyűzettel a táblán és a próbarendezőn, ívek újrarajzolása mozgatás után, azonnali újraértékelés, megmaradó görgetés szabályszerkesztés után.
- **Javított hibák:**
  - a nyitott „Minősítés” blokk bezárult, ha a Szabályok lépésben JSON-ról visszaváltottunk a vizuális nézetre (a folytonosság kulcsa alnézetenként külön);
  - a húzás utáni kattintáselnyelés bennragadhatott.
- **Korlátok:**
  - a táblán az ívek a teljes listamagasságra rajzolódnak; nagyon hosszú modellnél (CopyField, 436 sor) a „minden szabály” nézet sűrű;
  - a profilok (OR) továbbra is csak a JSON-ban szerkeszthetők;
  - a szerzői API jogosultsága az F2 feladata.
