# ADR-036 – Implikált sorrend, blokkfolytonosság és felcserélhető egységek a tanúkeresésben

Állapot: implementálva (2026-10-29). A validátor tanúkeresésének hatékonyságát változtatja. A döntési szabály, a séma, a tanulói értékelés és a modellek változatlanok. A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 2. fázisa.

## Kontextus

A [validator.ts](../../src/core/validator.ts) mélységi kereséssel keres tanút, vagyis olyan hozzárendelést a beküldött sorok és a referencia tokenjei között, amely minden szabályt kielégít. Ha a keret elfogy, a válasz `indeterminate`. Ezt a [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 3.1 pontja súlyos hibaként mérte: azonos tartalmú blokkoknál egy késői hiba bizonyítása faktoriális számú állapotot igényelt.

A részletes mérés három okot talált, ezek közül egyik sem a szabályrendszer szimmetriája volt.

| Alak | Ok | Régi eredmény |
| --- | --- | --- |
| láncolt azonos blokkok (`{ record(1); }` × k) | a keresés csak a *közvetlen* éleket ellenőrzi a már elhelyezett sorok között | k = 8-nál 556 540 állapot; 50 000-nél `indeterminate` |
| azonos törzsű metódusok, sok azonos sor | a scope ellenőrzése csak az elhelyezett előtagon fut, így egy törzssor bármelyik metódusba „átkerülhet” | k = 40-nél a majdnem helyes beküldések 15%-a `indeterminate` |
| szabad azonos blokkok (`{ const x = 1; }` × k) | a k blokk k! egyenértékű megfeleltetése | k ≥ 8-nál a majdnem helyes beküldések 78–82%-a `indeterminate` |

Az utolsó sor valódi szimmetria. Az első kettő gyenge következtetés: a döntéshez szükséges tudás benne volt a szabályokban, a keresés csak nem használta.

## Döntés

### Szerződés

A keresés csak olyan ágat hagyhat ki, amely
- nem tartalmaz megoldást, vagy
- egy *korábban kipróbált* jelölt ágának tükörképe.

A jelölteket a validátor növekvő tokensorrendben próbálja, és minden tükörkép egy kisebb tokenből jön. Ezért a keresés **ugyanazt az első tanút** találja meg, mint korábban. Következésképpen:
- ahol a régi keresés döntött, ott a döntés és a tanú (`matchedProfile`, `matchedTokenIds`) azonos;
- a bejárt állapotok száma soha nem nő;
- egy korábban `indeterminate` válasz eldőlhet.

### Modulhatárok: ki mit rejt el

A review után (Ousterhout-szempontú átnézés) a tudás így oszlik meg. Minden modul egy döntést rejt el, kis interfész mögött.

| Modul | Interfész | Elrejtett tudás |
| --- | --- | --- |
| [placement.ts](../../src/core/placement.ts) | `createPlacement(compiled, profile)` → `tryPlace`, `undo`, `complete`, `witness` | A részleges hozzárendelés és minden rá vonatkozó szabály: élek, lexikai szerkezet (régi blokkok vagy v3-egységek), implikált sorrend, blokkfolytonosság, felcserélhető egységek. A szabályokból számolt rész lefordított modellenként és profilonként gyorsítótárban marad. |
| [reachability.ts](../../src/core/reachability.ts) | `reachability(n, edges)` → `reaches`, `descendants`, `ancestors`, `rank`, `acyclic` | A tranzitív lezárt számítása (Kahn-sorrend, bitkészletek). Körkörös gráfnál nem számol félig: semmi nem ér el semmit. A diagnosztika is ezt használja, nem saját másolatot. |
| [content-match.ts](../../src/core/content-match.ts) | `contentKey(code, normalization)`, `matchContent(tokens, lines)` | Mi számít azonos tartalomnak. A jelöltlisták növekvők; erre épül az első tanú megőrzése. |
| [validator.ts](../../src/core/validator.ts) | `validateSubmission` | Csak a keresési stratégia: melyik pozíció következik (MRV), a keret és a döntés. |

A korábbi első változat (`search-pruning.ts`) a validátor tömbjeire épült, és a validátornak négy párhuzamos állapotot kellett szinkronban tartania. Ez információszivárgás és időbeli csatolás volt. A `placement` modul ezt magába húzza: a bonyolultság lefelé kerül, a hívó egyszerű marad.

| Szűkítés | Mire épül | Miért nem veszít megoldást |
| --- | --- | --- |
| **implikált sorrend** | a profil éleinek tranzitív lezártja (bitkészlet); minden sorra a legkorábbi (`\|ősök\|`) és a legkésőbbi (`n − 1 − \|leszármazottak\|`) hely | a lezárt minden éle következik a közvetlen élekből |
| **blokkfolytonosság** (régi blokkok) | egy blokk két elhelyezett tagja közé csak a blokk tagja kerülhet; tag a blokk határsora és minden sor, amelynek scope-lánca tartalmazza a blokkot | érvényes zárójelezésben a blokk nyitó és záró sora között csak a blokk tagjai állnak |
| **felcserélhető egységek** (régi blokkok) | azonos szülő alatti testvér-részfák, vagyis egy határsor nélküli sor vagy egy teljes blokk, amelyek cseréje a profil automorfizmusa | a csere a teljes állapotot önmagába viszi, ha egyik egység sincs használatban; a kisebb rangú egység ágát a keresés előbb járja be |

**Mikor felcserélhető két egység:** a felcserélhetőséget profilonként *ellenőrizzük*, nem feltételezzük. Két egység akkor felcserélhető, ha a sorrend szerinti k-adik sorukat összepárosítva:
- a tartalomkulcsok egyeznek, és egyik sornak sincs rögzített helye;
- a scope-ok és a határszerepek blokkról blokkra megfelelnek egymásnak;
- az egységeket érintő minden él képe is él.

Egy osztály akkor marad meg, ha az egységek k-adik sorai rangsor szerint szigorúan növekvő tokenindexűek. Így a kihagyás nem lehet körkörös, és a tanú nem változhat akkor sem, ha a tokenlista nem a referencia sorrendjében áll.

Az egységszerkezetes (v3, `structure`) modelleknél csak az implikált sorrend működik; ott a blokkfolytonosság és az egységek nem aktívak.

### A kapu bővítése

A `verifyModel` mostantól:
- **minden szomszédos cserét** vizsgál, nem 100 mintát;
- **célzott nehéz próbákat** is futtat:
  - legfeljebb 100 ismétlődő sor utolsó példánya a sorozat elejére, első példánya a végére;
  - a fordított sorrend;
  - az első és az utolsó sor cseréje.

**A kapu költsége korlátos:**
- Az első eldöntetlen próbánál leáll, mert az már elég az elutasításhoz. A megállapítás megnevezi a próba fajtáját.
- Az összes próba együtt a próbánkénti keret legfeljebb 20-szorosát járhatja be. Ha ez elfogy, a modell nem publikálható.
- Ha a referencia nem dől el elfogadással, a kapu nem próbál, és a cserékről szóló állítás `not-established`.
- Az ismétlődést a validátor tartalomkulcsa (`contentKey`) dönti el, nem a `trim()`.
- A referenciával vagy egy korábbi próbával azonos beküldést nem értékeli újra.

Az elutasítás oka: „A referencia vagy egy kapupróba (szomszédos csere, nehéz próba) nem dönthető el a keretben.”

## Következmények

**Mérés** (50 000 állapotos keret):

| Eset | Előtte | Utána |
| --- | --- | --- |
| láncolt azonos blokkok, késői hiba, k = 8 | 556 540 állapot, `indeterminate` | 17–25 állapot, `rejected` |
| hat alakzat × 4 méret, majdnem helyes beküldések (3 000 db) | sok száz `indeterminate` | **0** `indeterminate`, legfeljebb kb. 2n állapot, legfeljebb 76 ms |
| 124 modell (példák, 24 TS-minta, teljes korpusz) × 200 véletlen tanulói hiba | 4 `indeterminate` | **0** `indeterminate`, legfeljebb 47 állapot, legfeljebb 7 ms |
| nagy, elfogadott referencia (≈ 500 sor), gyorsítótárazott előkészítéssel | 3,1–6,1 ms | 4,1–7,2 ms |

**Tesztek:** [search-pruning.test.mjs](../../tests/search-pruning.test.mjs)
- **Nyers erős ellenőrzés:** 200 kis véletlen modellen (ismétlődő sorok és blokkok, beágyazás, rögzített hely, két profil, összekevert tokensorrend) minden különböző beküldés megkapja a nyers erős ellenőrzés döntését. A régi keresés döntése és tanúja is megmarad.
- **Nyolc nevesített szélső eset:**
  - kívülről egy blokkba mutató él;
  - rögzített hely az egyik blokkban;
  - csak az egyik profilban felcserélhető blokkok;
  - fordított tokenlista;
  - egymásba ágyazott azonos blokkok;
  - láncolt azonos sorok;
  - blokk és testvérsor;
  - összefésült tokenlista.
- **Terhelési csomag:** hat alakzat legfeljebb 500 sorig. Minden majdnem helyes beküldés eldől, legfeljebb 4n állapottal.
- **v2 és v3 modellek:** a 24 TS-minta v2 és v3 alakján a régi keresés eredménye megmarad.
- **A régi keresés** rögzített másolatként csak tesztsegédként él: [validator-baseline.mjs](../../tests/support/validator-baseline.mjs).
- **Mutációs próba:** a tesztek elkapják a túl agresszív mutánsokat. Ilyen például a hiányzó élellenőrzés, a figyelmen kívül hagyott kör, a hiányzó monotonitásvizsgálat vagy az egy hellyel elcsúszó korlát. Elkapják a blokkfolytonosság és az egységek kikapcsolását is.
- **Előfeltételek tesztjei:** a jelöltlisták növekvők; a kézzel összerakott, körkörös szabály elutasít; a gyorsítótárazott előkészítés nem változtat döntést.
- **A kapu** próbaszámát, a duplikátumszűrést, a tartalomkulcsot, a korai leállást és az összesített keretet a [model-verification.test.mjs](../../tests/model-verification.test.mjs) rögzíti.

**Korlátok:**
- A nagy, elfogadott referenciákon a hívásonkénti keresési állapot és a burokellenőrzés kb. 1,2–1,4-szeres időt jelent.
- Az egységszerkezetes modelleken csak az implikált sorrend működik.
- A szimmetriát csak testvér-részfák cseréjeként ismerjük fel; más automorfizmust nem keresünk.
- A keret továbbra is véges: a 0 eldöntetlen mért eredmény, nem bizonyított felső korlát minden modellre. A kapu ezért minden publikálandó modellt a fenti próbákkal ellenőriz.
