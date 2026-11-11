# ADR-127 – Egy folyamatjelző a felhasználó által indított háttérmunkára (P1)

Állapot: **elfogadva** (2026-11-10). Kockázati osztály: megjelenítés, valamint dokumentáció és eszközök; a motor nem változott. A felhasználó kérése: rögzített megoldás és elhelyezés a háttérmunka jelzésére, minimális lecsengéssel, hogy ne villanjon, de ne is maradjon sokáig szem előtt; asztalon és telefonon egyaránt.

## Kontextus

- **A várakozást eddig csak a gomb jelezte:**
  - a felirata „Feldolgozás…”-ra, „Előnézet készül…”-re vagy „Ellenőrzés…”-re cserélődött, a gomb szélessége ugrált;
  - a gyors műveletnél (pl. egy 5 soros forrás vizsgálata) ez villanás volt;
  - a lassúnál (Modell készítése a 436 soros mintán: kb. 1,4 s, egy szabálymódosítás kb. 1,3 s) nem látszott, mennyi ideje tart;
  - a fájl-, munkamenet- és táblás szabálymódosításnál semmi nem jelzett.
- **A mért időtartamok** (Pages, 2026-11-10):
  - Modell készítése: 117 ms (3 sor), illetve 1434 ms (TS minta);
  - Forrás vizsgálata: 279–843 ms;
  - Ellenőrzés: 64–297 ms;
  - szabálymódosítás: kb. 1300 ms;
  - TS minta betöltése: 282 ms.
  
  A műveletek egy része tehát a 400 ms-os küszöb alatt, más része fölötte van: a késleltetés ezért kell.
- **A fordító** (`vendor/typescript.mjs`, 9 MB, tömörítve 1,6 MB) az ADR-125 óta a háttérszál indulásakor töltődött, akkor is, ha a felhasználó csak gyakorolt.

## Döntés

- **Egy modul, egy hely: [activity.ts](../../src/workbench/activity.ts).**
  - A `trackActivity(név, munka, gomb?)` a munkát változatlanul adja vissza, és ha elég sokáig tart, mutatja.
  - A hívónak nincs állapota, és nincs kötelező hívássorrend.
- **Időzítés** (a késleltetett pörgettyű bevett gyakorlata: Nielsen 0,1 s / 1 s / 10 s határai, a `spin-delay` és a Carbon „inline loading” mintája):
  - **400 ms alatt semmi nem jelenik meg.**
  - **Ha megjelent, legalább 600 ms-ig látszik,** így nem villan.
  - **Lecsengés a munka végén:** a vonal 350 ms alatt kitelik, majd a jelző 250 ms alatt elhalványul. Legfeljebb 0,6 s-ig marad a munka után.
  - **3 s-tól a jelző mutatja az eltelt másodperceket.**
  - **Több egyidejű művelet egy helyen jelenik meg:** a legutóbbi nevével. A lecsengés az utolsó befejezésekor kezdődik; ha lecsengés közben új munka indul, a jelző késleltetés nélkül visszatér.
- **Nincs „Kész” felirat.** Eltérés az eredeti tervtől, oka:
  - a műveletek a hibát maguk kezelik és üzenetben írják ki, a jelző tehát nem tudja, sikerült-e a munka;
  - egy hibaüzenet mellett álló „Kész” hamis lenne.
  
  A lecsengést a kitelő vonal mutatja; az eredményt a művelet saját üzenete mondja.
- **Elhelyezés: egy lebegő címke a képernyő alján középen, az aktuális lépés ragadós műveletsávja fölött** (annak tetejéhez dokkolva, 12 px-re; ha nincs beragadt sáv, a képernyő aljától). Ez is eltérés: a terv a sávba tette volna. Indok:
  - **[Biztos] a `view.render()` minden rajzoláskor újraírja a `#app` teljes tartalmát,** és a műveletek futás közben is rajzolnak. A sávban álló jelző eltűnne vagy villogna.
  - **Nem minden nézetben van ragadós sáv:** asztalon az értékelősáv nem ragad, a táblás szabálymódosításnak és a fejlécmenüs megnyitásoknak nincs saját sávjuk.
  - **A dokkolt címke** nem takarja a sáv állapotmondatát és fő gombját, telefonon sem kerül a billentyűzet alá, és minden nézetben ugyanott van.
  - **A felső rétegben (`popover="manual"`) él,** ezért a teljes képernyős munkaterület (`#app` mint fullscreen-elem) és a szabálypanel fölött is látszik. Ahol a Popover API hiányzik, rögzített pozíció és `z-index` a tartalék.
  - **Kattintást nem fog** (`pointer-events: none`).
- **Megjelenés:**
  - a felület tokenjei (`--n-16` háttér, `--n-30` keret, `--accent` vonal, a gombok 3 px-es sarka), világos és sötét témában;
  - 3 px-es határozatlan vonal a címke alján;
  - legfeljebb 440 px, illetve a képernyő szélessége −32 px; a hosszú név kipontozódik.
- **A gomb:**
  - azonnal letiltott és `aria-busy`, a felirata nem változik;
  - az ikonja csak a jelző megjelenésekor válik pörgettyűvé (`data-busy-shown`), így a gyors művelet nem villan, és a gomb szélessége nem ugrik.
- **Képernyőolvasó:** egy állandó, rejtett `role="status"` sor egyszer mondja ki: „Modell készítése folyamatban.”, és csak ha a jelző megjelent. A másodperceket nem olvassa fel, a végén nem szól. A címke maga `aria-hidden`, mert ismétlés volna. A művelet eredményét a lépés saját állapotsora mondja.
- **Csökkentett mozgás:** a vonal áll (halvány, teljes szélességű), és nincs halványítás.
- **Hatókör**, egy listában az `interactions.ts`-ben (`BUSY`), névvel együtt:
  - Ellenőrzés, Modell készítése (a frissítési sávé is), Forrás vizsgálata;
  - JSON alkalmazása, Sorfüggőségek újraszámítása;
  - Formázás (forrás és megoldáskód);
  - TypeScript minta betöltése, Mentett munka megnyitása;
  - a szabálymódosítások (szabály, típus, összekötés, rögzítés).
  
  Kívül a gombkezelőn:
  - forrásfájl, CodeLine JSON- és munkamenetfájl megnyitása;
  - a táblán húzással végzett szabálymódosítás.
- **Az alkalmazás indulása ugyanezt mutatja:** a statikus „Feladatmodell betöltése…” szöveg és alatta a vonal csak 400 ms után jelenik meg (CSS-késleltetéssel, mert ekkor még nem fut szkript). Indítási hibánál a szöveg `role="alert"`, vonal nélkül.
- **A fordító lustán töltődik** (`pages-worker.ts`):
  - csak az első forrást olvasó művelet tölti be: generálás, szabálymódosítás, második kapu, forrásvizsgálat, formázás;
  - a feladatlista, a gyakorlás, a beállítások feloldása és a minta letöltése nélküle fut, így aki csak gyakorol, nem tölti le a 9 MB-ot;
  - sikertelen betöltés után a következő szerzői művelet újrapróbálja;
  - az első ilyen műveletnél a letöltés ideje is a jelzőben látszik.
  - A modul deklarációja `vendor-compiler.d.ts`; az architektúrakivétel (ADR-125) ugyanerre az egy importra szól.

## Két terv („design it twice”)

1. **A jelző a lépés saját műveletsávjában, a nézet rajzolja az állapotból (az eredeti terv, elvetve).**
   - Kellett volna hozzá egy aktivitásállapot a `WorkbenchState`-ben, amelyet minden rajzolás újraír, és egy külön időzítő, amely a sávot rajzolások között frissíti. Az állapotnak így két tulajdonosa lett volna.
   - A sáv nélküli nézetekhez második elhelyezés kellett volna.
2. **Saját, a rajzolástól független elem a felső rétegben, a sávhoz dokkolva (választott).**
   - Az időzítés, a hely és a felolvasás egy modulé.
   - A nézet és a vezérlő nem tud róla.
   - A hívó egyetlen művelete a `trackActivity`.

## Tervezési review (docs/design-review.md)

- **activity.ts:**
  - *elrejti* az időzítést, a több művelet sorrendjét, a dokkolást, a felső réteget, a gomb jelölését és a felolvasást;
  - *interfésze:*
    - `trackActivity` a hívóknak;
    - `createActivity` (óra és rajzoló beadva) a tesztnek;
    - `ACTIVITY_TIMING` a dokumentált értékekkel.
  - A tiszta időzítő és a DOM-rajzoló külön függvény, így az időzítés böngésző nélkül, hamis órával tesztelhető.
- **interactions.ts:** a foglaltság listája (melyik vezérlő vár, mi a neve) egy táblázat lett a korábbi szelektor és háromágú feliratválasztás helyett.
- **Rögzített maradék:**
  - fázisüzenetek („fordító betöltése”, „szabályok ellenőrzése”) és a megszakítás 10 s fölött: ez a P2, lezárta az [ADR-132](132-progress-stage-and-abort.md);
  - a példaválasztó betöltése szinkron, ezért nem jelez;
  - a vágólapról beillesztés formázása nincs a hatókörben, mert a mért idők a küszöb alatt vannak.

## Bizonyíték

- **Egységteszt** ([activity.test.mjs](../../tests/activity.test.mjs), hamis órával):
  - a 400 ms alatti munka semmit nem mutat, és nem hagy időzítőt;
  - a megjelent jelző legalább 600 ms-ig látszik;
  - a lecsengés sorrendje és ideje;
  - a másodpercszámlálás 3 s-tól;
  - hibánál ugyanígy cseng le, és a hiba eljut a hívóig;
  - egy hely több műveletre;
  - a lecsengés közben induló munka.
- **Böngészős teszt** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py)):
  - `activity_indicator`, asztalon és 390 px-es telefonon, visszatartott válasszal:
    - a címke a beragadt sáv fölött és a képernyőn belül áll, nem szélesíti az oldalt;
    - a név, a felolvasott sor és a gomb pörgettyűje rendben van;
    - 3 s-tól számol;
    - a fázisok sorrendje: fut, kitelik, halványul, eltűnik; utána nem marad jelölés;
  - `lazy_compiler`: a Pages-en betöltés és gyakorlás alatt a fordító nem töltődik le, az első Modell készítése pontosan egyszer tölti le.
- **Pages-build teszt:** a háttérszál nem importálja statikusan a fordítót, csak dinamikusan.
