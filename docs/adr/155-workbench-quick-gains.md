# ADR-155 – A munkafelület gyors nyeresége architektúraváltás nélkül (NY-58, F1)

Állapot: **elfogadva** (2026-11-14). A [refaktorterv](../terv-munkafelulet-refaktor.md) F1 fázisa; a felhasználó jóváhagyta („jóváhagyom, mehet a Refaktor F1”). Kockázati osztály: megjelenítés. Viselkedésmegőrző: a látható szöveg, a műveletek jelentése és az elrendezés nem változik; a markup-szerződés nem változik. A fázis taskonként halad; ez az ADR taskonként bővül.

## Kontextus (mérve 2026-11-14-én, a 482 soros TypeScript-feladaton)

- **A munkafelület minden művelet után a teljes oldalt újrarajzolja** ([ADR-151](151-workbench-headless-core-foundations.md)). Ezen az F4 változtat; az F1 azt veszi el, ami a mai szerkezetben is fölösleges.
- **A kényszerített elrendezések forrása nyomkövetéssel mérve** (Chromium trace, a kiváltó hívás veremével), egy kirajzolásra a Próba lépésben:
  - a szabályívek listánként külön mértek és rajzoltak: a második lista mérése az első rajzolása után új elrendezést kényszerített ki;
  - a magasságrögzítés ([ADR-152](152-technology-labels-in-the-practice-list.md)) a kirajzolás elején a régi, eldobásra váró oldalt rendeztette el;
  - a fejléc illesztése előbb ír, aztán mér.
- **Az „szerkeszthetők-e a szabályok” kérdést minden sor külön tette fel.** A válasz a teljes forrást és a teljes JSON-piszkozatot hasonlítja össze az alkalmazott modellével; 482 sornál ez kirajzolásonként kb. 25 ms volt.
- **A „nem alkalmazott JSON” állapotot két hely számolta** (a nézet és a szerkesztő beviteli kezelője), eltérő kóddal; a kezelő minden leütésre újra szöveggé alakította a teljes modellt.

## Döntés

### T1.1 – Az elérhetőség kirajzolásonként egyszer

- **A szabálytábla és a rendező sorai egyetlen választ kapnak** arra, hogy a szabályok most szerkeszthetők-e; a kirajzolás egyszer kérdez, és minden sornak átadja.
- A rendező sorvezérlőit egy kirajzolásra szóló gyár adja (`createRowRuleControls`), ahogy a szabályjelöléseket is (`createRuleMarks`). Az egy sorra szóló hívások (`connectButton`, `tryRowRuleControls`) megmaradtak, maguk kérdeznek.

### T1.5 – Egy mérési fázis kirajzolásonként

- **Az ívek mérése és rajzolása két fél** (`measureRuleArcs` visszaadja a rajzolást): minden lista mérése megtörténik, mielőtt bármelyik rajzolódna.
- **A nézet folytonossága a nyitott részeket azonnal visszanyitja,** a mérés előtt, és a fókusz visszaadását adja vissza, amelyet a nézet a mérés után hív (`restore` → folytatás). A kettő sorrendje így nem téveszthető el.
- **A kirajzolás sorrendje:** előbb minden, amiből az új oldal áll (HTML, szerkesztők tartalma, visszanyitott részek), aztán a mérések (ívek, fejléc, eszköztár, listák, görgetés), végül ami a mérésekből következik (ívek rajzolása, fókusz).
- **A magasságrögzítés megszűnt** ([ADR-152](152-technology-labels-in-the-practice-list.md) kerülőmegoldása). Az ok megszűnt: az oldal már nem mérődik a visszanyitás előtti, rövidebb állapotában. Az ADR-152 görgetés-tesztje a rögzítés nélkül is zöld.

### T1.3 – A húzás határszámítása gyorsítótárból

- **A sorok függőleges közepe listánként egyszer mérődik** (a lista saját tartalmi koordinátáiban), és addig érvényes, amíg a lista ugyanaz az elem ugyanazzal a szélességgel. Minden újrarajzolás új listát készít, tehát elavult adat nem maradhat.
- **A határ bináris kereséssel adódik** (`boundaryAt`): az első sor, amelynek a közepe a mutató alatt van (a felezőpont-szabály, [ADR-095](095-tap-to-place-and-drag-insert-migration.md)).
- **Tartalmi koordinátákban sem a lista görgetése, sem az előnézet eltolása (transzformáció) nem változtat a közepeken,** ezért a soronkénti `getComputedStyle` (a transzformáció kivonásához) megszűnt. Ugyanarra a mutatóhelyre ugyanaz a határ jön ki, mint eddig.

### T1.4 – Az előnézet csak a változó sorokhoz nyúl

- **Egy listán belül csak a régi és az új határ közötti sorok kapnak vagy veszítenek osztályt.** Eddig minden lépés minden jelölt sorról levette, majd a határ utáni összes sorra visszatette az osztályt, ami a teljes lista stílusát újraszámoltatta.
- **A látvány nem változik:** a sorok ugyanazokat az osztályokat viselik, a beszúrási jel ugyanoda kerül. (A terv „egyetlen elemes előnézete” csak látható változással volna megvalósítható; lásd a korlátot.)
- **A takarítás (`clear`) csak a jelölt sorokat érinti,** nem a lista minden sorát.

### T1.2 – A példafeladatok párhuzamos letöltése (Local Demo)

- **A Local Demo a jegyzék minden feladatát egyszerre kéri le** (`public/app/pages-api.js`), nem egymás után.
- **A befogadás sorrendje a jegyzéké marad:** a feladatok a jegyzék sorrendjében kerülnek ellenőrzésre és a listába, bármelyik letöltés válaszolt előbb.
- **A hibaüzenet is a jegyzék sorrendjét követi:** több hiányzó feladat közül a jegyzékben első kerül a hibaüzenetbe.
- Ez bekötés jellegű módosítás a régi JS-határon (ADR-001); a befogadás szabálya (`assertSafeModel`) nem változott.

### T1.7 – Egy tulajdonos a JSON-piszkozat állapotára

- **Csak az `author-workspace` dönti el,** hogy a CodeLine JSON alkalmazott-e (`modelDraftStatus`): ő birtokolja a modell szövegét (`modelJson`, gyorsítótárazva). A nézet, a folyamat (`jsonPending`) és a szerkesztő beviteli kezelője őt kérdezi; a kezelő a szerkesztő éppen gépelt szövegével.
- A felirat („Nem alkalmazott JSON”, „Aktív modell”, „Új feladat JSON-ból”) is egy helyről jön.

## Két terv („design it twice”)

T1.1:
1. **Gyorsítótár az `availability` függvényben.** Elvetve: az állapotnak nincs verziója, a gyorsítótár érvényességét nem lehetne megmondani.
2. **A kirajzoló egyszer kérdez, és átadja (választott).** A meglévő minta (`createRuleMarks`) folytatása.

T1.5, a nyitott részek és a fókusz:
1. **Két külön művelet a folytonosságon** (`reopen`, `refocus`). Elvetve: kötelező hívási sorrend a hívón.
2. **Egy művelet, amely a második felét visszaadja (választott).** A fókusz nem adható vissza a visszanyitás előtt, mert a folytatás csak a hívásból kapható meg. Az ívek ugyanezt a mintát követik.
3. **A magasságrögzítés megtartása, kényszerítés nélkül** (a magasság követése `ResizeObserver`-rel). Elvetve: a tünetet kezelné tovább, egy újabb megfigyelővel.

T1.3:
1. **Közepek képernyő-koordinátákban, görgetésre érvénytelenítve.** Elvetve: görgetésfigyelő kellene, és az előnézet transzformációját továbbra is ki kellene vonni.
2. **Közepek a lista tartalmi koordinátáiban (választott).** A görgetés és a transzformáció nem érinti őket; az érvényességet az elem azonossága és szélessége adja.

T1.4:
1. **Egyetlen távtartó elem a határon.** Elvetve ebben a fázisban: a sorok 16 px-rel lejjebb kerülnének, az előző sor nem mozdulna (ma +8 és −8 px); ez látható változás.
2. **Testvérszelektor egyetlen osztállyal** (`.drop-at ~ .code-row`). Elvetve: az írás egy elem, de a böngésző így is a határ utáni összes testvért újraszámolja.
3. **Ugyanazok az osztályok, különbségként írva (választott).**

T1.2:
1. **Előre ellenőrzött katalógus build időben.** Elvetve erre a fázisra ([ADR-154](154-curriculum-tree-in-the-practice-list.md) döntése): a böngésző megbízna egy olyan ellenőrzésben, amelyet nem ő futtatott; csak mért lassúságra kerül elő, a G6 szállítási döntése előtt.
2. **Párhuzamos letöltés, a befogadás a jegyzék sorrendjében (választott).** A letöltések számát a böngésző korlátozza (HTTP/1.1-en kiszolgálónként hat kapcsolat), saját korlát nem kell.

T1.7:
1. **A kezelő olvassa az állapotot** (`jsonPending(state)`). Elvetve: a kezelő a `ui.js` kezelője előtt is futhat, amikor az állapot még a régi szöveget tartja.
2. **A tulajdonos a szöveget is megkaphatja (választott):** alapértelmezésben az állapotét, a kezelőtől a szerkesztőét.

## Tervezési review (docs/design-review.md)

- **Elrejtett tudás:** az `author-workspace` tudja, mi az alkalmazott modell szövege és mikor piszkozat a JSON; a `rule-board` tudja, mit kell az ívekhez mérni és hogyan rajzolódnak; a `continuity` tudja, mi volt nyitva és hol állt a fókusz. A nézet kirajzolása csak a fázisok sorrendjét tudja.
- **Az interfészek nem szélesedtek érdemben:** egy új gyár (`createRowRuleControls`), egy új kérdés (`modelDraftStatus`), egy kettéosztott művelet (`measureRuleArcs`; a `drawRuleArcs` megmaradt az ívek önálló újrarajzolására). A `continuity.restore` visszatérési értéket kapott.
- **Megszűnt egy ismétlés** (a JSON-állapot két számítása: a refaktorterv 2.1 szakaszának `design` megállapítása) és egy kerülőmegoldás (a magasságrögzítés).
- **design, rögzítve:** a fejléc illesztése (`fitBrand`) továbbra is ír, mielőtt mér, ezért kirajzolásonként egy elrendezést kikényszerít. Pontos megtartása mellett nem kerülhető el (a szélesebb lépcsőt ki kell próbálni); a régiós kirajzolás (F4) a fejlécet ritkán rajzolja újra.
- **design, rögzítve:** a görgetés visszaállítása a listák illesztése után marad (pontosság), ezért elrendezést kényszerít ki, ha a fejléc illesztése írt.

## Bizonyíték

- **T1.1, egységteszt** ([workbench-flow.test.mjs](../../tests/workbench-flow.test.mjs)): a kérdés a JSON-piszkozatot olvassa; a teszt megszámolja az olvasásokat. A 60 soros tábla és a rendező 60 sora egyszer kérdez; az egy válasz minden sorhoz eljut (alkalmazatlan piszkozatnál mind a 120 vezérlő letiltott, az okával). Három visszarontás, mind megbukik.
- **T1.7, egységteszt** (ugyanott): a tulajdonos válasza alkalmazott modell nélkül és vele, az állapot szövegére és a gépelt szövegre, a három felirattal.
- **T1.3, egységteszt** ([insert-between.test.mjs](../../tests/insert-between.test.mjs)): a bináris keresés minden pontra ugyanazt adja, mint a meghatározás (az első sor, amelynek a közepe a mutató alatt van): 1–482 soros, egyenetlen magasságú listákon, minden közép alatt, rajta és fölötte, és véletlen pontokon.
- **T1.3 és T1.4, a viselkedés megtartása:** egy billentyűs bejárás (le, fel, Home, End, megszakítás) minden lépése után a beszúrási jel helye és az osztályokat viselő sorok listája bájtra azonos a változtatás előttivel. A húzás böngészős sávja mindkét kódnézetben (133 + 133 eset), a mátrix (33) és az offline sáv zöld.
- **T1.3 és T1.4, mérés** (a gesztus lépései külön, fő szál, medián; előtte → utána):
  - mutatóeszköz, későbbi mozdulat: 104 → 84 ms, ebből stílusszámítás 22,3 → 3,9 ms;
  - billentyű, későbbi lépés: 93 → 68 ms, ebből stílusszámítás 25,4 → 4,3 ms;
  - az első előnézet (a határ utáni összes sor megmozdul): mutatóval 230 → 248 ms, billentyűvel 181 → 178 ms: **nem változott** (a különbség szórás).
- **T1.2, egységteszt** ([pages-api.test.mjs](../../tests/pages-api.test.mjs)): fordított sorrendben válaszoló letöltésekkel minden letöltés nyitva van, mielőtt az első válaszol; a lista a jegyzék sorrendjében áll; két hiányzó feladat közül a jegyzékben első kerül a hibaüzenetbe, pedig a másik válaszol előbb. A teszt elbukik, ha a később elbukó letöltés hibája kezeletlen marad.
- **T1.2, mérés** (a szállított 16 feladat, a gyakorlólista megjelenéséig, 7 futás mediánja; előtte → utána):
  - letöltésenként 80 ms késleltetéssel: 2035 → 1004 ms (**−51%**; a terv célja legalább −30%);
  - letöltésenként 200 ms késleltetéssel: 4031 → 1534 ms (−62%);
  - késleltetés nélkül: 500 → 449 ms (a szóráson belül: helyi gépen a letöltés eddig sem számított).
- **T1.5, nyomkövetés** (kényszerített és keret szerinti elrendezések egy forgatókönyvben, előtte → utána): Próba megnyitása 7 → 5; billentyűs lerakás 8 → 6; ellenőrzés 7 → 6. Az ívek két kényszerítése egyre csökkent, a magasságrögzítésé megszűnt.
- **A görgetés megtartása** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py), `tap_to_place`): a rögzítés nélkül is zöld.
- **Mérősáv és teljes kör:** a fázis végén, a többi taskkal együtt (lásd lent).

## Korlát

- **A terv 16 ms-os célja a húzásra és a billentyűs célmozgatásra nem teljesül.** A látvány megtartásával elérhető rész megvan (a stílusszámítás lépésenként 4 ms). Ami maradt:
  - **az első előnézet:** a határ utáni összes sor 85 ms-os átmenettel 8 px-t mozdul; 436 sornál ez 71–118 ms stílusszámítás és ugyanennyi réteg. Csak látható változással szüntethető meg (egy elemes előnézet: távtartó vagy csak a jel). **Ez a felhasználó döntése.** A szállított feladatok 5–34 sorosak; ott ez a költség nem mérhető.
  - **a későbbi lépések 65–85 ms-a** nagyrészt rétegezés és festés: amíg bármi mozog, a böngésző képkockánként a teljes, 15 ezer csomópontos oldal rétegeit frissíti. Ezt a T1.6 és az F4 csökkentheti.
- **Talált, nem javított eltérés:** a beszúrási jel helye 8–16 px-t tér el attól függően, honnan érkezik a határ (például a 2. határnál lefelé lépve 56 px, felfelé lépve 40 px), mert a jel a szomszéd sor éppen mozgásban lévő helyéhez igazodik. A változtatás ezt bájtra megtartotta; a javítás látható változás volna (jegyzék: NY-62).
- **A T1.2 a hálózati várakozást rövidíti, a befogadást nem:** a 16 feladat lefordítása és ellenőrzése hálózat nélkül 15–48 ms (Node-ban mérve), tehát 64 feladatnál is a tizedmásodperc nagyságrendjében marad. Az előre ellenőrzött katalógusra ezért ma nincs mért ok; a G6 szállítási döntése előtt a szállított katalóguson újra kell mérni.
- **Az elrendezés ideje alig változik:** a kirajzolás első elrendezése (a teljes új oldalé) adja az idő nagy részét, a megszűnt kényszerítések kis részfákat érintettek. A darabszám csökkent; a nagy nyereség az F4 régiós kirajzolásáé.
