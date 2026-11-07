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
