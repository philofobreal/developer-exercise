# ADR-021 – Szerzői szabálypanel a rendezőn

Állapot: implementálva (D2). A validátor, a CodeLine-séma, a tanulói parsermentes értékelés és a bizalmi határ változatlan. A policyverzió nem változik (`scoped-effect-analysis-v11`).

## Kontextus

A D1 (ADR-018) óta a szabályok típusos műveletekkel szerkeszthetők (`applyRuleEdits`, `editAuthorModel`), minden szerkesztés után lefut a gate (ADR-017). A szerver és a Pages válasza tartalmazza a nyelvi auditot (ADR-016), a minősítést és a refresh-jelentést.

A felületen ebből semmi nem látszott:

- a szerző csak a JSON-szerkesztőben módosíthatta a szabályokat, biztonsági és hatásellenőrzés nélkül;
- az audit, a minősítés és a refresh-jelentés nem jelent meg;
- az `importEmit` (ADR-013) nem volt választható.

Egy D1-hiba is előkerült. Egy generált kényszer eltávolítása „redundánsnak” számított, ha szerzői szabályok is rendezték a párt. Ilyenkor megerősítés és nyilvántartás nélkül törlődött. A szerzői szabályok utána szabadon eltávolíthatók, így a bizonyított kényszer megerősítés nélkül elveszett.

## Döntés

### 1. A szerkesztés helye: a rendező, csak a szerző saját előnézetében

A szerzői előnézetben minden sorhoz tartozik egy láncszem gomb. Megnyomására a rendező alatt megnyílik a sor szabálypanelje, és a rendezőben kiemelődnek a közvetlen kapcsolatai:

- kék: a sornak ezek után kell állnia;
- zöld: a kijelölt sor;
- borostyán: ezeknek a sornak a kijelölt sor után kell állniuk.

A panel tartalma:

- **Közvetlen előzmények és követők:** okkal (kategória és kód), szerkeszthetőségi osztállyal, megjegyzéssel.
- **Műveletek:** eltávolítás (szerkezeti szabálynál nincs gomb), megjegyzés, új előzmény vagy követő, rögzítés.
- **Hatás:** a legutóbbi módosítás hatásjelentése, tanúsorrenddel.
- **Minősítés:** a gate státusza.
- **Proveniencia:** hiányzó vagy kötetlen proveniencia esetén magyarázat (a 6. és 7. kockázat).

Az Adatmodell nézet új „Minősítés” blokkja mutatja:

- a státuszt, a publikálhatóságot és a megállapításokat;
- az állításokat és alapjukat;
- a nyelvi auditot (diagnosztika, feloldatlan modulok);
- a szerzői lazításokat;
- a refresh-jelentést.

A Referenciaforrás nézetben TypeScriptnél választható az `importEmit` (`verbatim` alapértelmezett, `elide-unused`). Csak TypeScriptnél kerül a kérésbe (`authorRequest`).

**Tanulói elkülönítés:** a panel, a gombok és a kiemelés csak akkor jelenik meg, ha a nézet aktív feladata a szerző saját előnézete, és nincs tanulói preview. A beépített (trusted) feladatokhoz a kliens továbbra sem kap függőségi gráfot, és ez sem ad neki. A tanulói preview ezzel is felületi elkülönítés, nem jogosultság. A szerveroldali szerzői jogosultság az F2 feladata.

### 2. Új szerzői végpont: `POST /api/author/rules`

A kérés `{draftId, edits}`. A szerver a saját, már befogadott draft-másolatát szerkeszti (`editAuthorModel`), modellt nem fogad el a kéréstől.

- **Siker:** új draft (új azonosító, a revízió eggyel nő) a gate újraminősítésével, a hatásjelentéssel és a szabálylappal. Az előd draft törlődik, így a szerkesztés nem tölti fel az előnézeti limitet.
- **Elutasítás:** tartományi válasz, nem szállítási hiba: `200 {ok: false, error, message, index, acknowledge?}`. A draft érintetlen marad.

A Pages-adapter (`editRules`) ugyanezt helyben teszi.

A szerver előnézete mostantól a draft saját revíziójával értékel. Korábban a revízió fixen 1 volt, ezért egy szerkesztett draft előnézete hibás lett volna.

### 3. A felület nem dönt szabályról

- **A megerősítés szintje a core-tól jön:** az `applyRuleEdits` `needs-acknowledgement` hibája `acknowledge` mezőben megnevezi a szükséges szintet (`unproven-relaxation` vagy `policy-override`). A panel ezt kéri meg, a szerkeszthetőség → megerősítés leképezést nem ismétli. Megerősítéskor indoklás is adható, amely a lazítással együtt a modellbe kerül.
- **Szabálylap (`authorRuleSheet`):** a magyarázat közvetlen kényszerei, mindegyik egyszer, tranzitív lezárás nélkül.
  - A lezárás négyzetesen nő: a CopyField teljes magyarázata 1,1 MB, a közvetlen lap ennek töredéke.
  - A körök és a redundancia megítélése a core dolga, a panelnek nincs szüksége lezárásra.
  - Új szabályhoz csak a referencia sorrendjével összhangban álló sorokat kínálja fel a panel, mert ellentétes irányú kötelező szabályt a core úgyis elutasítana (`against-reference`). A döntés így is a core-é.
- **Csak típusos modulban:** a panel a `src/workbench/rule-panel.ts`-ben van. A legacy `ui.js` csak bekötést kapott, a `api.js` és az `author-session.js` csak szállítást és tárolást.

### 4. Állapotfolytonosság

- **Közös admission-út:** a szabályszerkesztés ugyanazt az atomikus utat használja, mint a JSON-alkalmazás (`authorApply` → `installPreview`). A kompatibilis kitöltés megmarad, és az előnézet azonnal újraértékeli az új szabályokkal.
- **Nem alkalmazott referenciaforrás:** egy szabályszerkesztés nem írja felül (`admit(…, {keepPending: true})`), mert a sorokat nem változtatja.
- **Nem alkalmazott JSON-módosítás:** a szabályszerkesztés ilyenkor nem indul el (`ruleEditBlocked`), mert felülírná a JSON-t.
- **Kései válasz:** a `captureAuthorRequest` ugyanúgy eldobja.

### 5. A D1 redundanciaszabályának pontosítása (ADR-018 módosítása)

Egy generált kényszer eltávolítása csak akkor redundáns (szabad, nem rögzített), ha a pár a **megmaradó, nem szerzői** kényszereken át is rendezett. A csak szerzői szabályokból következő redundancia nem számít: a kényszer eltávolításához a szerkeszthetőségének megfelelő megerősítés kell, és a lazítás rögzül.

A korábbi teszt éppen a hibás utat rögzítette. Most a helyes viselkedést rögzíti, és egy legacy példán megmutatja a valóban redundáns, szabad eltávolítást is.

## Következmények

- **Új modul:** `src/workbench/rule-panel.ts` → `public/app/rule-panel.js`, felvéve az architektúra-szabály generált listájába.
- **Új core-mező:** `RuleEditResult` hiba esetén `acknowledge?`.
- **Új szerzői függvény:** `authorRuleSheet`.
- **Javítások:**
  - a refresh a modell rögzített `importEmit`-jével generál újra, mint a gate; korábban egy `elide-unused` modell refresh után csendben `verbatim` lett;
  - a szerver az előnézetet a draft revíziójával értékeli.
- **Tesztek:**
  - [author-rule-panel.test.mjs](../../tests/author-rule-panel.test.mjs): szabálylap, szerver, HTTP, refresh `importEmit`-tel, megjelenítés és escape-elés, tanulói elkülönítés, állapotkezelés;
  - a [pages-api.test.mjs](../../tests/pages-api.test.mjs) Pages-esete;
  - a [rule-editing.test.mjs](../../tests/rule-editing.test.mjs) pontosított redundanciaesete;
  - két Playwright-eset Node és Pages módban: szerkesztés, megerősítés és visszavonás, escape-elés, tanulói elkülönítés, valamint a nem alkalmazott referencia- és JSON-piszkozat megőrzése.

**Maradó korlátok:**

- az OR-profilok a panelen nem szerkeszthetők (a JSON-ban igen; a core-műveletek megvannak);
- a hatásjelentés a D1 szerinti korlátos tanúkeresés;
- a szerzői API továbbra is hitelesítés nélküli helyi eszköz (F2);
- a nézetek közti átmenet és állapotkapcsolat egyszerűsítése az U1 feladata.
