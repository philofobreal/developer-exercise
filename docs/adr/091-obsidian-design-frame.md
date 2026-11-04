# ADR-091 – Obsidian dizájn: paletta, tipográfia, halvány sorvezérlők és keret (1–2. szakasz)

Állapot: **elfogadva** (2026-11-04). Megjelenítési változás a felhasználó dizájnterve („CodeLine / Obsidian – UI concept”) és kérése alapján. Ez az 5 szakaszos ütemterv 1. és 2. szakasza; a 3–5. szakasz (szerzői fejléc, rendezőpanelek, mobil) külön lépés. Validátor, generátor, modell és API nem változik.

## Kontextus

- **A színek:** a stíluslap 228 különböző színkódot tartalmazott 333 helyen, és csak 31 helyen használt közös változót. Egy palettaváltáshoz minden árnyalatot külön kellett volna átírni.
- **A sorvégi vezérlők:** az [ADR-090](090-single-horizontal-scroll-per-code-list.md) jobbra rögzítette őket, de így eltakarták a hosszú sorok kódját. A felhasználó kérése: legyenek halványak, hogy a kód átlátsszon mögülük, és egérrel a soron jelenjenek meg teljesen.

## Döntés

1. **Paletta ([style.css](../../public/style.css)).** Minden színkód változó lett, egyetlen árnyékszín kivételével. A változók hat szerepsávba tartoznak (`navy`, `cyan`, `blue`, `amber`, `red`, `violet`), és a nevük a világosságukat adja százalékban, például `--navy-12` vagy `--cyan-60`.
   - Minden régi szín megtartotta a világosságát (2%-os lépésben), ezért a kontrasztviszonyok megmaradtak.
   - A zöld kiemelés ciánkék lett, a semleges árnyalatok mélyebb navy tónusúak.
   - Új színt csak a palettában érdemes felvenni; a komponensek a változókat használják.
2. **Tipográfia és fény.**
   - A címkék (`.eyebrow`, állapotsor, állapotjelvény) monospace nagybetűsek, ritkított betűközzel.
   - Az aktív lépés és az aktív módfül fénylő aláhúzást kap, az elsődleges gomb enyhe fényt.
3. **Halvány sorvégi vezérlők.**
   - **Nyugalmi állapot:** a gombsáv háttere átlátszó, a gombok félig átlátszók, a csoport átlátszatlansága 0,55. A hosszú sor kódja átlátszik mögülük.
   - **Teljesen látható:** egérrel a soron, billentyűzetfókusznál, kiemelt sornál (szabály, kapcsolás, hibajelzés), valamint mindig ott, ahol nincs hover (érintőképernyő, durva mutató).
   - A csupán hoverre épülő változatot elvetettük: érintőképernyőn és billentyűzettel a gomb sosem lenne teljesen látható.
   - Csökkentett mozgás beállításnál nincs áttűnés.
4. **Keret ([view.ts](../../src/workbench/view.ts)).**
   - **Fejléc:** „CodeLine.” márka („ngDynamic · Studio”) és aláhúzott módfülek. Az ellenőrzési mód jelvénye változatlan szöveggel marad (Local Demo / Preview Validation, Preview Validation, Trusted Server Validation, AGENTS.md).
   - **Szerzői oldalpanel** (`.workspace-side`): az aktuális projekt valós adatai (cím, nyelv, kódsorok, rögzített sorok, ellenőrzési mód) és egy lépésenkénti tipp. A panel és a gyakorló feladatlista a képernyővel együtt marad (`position: sticky`); 850 képpont alatt a szerzői panel elrejtve.
   - **Alsó állapotsor** (`<footer class="status-bar">`): az ellenőrzési mód, a nézet (a szerzői lépéssel), a nyelv és az elhelyezett sorok száma. Csak olyan adat, amelyet a nézet ismer.

**Ahol eltértünk a tervtől:**
- **A terv „main* · 0 errors · Ln 3, Col 12” állapotsora** itt nem valós adat lenne; egy hamis „0 errors” azt sugallná, hogy a megoldás jó.
- **A bal oldali ikonsáv:** a terv ikonjai (dokumentum, parancs, ág) a termékben nem létező nézetekre mutatnának, a módváltás pedig már a fejléc füleiben van. Kettős navigációt nem vezettünk be.
- **A „Munkaterület” menü** (Aktuális feladat, Mintakód, Kapcsolatok) ugyanezért kimaradt; a lépéssor ugyanezt a szerepet tölti be.

## Mérés

- **Kontraszt (WCAG 1.4.11, nem szöveges elemek):** a nyugalmi sorvégi ikonok 3,8:1 és 4,3:1 között, teljesen láthatóan 8,9:1 és 10,2:1 között a sorháttereken.
- **A böngészőkészlet** (húzás, érintés, billentyűzet, mobilszélesség 320/390/768 képpont, Pages) változatlan elvárásokkal fut.

## Tervezési review (ADR-037)

- **Tulajdonos:**
  - a színek tudása a palettáé, a stíluslap tetején;
  - az ellenőrzési mód felirata egy helyen (`validationLabel`), a fejléc, az oldalpanel és az állapotsor onnan olvassa.
- **Interfész:** a nézet két új renderelője (`authorSide`, `statusBar`) a meglévő állapotból olvas, és nem tart saját állapotot. Új adatattribútum vagy esemény nincs, ezért a vezérlők és a tesztek kapcsolódási pontjai változatlanok.
- **Design twice:**
  - *Kézzel válogatott, kevés lépéses paletta:* elvetve, mert a szomszédos árnyalatok (például a páros és páratlan sorok) összeolvadtak volna;
  - *A régi színek változó nélküli átszínezése:* elvetve, mert nem tartható karban.
