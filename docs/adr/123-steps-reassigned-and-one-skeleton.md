# ADR-123 – A lépések újraosztása és egy csontváz minden lépésnek

Állapot: **elfogadva** (2026-11-10). A lépések felosztását (Kód → Elemzés és szabályok → Próba és kiadás) és azt, hogy a nyelvi ellenőrzés a Kód lépésben marad, a felhasználó jóváhagyta (2026-11-09). Kockázati osztály: megjelenítés és interakció. A felületterv M5 és UI4 pontja, együtt, mert mindkettő ugyanazokat a nézeteket alakítja át.

## Kontextus

- **Minden beállítás a Forrás lépésben volt:** cím, leírás, szint, a forrás vizsgálata, az elemzési környezet és a profil. A környezet hatása (mely sorok cserélhetők) viszont csak a Szabályok lépésben látszott.
- **A cím és a leírás tanulói szöveg,** mégis a forrás-piszkozat része volt. Módosításuk elavulttá tette a modellt, és újraelemzést kért.
- **A lépések nem ugyanarra a csontvázra épültek** (felületaudit, 03. pont):
  - a Forrás fő művelete a szerkesztő alatt állt, a Szabályoké a tábla alatt, a Próbáé az oldal alján, az Ellenőrzés ragadós sávban;
  - a cím, a jelvény és a lépéssor három külön sávot foglalt;
  - álló telefonon a fejléc két sorba tört.
- **A címsorszintek keveredtek:** a Próba lépés paneljei h2-esek voltak a lépés h2-je alatt.

## Döntés

### Lépések (M5)

| Lépés | Egy feladata | Mi van benne | Fő művelet |
| --- | --- | --- | --- |
| **1 · Kód** | a referenciaforrás legyen helyes és olvasható | Megnyitás, nyelv, **vizsgálati beállítások** (TS-diagnosztika, checkJs, helyi objektumállapot, Nem eldönthető eredmények), szerkesztő, Formázás, Forrás vizsgálata, leletek | Modell készítése |
| **2 · Elemzés és szabályok** | a sorrendi szabályok legyenek helyesek és igazságosak | A feladat állapota (ADR-122), **elemzési beállítások** (Elemzési környezet, Haladó profil), szabálytábla, sor szabályai, JSON | Tovább a próbához |
| **3 · Próba és kiadás** | a feladat tanulóként működjön, és mehessen ki | rendező tanulói szemmel, **Tanulói adatok és kiadás** (cím, leírás, szint, JSON exportálása) | Ellenőrzés |

- **Minden beállítás ott van, ahol a hatása látszik** ([preflight-settings.ts](../../src/workbench/preflight-settings.ts), `SettingsScope`).
  - A „Nem eldönthető eredmények” (Figyelmeztet / Tilt) a Kód lépésben maradt, mert az első kapu is ezt használja: a Forrás vizsgálata ezzel dönt, és a Kód lépés leletlistája ettől függ.
  - Egy kérés, egy feloldás. A két lépés ugyanannak a szerzői kérésnek két nézete.
  - A kérés formája és a munkamenet v2 mezői nem változtak, ezért nincs migráció.
- **Az elemzési beállítás módosítása nem indít automatikus újraelemzést.**
  - A Szabályok lépés elavultsági sávja megmondja, hogy a beállítás változott, és felajánlja a „Modell újrakészítése” gombot. Ha a modellben kézi szabálydöntés van, előre jelzi: „A modell újrakészítése elveti a N kézi szabálydöntést.”
  - Az újrakészítés után a lépés kiírja, hány nem szerkezeti szabály volt és hány lett („Újraelemzés: 139 → 120”).
  - **Eltérés a tervtől.** A terv „módosításkor helyben újraelemez” mondata szó szerint azt jelentené, hogy egy legördülő lista átállítása csendben eldobja a kézi szabálymódosításokat. Ezt nem vállaltam.
- **Tanulói adatok újraelemzés nélkül** ([author-workspace.ts](../../src/workbench/author-workspace.ts) `setLearnerData`).
  - A cím, a leírás és a szint egyszerre íródik a piszkozatba, az alkalmazott alapvonalba, a modellbe, a listázott előnézetbe és az alkalmazott JSON-ba.
  - Nem bizonyíték: a második kapu modell-ujjlenyomata csak a sorokat, blokkokat, éleket és profilokat veszi figyelembe, az értékelés pedig nem olvassa. Ezért egyik lépés sem lesz elavult.
  - Az alkalmazatlan JSON-piszkozat a szerzőé, nem íródik felül.
  - A szerveroldali előnézeti piszkozat címe a régi marad. Ezt semmi nem olvassa; az exportálás és a munkamenet a helyi modellt viszi.
- **Lépésnevek:** a lépéssor, a h2 és az üzenetek az új neveket használják („Előbb készíts modellt a Kód lépésben.”). A szerzői kapu saját üzenetei („A Próba lépés nem nyitható meg…”) változatlanok; a „Próba” ott a lépés első szava.

### Csontváz (UI4)

- **Alkalmazássáv:**
  - logó, módváltó, munkamenet, téma, teljes képernyő;
  - **álló telefonon is egy sor:** a logó szöveg nélkül, a két mód ikongombként (a nevük akadálymentes névként és `title`-ként megmarad).
- **Kontextussáv:** a feladat címe, nyelve, a Local Demo jelvény és a lépéssor. Széles képernyőn egymás mellett, keskenyen egymás alatt.
- **Munkaterület:** a lépés panelei.
- **Műveletsáv lépésenként, ragadós az alján** (`actionBar`):
  - balra vissza, középen az állapot egy mondatban, jobbra a fő művelet;
  - Kód: a vizsgálat állapota, Forrás vizsgálata, Modell készítése;
  - Elemzés és szabályok: „Következő lépés: …” az állapotkártyából. Ha az állapotkártya a kódhoz küld vissza, a „Vissza a kódhoz” a fő gomb. Elutasított második kapunál a „Tovább a próbához” letiltott, és az ok rajta áll (ADR-120).
  - A Próba lépés Ellenőrzés sávja ugyanez a minta volt eddig is.
  - Az ADR-122 kártyájának „Következő lépés” sora ide költözött; a kártya a három választ és a leleteket tartja. Így egy nézetben egy fő gomb van.
- **Egy értesítés:** 4 px-es bal csík a jelentés színével: információ (kék), figyelem (sárga), hiba (piros), siker (zöld). Ide tartozik a Local Demo, a piszkozat, az elavultság, a szerkesztési szünet és az állapotkártya.
- **Címsorok:** h1 a feladat, h2 a lépés, h3 a panel. A szerzői Próba lépés paneljei (Felhasználható sorok, Megoldás, Megoldáskód, Sor szabályai) h3-asok lettek. Gyakorlásban és tanulói nézetben, ahol nincs lépéscím, h2-esek maradnak.

## Két terv („design it twice”)

1. **Hatókör szerint szétosztott egy beállításblokk, egy kéréssel (választott).**
   - A beállítások tudása (melyik csoport, melyik lépés, mi a kezdőérték, hogyan zárol) egy modulban marad.
   - A nézet csak megmondja, melyik hatókört kéri.
2. **Két külön beállításmodul, lépésenként (elvetve).**
   - A kezdőértékek, a zárolás magyarázata és a kérés összerakása kétszer szerepelne.
   - A konzervatív profil (2. lépés) a környezetet zárolja; a két modulnak ugyanazt a feloldást kellene értelmeznie.

## Tervezési review (docs/design-review.md)

- **preflight-settings.ts:**
  - *új tudás:* melyik csoport melyik lépésé;
  - *interfész:* egy paraméter (`scope`);
  - *hívó:* a nézet.
  - A soron kívüli (egy beállításhoz sem tartozó) konfliktus a Kód lépésben látszik, így nem veszhet el.
- **author-workspace.ts `setLearnerData`:**
  - *elrejti,* hogy a tanulói szöveg öt helyen él, és hogy az alkalmazatlan JSON a szerzőé;
  - *a hívónak* egy művelet jut, nem öt párhuzamosan frissítendő állapot.
- **rule-panel.ts:**
  - `ruleCount` és `authorDecisions` a szabálylap és a minősítés olvasója;
  - a nézet és az újraelemzés jelentése ugyanazt a számot használja.
- **view.ts `actionBar`:** egy szerkezet, három lépés.
- **Rögzített maradék:**
  - a lépéssor ma is a nézet része, a kontextussáv csak elrendezés;
  - a „16 féle doboz” teljes összevonása három felületre (panel, beágyazott, lebegő) a CSS-ben még nem történt meg: az értesítés egységes, a panelek nem. Ez hátralévő munka. Lezárta az [ADR-138](138-three-surfaces.md).

## Bizonyíték

- **Egységteszt:**
  - [preflight-settings.test.mjs](../../tests/preflight-settings.test.mjs): melyik beállítás melyik lépésben áll, a két összegző sor, a két emlékezet. A régi tesztek a két blokkon együtt futnak.
  - [task-status.test.mjs](../../tests/task-status.test.mjs): a tanulói adatok a modellt, a listát és az alkalmazott JSON-t írják. Elavultság, kapuváltozás és állapotváltozás nélkül; az alkalmazatlan JSON-hoz és az ismeretlen mezőhöz nem nyúlnak. Az elavultsági sáv megkülönbözteti a beállítás- és a forrásváltozást.
  - [workbench-flow.test.mjs](../../tests/workbench-flow.test.mjs): az új lépésnév az üzenetben.
- **Böngészős teszt:** [browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py).
  - Új segédfüggvények: `reanalyse` és `build_with` (környezet a kész modellen, újrakészítés a sávból).
  - `preflight_ui`: a Kód lépés csak a vizsgálati csoportot mutatja. A profil zárolása az Elemzés és szabályok lépésben történik, és elavultsági sávot ad, amely visszaállításkor eltűnik.
  - `input_contract`: a beállítás a Szabályok lépésben; a fókusz megmarad; a sáv megjelenik és eltűnik.
  - `author_level`: a cím és a szint a Próba és kiadás lépésben; a h1 követi; nincs elavultság; a JSON-ban benne van.
  - `rule_cause_lifts`, `key_order_and_rule_kinds`, `class_fields_setting`: a beállítás a kész modellen.
  - `task_status`: a következő lépés a műveletsávban.
- **Átírt TypeScript böngészős teszt:** [browser-typescript.playwright.py](../../tests/browser-typescript.playwright.py), a cím és a leírás a Próba és kiadás lépésben.
