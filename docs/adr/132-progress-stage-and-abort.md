# ADR-132 – A folyamatjelző fázisa és a megszakítás 10 s után (P2)

Állapot: **elfogadva** (2026-11-11). A felhasználó a javasolt sorrend szerint kérte (P1 után a P2). Kockázati osztály: megjelenítés, valamint dokumentáció és eszközök; a motor, a szabályok és az értékelés nem változott. Az [ADR-127](127-one-progress-indicator.md) „rögzített maradéka”.

## Kontextus

- **A P1 jelzője csak a művelet nevét és az eltelt másodperceket mutatta.**
  - A Local Demo első szerzői műveleténél a fordító letöltése (1,6 MB tömörítve) a várakozás nagy része lehet, lassú hálózaton másodpercekig, és ezt semmi nem nevezte meg.
- **Nem volt kiút egy elhúzódó műveletből.**
  - Nielsen 10 s-os határa: e fölött a felhasználónak tudnia kell, hogy leállíthatja a várakozást.
  - A Local Demo háttérszála egy 500 soros mély forrásnál vagy egy elakadt letöltésnél a gombot és a lépést foglalva tartotta, amíg a munka véget nem ért. Csak az oldal újratöltése segített, ami a nem mentett munkát is elvitte.
  - A szerveres módban a kérésnek nem volt megszakítója.

## Döntés

- **Fázis a név után** (`activityDetail`):
  - a jelző a legutóbbi munka fázisát a név után, halványan mutatja („Modell készítése… · a TypeScript-fordító betöltése”), és a képernyőolvasó sora is kimondja;
  - ma egy fázist nevezünk meg, a fordító letöltését (`pages-worker.ts`): ez az egyetlen mért, a felhasználó számára érthető és a hálózattól függő szakasz. A generálás belső lépései (elemzés, minősítés) gyorsak és belső fogalmak, ezért nem kapnak nevet.
- **Fázis a határon át** (`worker-rpc.ts`):
  - a `serve(port, műveletek, {progress: true})` minden műveletnek első argumentumként egy jelentőt ad; a hívó oldal `connect(port, hiba, onProgress)` hallja a még várakozó hívás fázisát. Válasz után érkező fázist nem ad tovább.
- **Megszakítás 10 s után:**
  - a jelzőn „Megszakítás” gomb jelenik meg, ha az oldal regisztrált megszakítót (`setActivityAbort`), és a legrégebbi még várakozó munka 10 s óta tart. A képernyőolvasó sor egyszer hozzáteszi: „Sokáig tart; a Megszakítás gombbal leállítható.”;
  - a gomb nem veszi el a fókuszt; csak a gomb fog kattintást (a címke többi része továbbra is átengedi);
  - a jelző maga soha nem hívja a megszakítót, csak a gomb.
- **Mit jelent a megszakítás** (az `api` modul tudja, a felület nem):
  - **szerveres mód** (`public/app/api.js`): minden folyamatban lévő kérés `AbortController`-rel megszakad, és az üzenet: „A műveletet megszakítottad. A szerver a már elkezdett számítást befejezi, az eredményét eldobjuk.” A szerver szinkron számítása nem szakítható meg; ezt az üzenet kimondja;
  - **Local Demo** (`local-demo.ts`): a háttérszál leáll (`terminate`), minden várakozó hívás ugyanazzal az üzenettel hiúsul meg: „A műveletet megszakítottad. A Local Demo háttérszála újraindult; ha volt kész modell, készítsd el újra.” A következő hívás új háttérszálat indít.
    - **Az új háttérszál először újratölti a szállított feladatokat,** mert az oldal a régitől kapta a listát; enélkül a gyakorlás minden ellenőrzése „nem érhető el” hibát adna. A hívás ennek végét megvárja.
    - **A régi háttérszál szerzői előnézetei elvesznek.** Egy régi előnézetre hivatkozó Próba ellenőrzés a meglévő „Érvénytelen vagy lejárt szerzői előnézet.” hibát kapja; az üzenet ezért kéri az újrakészítést.
  - **Tétlen megszakítás nem csinál semmit:** a `Connection.cancel` hamisat ad és nyitva hagyja a kapcsolatot, ha egy hívás sem vár. Így egy nem a háttérszálon futó hosszú munka (pl. fájlolvasás) megszakítása nem dobja el a háttérszálat és az előnézeteit.
- **A megszakított Ellenőrzés** „Nem eldönthető” jelentése a megszakítás saját üzenetét mutatja, nem azt, hogy a szerver nem érhető el.

## Két terv („design it twice”)

1. **Megszakítás minden műveletnél saját gombbal, a műveletsávban.** Elvetve: a P1 szerint a műveletsáv minden rajzoláskor újraíródik, és minden művelet saját megszakítási állapotot hordana a nézetben. A műveletek többsége 1 s alatt végez, ott a gomb csak zaj volna.
2. **Egy megszakító a folyamatjelzőben, 10 s után (választott).** A jelző tudja, mióta várunk; az `api` modul tudja, hogyan áll le a várakozás. A felület egy sorral köti össze őket (`setActivityAbort(abortPending)`).

## Tervezési review (docs/design-review.md)

- **activity.ts:**
  - *elrejti*, mikor ajánlja fel a megszakítást (a legrégebbi várakozó munkától 10 s, pontosan akkor rajzol), és a fázis megjelenítését;
  - *interfésze* két új művelettel bővül: `activityDetail(szöveg?)`, `setActivityAbort(megszakító)`. Hívóik: a `local-demo` (fázis) és a `ui.js` (megszakító egyszeri bekötése).
- **worker-rpc.ts:**
  - *elrejti* a fázisüzenet alakját és a hívásazonosítóhoz kötését;
  - a `connect` eredménye `Connection`: hívható, és van `cancel(üzenet): boolean` művelete. A tétlen eset nem hiba, hanem „nincs mit leállítani” (a hibát a definícióval tüntetjük el).
- **local-demo.ts:** elrejti, hogy a megszakítás a háttérszál leállítása, és hogy az újraindult szál a feladatokat újratölti. A hívó nem tud a háttérszálról.
- **Átmeneti JS-határ (ADR-001):** a `public/app/api.js` és a `public/ui.js` egy-egy szűk bekötést kapott; új szabály nem került beléjük.
- **Rögzített maradék:**
  - a szerver a megszakított számítást befejezi (szinkron motor, ADR-125 óta a Local Demo-ban háttérszál, a szerveren nem);
  - más fázist ma nem nevezünk meg;
  - a gomb a felső rétegben, a dokumentum végén áll: billentyűzettel a lap végéről (Shift+Tab az oldal elejéről) érhető el, külön gyorsbillentyűje nincs.

## Bizonyíték

- **Egységteszt, hamis órával** ([activity.test.mjs](../../tests/activity.test.mjs)):
  - a fázis a 400 ms után jelenik meg, törölhető, ugyanaz a fázis egyszer rajzol;
  - a megszakítás pontosan 10 000 ms-nál jelenik meg, és csak regisztrált megszakítóval;
  - a 10 s a legrégebbi várakozó munkától számít, akkor is, ha egy újabb nevét mutatja;
  - a már 10 s óta tartó munkánál a regisztráció azonnal felajánlja;
  - a jelző maga nem hívja a megszakítót.
- **Egységteszt** ([worker-rpc.test.mjs](../../tests/worker-rpc.test.mjs)): a fázis eljut a várakozó hívóhoz, válasz után nem; a `cancel` minden várakozó hívást ugyanazzal az üzenettel hiúsít meg és lezárja a kapcsolatot; tétlenül nem csinál semmit, és a kapcsolat működik tovább.
- **Böngészős teszt** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py), `activity_abort`, szerveres és Pages módban, visszatartott kéréssel, illetve visszatartott fordítóletöltéssel):
  - Pages-en a fázis („a TypeScript-fordító betöltése”) a címkén és a felolvasott sorban;
  - 9 s-nál még nincs gomb, utána megjelenik, és a felolvasott sor kimondja;
  - a gomb után a jelző eltűnik, a megszakítás üzenete látszik, a gomb újra használható;
  - utána a Modell készítése sikerül, és egy szállított feladat ellenőrzése is működik. Mutációs próba: az újraindult háttérszál feladat-újratöltését kikapcsolva ez a lépés elbukik.
