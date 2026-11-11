# ADR-135 – Súgó: „Kipróbálom” és kiemelt kódpéldák (NY-31)

Állapot: **elfogadva** (2026-11-11). A felhasználó a következő tételt kérte; az NY-31 az [ADR-124](124-help-from-one-source.md) rögzített maradéka volt. Kockázati osztály: megjelenítés, valamint dokumentáció és eszközök. A motor, a szabályok és az értékelés nem változott.

## Kontextus

- A súgó minden példája állítás a motorról („a 3. és 4. sor cseréje: Számít → elutasítva”), és a [help-examples.test.mjs](../../tests/help-examples.test.mjs) a valódi motorral ellenőrzi.
- A tanár azonban nem tudta kipróbálni: a példát kézzel kellett átmásolnia, és a beállításokat kézzel beállítania. Ha valamelyiket elvétette, az eredmény eltért a súgótól, és nem derült ki, miért.
- A példák kódja kiemelés nélküli volt, a munkafelület többi kódjától eltérően ([ADR-121](121-one-code-editor.md)).

## Döntés

- **„Kipróbálom” minden kimenetel mellett,** nem példánként. Egy példának kimenetelenként más a beállítása, és a tanárnak éppen azt kell látnia, amelyiket a sor állítja.
  - **A buborékban** (munkafelület) gomb: a példa forrása a nyelvével a Kód lépésbe kerül, a sor beállításaival. Az üzenet megmondja, mi a következő lépés („Készíts modellt, majd … cseréld fel a 3. és 4. sort”), és mit állít a súgó („elutasítva”).
  - **A súgóoldalon** hivatkozás a munkafelületre: `../index.html#kiprobalom=<téma>.<kimenetel>`. A munkafelület betöltéskor ugyanígy betölti, majd törli a címből, hogy egy frissítés ne töltse be újra.
- **Pontosan a súgó tesztjének beállításai:**
  - a kimenetel beállításai kerülnek a piszkozatba, minden más beállítás az alapértéken marad (nem a korábbi piszkozatén). A súgó tesztje is így kéri a feloldótól;
  - a cím, a leírás és a szint a szerzőé marad, mert az elemzést nem érintik;
  - a betöltés visszavonható, mint a többi betöltés ([ADR-115](115-load-with-undo.md) szerinti `undoReplace`).
- **Egy tulajdonos:**
  - a témákat, a kimenetel szövegét és a címet a `help-topics.ts` ismeri: `helpTrial`, `helpTrialHref`, `helpTrialFromHash`;
  - a piszkozat cseréjét az `author-workspace.ts` végzi: `startFromHelp`;
  - a `ui.js` csak bekötés (ADR-001).
  - A `HelpSettings` mostantól a piszkozat saját mezőinek típusa, így egy elgépelt beállításérték fordítási hiba.
- **Kiemelt kód:** a buborékban és az oldalon ugyanaz a vendorolt Prism és ugyanaz a kiemelő (`highlight` → `highlightLines`).
  - A többsoros token (sablonszöveg, blokk-komment) színe megmarad: az egész szöveg egyszerre kiemelődik, majd soronként vágódik, és minden sor lezárja, a következő újranyitja a nyitott elemeket.
  - Az oldal buildkor kiemelődik: a `build-help.mjs` Node alatt betölti ugyanazt a négy Prism-fájlt. Az oldalon nincs ehhez szkript, a CSP-szabály változatlan.
  - A tokenszínek a munkafelületével azonosak (`:is(#app,.help-page) .token…`), az oldal a `prism.css`-t is betölti.

- **A nyitott buborék helyet foglal, nem takar** (`installToggletips`).
  - Eddig a buborék a tartalom fölé lebegett. A CI-gépen (más betűtípussal) a kulcssorrend-buborék alja félig rátakart a „Hordozhatóság” mezőre. A mező így 12 px-es célterületre szűkült (WCAG 2.5.8; az a11y-kapu v57 óta piros volt a CI-n, ezért a Pages nem frissült).
  - A v57-es szövegrövidítés csak elfedte a hibát; a „Kipróbálom” sorok a buborékot magasabbá tették.
  - Most a buborék megnyitásakor a fejléce (`.setting-head`, `.task-question`, `.diagnostics-head`, `.insight-heading`) alsó margót kap a buborék magasságával, és a mező a buborék alá kerül. Bezáráskor a margó megszűnik. A margót a toggle-esemény CSSOM-mal állítja, ezt a CSP engedi.
  - A buborék rétege 13 (a menüké 40): tartalomként a ragadós művelet- és eredménysáv (14, 15) alá csúszik görgetéskor, nem takarja a sáv gombjait.
  - A mérés minden szélességen (320, 390, 768, 1280 px), mesterségesen megnövelt sorközzel is: 0 takart vezérlő. Javítás nélkül 16 esetben takart a buborék egy mezőt.
- **A kódpélda nem kap `language-` osztályt:** a `prism.css` az ilyen elemre saját világos hátteret fest, amelyen sötét témában a világos tokenek olvashatatlanok voltak (kontraszt 1,28). A nyelv `data-language` attribútumban áll. A „Kipróbálom” a súgóhivatkozás színét kapja (`--accent-text`), mert az `--accent` sötét háttéren csak 3,79 kontrasztú.

## Két terv („design it twice”)

1. **Egy „Kipróbálom” példánként, az első kimenetel beállításaival, vagy a szerző jelenlegi beállításaival.** Elvetve: a jelenlegi beállítással az eredmény a súgó egyik sorával sem egyezik biztosan; az elsővel a másik sor nem próbálható ki.
2. **Kimenetelenként, a súgó tesztjének pontos beállításaival (választott).** A tanár ugyanazt kapja, amit a teszt ellenőriz; ezt az új paritásteszt rögzíti.

## Tervezési review (docs/design-review.md)

- **help-topics.ts:** *elrejti* továbbra is a témákat és a jelölést; az új tudás (mit tölt be egy kimenetel, milyen címen) ugyanide tartozik. Interfész: `helpTrial`, `helpTrialHref`, `helpTrialFromHash`; a `renderExample` megkapja a téma azonosítóját és a helyet (`workbench` vagy `page`).
- **author-workspace.ts:** a betöltések tulajdonosa (`startFromExample`, `replaceDraft`, `undoReplace`); a `startFromHelp` ugyanezt az utat használja.
- **ui-utilities.ts:** a `highlight` a globális `Prism`-et olvassa (a böngészőben ez a `window.Prism`), így a build ugyanazt a függvényt futtatja; a `highlightLines` az egyetlen sorokra vágó kiemelő.
- **Rögzített maradék:** a „Kipróbálom” a példát betölti, de a modellt nem készíti el és nem cserél sorokat helyetted; az üzenet megmondja a lépéseket.

## Bizonyíték

- **[help-trial.test.mjs](../../tests/help-trial.test.mjs):**
  - mind a 18 kimenetel kipróbálható;
  - a betöltött piszkozat kérése pontosan arra a hatályos beállításra és ujjlenyomatra oldódik fel, amelyre a súgó tesztjéé, egy eltérő beállításokkal induló piszkozatból is;
  - a visszavonás visszahozza a korábbi piszkozatot;
  - a cím csak érvényes témát és kimenetelt nevez meg;
  - a buborékban gomb, az oldalon hivatkozás kimenetelenként;
  - a kiemelt sorok jól formáltak, a többsoros token mindkét soron megtartja az osztályát, a forrásbeli jelölés szöveg marad.
- **[help-examples.test.mjs](../../tests/help-examples.test.mjs):** a szállított oldal a forrás buildje, a vendorolt Prismmel.
- **Böngészős teszt** (`help_trial`, szerveres és Pages módban):
  - a kulcssorrend-buborék „Számít” kimenetele egy „Nem számít” piszkozatból indulva betölti a példát;
  - az Elemzés lépés beállítása „Számít” lett;
  - a 3. és 4. sor cseréje „Hibás”, ahogy a súgó állítja;
  - a súgóoldal kiemelt, és a „Helyi objektumállapot” példa „Ellenőrzi” kimenetele a munkafelületen az `OS001` leletet adja; a cím utána üres.
- **Böngészős teszt** (a telefonos szélességek, `COVERED_BY_BUBBLE`): a nyitott buborék egy vezérlőt sem takar, elementFromPoint-mintavétellel; mesterségesen magas buborékkal (megnövelt sorköz) sem. Bezáráskor a margó megszűnik.
- **Az a11y-kapu** a buborék elhelyezése után vizsgál (a toggle-esemény aszinkron).
- **A régi `stale_file_import` teszt** megvárja, hogy az oldal elkezdje olvasni a fájlt, mielőtt elengedi; lassú gépen (CI) a teszt korábban egy még nem létező függvényt hívott.
