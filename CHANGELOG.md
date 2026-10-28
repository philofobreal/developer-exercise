# Changelog

## Unreleased – 2026-10-28 a konstruktor this-írásai (ADR-031, v15)

- **Rés lezárva:** a konstruktor két független `this`-írása (`this.name = name; this.id = id;`) felcserélhető, ha a program nem listázza a kulcsokat. A `this` a nem származtatott, elemezhető osztály konstruktorában saját objektum.
- **Kötött marad:**
  - az olvasás írás után;
  - a kiszökő `this` (például `register(this)`);
  - a kulcsokat listázó program;
  - a származtatott osztály;
  - a paraméteren végzett művelet;
  - ugyanazon mező kétszeri írása.
- **Orákulum:** a konstruktor `this`-műveletei és a bővebb értékkör (literálok, aritmetika, saját mezők, `throw new Error` egy ágban) is helyi objektumművelet; sorrendjükről a futásidő dönt.
- **Tesztek:** `constructor-footprints`, kilenc új fixture; a `01-user-account` 8/8 kombinációja pontosan egyezik a futásidővel.

## Unreleased – 2026-10-28 pontosabb hibaazonosítás (ADR-030)

- **Kérdés:** a setter törzsébe tett `score = 0;` mezőre a kiértékelő csak annyit mondott, hogy „a pontos ok nem nevezhető meg”. Az ok: a blokk záró `}` sora több helyen is állhatott, és az ilyen blokkot a diagnosztika kihagyta.
- **Blokkhatár-becslés:** a határsorok lehetséges helyeinek tartományával számol, és feltételezi, hogy a blokk a nyitó sora után zárul. A 46 soros példa összes egysoros áthelyezésén a bizonyított okok aránya 51%-ról 87%-ra nőtt.
- **Ellenőrzött egylépéses javítás:** ahol bizonyított ok nincs, a kiértékelő egy olyan egysoros áthelyezést javasol, amelyet a validátor elfogad. Nem nevez meg bűnöst, és saját kerete van. 500 soron a tipikus hiba 8 ms, a legrosszabb eset 0,15 s alatt van (Node és Chrome). A tanuló a sort látja, a célhelyet csak `rules` szinttől.
- **Tesztek:**
  - új `diagnostics-localization` (10 eset, nyers erős helyesség-ellenőrzéssel és időkerettel);
  - frissített `diagnostics`;
  - kézi mérőeszköz: `tests/support/move-search-scale.mjs`.

## Unreleased – 2026-10-28 példánymezők szabad sorrendje (ADR-029, v14)

- **Kérdés:** miért hibás a `state` és a `score` mező felcserélése? Mérés: 0 fordítási hiba, azonos értékek, csak az `Object.keys`/`JSON.stringify` kulcssorrend tér el.
- **Döntés (felhasználó):** a kulcssorrend csak akkor számít, ha a program maga listázza a kulcsokat.
- **Generátor:** a kódot nem futtató, egyedi nevű példánymezők egymáshoz képest szabadok. Kötött marad a sorrend:
  - ha egy inicializáló kódot futtat vagy másik mezőt olvas;
  - ha a program kulcsokat listáz (reflexió, `keys`/`values`/`entries`, `stringify`, `assign`, `structuredClone`, `console`, `inspect`, spread, `for…in`);
  - a statikus és az `accessor` mezőknél.
- **Orákulum:** ugyanez a szerződés. A példánymezők kulcsai halmazként számítanak, a P3 kulcsrendezett JSON-t hasonlít.
- **Minta:** a `01-user-account` két mezője felcserélhető. A konstruktor `this`-írásai kötöttek maradnak; ez ismert, tesztben rögzített rés.

## Unreleased – 2026-10-28 futásidőhöz igazított függőségek (ADR-028, v13)

- **Kiinduló kérdés:** a futásidejű mesterprompt saját bemenetén (`runMiniFixture`) a v12 szinte teljes sorláncot adott. A rögzített mintán 328 olyan sorrendet utasított el, amelyet a futásidejű orákulum azonosnak lát. A prompt szerint kézzel készített modell 0 ilyet utasított el. [Soronkénti elemzés](docs/runtime-prompt-mini-fixture-elemzes.md).
- **Javítás:**
  - mezőszintű hatásnyom: ugyanazon objektum két különböző mezőjének írása szabad; az új kulcsot létrehozó írás kötött marad;
  - listaszintű `if/else` hatásnyommal;
  - ismert `String.prototype` metódusok bizonyítottan string értéken;
  - `may-throw` csak két lehetséges kivétel között köt.
- **Eredmény:** a generátor lezárt sorrendi relációja azonos a kézi, prompt szerinti modellével, és a mintán 0 a hibás elfogadás és az indokolatlan elutasítás is.
- **Szigorítás:** a `.length` olvasás csak string értéken elemezhető, mert `null.length` dob.
- **Orákulum:** a P2-kivétel a csak helyi objektumokon dolgozó `if/else`-re is kiterjed. A TS-modulok `export`-ja CommonJS-kibocsátással fut.
- **Tesztek:** négy új ADR-028 eset, három új fixture (`prompt-mini-fixture`, `prompt-one-thrower`, `prompt-new-keys`), és minden elfogadott egysoros mozgatás orákulum-ellenőrzése.

## Unreleased – 2026-10-28 lezáró regresszió (G1)

- **Minta:** a `23-parameter-property` TypeScript-minta fordítható (`Parameters` → `Point`); a modell függőségei változatlanok.
- **Mátrix-flake:** a böngészős teszt a beszúrási határ helyett egyértelmű pontra céloz, és ellenpróbát kapott; az állítások nem gyengültek.
- **Új tesztek:** forráshűségi round-trip (`source-fidelity`, 28 eset) és a szerzői elemzés idő- és memóriakerete (`author-budget`, 10 s / 400 MiB a 500 soros korlátnál).
- **Lezáró eredmény:** `check:all` 741/741; generatív kampány 1 400 programon és 2 372 610 sorrenden, 0 hibás elfogadással; mind a 8 böngészős csomag zöld.
- **Dokumentáció:** [lezáró regresszió – módszertan](docs/lezaro-regresszio-modszertan.md), futtatási útmutatóval és a flake-ek kivizsgálásának menetével.

## Unreleased – 2026-10-28 felfedési politika, szerzői jogosultság és publikálás (ADR-027, F2)

- **Szerzői kapu a szerveren:** token nélkül csak a helyi gépről, loopback hosztnévvel (DNS-rebinding ellen); `CODELINE_AUTHOR_TOKEN` mellett kötelező a Bearer token; cross-site és idegen origin mindig tiltott. A tanulói végpontok változatlanok.
- **Egy felfedési politika** (`channelFeedback`) a szervernek és a Pages-nek. A szerző feladatonként `learnerFeedback: "rules"`-ra emelheti a tanulót: a megsértett pár látszik, az indoklás és a kategória nem. Az indoklás a diagnosztika külön, csak szerzői része (`reasons`).
- **Publikálási szabály** (`publicationRefusal`): a keretben el nem dönthető modellt a katalógus nem szolgálja ki; `CODELINE_PUBLICATION=verified-only` mellett a nem igazoltat sem. A kihagyott fájl érintetlen, a lista megadja a minősítést.
- **Tesztek:** `author-gate`, `catalog-publication`, bővített `diagnostics` és `trust-boundary`.

## Unreleased – 2026-10-28 visszajelzés és soronkénti jelölés (ADR-026, F1)

- **Rövid és részletes magyarázat:** az értékelősáv a legfontosabb bizonyított okot mondja ki. A „Részletes magyarázat” minden diagnosztikát felsorol a javítás bizonyossági szintjével, a szerzőnek a bizonyítékkal és a korláttal.
- **Soronkénti jelölés:** a ténylegesen értékelt sorok jelölést kapnak (biztosan érintett, illetve ezek egyike), képernyőolvasóval is. Az „Ugrás” gomb a fókuszt a sorra viszi. Bármely mozgatás azonnal érvényteleníti a jelölést.
- **Felfedés:** az API nézőnként vág (`discloseReport`). A szerzői előnézet mindent lát, a tanuló a pozíciószintig. A szabályszintű ok visszatartott, és egy általános sor helyettesíti; a megbízható gráf nem utazik a tanulóhoz. A Tanulói nézet pontosan a tanulói szintet mutatja.
- **Tesztek:** core egységteszt, negatív szivárgási API-teszt, böngészős eset Node és Pages módban.

## Unreleased – 2026-10-28 sorrögzítés a Szabályok tábláján (ADR-024)

- **Rajzszög-kapcsoló** minden sor műveleti sávjában: a sort a referencia szerinti helyére rögzíti, újra megnyomva feloldja. Akadálymentes toggle gomb (`aria-pressed`, helyet megnevező címke és tooltip), élő státuszsor, a fókusz a gombon marad. Ugyanaz a típusos `set-fixed` szerkesztés, mint a panelen, amelynek gombja is ezt az ikont kapta.
- **Teszt:** új böngészős eset Node és Pages módban; a kapcsolóteszt egy versenyhelyzete javítva (az újraértékelés megvárása a második húzás előtt).

## Unreleased – 2026-10-28 valódi függőségek soronként: helyi objektumok hatásnyoma és szabad megjegyzések (ADR-025, v12)

- **Cél (felhasználói kérés, mesterprompt):** minden sor csak a ténylegesen szükséges előzményeitől függjön. Az elrendezés pontosan ott romoljon el, ahol a program viselkedése is megváltozna.
- **Helyi objektumok:** egy függvény saját objektumain (`new` saját osztállyal, tömb- és objektumliterál) dolgozó utasítások hatásnyomot kapnak. A hatásnyom a konstruktor-, metódus- és accessortörzsek absztrakt végrehajtásából adódik. Két ilyen utasítást csak objektumütközés (a tárolt referenciákon át is) vagy lehetséges kivétel köt.
  - A prompt referenciaesete: `first.alias` és `store.add(first)`, illetve `first.alias` és `second.activate()` szabad.
  - Kötött marad a tároló sorrendje, a másoló tároló, a megosztott napló, a két dobó utasítás, az ismeretlen kód és az alias.
  - Ismeretlen kód, szökés, öröklés vagy reflexió esetén minden marad a régiben.
- **Megjegyzések:** az egysoros megjegyzés szabad a blokkján belül, utasításlistában és osztálytörzsben is. A többsoros megjegyzés sorai, a JSDoc és az irányelvek (`@ts-`, `/// <…>`) kötöttek maradnak.
- **Független orákulum:** két helyi objektumművelet sorrendjét a futásidejű összevetés (teljes JSON-állapot, napló, kivétel) dönti el.
- **Tesztek:** [object-footprints.test.mjs](tests/object-footprints.test.mjs): a prompt eseteinek mintái, kimerítő egysoros mozgatás, generatív objektumprogramok. Új kampányfajta: `--kinds=object`. A policycímke `scoped-effect-analysis-v12`.

## Unreleased – 2026-10-28 kapcsolatkapcsoló és pontos visszaállítás (ADR-024)

- **A kör kapcsoló:** egy sor körére kattintva a vele kapcsolatban álló sorok kipipálódnak, a kapcsolat színével (kék: előtte, borostyán: utána, lakat: szerkezeti). Pipára kattintva a kapcsolat megszűnik, üres körre kattintva létrejön; a húzás ugyanez. Ugyanúgy működik a Szabályok tábláján és a Próba lépés mindkét zónájában; a gyakorló mód és a tanulói nézet nem látja.
- **Pontos visszaállítás:** a lazítás rögzíti, mit vett ki (`removed`: eredet, okok, megjegyzés), így egy megszüntetett generált kapcsolat újbóli felvétele az eredetit hozza vissza, és a minősítés is visszaáll. Séma: `relaxations[].removed`.
- **Tesztek:** core oda-vissza út, a kapcsoló állapotai, új böngészős eset Node és Pages módban.

## Unreleased – 2026-10-27 magyarázható validáció a core-ban (ADR-023, E1)

- **`diagnoseSubmission`:** a validátor változatlan ítéletét bizonyított okokkal magyarázza. Egy konfliktus csak akkor kerül megnevezésre, ha minden tartalomkonzisztens hozzárendelésben igaz; azonos tartalmú sorok, egyetlen sérült OR-profil vagy elfogyott keret esetén általános, korrekt magyarázat jön.
- **Kategóriák:** ismeretlen, többlet- és hiányzó sor, előfordulási szám, rögzített hely, közvetlen és tranzitív sorrend (lánccal), szerzői és szerkezeti szabály, blokk- és konténerhatár, v3-egység, profilkonfliktus, `indeterminate`, érvénytelen referencia.
- **Javaslatok:** `verified` (a validátor elfogadja), `partial` (csak ez az ütközés szűnik meg), `guidance`; a mozgatás a rendező beszúrási szemantikáját követi (`moveLine`).
- **Keret és felfedés:** explicit lépéskeret részleges jelentéssel; minden diagnosztikának felfedési szintje van (`verdict` … `provenance`) az F2 számára. Szemantikai ok csak kötött provenienciából.
- **Közös tartalmi illesztés:** `content-match.ts`; a validátor ezt használja, a viselkedése nem változott.
- **Tesztek:** [diagnostics.test.mjs](tests/diagnostics.test.mjs), 17 eset, köztük brute-force bijekciós metamorf ellenőrzés és 500 soros mérés.
- **Még nem látható:** a tanulói megjelenítés az F1, a felfedési szabályozás az F2 feladata.

## Unreleased – 2026-10-27 javítás: a szabályszerkesztés nem görgeti a rendezőt a tetejére (ADR-022)

- **Hiba:** a Próba lépésben egy szabály hozzáadása vagy eltávolítása után a megoldás panel a tetejére ugrott. Ok: minden szabályszerkesztés új előnézet-azonosítót ad, a görgetési és fókuszmemória pedig ehhez az azonosítóhoz volt kötve.
- **Javítás:** a memória kulcsa a szerzői projekt (`continuityKey`); a gyakorlófeladatok külön kulcsot kapnak. A szabálypanel saját görgetése is megmarad. A szerkesztés így ugyanúgy viselkedik, mint egy húzás.
- **Tesztek:** `workbench-flow` egységteszt és új Playwright-eset Node és Pages módban (hozzáadás és eltávolítás után változatlan görgetés).

## Unreleased – 2026-10-27 léptetéses szerzői folyamat és vizuális szabálytábla (ADR-022, U1)

- **Két mód:**
  - **Feladat készítése** (kezdőoldal): Forrás → Szabályok → Próba, egy aktív lépéssel; a Szabályok és a Próba alkalmazott modellig zárolt.
  - **Gyakorlás:** a beépített feladatok listája tanulói nézettel. A gyakorlás és a szerzői projekt nem írja egymást; a példák kezdőpontok.
- **Elavulás:** egy nem alkalmazott forrás- vagy JSON-módosítás után a későbbi lépések „Elavult” jelzést és feloldó sávot kapnak („Modell újrakészítése”, „Forrásváltozás elvetése”, „JSON megnyitása”). Egy sikeres alkalmazás minden nézetet ugyanabból a modellből frissít.
- **Vizuális szabálytábla:** a referencia sorai blokkmélység szerint, a szabályok ívekkel rajzolva. Két sor összeköthető húzással (egér, toll, érintés) vagy billentyűzettel; ebből típusos `add-rule` lesz, a döntés a core-é. A D2 szabálypanelje ide költözött.
- **Szabályok a próbarendezőn:** a Próba lépésben is minden soron láncszem- és körgomb, a rendezőben az aktuális elrendezés szerinti ívek (minden mozgatás után újrarajzolva), alatta a szabálypanel. A szerkesztés azonnal újraértékeli a kitöltést; a körgombról induló húzás nem mozgat sort. A gyakorló mód és a tanulói nézet ebből semmit nem lát.
- **Állapotgép:** a típusos `flow.ts` a zárolásról, az elavulásról, a módváltásról és a landolásról dönt; az `author-workspace.ts` egyetlen projektet kezel (ADR-004 ezen része felváltva).
- **Javítások:**
  - a minősítés-blokk nyitott állapota alnézetenként megmarad;
  - a húzás utáni kattintáselnyelés nem nyel el billentyűzetes aktiválást;
  - a helyi mentés és a munkamenet-import a Forrás lépésből is elérhető;
  - a TypeScript-példatár linkje a Forrás lépésben.
- **Tesztek:**
  - [workbench-flow.test.mjs](tests/workbench-flow.test.mjs) és az átírt [author-workspace.test.mjs](tests/author-workspace.test.mjs);
  - a workbench-böngészőcsomag 39 esete;
  - a mátrix, a drag, az offline, a v7 és a TypeScript kör az új navigációval.

## Unreleased – 2026-10-27 szerzői szabálypanel a rendezőn (ADR-021, D2)

- **Szabálypanel:** a szerző saját előnézetében minden sornak van láncszem gombja. Megnyomására megjelennek a sor közvetlen előzményei és követői okkal, szerkeszthetőséggel és megjegyzéssel, és a rendezőben kiemelődnek. A panelen szabály vehető fel, távolítható el (a szerkezeti nem), megjegyzés írható, és sor rögzíthető. Megjelenik a hatásjelentés tanúsorrenddel és a gate státusza is. A tanulói preview-ban ebből semmi nem látszik.
- **Megerősítés:** a szükséges megerősítési szintet a core nevezi meg (`RuleEditResult.acknowledge`). A panel ezt kéri, és az indoklás a lazítással együtt rögzül.
- **Adatmodell nézet:** minősítés, publikálhatóság, megállapítások, állítások és alapjuk, nyelvi audit, szerzői lazítások, refresh-jelentés.
- **Referenciaforrás nézet:** `importEmit`-választó TypeScripthez (`verbatim` / `elide-unused`).
- **API:** `POST /api/author/rules`, illetve Pages-ben `editRules`. A szerver a saját draft-másolatát szerkeszti, és a gate újraminősít. Elutasításnál `200 {ok: false, …}` a válasz, és a draft érintetlen. A fordítási válasz szabálylapot (`rules`) is ad: a közvetlen kényszereket, lezárás nélkül.
- **Javítások:**
  - csak szerzői szabályokból következő redundancia nem teszi szabaddá egy generált kényszer eltávolítását (az ADR-018 pontosítása);
  - a refresh a rögzített `importEmit`-tel generál újra;
  - a szerver az előnézetet a draft revíziójával értékeli;
  - egy szabályszerkesztés nem írja felül a nem alkalmazott referencia- vagy JSON-piszkozatot.
- **Tesztek:** [author-rule-panel.test.mjs](tests/author-rule-panel.test.mjs), Pages-eset, pontosított `rule-editing` eset, két Playwright-eset Node és Pages módban.
- **Ütemezve:** U1, a nézetek léptetéses egyszerűsítése ([epic-állapot](docs/semantic-ordering-epic-status.md)).

## Unreleased – 2026-10-27 metódusok és felső szintű függvények szabad sorrendje (ADR-020, v11)

- **Döntés:** a felső szintű függvénydeklarációk és az osztálymetódusok, accessorok egymás közti sorrendje szabad; a példánymezők, a static mezők és a `var`-ok sorrendje kötött marad.
- **Kivétel:** ha a program maga listázhatja a kulcsokat, marad az ADR-010 szerinti teljes sorrend. Ez akkor áll fenn, ha a forrás megnevez egy reflexiós API-t vagy a globális objektumot, illetve szkriptszinten `this`-t használ:
  - `getOwnPropertyNames`, `ownKeys`, `getOwnPropertyDescriptors`, `Reflect`;
  - `globalThis`, `window`, `self`, `frames`, `global`, `Function`, `eval`.
- **Generátor (`scoped-effect-analysis-v11`):**
  - `observesKeyOrder`, valamint a `reflectedKeys` opció a tag- és az utasításelemzésben;
  - a sima overload-csoport egyetlen metódusdefiníció.
- **Orákulum:** a P4 független követése a nem felsorolható kulcsok halmazként való összevetésével, a reflektáló programot külön felismerve.
- **Könyvtári példák** (revision 2): a `class-inventory-ts` és a `class-accounts-ts` konstruktora és metódusai már nem kötöttek a mezőkhöz. Az engedélyezett sorrendek száma 288 → 5 760, illetve 192 → 20 160, és mind futásidőben ekvivalens.
- **Tesztek:** [key-order-observation.test.mjs](tests/key-order-observation.test.mjs). A régi P4-tesztek kétfelé bontva: kívülről nézve elfogadott, reflektáló programban elutasított.

## Unreleased – 2026-10-27 tiszta egység és hatás-barrier kommutációja (ADR-019, v10)

- **Hiba:** a szerzői előnézetben (generált modell) a `binarySearch` `let low = 0;` / `let high = sorted.length - 1;` és az `insertionSort` `const current = values[i];` / `let j = i - 1;` cseréje elutasított volt. A kézi könyvtári modell és a futás szerint mindkettő helyes.
- **P2 pontosítása (`scoped-effect-analysis-v10`):** egy tiszta, blokkszintű, lokális deklaráció átléphet egy hatás-barriert, ha:
  - a barrier nem hagyja el korán önmagát (`return`/`throw`/`yield`/`await`/kifelé ugrás/`using`);
  - sem a barrier, sem closure nem hivatkozik a deklaráció kötéseire, és nem írja az olvasott kötéseit (kötés és név szerint);
  - a függvény nem használ `arguments`-et.
- **Számláló:** a csak `++`/`--` által írt, primitív kezdőértékű `let`/`var` (a `for` fejléc változója is) olvasása primitív.
- **Orákulum:** a független P2-orákulum saját, név alapú implementációval követi; az `ordering-semantics` teszt ugyanezt használja.
- **Mérés (azonos v10-orákulummal):**
  - korpusz: 0 hibás elfogadás, 417 → 430 elfogadott szomszéd, a rések száma 42 → 29;
  - kampány (1 000 program): 0 hibás elfogadás, 36 716 → 40 693 elfogadott sorrend, a rések száma 6 067 → 4 363.

  Részletek a [formális szerződésben](docs/formal-ordering-contract.md#adr-019-tiszta-egység-és-hatás-barrier-kommutációja).
- **Változatlan:** P4 (a függvények és metódusok kulcssorrendje), a paraméterek property-olvasása. A régi modellek a saját címkéjükkel érvényesek; a gate a v9-et `outdated`-ként jelzi.
- **Tesztek:** [pure-effect-commutation.test.mjs](tests/pure-effect-commutation.test.mjs).

## Unreleased – 2026-10-26 típusos szerzői szabályműveletek (ADR-018, epic D1)

- **Műveletek:** [rule-editing.ts](src/core/rule-editing.ts), `applyRuleEdits`. Szerzői szabály, megjegyzés, `fixed`, OR-profil és profilszabály. Kötegelt, atomikus; minden lépés befogadott, a referenciát el kell fogadni, a bemenet nem változik, a revízió nő.
- **Biztonság:** a `hard` kényszer nem törölhető. A `conservative` csak `unproven-relaxation`, a `proven` és a `legacy` csak `policy-override` megerősítéssel; a lazítás rögzül (`authoring.relaxations`). A szerzői és a redundáns szabály szabadon törölhető, a tranzitív következmény nem törölhető.
- **Hatásjelentés:** a szigorítás és a lazítás `no` (tartalmazással bizonyított), `yes` (validátorral ellenőrzött tanúsorrend) vagy `maybe`.
- **Újraminősítés:** az `editAuthorModel` minden szerkesztés után lefuttatja a gate-et. Szerzői szűkítés esetén `author-modified`, bármilyen lazítás esetén `unverified`.
- **Refresh:** a `refreshAuthorModel` átviszi a szerzői szabályokat, a legacy éleket, a lazításokat (újraalkalmazva vagy visszavonva) és a megjegyzéseket. A korábbi elemzés generált éleit lecseréli, és jelentést ad (`refresh` a draftválaszban).
- **Tesztek:** [rule-editing.test.mjs](tests/rule-editing.test.mjs).

## Unreleased – 2026-10-26 Model Verification Gate (ADR-017, epic V1)

- **Projekciós veszteség:** a projekció megszámolja azokat az egységpárokat, amelyeket az elemzés szabadon hagyott, de a v2-modell rendez (`evidence.projectionLoss`). CopyField: 0, korpusz: 8 ismert pár.
- **Újralevezetés:** a `verifyAuthorModel` a modell forrását a rögzített import-emittel újragenerálja. A függőségeknek, a nem szerzői éleknek és okoknak pontosan egyezniük kell, ezért kézi módosítás vagy hamisított ok nem minősül elemzési eredménynek.
- **Core gate:** a `verifyModel` vizsgálja a befogadást, a referenciát, a keretalkalmasságot (legfeljebb 100 szomszédos csere 50 000 állapottal), a provenienciát, az elemzőverziót, az auditot, a fallbackeket és a szerzői szabályokat.
  - Státusz: `analysis-verified` / `conservative` / `author-modified` / `unverified`, `publishable` jelzővel.
  - Az állítások alapja `checked`, `tested`, `not-established` vagy `refuted`. A soundness mindig `tested`, soha nem modellenként bizonyított.
- **Bekötés:** a szerver minden draftnál újraszámolja, és a megbízható példáknál is rögzíti; a Pages helyben futtatja. Nem tilt, hanem minősít.
- **Tesztek:** [model-verification.test.mjs](tests/model-verification.test.mjs), és a Pages API-teszt is ellenőrzi.

## Unreleased – 2026-10-26 a referencia nyelvi auditja (ADR-016, epic R1)

- **Új, típusos auditor:** [reference-audit.ts](src/author/reference-audit.ts). Egyfájlos TypeScript `Program`-ot épít a szabványos könyvtárral, porton át. Eredménye: `ok`, `errors` (sorral és kóddal), `unverifiable` (feloldatlan modul vagy deklarálatlan globális; a modulokat listázza) vagy `not-run` (nincs könyvtár). A rögzített konfigurációt `assumptions` lista írja le.
- **Szerver:** minden befogadásnál futtatja, az `audit` mező a draftválasz része. A modellbe nem kerül, importból nem vehető át.
- **Pages:** könyvtár nélkül fut, ezért `not-run`.
- **CopyField:** `unverifiable`, 11 feloldatlan import.
- **Tesztek:** [reference-audit.test.mjs](tests/reference-audit.test.mjs), és a Pages API-teszt is ellenőrzi.

## Unreleased – 2026-10-26 bizonyítékkötés és elemzési környezet (ADR-015, epic C2)

- **Evidence:** új, additív `authoring.evidence` mező. Tartalma: a sorok `[id, code, scopeId]` digestje, a szabályverzió és az elemzési környezet (TypeScript-verzió, import-emit, script/modul, osztálymezőmód-függetlenség).
- **Kötött proveniencia:** a magyarázat csak akkor használja az okokat, ha a digest egyezik. Átírt sor, átszámozott azonosító, megváltozott scope vagy hiányzó evidence esetén `unbound`, és minden ok `legacy`. A `fixed` és a szabályok változtatása nem oldja a kötést.
- **Egyetlen definíció:** a digest csak a core-ban van ([evidence.ts](src/core/evidence.ts)); a projekció explicit architektúra-bekötéssel hívja. Az adapter új, opcionális `environment` metódusa adja a környezetet.
- **Refresh:** az újragenerált okokat az eredeti sorazonosítókra köti újra.
- **Minták:** a mintamodellek és a javított legacy JSON evidence-et kaptak.
- **Tesztek:** [evidence-binding.test.mjs](tests/evidence-binding.test.mjs).

## Unreleased – 2026-10-26 a formális szerződés hatóköre (A2)

- A helyességi cél hatóköre, a megfigyelhető állapot pontos definíciója (az orákulummal azonos), az A5 feltevés és a policyverziók táblázata ([formális szerződés](docs/formal-ordering-contract.md#a-helyességi-cél-hatóköre)).

## Unreleased – 2026-10-26 kényszer-proveniencia (ADR-014, epic C1)

- **Okok az elemzésben:** az `OrderingEntry` opcionális `reasons` mezőt kap. A JS/TS utasítás- és osztálytag-elemzés minden élhez kategóriát és kódot ad: kötésolvasás, RAW/WAR/WAW, barrier oka, globális lánc, kiértékelési fázis, reflektált kulcssorrend, komment, nem támogatott alak.
- **Okok a projekcióban:** a blokkzáró, a folytatósor, a klauzulalánc, a lezárás és az elhagyott blokk zárolása saját okot kap. A modellbe csak a redukció után megmaradt élek okai kerülnek.
- **Modell:** új, additív `authoring.provenance` mező (séma és típus, legfeljebb 10 000 elem). Nem értékelési szabály: a lefordított szabályok és az ítéletek nélküle is azonosak. A refresh az új okokat az eredeti sorazonosítókra képezi.
- **Core:** nyelvfüggetlen `explainConstraints(model)` ([constraint-explanation.ts](src/core/constraint-explanation.ts)). Soronként adja a közvetlen és tranzitív kényszereket, az okokat és a szerkeszthetőségi osztályt (`hard`, `proven`, `conservative`, `pedagogical`, `legacy`). A régi és importált modellek `legacy` jelölést kapnak.
- **Minták:** a TS-példatár modelljei és a [javított legacy JSON](docs/evaluate-legacy-serial.corrected.json) proveniencia-mezőt kaptak; a kézi `values-only` modell élei `author` kategóriájúak.
- **Tesztek:** [constraint-provenance.test.mjs](tests/constraint-provenance.test.mjs). Minden generált élnek ismert a kategóriája a korpuszon és a CopyFieldön; ide tartoznak a kategória- és szerkeszthetőségi esetek, a legacy, partial és stale proveniencia, a metamorf validációs teszt, a séma és a refresh-leképezés is.

## Unreleased – 2026-10-26 lokális írások, klauzulaláncok és importok (ADR-013, epic B szakasz)

- **Lokális írások:** az `x = e` (x ugyanabban a függvényben korábban deklarált `let`/`var`, e tiszta) már nem akadály. A tiszta és lokális író egységek szimbólumszintű olvasási és írási halmazt kapnak, él csak RAW/WAR/WAW konfliktusnál keletkezik. A P2 ennek megfelelően pontosítva, az orákulum saját, független implementációval követi.
- **Klauzulaláncok:** a `} else {`, `} catch {`, `} finally {` közös határ egy konténer szeparátorsorokkal, nem elhagyott és sorosított blokk. Minden sor a saját klauzulájában marad, a v3 határeseményes reprezentációval azonos nyelvvel.
- **Importok:** explicit `importEmit` kontextus (`verbatim` alapértelmezés, `elide-unused`). Az `import type` és a TS-emit által törölt import szabad; a modulbetöltő, a mellékhatás- és a JS-import kötött; dekorátoros fájlban konzervatív.
- **Migráció:** a projekció típusos modulba került ([code-line-projection.ts](src/author/code-line-projection.ts)), a JS/TS szerkezet a `js-ts-ordering.ts`-be. A `generator.mjs` csak belépési pont. Az architektúrakapu és a Pages-bekötés frissült.
- **`CopyFieldUtilityService`:** 8 → 0 elhagyott blokk, a 248↔249 csere elfogadott, a 305↔306 (`UUID()`) elutasított; az importok az emit szerint döntődnek el.
- **Mérés:** korpusz és 560 programos kampány: 0 hibás elfogadás; rések 2 072 → 1 959 (a függvényprogramokon −68%). [Részletek](docs/formal-ordering-contract.md#adr-013-lokális-írások-klauzulaláncok-és-importok).
- **Tesztek:** [import-ordering.test.mjs](tests/import-ordering.test.mjs), [local-write-ordering.test.mjs](tests/local-write-ordering.test.mjs), három `precision` korpuszfixture, frissített architektúra- és Pages-tesztek. A `20-shared-boundaries` TS-minta elvárása frissült: az ágon belüli két független konstans felcserélhető, az ágak közötti átlépés továbbra is elutasított. Policy-címke: additív `scoped-effect-analysis-v9`.

## Unreleased – 2026-10-26 osztálykiértékelési fázisok és accessorpárok (ADR-012)

- **Lazítás, a soundness megtartásával:** a generatív kampány réseinek osztályozása alapján, a ClassDefinitionEvaluation lépéseire épülő érveléssel ([ADR-012](docs/adr/012-class-evaluation-phases-and-accessor-pairs.md)):
  - **R1 – accessorpár:** az azonos nevű getter és setter egy tulajdonság. Egymással felcserélhetők, a mezőkhöz képest szabadok, a kulcsláncban egy csoportot alkotnak.
  - **R2 – fázisok:** a static mezők és blokkok, illetve a példánymezők egymáshoz képest szabadok, csoportjukon belül kötöttek.
  - **R3 – számított nevű metódus:** a mezőkhöz képest szabad, a kulcslánchoz és a többi számított kulcshoz képest kötött.
- **Szándékosan nem lazítva:** a szkriptszintű `let`/`var` (szövegből futtatott kód is írhatja), a duplikált nevek és az overload-szignatúrák sorrendje.
- **Policy-címke:** additív `scoped-effect-analysis-v8`; a szerzői magyarázat leírja az új szabályokat. A validátor és a séma jelentése változatlan.
- **Mérés:**
  - korpusz: 0 hibás elfogadás, az R7-rések száma 25 → 20, az R7 A(M) 2 042 → 3 706;
  - generatív kampány, 550 program, azonos magok és mintavevő: 0 hibás elfogadás, az indokolatlan elutasítások száma 3 524 → 2 455 (az osztályokon −42%).

  [Részletek](docs/formal-ordering-contract.md#adr-012-osztálykiértékelési-fázisok-és-accessorpárok).
- **Tesztek:** új [tests/class-phase-ordering.test.mjs](tests/class-phase-ordering.test.mjs), amely mindhárom szabályt JS-ben és TS-ben, mindkét osztálymező-módban, blokkmozgatásos soundness-ellenőrzéssel teszteli. A `refl-ts-accessor-fields` rögzített alapvonala frissült (rés 17 → 12).
- **Tesztsegéd:** az `extensions` mintavevő levágja a halott ágakat (blokk nyitása és zárása), mert a lazább modelleken néhány program exponenciális keresésbe futott. A teljes felsorolás eredménye változatlan.

## Unreleased – 2026-10-26 generatív lefedettség: osztályok, szkriptszint, TypeScript

- **Új generátormódok** ([random-programs.mjs](tests/support/random-programs.mjs)): `randomClassProgram` (felső szintű, öröklő és beágyazott osztályok minden tagfajtával, TS-ben `declare`, paramétertulajdonság, overload, `accessor`), valamint `randomScriptProgram` (szkriptszintű deklarációk, TS-ben `enum`, `namespace`, `import =`). A korábbi generátor csak egy függvénytörzs JS-kódját állította elő.
- **Blokkmozgatás** (`blockMoves`): minden utasítás és osztálytag egészben, a saját listáján belül minden más helyre. Ezt a többsoros mozgást az egysoros szomszédság nem fejezi ki.
- **Orákulum:** a beágyazott osztálydeklarációk futásidejű kulcs- és descriptor-pillanatképet kapnak, a probe lefutása után. Korábban ezekre csak a szintaktikus szabály vigyázott.
- **Tesztek:** a `check:all` 160 referencia lefutását ellenőrzi, és 36 rögzített magú programon mintavett, szomszédsági és blokkmozgatásos soundness-tesztet futtat; ehhez jön egy blokkmozgatás- és egy beágyazottosztály-regresszió.
- **Kézi kampány:** [tests/ordering-campaign.mjs](tests/ordering-campaign.mjs). Eredménye 550 programon és 410 371 sorrenden: **0 hibás elfogadás**, 0 eldöntetlen, 0 `indeterminate`. [Részletek](docs/formal-ordering-contract.md#generatív-lefedettség-osztályok-szkriptszint-typescript).
- **Production:** változatlan. A generátor, a validátor, a séma és a policy-címke sem változott; csak a tesztkód és a tesztorákulum bővült.

## Unreleased – 2026-10-26 felülvizsgálat: `accessor` mezők és TS-kibocsátott globálisok (ADR-010 kiegészítés)

- **Felülvizsgálat:** a WP1–WP8 utáni kódáttekintés két, a P4-et sértő hibás elfogadást talált, egyik alak sem szerepelt a korpuszban:
  - egy metódus átléphetett egy TS `accessor` mezőn, pedig az get/set párt hoz létre a prototípuson (static esetén a konstruktoron) a metódusok között;
  - egy szkriptszintű függvény átléphetett egy `enum`-on vagy egy példányosított `namespace`-en, pedig ezek `var`-ként globális tulajdonságok. Ezt az orákulum sem látta (közös vakfolt).
- **Javítás:** az `accessor` mező a kulcsláncba kerül; az `enum`, a példányosított `namespace` és az `import =` alias globális egység. A típus-only namespace szabad marad. Az orákulum a TS globálisokat a kibocsátott szkriptből olvassa. Részletek: [ADR-010 kiegészítés](docs/adr/010-reflective-property-order.md#kiegészítés-felülvizsgálat-utáni-javítás-scoped-effect-analysis-v7).
- **Policy-címke:** additív `scoped-effect-analysis-v7`. A validátor és a séma jelentése változatlan; az importált modellek nem generálódnak újra.
- **Tesztek:** két új reflexiós fixture (`refl-ts-accessor-fields`, `refl-ts-emitted-globals`), reprodukciók parserrel, teljes típusellenőrzéssel és mindkét emit-módban, tagblokk-permutáció. A `ts-enum` forgatókönyv probe-ja a globális kulcssorrendet is kiolvassa, ezért a „függvény az enum elé” változat indokolt elutasítás lett.
- **Mérés** (61 fixture, azonos orákulum mindkét oldalon): a hibás elfogadások száma a K45-ön 1 → 0, az R7-en 463 → 0. A completeness-rések száma változatlan, a K45 A(M) értéke 2 298 → 2 297. Az új elfogadott halmaz a régi részhalmaza, és minden eleme helyes. [Részletek](docs/formal-ordering-contract.md#v7-kiegészítés-accessor-mezők-és-ts-kibocsátott-globálisok).

## Unreleased – 2026-10-26 WP7 nyelvfüggetlen sorrendi határ és WP8 dokumentáció (ADR-011)

- **WP7:** új, nyelvfüggetlen [`ordering-relations.ts`](src/author/ordering-relations.ts) szerződés. Tartalma: `OrderingRelations`, konjunktív kombináció, valamint áthelyezve a lezárás és a tranzitív redukció.
  - A JS/TS-elemzést a [`js-ts-ordering.ts`](src/author/js-ts-ordering.ts) fogja össze, az adapter `orderingRelations` metódusán át.
  - A `generator.mjs` már csak projekció: nem importál TS-specifikus modult. Az architektúrakapu ezt gépileg tiltja; a korábbi két generátorkivétel megszűnt.
  - Viselkedésmegőrző: mind a 167 generált modell bájtra azonos (korpusz, 80 véletlen program, nagy referenciák, 24 TS-minta).
  - Új teszt: [`tests/ordering-relations.test.mjs`](tests/ordering-relations.test.mjs). Lefedi a konjunkciót, a lezárást, a redukciót, a diszjunkt sorokat és egy nem TypeScript-alapú játéknyelvi adapter projekcióját.
  - A Python szerkezeti feladatai dokumentálva, implementáció nélkül.
- **WP8:** a [formális szerződés](docs/formal-ordering-contract.md) új szakaszokat kapott:
  - végleges állapot;
  - a soundness és a completeness mérési jelentése;
  - konzervatív fallbackek;
  - a tesztorákulum bizonyítási határai;
  - P0–P4-re frissített helyességi állítás.

  A korábbi mérések történeti szakaszként maradnak meg.

## Unreleased – 2026-10-26 reflektálható tulajdonságsorrend (ADR-010)

- **Probléma:** az ADR-008 óta két különböző nevű osztálymetódus, illetve két szkriptszintű `function`/`var` cseréje elfogadott volt. Minden hívás eredménye azonos maradt, de az `Object.getOwnPropertyNames(C.prototype)`, a `Reflect.ownKeys(C)` és az `Object.keys(globalThis)` sorrendje megváltozott.
  - Ha maga a program reflektált, ez a régi politika szerint is hibás elfogadás volt.
  - Reprodukció JS-re és TS-re: parser, teljes strict típusellenőrzés és mindkét emit-mód külön ([tests/reflection-ordering.test.mjs](tests/reflection-ordering.test.mjs)); a régi kódon 8-ból 7 teszt elbukik.
- **Politika:** új P4-feltétel: a reflektálható kulcssorrend és a descriptor-fajta megőrzendő. A forrásszöveg-reflexió (`toString`, `stack`) explicit módon kizárt.
- **Author-javítás:**
  - **Kulcslánc a tagokra:** a kulcsot létrehozó metódusok és accessorok azonos objektumon (prototípus, illetve konstruktor) forrássorrendben maradnak.
  - **Szabad marad:** a `constructor`, a privát `#`, a tömbindex nevű és a törölt tag.
  - **Szkriptszint:** a szkriptszintű függvények és `var`-ok egy láncot alkotnak. Mérés szerint a V8 forrássorrendben hozza létre a globális tulajdonságokat.
- **Policy-címke:** additív `scoped-effect-analysis-v6`. A validátor és a séma jelentése változatlan.
- **Orákulum:** szintaktikus P4-szabály és futásidejű `Reflect.ownKeys`-pillanatkép, külön `reflection` okkal. A `policy: 'call-only'` a régi szemantikát adja vissza összehasonlításhoz; a mérőeszköz `--policy` kapcsolót kapott.
- **Mérés:** azonos, 59 fixture-ös készleten.
  - A reflexiós politika szerint a régi generátor 14 321 hibás elfogadása (a K45-ön 9 151) 0-ra csökkent.
  - A K45-en az elfogadott teljes sorrendek száma 11 449-ről 2 298-ra csökkent; ez pontosan a régi halmaz helyes része.
  - A szomszédsági rések száma változatlan.
- **Frissített elvárások, gyengítés nélkül:**
  - két forgatókönyv-probe a kulcssorrendet is kiolvassa, ezért két változat indokolt elutasítássá vált;
  - új, elfogadott változat igazolja, hogy a metódus a mezőkhöz képest szabad;
  - a policy-címke 4 helyen frissült;
  - a completeness-alapvonal frissült.

## Unreleased – 2026-10-25 WP6 sorrendi hibák javítása és mérés (ADR-009)

- Hat hibásan elfogadó hiba javítva, mindegyikre előbb reprodukáló fixture készült (`origin: 'wp6'`):
  - **Lezárás:** pozíciófüggetlen sor nem kerülhet többsoros utasítás, `} else {`/`} catch {` határú blokk vagy többsoros mező belsejébe ([generator.mjs](src/author/generator.mjs)).
  - **Overload-csoport:** a TS overload-csoport egyetlen egység.
  - **Tisztaság:** nem tiszta az önhivatkozó inicializáló, a más függvénykontextusból olvasott `let`/`const`/osztály és a `case`-ágbeli kötés olvasása.
- Teljességi javítások:
  - a constructor ténylegesen szabad (névfeloldási hiba), a paramétertulajdonságokkal együtt;
  - a `declare` mező szabad;
  - a soha újra nem írt `let`/`var` függvénykontextusban `const`-ként primitív operandus (írási halmazok).
- Új, additív policy-címke: `scoped-effect-analysis-v5`. A `TypeMemberOrdering.spans` a generátornak adja az egységhatárokat. Az orákulum P0-ja ellenőrzi a TS overload-szomszédosságot.
- **Mérés:** a HEAD kódjával összevetve, ugyanazon az 54 fixture-ös készleten.
  - Hibás elfogadás: 81 → 0.
  - Completeness-rés az eredeti 45 fixture-ön: 28 → 6.
  - Elfogadott teljes sorrend: 5 100 → 11 449, mind orákulummal ellenőrizve.
  - Részletek és a nagy referenciák: [formális szerződés](docs/formal-ordering-contract.md#wp6-javítás-mérés-és-regresszióvédelem).
- **Új tesztek:**
  - `tests/wp6-regressions.test.mjs`;
  - `tests/ordering-scale.test.mjs`;
  - kiterjesztett véletlen programok;
  - a mérőeszköz új mérőszámai: nem támogatott esetek, redundáns élarány, nagy referenciák.
- **Frissített elvárások, gyengítés nélkül:**
  - a policy-címke 4 helyen;
  - a scope-mátrix `declare` változata most `accepted` (orákulum szerint ekvivalens);
  - a UserAccount-teszt megengedett halmaza a constructor mögé kerülő mezővel bővült (mindkét mezőmódban futásidőben ellenőrizve);
  - a rögzített completeness-alapvonal.

## Unreleased – 2026-10-25 WP5 szemantikai regressziók és sorvégkezelés

- `tests/semantic-corpus.test.mjs`: a 45 fixture-ös korpusz feltétlen soundness-ellenőrzése, fixture-enként rögzített completeness-alapvonallal (`tests/fixtures/ordering-baseline.json`) és negatív kontrollokkal. `tests/ordering-properties.test.mjs`: 24 360 elrendezéses kimerítő Π(T) független tanúellenőrzéssel, 30 seeded véletlen program, átnevezési/újrabehúzási/ID-csere metamorf relációk és keretkonzisztencia. Hibás elfogadás: 0.
- `.gitattributes`: LF az indexben és minden munkakönyvtárban (CRLF csak .bat/.cmd), bináris eszközök jelölve; a `sync-vendor` LF-fel másolja a CRLF-es upstream licenceket. Megszűnnek a build utáni fantom-módosítások.

## Unreleased – 2026-10-25 hatásösszegzésen alapuló sorrendelemzés (ADR-008)

- A `statement-ordering.mjs` strict TypeScriptre migrált ([src/author/statement-ordering.ts](src/author/statement-ordering.ts)): egységenkénti pure / position-free / barrier / opaque osztály indokkal, kötésolvasás paraméterekre, ciklus- és `catch`-változókra, friss literálok, closure-ök, hoistolt függvény- és törölt típusdeklarációk, osztálydefiníciók; osztálymetódusok JS-ben is szabadok. `eval` és `using` konzervatív. Új additív `dependencyPolicy`: `scoped-effect-analysis-v4`. Független pedagógiai-politikai orákulum ([tests/support/semantic-oracle.mjs](tests/support/semantic-oracle.mjs)) és 45 fixture-ös korpusz: hibás elfogadás 0 → 0, egyenértékű de elutasított szomszédos elrendezés 103 → 30. Formális szerződés: [docs/formal-ordering-contract.md](docs/formal-ordering-contract.md).

## Unreleased – 2026-10-25 összetett példák és scope-mátrix

- Bal oldali feladatkönyvtár: a `sum-js`, `sum-ts` és `dependencies-js` helyett négy összetett feladat (BFS rácson, beszúrásos rendezés + bináris keresés, absztrakt osztály + öröklés, interface + generikus osztály). A régi modellek tesztfixtúraként változatlanul futnak (`tests/fixtures/legacy-examples/`). Új `tests/complex-scope-ordering.test.mjs`: 15 JS/TS forgatókönyv, 73 elnevezett változat, teljes egysoros-áthelyezési/páros-csere söprés és a könyvtári modellek összes lineáris kiterjesztése futási orákulummal. Eredmény: nincs hibás elfogadás; 21 ismert konzervatív korlát dokumentálva ([docs/complex-scope-ordering.md](docs/complex-scope-ordering.md)). A Pages-tesztek a szállított példák számát az `examples/` mappából veszik.

## Unreleased – 2026-10-24 audit

- TypeScript member-ordering: az egyszerű, külön nevű, törölt típusmezők indokolatlan soros kötése javítva strict TS author-projekcióval. A rendes class mezők és this-értékadások megfigyelhető sorrendje megmarad. Új policy-magyarázat, 24 letölthető source/model pár, teljes kis permutációs és Node/Pages böngészős mátrix, strict fixture-typecheck és generált példatár-CI kapu. [UserAccount-elemzés](docs/typescript-ordering-analysis.md), ADR-007.

- Lezáró ág-/PR-review és fejlesztési összegzés: a korábbi három fejlesztési ág már a main történetében; a Python könyvtári szelet és a review-javítások külön beolvasztási kapuval. ADR-004 pontosítva az explicit függőségfrissítésről; a teljes Python-adapter és termékintegráció továbbra is nyitott. [Összegzés](docs/development-summary-and-integration.md).

- Teljes fejlesztési review: natív IR teljes fizikai forráslefedése, ritkás renderjavaslat elutasítása, Python loaderhiba utáni újrapróbálás és nagy AST erőforrás-diagnosztika javítva. A szerzői guard már a fájl-/clipboard-/hálózati I/O előtt rögzül; késői JSON/session-import nem ír felül újabb referenciát. A dokumentáció parser/adapterszelet-státuszai egységesítve. [Review és bizonyíték](docs/review-language-engine-python.md).
- Régi v2 soros modellekhez explicit Sorfüggőségek újraszámítása: typed author port, Node/Pages admission, megmaradó ID/kód/fixed/kézi élek/profilok és kompatibilis kitöltés. A képi evaluate-eset 5040 permutációs regresszióval, API- és böngészős tesztekkel, javított JSON-nal dokumentált. Normál import és learner validáció változatlan.

- A mainre zárt alapok után megkezdett Python-integráció: pinned Pyodide 314.0.7 / CPython 3.14.2 author parserport, izolált process/worker, strict DTO, cancel/timeout/restart, hash/licenc artifactkapu és 58 esetes Node/Chromium korpusz (+27 generált kombináció). Teljes Python IR-adapter, UI és release továbbra is nyitott; [pontos státusz](docs/python-parser-platform.md).

- Részletes Python-adapter integrációs terv: PY-01–PY-11 taskok, parser/platform döntési kapu, IR-leképezés, verziózott termékintegráció és tesztmátrix. Ebben a tervcommitban Python-adapter még nincs implementálva.

- Referencia-/próbamunkafolyamat javítása: a kézzel gépelt referencia megmarad, feladatonként külön source/JSON draft, egyértelmű Referenciaforrás/Megoldáskód nézetek és pending jelzések, explicit rendezőből újratöltés, késői admission elleni védelem. Strict TS workspace-politika, ADR-004 és Node/Pages böngészős regressziók.

- Language IR v1 és opt-in CodeLine v3 alap: fizikai source span, atomi többsoros unit, külön syntactic container/binding scope, virtuális határesemények, indent policy. Ugyanaz a bounded bijekciós validátor, strict TS adapterregiszter, JS/TS v2 bridge, gráfmentes render port, Schema-/permutációs-/adapter-/Chromium-contract tesztek és CI generáltkód-kapu. V2 UI, API, importált szabályok és governance megőrizve. Python parser/adapter és v3 termékintegráció nyitott; [terv és állapot](docs/language-engine-migration.md).

- Unicode whitespace előtagok tartalommegőrzése a live formatterben: csak ASCII szóköz/tab normalizálható, a validátor szerződésével egyezően.
- Kiadás előtti review: fixed pozíció közvetlen korláttal, implicit oldalkorlát nélkül; késői formázási és hibás kiértékelési válaszok nem írnak felül újabb munkát. Új üzleti/technikai szerződés és ADR-002.
- Munkafolyamat-központú UI/UX: forrás-/JSON-belépés, forrásfájl-betöltés, külön tanulói preview, megmaradó editor-draftok, hozzáférhető tabs/shortcut/fókusz/busy és mobilfelület; új megjelenítési források strict natív TypeScriptben.
- AI governance, AGENTS, Ousterhout-alapú döntéstulajdonosok és TS-migrációs ADR; natív TS architektúrakapu import-/strictness-/végrehajtási korlátokkal, generált forrásgazdákkal és negatív regressziókkal.

- Scope-onként kompozicionális függőséggenerálás: külső konstanskötések, beágyazott egységek és adat-/vezérlési korlátok; 5040 képi sorpermutációs JS-orákulum, háromszintű regressziók és korai prefix-scope-ellenőrzés az azonos kapcsos zárójelek miatti kereséshez.

- Kötésalapú részleges sorrend az egyszerű primitív const deklarációk között; állandó ID-alapú függőségek, opcionális sourceLine és szerver által számított matchedTokenIds megfeleltetés, szerzői/kiértékelési táblázatokkal. A meglévő modellek szabályai megmaradnak.

- Natív drag-and-drop javítása minden példánál: a böngésző által küldött pointercancel nem törli többé a natív húzást; 36 valódi Node/Pages böngészős regressziós eset.

- Indítási portütközés javítása: implicit alapportnál korlátos fallback, explicit PORT-nál olvasható hiba; más alkalmazás folyamatát nem állítjuk le.

- TASK-19: másolás/beillesztés a szerzői forráshoz, JSON-modellhez, megoldásszerkesztőhöz és rendezőhöz; forrássor-másolás, hibavisszajelzés és fixed-védelem.

- Regex-, komment-, string- és template-tudatos, öt szóközös toleráns behúzás; exact és nyers literálsorok védelme.
- Valódi JS Beautify összehasonlító regresszió, helyi assetek és kontrollált lexikai fallback.
- AST-alapú JS/TS blokkhierarchia; globális struktúravesztés helyett dokumentált intervallumfallback.
- Külön szerzői szintaktikai referenciaaudit, JS-specifikus Acorn parser és működő nyelvi adapterregiszter.
- Egyetlen JSON Schemából generált runtime-ellenőrző; duplikált függőségek, integritás és erőforráskorlátok egységesítése.
- Hatékonyabb fixed-horgonyélek és referenciasor-indexelés; megőrzött bounded search és indeterminate.
- Natív, pointeres, touch és billentyűzetes beszúrás; fókusz/státuszüzenet és animációközi célzás javítása.
- Explicit Local Demo / Preview / Trusted Server validációs módok.
- Modell- és munkamenet-export/import, kézi helyi mentés, szigorú próbálkozásintegritás.
- Bővíthető mezőregiszter, külön szerzői életciklus és persistence, egységes CSS.
- Hordozható HTTP/Pages Playwright-mátrix és egyszeri verify → ellenőrzött artifact → deploy CI-lánc.
- UTF-8 README, helyes repository/Pages útvonalak, pontos tesztállítások és megőrzött harmadikfél-licencek.

A helyi audit lezárásakor távoli push, release és deployment nem történt; a később külön kért kiadási szakasz nyoma a Git/GitHub történetben követhető. Projektlicenc választása továbbra is tulajdonosi döntés.
