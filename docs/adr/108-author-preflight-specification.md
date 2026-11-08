# ADR-108 – Szerzői preflight: két kapu, konfigurációfeloldó, bizonyossági szintek (specifikáció, E0)

Állapot: **elfogadva** (2026-11-07). A felhasználó átadta a „konfigurálható forrás- és modellvalidáció” architekturális tervét (`developer-exercise-preflight-terv-2026-11-07.md`, alapja a `34a9bf6` commit), és kérte, hogy a jelenlegi feladatok elé ütemezzük és hajtsuk végre. Ez az ADR a terv **E0** szakasza: rögzíti a mért kiindulási állapotot, az elfogadott invariánsokat, a státuszpolitikát, és azt, ahol a megvalósítás indokkal eltér a tervtől. Kockázati osztály: szerzői elemzés (befogadás); a tanulói értékelés nem változik.

## A terv állításainak ellenőrzése a kódon (`0a13c44`)

| Állítás | Eredmény |
| --- | --- |
| A szerzői modell nyelvi hiba (`audit: errors`) mellett is elkészül | **igaz**: `catalog.mjs` `compile` a generálás után auditál, és a draftot az eredménytől függetlenül tárolja; a publikálást az ADR-035 külön védi |
| A lépéskapu csak a modell meglétét nézi | **igaz**: `flow.ts` `blockedReason` = van-e előnézeti draft |
| A Pages nyelvi auditja `not-run` | **igaz**: standard könyvtár nélkül az auditor `not-run`-t ad |
| Új draft alapértékei és a generátor fallbackje különbözik | **igaz**: `NEW_DRAFT_SETTINGS` = valid/ignored/define (ADR-106), a generátor és a régi modellek fallbackje any/observed/either |

**Mérés: mit lát ma a fordító a terv TDZ-korpuszából** (single-file, ES2022, a jelenlegi auditbeállítással; JS-re külön `checkJs`-szel is):

| Eset | TS (ma) | JS (ma, checkJs nélkül) | JS checkJs-szel |
| --- | --- | --- | --- |
| `console.log(x); const x=1;` | 2448 | – | 2448 |
| `typeof x; let x=1;` | 2448 | – | 2448 |
| `const x=1; { console.log(x); let x=2; }` | 2448 | – | 2448 |
| `class A extends B{} class B{}` | 2449 | – | 2449 |
| `const f=()=>x; f(); const x=1;` | – | – | – |
| `function g(){return x} let x=1; g();` (helyes) | – | – | – |
| `if (false) { console.log(x); } let x=1;` (**futáskor nem hibás**) | 2448 | – | 2448 |

Következtetés:
- A TypeScriptben ezek a kódok fordítási hibák, tehát biztos **nyelvi** hibák.
- JavaScriptben ugyanez a jelzés csak *lehetséges* futási hiba. Az elérhetetlen ágban a fordító is jelez, a futás viszont nem hibázik.
- A lezárón keresztüli korai hívást egyik nyelven sem jelzi a fordító; ez saját elemzést kíván (E3).

## Döntés

1. **Elfogadott invariánsok** (a terv 0. fejezete):
   - **Két kapu, minden útvonalon:** a Forrás → Szabályok (G1) és a Szabályok → Próba (G2) átmenet egy központi, szerveroldali, illetve Local Demo-beli kapun megy át.
   - **Nincs futtatás:** nem bízható forrást nem futtatunk; futtatásos orákulum csak rögzített tesztszerelvényen (AGENTS.md).
   - **Az ismeretlen nem siker:** `unknown`, `not-run` és `budget-exceeded` soha nem lesz `passed`.
     - A `passed` jelentése: a támogatott képességhatáron belül nincs kimutatott hiba.
     - Nem jelent teljes futásbiztonságot.
   - **A bizonyíték kötött:** a forráshoz, a modellhez, az elemző és a fordító verziójához, valamint a konfigurációhoz. Bármelyik változása érvényteleníti.
   - **Régi modellek:** nem változnak csendben; új policy alatt újra kell minősíteni őket.
   - **A tanulói út érintetlen:** a beküldött megoldást továbbra sem elemezzük és nem futtatjuk.
2. **Bizonyossági szintek:** `definite`, `possible` és `unknown`, eredettel együtt (`compiler`, `runtime-order`, `pedagogy`, `model`, `environment`).
   - **`definite`:**
     - a TypeScript-forrás fordítási hibája;
     - JS-ben a meglévő binding- és nyelvtani hiba (újradeklarálás, szintaxis);
     - saját elemzés eredménye csak akkor, ha a korpuszon 0 hamis pozitívval igazolt.
   - **`possible`:** a JS-forrásban a fordító TDZ-jelzése (lásd az elérhetetlen ág ellenpéldáját) mindaddig, amíg az E3 elemzése a vezérlésfolyam alapján nem igazolja.
3. **Kapudöntés:** `passed`, `blocked`, `ack-required` vagy `inconclusive`.
   - **A biztos hiba mindig blokkol.** Ez nem kapcsolható ki (`blockDefiniteErrors` kötelező szerzői policy, nem kapcsoló).
   - **A `possible` és az `unknown`** kezelését az `unknownPolicy` szabja meg: `warn`, `require-ack` vagy `block`; alapértéke `warn`.
   - **Külön `legacy-preview` mód nem készül**, amíg konkrét igény nem jelentkezik.
4. **Konfiguráció három szinten:**
   - **forrásszerződés:** a meglévő `inputs`, `keyOrder`, `classFields` és `importEmit`;
   - **elemzési policy;**
   - **befogadási policy.**

   A konfigurációfeloldó ezekből adja a `requested`, `effective`, `locks` és `conflicts` mezőt és egy ujjlenyomatot. Egy kapcsoló egy döntés; a profil csak preset.
5. **Feliratok:** a felületen az „alapértelmezett” felirat helyett „új feladat kezdőértéke”, illetve „régi modellek kompatibilitási értéke” áll (E7).

## Eltérések a tervtől, indokkal

1. **Sorrend:** E0 → E1 → **E5a** (G1 a már meglévő biztos hibákkal) → E2 → E3 → E4 → E6 → E7 → E8 → E9–E10.
   - **Indok:** a biztos nyelvi hibák ma is ismertek (audit `errors`), csak nem blokkolnak. A korai G1 azonnal érvényesíti az 1. döntést.
   - **Hogyan épül tovább:** a később érkező elemzők (E2–E4) ugyanabba a kapuba táplálnak.
   - **Amit a terv mond:** a G1 az E3–E4 után következne, addig a hibás referenciák továbbra is átjutnának.
2. **Csak megvalósított kapcsoló látszik.**
   - **A szabály:** az E1 regisztere minden kapcsolóhoz rögzíti, hogy van-e mögötte elemző. A felület és az API csak a megvalósítottakat fogadja; egy még elemző nélküli kapcsoló 422-es hibát kap.
   - **Indok:** az AGENTS.md tiltja, hogy nem létező képességet megvalósítottként mutassunk; egy hatás nélküli kapcsoló ilyen.
   - **Amit a terv mond:** a tíz új kapcsoló egyszerre jelenne meg.
3. **A fordító TDZ-jelzése JS-ben `possible`, nem `definite`** (2. döntés, mért ellenpélda).
   - **A tervben:** a „0 hamis pozitív biztos hibára” küszöb.
   - **Miért:** ez enélkül sérülne.
4. **Egyetlen tulajdonos számol.**
   - **A szabály:** a feloldó a szerzői elemzés része (`src/author/preflight`), és a válaszban adja vissza a feloldást a felületnek.
   - **A Pages:** ugyanazt a modult futtatja a böngészőben.
   - **Amit a terv mond:** a frontend és a backend ugyanazt számolja.
   - **Indok:** így a frontend nem tartja külön a szabályokat (AGENTS.md: ne duplikáljuk a szabályt a nézetben).

## Megvalósítás

**E1 – konfigurációfeloldó** ([config-resolver.ts](../../src/author/preflight/config-resolver.ts)):
- **Bemenet:** a `resolveAuthorPolicy` tiszta függvény.
  - A forrásszerződés négy beállítása a kérés felső szintjén marad.
  - Az új beállítások a `policy` objektumban vannak: `portability` (`configured` vagy `conservative`) és `unknownPolicy` (`warn` vagy `block`).
- **Kimenet:** `requested`, `effective`, `locks`, `inactive`, `conflicts` és egy `p1-…` ujjlenyomat (FNV-1a, 64 bit, a hatályos policy kanonikus szövegén; azonosító, nem jogosultság).
- **Szabályok:**
  - **C01–C04:** a konzervatív preset zárolja a négy beállítást, indokkal, a kért értéket megőrizve;
  - **C12:** a TypeScript-only `importEmit` JavaScriptnél inaktív, és nem jut a generátorhoz;
  - **C33:** érvénytelen érték, ismeretlen vagy még nem megvalósított kapcsoló (például `tsDiagnostics`, `jsCheck`, `bindingSafety`), valamint a még tudomásulvételi folyamat nélküli `require-ack` blokkoló ütközés.
- **Bekötés:** a szerver `createDraft` és a Pages `compileDraft` ugyanezt a modult hívja.
  - Az elutasítás strukturált 422: `{error, policy}`.
  - A befogadott draft válasza tartalmazza a feloldást.

**E5a – korai első kapu** ([source-gate.ts](../../src/author/preflight/source-gate.ts)):
- **Helye:**
  - a generátor saját elemzése és mélységkorlátja (ADR-103) után, a befogadás előtt;
  - a szerző forrásán, így a szerkesztő sorszámával; importált modellnél és függőségfrissítésnél a sorokból összerakott forráson.
- **Döntések:**
  - **biztos nyelvi hiba** (TypeScript-fordítási hiba, köztük a TDZ: TS2448 és TS2449) → `blocked`, 422; nem készül draft, a korábbi modell marad;
  - **`unverifiable` vagy `not-run`** → `inconclusive`, `warn` mellett továbbenged figyelmeztetéssel, `block` mellett megállít azzal, hogy ez nem jelent hibás forrást;
  - **csak a tiszta audit** `passed`.
- **Pages:** az audit ott `not-run`, ezért a kapu `inconclusive`; a Local Demo így nem állítja, hogy ellenőrzött.
- **Szándékos viselkedésváltozás:**
  - a nyelvi hibás TypeScript-referencia már nem kap előnézetet (eddig `audit: errors` mellett kapott);
  - a mintakatalógus szándékos hibaesete (`13-duplicate-names`, TS2300) szerveren elutasítva, a Pages-en `inconclusive`;
  - a JavaScript-újradeklarálást a generátor elemzője már a kapu előtt elutasítja (400).

**E2 – az audit paraméterezése** ([reference-audit.ts](../../src/author/reference-audit.ts), `AuditMode`):
- **`tsDiagnostics: 'strict'`** (csak TypeScript, a `policy` objektumban):
  - a `strict` családdal fordít; ez együtt kapcsolja a `strictNullChecks`, `noImplicitAny`, `strictPropertyInitialization` stb. beállítást (C17: nincs külön mezőnkénti kapcsoló);
  - mivel a szerző kijelentette, hogy a buildje szigorú, a hibái biztos fordítási hibák, és az első kapu blokkol;
  - a feltevések között `strict` szerepel, nem `non-strict`.
- **`jsCheck: 'on'`** (csak JavaScript): `checkJs` típusellenőrzés.
  - A JavaScript a típusellenőrző véleményétől függetlenül lefut, ezért ami *csak* a típusellenőrzésben jelentkezik, az `possible`.
  - Ami a binding- és nyelvtani menetben is megjelenik (például újradeklarálás), `definite` marad. A két futás eredményét pozíció és kód alapján vetjük össze.
  - A JS TDZ-jelzése (TS2448) itt `possible`, ahogy a 2. döntés kimondja.
- **Ellenpélda a `checkJs` korlátjára:** az `o.b = 2` JavaScriptben új tulajdonság deklarációja (expando), ezért ott sincs találat. A felület nem ígérhet ennél többet.
- **Kapu:** a `possible` találat `inconclusive`; `warn` mellett továbbenged, `block` mellett megállít.
- **Hatókör:** mindkét beállítás nyelvhez kötött (C14, C15: a másik nyelvnél inaktív, és nem szerepel az ujjlenyomatban). Standard könyvtár nélkül (Pages) mindkét mód `not-run` (C16).
- **Mérés** (`createDraft` medián, 5 futás, a katalógus leghosszabb mintái):

  | Minta | Alapmód | Bekapcsolt mód |
  | --- | --- | --- |
  | `algo-sort-search-js` (29 sor) | 46 ms | 45 ms (`jsCheck: 'on'`) |
  | `class-inventory-ts` (34 sor) | 35 ms | 33 ms (`tsDiagnostics: 'strict'`) |

  A katalógus mintái mindkét szigorúbb módban átmennek.
- **Bizonyíték:** `tests/audit-modes.test.mjs`.

**E3 – kötés- és TDZ-biztonság** ([binding-safety.ts](../../src/author/preflight/binding-safety.ts)):
- **Mit talál:** a `let`, `const` vagy `class` kötéshez az inicializálás előtt történő hozzáférést (TDZ, futáskor ReferenceError), de **csak a biztos esetet**. ~~Biztos az, amelyik minden olyan futásban bekövetkezik, amely eléri a blokkját.~~ Pontosítva (E4): biztos az, amelyik bekövetkezik, ha a tartalmazó utasítás lefut.
  - **Kötés:** a fordító szimbólumfeloldása azonosítja, így az árnyékolás helyes, és a típuspozíció nem számít.
  - **Feltétel nélküli út a deklaráció blokkjáig:** átlátszó szerkezetek engedélylistája. Feltételesnek számít minden más:
    - függvényhatár, `if`- és `switch`-ág, ciklustörzs, `try`;
    - a `&&`, `||`, `??` jobb oldala;
    - a `?.` utáni rész;
    - destrukturáló alapértelmezett érték.
  - **Elérhetőség:** feltétel nélküli `return`, `throw`, `break` vagy `continue` után nem.
  - **Sorrend:** a hozzáférés megelőzi a deklarációt, vagy a saját, illetve egy korábbi deklarátor inicializálójában, vagy az osztály `extends` részében van.
  - **Hívásút (BS002):**
    - csak olyan hívás számít, amelynek hívottja biztos: újra nem értékadott `function`-deklaráció, a hívás előtt deklarált `const` függvénykifejezés, vagy azonnal hívott függvény;
    - legfeljebb 8 hívás mélységig;
    - a deklarációt tartalmazó függvény (a rekurziót is beleértve) minden hívásra új kötést hoz létre, ezért a hívásút oda nem vezet. Ezt a valós korpusz egy hamis pozitívja (`fib-memo-js`) mutatta meg, és javítottuk.
- **Nem vizsgált** (szándékosan csendes, nem `passed` értelmű bizonyíték): metódushívás (`o.m()`), konstruktor és osztálymező, `switch`-ágbeli deklaráció, ciklus első köre, `try` blokk. Ezek a tervezett E4 (vezérlésfolyam) körébe tartoznak.
- **Kapu:** a biztos találat blokkol.
  - Nem kell hozzá standard könyvtár, tehát a Pages-en is blokkol.
  - TypeScriptben a fordító azonos sorú TS2448/2449/2450 jelzése marad (nincs dupla jelzés). JavaScriptben a `checkJs` „lehetséges” TDZ-jelzését a biztos találat váltja fel (C35).
  - Költségkeret: 400 000 lépés; túllépéskor `budget-exceeded`, ami `inconclusive`.
- **Mérés:**
  - a repó 482 valódi programja (katalógus, mintatár, orákulum-korpusz és -generátorok) egy jelzést ad: a `wp6-self-referential-initializer` szándékos `const broken = broken;` sorát (valódi találat);
  - programonként átlagosan kb. 1,3 ms, legfeljebb 18 ms.
- **Bizonyíték:** `tests/binding-safety.test.mjs`:
  - a 35 eset táblázata (17 biztos hiba, 18 kötelező hallgatás, köztük az elérhetetlen ág, a `try`, a rövidzár, a feltételes hívás, az újraértékelt hívott, az árnyékoló paraméter, a rekurzió);
  - a zéró hamis pozitív korpuszpróba;
  - a kapu viselkedése;
  - a szerveres 422 a hívás sorával.

**E4 – vezérlésfolyam és helyi objektumállapot** ([flow-paths.ts](../../src/author/preflight/flow-paths.ts), [object-state.ts](../../src/author/preflight/object-state.ts), [runtime-safety.ts](../../src/author/preflight/runtime-safety.ts)):
- **Egy gazda a „biztosan lefut-e” kérdésnek:** a `flow-paths.ts` adja egy programra a szimbólumokat, az írásokat, az átlátszó utakat és a `mustEvaluate` választ. Ezt a TDZ-elemzés (E3) és az objektumállapot-elemzés közösen használja.
  - **Ágak összekapcsolása:** az `if/else` mindkét ága együtt biztos, ha mindkettő biztosan kiértékeli a keresett csomópontot.
  - **Egyszer lefutó ciklus:** a `do … while`, a `while (true)` és a `for (…;;…)` első menete számít.
  - **Kilépés:** egy utasítás után csak akkor folytatódik a biztos út, ha semmilyen úton nem léphet ki (`return`, `throw`, `break` vagy `continue` a beágyazott függvényeken kívül).
- **Az E3 definíciójának javítása:**
  - **A pontos definíció:** „ha a hozzáférést tartalmazó utasítás lefut, a hiba biztosan bekövetkezik”. A korábbi szöveg („minden futásban, amely eléri a blokkját”) pontatlan volt, mert egy korábbi feltételes `return` után a blokk utasítása kimaradhat.
  - **Két hamis pozitív kockázat:** az új szabály megszüntette őket. Ezeket csak az utasítás nélküli kilépést figyelő E3-változat jelezte volna:
    - a hívott függvényben feltételes `return` előzi meg a hozzáférést;
    - beágyazott blokkban ugyanez történik.
  - **Bizonyíték:** mindkettőt teszt rögzíti.
- **Helyi objektumállapot** (`objectState: local`, a terv szerint alapértelmezett; `off` kikapcsolja):
  - **OS001:** tagelérés, hívás, `new`, destrukturálás, `for…of` vagy tömbbe szórás olyan kötésen, amely ott biztosan `null` vagy `undefined` (`let o;`, `= null`, `= undefined`, `= void …`; az árnyékolt `undefined` nem számít).
  - **OS002:** biztosan nem hívható literál (szám, szöveg, logikai érték, objektum, tömb, reguláris kifejezés) hívása vagy `new`-ja.
  - **Az érték csak az első írásig ismert:** ha bármelyik függvény írja a kötést, kimarad, mert egy hívás bármikor megváltoztathatja. Az `?.` soha, az objektumba szórás (`{...null}`) nem hiba.
- **Nincs `controlFlow` kapcsoló:** a terv `basic`/`interprocedural` kapcsolója helyett a biztos-út elemzés pontosítás, nem policy. A hívásláncot (legfeljebb 8 szint) mindig követi, és a csend nem bizonyíték (ADR-108, 2. eltérés).
- **Kapu:** a futásidejű találat akkor sem ismétlődik, ha ugyanazon a soron a fordítónak biztos jelzése van (például TS2349 „nem hívható”), mert a fordító jelzése marad az egyetlen (C35).
- **Mérés:**
  - az E4-korpusz 31 esete pontos;
  - a 482 valós programon a két elemzés együtt is csak a szándékos `const broken = broken;` sort jelzi;
  - programonként átlagosan 1,3 ms, legfeljebb 28,6 ms.
- **Nem vizsgált** (csend, nem bizonyíték): mezőszintű objektumállapot (`o.a.b`), metódus- és konstruktorhívás, `switch`-ágak, `try`, osztályinicializálás sorrendje.
- **Bizonyíték:** `tests/runtime-safety.test.mjs`.

**E6 – második kapu, Szabályok → Próba** ([rules-gate.ts](../../src/author/preflight/rules-gate.ts), [fingerprint.ts](../../src/author/preflight/fingerprint.ts)):
- **Pillanatkép:** minden draft eltárolja az első kapu pillanatképét: a forrás ujjlenyomatát, a hatályos policyt és az első kapu döntését. A szabályszerkesztés ezt átviszi az új draftra (ugyanaz a forrás és policy), a Próba-belépést viszont nem (C28).
- **Átmenet** (`POST /api/author/transition`; a Pages-en `authorTransition`): a kliens a *jelenlegi* forrását és beállításait küldi.
  - **Blokkol:**
    - ha nincs pillanatkép;
    - ha a forrás vagy a policy ujjlenyomata eltér, mert akkor a bizonyíték elavult, és a modellt újra kell készíteni (C26, C36);
    - ha az első kapu nem engedte tovább;
    - ha a modell elutasítja a saját referenciasorrendjét.
  - **Nem eldönthető:**
    - ha a referencia elfogadása nem dőlt el;
    - ha a modell `unverified`, például egy felülírt bizonyított szabály miatt (C29);
    - ha az első kapu is ilyen volt (Pages).

    Ez `warn` mellett figyelmeztetéssel enged, `block` mellett megállít.
  - **Igazolás:** a sikeres átmenet a forrás, a policy és a modell ujjlenyomatát, az elemzőverziót (szabályverzió és TypeScript) és a minősítést rögzíti.
- **Backend-döntés:** az előnézeti értékelést (a Próba lépés tényleges művelete) a szerver és a Pages is megtagadja (409) attól a drafttól, amely nem ment át a második kapun. Közvetlen API-hívással sem kerülhető meg.
- **Az előnézet maga is kapu:** ha az előnézeti kérés a szerző jelenlegi forrását és beállításait is hozza, és a draft még nem ment át, a szerver (és a Pages) ugyanazzal a döntéssel engedi át vagy utasítja el (422). Bizonyíték nélkül marad a 409.
  - **Miért:** a szabályszerkesztés új draftot ad, ezért külön átmenettel minden szerkesztés három kérés lett volna (szerkesztés, átmenet, előnézet). A böngészős tesztsor gyors szerkesztései így túllépték a szerver percenkénti 120 POST-os korlátját (429).
  - **Most:** a szerkesztés utáni újraértékelés és az ellenőrzés egy kéréssel jár, mint E6 előtt. A korlátot nem emeltem.
- **Felület:**
  - **A lépésváltás és az import „landolása”:** egy út, a [flow.ts](../../src/workbench/flow.ts) `tryAdmission` függvénye. Nem kérdezi a szervert.
    - Minden draft-válasz (modellkészítés, szabályszerkesztés) magával hozza a második kapu döntését a saját forrására és policyjára (`tryGate`, `tryReadiness`). Ez ugyanaz a döntés, mint az átmeneté, csak elavultság-ellenőrzés nélkül.
    - Az elavultságot a kliens tudja: a forrás vagy a beállítások kulcsa eltér attól, amiből a modell készült. A cím, a leírás és a szint nem számít bele, ahogy az ujjlenyomatba sem.
    - Döntés nélküli draft zárva marad.
    - **Miért nem kérdez a navigáció:** az E6 első változata minden új draftnál külön átmenet-kérést küldött. A böngészős workbench-sor így egy perc alatt 118 POST-ot küldött, a szerver korlátja 120. A gyorsabb CI-gépen ez 429-et adott, és a modellkészítés vagy a Próba nem nyílt meg (ez buktatta az E6 és az E7 CI-futását).
      - A korlát emelését vagy a tesztszerver kivételezését elvetettem, mert az elfedte volna, hogy a navigáció fölösleges szerverkérés.
      - Most a teljes fájl 109 POST-ot küld (csúcs 92/perc), és a teszt kifejezetten ellenőrzi, hogy a fájl összesen 120 alatt marad.
    - **A kikényszerítés változatlan:** az előnézetet a szerver bizonyíték nélkül 409-cel, elavult bizonyítékkal 422-vel utasítja el. A navigáció nem biztonsági határ.
    - Az átmenet-végpont (`POST /api/author/transition`, a Pages-en `authorTransition`) megmarad közvetlen API-hívóknak és a teszteknek; a felület nem használja.
    - A Próbára lépés (Rendező és Megoldáskód nézet) elutasításkor a Szabályok lépésre visz. Ott látszik az ok és az elavultsági sáv a „Modell újrakészítése” és a „Forrásváltozás elvetése” gombbal.
    - A munkamenet-import is a Szabályok lépésre érkezik, ha a kapu elutasítja.
  - **Az ellenőrzés és a szerkesztés utáni újraértékelés:** a bizonyítékot vivő előnézeti kéréssel megy. Elutasításkor az értékelés „Nem eldönthető”, és a kapu üzenetét mutatja.
- **A szerződés változása:** a nyers API-t hívó régi tesztek most a kapun át kérnek előnézetet (`tests/support/try-gate.mjs`: a draft válaszában kapott policyval és a referencia forrásával, ahogy egy szabályos kliens).
- **Bizonyíték:**
  - `tests/rules-gate.test.mjs`:
    - döntési tábla;
    - nincs előnézet a kapu előtt, a szabályszerkesztés újra zár;
    - az elavult forrást és policyt elutasítja;
    - a felülírt szabálynál `warn` mellett figyelmeztet, `block` mellett megáll.
  - `tests/pages-api.test.mjs`: a Pages-en ugyanez.
  - `browser-workbench`, „second gate”: módosított forrás mellett a Próba zárva marad.


**E7 – felület: csoportosított beállítások, zárolás és indoklás, diagnosztikai lista, lépésállapotok** ([preflight-settings.ts](../../src/workbench/preflight-settings.ts)):
- **Egy modul tudja, hogyan látszanak a beállítások.** A [preflight-settings.ts](../../src/workbench/preflight-settings.ts) rejti el:
  - melyik opció melyik nyelvhez és csoporthoz tartozik;
  - hogyan nevezzük az értékeket;
  - melyik az új feladat kezdőértéke, és melyik a régi modellek kompatibilitási értéke;
  - hogyan magyarázza magát a zárolt vezérlő;
  - mi kerül az összegzés sorába;
  - hogyan mutat egy lelet a sorára.

  Interfésze:
  - a beállításblokk és a leletlista rajzolása;
  - egy választás rögzítése;
  - a kérés beállításrésze (`settingsRequest`) és annak kulcsa (`settingsKey`).

  A kezdőértékek (`NEW_DRAFT_SETTINGS`) is itt vannak. A kompatibilitási értékek a feloldó fallbackjei, ezek egyezését teszt tartja.
  - **Nem kell szinkronban tartani semmit:**
    - Minden rajzolás után a kliens maga kér új feloldást, ha a beállítások kulcsa változott; ehhez egyik útnak (nyelvváltás, példabetöltés, elvetés, átvétel) sem kell külön hívás.
    - A modul nem mutat olyan feloldást, amely más kérésre készült.
- **A feloldó marad az egyetlen döntéshozó.** A felület nem számolja újra, mit zárol a konzervatív profil, és mi tilos. A kliens minden beállítás- és nyelvváltáskor elkéri a feloldást.
  - Új port: `resolvePolicy`, a szerveren `GET /api/author/policy?request=…`, a Pages-en a helyi feloldó. Csak a nyelvet és a beállításokat kapja, a forrást soha. Biztonságos lekérdezés, nem tárol semmit, és nem számít bele a POST-korlátba. Ugyanaz a szerzői jogosultság-ellenőrzés védi, mint a többi szerzői végpontot.
  - **Másik változat, amit elvetettem:** a feloldó modulját a böngésző is betöltené. Node-módban a `dist` nincs kiszolgálva, és a megjelenítési határ (architecture-rules) sem engedi.
  - **A harmadik változat, amit elvetettem:** csak a draft válaszában kapott feloldás látszana. Így a konzervatív profil zárolása csak a modellkészítés után jelenne meg, addig a felület mást mutatna, mint amivel az elemzés futni fog.
- **Csoportok:**
  1. **Elemzési környezet:** bemenetek, kulcssorrend, osztálymezők, TS importkibocsátás.
  2. **Forrás biztonságossága:**
     - helyi objektumállapot;
     - a TS-diagnosztika vagy a JS checkJs, a nyelv szerint;
     - a nem eldönthető eredmények kezelése.
  3. **Haladó profil:** hordozhatóság.

  Az „Oktatási sorrendi elvárások” csoport elemző nélkül nem jelenik meg (2. eltérés). A másik nyelv opciója nem látszik (C14, C15), így nincs ok nélküli inaktív vezérlő.
- **Értékfeliratok:** az „alapértelmezett” felirat megszűnt. A helyén két felirat áll:
  - „új feladat kezdőértéke” (ADR-106);
  - „régi modellek kompatibilitási értéke” (`any`, `observed`, `either`).
- **Zárolás (C01–C04):**
  - A zárolt vezérlő le van tiltva, és a hatályos értéket mutatja, „zárolva” jelöléssel.
  - Mellette egy „Miért?” kibontó áll: az ok, a feloldás feltétele és a megőrzött választás, amely a profil kikapcsolásakor visszaáll.
  - A vezérlő `aria-describedby` attribútuma az okra és a súgóra mutat.
  - A feloldó elutasítása (C33) `role="alert"` listában látszik.
- **Összegzés:**
  - a környezet, ahogy az elemzés futni fog;
  - a bekapcsolt forrásellenőrzések;
  - a bizonytalan eredmény kezelése;
  - a profil;
  - a zárolt értékek száma.
- **Diagnosztikai lista a Forrás lépésben:** az első kapu leletei, akár elutasította a forrást (422 a `details.gate`-tel), akár figyelmeztetéssel engedte tovább.
  - Minden lelet mutatja a bizonyosságot szövegesen („Biztos hiba”, „Lehetséges hiba”, „Nem eldönthető”), az eredetet és a kódot. A szín csak kiegészítő.
  - A sorszám gomb: a szerkesztőben kijelöli és láthatóvá teszi a sort.
  - Ha a forrás azóta változott, a lista ezt kiírja.
  - A kliensoldali portok a hibát `details`-szel adják tovább, a szerver és a Pages egyformán.
- **Lépésállapotok:**
  - **Forrás:** „Hibás forrás”, ha az első kapu elutasította az éppen szerkesztett szöveget. „Figyelmeztetés”, ha nem eldönthető eredménnyel engedte tovább.
  - **Próba:** „Figyelmeztetéssel”, ha a draft második kapus döntése nem eldönthető, de továbbenged. „Zárva”, ha nem enged tovább (például „tilt” mellett).
  - **Szabályok és Próba:** a „Zárolt” és az „Elavult” állapot megmarad.

  Az állapotot a [flow.ts](../../src/workbench/flow.ts) számítja (`status`, `tone`), a nézet csak kirajzolja.
- **Átvétel:** a modell elfogadásakor a draft hatályos policyjának preflight-opciói a szerzőéi lesznek (`admitAuthorModel`, `policy`). Így a második kapu ugyanazzal az ujjlenyomattal találkozik.

**E8 – munkamenet v2 és régi modellek** ([persistence.ts](../../src/workbench/persistence.ts), [preflight-settings.ts](../../src/workbench/preflight-settings.ts)):
- **A hiány:** a modell csak a környezeti beállításait rögzíti (bemenetek, kulcssorrend, osztálymezők, importkibocsátás). A preflight-opciókat (bizonytalan eredmények, objektumállapot, diagnosztika, hordozhatóság) nem. Az 1-es verziójú munkamenet ezért visszatöltéskor csendben a kezdőértékekre állította őket.
- **Munkamenet v2:** az `authorSettings` mező az alkalmazott modell beállításait rögzíti (`settingsRequest`), a modell mellett. Egy művelet olvassa: `readSession`.
  - **Az 1-es verzió továbbra is betölthető (C34).** Beállításai „részlegesek” (`partial`): a modell saját környezeti adatai és a kezdőértékek. Ugyanez igaz egy beállítások nélküli 2-es fájlra.
  - **A fájl nem megbízható (C27).** Ismeretlen opció vagy a felületen nem kínált érték (például `require-ack`) megtagadja a betöltést, nem hagyjuk el csendben (`readSettings`). A feloldó a többit is újra ellenőrzi.
  - **A modell mindkét kapun újra átmegy,** a rögzített (vagy kezdő) beállításokkal. A Próbára csak a draft saját döntése szerint érkezik; korábbi ítéletet semmilyen fájl nem hoz magával.
- **Eredet a felületen** (`settingsOrigin`, a [contracts.ts](../../src/workbench/contracts.ts)-ben):
  - `recorded`: munkamenetből, rögzített beállításokkal;
  - `partial`: régebbi munkamenetből vagy JSON-modellfájlból. A Szabályok lépés és a beállításblokk kiírja: „az eredeti forrás és a beállítások hitelessége részleges”.
  - Forrásból készült modellnél nincs eredetjelzés, mert a beállítások a szerző saját választásai. Szabályszerkesztés és saját JSON-szerkesztés megtartja az eredetet.
- **Javított E7-hiba:** a szerző saját JSON-szerkesztése (Szabályok → JSON alkalmazása, függőségfrissítés) nem küldte el a preflight-opciókat. Így például a „Tilt” csendben „Figyelmeztet”-re állt vissza. Most a saját JSON-szerkesztés a szerző beállításaival megy.
- **Mi marad a kliensnél:** hogy a modell útján csak a `policy` részt kell küldeni, a környezetet a modell bizonyítéka adja (`recordedContract`). Ez a két hívó (munkamenet, saját JSON) közös, egysoros szabálya, nem külön modul.

**C16 – ami a futási környezetben nem végezhető el** ([config-resolver.ts](../../src/author/preflight/config-resolver.ts)):
- **A hiba:** a Local Demóban (Pages) nincs szabványos könyvtár, ezért a nyelvi ellenőrzés nem fut, és az első kapu minden forrásra „nem eldönthető”.
  - A „Nem eldönthető eredmények: Tilt” beállítással így egyetlen modell sem készülhetett.
  - A felület ezt felajánlotta, és csak a modellkészítés bukott el, félrevezető üzenettel.
- **A döntés a feloldóé:** `resolveAuthorPolicy(request, environment)`; a Pages `{languageAudit: false}`-szal hívja, a szerver környezet nélkül. A felület csak megjeleníti, amit a feloldó mond (`unavailable`). Mindhárom értéknél letiltott opció „(csak szerveren)” felirattal és okkal.
  - **`unknownPolicy: block`:** blokkoló C16-konfliktus. Úgyis minden modellt megállítana, így azonnal, a valódi okkal áll meg.
  - **`jsCheck: on`, `tsDiagnostics: strict`:** itt egyszerűen nem futnának. Ezért inaktívak:
    - a kérés megtartja őket, semmi nem áll vissza csendben;
    - a hatályos érték és az ujjlenyomat a kikapcsolté, mert az elemzés így fut;
    - egy szerveres munkamenet így a Pages-en is betölthető.

**E9–E10 – tesztkorpusz, mérés, árnyékfuttatás** ([preflight-corpus.test.mjs](../../tests/preflight-corpus.test.mjs), [preflight-measure.mjs](../../scripts/preflight-measure.mjs)):
- **Korpusz (terv 9. pont):** a minimális esetek a szerver két kapuján át, végponttól végpontig, mért és nem remélt eredménnyel. A más fájlban tesztelt esetek (13, 15, 16, 17, 19, 20) a fájl fejlécében a tulajdonos tesztre mutatnak.
  - **Egyezik a tervvel:**
    - a TDZ-hibák (`typeof`, záróhívás, árnyékolás, osztálysorrend) biztos hibák;
    - `typeof` nem deklarált névre nem TDZ (checkJs mellett ismeretlen név: nem eldönthető);
    - `let x;` olvasása nem hiba;
    - a feloldatlan import nem eldönthető, sosem „hibás”;
    - amit csak a checkJs jelez, „lehetséges”;
    - rekurzió, feltételes inicializálás és véget érő ciklus nem hiba;
    - Proxy jelenlétében az „érvényes adat” sem enged olvasási cserét.
  - **Tudatos eltérés (2. eltérés, nincs mögötte elemző):**
    - a `var` deklaráció előtti olvasásához nincs minőségi figyelmeztetés (3. eset);
    - nincs „deklaráció-előbb” mód (4. eset).

    Ma mindkettő nyelvhűen „passed”.
  - **A 11. eset rése lezárva** ([ADR-109](109-count-only-key-enumeration.md), v53): az `Object.keys(o).length` nem függ a kulcsok sorrendjétől, ezért a kulcsírások egymás közötti sorrendje szabad.
- **Árnyékfuttatás (2026-11-07):** mind a 41 szállított modell (16 katalógusfeladat, 25 TypeScript-mintamodell) importált modellként, három beállítással (kezdőérték, a nyelv szigorúbb diagnosztikája, „tilt”).
  - **39 modell** mindkét kapun átmegy mindhárom beállítással.
  - **`13-duplicate-names`:** blokkolva (szándékos TS2300-minta, E5a).
  - **`01-user-account.values-only`:**
    - az első kapun átmegy;
    - a második kapu „nem eldönthető”, mert a minősítés „nem igazolt”: 15 szerzői szabály szűkíti a generált modellt;
    - „figyelmeztet” mellett figyelmeztetéssel nyílik, „tilt” mellett zárva marad.

    Itt a szerző csak szigorított. Hogy a szűkítés is „nem igazolt” legyen-e a kapu számára, pedagógiai döntés, és nyitva marad. Ma a meglévő minősítő ítéletét követjük.
  - **Élesítés:** nincs kapcsoló. A kapuk az E5a óta élesek, és a kezdőérték mellett egyetlen szállított modellt sem blokkolnak váratlanul. A visszagörgetés a commitok visszavonása.
- **Az első kapu költsége** (nyelvi ellenőrzés + futási biztonság + döntés, TypeScript, 15 futás, p50/p95 ms):

  | Forrás | Sor | Szerver (könyvtárral) | Local Demo (könyvtár nélkül) |
  | --- | ---: | ---: | ---: |
  | service-436 (valós szolgáltatás) | 483 | 41 / 71 | 7 / 12 |
  | objects-500 (közös objektumok) | 499 | 304 / 422 | 285 / 303 |
  | flat-500 (500 független deklaráció) | 500 | 182 / 267 | 193 / 219 |

  - Az idő döntő része a futási biztonsági elemzésé, nem a fordítóé (a könyvtár nélküli futás alig gyorsabb).
  - A generátorhoz képest kicsi: az author-budget mérése szerint az objects-500 generálása 1,27 s. A szerver 10 s-os korlátján belül marad.
  - A Pages-en a fő szálon fut, ezért a 64-es (worker) feladat ezt is érinti.
  - A számok ennek a gépnek a mérései, nem garantált küszöbök. Újramérés: `npm run build && node scripts/preflight-measure.mjs`.

**Bizonyíték:**
- `tests/author-policy.test.mjs`:
  - az összes kombináció tulajdonságtesztje: a konzervatív preset mindig a szigorú szerződést adja, és az ujjlenyomat csak a hatályos policytól függ;
  - HTTP 422.
- `tests/source-gate.test.mjs`:
  - döntési tábla;
  - TypeScript-hiba és TDZ a szerző sorszámán;
  - a régi draft megmarad;
  - feloldatlan import `warn` és `block` mellett;
  - importált és frissített modell is a kapun megy át.
- `browser-workbench`, „first gate”: a felület a Forrás lépésen marad, és a hiba sorszámát mutatja.
- `browser-typescript`: a jelölt hibás minta szerveren elutasítva.

## Ütemezés (feladatlista)

E0 (ez az ADR) → E1 konfigurációfeloldó → E5a korai G1 → E2 auditparaméterezés → E3 kötés- és TDZ-biztonság → E4 vezérlésfolyam és objektumállapot → E6 G2 → E7 felület → E8 munkamenet és migráció → E9–E10 tesztkorpusz, mérés, árnyékfuttatás. A dizájn F5 és F6 szakasza ezek után jön.

Minden szakasz lezárása:
1. típusellenőrzés;
2. tesztek;
3. ellenpéldák;
4. tervezési review;
5. dokumentáció;
6. kompatibilitási különbség;
7. `check:all` és a böngészős készlet.

## Tervezési review (ADR-037)

- **Tulajdonos:**
  - a konfiguráció és a kapudöntés a szerzői elemzésé;
  - a mag (`src/core`) csak nyelvfüggetlen igazolást lát, parsert nem importál;
  - a felület csak megjeleníti a feloldást.
- **Design twice:**
  - *A kapuk csak a felületen:* elvetve, mert az API és az import megkerülné.
  - *Egy „szigorú” kapcsoló:* elvetve, mert három különböző fogalmat (bemenet, TS-diagnosztika, deklaráció előbb) mosna össze.
  - *A fordító TDZ-jelzése mindkét nyelven biztos:* elvetve a mért ellenpélda miatt.
