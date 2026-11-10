# ADR-128 – Objektumliterál tulajdonságsorai és a horogvizsgálat csak a futó kódon (v54, NY-34)

Állapot: **elfogadva** (2026-11-10). A szabályverziót (`scoped-effect-analysis-v54`) a felhasználó hagyta jóvá. Kockázati osztály: szerzői elemzés, valamint orákulum és mérés. Két hibát javít egy szabályverzióban.

## Kontextus

- **Objektumliterál.** A felhasználó két forráson jelezte, hogy egy többsoros objektumliterál tulajdonságsorai nem cserélhetők.
  - A szerzői szabálypanel szerint a szabály „szerkezeti, nem távolítható el” (`continued-row`). Ez „Objektumkulcsok sorrendje: Nem számít” mellett is így volt.
  - **Mérés (v53):** a jelzett forrásokon a 10↔11 csere „Számít” és „Nem számít” mellett is elutasítva.
  - **Ok:** a literál sorai az utasítás folytatósorai voltak. A tagjaikat senki nem elemezte, ezért a kulcssorrend-beállítás nem hatott rájuk.
  - **A jelzés helyesbítése:**
    - „Számít” mellett, ha a program kiírja az objektumot (`console.log(emp)`), a csere megváltoztatja a kimenetet (`{ name, age }` helyett `{ age, name }`), tehát a szabály ott szükséges, csak rossz okkal állt;
    - a vessző nélküli utolsó sort (`employeeId: 12345`) a jelzés nem vette figyelembe: az nem kerülhet előre, mert a forrás nem fordulna le.
  - A szabály ezért nem „szintaktikailag szükséges vagy sem” mércével dől el, hanem azzal, hogy a futó program megkülönbözteti-e a sorrendeket. Ez a termék szerződése.
- **NY-34.** A bemeneti szerződés horogmintája (`Proxy`, `Function`, `Symbol.`, `eval` …) a teljes forrásszövegen futott, típusokon és megjegyzéseken is.
  - A 436 soros TS mintánál a `func: Function` típus miatt szigorú lett az elemzés, és a felület ezt a 190. sornak tulajdonította.
  - **Mérés:**
    - a 235 forrásos korpuszban csak ez a minta érintett;
    - a javítás után a minta megkapja az „érvényes adat” szerződést, de az elfogadott sorrendjei nem változnak: 96 045 a 96 141 párból kötött előtte és utána is. A mintát a blokkszerkezet (836 szabály), a többsoros kifejezések (140) és a saját metódushívások kötik, nem a bemenetek olvasása.
    - Tanúprogramokon (típusban `Function`, `typeof Symbol.iterator`, megjegyzésben `Proxy`) az elfogadott helyes sorrendek száma megduplázódik, 0 hibás sorrenddel.

## Döntés

- **Objektumliterál ([object-literal-ordering.ts](../../src/author/object-literal-ordering.ts)).** Egy többsoros literál akkor kap saját szabályokat, ha minden tulajdonsága:
  - egy saját sort foglal (a sor a tulajdonság és a vesszője, semmi más);
  - egyszerű, egyedi kulcsú (nem számított, nem `__proto__`, nem ismétlődő);
  - kódot nem futtató értékű (`inert-value.ts`: literál, előjeles szám, ilyenekből álló friss tömb vagy objektum; ugyanaz a döntés, mint az osztálymezőknél, ADR-029, most egy modulban).
  
  A nyitó és záró sorában pedig nincs más kapcsos zárójel. Ekkor:
  - **a tulajdonságsorok egymáshoz képest szabadok:** a kiértékelésük nem futtat kódot és nem dob, egyedül a kulcssorrendet befolyásolják;
  - **kulcssorrend:** „Számít” beállításnál a sorrend marad (`reflected-key-order`, a szerző feloldhatja „Nem számít”-ra váltással), kivéve ha az objektum bizonyítottan nem jut ki a változójából:
    - a literál egy függvényen vagy blokkon belüli változó kezdőértéke (a felső szintű kötés kívülről is elérhető: export, másik szkript, a hívó; ezt az orákulum próbahívása is így éri el);
    - minden hivatkozás a fájlban erre a névre tagelérés (`v.x`, `v[k]`, nem hívás);
    - a fájlban nincs `eval` vagy `with`.
    
    A kulcsok felsorolásához (`Object.keys`, `JSON.stringify`, `for…in`, spread, `console`) magára az objektumra kell hivatkozni, ahogy bármely hívónak is (visszaadás, argumentum, export). Ez a feltétel tehát a programon kívüli kódot is lefedi.
    - **Szigorúbb, mint az osztálymezők szabálya** (ADR-029: „ha a program felsorolja a kulcsokat”). Az orákulum mutatta meg, hogy egy visszaadott literál kulcssorrendjét a hívó felsorolhatja.
    - A tömbindex-kulcsok mindig szabadok, mert a felsorolás növekvő sorrendben adja őket.
  - **`list-tail` (új szerkezeti ok):** a vessző nélküli utolsó tulajdonságsor a végén marad.
  - **A literálban maradás:** minden tulajdonságsor a nyitó sor után és a záró sor előtt áll, kifejezett függőségként is, a literál blokkja mellett.
  - Minden más eset (hívás az értékben, megjegyzéssor, közös sor, számított kulcs) a v53 szerint marad.
- **NY-34 ([input-contract.ts](../../src/author/input-contract.ts) `runtimeText`).** A horogminta a forrás futó szövegén fut. Ebben szóközzé válik, a sorok és pozíciók megtartásával:
  - a megjegyzés;
  - a típusszintaxis: annotáció, típusargumentum, `interface`, `type`, `declare`, csak típust importáló vagy exportáló sor, `implements`.
  
  A `class … extends` kifejezése megmarad, mert fut. A felület okmegjelölése (ADR-126) ugyanebből a szövegből veszi a sort.
- **Orákulum** ([semantic-oracle.mjs](../../tests/support/semantic-oracle.mjs)), függetlenül:
  - **P1 alak:** az objektumliterál tulajdonságai szabad lista, mint az utasítások és az osztálytagok. Hogy a sorrend mit változtat, azt P2 és a P3 futtatás dönti el, a kulcssorrenddel együtt.
  - **Bemeneti szerződés:** a horgot a TypeScript emitjén keresi, megjegyzések nélkül. Ez más út, mint a generátoré (kitakarás a forrásban), és ugyanarra jut.

## Két terv („design it twice”)

1. **A v3 egységmodell (NY-33) bekötése, amelyben a többsoros kifejezés tagjai saját egységek (elvetve most).** Általános, de külön epic; mért haszna eddig nem volt, és ez a javítás nem várhat rá.
2. **Célzott tagelemzés a literálra, a meglévő tagelemzés mintájára (választott).** A típus- és osztálytagok már így működnek: tiszta tag szabad, a kulcssorrendet csak megfigyelhetőség esetén tartja. A literál ugyanazt a döntést kapja egy kis modulban, a sorokat a meglévő vetítés kezeli.

## Tervezési review (docs/design-review.md)

- **object-literal-ordering.ts:**
  - *elrejti*, mikor szabad egy literál sora, a kulcssorrend és a kijutás döntését, a vessző nélküli sor szabályát;
  - *interfésze:* egy függvény, a `keyOrder` beállítással;
  - a `js-ts-ordering` egy újabb résszel köti össze, mint a tagelemzést.
- **inert-value.ts:** a „kódot nem futtató érték” egyetlen definíciója; a tagelemzés is innen veszi, nem másolat.
- **input-contract.ts:** a futó szöveg a bemeneti szerződés tudása; a kulcsmegfigyelés szövege (ADR-060) külön döntés marad.
- **Rögzített maradék (NY-35):**
  - a változó- és rövidített értékű sorok (`start: origin`, `{ name }`) kötöttek maradnak;
  - a v54 orákulumbővítése ezt egy korpuszrésként (`ch-multiline-object`) tette láthatóvá.

## Bizonyíték

- **[object-literal-rows.test.mjs](../../tests/object-literal-rows.test.mjs):**
  - a felhasználó két forrása, mindkét beállítással, JS-ben és TS-ben;
  - a változatlanul maradó esetek;
  - tíz orákulumfixtúra (felsorolás, `console`, változóban maradó objektum, tömbindex, nem tiszta érték, beágyazott tiszta érték, kijutás argumentumként, felső szintű objektum, visszaadott literál), mindkét beállítással: 0 hibás elfogadás, rögzített elfogadásszámokkal;
  - a `runtimeText` egységtesztje.
- **[inputs-override.test.mjs](../../tests/inputs-override.test.mjs):**
  - a TS minta már nem kap felülírást;
  - a típusban, megjegyzésben álló horog nem tesz szigorúvá;
  - a futó `Function`, `Reflect` (az `extends`-ben is) és `setPrototypeOf` igen, a helyes sorral.
- **Okkód-bizonyíték:** `list-tail` a `code-list-tail` fixtúrán. Az utolsó sor előrehozása nem fordul le, az orákulum ezt eltérésként ítéli.
- **Mérések:**
  - generatív alapvonal: csak a címke változott, egyetlen szám sem;
  - korpusz: egyetlen változás, a `ch-multiline-object` 1 rése (NY-35);
  - a 24 TS mintamodell és a 16 szállított példa függőségei nem változtak, csak a címke.
