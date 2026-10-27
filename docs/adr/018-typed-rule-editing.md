# ADR-018 – Típusos szerzői szabályműveletek

Állapot: implementálva (a Semantic Ordering Precision epic D1 munkacsomagja; a kritikai felülvizsgálat 4.3 pontja alapján a minősítéssel összekötve). A validátor változatlan. A vizuális szabálypanel (D2) erre az interfészre épül; a nézet nem módosít közvetlenül modellt.

## Kontextus

A szerző eddig csak a JSON-szerkesztőben módosíthatta a szabályokat. Ilyenkor:

- nem volt atomikus műveleti egység;
- nem volt szerkeszthetőségi biztonság;
- nem lehetett megmondani, hogy a változtatás szigorít-e vagy lazít.

A „Sorfüggőségek újraszámítása” a kézi szabályokat sem különböztette meg a generáltaktól: egy korábbi elemzés eredeti élei legacy élként ott maradtak, a lazítások nyom nélkül visszaálltak. A generált kényszer törlése után a modell sémahelyes és ciklusmentes maradhat, mégis hibás sorrendet fogadhat el. A szerzői jóváhagyás önmagában nem bizonyíték.

## Döntés

### 1. Műveletek

A [rule-editing.ts](../../src/core/rule-editing.ts) `applyRuleEdits(model, edits)` függvénye nyelvfüggetlen, és a következő műveleteket ismeri:

| Művelet | Hatás |
| --- | --- |
| `add-rule` | kötelező szerzői él (`edges`, `author` / `author-rule` proveniencia), opcionális megjegyzéssel; csak a referencia sorrendjével összhangban; kört nem okozhat |
| `remove-rule` | szerkeszthetőség szerint (lásd lent) |
| `set-note` | megjegyzés egy közvetlen kényszerhez (`authoring.ruleNotes`, legfeljebb 500 karakter, nem megbízható szöveg) |
| `set-fixed` | fix pozíció be- és kikapcsolása |
| `add-profile`, `remove-profile` | OR-profil felvétele, illetve törlése; OR-feltétel csak profillal fejezhető ki, „opcionális él” nincs |
| `add-profile-rule`, `remove-profile-rule` | AND-él egy profilon belül |

**Atomikusság:** egy köteg (legfeljebb 100 művelet) mindent vagy semmit alapon fut.

- Minden művelet az előző művelet utáni modellen ellenőrződik, és a közbenső modellnek is befogadhatónak kell lennie.
- A végeredményt a core befogadja, és el kell fogadnia a saját referenciáját.
- Hiba esetén az eredmény `{ok: false, error, message, index}`, és a bemeneti modell soha nem változik.
- Siker esetén a revízió eggyel nő.

### 2. Biztonság a szerkeszthetőség szerint

A `remove-rule` biztonsági szabályai (ADR-014 osztályai, ADR-015 kötése):

| Osztály | Eltávolítás |
| --- | --- |
| `pedagogical` (szerzői szabály) | szabad. Ha ugyanazon a páron generált ok is van, csak a szerzői réteg törlődik |
| redundáns (a pár más úton is rendezett) | szabad, a sorrendhalmaz változatlan. [ADR-021](021-author-rule-panel.md) óta csak a megmaradó, nem szerzői kényszereken át számít redundánsnak; a csak szerzői szabályokból következő pár megerősítést kér |
| `hard` (szerkezet, egység, blokktagság) | tiltott |
| `conservative` | csak `acknowledge: 'unproven-relaxation'` megerősítéssel |
| `proven`, `legacy` | csak `acknowledge: 'policy-override'` megerősítéssel |

A tranzitív következmény nem közvetlen szabály, ezért nem törölhető (`transitive-only`).

**A lazítás nyilvántartása:** minden nem redundáns generált kényszer eltávolítása rögzül (`authoring.relaxations`: pár, akkori osztály, megjegyzés).

**Kötetlen proveniencia:** ha a proveniencia `unbound`, minden ok `legacy`. Elavult ok alapján így semmi nem törölhető megerősítés nélkül.

### 3. Hatásjelentés

Minden sikeres köteg jelenti, hogy szigoríthat-e (`stricter`) és lazíthat-e (`looser`) a modell az elfogadott sorrendek halmazán:

| Érték | Jelentés |
| --- | --- |
| `no` | tartalmazással bizonyított: alternatívánként a kényszerek lezártja, a `fixed` halmaz és a változatlan blokkszerkezet alapján |
| `yes` | tanúsorrend igazolja: a valódi validátor az egyik modellben elfogadja, a másikban elutasítja; a tanú a sorazonosítók sorrendje |
| `maybe` | egyik sem állapítható meg |

A tanúsorrendet célzott, scope- és fixed-helyes sorrendgenerálás állítja elő. Példa a `maybe`-ra: egy profilokra (OR) bontás, amely pontosan a régi halmazt adja. A tartalmazás ezt nem látja, tanú pedig nem létezik, ezért a jelentés nem állít semmit (teszt).

### 4. Újraminősítés minden szerkesztés után

Az `editAuthorModel` ([engine.ts](../../src/author/engine.ts)) a köteg után futtatja a Model Verification Gate-et ([ADR-017](017-model-verification-gate.md)).

- **Újralevezetés:** a rögzített lazításokat levonja az újragenerált szabályokból. A dokumentált lazítás így nem rejtett eltérés.
- **Státusz:**
  - szerzői szabály, `fixed` sor vagy profil esetén `author-modified`;
  - **bármilyen lazítás** esetén `unverified`, külön indokkal (konzervatív, illetve policy-felülírás). A soundness állítás ilyenkor `not-established`.

### 5. Újraszámítás a szerzői szabályokkal

A `refreshAuthorModel` (és a változatlan visszatérésű `refreshLegacyDependencies`) menete:

1. A szabályokat újragenerálja, a sorazonosítókat visszaképezi, és az evidence-et újraköti (ADR-015).
2. Ezután a `mergeAuthorRules`:
   - **szerzői szabály:** a szerzői élek, illetve a szerzői okú függőségek kötelező szerzői élként megmaradnak;
   - **legacy él:** az ok nélküli eredeti élek legacy élként megmaradnak; az eredeti proveniencia csak kötött állapotban dönt;
   - **felülírt él:** egy korábbi elemzés generált élei (például `shared-boundary-lock`) helyére az újragenerált szabályok lépnek;
   - **lazítás:** újra alkalmazódik, ha a pár újragenerált osztálya nem erősebb a rögzítettnél (`reapplied`). Ellenkező esetben visszavonódik, és a kényszer marad (`revoked`). Ha a pár már csak tranzitív (`implied`) vagy egyáltalán nem kötött (`obsolete`), a rekord megszűnik;
   - **megjegyzés:** csak létező közvetlen kényszeren marad meg.

A jelentés (`refresh`) a draftválasz része a szerveren és a Pages-ben is: semmi nem vész el láthatatlanul.

## Következmények és korlátok

- **Új sémamezők:** `authoring.ruleNotes`, `authoring.relaxations` (additív, egyenként legfeljebb 1000 elem).
- **Régi modell:** evidence nélküli modellen a szerzői szabály okai `unbound` állapotúak. Ezért egy ilyen szabály eltávolítása is policy-felülírást kér, amíg egy refresh meg nem köti a modellt.
- **Hatásjelentés:** a `maybe` nem hiba, hanem őszinte eldöntetlenség. A tanúkeresés korlátos (alternatívánként legfeljebb 17 célzott sorrend).
- **Jogosultság:** a műveletek a szerzői oldalon futnak, az eredményt a szerver újra befogadja és újraminősíti. Szerveroldali szerzői jogosultság nincs; ez az F2 feladata.
