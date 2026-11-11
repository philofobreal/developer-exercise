# ADR-124 – Súgó egy forrásból: ellenőrzött példák, súgóoldal, ⓘ buborék

Állapot: **elfogadva** (2026-11-10). Az ⓘ kétszintű mintáját (buborék, benne „Részletek a súgóban” új lapon) a felhasználó választotta (2026-11-09, az audit 5. döntése). Kockázati osztály: megjelenítés, valamint dokumentáció és eszközök. A felületterv H1–H3 pontja.

## Kontextus

- **A beállítások leírása szétszórtan élt:**
  - egy mondat a beállítás alatt (a `preflight-settings.ts`-ben);
  - a minősítés, a leletek és az okkódok jelentése néhol a felületen, néhol csak ADR-ekben;
  - példa sehol nem volt.
- **A tanár nem tudta meg a felületről, mit jelent egy beállítás egy konkrét kódon,** és hogy a „Konzervatív” vagy a TS2307 mit kér tőle.
- **A kért megoldás** (felületaudit, 07. pont):
  - kereshető súgóoldal ugyanazzal a dizájnnal;
  - egységes ⓘ;
  - kódpéldák, amelyek nem avulhatnak el.

## Döntés

- **Egy forrás: [help-topics.ts](../../src/workbench/help-topics.ts).** Benne a témák csoportokban, mindegyikhez:
  - horgony;
  - egy-két mondat (`summary`);
  - törzsszöveg;
  - ha van, példa.
  
  Ugyanebből a forrásból készül:
  - a beállítás alatti rövid szöveg (a `preflight-settings.ts` innen olvassa, a régi `hint` mezők megszűntek);
  - az ⓘ buborék (`renderInfo`);
  - a súgóoldal (`renderHelpPage`).
- **Ellenőrzött példák (H1, a doctest elve):**
  - minden példa állítás a motorról („a 3. és 4. sor cseréje: Számít → elutasítva, Nem számít → elfogadva”);
  - a [help-examples.test.mjs](../../tests/help-examples.test.mjs) mindet lefuttatja:
    - a sorrendi példát a valódi generátorral és kiértékelővel, a feloldó által hatályosított beállításokkal (így a konzervatív profil zárolása is benne van);
    - a vizsgálati példát az első kapuval: ítélet, továbbengedés, lelet kódja.
  - Ha egy szabályverzió megváltoztatja a viselkedést, a súgó tesztje piros.
  - Kilenc beállítás, kilenc példa; mindegyiket a súgóba vétel előtt is lefuttattam, és csak a ténylegesen így viselkedőt vettem fel. (Az első checkJs-jelölt nem működött: JavaScriptben egy objektumliterál hiányzó mezőjének olvasását a fordító nem jelzi.)
- **Súgóoldal (H2): `public/help/index.html`.**
  - A build (`scripts/build-help.mjs`) a fordított témamodulból és a szerzői okkód-jegyzékből (`REASON_CODES`) írja. Az okkód-táblázat tehát a jegyzék maga, nem másolat.
  - Statikus; a szerver és a Pages ugyanígy szolgálja ki.
  - Bal oldalon tartalomjegyzék kereséssel, témánként állandó horgony.
  - A keresés ékezet- és kisbetű-független, minden beírt szót megkövetel, és kimondja a találatok számát. Saját modul ([help-search.ts](../../src/workbench/help-search.ts)), mert a CSP beágyazott szkriptet nem enged.
  - A felület tokenjeivel és betűivel készül, világos és sötét témában.
  - A teszt azt is ellenőrzi, hogy a szállított oldal ennek a forrásnak a buildje.
- **ⓘ buborék (H3):**
  - Egy 28 px-es, keret nélküli ikongomb a címke után, „Súgó: …” akadálymentes névvel. Kattintásra buborék nyílik: a téma mondatai, a példa, és a „Részletek a súgóban” hivatkozás, amely új lapon nyitja az oldalt a témánál.
  - Menüként viselkedik: Escape, illetve kattintás máshová bezárja, a fókusz visszatér.
  - A képernyő szélén a buborék visszacsúszik a látható területre. Ez az `left` eltolással történik, nem `transform`-mal, mert az átalakított doboz az eredeti helyén is szélesítette volna az oldalt (mérés: 559 px egy 390 px-es telefonon).
  - **Hol van:**
    - a kilenc beállítás (ott a buborék a mondatot nem ismétli, mert a mező alatt áll);
    - a három állapotkérdés;
    - a Minősítés;
    - a Szabályok típus szerint;
    - a leletlista;
    - a hiányzó projektkontextus sora.
  - A munkaterület alján a „Súgó: kezelés és billentyűzet” blokk a teljes súgóra is hivatkozik.

## Két terv („design it twice”)

1. **Típusos témamodul a munkapadban, az oldal buildkor generálva (választott).** A buborék futás közben olvassa, értelmező és letöltés nélkül; az oldal és a teszt ugyanazt a modult importálja.
2. **Markdown a `docs/help/` alatt (az eredeti javaslat, elvetve).** A buborékhoz futás közben Markdown-értelmező vagy letöltés kellene. A megjelenítés nem birtokolhat hálózatot (`presentation-policy`), és egy második, generált adatfájl a buborék szövegét a forrástól eggyel távolabb vinné. A próza így TypeScript-karakterláncokban áll; ez a szerkesztésnél kényelmetlenebb, ezt vállaltam.

## Tervezési review (docs/design-review.md)

- **help-topics.ts:**
  - *elrejti* a témákat, a sorrendet, a horgonyokat, a szöveget, a példákat, a buborék és az oldal jelölését;
  - *interfésze:* `helpSummary`, `renderInfo`, `renderHelpPage`, `helpTopics` (a tesztnek), `helpHref`.
- **preflight-settings.ts:**
  - a beállítás neve és értékei maradtak itt, a magyarázat a súgóé lett;
  - a két tudás ezzel szétvált, nem másolódott.
- **interactions.ts `installToggletips`:** egy dolgot tud, hol fér el a buborék.
- **Rögzített maradék:**
  - a buborékban a kód kiemelés nélküli. A Prism csak a böngészőben él, az oldal pedig buildkor készül.
  - a „Kipróbálom” gomb (a példa megnyitása a Kód lépésben) nem készült el.
  - Mindkettőt lezárta az [ADR-135](135-help-trial-and-highlighted-examples.md).

## Bizonyíték

- **Egységteszt:** [help-examples.test.mjs](../../tests/help-examples.test.mjs):
  - a 9 beállítás mindegyikének van példája;
  - minden sorrendi példa a valódi motorral;
  - minden vizsgálati példa az első kapuval;
  - az oldalon minden téma a horgonyánál és a tartalomjegyzékben;
  - mind a 38 okkód a jegyzékből;
  - nincs beágyazott szkript;
  - a szállított oldal friss;
  - a beállítás alatti szöveg a súgó szövege;
  - a buborék hivatkozása és példája.
- **Böngészős teszt:** [browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py) `help_toggletips`:
  - a buborék nyílik, a képernyőn belül marad, Escape-re bezárul, a fókusz visszatér;
  - a hivatkozás új lapon a témánál nyitja az oldalt;
  - a keresés szűkít és visszaáll.
- **Akadálymentesség:** [browser-a11y.playwright.py](../../tests/browser-a11y.playwright.py) a nyitott buborékot, a súgóoldalt és a szűkített súgóoldalt is vizsgálja, világos és sötét témában, asztalon és telefonon.
