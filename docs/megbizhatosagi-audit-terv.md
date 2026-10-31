# Megbízhatósági audit – ellenőrzés és javítási terv

Állapot: 2026-10-29, `ccf5026`. A külső audit (a `project-snapshot.md` alapján készült) állításait a forráskódon és célzott mérésekkel ellenőriztük. Ez a dokumentum a megállapításokat és a javítás tervét rögzíti.

**Haladás:**
- **1. fázis:** a nyelvi hiba blokkol, és egy kapu van ([ADR-035](adr/035-language-errors-block-publication.md)). Egy példa frissítve; a többi döntésre vár ([eltéréslista](peldak-migracioja.md)).
- **2. fázis:** kész ([ADR-036](adr/036-implied-order-and-interchangeable-units.md)).
  - **Mi bizonyult a fő oknak:** a robbanás fő oka nem szimmetria volt, hanem gyenge következtetés. A keresés csak a közvetlen éleket és az elhelyezett előtagot nézte.
  - **A javítás:** implikált sorrend, blokkfolytonosság és ellenőrzött felcserélhető egységek.
  - **Eredmény:** 0 eldöntetlen a mért eseteken.
- **3. fázis:** kész ([ADR-038](adr/038-measurement-and-reason-code-register.md)).
  - közös osztályozó okbontással;
  - a dobó referenciák külön csoportban;
  - generatív küszöbteszt;
  - indokkód-jegyzék bizonyítékokkal;
  - öt nyelvi lefedettségi fixture.
- **G fázis:** az AI governance teljessé tételének tervezése ütemezve; az Ousterhout-féle tervezési governance már része.
- **4. fázis:** a 0. és az 1. tétel kész ([ADR-039](adr/039-ambient-variable-declarations.md), v18).
  - a kategóriát kizárólag a jegyzék adja, a modellek bájtra azonosak;
  - a `declare` változók pozíciófüggetlenek;
  - a TS-szkriptek indokolatlan elutasítási aránya a gyors mérésben 18,6%-ról 0%-ra esett.
  - a 2. tétel 2a–2c és 2e része kész ([ADR-040](adr/040-unknown-calls-and-unescaped-objects.md), v19): a metódustörzsben a primitív argumentumú ismeretlen hívás külső hatásnyomot kap; a JS objektumprogramok aránya 26,6%-ról 10,9%-ra, a TS objektumprogramoké 11,3%-ról 0%-ra esett.
  - a szkriptszintű, sehol nem írt globálisok kódmentes olvasása ([ADR-041](adr/041-code-free-script-reads.md), v20): a mért fő ok a JS-szkriptekben; az arány 21,4%-ról 0,4%-ra esett (12 mag).
  - a 6. tétel mért esete, a címkés objektumművelet kész ([ADR-042](adr/042-labelled-object-operations.md), v21); azonos (új) orákulummal a flow JS rései 19-ről 17-re, a flow TS-éi 7-ről 4-re csökkentek.
  - az 5. tétel eldöntve és kész: A-politika ([ADR-043](adr/043-dead-code-intent-policy.md)); a dobó JS-objektumprogramok gyors résaránya 32,4%-ról 19,4%-ra esett, mert a halott kódot érintő elutasítás szándékhű. Mellé a szerzői lazítás a jóváhagyott forráshoz kötődik ([ADR-044](adr/044-relaxation-source-fingerprint.md)).
  - a konstruktorban létrehozott kulcsok kész ([ADR-045](adr/045-constructor-created-keys.md), v22): a nem dobó JS-objektumprogramok rései 56-ról 3-ra estek (12 mag), hibás elfogadás nélkül.
  - a 4. tétel kész ([ADR-046](adr/046-loops-over-own-objects.md), v23): a ciklusok hatásnyomot kapnak, a nem bizonyítottan véget érők „esetleg nem ér véget” jelöléssel; azonos orákulummal a flow JS 22,2%-ról 15,0%-ra, a flow TS 18,7%-ról 11,8%-ra esett.
  - a mért fő ok a `sealed-unit` lett, ezért a 6. tétel `switch`-része előrébb került: a `switch` törzse saját blokk ([ADR-047](adr/047-switch-body-scope.md), v24); a flow JS 15,0%-ról 13,7%-ra, a flow TS dobó változata 5,6%-ról 2,8%-ra esett.
  - **Következik:** a többsoros kifejezések lezárása (`function` csoport, a v2-ben nem finomítható, 6. fázis), a 3. tétel (hatásösszegzés, ma kevés mért rés); a 2d nem mért ok, dokumentált korlát.

## 1. Összefoglaló ítélet

- **Az audit fő állításai igazak.** A P0 (nem igazolt modell publikálható) reprodukálva. A P1-esek a kódban és a mérésekben igazolódtak.
- **Az audit egy súlyosabb hibát nem vett észre:** a validátor keresése azonos tartalmú blokkoknál faktoriálisan robban. Egy hibás tanulói elrendezésre így `rejected` helyett `indeterminate` lesz a válasz. A publikálási kapu ezt csak részben szűri.
- **Hibás elfogadást most sem találtunk.** A biztonsági irány (inkább szigorú, mint engedékeny) érvényes.
- **A túlszigorúság mérhető, és fő okai néhány konkrét szabályhiányra vezethetők vissza:**
  - **fő ok:** az ismeretlen hívás mindenre barrier;
  - **második:** a felső szintű függvényeknek nincs hatásösszegzése;
  - **harmadik:** a projekciós lezárás.
- **Teljes felszámolás nem ígérhető.** A tetszőleges JS/TS program sorrendi ekvivalenciája eldönthetetlen, ezért a teljesség csak mérhető célokkal közelíthető. A biztonsági tulajdonságok viszont (0 hibás elfogadás, 0 eldöntetlen a publikált modelleken) kikényszeríthetők.

## 2. Az audit állításainak ellenőrzése

| Audit-pont | Ítélet | Bizonyíték |
| --- | --- | --- |
| **P0** nem igazolt modell publikálható | **igaz, reprodukálva** | [model-verification.ts](../src/core/model-verification.ts): a `publishable` csak a referenciát és a szomszédos cseréket nézi; a `publicationRefusal` alapértelmezése `publishable`; a [server.mjs](../server.mjs) is ezt használja. Egy típushibás referencia (`const label: string = 42`) `audit=errors`, `status=unverified` mellett **kiszolgálásra kerül**; `verified-only` mellett elutasított. |
| **P0, kiegészítés** | **súlyosabb, mint az audit írja** | A katalógus mind az 5 példafeladata `unverified`: régi, kézi modellek proveniencia nélkül, és eltérnek a mai újragenerálástól. A `verified-only` alapértelmezésre váltás ma minden feladatot kizárna, a szerver el sem indulna. A Pages-build ([build-pages.mjs](../scripts/build-pages.mjs)) és a [verify-models.mjs](../scripts/verify-models.mjs) egyáltalán nem használja a kaput. |
| **P1** a publikálhatósági vizsgálat részleges | **igaz, konkrét hibával** | Legfeljebb 100 szomszédos csere, 50 000 állapot. 6 azonos blokkos modell (26 sor) `publishable=true`, mégis 200 véletlen, 1–3 cserés tanulói elrendezésből 8 (4%) `indeterminate`. |
| **P1** a generátor lefedettsége hiányos | **igaz** | Ok szerinti mérést az 5. pont mutat. A korlátok a [formális szerződésben](formal-ordering-contract.md#ismert-korlátok) dokumentáltak. |
| **P1** a v2-projekció korlátoz | **igaz, de kisebb tétel** | A mért indokolatlan elutasítások kb. 4%-a `sealed-unit` vagy `continued-row`. |
| **P2** az orákulum nem teljes bizonyítás | **igaz, pontosítva** | A zárt (bemenet nélküli) véletlen programokon egyetlen futás teljes, mert a programnak csak egy viselkedése van. A gyengeség három helyen van: a paraméteres függvényeknél csak a probe bemenetei látszanak; a TS-elemzés ugyanazt a parsert használja (A1); a környezet rögzített (strict, ES2022). |
| **Validátor-invariánsok** | **igaz** | Bijektív hozzárendelés, tetszőleges távolságú élek, OR-profilok, scope-ok, rögzített rések, `indeterminate` a keret kimerülésekor. |

## 3. Új megállapítások (az audit nem jelezte)

### 3.1 A validátor szimmetriarobbanása – súlyos

A [validator.ts](../src/core/validator.ts) mélységi keresése az azonos tartalmú sorokat jelöltként egyenként próbálja. Ha k azonos blokk van (a nyitó és záró soruk is azonos), egy késői hiba bizonyításához mind a k! cserét bejárja.

| Azonos blokkok (k) | Sorok | Állapot a hibás elrendezés elutasításáig |
| --- | --- | --- |
| 4 | 14 | 220 |
| 6 | 20 | 8 208 |
| 8 | 26 | 556 540 → **50 000-nél `indeterminate`** |

- **Hatás:** egyértelműen hibás megoldásra „nem minősíthető” a válasz. Hibás elfogadás nem lesz, de a pedagógiai döntés elmarad.
- **Ahol nem jelentkezik:** az azonos törzsű, de eltérő fejlécű metódusoknál és függvényeknél, a véletlen rendetlenségnél és a nagy (500 soros) modelleknél. Mindegyik ilyen esetben 0 eldöntetlen, legfeljebb 28 ms.
- **A kapu:** a kis esetet elkapja (`publishable=false`). A 6 blokkos modellt viszont átengedi.

### 3.2 A túlszigorúság mérése torzít

A véletlen objektum- és vezérlési programok kb. 17%-a (60-ból 10–11) kivételt dob. Ilyenkor a kimenet a dobás után nem függ a sorrendtől, ezért az orákulum sok sorrendet egyenértékűnek lát, amelyet a generátor joggal köt.

A mért arány tehát felső becslés. Az ilyen esetek nem a generátor hibái.

### 3.3 Hiányzó szabályjegyzék

A generátor indokkódjai szétszórt stringek. Nincs központi, típusos jegyzék, ezért nem kényszeríthető ki, hogy minden szabálynak legyen pozitív (szabadságot igazoló) és negatív (ellenpéldát elutasító) tesztje. Az audit „minden új szabályhoz ellenpróba” javaslata ma szokás, de nem kikényszerített szabály.

### 3.4 Egyszerű szabályhiba: a TS `declare const`

A szkriptszintű `declare const d: number;` `erased-declaration-shape` barrier lesz. A szabály szerint pozíciófüggetlen kellene legyen, mert az `erased` ág csak a névvel rendelkező deklarációt ismeri fel ([statement-ordering.ts](../src/author/statement-ordering.ts), az `erased-declaration-shape` ág).

## 4. Nyelvi lefedettség (a korábbi felmérésből)

- **Csak kézi fixture fedi:** `else if`, `switch`, `try`, ciklusok, `+=`, `++`, destrukturálás, spread, template, `async`, generátor. A vezérlési szerkezetek a `flow` kampányfajta óta generatívan is fedettek.
- **Sehol nem szerepel:** függvény- és osztálykifejezés, `for…in`, `do…while`, `?.`, `delete`, regex, `instanceof`/`in`, TS `as`/`!`/`satisfies`. Mind barrierre esik vissza, de ez nincs futtatással igazolva.

## 5. A túlszigorúság okai, rangsorolva

**A mérés:** egysoros mozgatások és párcserék, 94 fix és 74 véletlen program. Egy indokolatlan elutasítás több okot is sérthet.

| # | Ok (proveniencia-kód) | Esetszám | Mit jelent | Javítható? |
| --- | --- | --- | --- | --- |
| 1 | `ExpressionStatement` (ismeretlen hívás barrier) | 510 | pl. `x.shout()` → `record(...)`: egyetlen ismeretlen hívás minden objektumműveletet köt, a független objektumokét is | **igen:** szökésanalízis (4. fázis) |
| 2 | `effectful-or-unknown-initializer` | 253 | `new Box()` és `var v = f()` ismeretlen kódnak számít; ennek nagy része az 1. barrierjei körül keletkezik | **igen:** az 1. javítása, illetve felső szintű függvényösszegzés |
| 3 | `object-write-after-write/read`, `object-read-after-write` | 234 | valódi mezőütközés; az egyenértékűség nagy része a 3.2 szerinti dobó programokból ered | részben (holt írás); előbb a mérést kell tisztítani |
| 4 | `erased-declaration-shape` | 36 | `declare const` | **igen, gyors** |
| 5 | `sealed-unit`, `continued-row` | 48 | v2-projekció | igen, de nagy munka (CodeLine v3) |
| 6 | `class-evaluation-order`, `unclassified-member` | 24 | osztálytag-fázisok | részben |
| 7 | `SwitchStatement`, `TryStatement`, `may-throw`, `branch-contains-barrier` | 27 | vezérlés és dobás | részben |

**Arányok:**
- a fix programokon 4,2%;
- a véletlen osztályprogramokon 1,7–5,4%;
- a szkriptszinten 19–41%;
- az objektumprogramokon 29–38% (a 3.2 torzításával);
- a vezérlési programokon 7–9%.

## 6. Javítási terv

**Elvek:**
- A validátormag marad; csak a keresés hatékonysága változik, a döntési szabály nem.
- Minden lazítás új policyverzió (v18…), ADR-rel, a régi modellek változatlanok.
- Minden lépés zöld `check:all` és hibás elfogadás nélküli kampány mellett zárul.

### 1. fázis – publikálási kapu (P0), azonnal

1. **A nyelvi hiba mindig blokkol.**
   - Ha `audit === 'errors'`, akkor `publishable=false`, minden politikában. A szerzői előnézet továbbra is megmutatja.
   - **Teszt:** a típushibás referencia `publishable` módban is kimarad; egy hibátlan referencia nem marad ki.
2. **A Pages és a modellellenőrző ugyanazt a kaput használja.**
   - A [verify-models.mjs](../scripts/verify-models.mjs) a `verifyAuthorModel`-t és a `publicationRefusal`-t futtatja.
   - A Pages-build csak a kapun átjutó modelleket másolja, és a minősítést a manifestbe írja.
   - **Teszt:** a Pages-build egy elutasított modellt nem tesz ki.
3. **A példák migrációja – explicit, felülvizsgált lépés, nem csendes átírás.**
   - Mind az 5 példát a mai generátorral újraszámoljuk („Sorfüggőségek újraszámítása”).
   - A régi és az új szabályok eltérését soronként dokumentáljuk, és a szerzői döntéseket (rögzített rések, OR-profilok) megtartjuk. Az eredmény így `author-modified` vagy `conservative` minősítésű, nem `unverified`.
   - **Döntési pont:** ha egy régi kézi szabály szándékos volt, azt szerzői szabályként rögzítjük.
4. **Az alapértelmezés `verified-only`.**
   - A `publishable` mód csak explicit, naplózott beállítással érhető el, „örökölt” felirattal.
   - **Teszt:** az alapértelmezett szerverindítás nem szolgál ki `unverified` modellt; a fail-closed viselkedés megmarad.

**Kész, ha:** egyetlen kiszolgált modell sem `unverified`, és egyik sem tartalmaz nyelvi hibát, sem a szerveren, sem a Pages-en.

### 2. fázis – a validátor szimmetriatörése és a kapu teljessége (P1, új)

1. **Szimmetriatörés a keresésben.**
   - A lefordított modellben megkeressük a felcserélhető egységeket: azonos tartalmú, azonos alakú részfák, amelyek cseréje a teljes kényszerrendszer automorfizmusa (élek, scope-ok, rögzített rések, profilok). A felcserélhetőséget ki kell számolni és ellenőrizni, nem feltételezni.
   - Egy felcserélhető osztályon belül a keresés csak egy rögzített sorrendet próbál („lex-leader”).
   - A beágyazott szimmetria a legkülső egységszinten törik, a részfák belseje a kanonikus megfeleltetést követi.
   - Változatlan marad: ha elfogadható hozzárendelés létezik, a keresés megtalálja.
   - Ez architektúra-döntés, ADR kell hozzá (a `validator.ts` a core része).
2. **Bizonyíték.**
   - Kis modelleken (k ≤ 6) kimerítő összehasonlítás a szimmetriatörés nélküli kereséssel: minden elrendezésre azonos döntés.
   - Property-teszt véletlen azonos blokkos modellekkel.
   - A 3.1 táblázatának esetei 500 sorig, legfeljebb néhány ezer állapottal dőlnek el.
3. **A kapu bővítése.**
   - Minden szomszédos csere vizsgálata (nem csak 100 minta).
   - Célzott „nehéz” próbák: minden azonos tartalmú sorosztályból egy sor a lista két végére, blokkmozgatások, késői hiba.
   - Az eldöntetlen próba a modellt nem publikálhatóvá teszi, és megnevezi az okot.
4. **Stresszteszt-csomag** a `tests/` alatt: azonos blokkok, azonos metódustörzsek, sok `}`, 500 sor, véletlen és majdnem helyes elrendezések. A tesztcsomag felső korlátot ellenőriz az állapotszámra és az időre.

**Kész, ha:** a stresszcsomag minden esete eldől 50 000 állapot alatt, és egy publikált modellen a véletlen tanulói hibák 0%-a eldöntetlen.

### 3. fázis – mérési infrastruktúra (P1)

1. **A kampány kötelező mérőszámai,** nyelv × programfajta × policyverzió szerint:
   - hibás elfogadás, indokolatlan elutasítás és eldöntetlen (`indeterminate`) arány;
   - a dobó referenciák elkülönítve (3.2).
2. **Okok szerinti bontás** a kampányban és az `ordering-metrics`-ben (az 5. pont mérése, beépítve), rangsorolt kimenettel.
3. **Regressziós küszöb** a rögzített baseline-ban:
   - hibás elfogadás = 0;
   - eldöntetlen = 0;
   - az indokolatlan elutasítás aránya fajtánként nem nőhet.
4. **Központi szabályjegyzék:** típusos lista az összes indokkódról (kategória, ADR, pozitív és negatív fixture). Egy teszt minden kódhoz megköveteli a negatív ellenpróbát, a szabadságot adó kódokhoz a pozitívat is.
5. **Nyelvi lefedettségi teszt:** a 4. pont „sehol nem szerepel” elemeihez egy-egy fixture, legalább a konzervatív viselkedés orákulumos igazolásával.

### 4. fázis – a generátor teljessége, a mért okok sorrendjében (P1)

Minden tétel új policyverzió, ADR, pozitív és negatív fixture, és utána kampány.

0. **Tervezési előfeltétel (ADR-038 adóssága):** a kibocsátó helyek ne adják meg kézzel a kategóriát, hanem a jegyzékből vezessék le. Ez kb. 60 hely; a kimenet nem változhat, amit a kódleltár, a korpusz és a generatív küszöbök igazolnak.
1. **`declare const` és társai (gyors javítás).** A változódeklaráló `declare` utasítás pozíciófüggetlen, ha a név egyedi.
2. **Szökésanalízis az ismeretlen hívásokra** (a legnagyobb tétel). Részfeladatok, ebben a sorrendben:
   - **2a – tervezés és tanúk (kész):** az [ADR-040](adr/040-unknown-calls-and-unescaped-objects.md) szabálya és helyességi érve; tanúprogramok ([escape-witnesses.test.mjs](../tests/escape-witnesses.test.mjs)).
   - **2b – implementáció (kész, v19):** a hatásnyom-értelmezés a törzsben a primitív argumentumú ismeretlen hívást `external` hatásnyomként fogadja el. A saját mezőt olvasó argumentum (eredetileg 2d) ide került, mert a mért minta (`record('shout', this.name)`) ezt igényli.
   - **2c – tesztek és mérés (kész):** a tanúk átállítva (a rés 0), edge case-ek (`eval`, objektum argumentum, deklarált és árnyékolt hívott név, elkapott hívás, ambiens TS-függvény, konstruktor, callback), az `external-call-order` bizonyítéka, a generatív baseline újrarögzítve.
   - **2d – kiterjesztés (nyitott):** ismeretlen hívás, amely saját objektumot kap argumentumként. Ehhez a referencia megtartását is modellezni kell, ezért ma szökés.
   - **2e – dokumentáció (kész):** ADR elfogadva, formális szerződés v19, CHANGELOG.
   - Ha egy ismeretlen hívás csak primitív értéket kap, nem fér hozzá egyetlen még meg nem szökött saját objektumhoz sem, ezért azok műveleteivel felcserélhető.
   - Megmarad a sorrend a többi ismeretlen hívással, a globálisokkal és a lehetséges kivételekkel (`may-throw`).
   - Egy objektum megszökik, ha ismeretlen kódnak adják át, globálisba vagy closure-ba kerül, vagy ilyen objektumban tárolják.
3. **Hatásösszegzés a felső szintű és szkriptszintű függvényekre.** A `var v = f()` és a `new Box()` a hívott, elemezhető törzs összegzése alapján rendeződik, ugyanazzal a hatásnyommal, mint a függvénytörzsben.
4. **Bizonyítottan véget érő ciklusok:** a `for (let i = 0; i < N; i++)` literál korláttal, ha a magja nem írja `i`-t. Ugyanez a csak `bump()`-szerű, monoton változó `while` feltételre, ha bizonyítható.
5. **A mezőirások pontosítása:** holt írás és azonos értékű írás. **Eldöntve (A-politika, ADR-043):** sorrendjük úgy ítélendő meg, mintha lefutnának; a mérés a halott kódot érintő elutasítást szándékhűnek számolja.
6. **Osztálytag-fázisok és a `switch`, `try` maradékai:** a mért esetekre egyenként.

### 5. fázis – az orákulum erősítése (P2)

1. **Több bemenet:** a fixture több probe-ot és paraméteres belépési pontot kaphat; a véletlen generátorok paraméteres változatot is előállítanak.
2. **Környezetváltozatok:** sloppy mód, ahol releváns, régebbi ES-cél (az osztálymezők leképezése), és a meglévő mindkét osztálymező-mód.
3. **Független TS-elemzés:** az orákulum a TS forrást előbb JS-re fordítja, és az Acorn-alapú JS-ágon elemzi. A törölt deklarációkhoz marad a TS AST. Ez szűkíti az A1 feltevést.

### 6. fázis – reprezentációs veszteség (P2, nagy munka)

- **Rövid táv:** a projekciós lezárás finomítása ott, ahol a lyuk nélküli egység lezárása felesleges.
- **Hosszú táv:** a CodeLine v3 egységszintű modell (a Python-tervben már szereplő natív IR út) integrálása a validátorba. Ez külön epic, saját ADR-rel és sémaverzióval.

### G fázis – az AI governance teljessé tétele (tervezés, átfogó)

**Háttér:** van AI governance ([AGENTS.md](../AGENTS.md), [ai-governance.md](ai-governance.md), architektúra-kapu), de a dokumentum maga részlegesnek nevezi. Az Ousterhout-féle tervezési governance már a része (ADR-037, [ellenőrzőlista](design-review.md)).

**Teendők:**
1. **Leltár:** mi szabályozott és mi nem. Szempontok:
   - az AI-hozzájárulások eredete (attribúció, commit-trailer);
   - a review-protokoll AI által írt kódra;
   - a jóváhagyási pontok (push, deploy, távoli műveletek, adatok kiküldése);
   - a külső tartalom kezelése (fixture, beillesztett forrás) mint adat;
   - a kockázati besorolás (core, szerzői elemzés, megjelenítés);
   - a bizonyítékok megőrzése (tesztek, mérések, ADR).
2. **Terv:** egy governance-tervdokumentum és ADR a hiányzó elemekre.
   - Minden elemhez legyen tulajdonos, kikényszerítés (gépi vagy review) és bizonyíték.
   - Ne vezessen be új, a felhasználót akadályozó jóváhagyási lépést.
3. **Gépi kontrollok bővítése**, ahol lehet (például a commit-trailer vagy az ADR-hivatkozás ellenőrzése). A többi rész review-ellenőrzőlistába kerül.

**Kész, ha:** az ai-governance.md táblázata minden elemhez tulajdonost, kikényszerítést és bizonyítékot ad, és a „részleges” megjelölés indokoltan elhagyható vagy tételesen szűkíthető.

## 7. Mi számít „felszámoltnak”

| Tulajdonság | Cél | Kikényszerítés |
| --- | --- | --- |
| Hibás elfogadás | 0 minden mérésben | kampány, baseline, szabályjegyzék |
| Eldöntetlen tanulói döntés publikált modellen | 0 a stresszcsomagban és a kampányban | 2. fázis, kapu |
| Nem igazolt vagy nyelvi hibás modell kiszolgálása | 0 | 1. fázis |
| Indokolatlan elutasítás | fajtánként mért, csökkenő, tételesen indokolt maradék | 3–4. fázis |
| Univerzális szemantikai ekvivalencia | **nem állítható** (eldönthetetlen) | dokumentált korlát |

## 8. Javasolt sorrend és döntési pontok

**Sorrend:**
- **1. fázis:** 1–2. lépés, majd a 3. lépés példamigrációja felhasználói felülvizsgálattal, végül a 4. lépés.
- **2. fázis.**
- **3. fázis**, a 4. fázis mérőalapja.
- **4. fázis:** 1., 2., 3., majd a többi tétel.
- **5–6. fázis.**
- **G fázis:** átfogó. A tervezése a 3. fázis után következik; az Ousterhout-féle tervezési governance addig is minden fázisra kötelező.

**Döntést igényel:**
- **A példák migrációja.** Az 1. fázis 3. lépése átírja a régi feladatok függőségeit. Ez csak a felhasználó jóváhagyásával, tételes eltéréslistával történhet.
- **Az alapértelmezés átállítása `verified-only`-ra.** A régi modelleket kiszolgáló telepítéseknél viselkedésváltozás.
- **A szimmetriatörés ADR-je.** Ez a core validátor algoritmusát érinti, a döntési szabályát nem.
- ~~**A holt írások és az azonos értékű írások pedagógiai megítélése.**~~ Eldöntve 2026-10-30: A-politika ([ADR-043](adr/043-dead-code-intent-policy.md)), a szerzői lazítás forráshoz kötésével ([ADR-044](adr/044-relaxation-source-fingerprint.md)).
