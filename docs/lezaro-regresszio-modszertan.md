# Lezáró regresszió – módszertan és futtatási útmutató (G1)

Ez a dokumentum azt a tesztelési eljárást írja le, amellyel egy epic vagy nagyobb kiadás végén a teljes rendszer viselkedését igazoljuk. A G1 szakasz ([epic státusz](semantic-ordering-epic-status.md#g1--lezáró-regresszió-és-jelentés--lezárva)) ezzel zárult le. Az eljárás öt rétegből áll. Mindegyik más hibaosztályt fog meg, ezért egyik sem helyettesíti a másikat.

| Réteg | Mit bizonyít | Hol | Futásidő (helyi Windows) |
| --- | --- | --- | --- |
| 1. Teljes `check:all` | Típusellenőrzés, build, architektúrakapu, minden egység- és integrációs teszt, modell- és dokumentumellenőrzés | `npm run check:all` | kb. 15–20 perc |
| 2. Forráshűségi round-trip | Egy sor tartalma sehol nem változik meg vagy vész el a teljes életciklusban | [source-fidelity.test.mjs](../tests/source-fidelity.test.mjs) (a `check:all` része) | néhány s |
| 3. Szerzői erőforráskeret | A szerzői elemzés a bemeneti korlátnál is idő- és memóriakereten belül marad | [author-budget.test.mjs](../tests/author-budget.test.mjs) (a `check:all` része) | kb. 5 s |
| 4. Generatív sorrend-kampány | Hibás elfogadás (soundness-sértés) nincs nagy, véletlen programmintán | [ordering-campaign.mjs](../tests/ordering-campaign.mjs), kézi | kb. 2–2,5 óra |
| 5. Böngészőcsomagok | Valódi Chromiumban a natív, egeres, érintéses és billentyűs interakció, a Pages és a szerveres mód | `npm run test:browser:all` | kb. 10–15 perc |

## 1. Teljes `check:all`

A `check:all` minden commit előtt kötelező. Egyedül, más nehéz folyamat nélkül futtatva determinisztikus. A G1-ben a kampánnyal párhuzamosan is lefutott (741/741), de a hosszú tesztek időzítése így lassabb. Sikertelen tesztet nem gyengítünk; a hibát a termékben vagy a teszt hibás feltevésében keressük meg (lásd az 5. pontot).

## 2. Forráshűségi round-trip

A teszt minden TypeScript-mintán (24) és négy JS/TS szélső eseten (template literal üres sorral és záró szóközzel, tabos behúzás, sorfolytatás stringben, Unicode azonosító) végigviszi ugyanazt a forrást a teljes életcikluson, és minden lépésben állít:

1. **Forrás → modell:** minden nem üres forrássor változatlanul és sorrendben a modellben van; csak az `exact` sorokon kívüli üres sorok maradhatnak el.
2. **Modell → IDE-nézet:** az `exact` sor betűre azonos; az `indent` sor legfeljebb a vezető whitespace-ben térhet el. Ez a [formázási projekció](validacios-modell-es-formazas.md) dokumentált viselkedése, nem hűségi hiba.
3. **Nézet → értékelés:** amit a tanuló lát, azt a validátor a referenciával azonosnak fogadja el.
4. **Nézet → szerkesztő szövege → próba:** a megjelenített szöveg visszaillesztve ugyanazt az elrendezést adja.
5. **Munkamenet-export → JSON → import:** ugyanaz az elrendezés, a pool, a saját sorok és a megjelenített szöveg.
6. **Modell → JSON → modell:** a fordított definíció azonos, a referencia továbbra is elfogadott.

Új nyelvnél vagy új normalizálási módnál ezt a tesztet kell elsőként kibővíteni az adott nyelv mintáival.

## 3. Szerzői erőforráskeret

A [mérőprogram](../tests/support/author-budget-probe.mjs) minden esetet külön Node-folyamatban, `--expose-gc` mellett futtat, így a heapnövekedés csak az adott elemzésé. Három eset fedi le a 500 soros bemeneti korlátot: a valódi 436 soros szolgáltatás-fixture, egy közös objektumokon dolgozó 500 soros függvény (a lábnyomelemzés legrosszabb alakja), valamint 500 független deklaráció és használat (széles, sekély gráf).

| Eset | Sor | Idő | Heap-növekedés |
| --- | ---: | ---: | ---: |
| service-436 | 436 | kb. 0,13 s | kb. 14 MiB |
| objects-500 | 498 | kb. 1,3 s | kb. 115 MiB |
| flat-500 | 500 | kb. 0,8 s | kb. 85 MiB |

A keret 10 s és 400 MiB. Ez terhelt CI mellett is hagy tartalékot, és a szerver 10 s-os kéréskorlátján belül marad. A számok mintamérések, nem SLA-k. A keret túllépése regresszió, nem flake.

Kézi mérés egy esetre:

```bash
node --expose-gc tests/support/author-budget-probe.mjs objects-500
```

## 4. Generatív sorrend-kampány

A kampány véletlen, de magból determinisztikus programokat generál négy fajtában (osztály, szkript, függvénytörzs, objektum), JavaScriptben és TypeScriptben, fajtánként 200 programmal. Minden programra elkészíti a modellt, majd három sorrendcsaládot értékel: mintavett teljes sorrendeket, a teljes egysoros szomszédságot és minden blokkmozgatást. Minden elfogadott sorrendet egy független orákulum ellenőriz.

- **Hibás elfogadás (`unsound`):** a validátor elfogad egy sorrendet, amely az orákulum szerint megváltoztatja a program jelentését. Ennek **mindig 0-nak kell lennie**. Ha nem az, a kampány azonnal minimalizált sorrenddel és forrással áll le, 1-es kilépési kóddal.
- **Completeness-rés (`gaps`):** a validátor elutasít egy jelentésőrző sorrendet. Ez megengedett, konzervatív viselkedés; a szám trendje a fontos.
- **`undecided`, `indeterminate`:** az orákulum nem tudott dönteni, illetve a validátor keresési kerete kimerült. Mindkettő elvárt értéke 0.

Futtatás és naplózás (a kilépési kód a napló végére kerül):

```bash
node tests/ordering-campaign.mjs --from=1 --to=200 > campaign.log 2>&1; echo CAMP=$? >> campaign.log
```

Szűkített futás egy változatra: `--kinds=object --languages=typescript`. Fajtánként egy JSON-sor kerül a naplóba, így a futás közben is látszik, mi készült el.

**Futásidő.** A kampány szándékosan kimerítő, ezért hosszú. Nem része a `check:all`-nak, a `check:all` egy kisebb mintán fut ([formális szerződés](formal-ordering-contract.md)). Az idő döntő részét az objektumgenerátor viszi el, mert nagyságrenddel több sorrendet állít elő. A folyamat egy CPU-magot használ, memóriája kb. 1 GB. Ha egy változat sokáig nem ír sort, a folyamat CPU-idejének növekedése mutatja, hogy dolgozik-e.

**G1-eredmény** (magok 1–200, 2026-10-28):

| Változat | Programok | Sorrendek | Elfogadott | Hibás elfogadás | Rés | Idő |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| JS-osztály | 200 | 268 352 | 15 809 | **0** | 1 245 | 6,3 perc |
| TS-osztály | 200 | 274 919 | 15 128 | **0** | 1 647 | 8,1 perc |
| JS-szkript | 200 | 39 528 | 6 682 | **0** | 480 | 0,3 perc |
| TS-szkript | 200 | 66 990 | 6 952 | **0** | 861 | 1,2 perc |
| JS-függvénytörzs | 200 | 144 065 | 8 526 | **0** | 502 | 8,7 perc |
| JS-objektum | 200 | 814 764 | 31 519 | **0** | 11 589 | 50,6 perc |
| TS-objektum | 200 | 763 992 | 40 719 | **0** | 11 589 | 54,9 perc |
| **Összesen** | 1 400 | 2 372 610 | 125 335 | **0** | 27 913 | 130,2 perc |

A függvénytörzs-generátor csak JavaScriptet állít elő, ezért TypeScript-sora nincs. Eldöntetlen és `indeterminate` eredmény egyik változatban sem volt.

## 5. Böngészőcsomagok és a flake-ek kezelése

A böngészőcsomagok a helyi `.venv` Playwrightjával futnak; a `PATH` elejére a `.venv/Scripts` kerül. Egyedül futtassuk őket, mert a valódi egeres és érintéses gesztusok terhelés alatt érzékenyek az időzítésre.

Egy időszakos hibát nem újrafuttatással „javítunk”. A G1.2-ben követett eljárás:

1. **Reprodukálás terhelés alatt:** több párhuzamos futás, a hibaarány rögzítése (előtte 8-ból 2).
2. **A pontos ok kimérése:** a hibás futás koordinátáinak és az elrendezés tört értékeinek összevetése. Ott a gesztus pontosan a beszúrási határra, a sor középvonalára esett (953 < 953,016).
3. **Döntés:** termékhiba vagy hibás tesztfeltevés. Itt a termék helyes volt, a teszt célzott kétértelmű pontra.
4. **Javítás gyengítés nélkül:** a gesztus egyértelmű pontra céloz (a sor ¾-ére), és új ellenpróba ellenőrzi a másik oldalt (¼ → a sor elé). Az állítások nem lazultak.
5. **Igazolás ugyanazon a terhelésen:** utána 16/16 zöld.

## Mit nem bizonyít ez az eljárás

- Nem bizonyít univerzális szemantikai ekvivalenciát. A kampány minta, nem teljes bizonyítás; a formális határokat a [formális szerződés](formal-ordering-contract.md) írja le.
- Nem WCAG-tanúsítás. A böngészőcsomagok a dokumentált interakciós paritást ellenőrzik.
- Az erőforrás-mérések egy gépen készültek. Más hardveren a keret tartaléka a mérvadó, nem a pontos szám.
