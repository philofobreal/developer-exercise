# ADR-142 – A Pages a buildből települ, a helyi kapu a változáshoz igazodik

Állapot: **elfogadva** (2026-11-13). A felhasználó kérése: „alakítsd át a pages github workflow-t. nagyban lassítja a deploy-t. ha lokálisan amúgy is letesztelünk mindent, teljesen felesleges, hogy lassítson a tesztekkel”, és „tárd fel, hogyan lehet felgyorsítani szakszerűen a lokális teszteket … valósítsd meg a gyorsabb változatukat”. Kockázati osztály: dokumentáció és eszközök. A motor, a szabályok, az értékelés és a felület nem változott; egy teszt sem gyengült vagy maradt ki a teljes körből.

## Kontextus (mérve, 4 magos gépen)

- **A telepítés a teljes tesztkörre várt.** A `ci.yml` `deploy` jobja `needs: verify` volt: a Pages 25–30 perccel a push után frissült. Egy piros futás után egyáltalán nem: 2026-11-12-én egy tesztkapu mérési hibája (nem termékhiba) két pushon át, kb. egy órán át tartotta vissza a kész javítást.
- **Minden push előtt ugyanaz a teljes kör futott helyben, sorban:**

  | Lépés | Idő |
  | --- | --- |
  | `check:all`: build | 11 mp |
  | `check:all`: 138 egységtesztfájl | 358–381 mp |
  | `build:pages` még egyszer (a `check:all` már megépítette) | 11 mp |
  | `test:browser:all`: 11 böngészős sor egymás után | kb. 1180 mp |
  | **Összesen** | **kb. 26 perc** |

- **Az egységtesztek ideje a motoré.** A 846 mp processzoridő 47%-a három fájl (`semantic-corpus` 168 mp, `while-termination` 128 mp, `ordering-properties` 104 mp), mind a sorrendelemzés helyességét méri az orákulummal. 63 fájl együtt 17 mp.
- **A munka nagy része nem érte el a motort.** 2026-11-11–12-én minden push a felületet vagy a dokumentumokat érintette; a motor tesztjei mégis mindegyik előtt lefutottak.

## Döntés

### 1. A Pages a buildből települ

- **`pages.yml` („Publish Pages”):** push a `main`/`master` ágra vagy kézi indítás → `npm ci`, `npm run build:pages`, a generált kimenetek egyezése a forrásukkal (`git diff --exit-code`), feltöltés, telepítés. Nincs Python, Chromium és teszt.
- **`ci.yml` („Verify”):** ugyanaz a teljes kör, mint eddig (`check:all`, a generált kimenetek egyezése, `test:browser:all`), minden pushra és pull requestre. **A telepítést nem kapuzza:** mellette fut, és később jelez.
- **Egy újabb push megszakítja az előző ellenőrzését** (`cancel-in-progress`), mert az újabb commit a régit is tartalmazza. Eddig sorba álltak.
- **Ami a hibát a webhelytől távol tartja, az a push előtti helyi kapu.** A CI jelzése utólagos: ha piros, javítani kell, de a webhely addigra frissült.

### 2. A helyi kapu: `npm run gate`

Egyszer épít, aztán azt futtatja, amit a változás igényel (`scripts/gate.ts`, a terv: `scripts/gate-plan.ts`):

| A változás | Egységtesztek | Böngészős sorok |
| --- | --- | --- |
| A mag, a szerzői elemzés, a szerver (`src/core`, `src/author`, `src/server`, `src/python`, `server.mjs`), a generált `dist`, az orákulum és a fixture-ök (`tests/support`, `tests/fixtures`), a példák (`examples`) | mind | mind |
| Az eszközlánc (`package.json`, `package-lock.json`, `tsconfig*.json`, `scripts/`), vagy bármely út, amelyet a kapu nem ismer | mind | mind |
| Megjelenítés (`src/workbench`, `public`) | amelyik egy változott fájlt betölt vagy megnevez | mind |
| Böngészős teszt (`tests/browser-*`) | amelyik megnevezi | mind |
| Dokumentum, egységteszt, workflow (`docs`, `*.md`, `tests/*.test.mjs`, `.github`) | amelyik megnevezi | egyik sem |

- **A négy ellenőrző mindig fut** (architektúra, modellek, dokumentumok és linkek, sorvégek): 3 mp.
- **A szűkítés a kockázati osztályt követi** ([ai-governance.md](../ai-governance.md)): a mag és a szerzői elemzés bizonyítéka a teljes kör, ott nincs szűkítés. A megjelenítésé a böngészős tesztek, azok mind futnak.
- **Egy egységteszt függőségei** a forrásából olvashatók:
  - a statikus importjai, tranzitívan;
  - minden létező fájl és mappa, amelyet egy szövege megnevez (egy teszt a fixture-jét, a példákat, a stíluslapot útvonallal olvassa); a sablonszöveg útja az első `${` előtti mappáig számít.

  Egy mappa megnevezése a mappa minden fájljára függőség. A gyökeret megnevező tesztek (`governance`, `glossary`, `server-start`) mindig futnak.
- **A változás** minden, ami a pusholt `main`-től (`origin/main`) eltér: commitolt, előkészített, szerkesztett és új fájl. A generált kimenetek követettek, ezért a build utáni eltérésük is változás. Ha a bázis nem ismert, semmi nem marad ki.
- **A böngészős sorok egyszerre futnak,** annyi, ahány mag van (legfeljebb 4), a leghosszabbak elöl (az előző futás idejei alapján). Mindegyik saját szabad porton indít szervert, ezért nem zavarják egymást.
- **`npm run gate -- --full`** a teljes kör, mint a CI-ban. A `check:all` és a `test:browser:all` változatlanul megvan.
- **A parancsok gazdája a `package.json` marad:** a kapu a `check` és a `test:browser:all` parancsait olvassa ki, sajátot nem ad hozzá.

### Mért eredmény

| Változás | Előtte | Utána |
| --- | --- | --- |
| Dokumentum (például jegyzék, CHANGELOG) | kb. 26 perc | kb. 20 mp (build, ellenőrzők, 4 tesztfájl) |
| Megjelenítés (például `public/style.css`) | kb. 26 perc | **6 perc 50 mp** (build 11 mp; 20 tesztfájl 7 mp; 11 böngészős sor párhuzamosan 399 mp) |
| Mag vagy szerzői elemzés (teljes kör) | kb. 26 perc | kb. 12 perc (egységtesztek 321 mp négy folyamattal; böngészős sorok kb. 400 mp) |

A párhuzamos böngészős futásban mind a 11 sor zöld volt (504 eset).

## Két terv („design it twice”)

**A telepítéshez:**
1. **A tesztek gyorsítása a CI-ban, a kapu megtartásával.** Elvetve: a teljes kör egy CI-gépen párhuzamosítva is 10 perc fölött marad, és egy ingadozó teszt továbbra is visszatartana egy kész javítást.
2. **Telepítés a buildből, az ellenőrzés mellette (választott).** A felhasználó döntése; a helyi kapu a feltétele.

**A helyi kapuhoz:**
1. **Kézzel írt lista, hogy melyik teszt melyik területhez tartozik.** Elvetve: minden új tesztnél karban kellene tartani, és egy kihagyott sor csendben kihagyna egy tesztet.
2. **A teszt függőségei a forrásából, a szűkítés csak a megjelenítésre és a dokumentumokra (választott).** Új teszt magától bekerül; ami a motorhoz ér, az mindig a teljes kört kapja.

## Tervezési review (docs/design-review.md)

- **gate-plan.ts:** *elrejti*, mely utak kérnek teljes kört, melyek érik el a böngészőt, és hogyan kötődik egy teszt a fájljaihoz. *Interfésze* egy tiszta függvény: `planGate(változott fájlok, tesztek függőségei, {full})` → terv az okával. Egységteszt fedi.
- **gate.ts:** *elrejti*, hogyan találja meg a változott fájlokat (git), hogyan olvassa ki egy teszt függőségeit, és hogyan futtat és jelent. A hívó egy parancsot ismer: `npm run gate`.
- **Nincs párhuzamos szabály:** a parancsok a `package.json`-ban, a kockázati osztályok az `ai-governance.md`-ben maradnak; a kapu ezekre hivatkozik.
- **Rögzített maradék:**
  - **A függőség-olvasás becslés.** Egy futás közben összerakott útvonalat nem lát (a sablonszöveg kezdő mappáját igen). Ezért szűkít csak ott, ahol a tévedés ára kicsi (megjelenítés, dokumentum), és ezért fut a teljes kör a CI-ban minden pushra.
  - **A webhely egy CI-ban később megbukó változással is frissülhet.** A helyi és a CI-beli Chromium verziója eltér (2026-11-12-én egy mérés emiatt különbözött). Ez tudatos csere a gyors telepítésért.
  - **A böngészős kör alsó határa a leghosszabb sor** (`browser-workbench`, 376 mp). A felosztása (két részre, kb. 300 mp-es teljes körért) nem készült el, mert az esetei egy közös oldalon, egymás után futnak.
  - **A teljes egységteszt-kör határa** a három hosszú fájl; a felosztásuk nem készült el.

## Bizonyíték

- **Egységteszt** ([gate-plan.test.mjs](../../tests/gate-plan.test.mjs)):
  - megjelenítés: a függő tesztek és a böngésző;
  - dokumentum: a megnevező tesztek, böngésző nélkül;
  - a mag, a szerzői elemzés, a szerver, a `dist`, az orákulum, a fixture-ök, a példák, az eszközlánc és egy ismeretlen út: teljes kör;
  - egyetlen ilyen fájl a szűkíthetők között is teljes kört ad;
  - változás nélkül csak az ellenőrzők.
- **Mérés:** a fenti táblák; a fájlonkénti idők a `node --test` saját jelentőjével, a soronkénti idők a kapu kimenetéből.
- **Ez a változás maga** a teljes kört kapta (`scripts/` és `package.json` változott).
