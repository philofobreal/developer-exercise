# Changelog

## Unreleased – 2026-11-11 P2: a folyamatjelző megnevezi a fázist, és 10 s után megszakítható (ADR-132)

- **A Local Demo első szerzői műveleténél a jelző kiírja, hogy a TypeScript-fordító töltődik.**
- **10 s várakozás után a jelzőn „Megszakítás” gomb jelenik meg.**
  - Szerveres módban a kérés megszakad; a szerver a már elkezdett számítást befejezi, az eredményét eldobjuk.
  - A Local Demo-ban a háttérszál újraindul; a kész szerzői előnézetet újra el kell készíteni, a szállított feladatok gyakorlása tovább működik.
- A szabályok és az értékelés nem változtak.

## Unreleased – 2026-11-10 v57: a kulcssorrend miatti szabály megmondja az okát (ADR-131)

- **A szabálypanel a kulcssorrend miatti kötésnél a valódi okot mutatja:** `key-creation-order`, és jelzi, hogy a „Nem számít” beállítás feloldja. Eddig ugyanez „kiértékelési fázis” vagy „objektumírás” okkal jelent meg.
- **A súgó és a beállítás szövege** megnevezi, hogy „Számít” mellett a hívó (például egy teszt) felsorolása is számít.
- Az elfogadott sorrendek nem változtak.

## Unreleased – 2026-11-10 v56: „Számít” a hívó felől is (ADR-130, NY-36)

- **Javítva egy helyességi hiba:** „Számít” kulcssorrendnél eddig szabad volt egy objektum kulcsainak sorrendje, ha a program maga nem írta ki őket, akkor is, ha az objektumot visszaadta vagy a hívó maga is létrehozhatta.
  - A hívó (például egy teszt) kiírhatja a kulcsokat, így a tanuló rossz sorrendje is elfogadott volt.
  - A szállított `class-accounts-ts` példánál ez 51 hibás sorrendet jelentett egy kiíró hívó mellett.
  - Most ezek a sorrendek kötöttek.
- **Ami bizonyítottan nem jut ki** (függvényen belüli objektum, csak a tagjain keresztül használva), az továbbra is szabad. Az `accessor` mező sorrendje mindig szabad, mert a kulcsfelsorolás nem látja.
- **A `class-accounts-ts` példa (rev 4)** „Nem számít” kulcssorrend-beállítást kapott, ahogy a leírása ígéri; az elfogadott sorrendjei nem változtak.
- **Három TS minta** (`01-user-account`, `01-user-account.values-only`, `04-declare-fields`) szigorúbb lett, mert ott a kulcssorrend a hívó felől megfigyelhető.

## Unreleased – 2026-11-10 v55: változót olvasó objektumtulajdonságok (ADR-129, NY-35)

- **A `start: origin` és a rövidített `{ name, age }` tulajdonságsor is felcserélhető,** ha az olvasott név egy paraméter, egy `var`, vagy egy már bizonyítottan inicializált `let`/`const`.
- **Ami kötve marad, mert dobhat vagy kódot futtathat:**
  - két olyan kötés, amelynek olvasása az inicializálás előtt történhet (a sorrend dönti el, melyik hiba jön);
  - nem deklarált globális név, import, `catch` paraméter, `eval`.
- **Talált régi hiba (NY-36, döntésre vár):** „Számít” mellett egy visszaadott osztálypéldány mezősorrendje szabad volt, holott a hívó kiírhatja a kulcsokat.
- A szállított példák és minták szabályai nem változtak.

## Unreleased – 2026-11-10 v54: objektumliterál sorai és horog csak a futó kódban (ADR-128)

- **Javítva: egy többsoros objektumliterál tulajdonságsorai felcserélhetők, ha az értékük literál.**
  - Eddig egy utasítás „folytatósorai” voltak, a kulcssorrend-beállítástól függetlenül kötve.
  - Most „Nem számít” mellett szabadok.
  - „Számít” mellett is szabadok, ha az objektum egy függvényen belüli változóban áll, és a program csak a tagjain keresztül használja.
  - Ha kiírja, visszaadja vagy átadja az objektumot, a sorrend marad. Az ok ilyenkor a kulcssorrend, és a szerző feloldhatja.
- **A vessző nélküli utolsó tulajdonság a végén marad** (új okkód: `list-tail`).
- **NY-34:** a típusban vagy megjegyzésben álló `Function`, `Symbol.`, `Proxy` nem teszi többé szigorúvá az „érvényes adat” elemzést.
- A szállított példák és minták szabályai nem változtak. Új nyitott tétel: NY-35, a változó értékű tulajdonságsorok (`start: origin`).

## Unreleased – 2026-11-10 egy folyamatjelző a háttérmunkára; a fordító csak szerzői műveletnél töltődik (ADR-127)

- **Ha egy művelet 0,4 másodpercnél tovább tart, a képernyő alján, a műveletsáv fölött egy címke mutatja a nevét:** Modell készítése, Forrás vizsgálata, Ellenőrzés, szabálymódosítás, Formázás, JSON alkalmazása, fájl, minta vagy mentett munka megnyitása.
  - 3 másodperctől a címke számolja a másodperceket.
  - Ha megjelent, legalább 0,6 másodpercig látszik, így nem villan.
  - A munka végén a vonala kitelik, és fél másodpercen belül eltűnik.
  - A gomb felirata nem változik; az ikonja ilyenkor pörgettyű.
  - A képernyőolvasó egyszer mondja ki, hogy a művelet folyamatban van.
- **Az indulás ugyanígy jelez:** a „Feladatmodell betöltése…” felirat csak akkor jelenik meg, ha a betöltés tart.
- **A Local Demo a TypeScript-fordítót (9 MB) csak az első szerzői műveletnél tölti le.** Aki csak gyakorol, nem tölti le.

## Unreleased – 2026-11-10 „érvényes adat → szigorú lett”: a bemeneti szerződés oka és sora (ADR-126)

- **Az Elemzés és szabályok lépés megmondja, ha a kód miatt nem érvényesült az „érvényes egyszerű adat” beállítás.** Például: „Bemenetek: érvényes egyszerű adat → szigorú lett, mert a 7. sor „Proxy”: ezzel a program megváltoztathatja, mit csinál egy tulajdonság olvasása.”
  - A sorszámra kattintva a Kód lépés ott nyílik meg.
- **A modell rögzíti az okot és a sort,** így munkamenet- és JSON-betöltés után is látszik. A szabályok nem változtak.
- **Kiderült:** a 436 soros TypeScript-mintánál a `func: Function` típusnév teszi szigorúvá az elemzést, holott a típus nem fut. Ez új nyitott tétel (NY-34).

## Unreleased – 2026-11-10 a Local Demo nem áll meg modellkészítés közben (ADR-125)

- **A Pages-en a modellkészítés háttérszálon fut.** A 436 soros TypeScript minta elemzése alatt a felület eddig kb. 2,4 másodpercig nem reagált; most a leghosszabb megakadás kb. 0,14 másodperc.
- **A TypeScript-fordító is a háttérszálban töltődik be,** a főoldal így gyorsabban indul.
- **Javítva:** a Szabályok lépés kirajzolásakor minden szabályvezérlő a teljes modellt újraszerializálta. Nagy modellnél ez magában fél másodperc volt, és a szerveres módban is lassított.

## Unreleased – 2026-11-10 lezárás: a kijelölt sor teljes szövege, frissített jegyzék (F6)

- **Telefonon a kijelölt sor egészében olvasható:** a sor sávja a teljes kódsort mutatja, tördelve, akkor is, ha a listában csak az eleje fér ki (NY-27 lezárva).
- **A nyitott tételek jegyzéke** ([docs/nyitott-tetelek.md](docs/nyitott-tetelek.md)):
  - a fejléc a mai állapotot és szabályverziót írja (v53);
  - az utóbbi döntések rögzített maradékai új tételek: NY-29 „érvényes adat → szigorú” jelzés, NY-30 a felületek összevonása, NY-31 a súgó „Kipróbálom” gombja, NY-32 modellkészítés háttérszálon, NY-33 a v3 egységmodell.

## Unreleased – 2026-11-10 súgó egy forrásból, ellenőrzött példákkal (ADR-124)

- **Súgóoldal** (`help/index.html`):
  - a beállítások, a feladat állapota, a minősítés, a leletek, az okkódok és a nehéz helyzetek;
  - tartalomjegyzék és keresés, témánként állandó hivatkozás;
  - ugyanaz a megjelenés, világos és sötét témában.
- **Minden példa egyben teszt:** a kilenc beállítás mindegyikéhez van egy kódpélda („a 3. és 4. sor cseréje: elfogadva / elutasítva”), és a teszt a valódi elemzővel és kiértékelővel futtatja. Ha a viselkedés változik, a súgó tesztje jelez.
- **ⓘ a címkék mellett:**
  - a beállításoknál, a három állapotkérdésnél, a minősítésnél, a szabálytípusoknál és a leleteknél;
  - kattintásra buborék nyílik egy-két mondattal, a példával és a „Részletek a súgóban” hivatkozással, amely új lapon nyit;
  - Escape-re vagy máshová kattintva bezárul.
- **Egy szöveg:** a beállítás alatti rövid leírás, a buborék és a súgóoldal ugyanabból a forrásból készül.

## Unreleased – 2026-11-10 a lazító kézi szabály megnevezése (ADR-114 kiegészítés, B2)

- **A minősítés megnevezi a lazítást.** Ha egy kézzel írt modell egy generált sorrendi kötést nem tartalmaz, és az a saját szabályaiból sem következik, a lelet felsorolja, melyik kötésről van szó (például „#1 → #3”). Az általános „eltérnek az újragenerálástól” helyett áll.
- **Ha a modell egyszerre szűkít is,** a szűkítő szerzői szabályok leletje mellette marad.

## Unreleased – 2026-11-10 három lépés új feladatkiosztással, egy csontváz (ADR-123)

- **Új lépések:** Kód → Elemzés és szabályok → Próba és kiadás.
  - **Kód:** a forrás, a nyelv és a vizsgálati beállítások (TS-diagnosztika, checkJs, helyi objektumállapot, Nem eldönthető eredmények).
  - **Elemzés és szabályok:** a feladat állapota, az elemzési környezet (bemenetek, kulcssorrend, osztálymezők, importok) és a hordozhatósági profil, mellette a szabályok.
  - **Próba és kiadás:** a tanulói próba, a feladat címe, leírása és szintje, és a JSON exportálása.
- **A cím, a leírás és a szint módosítása nem kér újraelemzést:** a modellt helyben írja át, és egyik lépés sem lesz elavult.
- **Beállítás-módosítás után** az elavultsági sáv megmondja, hogy a beállítás változott, és felajánlja a modell újrakészítését.
  - Ha kézi szabálydöntés veszne el, előre jelzi.
  - Utána kiírja, hány szabály volt és hány lett.
- **Egy csontváz:**
  - kontextussáv (cím és lépéssor egy sávban);
  - lépésenként egy ragadós műveletsáv alul: balra vissza, középen az állapot, jobbra a fő művelet;
  - egy értesítésforma (4 px-es színes csík);
  - címsorszintek: h1 feladat, h2 lépés, h3 panel.
- **Álló telefonon is egysoros fejléc:** logó, a két mód ikonként, munkamenet, téma, teljes képernyő.

## Unreleased – 2026-11-10 a feladat állapota a tanárnak: három kérdés, egy következő lépés (ADR-122)

- **Állapotkártya a Szabályok lépés tetején.** Három kérdés, mindegyikre egy szó (Igen / Részben / Nem), egy mondat és legfeljebb egy gomb:
  - **Kitölthető?** Elfogadott-e a referencia, eldőlt-e a forrás vizsgálata, és nem hosszabb-e 100 sornál.
  - **Ellenőrizhető?** Minden tanulói sorrendre eldönthető-e a válasz (publikálható-e).
  - **Igazságos?** Nem utasít-e el helyes sorrendet. Ha igen, megmondja, mely óvatos szabályok miatt, és a **Megmutatom** gomb megnyitja őket.
- **Következő lépés:** a kártya alján egy teendő egy gombbal. Hibánál „Vissza a forráshoz”, egyébként „Tovább a próbához”.
- **Leletek okonként:** a 11 feloldatlan import egy sor („Nem eldönthető · 11 sor · Hiányzó projektkontextus…”). A sorok lenyitva elérhetők, és mindegyik a forrásba ugrik.
- **Egy sorszámozás:**
  - a Minősítés is a forrásszerkesztő sorszámát mutatja (eddig ugyanaz a sor „2.” volt ott, a Forrásban „3.”);
  - más lépésből kattintva a Forrás nyílik meg a sornál.
- **A lépéssor egy szókészlete:** Kész, Figyelem, Hiba, Zárolt, Elavult.
  - A „Hibás forrás”, a „Figyelmeztetéssel” és a „Zárva” megszűnt.
  - A forrás szava gépelés közben azonnal frissül.

## Unreleased – 2026-11-09 javítás: érintőképernyőn újra elérhetők a sor kapcsolatai (ADR-118 kiegészítés)

- **Javítva:** az érintéses sávból kimaradt a sor kör alakú kapcsolat-vezérlője. Telefonon a Próba rendezőjében így nem lehetett megjelölni egy sor kapcsolatait, és két sor között szabályt felvenni sem.
- **Most a kijelölt sor sávjában:**
  - **Kapcsolatok:** megjelöli a sor kapcsolatait; kék, aminek előtte, borostyán, aminek utána kell állnia;
  - **Kapcsolatok elrejtése**;
  - egy másik sort kijelölve **Kapcsolat a(z) #N sorral:** szabály felvétele vagy törlése a két sor között.

## Unreleased – 2026-11-09 kódszerkesztő kiemeléssel és automatikus formázással (ADR-121)

- **Színes kód mindenhol:**
  - a forrás, a CodeLine JSON és a megoldáskód szerkesztője is kiemeli a kódot;
  - a szabálypanel, a függőségi tábla és a soronkénti megfeleltetés kódrészletei is színesek.
- **Kényelmesebb gépelés:**
  - Enter után a következő sor ugyanott kezdődik, és nyitó zárójel után beljebb;
  - egy `}` a megfelelő szintre lép vissza;
  - a Tab és a Shift+Tab kijelölt sorokat is beljebb vagy kijjebb tol.
- **Automatikus formázás betöltéskor:**
  - az egysoros vagy rosszul tördelt forrás (fájlból, a TypeScript mintából vagy üres szerkesztőbe beillesztve) formázva érkezik; a Visszavonás visszahozza az előzőt;
  - a már rendesen tördelt forrás megtartja a saját behúzását;
  - a beillesztett JSON tördelve jelenik meg.
- **A tanuló kódját soha nem formázzuk automatikusan:** a kiértékelés pontosan azt kapja, amit beírt. A Formázás gomb megmarad.

## Unreleased – 2026-11-09 nem kattintható, amit most nem lehet, és megmondja, miért (ADR-120)

- **Letiltva, okkal:** ami most nem lehetséges, az halványan, de elérhetően látszik. Ha rákattintasz, mellette megjelenik, miért nem, és mit tegyél. Eddig kattintás után jött a hibaüzenet.
  - Modell készítése: forrás nélkül, illetve ha a modell naprakész.
  - Forrás vizsgálata: forrás nélkül.
  - Mentett munka megnyitása: ha ebben a böngészőben nincs mentés.
  - Újrakezdés: üres megoldásnál.
- **Egyszerre egy piszkozat:** amíg a CodeLine JSON-ban vagy a forrásban alkalmazatlan változtatás van, a szabályok vizuális szerkesztése szünetel. A felület kiírja, miért, és hogyan folytathatod (alkalmazás vagy elvetés).
- **Billentyűzettel és képernyőolvasóval is:** a letiltott gomb fókuszálható marad, és az oka is elhangzik.

## Unreleased – 2026-11-09 egy fogalom, egy szó (ADR-119)

- **Az Ellenőrzés mostantól csak a tanuló megoldásáé.**
  - A forrás vizsgálatának gombja: **Forrás vizsgálata**.
  - A modell besorolása: **Minősítés**.
- **Megnyitás és alkalmazás szétválik:**
  - ami kívülről hoz be tartalmat, az **Megnyitás…** (JSON megnyitása…, Forrásfájl megnyitása…);
  - ami élessé teszi a piszkozatot, az **Alkalmazás** (JSON alkalmazása).
- **Munkamenet:** Mentés a böngészőbe, Mentett munka megnyitása, Exportálás fájlba…, Importálás fájlból….
- **Más új nevek:**
  - **Újrakezdés** (eddig Visszaállítás, pedig a megoldást üríti);
  - **Sor szabályai** (eddig Szabályok, mint a lépés neve);
  - **Kód frissítése a rendezőből**;
  - **Mintamegoldás kitöltése**;
  - **Változtatások elvetése**;
  - **TypeScript minta (436 sor)**.
- **Szótár és íráskönyv:** a `docs/szotar.md` rögzíti őket. Egy teszt tiltja, hogy a régi szavak visszakerüljenek a felületre.

## Unreleased – 2026-11-09 érintésen a sor műveletei alul, nem a kódon (ADR-118)

- **Tiszta kódsorok érintőképernyőn:** a rendező soraiban már nincsenek gombok, amelyek eltakarnák a kód végét.
- **Koppints a sorra:**
  - a kódra vagy a fogantyúra koppintva kijelölöd a sort;
  - alul megjelennek a műveletei: felhasználható sornál Beszúrás, megoldássornál Feljebb, Lejjebb és Vissza a sorokhoz;
  - a szerzőnek a Sor szabályai is, mindkettőnél a Kész;
  - a Feljebb és a Lejjebb után a kijelölés a soron marad, így többször is léptetheted.
- **Koppintással áthelyezés:** a kijelölt sort továbbra is a helyére koppintva teheted le.
- **A szabálypanel telefonon alsó lap:** az eszköztár fölötte látszik, és a fejlécéből bezárható.
- **Egérrel és billentyűzettel minden marad a régiben.**

## Unreleased – 2026-11-09 egységes gombok (ADR-117)

- **Minden akciógomb ugyanúgy néz ki:** egy betűméret és -súly, két magasság (alap és kicsi). Érintőképernyőn mindkettő nagyobb. Eddig 34-féle gombstílus volt a felületen.
- **Négy szerep, mindig ugyanazzal a formával:** fő (kék, lecsípett sarok), másodlagos (keretes), szöveges és veszélyes. A tanuló Ellenőrzés gombja sárga marad.
- **Javítva:** asztalon nem vágódik le a téma gomb felirata.
- **Az elrendezés-kapu ezt is méri:** egy nézetben legfeljebb három gombmagasság és egy betűstílus lehet.

## Unreleased – 2026-11-09 fekvő telefon és egységes gombok (ADR-116)

- **Fekvő telefonon a kód az első képernyőn van:**
  - a fejléc, a cím, a lépéssor és az eszköztár egy-egy sor;
  - a listák kitöltik a képernyőt.
- **Fókusz mód fekvő telefonon:** a kódlisták eddig 16 px magasra zsugorodtak, most a képernyő nagy részét kapják. A cím, a Local Demo sáv és a részletek fókuszban rejtve maradnak.
- **Javítva:**
  - nem marad üres az oldalsáv, ha a feladatlistát keskeny nézetben becsuktad;
  - a fejléc nem lóg ki a képernyőből 850 és 1000 px között.
- **Egyforma gombok:** érintőképernyőn egy eszköztársor minden gombja egyforma magas.
- **Álló telefonon** az eredménysáv egy sor, és nem takarja a listákat.
- **Új elrendezés-kapu** (`npm run test:browser:layout`): hat képernyőméreten, két témában méri ezeket, minden futáskor.

## Unreleased – 2026-11-09 a példa kiválasztáskor betöltődik (ADR-115)

- **Egy lépéssel kevesebb:** a Forrás lépés Megnyitás menüjében a példa a listából kiválasztva azonnal betöltődik. A „Példa betöltése” gomb megszűnt.
- **Visszavonás:**
  - a betöltés üzenete mellett megjelenik a Visszavonás gomb, amely visszahozza a korábbi forrást;
  - addig használható, amíg a betöltött forrást nem szerkeszted;
  - ugyanez érvényes a TS tesztfájlra, a forrásfájlra és a „Saját feladat ebből” műveletre is.

## Unreleased – 2026-11-09 a kézzel szűkített modell „Szerzői módosítás” (ADR-114)

- **Ugyanaz a szigorítás, ugyanaz a minősítés:** ha a modell JSON-ját kézzel szigorítod, és a szabályaid minden generált sorrendi kötést tartalmaznak (akár közvetve), a minősítés „Szerzői módosítás”, nem „Nem igazolt”. Eddig ezt csak a Szabályok panelen hozzáadott szabály kapta meg.
  - Az ilyen modell „Tilt” mellett is megnyitja a Próbát, és publikálható.
  - A lelet kiírja, hogy a szabályok eltérnek az újragenerálástól, de bizonyítottan csak szűkítenek.
- **Változatlanul „Nem igazolt”:** ha egy generált kötés nem következik a szabályaidból (lazítás), ha a blokkszerkezet más, vagy ha egy szerzői kötést elemzői okkal jelölsz.
- **Érintett minta:** `01-user-account.values-only` („csak name/id érték szerinti” változat).

## Unreleased – 2026-11-08 teljes ellenőrzés a Local Demóban és a Forrás lépésben (ADR-113)

- **A Local Demó ugyanúgy ellenőriz, mint a szerver:** a demó betölti a TypeScript szabványos könyvtárát. Így a nyelvi hibákat (például típushibát) a demó is felismeri, és minden elemzési beállítás választható, a „Tilt” is. Ha a könyvtár nem töltődik be, a demó a korábbi módon jelzi, mi érhető el csak szerveren.
- **Forrás ellenőrzése:**
  - új gomb a Forrás lépésben: a választott beállításokkal ellenőrzi a referenciát, modell készítése nélkül;
  - a talált hibák sorszámmal és érthető magyarázattal jelennek meg, a sorszámra kattintva a szerkesztő a hibás sorra ugrik;
  - ha nincs hiba, ezt is kiírja.

## Unreleased – 2026-11-08 javítás: egy behúzás a Forrásban, a Szabályokban és a Próbán (ADR-112)

- **Javítva:** ugyanaz a kód a Forrás szerkesztőben, a Szabályok táblán és a Próba rendezőben háromféle behúzással jelent meg.
  - Egy többsoros deklaráció folytatósorai (`t = Infinity,`) a táblán túl mélyen, a rendezőben túl sekélyen álltak.
  - A visszaadott objektum tulajdonságai a rendezőben a sor elejére kerültek.
- **Most:** a tábla és a rendező ugyanúgy húz be, és a helyes sorrendben pontosan a formázott forrást mutatja. A rendezőben a beágyazás továbbra is a te elrendezésedet követi, nem árulja el a helyes megoldást.

## Unreleased – 2026-11-08 javítás: a fókusz gyors ki-be kapcsolása nem hagy teljes képernyőt (ADR-110)

- **Javítva:** ha a Fókusz gombot gyorsan kétszer megnyomtad, lassabb gépen az oldal teljes képernyőn maradhatott fókusz nélkül. A CI-futás ezt mutatta ki.

## Unreleased – 2026-11-08 a Formázás sorokra tördel (ADR-111)

- **Soronként egy utasítás:** a Formázás most az egysoros vagy rosszul tördelt kódot is sorokra bontja, az eredeti ngDynamic megoldás mintájára.
  - Minden utasítás, osztály- és interfésztag, valamint `case`-ág külön sorba kerül.
  - A sorvégi záró kapcsos zárójel is saját sort kap; a `} else {` együtt marad.
- **Biztonság:** a formázás csak szóközt és sortörést változtat. Ha a kód szerkezete változna, nem formáz. Az objektumliterálok egy sorban maradnak.

## Unreleased – 2026-11-08 Formázás gomb, Local Demo jelzés, fókuszsáv (ADR-110)

- **A Formázás gomb újra látható:** feliratos gomb a Referenciaforrás címsorában. Eddig keret nélküli ikon volt, ezért nem lehetett észrevenni.
- **Kisebb Local Demo jelzés:** a cím alatt egy rövid „Local Demo” jelvény. A magyarázat a jelvényre mutatva olvasható; a magyarázó sáv az „Értem” gombbal elvethető, és utána nem jön vissza.
- **Fókusz mód:**
  - keskeny sávot kap a logóval;
  - ha a teljes képernyős oldalnézetből lépsz fókuszba, a kilépés oda tér vissza, és a teljes képernyő megmarad.

## Unreleased – 2026-11-08 a kulcsok darabszáma nem köti a sorrendet (ADR-109, v53)

- **Kevesebb fölösleges szabály:** ha a program csak a kulcsok számát olvassa (például `Object.keys(o).length`), a kulcsokat létrehozó sorok egymás közötti sorrendje már nem kötött, akkor sem, ha a kulcssorrend „Számít”. A darabszám olvasása továbbra is az írások után marad.
- **Változatlanul kötött:** ahol a sorrend látszhat: első kulcs, a teljes lista, `JSON.stringify`, `for…in`, spread, vagy ha a program a `Object`-et sajátjával helyettesíti.
- **Mérés:**
  - 418 programon egyetlen korábban elfogadott sorrend sem lett elutasítva;
  - a 16 gyakorlófeladat és a TypeScript-minták szabályai nem változtak, csak a szabályverzió címkéje.

## Unreleased – 2026-11-07 szerzői preflight: tesztkorpusz, mérés és árnyékfuttatás (ADR-108, E9–E10)

- **Tesztkorpusz:** a terv minimális esetei teljes úton tesztelve. A biztos hibákat (például inicializálás előtti hozzáférés) megállítja; a hiányzó projektkörnyezetet nem jelöli hibásnak.
- **Árnyékfuttatás a 41 szállított modellen:**
  - 39 modell minden beállítással átmegy;
  - a szándékosan hibás mintát az ellenőrzés továbbra is megállítja;
  - egy szerzői szabályokkal szűkített minta figyelmeztetéssel nyílik meg (a „Tilt” beállítás mellett nem).
- **Mérés:** az első ellenőrzés 500 soros forráson legfeljebb kb. 0,4 másodperc. Újramérhető: `node scripts/preflight-measure.mjs`.

## Unreleased – 2026-11-07 javítás: a Local Demóban nem választható „Tilt” (ADR-108, C16)

- **Javítva:** a Local Demóban (Pages) nem fut nyelvi ellenőrzés. A „Nem eldönthető eredmények: Tilt” beállítással ezért egyetlen modell sem készülhetett, és a hibaüzenet nem mondta meg, miért.
- **Most:**
  - a „Tilt”, a JavaScript-típusellenőrzés és a szigorú TypeScript-diagnosztika ott letiltott, „(csak szerveren)” felirattal és indoklással;
  - egy szerveren mentett munkamenet ezekkel a beállításokkal is betölthető a demóban: a két diagnosztika ott nem fut, és ezt a felület jelzi.

## Unreleased – 2026-11-07 szerzői preflight: munkamenet v2 és régi modellek (ADR-108, E8)

- **A munkamenet megőrzi az elemzési beállításokat:** a mentett munkamenet a modell mellett a beállításokat is rögzíti, és betöltéskor visszaadja őket (például a „Tilt” vagy a kikapcsolt objektumállapot-ellenőrzés).
- **Régi munkamenet és JSON-modell:**
  - továbbra is betölthető;
  - a hiányzó beállításokat az új feladat kezdőértékével ellenőrizzük;
  - a felület jelzi, hogy az eredeti forrás és a beállítások hitelessége részleges.
- **Biztonság:** hibás vagy ismeretlen beállítást tartalmazó munkamenet nem töltődik be. A betöltött modell mindig újra átmegy mindkét ellenőrzésen.
- **Javítva:** a modell JSON-jának szerkesztése után a szerző elemzési beállításai (például a „Tilt”) nem állnak vissza a kezdőértékre.

## Unreleased – 2026-11-07 javítás: a Próba megnyitása nem küld külön kérést (ADR-108, E6)

- **Javítva:** gyorsabb gépen a szerző gyors egymás utáni műveletei túlléphették a szerver percenkénti kéréskorlátját, és ilyenkor a modellkészítés vagy a Próba megnyitása csendben elmaradt. Ez buktatta az E6 és az E7 CI-futását.
- **Most:** a Próba lépés a modell saját ellenőrzési döntéséből nyílik meg, külön szerverkérés nélkül. Minden előnézeti értékelést a szerver továbbra is ellenőriz.
- **Új:** a lépéssoron „Zárva” jelzi, ha a Próba a „tilt” beállítás miatt nem nyitható meg.

## Unreleased – 2026-11-07 szerzői preflight: beállítások, zárolások és leletek a felületen (ADR-108, E7)

- **Csoportosított elemzési beállítások:** Elemzési környezet, Forrás biztonságossága, Haladó profil. Új vezérlők: helyi objektumállapot, JavaScript típusellenőrzés (checkJs) vagy TypeScript-diagnosztika a nyelv szerint, a nem eldönthető eredmények kezelése és a hordozhatóság. A másik nyelv opciója nem jelenik meg.
- **Érthetőbb feliratok:** „alapértelmezett” helyett „új feladat kezdőértéke” és „régi modellek kompatibilitási értéke”.
- **Zárolás magyarázattal:**
  - A konzervatív profil letiltja a környezeti beállításokat, és a hatályos értéket mutatja.
  - Mindegyik mellett egy „Miért?” kibontó mondja meg az okot és a feloldás módját.
  - A választásod megmarad, és a profil kikapcsolásakor visszaáll.
- **Leletlista a Forrás lépésben:**
  - ha a modellkészítés megáll vagy figyelmeztet, egy lista mutatja a leleteket: a bizonyosságot szövegesen, az eredetet és a kódot;
  - a sorszámra kattintva a szerkesztő kijelöli az adott sort;
  - ha a forrás azóta változott, a lista jelzi.
- **Lépésállapotok:**
  - **Forrás:** „Hibás forrás” vagy „Figyelmeztetés”.
  - **Próba:** „Figyelmeztetéssel”, ha a második kapu nem eldönthető eredménnyel engedett be.

## Unreleased – 2026-11-07 szerzői preflight: második kapu, Szabályok → Próba (ADR-108, E6)

- **A Próba csak ellenőrzött modellel nyílik meg:**
  - ha a forrást vagy az elemzési beállításokat a modell készítése óta módosítottad, a Próba lépés zárva marad, amíg újra el nem készíted a modellt;
  - ha a modell elutasítja a saját referenciasorrendjét, a Próba nem nyílik meg;
  - egy felülírt bizonyított szabály után figyelmeztetéssel nyílik meg („tilt” beállítás mellett nem).
- **A szerver dönt:** az előnézeti ellenőrzést csak a kapun átment modellre futtatja, közvetlen API-hívásra sem. Szabályszerkesztés után a kapu újra lefut, ugyanabban a kérésben, amely újraértékeli a rendezést.
- **Elavult forrás:** ha a forrás módosítása után a Próbára lépsz, a Szabályok lépésre kerülsz. Itt újra elkészítheted a modellt, vagy elvetheted a változtatást.

## Unreleased – 2026-11-07 szerzői preflight: ágak, ciklusok és biztos null/undefined hiba (ADR-108, E4)

- **Pontosabb ágkezelés:** az inicializálás előtti hozzáférést az elemzés akkor is látja, ha az egy `if/else` mindkét ágán vagy egy biztosan egyszer lefutó ciklusban (`do…while`, `while (true)`) történik.
- **Új ellenőrzés:** biztos `null`/`undefined` értéken végzett tagelérés vagy hívás (például `let o; o.name`), illetve egy nem függvény meghívása (például `const n = 5; n()`). Mindkettő futáskor TypeError, és megállítja a modellkészítést. Kikapcsolható (`objectState: off`).
- **Javítva:** az előző verzió hibát jelezhetett, ha egy függvény feltételesen kilépett, mielőtt elérte volna a hibás sort. Most csak a valóban biztos esetet jelzi. A repó 482 valódi programján továbbra is egyetlen, szándékosan hibás tesztprogramot jelez.

## Unreleased – 2026-11-07 szerzői preflight: inicializálás előtti hozzáférés felismerése (ADR-108, E3)

- **Új elemzés:** a modellkészítés biztosra megállít, ha a referencia egy `let`, `const` vagy `class` kötést az inicializálása előtt olvas vagy ír, mert ez futáskor ReferenceError. Közvetlenül és hívásláncon át is látja, például `const f = () => x; f(); const x = 1;`. JavaScriptben és a Pages-en is működik.
- **Csak a biztos esetet jelzi:** elérhetetlen ágban, `try`-ban, feltételes hívásban vagy rekurzióban nem. A repó 482 valódi programján egyetlen jelzést ad: egy szándékosan hibás tesztprogramot.

## Unreleased – 2026-11-07 szerzői preflight: választható szigorúbb nyelvi ellenőrzés (ADR-108, E2)

- **Szigorú TypeScript-ellenőrzés** (`tsDiagnostics: strict`): a szigorú fordítás hibái (például implicit `any`, `null` szöveg helyén) biztos hibák, és megállítják a modellkészítést.
- **JavaScript típusellenőrzés** (`jsCheck: on`): amit csak a típusellenőrzés talál, az „lehetséges hiba”, mert a JavaScript ettől még lefut. Alapból figyelmeztet, „tilt” beállítás mellett megállít. Az újradeklarálás és a többi nyelvi hiba továbbra is biztos hiba.
- **Hol érhető el:** egyelőre az API-n keresztül; a felületi kapcsolók az E7 szakaszban jönnek. A Pages-en standard könyvtár nélkül egyik mód sem fut le, és a kapu ezt meg is mondja.

## Unreleased – 2026-11-07 szerzői preflight: első kapu (ADR-108, E5a)

- **Biztos nyelvi hiba blokkol:** a TypeScript-fordítási hibás referencia (köztük a deklaráció előtti használat) már nem kap modellt. A szerző a Forrás lépésen marad, látja a hibát a szerkesztő sorszámával, és a korábbi modell megmarad.
- **Ami nem ellenőrizhető, nem „ellenőrzött”:** feloldatlan import vagy a Pages-en le nem futó nyelvi ellenőrzés esetén a kapu „nem eldönthető” eredményt ad. Alapból figyelmeztetéssel továbbenged; „tilt” beállítás mellett megáll, és megmondja, hogy ez nem jelent hibás forrást.
- **Minden belépési úton:** forrás, JSON-import, függőségfrissítés és közvetlen API.

## Unreleased – 2026-11-07 szerzői preflight: specifikáció és konfigurációfeloldó (ADR-108, E0–E1)

- **Ütemezés:** a konfigurálható forrás- és modellvalidáció terve bekerült a dizájn hátralévő szakaszai elé. A terv állításait a kódon ellenőriztük, az eltéréseket indokkal rögzítettük (ADR-108).
- **Konfigurációfeloldó** (szerver és Pages közösen):
  - a kért és a ténylegesen használt elemzési beállítás külön látszik;
  - a „konzervatív” preset indokkal zárolja a forrásszerződés négy beállítását;
  - a TypeScript-only beállítás JavaScriptnél inaktív;
  - érvénytelen vagy még nem megvalósított beállítást az API strukturált 422-es hibával utasít el, nem hagyja figyelmen kívül.
- A szerzői generálás a feloldott, ténylegesen használt beállításokkal fut. A felület egyelőre ugyanazokat az értékeket küldi, mint eddig, ezért látható változás még nincs.

## Unreleased – 2026-11-07 Fókusz mód szerkesztőablakként, állítható elválasztó, szabálypanel gombra (ADR-107)

- **Fókusz mód:** kódszerkesztő-ablakként tölti ki a képernyőt, görgetés nélkül. A listák vagy a szerkesztő kapják a maradék helyet; ami lenyílik (részletek, magyarázat), azt a kódnézet zsugorodása fogadja be.
- **Állítható elválasztó a két lista között:** húzható, billentyűzettel is (nyilak, Home, End), és a böngésző megjegyzi.
- **Szabálypanel:**
  - a sor láncszem ikonja már csak kijelöl;
  - a panelt az eszközsor „Szabályok” gombja nyitja: széles képernyőn jobb oldali dokkolt panelként, keskenyen becsúszó lapként;
  - Escape vagy × zárja be.

## Unreleased – 2026-11-07 Fókusz mód, két kódnézet, görgethető teljes képernyő (ADR-106)

- **Fókusz mód:** a Próba eszközsorában. Csak a kódfelület marad (rendező vagy Megoldáskód és az Ellenőrzés), a lehető legnagyobb méretben. Escape-pel vagy a Kilépés gombbal hagyható el; a kitöltés megmarad.
- **Két kódnézet:**
  - **Szerkesztő:** sűrű, folytonos lista;
  - **Kártyák:** nagyobb, különálló csempék;
  - a választást a böngésző megjegyzi.
- **Javítva:** teljes képernyőn nem lehetett görgetni.
- **Javítva:** a kék aktív lépés felirata nem volt fehér.
- **Új szerzői alapértékek:** érvényes egyszerű adat, a kulcssorrend nem számít, csak szabványos osztálymezők. A kész feladatok és a betöltött modellek a saját beállításaikat tartják. Az „Elemzési beállítások” összefoglalója minden változtatás után frissül.

## Unreleased – 2026-11-07 zöld elfogadás, a szerkesztő csíkjai a helyükön, ferde fülek telefonon (ADR-105)

- **Zöld elfogadás:** az „Elfogadva” sáv mindkét témában zöld, a téma hátteréhez és fő színeihez igazítva.
- **Javítva:** a Megoldáskód szerkesztő váltakozó csíkjai görgetés közben elcsúsztak a sorokhoz képest; most együtt mozognak a szöveggel és a sorszámokkal.
- **Telefonon is ferdék** a „Feladat készítése” és „Gyakorlás” fülek.

## Unreleased – 2026-11-06 a világos téma automatikus sötétítés mellett is világos (ADR-105)

- **Új név:** CodeLineSorter (fejléc, böngészőfül, Pages-demó). A CodeLine JSON formátum neve nem változik.
- **Javítva:** ha a böngésző automatikusan sötétíti a weboldalakat (Chrome/Android „weboldalak sötétítése”, Samsung Internet), a „Világos” választás eddig sötét, torz árnyalatú felületet adott. A világos téma most jelzi, hogy maga kezeli a színeit, ezért valóban fehér marad. A Dark Reader bővítmény sem írja felül.

## Unreleased – 2026-11-06 a mock karaktere, témaváltó, nyugodtabb felület (ADR-105)

- **Témaváltó a fejlécben:** Rendszer → Világos → Sötét. A választást a böngésző megjegyzi, és betöltéskor nem villan át a másik téma.
- **A mock karaktere:**
  - ferde módfülek, lecsípett sarkú fő gombok és aktív lépés;
  - a kék (`#0649f8`) és a sárga (`#ffd900`) ugyanott és ugyanannyira hangsúlyos, mint a mockban: sárga az Ellenőrzés gomb és a nyelvjelvény, kék a kijelölés és a továbblépés.
- **Grafit sötét téma:** közel színtelen semleges skála, a kék csak kiemelés.
- **Egyszerűbb felület:**
  - egy navigáció (a lépéssor), az útvonalsor, a projekt- és a tippkártya, a hamis fájlfülek és az alsó állapotsor megszűnt;
  - a munkamenet-műveletek a fejléc egy menüjében vannak;
  - a forrás megnyitása egy „Megnyitás” menü, az elemzési beállítások lenyitható panelben vannak;
  - a haladás a Megoldás panel fejlécében látszik;
  - egy közös Súgó van.
- **Telefonon:** a feladatlista összecsukott választó, a fejléc két sor, és a próba eszközsora egy sor.

## Unreleased – 2026-11-06 új dizájnrendszer: világos és sötét téma (ADR-104)

- **Világos és sötét téma:** a felület a rendszer beállítását követi. Világosban fehér „papír” felület, sötétben a korábbi sötét paletta; mindkettőben ugyanaz a kék kiemelőszín.
- **Egyértelmű színjelentés:** a kék kiemel, a piros csak hibát jelez, a sárga csak figyelmeztet, a cián a „megelőzi” szabályt jelöli.
- **Új betűk, helyben kiszolgálva:** Inter a felületen, JetBrains Mono a kódban (OFL). A kód pontosan úgy jelenik meg, ahogy írva van: a `>=` és az `=>` nem olvad egybe jellé.
- **Olvashatóbb feliratok:** nincs 11 pontnál kisebb szöveg.
- **Szögletesebb, tisztább elemek** kis lekerekítéssel.
- A témaváltó gomb, a zsúfoltság csökkentése, a Fókusz mód és a kódnézetek a következő lépések.

## Unreleased – 2026-11-06 három befogadási hiba javítva (ADR-103)

- **Túl mély vagy túl hosszú forrás:** a szerzői forrás legfeljebb 64 szint mélyen ágyazható egymásba (zárójel, blokk, sablonkifejezés). A túl mély vagy túl hosszú kódra érthető hibaüzenet jön, a hiba sorszámával; korábban TypeScriptnél a feldolgozás elszállt, és a szerver félrevezető „nem elérhető TypeScript parser” üzenetet adott.
- **BOM:** a fájl elején álló láthatatlan bájtsorrend-jel már nem kerül bele az első kódsorba.
- **Kódnézet:** egy sor végén álló szóköz vagy a webről másolt kód nem törő szóközös behúzása már nem teszi a sort „nem engedélyezett”-té. A többsoros szövegliterálok belső sorai továbbra is pontosan összevetve.
- **A szabályok és a meglévő feladatok nem változtak.**

## Unreleased – 2026-11-05 olvasások és saját tömb a `valid` szerződés alatt (ADR-102, v52)

- **Kevesebb fölösleges szabály,** ha a bemenet érvényes egyszerű adat. Egy saját tömbre írás (`out.push(c0)`) már nem köti a sorrendjét azokhoz a sorokhoz, amelyek csak a bemenetet olvassák (`const c3 = Object.keys(data).length`, egy összegző `for…of`).
- **Biztonsági feltétel:** ha a tömböt más név is eléri (álnév, burkoló tömb, a bemenetbe tárolt hivatkozás, feltételes érték, visszahívás), a sorrend kötött marad.
- **Mérés:**
  - a `valid` szerződésű kampányban 0 hibás elfogadás mind a 7 fajtában;
  - a `param` fajta rése 26 → 7 nyelvenként;
  - a v51 által elfogadott sorrendek közül a v52 egyet sem utasít el.
- **Az alapszerződés és a 16 példa szabályai nem változtak.**

## Unreleased – 2026-11-05 szintválasztó a feladatkészítésben (ADR-101)

- **Saját feladat szintje:** a Forrás lépésben kiválasztható a feladat szintje (Kezdő, Közepes, Haladó). A letöltött JSON-modell tartalmazza, így a példák közé tett feladat a megfelelő csoportba kerül. Példából indított feladat a példa szintjét kapja.

## Unreleased – 2026-11-05 szint szerint csoportosított feladatlista (ADR-101)

- **Kezdő, Közepes, Haladó:** a gyakorló feladatlista szint szerint csoportosít. A Gyakorlás az első kezdő feladattal nyílik meg.
- **Új modellmező:** a feladat választható `level` mezője (`beginner`, `intermediate`, `advanced`). A régi feladatok érvényesek maradnak, és az „Egyéb feladatok” csoportba kerülnek.
- **A 16 példa besorolva:** 6 kezdő, 7 közepes, 3 haladó.

## Unreleased – 2026-11-05 hat kezdő szintű gyakorlófeladat (ADR-100)

- **Új, kezdőknek szóló feladatok:** Celsius átváltása, Téglalap adatai, Üdvözlés névből, Páros és páratlan számok, Magánhangzók számlálása (JavaScript), valamint Osztályzat pontszámból (TypeScript).
- **Mindegyik igazolt,** és nem utasít el olyan sorrendet, amely futáskor azonos lenne. A leírás megmondja, mely sorok cserélhetők fel.
- **Összesen 16 gyakorlófeladat.**

## Unreleased – 2026-11-04 tiszta műveletek a `valid` szerződés alatt (ADR-099, v51); két új statisztikapélda

- **Kevesebb fölösleges szabály kezdő kódban,** ha a bemenet érvényes egyszerű adat. Ilyenkor már nem köti a sorrendet:
  - a `Math.min(...values)`;
  - a `values.reduce((sum, value) => sum + value, 0)` és a hasonló, csak olvasó visszahívású tömbmetódusok;
  - a `-Infinity`;
  - egy gyűjtőváltozó csak olvasó értékadása;
  - egy csak olvasó és lokális változókat író `for…of` ciklus.
- **Új gyakorlófeladatok:** „Statisztika egy tömbből” ciklussal és beépített függvényekkel. A gyűjtőváltozók, a ciklusmag sorai és a független deklarációk sorrendje szabad.
- **A Szógyakoriság feladat** (revízió 2) mostantól elfogadja a `Map` létrehozásának és a szöveg felbontásának cseréjét.
- **Mérés:**
  - a `valid` szerződésű kampányban 0 hibás elfogadás;
  - a régi szabály által elfogadott sorrendek közül az új egyet sem utasít el (28 796 sorrend).

## Unreleased – 2026-11-04 három új igazolt példafeladat (ADR-098)

- **Új gyakorlófeladatok:**
  - **Szógyakoriság Map-pel** (JavaScript, közepes);
  - **Generikus verem** (TypeScript, közepes, sok szabad tagsorrenddel);
  - **Fibonacci memoizálással** (JavaScript, rekurzió és korai kilépés).
- **Mindegyik igazolt,** és nem utasít el olyan sorrendet, amely futáskor azonos lenne.
- **Egy kezdő statisztika-feladat nem került be:** az elemzés hat helyes átrendezést utasítana el benne. Ezt a jegyzék generátorjavításként tartja nyilván (NY-06).

## Unreleased – 2026-11-04 az `attempt` és a `persistence` modul TypeScriptben (ADR-097)

- **Belső, a viselkedés nem változott:** a tanulói elrendezést (beszúrás, nem csere, rögzített helyek) és a munkamenet mentését, betöltését kezelő két modul szigorú TypeScriptre került. Egy különbségi teszt 16 804 esetben igazolta, hogy a régi és az új modul ugyanazt adja.
- **Új őrteszt:** a felület kézzel írt, régi JavaScript-moduljainak listája rögzített, és csak csökkenhet (most 4 modul).

## Unreleased – 2026-11-04 automatikus akadálymentességi átvizsgálás (ADR-096)

- **Új ellenőrzés:** minden változtatás előtt az axe-core átvizsgálja a fő nézeteket asztali gépen és telefonon (a WCAG 2.x A/AA gépileg ellenőrizhető szabályai).
- **Javítva az első futás 6 hibája:**
  - a gombok akadálymentes neve a látható felirattal kezdődik (hangvezérlés);
  - két szövegszín kontrasztja nőtt (a szabálytábla sorindexe, az osztálynevek a kódban);
  - az üres forráslista nem üres lista;
  - a görgethető listák billentyűzettel is görgethetők;
  - a teljes képernyő gombnak mobilon is van neve.

## Unreleased – 2026-11-04 koppintásos áthelyezés (ADR-095)

- **Új: koppintással is rendezhetsz** érintőképernyőn. Koppints egy sor fogantyújára, majd a helyére: egy üres helyre, vagy egy sorra, amely elé vagy mögé kerüljön. Megoldásbeli sort a forráslistára koppintva veszel vissza. Ugyanarra a fogantyúra koppintva megszünteted a kijelölést.
- **Mobilon több látszik a kódból:** kis érintőképernyőn a fel és le gombok helyét átveszi a koppintás, ezért egy sorban 38%-kal szélesebb a kód.
- **Belső:** a húzást és a billentyűzetes mozgatást kezelő modul TypeScriptre került, a viselkedése nem változott.

## Unreleased – 2026-11-04 billentyűsúgó az eszköztárban, mobil rendező (ADR-094)

- **Tömörebb rendező:** a „Billentyűzettel is” súgó a Rendező/Megoldáskód fülek mellé került. A külön útmutató sáv elmaradt, mert a forráslista alja és a Tipp kártya ugyanezt mondja. A rendező laptopképernyőn még feljebb kezdődik.
- **Javítás:** a forráslista sorvégi gombja mögött már nem látszik ki a sor vége.
- **Mobil:** az ellenőrző gomb rendezés közben a képernyő alján marad, a kettős listacím eltűnt, a panelgombok egy sorban vannak.

## Unreleased – 2026-11-04 obsidian dizájn, 4. szakasz (ADR-093)

- **A rendező feljebb került:** a Próba lépés fejléce tömörebb („Próbarendező”, egysoros leírás, kompakt haladássáv). A szabályok hosszabb magyarázata egy „Jelmagyarázat” blokkba csukható. Laptopképernyőn egy rövid feladat minden sora a képernyőn belül marad.
- **Rendezőpanelek:** információs sáv „HÚZÁS” címkével, darabszám-jelvények a panelcímek mellett, szaggatott keretes „+ Sor beszúrása” üres helyek, keretes állapotkártya az ellenőrző gombbal.

## Unreleased – 2026-11-04 obsidian dizájn, 3. szakasz (ADR-092)

- **Feladatfejléc:** útvonalsor („Studio / Feladatkészítés / Próba”), nagyobb cím és nyelvjelvény („TS TypeScript · 34 sor”).
- **Lépéssor:** a három lépés egy sávban, „01 · Forrás” címkékkel. A kész lépés pipát kap, az aktív kitöltött számot és fénylő aláhúzást. Mobilon is elfér.

## Unreleased – 2026-11-04 obsidian dizájn, 1–2. szakasz (ADR-091)

- **Új megjelenés:** ciánkék kiemelés, mélyebb sötét háttér, monospace nagybetűs címkék, fénylő aktív lépés és módfül. Minden szín egy közös palettából jön.
- **Halvány sorvégi gombok:** a gombok nyugalmi állapotban halványak, és átlátszik mögülük a hosszú sorok kódja. Egérrel a soron, billentyűzetfókusznál vagy kiemelt sornál teljesen láthatók, érintőképernyőn mindig.
- **Keret:** „CodeLine.” márka, aláhúzott módfülek, szerzői oldalpanel a projekt adataival és egy tippel, valamint alsó állapotsor (ellenőrzési mód, nézet, nyelv, elhelyezett sorok).

## Unreleased – 2026-11-04 kódlistánként egy vízszintes görgetés (ADR-090)

- **Javítás:** a hosszú kódsoroknak már nincs saját vízszintes görgetősávjuk. A forrás- és a megoldáslista, valamint a szabálytábla egyben görget, és minden sora egyforma széles.
- **Kezelhetőség:** a fogantyú és a sorszám bal oldalt, a sorvégi gombok jobb oldalt a helyükön maradnak görgetés közben is. A szabályívek követik a gombokat.

## Unreleased – 2026-11-04 az orákulum modul- és `[[Set]]`-olvasata elfogadott korlát (NY-07)

- **Mérés, nem kódváltozás:** az orákulum második, kibocsátott kódon alapuló olvasata (ADR-063) a modulokra és a `[[Set]]` mezőmódra továbbra sincs meg. Ma egyetlen modulfixture van, a `[[Set]]` olvasat pedig a meglévőhöz csak a fordító saját átalakítását adná, amelyet a futtatás már ellenőriz. Egy új teszt jelez, ha egy második modulfixture megjelenik.

## Unreleased – 2026-11-04 minden példa igazolt, az alapértelmezés `verified-only` (ADR-089)

- **Igazolt példák:**
  - **`class-accounts-ts` (revízió 3):** a metódustörzs két állapotfrissítése (`this.balance …` és `this.history.push(…)`) már nem cserélhető. Egy nem szám összeg mindkét sorban kódot futtathat, és ekkor a csere más egyenleget ad. A leírás ezt mondja ki. A két mező viszont most szabadon mozoghat.
  - **`algo-sort-search-js` (revízió 2):** a forrásból újragenerálva; a tanuló számára semmi nem változik.
  - **`profiles-js` (revízió 2):** új forrás, három független deklarációval. A két sorrendprofil (előre és fordítva) szerzői szűkítés; a régi példa futáskor valóban sorrendfüggő hívásokon mutatta be.
  - A régi revíziókra mentett félkész elrendezéseket a felület nem tölti vissza.
- **Szigorúbb alapbeállítás:** a szerver és a Pages-demó alapból csak igazolt (vagy szerzői döntéssel módosított) feladatot szolgál ki. A régi mód csak `CODELINE_PUBLICATION=publishable` beállítással érhető el, és ilyenkor figyelmeztetést naplóz.

## Unreleased – 2026-11-04 böngészőtesztek régebbi telepített Chromiummal (NY-16)

- **Futtatható böngészőtesztek friss konténerben:** ha a rögzített Playwright saját Chromium-revíziója nincs telepítve, a böngészőtesztek a böngészőkönyvtár legújabb Chromiumát indítják, és ezt a kimenetben jelzik. Eddig ilyenkor el sem indultak. Más indítási hiba továbbra is hiba.

## Unreleased – 2026-11-04 a futással nem megfigyelhető okkódot a regiszter jelöli (ADR-088)

- **Megbízhatóbb mérés:** az okkód-regiszter jelöli azokat a szabályokat, amelyeket egyetlen futás sem különböztet meg: a pedagógiai döntést (`early-exit-order`) és a csak típusellenőrzővel látható overload-sorrendet (`overload-group`). A mérés onnan olvassa, mi számít szándéknak, nem egy külön kézi listából, így egy új okkód nem maradhat ki belőle csendben. A generátor és a mérés eredményei nem változtak.

## Unreleased – 2026-11-04 accessor mező az azonos kulcsú láncban (ADR-083, v47); a ciklus első köre (ADR-084, v48); objektumheap-modul (ADR-085); reguláris kifejezés literálja (ADR-086, v49); metódusszignatúra (ADR-087, v50)

- **Kevesebb fölösleges szabály az öröklési programokban (v47):** egy `accessor` mező ugyanazon a néven álló getter–setter pár mellett az azonos kulcsú definíciók láncának tagja. A TypeScript `inherit` csoport rése 2 → 0.
- **Kevesebb fölösleges szabály ciklusokban (v48):** ha egy `for…of` egy saját tömbliterálon megy végig, és a törzs egy ismert kezdőértékű számlálót olvas, az első kört a generátor külön értelmezi. Az `if (seen > 0)` alakú őrfeltétel így kihagyja az első elemet. A `flow` fajta rése nyelvenként 1 → 0.
- **Kevesebb fölösleges szabály (v49):** a reguláris kifejezés literálja (`/a+b/g`) tiszta kezdőérték: nem futtat programkódot, és nem dob. A deklarációja átléphet egy `delete`-en. A korpusz rése 10 → 6.
- **Kevesebb fölösleges szabály TypeScriptben (v50):** egy interfész egyedi nevű metódusszignatúrája (`name(): string`) törlődik, ezért bárhol állhat, mint az adatmező-szignatúra. Az azonos nevű szignatúrák (overload) sorrendje kötött marad. A korpusz rése 6 → 5.
- **Belső átszervezés (ADR-085):** az objektumok absztrakt heapje saját modul (`ObjectHeap`). A generált modellek bájtra azonosak.
- **Mérés:** a teljes kampányban, a rosszindulatú környezettel együtt:
  - 366 124 sorrend, ebből 16 039 elfogadott (+5), 0 hibás elfogadás;
  - a rés 32 → 28; a maradék 28 csak a régi (`[[Set]]`) mezőmódban fut máshogy, és `classFields: 'define'` mellett 0.

## Unreleased – 2026-11-04 szkriptkötés a deklarációja óta (ADR-082, v46); rosszindulatú orákulumkörnyezet (ADR-081); heap-szándék a mérésben (ADR-080)

- **Kevesebb fölösleges szabály szkriptekben (v46):** egy szkriptszintű változó, amelyet a program nem ír újra, a deklarációja óta megtartja az értékét, ha azóta nem futott kód. Egy `+`, `-` vagy összehasonlítás eredménye mindig primitív. A `const c6 = l3 + 1` így nem kötődik egy olyan globális íráshoz, amelyet nem olvas.
- **Új biztonsági mérés:** az ellenőrző orákulum egy rosszindulatú környezetben is futtatja a programokat. Ebben a külső `record` hívás a szkript globális változóit megfigyelő objektumokra cseréli. A szigorú bemeneti beállítás ezt megengedi, ezért az elemzésnek erre is helyesnek kell lennie. A teljes kampányban 0 hibás elfogadás.
- **Pontosabb mérés:** ha egy objektumot a program később eldob, a beleírt sorrend továbbra is kötött. A mérés ezt most szándéknak számolja, nem fölösleges elutasításnak. A generátor nem változott.
- **Mérés:** a teljes kampányban, a rosszindulatú környezettel együtt, a rés 59 → 32, az elfogadott sorrend +7, 0 hibás elfogadás 366 123 sorrendből.

## Unreleased – 2026-11-04 az overload-csoport egy blokk (ADR-079, v45)

- **Kevesebb fölösleges szabály TypeScriptben:** egy overload-csoport (szignatúrák, majd a megvalósítás) eddig lezárt egység volt, ezért egyetlen másik tag sem léphetett át rajta. Most a megvalósítás blokkja az első szignatúránál nyílik. Más tag átléphet a csoporton, de nem kerülhet bele.
- **Változatlan biztonság:**
  - a szignatúrák sorrendje kötött, mert a TypeScript sorrendben próbálja őket;
  - a törzs a fejléc után áll.
- **Frissítés és ellenőrzés:**
  - egy korábbi modell frissítéskor átáll az új blokkra, és megtartja a blokkazonosítóit;
  - az elemzési igazolás most a teljes blokkszerkezetet veti össze, nem csak a blokkok számát.
- **Szabálytábla:** a második és további szignatúra és a megvalósítás fejléce egy szinttel beljebb látszik; a tanulói nézet nem változik.
- **Mérés:**
  - a teljes kampányban a rés 78 → 59, az elfogadott sorrend +37, 0 hibás elfogadás 366 118 sorrendből;
  - a `class` TypeScript-csoport rése 19 → 0;
  - a korpusz rése 19 → 10.

## Unreleased – 2026-11-04 azonos nevű tagdefiníciók, getteren át olvasó kezdőérték, privát mező (ADR-078, v44)

- **Kevesebb fölösleges szabály az öröklési programokban:**
  - a `get ['k3']()` alakú, szöveges nevű tag ugyanaz, mint a `get k3()`;
  - egy getter–setter pár azonos nevű mező mellett is egy tulajdonság;
  - az egymás melletti getter és setter bármely sorrendben állhat;
  - egy `f = this.t` alakú mező csak azt köti, amit az ős `t` gettere valóban olvas;
  - egy privát mező akkor is szabad, ha a program kiírja az objektum kulcsait.
- **Biztonsági feltételek:** ha a tagok azonos nevű definíciói közül egy metódus az utolsó, az írás adatot ér, és nem fut kód. Ha egy setter az utolsó, a setter kódja köt. Egy még nem létező saját privát mező olvasása a létrehozása után marad.
- **Mérés:** a teljes kampányban a rés 110 → 78, az elfogadott sorrend +104, 0 hibás elfogadás 366 095 sorrendből. Az öröklési programok rése régi célra fordítással is: JavaScript 16 → 0, TypeScript 18 → 2.

## Unreleased – 2026-11-04 az ős settere csak az általa elért mezőket köti (ADR-077, v43)

- **Kevesebb fölösleges szabály:** ha egy mező neve egy ősosztály setterével egyezik, a régi mezőmódban a mező létrehozása lefuttatja a settert. Eddig az ilyen mező minden egyszerű mező sorrendjét kötötte. Most csak azokét köti, amelyeket a setter olvas vagy ír; két olvasás egymáshoz képest szabad.
- **Biztonsági feltételek:** a setter a példányt csak `this.név` alakban használhatja. Ha metódust hív rajta, `this`-t használó függvényt ad tovább, vagy ős gettert olvas, a régi, óvatos szabály marad. A TypeScript `(this as any).név` alakja ugyanannak számít. Egy `['k5']` alakú, szöveges nevű accessor sem teszi többé ismeretlenné az ősláncot.
- **Mérés:** a teljes kampányban a rés 208 → 110, az elfogadott sorrend +140, 0 hibás elfogadás 366 024 sorrendből. Az öröklési programok rése régi célra fordítással is: JavaScript 80 → 16, TypeScript 52 → 18.

## Unreleased – 2026-11-04 a példányt el nem érő mezőkezdőérték (ADR-076, v42)

- **Kevesebb fölösleges szabály:** egy osztálymező, amelynek a kezdőértéke kódot futtat, de nem éri el a félig felépített objektumot (például `f1 = record('f1') ?? 7`), most már szabadon cserélhető az egyszerű, literál értékű mezőkkel. A többi kódot futtató taghoz képest a sorrendje kötött marad.
- **Biztonsági feltételek:** a szabály nem érvényes, ha az objektum addig kiszökhetett. Ilyen helyzet:
  - az ős konstruktora vagy mezője használja a `this`-t;
  - egy korábbi saját mező kiadja a `this`-t;
  - a kezdőérték `this`-t használó függvényt ad át;
  - régi mezőmódban egy ős mezőjének értékadása settert futtat;
  - a TypeScript paramétertulajdonsága settert futtat.

  Mind az öt esetre van próba.
- **Mérés:** a teljes kampányban az öröklési programok rése JavaScriptben 133 → 108, TypeScriptben 77 → 52. „Csak szabványos” mezőmódban nyelvenként 13 és 15 maradt. 0 hibás elfogadás, a környezetváltozatokkal és mindkét mezőmódban is.

## Unreleased – 2026-11-04 szerzői beállítás: csak szabványos osztálymezők (ADR-075, v41)

- **Új szerzői beállítás a Forrás lépésben: „Osztálymezők létrehozása”.** Alapértelmezés: „mindkét mód”, ilyenkor a szabályok változatlanok. A „csak szabványos” mód kimondja, hogy a feladat mezőit a JavaScript szabványa szerint definiálják (natív osztálymezők, TypeScript `useDefineForClassFields: true`). Ilyenkor az ősosztály azonos nevű settere nem köti a mezők sorrendjét. A régebbi célra fordított kódra ez a mód nem ígér semmit, és a magyarázat ezt kimondja.
- **A modell része:** a beállítást az elemzés környezete rögzíti, a Szabályok lépés kiírja, és az ellenőrzés meg a frissítés is ezzel generál újra. Az orákulum függetlenül, csak a szabványos módban futtatja az ilyen feladatot.
- **Mérés (`inherit`, környezetváltozatokkal):**
  - JavaScript: 358 → 487 elfogadott sorrend, a rés 105 → 56;
  - TypeScript: 374 → 474 elfogadott sorrend, a rés 77 → 58;
  - 0 hibás elfogadás.

## Unreleased – 2026-11-04 öröklési programok a kampányban; az őslánc JavaScriptben is (ADR-074, v40)

- **Bővebb mérés:** a véletlen kampány új programfajtát kapott (`inherit`). Az ősosztályban getter, setter, `accessor` mező és számított nevű accessor áll, a leszármazott mezői ezekkel találkozhatnak. A magok mintegy háromnegyedében benne van az a minta, amelyet az ADR-073 javított.
- **Visszamenőleges próba:** a v38-as szabályokon az új fajta 3 TypeScript-programban 33 hibás elfogadást talál. A v39-en egyet sem.
- **Hibás elfogadás javítva JavaScriptben is:** a szabványos JavaScript `[[Define]]` szerint hozza létre a mezőket, de egy ES2015-re fordított változat értékadással, és ilyenkor az ős settere fut. Az ADR-073 szabálya ezért JavaScriptre is vonatkozik (v40). Ennek ára: az öröklési programokban JS-ben 129 sorrenddel kevesebb elfogadott, ebből 28 a lefordított változatban valóban hibás lett volna. Hogy a JavaScript-feladatok ígérjék-e a lefordítást, az döntés (NY-23).
- **Új rések:** az új programokban JS-ben 133, TS-ben 77 fölösleges elutasítás látszik (NY-22). Ezek eddig rejtve voltak, mert nem volt ilyen program.

## Unreleased – 2026-11-03 őslánc, másoló mező, alapértékes paraméter (ADR-073, v39)

- **Hibás elfogadás javítva:** TypeScriptben a `useDefineForClassFields: false` mezőmódban egy mező értékadása az ősosztály azonos nevű setterét futtatja. Két ilyen mező cseréje eddig elfogadott volt, holott a setter megfigyelheti a másikat. Most egy mező csak akkor szabad, ha egyik ős sem definiál ilyen nevű accessort.
- **Kevesebb fölösleges szabály:** az `f7 = this.f5` alakú mező, amely egy korábbi saját adatmezőt másol, csak a forrása után kell álljon, a többi mezőhöz képest szabad. Az alapértékes paraméterű konstruktor (`constructor(readonly c = 4)`) osztálya az objektummodellben marad.
- **Mérés:** a teljes kampányban a rés 50 → 48, az elfogadott sorrend +2, 0 hibás elfogadás 351 664 sorrendből. A hibás elfogadást egy célzott próba találta meg, a kampány nem; a kampány osztályprogramjainak bővítése új tétel (NY-21).

## Unreleased – 2026-11-03 biztos felülírás (ADR-072, v38)

- **Kevesebb fölösleges szabály:** ha egy utasítás biztosan felülír egy mezőt (egyenes vonalú kód, vagy egy ciklus, amely egy saját tömb minden elemén ugrás nélkül végigmegy), a későbbi olvasások már nem látják a mező korábbi értékét. Egy getter ismert értéket ad vissza, a `switch` ismert értékkel csak a választott ágtól fut.
- **Biztonsági feltételek:** a feltételes ágban, `try`-ban, `while`/`for` ciklusban, `break`-kel megszakítható ciklusban végzett írás nem számít biztosnak.
- **Mérés:** ha egy kötést csak a sosem futó kód okoz (például egy `catch`, amely csak egy külső hívás dobásakor futna), az A-politika szerint szándékhű elutasítás.
- **Eredmény:** a teljes kampányban a rés 74 → 50 (58 a generátorból, a többi a mérésből), az elfogadott sorrend +64, 0 hibás elfogadás 351 664 sorrendből.

## Unreleased – 2026-11-03 pozíciós heapcellák (ADR-071, v37)

- **Kevesebb fölösleges szabály:** egy utasítás egy objektum mezőjéből csak azt az értéket látja, amelyet a referencia szerint előtte álló utasítás írt be. Az `a.note('n2')` így nem ütközik a `shared.push`-sal csak azért, mert később az `a.attach(shared)` a `shared`-et teszi az `a.log`-ba.
- **Biztonsági feltételek:** az író és az olvasó sorrendje kötött marad; egy ciklus látja a saját későbbi köreinek írásait; egy még be nem írt mező olvasása ismeretlen.
- **Mérés:** a teljes kampányban a rés 100 → 74, az elfogadott sorrend +30, 0 hibás elfogadás 351 664 sorrendből.
- **Új nyitott tétel (NY-19):** az eldobott tömbbe írás sorrendje kötött marad (A-politika); a mérés ezt még résnek számolja.

## Unreleased – 2026-11-03 egyszer futó ciklus (ADR-070, v36)

- **Kevesebb fölösleges szabály:** a `for (const entry of boxes) { …; break; }` ciklus, amely legfeljebb egyszer fut, csak a tömb első elemén dolgozik. Így egy másik objektum művelete átléphet rajta. Eddig a tömb minden elemét érintőnek vette a modell.
- **Biztonsági feltételek:** a feltételes `break`, a ciklusra visszatérő `continue`, valamint az első elemet megváltoztató `unshift`/`pop`/`shift` mellett a régi szabály marad.
- **Orákulum:** a független ellenőrzés a tömbliterálon futó belső `for … of`-ot is objektumműveletként ismeri.
- **Mérés:** a teljes kampányban a rés 150 → 116, az elfogadott sorrend +52, 0 hibás elfogadás 351 664 sorrendből. Az érték-perturbáció a lezárt blokk literáljait is előre veszi; ezzel a rés 100.

## Unreleased – 2026-11-03 mélyen ellenséges bemenet, saját osztályok (ADR-069, v35)

- **Pontosabb mérés:** a paraméteres programok egy mélyen ellenséges bemenetet is kapnak, amely minden olvasást, írást és konverziót naplóz. A korábbi 24 `param`-rés mind indokolt elutasításnak bizonyult; a 424 elfogadott sorrend ezt a próbát is kiállta.
- **Kevesebb fölösleges szabály:** a számnevű (`0() {}`) és a kétszer definiált metódusú osztály példánya ismét saját objektum. Hívásnál a későbbi definíció számít.
- **Újramérve:** a felső szintű függvények hatásösszegzésének (NY-03) jelenleg nincs mért haszna, ezért nem került be.
- **Mérés:** a teljes kampányban a rés 175 → 150, 0 hibás elfogadás 351 664 sorrendből; a korpusz változatlan.
- **Nyitott tételek** egy helyen: [docs/nyitott-tetelek.md](docs/nyitott-tetelek.md). A governance-teszt bukik, ha egy ADR nyitott szakasza onnan hiányzik.

## Unreleased – 2026-11-03 kötési kontextus, tagfázisok, korai kilépés (ADR-068, v34)

- **Hibajavítás:** egy függvénydeklaráció neve az elemzésben a függvény törzséhez tartozott, nem ahhoz a környezethez, ahol a kötés él. Ezért egy függvényt olvasó tiszta sor (például `const kind = typeof helper;`) semmilyen külső hívással nem cserélhetett helyet. A `function` programok rése 12 magon 15 → 0.
- **Duplikált metódusok:** az azonos nevű metódusok és accessorok csak egymáshoz képest kötöttek (a későbbi felülírja a korábbit), a mezőktől szabadok.
- **Laza static és `accessor` mező:** a kódot nem futtató static és `accessor` mező is szabad a hasonló mezőkhöz képest, ha a program nem listázza a kulcsokat.
- **Pontosabb ok:** a „tiszta deklaráció nem kerül egy `return`/`throw`/`break` mögé” pedagógiai szabály saját okkódot kap (`early-exit-order`). A szerző így a valódi okot látja.
- **Mérés:** a teljes kampányban a rés 310 → 175, az elfogadott sorrend 14 727 → 14 790, a korpusz rése 35 → 19. Minden mérésben 0 hibás elfogadás.
- **Címkék:** a v34 additív sémaenumérték; a példák és a minták szabályai nem változtak, csak a címke és a szerzői megjegyzés szövege.

## Unreleased – 2026-11-03 érték-perturbáció a mérésben (ADR-067)

- **Pontosabb résmérés:** az osztályozó a rögzített fixture egy-egy literálját más értékre cseréli. Ha a sorrend így már másként viselkedik, az elutasítás szándékhű (`intent`, ok: `value`), nem rés. Ide tartozik a véletlenül egyező értékű írás, és a biztos kivétel mögött rejtett megfigyelés. A generátor és a tanulói értékelés nem változott.
- **Tanú:** minden ilyen eredmény megnevezi a sort, a régi és az új értéket.
- **Kapu:** a gyors generatív mérés az ekvivalens-elutasítási arányt is rögzíti, így egy szigorúbb generátor nem bújhat el „szándékként”. A korpusz a szándékos elutasítások számát is rögzíti.
- **Mérés:** a teljes 12 magos kampányban a rés 560 → 310 (250 értékfüggő szándékhű elutasítás), 0 hibás elfogadás 351 635 sorrendből. A korpusz változatlan; a valódi generátorkorlátok (ciklus túlbecslése, `param`, overload) résként maradtak.

## Unreleased – 2026-11-03 egységblokk a többsoros utasításokra (ADR-066, v33)

- **Kevesebb fölösleges szabály:** egy többsoros hívás, tömb- vagy mezőinicializáló (például `record(` … `);`) a validátorban saját blokk. A független sorok átléphetnek rajta, a belsejébe nem kerülhetnek. Eddig minden testvérsort a forrásbeli oldalához kötött.
- **Marad a lezárás:** ha az egység utolsó sora egy másik blokkot is zár (`});`), vagy TS overload-csoportról van szó. Ezekhez a v3 egységmodell kell (külön epic).
- **Frissítés és ellenőrzés:** egy régi modell frissítése átveszi az egységblokkot. Az ellenőrzés egy egységblokk nélküli modellt nem igazol.
- **Mérés:** a `function` programok rése 12 magon 30 → 15, a korpuszé 41 → 35. Minden mérésben 0 hibás elfogadás.
- **Címkék:** a v33 additív sémaenumérték; a TypeScript mintakatalógus egy modellje (`19-literal-whitespace`) egységblokkot kapott.

## Unreleased – 2026-11-03 tervezési adósság (ADR-065)

- **A megerősítési szint a magból:** minden közvetlen szabály megmondja, mi kell az eltávolításához (`DirectConstraint.removal`); a szabálypanel, a kötegelt feloldás, a kapcsolattábla és a régi vezérlő ezt használja, saját táblázat nélkül. Egy teszt köti össze a kiírt és a kikényszerített szintet.
- **Modulbontások, viselkedésváltozás nélkül:** a ki nem írt nevek elemzése három fázisra bomlott; a ciklusok véget érésének érvei saját modulba (`loop-termination.ts`) kerültek. 2392 generált modell függőségei azonosak előtte és utána.
- **Rögzített döntés:** az ADR-048 primitívlokális-elemzés és a névösszevonás nem vonható össze, mert más kérdésre felel és más helyességi érven áll.

## Unreleased – 2026-11-03 bizonyítottan véget érő while ciklus (ADR-064, v32)

- **Kevesebb fölösleges szabály:** a `while (a.count < 3) { a.bump(); }` mintájú ciklus, amely minden körben pozitív lépéssel növeli a vizsgált számmezőt, bizonyítottan véget ér, ezért már nem köti sorrendhez egy független nyomkövető hívás vagy egy lehetséges kivétel.
- **Orákulum:** a saját mező `+=` és `++` művelete is helyi objektumművelet; a paraméteres programok ellenséges próbája a gettert és az implicit konverziót egyszerre rögzíti.
- **Mérés:** a `flow` rése 12 magon 141 → 115 (a `may-throw` okú 46 → 2), a paraméteres programoké 19 → 12, 0 hibás elfogadás; a korpusz változatlan.
- **Címkék:** a v32 additív sémaenumérték; a minták csak az új címkét kapták.

## Unreleased – 2026-11-03 a TypeScript második olvasata az orákulumban (ADR-063)

- **Független olvasat:** a TypeScript szkripteket az orákulum a lefordított (ES2022, natív mezős) kódjukon Acornnal is elemzi; egyenértékűnek csak az a sorrend számít, amelyben mindkét olvasat egyezik.
- **Mérés:** a TS-korpusz számai változatlanok, a két olvasat minden szomszédos sorrendben egyezik; 4 TS-kampánymag 0 hibás elfogadással.

## Unreleased – 2026-11-03 környezetváltozatok és kanonikus for…in az orákulumban (ADR-062)

- **Környezetváltozatok:** az orákulum ES2015-re fordított kódon és sloppy módban is futtathat (ez utóbbit csak ott, ahol a referencia nem függ a szigorúságtól); a kampányban `--environments=strict,es2015,sloppy`.
- **Kanonikus `for…in`:** „Nem számít” kulcssorrend mellett a `for…in` is kanonikus sorrendben jár, így az ADR-055 utolsó korlátja megszűnt.
- **Mérés:** a teljes korpusz mindhárom változatban 0 hibás elfogadás, a rések száma változatlan; 3 kampánymag minden fajtával 0 hibás elfogadás.

## Unreleased – 2026-11-03 több bemenet az orákulumban (ADR-061)

- **Több próba fixture-önként:** minden próba friss kontextusban fut, és próbánként hasonlítunk; ami csak egy másik bemeneten tér el, már nem látszik egyenértékűnek.
- **Paraméteres véletlen programok** (`param`): `evaluate(data, limit)` több bemeneten, a bemeneti szerződés szerint; `any` mellett `null`, getter és Proxy is.
- **Mérés:** 5 mag mindkét szerződéssel, 0 hibás elfogadás; a gyors alapérték két új csoportot kapott; a korpusz változatlan.

## Unreleased – 2026-11-03 pontosabb szöveges kulcsmegfigyelés (ADR-060, v31)

- **Kevesebb fölösleges szabály:** egy `entries`, `values`, `keys`, `self` vagy `frames` nevű saját mező, változó vagy megjegyzés már nem számít kulcslistázásnak vagy reflexiónak. Például a könyvelő osztály konstruktorának mezőírásai szabadok, ha a program sehol nem listáz kulcsot.
- **Továbbra is kötött:** ami beépített függvényt vagy a globális objektumot érheti el, így a sztring, más érték tulajdonsága, a destrukturálás, a `with`, valamint a `call`, `apply`, `bind` és a hívás nélkül olvasott metódus.
- **Mérés:** a `task-ledger-js` 5–5 rése megszűnt, a többi korpuszszám változatlan; a generatív alapértékben csak a címke változott.

## Unreleased – 2026-11-03 csak olvasó beépített hívás saját objektumon (ADR-059, v30)

- **Kevesebb fölösleges szabály:** az `Object.keys`, `values`, `entries` és a `JSON.stringify` saját objektumon az objektum olvasása, nem szivárgás. Így egy összesítő objektum feltöltő sorai „Nem számít” kulcssorrend mellett szabadok maradnak, miközben a felsorolás előtti helyük kötött. A `for (const [név, érték] of Object.entries(o))` bontás is modellezett.
- **Mérés:** a `keyorder-entries` 3 rése megszűnt, a többi korpuszszám változatlan; hat új teszt, 0 hibás elfogadás.
- **Címkék:** a v30 additív sémaenumérték; a minták csak az új címkét kapták.

## Unreleased – 2026-11-03 futásidejű elérési tanú az orákulumban (ADR-058)

- **Az orákulum függetlenné vált** a generátor szöveges és névelemzésétől: a kulcslistázó, reflexiós és horog API-kat átlátszó Proxyra cseréli, és rögzíti, mit hív a program saját sora. A tényei a szöveg és a futás uniója.
- **Javított mérési hiba:** a ki nem írt nevű `keys` eredménye szerint másolt objektumban a kulcssorrend eddig rendezve hasonlított; most eltérőnek számít.
- **Mérés:** a korpusz rögzített számai változatlanok, `check:all` zöld; hat új teszt.

## Unreleased – 2026-11-03 példamigráció és publikálási alapértelmezés (ADR-057)

- **`algo-bfs-js` frissítve** „érvényes egyszerű adat” bemeneti szerződéssel, revízió 2, minősítés „Szerzői döntéssel módosított” (a két rögzített sor miatt). Viselkedésváltozás: a `visited.add` / `queue.push` csere mostantól elutasított, mert a `Set` nincs modellezve. Minden más tanári sorrend, köztük az öt deklaráció 120 permutációja, elfogadott marad. A leírás már nem ígéri a cserét.
- **Szándékosan változatlan:** a `class-accounts-ts` (a 4. fázis 2d tétele után tér vissza), az `algo-sort-search-js` és a `profiles-js`; mindhárom „Nem igazolt”.
- **A publikálási alapértelmezés marad `publishable`.** `verified-only` mellett két példa szolgálható ki.
- **Mérés:** 950 szomszédos sorrend és a tanár 123 sorrendje; 0 új elfogadás, 1 elvesztett. Az újraszármaztatás egyezik, az orákulum minden kiterjesztést ekvivalensnek talál.

## Unreleased – 2026-11-02 kulcssorrend-beállítás és szabályok típus szerint (ADR-055, v29; ADR-056)

- **„Objektumkulcsok sorrendje” beállítás** (Forrás lépés, JS és TS): „Számít” (alapértelmezett, változatlan) vagy „Nem számít”. Utóbbinál a mezőket, metódusokat és kulcsokat létrehozó sorok egymáshoz képest szabadok, akkor is, ha a program felsorolja vagy szerializálja a kulcsokat – ahogy a tesztkeretrendszerek mély összehasonlítása és a JSON-objektumok kezelik. A kulcsok megléte és az értékek továbbra is kötnek. A modell rögzíti (`environment.keyOrder`), a minősítés és a frissítés ezzel dolgozik, a modell „Elemzéssel igazolt” marad.
- **Orákulum:** „Nem számít” mellett a kulcslistázó függvények futásidőben kanonikus sorrendet adnak, a P4 halmazként hasonlít; független megvalósítás.
- **Szabályok típus szerint:** a Szabályok lépés minden egy okú, nem szerkezeti szabálytípust listáz (jelentés, osztály, darabszám), és egy megerősített lépésben feloldja az összes ilyen szabályt a mag ellenőrzött kötegelt útján. Bármely szabálytípusra működik.
- **Javítás:** a „Miért?” blokk tévesen azt írta, hogy a bizonyított szabály feloldása után „Szerzői döntéssel módosított” lesz a minősítés; valójában „Nem igazolt”.
- **Mérés:** 12 magos kampány mindkét beállítással, 343 243 sorrend, 0 hibás elfogadás; „Nem számít” mellett 14 192 helyett 15 800 elfogadott sorrend (az objektum- és flow-csoportokban). Hat új korpuszfixture (`key-order`), a régi alapértékek változatlanok.
- **Címkék:** a v29 additív sémaenumérték; a minták csak az új címkét kapták.

## Unreleased – 2026-11-02 a megsértett szabály oka és feloldása (ADR-054)

- **„Miért?” a szerzői előnézetben:** elutasított próbánál a kiértékelő sáv megmutatja a megsértett szabályt (a két kódsorral), az okát és a feloldás lépését, valamint egy gombot, amely megnyitja a sor szabályait. A tanulói nézet változatlan.
- **Okjelentések:** a szabálylap (`AuthorRuleSheet.meanings`) az okkódok jelentését is hozza a jegyzékből; a szabálypanel a kód mellett a jelentést is mutatja. Az `object-write-after-write` jelentése pontosabb: új kulcs létrehozása kulcslistázó programban is ide tartozik.
- **Tesztek:** egységtesztek a lapra és a blokkra; böngészős forgatókönyv Node és Pages módban a teljes feloldásig. `check:all` 1003/1003, `test:browser:all` mind a 8 csomag zöld.

## Unreleased – 2026-11-02 kiszámítható nevek és visszaadott értékek (ADR-053, v28)

- **Félrevezető megjegyzés javítva:** a `'ke' + 'ys'` mintájú, konstansként kiszámítható név a kiszámított nevével (`keys`) számít, ezért kulcslistázás, de nem olvasást módosító horog. A bemenet nélküli program „érvényes egyszerű adat” választásnál már nem kapja a „szerződés nem alkalmazható” megjegyzést; a kulcsírások sorrendje helyesen kötött marad.
- **Túlszigorúság javítva:** a visszaadott érték csak akkor szivárog, ha a hívás helyén szivárog, a program saját tömb- és objektumliteráljában tartott érték pedig csak a literállal együtt. A `return [rows, cols, first]` mintájú rácskódnál a `valid` szerződés újra érvényes.
- **Implicit hívások:** az objektumliterál metódusa és a nyelv által hívott nevű osztálymetódus (`get`, `next`, `then`, `valueOf`, …) visszatérése szivárgás, mert a hívás nem látszik a forrásban.
- **Interfész:** `unspelledNames` (a használt, ki nem írt nevek vagy `'any'`) és `namesMatch`; a boolean `readsUnspelledNames` megszűnt.
- **Mérés:** a korpusz rögzített értékei változatlanok; a 1 952 katalógusprogramból egyik sem kap „bármely név” eredményt; a gyors baseline-ban csak a címke változott.
- **Címkék:** a v28 additív sémaenumérték; a minták csak az új címkét kapták.

## Unreleased – 2026-11-02 ki nem írt tulajdonságnevek (ADR-052, v27)

- **Hibajavítás (hibás elfogadás):** a kulcsfelsorolás és a reflexió felismerése szöveges volt, ezért `Object['ke' + 'ys']` mellett a generátor a konstruktor két kulcslétrehozó írását felcserélhetőnek vette (3 hibás elfogadás a próbán). Ugyanígy volt megkerülhető a `valid` szerződés kapuja és a `constructor.constructor` útján a `Function`.
- **Szabály (v27):** az új `property-names` modul szivárgáselemzéssel dönti el, hogy a program meghív, eltárol, átad vagy visszaad-e ki nem írt nevű tulajdonságból olvasott értéket (nem literál és nem szám kulcs, `constructor`, számított destrukturálás), illetve ad-e szöveget egy időzítőnek. Ha igen, a kulcssorrend megfigyeltnek számít (ADR-020, ADR-029), és a `valid` szerződés nem alkalmazható. Az összehasonlítás, a számolás, a kulcsként használat és a kiírt nevű metódus hívása ártalmatlan.
- **Pontosság:** a korpusz 103 fixture-éből és a generatív katalógus 1 952 programjából csak a már eddig is szigorú `contract-proxy-fallback` érintett; a rögzített számok változatlanok, a gyors baseline-ban csak a címke változott. Az elvetett, szivárgáselemzés nélküli változat a `valid` szerződés hasznát vitte volna el (`algo-bfs-js-valid` 25 → 5).
- **Hibajavítás (befogadhatatlan modell, v26 óta):** TypeScript-osztályos programnál a „szerződés nem alkalmazható” megjegyzéssel a modell megjegyzése 1 000 karakter fölé nőtt, és a séma elutasította. A megjegyzés rövidebb lett, a leghosszabb kombinációra regressziós teszt van.
- **Tesztek:** `property-names.test.mjs` (11 elérési út, időzítő, szerződéskapu, ártalmatlan és konzervatív esetek, a megjegyzés hossza); a v26-címketeszt verziófüggetlen.
- **Címkék:** a v27 additív sémaenumérték; a minták csak az új címkét kapták.

## Unreleased – 2026-11-02 feladatkorpusz és lineáris alakkódolás (ADR-051)

- **Feladatkorpusz:** 12 tanórai jellegű, összetettebb feladat (7 JavaScript, 5 TypeScript: osztályok, kivételek, closure, `Map`/`Set`, generikus osztály, enum, uniótípus, `switch`), mindegyik `any` és `valid` bemeneti szerződéssel; 24 új rögzített korpuszmérés, a mérőfuttató külön `task` csoportja.
- **Mérés:** 27 380 szomszédos sorrend, hibás elfogadás nincs; 12 completeness-rés két feladatban (a `keyEnumeration` az `entries` mezőnevet kulcslistázásnak veszi; többsoros literál lezárása). A `valid` szerződés két feladatban ad szabadságot.
- **Orákulumjavítás:** a `tsShape`/`jsShape` minden szinten újra-escape-elte a gyerekek JSON-alakját, ezért a hossz a mélységgel exponenciálisan nőtt, és egy mély TS-feladaton `RangeError` lett. Az új kódolás lineáris és ugyanúgy injektív: a korábbi 79 fixture alapértéke bájtra azonos, a korpuszteszt kb. 3,5-szer gyorsabb.

## Unreleased – 2026-11-02 választható bemeneti szerződés (ADR-050, v26)

- **Kapcsoló:** a szerző feladatonként választ: szigorú (`any`, alapértelmezett: bármilyen érték, getter, Proxy is) vagy érvényes egyszerű adat (`valid`). A választás a modell `authoring.evidence.environment.inputs` mezőjében rögzül; a modellminősítés és a frissítés ezzel generál újra. Felület: „Bemenetek” választó a szerzői forrásnézetben.
- **Szabály (v26):** `valid` szerződésnél az olvasási egység (property-olvasás, konverzió, spread, listázott beépített hívás, `new Set`/`Map`) csak a külső hatásokhoz képest kötött. Ha a program maga módosíthatja az olvasást (Proxy, prototípus, `eval` stb.), az elemzés szigorú marad, és a modell megjegyzése ezt kimondja. Minden szerződésben: a szétbontott nevek olvasása kötésolvasás.
- **Orákulum (JS és TS):** ugyanez a politika független kóddal, `inputs: 'valid'` fixture-ökre.
- **Mérés:** hat dedikált szerződéses fixture és a könyvtári példák `-valid` változata, hibás elfogadás nélkül; az `algo-bfs-js-valid` 25 szomszédot fogad el (az `any` alatt 5-öt), rés nélkül.
- **Tesztek:** `input-contract.test.mjs`, a szerzői munkaterület és a böngészős forgatókönyv.

## Unreleased – 2026-10-31 az AI governance teljessé tétele (ADR-049, G fázis)

- **Governance-elemek:** az ai-governance.md táblája minden elemhez (eredet, review-protokoll, jóváhagyási pontok, külső tartalom, kockázati besorolás, bizonyítékok, tervezési governance) tulajdonost, kikényszerítést és bizonyítékot ad; a nem gépi elemek kimondottan review-kontrollok.
- **Kockázati osztályok:** mag, szerzői elemzés, orákulum és mérés, megjelenítés, dokumentáció és eszközök, mindegyik a kötelező bizonyítékával.
- **AGENTS.md:** egy helyen a jóváhagyási pontok (push, távoli művelet, deploy, hitelesítő adat, forráskód kiküldése, runtime AI, destruktív git, más munkája, régi feladatok függőségei, pedagógiai döntés) és az eredetszabály (`Co-Authored-By:`).
- **Gépi kontrollok:** `governance.test.mjs` (az ADR-ek épsége; a szabályverzió-címkék egyezése a sémában, a típusban, a szerződésben és a generátorban; az AGENTS.md hivatkozásai; az elemtábla szerkezete); a dokumentum-kapu az ADR-eket és az AGENTS.md-t is ellenőrzi.
- **Szerződés:** a v6 és a v7 külön sort kapott a szabályverzió-táblában.

## Unreleased – 2026-10-31 primitív lokálisok (ADR-048, v25)

- **Szabály (v25):** a függvénylokális `let`/`var`, amelynek minden írása primitívet tárol (kezdőérték, `=` vagy aritmetikai összetett értékadás primitívvel, `++`/`--`), primitív; a legnagyobb ilyen halmaz, így `seen = seen + 1` is. Egy saját objektumokon dolgozó utasítás írhatja, és név szerinti RAW/WAR/WAW köti.
- **Orákulum (JS és TS):** az objektumművelet törzsében a lista saját `let`/`var` kötésének írása megengedett; a P3 dönt.
- **Mérés (12 mag, azonos új orákulum):** flow JS 16,0% → 10,6%, flow TS 12,0% → 8,3%; hibás elfogadás nincs. A gyors baseline és a korpusz-baseline (`prec-try-catch-finally`: 1 → 0 rés) újrarögzítve.
- **Tesztek:** `primitive-locals.test.mjs` (szabad, kötött és konzervatív esetek, JS és TS); a v24-címketeszt verziófüggetlen.
- **Címkék:** a v25 additív sémaenumérték; a példák és a minták csak az új címkét kapták.

## Unreleased – 2026-10-31 a `switch` törzse saját blokk (ADR-047, v24)

- **Projekció (v24):** a `switch` törzse (`CaseBlock`) megtartott blokk, ezért a sorai a scope-ban maradnak, és a `switch` nem zárul le minden testvérével szemben; a hatásnyoma szerint mozoghat. A belső sorrend változatlanul forrásbeli.
- **Mérés (12 mag, azonos orákulum):** flow JS 15,0% → 13,7%, dobó 17,6% → 15,6%; flow TS 11,8% → 11,0%, dobó 5,6% → 2,8%; hibás elfogadás nincs. A gyors baseline újrarögzítve.
- **Maradék:** a többsoros kifejezések folytatósorai lezártak maradnak (a `function` csoport fő oka); ez a v2-ben nem finomítható, a 6. fázis v3-modelljének tárgya.
- **Tesztek:** `switch-scope.test.mjs` (blokk és scope, szabad mozgás, tiltott be- és kilépés, JS és TS); a v23-címketeszt verziófüggetlen.
- **Címkék:** a v24 additív sémaenumérték; a példák és a minták csak az új címkét kapták.

## Unreleased – 2026-10-31 ciklusok a saját objektumokon (ADR-046, v23)

- **Szabály (v23):** a `while`, a `do…while` és a `let` fejű `for` a saját objektumokon hatásnyomot kap; a ciklus által írt lokálisok ismert értéke elvész, ez lefed minden iterációt.
  - a literál korlátú számlálós `for`, amelynek törzse nem írja a számlálót, bizonyítottan véget ér;
  - minden más ciklus „esetleg nem ér véget” (`mayHang`), ezért egy lehetséges kivétellel, külső hívással vagy elakadással kötött (`may-throw`, a jegyzék jelentése bővült).
- **Orákulum (JS és TS):** a fenti ciklusok objektumműveletek, a törzsük a saját fejváltozót írhatja; a P3 dönt. Egy tanú egy eltérést tárt fel (a fejváltozó írása), amelyet az orákulum igazításával zártunk.
- **Mérés azonos (új) orákulummal, 12 mag:** flow JS 22,2% → 15,0%, flow TS 18,7% → 11,8%, dobó változataik 23,6% → 17,6% és 7,5% → 5,6%; hibás elfogadás nincs. A gyors baseline újrarögzítve.
- **Tesztek:** `loop-footprints.test.mjs` (szabad, kötött, konzervatív és barrier maradó esetek, JS és TS); a v22-címketeszt verziófüggetlen.
- **Címkék:** a v23 additív sémaenumérték; a példák és a minták csak az új címkét kapták.

## Unreleased – 2026-10-30 a konstruktorban létrehozott kulcsok (ADR-045, v22)

- **Szabály (v22):** a `return` nélküli konstruktor legfelső szintű `this.x = …` értékadása (accessor és metódus nélkül) a konstrukció után létező kulcs, ezért későbbi írása csak az adott mező írása. Az objektum saját konstrukciója alatt az írás továbbra is kulcsot hozhat létre.
- **Miért nem a naiv változat:** ha a kulcs a konstruktoron belül is létezőnek számít, a konstruktor sorai felcserélhetők lesznek, pedig a kulcssorrend látszik; ez 173 hibás elfogadást adott, ezért a hatásnyom-értelmezés követi, mely objektum konstrukciója fut.
- **Mérés (12 mag):** nem dobó JS-objektumprogramok 13,8% → 0,7%, JS-osztályok 3,1% → 2,1%; hibás elfogadás nincs. A gyors baseline újrarögzítve.
- **Tesztek:** `constructor-keys.test.mjs` (szabad, kötött és rendezett maradó esetek, JS és TS, orákulummal); a v21-címketeszt verziófüggetlen.
- **Címkék:** a v22 additív sémaenumérték; a példák és a minták csak az új címkét kapták.

## Unreleased – 2026-10-30 halott kód: A-politika; a lazítás a jóváhagyott forráshoz kötődik (ADR-043, ADR-044)

- **A-politika (ADR-043, felhasználói döntés):** a referencia futásában le nem futó kód és a semmit nem változtató írás sorrendjét úgy ítéljük meg, mintha lefutna. A tanulónak nincs változás, a generátor eddig is így elemzett.
  - **Mérés:** az orákulum megmondja, mely sorokat futtatja a referencia (`executedRows`); az osztályozó a csak halott kódot érintő, futásidőben egyenértékű elutasítást `intent`-ként számolja, nem résként.
  - **Gyors baseline:** dobó JS-objektumprogramok 32,4% → 19,4%, `function` csoport 26,5% → 25%; a korpusz változatlan.
  - **Határ:** a halott kódban a mérés a generátor pontatlanságát sem látja; az azonos értékű írást a mérés nem választja külön.
- **A lazítás forráshoz kötése (ADR-044):** a szerzői lazítás a jóváhagyott forrás ujjlenyomatát őrzi (`sourceDigest`, additív sémamező).
  - újraszámításkor változatlan forrásnál `reapplied`; megváltozott forrásnál `reconfirm`: a kényszer visszakerül, a megjegyzés a jelentésben marad, az újraerősítés a megszokott megerősített eltávolítás;
  - a régi, ujjlenyomat nélküli lazítás `unchecked`: változatlanul érvényes, mostantól figyelt;
  - a kapu a más forrásra jóváhagyott lazítást nem fogadja el magyarázatnak (`differs`); az érvényesség egyetlen helyen dől el (`relaxationHolds`);
  - a minősítés panel megmondja, miért nem alkalmazta, és mit tehet a tanár.
- **Felismerés:** a konstruktorban értékadással létrehozott mezők írása ma egész objektum írásnak számít; ez a nem dobó JS-objektumprogramok fő maradék oka. Egy naiv javítás hibás elfogadást okozott, ezért külön tervezést kap.
- **Tesztek:** `dead-code-intent.test.mjs`, az ADR-044 esetei a `rule-editing` és az `author-rule-panel` tesztekben, a böngészős workbench-teszt az ujjlenyomatot is ellenőrzi.

## Unreleased – 2026-10-30 címkés objektumműveletek (ADR-042, v21)

- **Szabály (v21):** a címkés `for…of`, `switch`, `if`, `try` vagy egysoros művelet a saját objektumokon az a művelet, amelyet címkéz; a körülvevő címkére mutató `break`/`continue` úgy értelmeződik, mint a címke nélküli. A címkés többsoros blokk és a címkés `while`/`for` barrier marad.
- **Orákulum:** a P2 objektumművelet-definíciója (JS és TS) a címkés műveletet is ismeri, ezért ezek sorrendjét a P3 dönti el.
- **Mérés azonos mércével:** az új orákulummal a v20-as generátor 19, a v21-es 17 rést ad a flow JS-ben (TS: 7 → 4), a többi csoport változatlan. A baseline újrarögzítve; a régi orákulumhoz mért számok nem összevethetők (lásd ADR-042).
- **Tesztek:** `labelled-footprints.test.mjs` (szabad, kötött és barrier maradó esetek, JS és TS, a címkés `switch` azonos kényszerei); a v20-címketeszt verziófüggetlen.
- **Címkék:** a v21 additív sémaenumérték; a példák és a minták csak az új címkét kapták.

## Unreleased – 2026-10-30 szkriptszintű globálisok kódmentes olvasása (ADR-041, v20)

- **Szabály (v20):** a szkriptszintű, egyszer deklarált, név szerint sehol nem írt `var`/`let` primitív kezdőértékkel a szkript szintjén olvasva primitív, ha a referencia-sorrendben az olvasó előtt nincs kódot futtató szkriptszintű utasítás. A függvénytörzsből való olvasás változatlan.
- **Mérés:** a JS-szkriptek indokolatlan elutasítási aránya 21,4%-ról 0,37%-ra (12 mag), a gyors baselineban 28,4%-ról 2,4%-ra esett; nincs hibás elfogadás.
- **Tesztek:** `script-reads.test.mjs` (szabad és kötött esetek, a globális objektumon át írt `valueOf` megfigyelhetősége orákulummal); a v19-címketeszt verziófüggetlen.
- **Címkék:** a v20 additív sémaenumérték; a példák és a minták csak az új címkét kapták.

## Unreleased – 2026-10-30 külső hívás a metódustörzsben (ADR-040, v19)

- **Szabály (v19):** a saját objektumon futó törzsben a program által nem deklarált függvény hívása csak primitív argumentumokkal (saját mezőt olvasó argumentummal is) `external` hatásnyomot kap, és az objektum nem szökik meg.
  - két külső hívás kötött: új indokkód, `external-call-order` (`effect`);
  - külső hívás és lehetséges kivétel kötött (`may-throw`), elkapott hívással is, mert a külső kód nem is térhet vissza;
  - elkapott külső hívás és lokális írás csak akkor kötött, ha az írás más kontextusban deklarált (a külső kód által írható) kötést olvas;
  - listaszintű ismeretlen hívás barrier marad (P2); a közvetlen `eval`, az objektum argumentum, a deklarált és az árnyékolt hívott név ismeretlen kód.
- **Orákulum a szerződéshez igazítva:** az orákulum P2-je az objektumműveletet és a külső hatás nélküli utasítást (lokális írást) csak névütközés alapján köti, a többit a P3 dönti el. Ez a v12 szerződéssora; az orákulum eddig szigorúbb volt (mért programban nem fordult elő).
- **Mérés (gyors generatív, v18 → v19):** JS objektumprogramok 26,6% → 10,9%, dobó referenciával 43,2% → 32,4%; TS objektumprogramok 11,3% → 0%, dobó referenciával 16,7% → 3,3%. A többi csoport változatlan, nincs hibás elfogadás. A korpusz-baseline változatlan.
- **Tesztek:** a tanúk átállítva (`escape-free-shout-beside-writes`: 11 → 0 indokolatlan elutasítás), új szabad, kötött és ismeretlen maradó tanúk; az escape-programok a fixture-katalógusba kerültek; az `external-call-order` bizonyítéka a jegyzékben; a verziócímke-teszt verziófüggetlen lett.
- **Címkék:** a v19 additív sémaenumérték. A `class-inventory-ts` példa, a `evaluate-legacy-serial.corrected.json` és a TypeScript-minták csak az új címkét kapták; a függőségeik változatlanok.

## Unreleased – 2026-10-29 sorvég-kapu; a szökésanalízis terve és tanúi (ADR-040, javasolt)

- **Sorvégek:**
  - a `.gitattributes` már LF-et írt elő mindenhol; mostantól az `.editorconfig` is ezt mondja a szerkesztőknek;
  - a `check` bukik, ha bármely követett szövegfájl CRLF-es (`scripts/verify-line-endings.mjs`, `line-endings.test.mjs`);
  - az AGENTS.md rögzíti, hogy az eszközök LF-et írnak (Pythonban `newline='\n'`).
  - **Az ok:** két tesztfájlba Python szöveges írás tett CRLF-et Windows alatt.
- **4. fázis, 2a részfeladat:** a szökésanalízis 2a–2e részfeladatokra bontva.
  - **Az ADR-040 javasolt szabálya:** a metódustörzsben a primitív argumentumú ismeretlen hívás `external` hatásnyomot kap, és az objektum nem szökik meg.
  - **Mit mutattak a tanúk:** az eredeti elképzelést (ismeretlen hívás és saját objektumművelet szabad cseréje) a szerződés (P2) kizárja, ezért elvetettük.
  - **Rögzített állapot:** `escape-witnesses.test.mjs` rögzíti a mai 11 indokolatlan elutasítást és a megtartandó sorrendeket.

## Unreleased – 2026-10-29 a kategória a jegyzéké; a `declare` változók szabadok (ADR-039, v18)

- **Tervezési adósság rendezve:** az elemzés kibocsátó helyei már csak kódot neveznek meg. A kategóriát egyetlen hely, a projekció kéri a jegyzéktől (`categoryOf`). Megszűnt két rejtett kategóriaszabály. 237 program generált modellje bájtra azonos a változás előtt és után.
- **Szabályhiba javítva (v18):** a `declare const/let/var` és az `export declare` utasítás pozíciófüggetlen, ha minden deklarátora egyedi azonosító, és a sorait birtokolja. A többsoros, objektumtípusú alak is ide tartozik, mint az `interface`. A destrukturáló és a közös sorú alak konzervatív marad.
- **Mérés:** a gyors generatív mérésben a TS-szkriptek indokolatlan elutasítási aránya 18,6%-ról 0%-ra esett. A többi csoport változatlan, nincs hibás elfogadás.
- **Változásfelerősítés megszüntetése:** a generátor exportálja a jelenlegi szabályverziót (`DEPENDENCY_POLICY`). A Node- és a böngészős tesztek ezt használják, a böngészős workbench-teszt a generátor forrásából olvassa ki.
- **Böngészős mátrixteszt:** a 436 soros szolgáltatás befogadásánál hosszabban vár. Ennek oka, hogy a teljes kapu (ADR-036) Node alatt kb. 0,75 s, böngészőben terhelés alatt több.
- **Címkék:** a v18 a sémában additív enumérték. A frissített `class-inventory-ts` példa és a `evaluate-legacy-serial.corrected.json` dokumentum őrzött újrafrissítéssel csak a szabályverzió-címkét kapta meg; a függőségeik változatlanok.
- **Tesztek:** a `declare-erasure` (v18-rögzítés, pozitív, negatív és orákulumos esetek), és a jegyzék új bizonyító programja.

## Unreleased – 2026-10-29 mérési infrastruktúra és indokkód-jegyzék (ADR-038)

- **Egy osztályozó:** a kampány és a korpuszmérés ugyanazt az osztályozót használja (`order-classification.mjs`). Ez megnevezi minden elutasítás okát (a megsértett kényszerek indokkódjait), és külön kezeli azokat a referenciákat, amelyek a próbán kivételt dobnak.
- **Kötelező mérőszámok:** a gyors generatív mérés (`generative-metrics.test.mjs`, kb. 20 s) fajta × nyelv × szabályverzió × dobott-e szerint számol.
  - **Abszolút küszöbök:** hibás elfogadás = 0, eldöntetlen = 0.
  - **Csoportonkénti küszöb:** az indokolatlan elutasítás aránya nem nőhet (`generative-baseline.json`).
  - **Újrarögzítés:** `node tests/ordering-campaign.mjs --baseline`.
- **Az eddigi torzítás láthatóvá vált:** az objektumprogramokon a dobó referenciák indokolatlan elutasítási aránya 17–43%, a nem dobóké 11–27%.
- **Indokkód-jegyzék** (`src/author/reason-codes.ts`):
  - minden provenienciakód kategóriával, jelentéssel és ADR-rel;
  - a `ReasonCodeName` típus elutasítja a nem regisztrált kódot;
  - a barrierek kategóriáját a jegyzék adja.
  - **Bizonyítékok:** 29 kódhoz viselkedési ellenpélda, 3 konzervatív kódhoz előfordulás, 2 kódhoz indokolt felmentés.
  - **Változatlan:** a generátor kimenete.
- **Nyelvi lefedettség:** öt új korpuszfixture (függvény- és osztálykifejezés, `for…in`, `do…while`, `?.`, `delete`, regex, `instanceof`, `in`, TS `as`, `!`, `satisfies`). Mind helyes, és nincs eldöntetlen eset.
- **AI governance:**
  - az Ousterhout-féle tervezési governance saját fejezetet kapott az `ai-governance.md`-ben;
  - a governance teljessé tételének tervezése a terv G fázisa.

## Unreleased – 2026-10-29 a tanúkeresés nem robban (ADR-036)

- **Súlyos hiba lezárva:**
  - Ismétlődő sorok és blokkok mellett egy hibás beküldés eddig `indeterminate` választ kaphatott `rejected` helyett. Láncolt azonos blokkoknál k = 8-nál 556 540 állapot kellett.
  - Most minden mért eset eldől: 3 000 majdnem helyes beküldés hat alakzaton 500 sorig, és 24 800 véletlen tanulói hiba 124 modellen. Egyik sem eldöntetlen, a legrosszabb eset kb. 2n állapot.
- **Új core-modulok**, mindegyik egy döntést rejt el:
  - **`placement.ts`:** a részleges hozzárendelés és minden rá vonatkozó szabály. Három szűkítést tartalmaz: a tranzitív lezártat a legkorábbi és legkésőbbi hellyel, a blokkfolytonosságot és az ellenőrzött, felcserélhető testvér-részfákat. A szabályokból számolt rész gyorsítótárban marad.
  - **`reachability.ts`:** a core egyetlen tranzitívlezárt-számítása, amelyet a diagnosztika is használ. Körkörös gráfra nem számol félig.
  - **`contentKey`:** az azonos tartalom egyetlen definíciója.
- **A validátor** csak a keresési stratégiát tartja meg: a pozíciósorrendet, a keretet és a döntést.
- **Változatlan:** a keresés csak megoldás nélküli vagy egy korábbi jelölt tükörképét adó ágat hagy ki. Ezért ahol a régi keresés döntött, a döntés és a tanú változatlan, az állapotszám soha nem nő.
- **Kapu:**
  - minden szomszédos cserét vizsgál, és célzott nehéz próbákat is futtat: ismétlődő sor a két végén, fordított sorrend, végek cseréje;
  - az első eldöntetlen próbánál leáll, és megnevezi a fajtáját;
  - az összes próba együtt legfeljebb a próbánkénti keret 20-szorosát használhatja;
  - az azonos beküldést nem értékeli kétszer.
- **Review-javítások:**
  - a kézzel összerakott, körkörös szabályt elutasítja;
  - az ismétlődést a validátor tartalomkulcsa dönti el, nem a `trim()`;
  - a nem üres blokkokat külön listában tartja;
  - a rögzített régi keresés a tartalomegyeztetést is befagyasztja.
- **Tesztek:**
  - a `search-pruning` 20 esete: nyers erős ellenőrzés 200 véletlen modellen, nyolc nevesített szélső eset, kör, gyorsítótár, növekvő jelöltlisták, terhelési csomag, v2/v3 összevetés a régi kereséssel;
  - a `model-verification` kapupróbái.
- **Korlát:** a nagy, elfogadott referenciákon kb. 1,2–1,4-szeres idő (500 sornál 4–7 ms).

## Unreleased – 2026-10-29 a nyelvi hiba blokkolja a publikálást; egy kapu (ADR-035)

- **P0 lezárva:**
  - A nyelvi hibás referencia (`audit=errors`) egyik publikálási politikában sem publikálható, az alapértelmezett `publishable` módban sem.
  - A `publicationRefusal` először ezt nevezi meg.
  - A szerzői előnézet változatlanul megmutatja.
- **Egy kapu:**
  - A `verify-models` és a Pages-build ugyanazt a katalóguskaput futtatja, mint a szerver.
  - Ha a `verify-models` bármelyik példát elutasítja, a `check` elbukik.
  - A Pages csak a kiszolgált modelleket másolja; a `publication.json` rögzíti a minősítést és a kihagyás okát.
- **Szigorú beállítás:** az ismeretlen `CODELINE_PUBLICATION` érték hibát ad, nem a gyengébb politikára áll.
- **Példák:** a frissítés tételes eltéréslistája: [peldak-migracioja.md](docs/peldak-migracioja.md).
  - **Alkalmazva:** csak a `class-inventory-ts` frissítése, jóváhagyás után. A tranzitív sorrendje azonos, a revízió marad, a minősítés `analysis-verified`.
  - **Döntésre vár:** a többi négy példa.
  - **Nem frissíthető** a mai generátorral: az `algo-sort-search-js` és a `profiles-js`.
- **Tesztek:**
  - `publication-gate`, 8 eset;
  - a `model-verification` és a `pages-build` bővítése.

## Unreleased – 2026-10-29 vezérlési szerkezetek a generatív kampányban, frissített korlátlista

- **Rés lezárva:** a véletlen programok eddig nem tartalmaztak vezérlési szerkezetet, így a v17 újításait csak kézi fixture-ök ellenőrizték. Az új `flow` kampányfajta (`randomFlowProgram`, JS és TS) a saját objektumokon végzett műveleteket vezérlési szerkezetekbe ágyazza:
  - szabad alakok: `if / else if / else` ismert és ismeretlen feltétellel, őrzött `throw`, `switch` továbbcsorgással, `try/catch`, `try/finally`, `for…of`;
  - barrier alakok: a bejárt tömböt író ciklus, a ciklusban változó helyi érték, a számlálós `for`, a `while` és a címkés `break`.
- **Mérés (1–5. mag):** JS-ben 48 488, TS-ben 46 443 sorrend, **0 hibás elfogadás**. A futásidőben azonos sorrendek 9,9%-a, illetve 7,4%-a elutasított.
- **A meglévő objektumprogramok** betűre azonosak maradtak (a közös `Box` osztály és művelet kiemelése után 120 programon ellenőrizve).
- **Dokumentáció:** a formális szerződés „Ismert korlátok” szakasza a v13–v17 szerinti állapotot írja le (saját objektumok, vezérlési szerkezetek, laza példánymezők, `may-throw`). Az aktuális címke `v17`, és a policytábla sorrendje növekvő.
- **Tesztek:** a `control-flow-footprints` két új esete. Az egyik igazolja, hogy 30 magon minden alak előfordul, mindkét nyelven. A másik minden elfogadott szomszédot és mintavett sorrendet a futásidejű orákulummal ellenőriz.

## Unreleased – 2026-10-29 vezérlési szerkezetek a függvénytörzsben (ADR-034, v17)

- **Rés lezárva:** saját objektumokon dolgozó `else if` lánc, `switch`, `try/catch/finally` és `for…of` (saját tömbön) már nem köt minden más utasítást.
  - A `catch` elnyeli a `try` lehetséges dobását.
  - A ciklus a tömb minden elemét olvassa.
- **Biztonság:**
  - A bejárt tömböt író ciklus (lehet, hogy nem ér véget), a címkés ugrás és a korai `return` barrier marad.
  - A ciklusban változó helyi érték nem marad ismert.
  - A kupac fixpontja az ismert érték elvesztését is követi.
- **Megmaradó korlát:** a `switch` `case` sorait a v2 formátum egy egységként a szomszédaihoz zárja (ADR-009).
- **Kimarad:** a számlálós `for`, a `while` és a `do` (a véget érés nem bizonyítható).
- **Tesztek:** `control-flow-footprints` és hat új fixture.

## Unreleased – 2026-10-29 kétlépéses javítási javaslat (ADR-033)

- **Rés lezárva:** ha egyetlen áthelyezés nem javítja az elrendezést, a kiértékelő két ellenőrzött lépést javasol (`two-move-repair`, `fix.moves`). A legígéretesebb első lépésekből indul, és ugyanabban a keretben marad.
- **Mérés:** két független hibánál a megmagyarázatlan esetek kb. 83%-a kap javaslatot; p95 legfeljebb 130 ms, a legrosszabb eset 500 soron kb. 0,14 s.
- **Tesztek:** a `diagnostics-localization` három új esete, és a nyers erős ellenőrzés minden javaslatsorozatot a validátorral igazol.

## Unreleased – 2026-10-29 értékérzékeny dobáselemzés (ADR-032, v16)

- **Rés lezárva:** egy `if (!id) throw …` ellenőrzés nem számít lehetséges dobásnak, ha a literál argumentum mellett soha nem teljesül. A literálok a törzsekbe ismert értékként érkeznek; a `!`, `===`, összehasonlítás, `+`, `.length`, `typeof`, a rövidzár és a template eldönti az ágat.
- **Kötött marad:** a mindig teljesülő ellenőrzés, az ismeretlen (paraméterből érkező) érték és a kétféle írással összevont mezőérték. Ez utóbbi dokumentált, konzervatív veszteség.
- **Orákulum:** a saját objektumokon dolgozó `if` feltétele bármely érték lehet.
- **Tesztek:** `value-guards`, négy új fixture.

## Unreleased – 2026-10-28 a konstruktor this-írásai (ADR-031, v15)

- **Rés lezárva:** a konstruktor két független `this`-írása (`this.name = name; this.id = id;`) felcserélhető, ha a program nem listázza a kulcsokat. A `this` a nem származtatott, elemezhető osztály konstruktorában saját objektum.
- **Kötött marad:**
  - az olvasás írás után;
  - a kiszökő `this` (például `register(this)`);
  - a kulcsokat listázó program;
  - a származtatott osztály;
  - a paraméteren végzett művelet;
  - ugyanazon mező kétszeri írása.
- **Orákulum:** a konstruktor `this`-műveletei és a bővebb értékkör (literálok, aritmetika, saját mezők, `throw new Error` egy ágban) is helyi objektumművelet; sorrendjükről a futásidő dönt.
- **Tesztek:** `constructor-footprints`, kilenc új fixture; a `01-user-account` 8/8 kombinációja pontosan egyezik a futásidővel.

## Unreleased – 2026-10-28 pontosabb hibaazonosítás (ADR-030)

- **Kérdés:** a setter törzsébe tett `score = 0;` mezőre a kiértékelő csak annyit mondott, hogy „a pontos ok nem nevezhető meg”. Az ok: a blokk záró `}` sora több helyen is állhatott, és az ilyen blokkot a diagnosztika kihagyta.
- **Blokkhatár-becslés:** a határsorok lehetséges helyeinek tartományával számol, és feltételezi, hogy a blokk a nyitó sora után zárul. A 46 soros példa összes egysoros áthelyezésén a bizonyított okok aránya 51%-ról 87%-ra nőtt.
- **Ellenőrzött egylépéses javítás:** ahol bizonyított ok nincs, a kiértékelő egy olyan egysoros áthelyezést javasol, amelyet a validátor elfogad. Nem nevez meg bűnöst, és saját kerete van. 500 soron a tipikus hiba 8 ms, a legrosszabb eset 0,15 s alatt van (Node és Chrome). A tanuló a sort látja, a célhelyet csak `rules` szinttől.
- **Tesztek:**
  - új `diagnostics-localization` (10 eset, nyers erős helyesség-ellenőrzéssel és időkerettel);
  - frissített `diagnostics`;
  - kézi mérőeszköz: `tests/support/move-search-scale.mjs`.

## Unreleased – 2026-10-28 példánymezők szabad sorrendje (ADR-029, v14)

- **Kérdés:** miért hibás a `state` és a `score` mező felcserélése? Mérés: 0 fordítási hiba, azonos értékek, csak az `Object.keys`/`JSON.stringify` kulcssorrend tér el.
- **Döntés (felhasználó):** a kulcssorrend csak akkor számít, ha a program maga listázza a kulcsokat.
- **Generátor:** a kódot nem futtató, egyedi nevű példánymezők egymáshoz képest szabadok. Kötött marad a sorrend:
  - ha egy inicializáló kódot futtat vagy másik mezőt olvas;
  - ha a program kulcsokat listáz (reflexió, `keys`/`values`/`entries`, `stringify`, `assign`, `structuredClone`, `console`, `inspect`, spread, `for…in`);
  - a statikus és az `accessor` mezőknél.
- **Orákulum:** ugyanez a szerződés. A példánymezők kulcsai halmazként számítanak, a P3 kulcsrendezett JSON-t hasonlít.
- **Minta:** a `01-user-account` két mezője felcserélhető. A konstruktor `this`-írásai kötöttek maradnak; ez ismert, tesztben rögzített rés.

## Unreleased – 2026-10-28 futásidőhöz igazított függőségek (ADR-028, v13)

- **Kiinduló kérdés:** a futásidejű mesterprompt saját bemenetén (`runMiniFixture`) a v12 szinte teljes sorláncot adott. A rögzített mintán 328 olyan sorrendet utasított el, amelyet a futásidejű orákulum azonosnak lát. A prompt szerint kézzel készített modell 0 ilyet utasított el. [Soronkénti elemzés](docs/runtime-prompt-mini-fixture-elemzes.md).
- **Javítás:**
  - mezőszintű hatásnyom: ugyanazon objektum két különböző mezőjének írása szabad; az új kulcsot létrehozó írás kötött marad;
  - listaszintű `if/else` hatásnyommal;
  - ismert `String.prototype` metódusok bizonyítottan string értéken;
  - `may-throw` csak két lehetséges kivétel között köt.
- **Eredmény:** a generátor lezárt sorrendi relációja azonos a kézi, prompt szerinti modellével, és a mintán 0 a hibás elfogadás és az indokolatlan elutasítás is.
- **Szigorítás:** a `.length` olvasás csak string értéken elemezhető, mert `null.length` dob.
- **Orákulum:** a P2-kivétel a csak helyi objektumokon dolgozó `if/else`-re is kiterjed. A TS-modulok `export`-ja CommonJS-kibocsátással fut.
- **Tesztek:** négy új ADR-028 eset, három új fixture (`prompt-mini-fixture`, `prompt-one-thrower`, `prompt-new-keys`), és minden elfogadott egysoros mozgatás orákulum-ellenőrzése.

## Unreleased – 2026-10-28 lezáró regresszió (G1)

- **Minta:** a `23-parameter-property` TypeScript-minta fordítható (`Parameters` → `Point`); a modell függőségei változatlanok.
- **Mátrix-flake:** a böngészős teszt a beszúrási határ helyett egyértelmű pontra céloz, és ellenpróbát kapott; az állítások nem gyengültek.
- **Új tesztek:** forráshűségi round-trip (`source-fidelity`, 28 eset) és a szerzői elemzés idő- és memóriakerete (`author-budget`, 10 s / 400 MiB a 500 soros korlátnál).
- **Lezáró eredmény:** `check:all` 741/741; generatív kampány 1 400 programon és 2 372 610 sorrenden, 0 hibás elfogadással; mind a 8 böngészős csomag zöld.
- **Dokumentáció:** [lezáró regresszió – módszertan](docs/lezaro-regresszio-modszertan.md), futtatási útmutatóval és a flake-ek kivizsgálásának menetével.

## Unreleased – 2026-10-28 felfedési politika, szerzői jogosultság és publikálás (ADR-027, F2)

- **Szerzői kapu a szerveren:** token nélkül csak a helyi gépről, loopback hosztnévvel (DNS-rebinding ellen); `CODELINE_AUTHOR_TOKEN` mellett kötelező a Bearer token; cross-site és idegen origin mindig tiltott. A tanulói végpontok változatlanok.
- **Egy felfedési politika** (`channelFeedback`) a szervernek és a Pages-nek. A szerző feladatonként `learnerFeedback: "rules"`-ra emelheti a tanulót: a megsértett pár látszik, az indoklás és a kategória nem. Az indoklás a diagnosztika külön, csak szerzői része (`reasons`).
- **Publikálási szabály** (`publicationRefusal`): a keretben el nem dönthető modellt a katalógus nem szolgálja ki; `CODELINE_PUBLICATION=verified-only` mellett a nem igazoltat sem. A kihagyott fájl érintetlen, a lista megadja a minősítést.
- **Tesztek:** `author-gate`, `catalog-publication`, bővített `diagnostics` és `trust-boundary`.

## Unreleased – 2026-10-28 visszajelzés és soronkénti jelölés (ADR-026, F1)

- **Rövid és részletes magyarázat:** az értékelősáv a legfontosabb bizonyított okot mondja ki. A „Részletes magyarázat” minden diagnosztikát felsorol a javítás bizonyossági szintjével, a szerzőnek a bizonyítékkal és a korláttal.
- **Soronkénti jelölés:** a ténylegesen értékelt sorok jelölést kapnak (biztosan érintett, illetve ezek egyike), képernyőolvasóval is. Az „Ugrás” gomb a fókuszt a sorra viszi. Bármely mozgatás azonnal érvényteleníti a jelölést.
- **Felfedés:** az API nézőnként vág (`discloseReport`). A szerzői előnézet mindent lát, a tanuló a pozíciószintig. A szabályszintű ok visszatartott, és egy általános sor helyettesíti; a megbízható gráf nem utazik a tanulóhoz. A Tanulói nézet pontosan a tanulói szintet mutatja.
- **Tesztek:** core egységteszt, negatív szivárgási API-teszt, böngészős eset Node és Pages módban.

## Unreleased – 2026-10-28 sorrögzítés a Szabályok tábláján (ADR-024)

- **Rajzszög-kapcsoló** minden sor műveleti sávjában: a sort a referencia szerinti helyére rögzíti, újra megnyomva feloldja. Akadálymentes toggle gomb (`aria-pressed`, helyet megnevező címke és tooltip), élő státuszsor, a fókusz a gombon marad. Ugyanaz a típusos `set-fixed` szerkesztés, mint a panelen, amelynek gombja is ezt az ikont kapta.
- **Teszt:** új böngészős eset Node és Pages módban; a kapcsolóteszt egy versenyhelyzete javítva (az újraértékelés megvárása a második húzás előtt).

## Unreleased – 2026-10-28 valódi függőségek soronként: helyi objektumok hatásnyoma és szabad megjegyzések (ADR-025, v12)

- **Cél (felhasználói kérés, mesterprompt):** minden sor csak a ténylegesen szükséges előzményeitől függjön. Az elrendezés pontosan ott romoljon el, ahol a program viselkedése is megváltozna.
- **Helyi objektumok:** egy függvény saját objektumain (`new` saját osztállyal, tömb- és objektumliterál) dolgozó utasítások hatásnyomot kapnak. A hatásnyom a konstruktor-, metódus- és accessortörzsek absztrakt végrehajtásából adódik. Két ilyen utasítást csak objektumütközés (a tárolt referenciákon át is) vagy lehetséges kivétel köt.
  - A prompt referenciaesete: `first.alias` és `store.add(first)`, illetve `first.alias` és `second.activate()` szabad.
  - Kötött marad a tároló sorrendje, a másoló tároló, a megosztott napló, a két dobó utasítás, az ismeretlen kód és az alias.
  - Ismeretlen kód, szökés, öröklés vagy reflexió esetén minden marad a régiben.
- **Megjegyzések:** az egysoros megjegyzés szabad a blokkján belül, utasításlistában és osztálytörzsben is. A többsoros megjegyzés sorai, a JSDoc és az irányelvek (`@ts-`, `/// <…>`) kötöttek maradnak.
- **Független orákulum:** két helyi objektumművelet sorrendjét a futásidejű összevetés (teljes JSON-állapot, napló, kivétel) dönti el.
- **Tesztek:** [object-footprints.test.mjs](tests/object-footprints.test.mjs): a prompt eseteinek mintái, kimerítő egysoros mozgatás, generatív objektumprogramok. Új kampányfajta: `--kinds=object`. A policycímke `scoped-effect-analysis-v12`.

## Unreleased – 2026-10-28 kapcsolatkapcsoló és pontos visszaállítás (ADR-024)

- **A kör kapcsoló:** egy sor körére kattintva a vele kapcsolatban álló sorok kipipálódnak, a kapcsolat színével (kék: előtte, borostyán: utána, lakat: szerkezeti). Pipára kattintva a kapcsolat megszűnik, üres körre kattintva létrejön; a húzás ugyanez. Ugyanúgy működik a Szabályok tábláján és a Próba lépés mindkét zónájában; a gyakorló mód és a tanulói nézet nem látja.
- **Pontos visszaállítás:** a lazítás rögzíti, mit vett ki (`removed`: eredet, okok, megjegyzés), így egy megszüntetett generált kapcsolat újbóli felvétele az eredetit hozza vissza, és a minősítés is visszaáll. Séma: `relaxations[].removed`.
- **Tesztek:** core oda-vissza út, a kapcsoló állapotai, új böngészős eset Node és Pages módban.

## Unreleased – 2026-10-27 magyarázható validáció a core-ban (ADR-023, E1)

- **`diagnoseSubmission`:** a validátor változatlan ítéletét bizonyított okokkal magyarázza. Egy konfliktus csak akkor kerül megnevezésre, ha minden tartalomkonzisztens hozzárendelésben igaz; azonos tartalmú sorok, egyetlen sérült OR-profil vagy elfogyott keret esetén általános, korrekt magyarázat jön.
- **Kategóriák:** ismeretlen, többlet- és hiányzó sor, előfordulási szám, rögzített hely, közvetlen és tranzitív sorrend (lánccal), szerzői és szerkezeti szabály, blokk- és konténerhatár, v3-egység, profilkonfliktus, `indeterminate`, érvénytelen referencia.
- **Javaslatok:** `verified` (a validátor elfogadja), `partial` (csak ez az ütközés szűnik meg), `guidance`; a mozgatás a rendező beszúrási szemantikáját követi (`moveLine`).
- **Keret és felfedés:** explicit lépéskeret részleges jelentéssel; minden diagnosztikának felfedési szintje van (`verdict` … `provenance`) az F2 számára. Szemantikai ok csak kötött provenienciából.
- **Közös tartalmi illesztés:** `content-match.ts`; a validátor ezt használja, a viselkedése nem változott.
- **Tesztek:** [diagnostics.test.mjs](tests/diagnostics.test.mjs), 17 eset, köztük brute-force bijekciós metamorf ellenőrzés és 500 soros mérés.
- **Még nem látható:** a tanulói megjelenítés az F1, a felfedési szabályozás az F2 feladata.

## Unreleased – 2026-10-27 javítás: a szabályszerkesztés nem görgeti a rendezőt a tetejére (ADR-022)

- **Hiba:** a Próba lépésben egy szabály hozzáadása vagy eltávolítása után a megoldás panel a tetejére ugrott. Ok: minden szabályszerkesztés új előnézet-azonosítót ad, a görgetési és fókuszmemória pedig ehhez az azonosítóhoz volt kötve.
- **Javítás:** a memória kulcsa a szerzői projekt (`continuityKey`); a gyakorlófeladatok külön kulcsot kapnak. A szabálypanel saját görgetése is megmarad. A szerkesztés így ugyanúgy viselkedik, mint egy húzás.
- **Tesztek:** `workbench-flow` egységteszt és új Playwright-eset Node és Pages módban (hozzáadás és eltávolítás után változatlan görgetés).

## Unreleased – 2026-10-27 léptetéses szerzői folyamat és vizuális szabálytábla (ADR-022, U1)

- **Két mód:**
  - **Feladat készítése** (kezdőoldal): Forrás → Szabályok → Próba, egy aktív lépéssel; a Szabályok és a Próba alkalmazott modellig zárolt.
  - **Gyakorlás:** a beépített feladatok listája tanulói nézettel. A gyakorlás és a szerzői projekt nem írja egymást; a példák kezdőpontok.
- **Elavulás:** egy nem alkalmazott forrás- vagy JSON-módosítás után a későbbi lépések „Elavult” jelzést és feloldó sávot kapnak („Modell újrakészítése”, „Forrásváltozás elvetése”, „JSON megnyitása”). Egy sikeres alkalmazás minden nézetet ugyanabból a modellből frissít.
- **Vizuális szabálytábla:** a referencia sorai blokkmélység szerint, a szabályok ívekkel rajzolva. Két sor összeköthető húzással (egér, toll, érintés) vagy billentyűzettel; ebből típusos `add-rule` lesz, a döntés a core-é. A D2 szabálypanelje ide költözött.
- **Szabályok a próbarendezőn:** a Próba lépésben is minden soron láncszem- és körgomb, a rendezőben az aktuális elrendezés szerinti ívek (minden mozgatás után újrarajzolva), alatta a szabálypanel. A szerkesztés azonnal újraértékeli a kitöltést; a körgombról induló húzás nem mozgat sort. A gyakorló mód és a tanulói nézet ebből semmit nem lát.
- **Állapotgép:** a típusos `flow.ts` a zárolásról, az elavulásról, a módváltásról és a landolásról dönt; az `author-workspace.ts` egyetlen projektet kezel (ADR-004 ezen része felváltva).
- **Javítások:**
  - a minősítés-blokk nyitott állapota alnézetenként megmarad;
  - a húzás utáni kattintáselnyelés nem nyel el billentyűzetes aktiválást;
  - a helyi mentés és a munkamenet-import a Forrás lépésből is elérhető;
  - a TypeScript-példatár linkje a Forrás lépésben.
- **Tesztek:**
  - [workbench-flow.test.mjs](tests/workbench-flow.test.mjs) és az átírt [author-workspace.test.mjs](tests/author-workspace.test.mjs);
  - a workbench-böngészőcsomag 39 esete;
  - a mátrix, a drag, az offline, a v7 és a TypeScript kör az új navigációval.

## Unreleased – 2026-10-27 szerzői szabálypanel a rendezőn (ADR-021, D2)

- **Szabálypanel:** a szerző saját előnézetében minden sornak van láncszem gombja. Megnyomására megjelennek a sor közvetlen előzményei és követői okkal, szerkeszthetőséggel és megjegyzéssel, és a rendezőben kiemelődnek. A panelen szabály vehető fel, távolítható el (a szerkezeti nem), megjegyzés írható, és sor rögzíthető. Megjelenik a hatásjelentés tanúsorrenddel és a gate státusza is. A tanulói preview-ban ebből semmi nem látszik.
- **Megerősítés:** a szükséges megerősítési szintet a core nevezi meg (`RuleEditResult.acknowledge`). A panel ezt kéri, és az indoklás a lazítással együtt rögzül.
- **Adatmodell nézet:** minősítés, publikálhatóság, megállapítások, állítások és alapjuk, nyelvi audit, szerzői lazítások, refresh-jelentés.
- **Referenciaforrás nézet:** `importEmit`-választó TypeScripthez (`verbatim` / `elide-unused`).
- **API:** `POST /api/author/rules`, illetve Pages-ben `editRules`. A szerver a saját draft-másolatát szerkeszti, és a gate újraminősít. Elutasításnál `200 {ok: false, …}` a válasz, és a draft érintetlen. A fordítási válasz szabálylapot (`rules`) is ad: a közvetlen kényszereket, lezárás nélkül.
- **Javítások:**
  - csak szerzői szabályokból következő redundancia nem teszi szabaddá egy generált kényszer eltávolítását (az ADR-018 pontosítása);
  - a refresh a rögzített `importEmit`-tel generál újra;
  - a szerver az előnézetet a draft revíziójával értékeli;
  - egy szabályszerkesztés nem írja felül a nem alkalmazott referencia- vagy JSON-piszkozatot.
- **Tesztek:** [author-rule-panel.test.mjs](tests/author-rule-panel.test.mjs), Pages-eset, pontosított `rule-editing` eset, két Playwright-eset Node és Pages módban.
- **Ütemezve:** U1, a nézetek léptetéses egyszerűsítése ([epic-állapot](docs/semantic-ordering-epic-status.md)).

## Unreleased – 2026-10-27 metódusok és felső szintű függvények szabad sorrendje (ADR-020, v11)

- **Döntés:** a felső szintű függvénydeklarációk és az osztálymetódusok, accessorok egymás közti sorrendje szabad; a példánymezők, a static mezők és a `var`-ok sorrendje kötött marad.
- **Kivétel:** ha a program maga listázhatja a kulcsokat, marad az ADR-010 szerinti teljes sorrend. Ez akkor áll fenn, ha a forrás megnevez egy reflexiós API-t vagy a globális objektumot, illetve szkriptszinten `this`-t használ:
  - `getOwnPropertyNames`, `ownKeys`, `getOwnPropertyDescriptors`, `Reflect`;
  - `globalThis`, `window`, `self`, `frames`, `global`, `Function`, `eval`.
- **Generátor (`scoped-effect-analysis-v11`):**
  - `observesKeyOrder`, valamint a `reflectedKeys` opció a tag- és az utasításelemzésben;
  - a sima overload-csoport egyetlen metódusdefiníció.
- **Orákulum:** a P4 független követése a nem felsorolható kulcsok halmazként való összevetésével, a reflektáló programot külön felismerve.
- **Könyvtári példák** (revision 2): a `class-inventory-ts` és a `class-accounts-ts` konstruktora és metódusai már nem kötöttek a mezőkhöz. Az engedélyezett sorrendek száma 288 → 5 760, illetve 192 → 20 160, és mind futásidőben ekvivalens.
- **Tesztek:** [key-order-observation.test.mjs](tests/key-order-observation.test.mjs). A régi P4-tesztek kétfelé bontva: kívülről nézve elfogadott, reflektáló programban elutasított.

## Unreleased – 2026-10-27 tiszta egység és hatás-barrier kommutációja (ADR-019, v10)

- **Hiba:** a szerzői előnézetben (generált modell) a `binarySearch` `let low = 0;` / `let high = sorted.length - 1;` és az `insertionSort` `const current = values[i];` / `let j = i - 1;` cseréje elutasított volt. A kézi könyvtári modell és a futás szerint mindkettő helyes.
- **P2 pontosítása (`scoped-effect-analysis-v10`):** egy tiszta, blokkszintű, lokális deklaráció átléphet egy hatás-barriert, ha:
  - a barrier nem hagyja el korán önmagát (`return`/`throw`/`yield`/`await`/kifelé ugrás/`using`);
  - sem a barrier, sem closure nem hivatkozik a deklaráció kötéseire, és nem írja az olvasott kötéseit (kötés és név szerint);
  - a függvény nem használ `arguments`-et.
- **Számláló:** a csak `++`/`--` által írt, primitív kezdőértékű `let`/`var` (a `for` fejléc változója is) olvasása primitív.
- **Orákulum:** a független P2-orákulum saját, név alapú implementációval követi; az `ordering-semantics` teszt ugyanezt használja.
- **Mérés (azonos v10-orákulummal):**
  - korpusz: 0 hibás elfogadás, 417 → 430 elfogadott szomszéd, a rések száma 42 → 29;
  - kampány (1 000 program): 0 hibás elfogadás, 36 716 → 40 693 elfogadott sorrend, a rések száma 6 067 → 4 363.

  Részletek a [formális szerződésben](docs/formal-ordering-contract.md#adr-019-tiszta-egység-és-hatás-barrier-kommutációja).
- **Változatlan:** P4 (a függvények és metódusok kulcssorrendje), a paraméterek property-olvasása. A régi modellek a saját címkéjükkel érvényesek; a gate a v9-et `outdated`-ként jelzi.
- **Tesztek:** [pure-effect-commutation.test.mjs](tests/pure-effect-commutation.test.mjs).

## Unreleased – 2026-10-26 típusos szerzői szabályműveletek (ADR-018, epic D1)

- **Műveletek:** [rule-editing.ts](src/core/rule-editing.ts), `applyRuleEdits`. Szerzői szabály, megjegyzés, `fixed`, OR-profil és profilszabály. Kötegelt, atomikus; minden lépés befogadott, a referenciát el kell fogadni, a bemenet nem változik, a revízió nő.
- **Biztonság:** a `hard` kényszer nem törölhető. A `conservative` csak `unproven-relaxation`, a `proven` és a `legacy` csak `policy-override` megerősítéssel; a lazítás rögzül (`authoring.relaxations`). A szerzői és a redundáns szabály szabadon törölhető, a tranzitív következmény nem törölhető.
- **Hatásjelentés:** a szigorítás és a lazítás `no` (tartalmazással bizonyított), `yes` (validátorral ellenőrzött tanúsorrend) vagy `maybe`.
- **Újraminősítés:** az `editAuthorModel` minden szerkesztés után lefuttatja a gate-et. Szerzői szűkítés esetén `author-modified`, bármilyen lazítás esetén `unverified`.
- **Refresh:** a `refreshAuthorModel` átviszi a szerzői szabályokat, a legacy éleket, a lazításokat (újraalkalmazva vagy visszavonva) és a megjegyzéseket. A korábbi elemzés generált éleit lecseréli, és jelentést ad (`refresh` a draftválaszban).
- **Tesztek:** [rule-editing.test.mjs](tests/rule-editing.test.mjs).

## Unreleased – 2026-10-26 Model Verification Gate (ADR-017, epic V1)

- **Projekciós veszteség:** a projekció megszámolja azokat az egységpárokat, amelyeket az elemzés szabadon hagyott, de a v2-modell rendez (`evidence.projectionLoss`). CopyField: 0, korpusz: 8 ismert pár.
- **Újralevezetés:** a `verifyAuthorModel` a modell forrását a rögzített import-emittel újragenerálja. A függőségeknek, a nem szerzői éleknek és okoknak pontosan egyezniük kell, ezért kézi módosítás vagy hamisított ok nem minősül elemzési eredménynek.
- **Core gate:** a `verifyModel` vizsgálja a befogadást, a referenciát, a keretalkalmasságot (legfeljebb 100 szomszédos csere 50 000 állapottal), a provenienciát, az elemzőverziót, az auditot, a fallbackeket és a szerzői szabályokat.
  - Státusz: `analysis-verified` / `conservative` / `author-modified` / `unverified`, `publishable` jelzővel.
  - Az állítások alapja `checked`, `tested`, `not-established` vagy `refuted`. A soundness mindig `tested`, soha nem modellenként bizonyított.
- **Bekötés:** a szerver minden draftnál újraszámolja, és a megbízható példáknál is rögzíti; a Pages helyben futtatja. Nem tilt, hanem minősít.
- **Tesztek:** [model-verification.test.mjs](tests/model-verification.test.mjs), és a Pages API-teszt is ellenőrzi.

## Unreleased – 2026-10-26 a referencia nyelvi auditja (ADR-016, epic R1)

- **Új, típusos auditor:** [reference-audit.ts](src/author/reference-audit.ts). Egyfájlos TypeScript `Program`-ot épít a szabványos könyvtárral, porton át. Eredménye: `ok`, `errors` (sorral és kóddal), `unverifiable` (feloldatlan modul vagy deklarálatlan globális; a modulokat listázza) vagy `not-run` (nincs könyvtár). A rögzített konfigurációt `assumptions` lista írja le.
- **Szerver:** minden befogadásnál futtatja, az `audit` mező a draftválasz része. A modellbe nem kerül, importból nem vehető át.
- **Pages:** könyvtár nélkül fut, ezért `not-run`.
- **CopyField:** `unverifiable`, 11 feloldatlan import.
- **Tesztek:** [reference-audit.test.mjs](tests/reference-audit.test.mjs), és a Pages API-teszt is ellenőrzi.

## Unreleased – 2026-10-26 bizonyítékkötés és elemzési környezet (ADR-015, epic C2)

- **Evidence:** új, additív `authoring.evidence` mező. Tartalma: a sorok `[id, code, scopeId]` digestje, a szabályverzió és az elemzési környezet (TypeScript-verzió, import-emit, script/modul, osztálymezőmód-függetlenség).
- **Kötött proveniencia:** a magyarázat csak akkor használja az okokat, ha a digest egyezik. Átírt sor, átszámozott azonosító, megváltozott scope vagy hiányzó evidence esetén `unbound`, és minden ok `legacy`. A `fixed` és a szabályok változtatása nem oldja a kötést.
- **Egyetlen definíció:** a digest csak a core-ban van ([evidence.ts](src/core/evidence.ts)); a projekció explicit architektúra-bekötéssel hívja. Az adapter új, opcionális `environment` metódusa adja a környezetet.
- **Refresh:** az újragenerált okokat az eredeti sorazonosítókra köti újra.
- **Minták:** a mintamodellek és a javított legacy JSON evidence-et kaptak.
- **Tesztek:** [evidence-binding.test.mjs](tests/evidence-binding.test.mjs).

## Unreleased – 2026-10-26 a formális szerződés hatóköre (A2)

- A helyességi cél hatóköre, a megfigyelhető állapot pontos definíciója (az orákulummal azonos), az A5 feltevés és a policyverziók táblázata ([formális szerződés](docs/formal-ordering-contract.md#a-helyességi-cél-hatóköre)).

## Unreleased – 2026-10-26 kényszer-proveniencia (ADR-014, epic C1)

- **Okok az elemzésben:** az `OrderingEntry` opcionális `reasons` mezőt kap. A JS/TS utasítás- és osztálytag-elemzés minden élhez kategóriát és kódot ad: kötésolvasás, RAW/WAR/WAW, barrier oka, globális lánc, kiértékelési fázis, reflektált kulcssorrend, komment, nem támogatott alak.
- **Okok a projekcióban:** a blokkzáró, a folytatósor, a klauzulalánc, a lezárás és az elhagyott blokk zárolása saját okot kap. A modellbe csak a redukció után megmaradt élek okai kerülnek.
- **Modell:** új, additív `authoring.provenance` mező (séma és típus, legfeljebb 10 000 elem). Nem értékelési szabály: a lefordított szabályok és az ítéletek nélküle is azonosak. A refresh az új okokat az eredeti sorazonosítókra képezi.
- **Core:** nyelvfüggetlen `explainConstraints(model)` ([constraint-explanation.ts](src/core/constraint-explanation.ts)). Soronként adja a közvetlen és tranzitív kényszereket, az okokat és a szerkeszthetőségi osztályt (`hard`, `proven`, `conservative`, `pedagogical`, `legacy`). A régi és importált modellek `legacy` jelölést kapnak.
- **Minták:** a TS-példatár modelljei és a [javított legacy JSON](docs/evaluate-legacy-serial.corrected.json) proveniencia-mezőt kaptak; a kézi `values-only` modell élei `author` kategóriájúak.
- **Tesztek:** [constraint-provenance.test.mjs](tests/constraint-provenance.test.mjs). Minden generált élnek ismert a kategóriája a korpuszon és a CopyFieldön; ide tartoznak a kategória- és szerkeszthetőségi esetek, a legacy, partial és stale proveniencia, a metamorf validációs teszt, a séma és a refresh-leképezés is.

## Unreleased – 2026-10-26 lokális írások, klauzulaláncok és importok (ADR-013, epic B szakasz)

- **Lokális írások:** az `x = e` (x ugyanabban a függvényben korábban deklarált `let`/`var`, e tiszta) már nem akadály. A tiszta és lokális író egységek szimbólumszintű olvasási és írási halmazt kapnak, él csak RAW/WAR/WAW konfliktusnál keletkezik. A P2 ennek megfelelően pontosítva, az orákulum saját, független implementációval követi.
- **Klauzulaláncok:** a `} else {`, `} catch {`, `} finally {` közös határ egy konténer szeparátorsorokkal, nem elhagyott és sorosított blokk. Minden sor a saját klauzulájában marad, a v3 határeseményes reprezentációval azonos nyelvvel.
- **Importok:** explicit `importEmit` kontextus (`verbatim` alapértelmezés, `elide-unused`). Az `import type` és a TS-emit által törölt import szabad; a modulbetöltő, a mellékhatás- és a JS-import kötött; dekorátoros fájlban konzervatív.
- **Migráció:** a projekció típusos modulba került ([code-line-projection.ts](src/author/code-line-projection.ts)), a JS/TS szerkezet a `js-ts-ordering.ts`-be. A `generator.mjs` csak belépési pont. Az architektúrakapu és a Pages-bekötés frissült.
- **`CopyFieldUtilityService`:** 8 → 0 elhagyott blokk, a 248↔249 csere elfogadott, a 305↔306 (`UUID()`) elutasított; az importok az emit szerint döntődnek el.
- **Mérés:** korpusz és 560 programos kampány: 0 hibás elfogadás; rések 2 072 → 1 959 (a függvényprogramokon −68%). [Részletek](docs/formal-ordering-contract.md#adr-013-lokális-írások-klauzulaláncok-és-importok).
- **Tesztek:** [import-ordering.test.mjs](tests/import-ordering.test.mjs), [local-write-ordering.test.mjs](tests/local-write-ordering.test.mjs), három `precision` korpuszfixture, frissített architektúra- és Pages-tesztek. A `20-shared-boundaries` TS-minta elvárása frissült: az ágon belüli két független konstans felcserélhető, az ágak közötti átlépés továbbra is elutasított. Policy-címke: additív `scoped-effect-analysis-v9`.

## Unreleased – 2026-10-26 osztálykiértékelési fázisok és accessorpárok (ADR-012)

- **Lazítás, a soundness megtartásával:** a generatív kampány réseinek osztályozása alapján, a ClassDefinitionEvaluation lépéseire épülő érveléssel ([ADR-012](docs/adr/012-class-evaluation-phases-and-accessor-pairs.md)):
  - **R1 – accessorpár:** az azonos nevű getter és setter egy tulajdonság. Egymással felcserélhetők, a mezőkhöz képest szabadok, a kulcsláncban egy csoportot alkotnak.
  - **R2 – fázisok:** a static mezők és blokkok, illetve a példánymezők egymáshoz képest szabadok, csoportjukon belül kötöttek.
  - **R3 – számított nevű metódus:** a mezőkhöz képest szabad, a kulcslánchoz és a többi számított kulcshoz képest kötött.
- **Szándékosan nem lazítva:** a szkriptszintű `let`/`var` (szövegből futtatott kód is írhatja), a duplikált nevek és az overload-szignatúrák sorrendje.
- **Policy-címke:** additív `scoped-effect-analysis-v8`; a szerzői magyarázat leírja az új szabályokat. A validátor és a séma jelentése változatlan.
- **Mérés:**
  - korpusz: 0 hibás elfogadás, az R7-rések száma 25 → 20, az R7 A(M) 2 042 → 3 706;
  - generatív kampány, 550 program, azonos magok és mintavevő: 0 hibás elfogadás, az indokolatlan elutasítások száma 3 524 → 2 455 (az osztályokon −42%).

  [Részletek](docs/formal-ordering-contract.md#adr-012-osztálykiértékelési-fázisok-és-accessorpárok).
- **Tesztek:** új [tests/class-phase-ordering.test.mjs](tests/class-phase-ordering.test.mjs), amely mindhárom szabályt JS-ben és TS-ben, mindkét osztálymező-módban, blokkmozgatásos soundness-ellenőrzéssel teszteli. A `refl-ts-accessor-fields` rögzített alapvonala frissült (rés 17 → 12).
- **Tesztsegéd:** az `extensions` mintavevő levágja a halott ágakat (blokk nyitása és zárása), mert a lazább modelleken néhány program exponenciális keresésbe futott. A teljes felsorolás eredménye változatlan.

## Unreleased – 2026-10-26 generatív lefedettség: osztályok, szkriptszint, TypeScript

- **Új generátormódok** ([random-programs.mjs](tests/support/random-programs.mjs)): `randomClassProgram` (felső szintű, öröklő és beágyazott osztályok minden tagfajtával, TS-ben `declare`, paramétertulajdonság, overload, `accessor`), valamint `randomScriptProgram` (szkriptszintű deklarációk, TS-ben `enum`, `namespace`, `import =`). A korábbi generátor csak egy függvénytörzs JS-kódját állította elő.
- **Blokkmozgatás** (`blockMoves`): minden utasítás és osztálytag egészben, a saját listáján belül minden más helyre. Ezt a többsoros mozgást az egysoros szomszédság nem fejezi ki.
- **Orákulum:** a beágyazott osztálydeklarációk futásidejű kulcs- és descriptor-pillanatképet kapnak, a probe lefutása után. Korábban ezekre csak a szintaktikus szabály vigyázott.
- **Tesztek:** a `check:all` 160 referencia lefutását ellenőrzi, és 36 rögzített magú programon mintavett, szomszédsági és blokkmozgatásos soundness-tesztet futtat; ehhez jön egy blokkmozgatás- és egy beágyazottosztály-regresszió.
- **Kézi kampány:** [tests/ordering-campaign.mjs](tests/ordering-campaign.mjs). Eredménye 550 programon és 410 371 sorrenden: **0 hibás elfogadás**, 0 eldöntetlen, 0 `indeterminate`. [Részletek](docs/formal-ordering-contract.md#generatív-lefedettség-osztályok-szkriptszint-typescript).
- **Production:** változatlan. A generátor, a validátor, a séma és a policy-címke sem változott; csak a tesztkód és a tesztorákulum bővült.

## Unreleased – 2026-10-26 felülvizsgálat: `accessor` mezők és TS-kibocsátott globálisok (ADR-010 kiegészítés)

- **Felülvizsgálat:** a WP1–WP8 utáni kódáttekintés két, a P4-et sértő hibás elfogadást talált, egyik alak sem szerepelt a korpuszban:
  - egy metódus átléphetett egy TS `accessor` mezőn, pedig az get/set párt hoz létre a prototípuson (static esetén a konstruktoron) a metódusok között;
  - egy szkriptszintű függvény átléphetett egy `enum`-on vagy egy példányosított `namespace`-en, pedig ezek `var`-ként globális tulajdonságok. Ezt az orákulum sem látta (közös vakfolt).
- **Javítás:** az `accessor` mező a kulcsláncba kerül; az `enum`, a példányosított `namespace` és az `import =` alias globális egység. A típus-only namespace szabad marad. Az orákulum a TS globálisokat a kibocsátott szkriptből olvassa. Részletek: [ADR-010 kiegészítés](docs/adr/010-reflective-property-order.md#kiegészítés-felülvizsgálat-utáni-javítás-scoped-effect-analysis-v7).
- **Policy-címke:** additív `scoped-effect-analysis-v7`. A validátor és a séma jelentése változatlan; az importált modellek nem generálódnak újra.
- **Tesztek:** két új reflexiós fixture (`refl-ts-accessor-fields`, `refl-ts-emitted-globals`), reprodukciók parserrel, teljes típusellenőrzéssel és mindkét emit-módban, tagblokk-permutáció. A `ts-enum` forgatókönyv probe-ja a globális kulcssorrendet is kiolvassa, ezért a „függvény az enum elé” változat indokolt elutasítás lett.
- **Mérés** (61 fixture, azonos orákulum mindkét oldalon): a hibás elfogadások száma a K45-ön 1 → 0, az R7-en 463 → 0. A completeness-rések száma változatlan, a K45 A(M) értéke 2 298 → 2 297. Az új elfogadott halmaz a régi részhalmaza, és minden eleme helyes. [Részletek](docs/formal-ordering-contract.md#v7-kiegészítés-accessor-mezők-és-ts-kibocsátott-globálisok).

## Unreleased – 2026-10-26 WP7 nyelvfüggetlen sorrendi határ és WP8 dokumentáció (ADR-011)

- **WP7:** új, nyelvfüggetlen [`ordering-relations.ts`](src/author/ordering-relations.ts) szerződés. Tartalma: `OrderingRelations`, konjunktív kombináció, valamint áthelyezve a lezárás és a tranzitív redukció.
  - A JS/TS-elemzést a [`js-ts-ordering.ts`](src/author/js-ts-ordering.ts) fogja össze, az adapter `orderingRelations` metódusán át.
  - A `generator.mjs` már csak projekció: nem importál TS-specifikus modult. Az architektúrakapu ezt gépileg tiltja; a korábbi két generátorkivétel megszűnt.
  - Viselkedésmegőrző: mind a 167 generált modell bájtra azonos (korpusz, 80 véletlen program, nagy referenciák, 24 TS-minta).
  - Új teszt: [`tests/ordering-relations.test.mjs`](tests/ordering-relations.test.mjs). Lefedi a konjunkciót, a lezárást, a redukciót, a diszjunkt sorokat és egy nem TypeScript-alapú játéknyelvi adapter projekcióját.
  - A Python szerkezeti feladatai dokumentálva, implementáció nélkül.
- **WP8:** a [formális szerződés](docs/formal-ordering-contract.md) új szakaszokat kapott:
  - végleges állapot;
  - a soundness és a completeness mérési jelentése;
  - konzervatív fallbackek;
  - a tesztorákulum bizonyítási határai;
  - P0–P4-re frissített helyességi állítás.

  A korábbi mérések történeti szakaszként maradnak meg.

## Unreleased – 2026-10-26 reflektálható tulajdonságsorrend (ADR-010)

- **Probléma:** az ADR-008 óta két különböző nevű osztálymetódus, illetve két szkriptszintű `function`/`var` cseréje elfogadott volt. Minden hívás eredménye azonos maradt, de az `Object.getOwnPropertyNames(C.prototype)`, a `Reflect.ownKeys(C)` és az `Object.keys(globalThis)` sorrendje megváltozott.
  - Ha maga a program reflektált, ez a régi politika szerint is hibás elfogadás volt.
  - Reprodukció JS-re és TS-re: parser, teljes strict típusellenőrzés és mindkét emit-mód külön ([tests/reflection-ordering.test.mjs](tests/reflection-ordering.test.mjs)); a régi kódon 8-ból 7 teszt elbukik.
- **Politika:** új P4-feltétel: a reflektálható kulcssorrend és a descriptor-fajta megőrzendő. A forrásszöveg-reflexió (`toString`, `stack`) explicit módon kizárt.
- **Author-javítás:**
  - **Kulcslánc a tagokra:** a kulcsot létrehozó metódusok és accessorok azonos objektumon (prototípus, illetve konstruktor) forrássorrendben maradnak.
  - **Szabad marad:** a `constructor`, a privát `#`, a tömbindex nevű és a törölt tag.
  - **Szkriptszint:** a szkriptszintű függvények és `var`-ok egy láncot alkotnak. Mérés szerint a V8 forrássorrendben hozza létre a globális tulajdonságokat.
- **Policy-címke:** additív `scoped-effect-analysis-v6`. A validátor és a séma jelentése változatlan.
- **Orákulum:** szintaktikus P4-szabály és futásidejű `Reflect.ownKeys`-pillanatkép, külön `reflection` okkal. A `policy: 'call-only'` a régi szemantikát adja vissza összehasonlításhoz; a mérőeszköz `--policy` kapcsolót kapott.
- **Mérés:** azonos, 59 fixture-ös készleten.
  - A reflexiós politika szerint a régi generátor 14 321 hibás elfogadása (a K45-ön 9 151) 0-ra csökkent.
  - A K45-en az elfogadott teljes sorrendek száma 11 449-ről 2 298-ra csökkent; ez pontosan a régi halmaz helyes része.
  - A szomszédsági rések száma változatlan.
- **Frissített elvárások, gyengítés nélkül:**
  - két forgatókönyv-probe a kulcssorrendet is kiolvassa, ezért két változat indokolt elutasítássá vált;
  - új, elfogadott változat igazolja, hogy a metódus a mezőkhöz képest szabad;
  - a policy-címke 4 helyen frissült;
  - a completeness-alapvonal frissült.

## Unreleased – 2026-10-25 WP6 sorrendi hibák javítása és mérés (ADR-009)

- Hat hibásan elfogadó hiba javítva, mindegyikre előbb reprodukáló fixture készült (`origin: 'wp6'`):
  - **Lezárás:** pozíciófüggetlen sor nem kerülhet többsoros utasítás, `} else {`/`} catch {` határú blokk vagy többsoros mező belsejébe ([generator.mjs](src/author/generator.mjs)).
  - **Overload-csoport:** a TS overload-csoport egyetlen egység.
  - **Tisztaság:** nem tiszta az önhivatkozó inicializáló, a más függvénykontextusból olvasott `let`/`const`/osztály és a `case`-ágbeli kötés olvasása.
- Teljességi javítások:
  - a constructor ténylegesen szabad (névfeloldási hiba), a paramétertulajdonságokkal együtt;
  - a `declare` mező szabad;
  - a soha újra nem írt `let`/`var` függvénykontextusban `const`-ként primitív operandus (írási halmazok).
- Új, additív policy-címke: `scoped-effect-analysis-v5`. A `TypeMemberOrdering.spans` a generátornak adja az egységhatárokat. Az orákulum P0-ja ellenőrzi a TS overload-szomszédosságot.
- **Mérés:** a HEAD kódjával összevetve, ugyanazon az 54 fixture-ös készleten.
  - Hibás elfogadás: 81 → 0.
  - Completeness-rés az eredeti 45 fixture-ön: 28 → 6.
  - Elfogadott teljes sorrend: 5 100 → 11 449, mind orákulummal ellenőrizve.
  - Részletek és a nagy referenciák: [formális szerződés](docs/formal-ordering-contract.md#wp6-javítás-mérés-és-regresszióvédelem).
- **Új tesztek:**
  - `tests/wp6-regressions.test.mjs`;
  - `tests/ordering-scale.test.mjs`;
  - kiterjesztett véletlen programok;
  - a mérőeszköz új mérőszámai: nem támogatott esetek, redundáns élarány, nagy referenciák.
- **Frissített elvárások, gyengítés nélkül:**
  - a policy-címke 4 helyen;
  - a scope-mátrix `declare` változata most `accepted` (orákulum szerint ekvivalens);
  - a UserAccount-teszt megengedett halmaza a constructor mögé kerülő mezővel bővült (mindkét mezőmódban futásidőben ellenőrizve);
  - a rögzített completeness-alapvonal.

## Unreleased – 2026-10-25 WP5 szemantikai regressziók és sorvégkezelés

- `tests/semantic-corpus.test.mjs`: a 45 fixture-ös korpusz feltétlen soundness-ellenőrzése, fixture-enként rögzített completeness-alapvonallal (`tests/fixtures/ordering-baseline.json`) és negatív kontrollokkal. `tests/ordering-properties.test.mjs`: 24 360 elrendezéses kimerítő Π(T) független tanúellenőrzéssel, 30 seeded véletlen program, átnevezési/újrabehúzási/ID-csere metamorf relációk és keretkonzisztencia. Hibás elfogadás: 0.
- `.gitattributes`: LF az indexben és minden munkakönyvtárban (CRLF csak .bat/.cmd), bináris eszközök jelölve; a `sync-vendor` LF-fel másolja a CRLF-es upstream licenceket. Megszűnnek a build utáni fantom-módosítások.

## Unreleased – 2026-10-25 hatásösszegzésen alapuló sorrendelemzés (ADR-008)

- A `statement-ordering.mjs` strict TypeScriptre migrált ([src/author/statement-ordering.ts](src/author/statement-ordering.ts)): egységenkénti pure / position-free / barrier / opaque osztály indokkal, kötésolvasás paraméterekre, ciklus- és `catch`-változókra, friss literálok, closure-ök, hoistolt függvény- és törölt típusdeklarációk, osztálydefiníciók; osztálymetódusok JS-ben is szabadok. `eval` és `using` konzervatív. Új additív `dependencyPolicy`: `scoped-effect-analysis-v4`. Független pedagógiai-politikai orákulum ([tests/support/semantic-oracle.mjs](tests/support/semantic-oracle.mjs)) és 45 fixture-ös korpusz: hibás elfogadás 0 → 0, egyenértékű de elutasított szomszédos elrendezés 103 → 30. Formális szerződés: [docs/formal-ordering-contract.md](docs/formal-ordering-contract.md).

## Unreleased – 2026-10-25 összetett példák és scope-mátrix

- Bal oldali feladatkönyvtár: a `sum-js`, `sum-ts` és `dependencies-js` helyett négy összetett feladat (BFS rácson, beszúrásos rendezés + bináris keresés, absztrakt osztály + öröklés, interface + generikus osztály). A régi modellek tesztfixtúraként változatlanul futnak (`tests/fixtures/legacy-examples/`). Új `tests/complex-scope-ordering.test.mjs`: 15 JS/TS forgatókönyv, 73 elnevezett változat, teljes egysoros-áthelyezési/páros-csere söprés és a könyvtári modellek összes lineáris kiterjesztése futási orákulummal. Eredmény: nincs hibás elfogadás; 21 ismert konzervatív korlát dokumentálva ([docs/complex-scope-ordering.md](docs/complex-scope-ordering.md)). A Pages-tesztek a szállított példák számát az `examples/` mappából veszik.

## Unreleased – 2026-10-24 audit

- TypeScript member-ordering: az egyszerű, külön nevű, törölt típusmezők indokolatlan soros kötése javítva strict TS author-projekcióval. A rendes class mezők és this-értékadások megfigyelhető sorrendje megmarad. Új policy-magyarázat, 24 letölthető source/model pár, teljes kis permutációs és Node/Pages böngészős mátrix, strict fixture-typecheck és generált példatár-CI kapu. [UserAccount-elemzés](docs/typescript-ordering-analysis.md), ADR-007.

- Lezáró ág-/PR-review és fejlesztési összegzés: a korábbi három fejlesztési ág már a main történetében; a Python könyvtári szelet és a review-javítások külön beolvasztási kapuval. ADR-004 pontosítva az explicit függőségfrissítésről; a teljes Python-adapter és termékintegráció továbbra is nyitott. [Összegzés](docs/development-summary-and-integration.md).

- Teljes fejlesztési review: natív IR teljes fizikai forráslefedése, ritkás renderjavaslat elutasítása, Python loaderhiba utáni újrapróbálás és nagy AST erőforrás-diagnosztika javítva. A szerzői guard már a fájl-/clipboard-/hálózati I/O előtt rögzül; késői JSON/session-import nem ír felül újabb referenciát. A dokumentáció parser/adapterszelet-státuszai egységesítve. [Review és bizonyíték](docs/review-language-engine-python.md).
- Régi v2 soros modellekhez explicit Sorfüggőségek újraszámítása: typed author port, Node/Pages admission, megmaradó ID/kód/fixed/kézi élek/profilok és kompatibilis kitöltés. A képi evaluate-eset 5040 permutációs regresszióval, API- és böngészős tesztekkel, javított JSON-nal dokumentált. Normál import és learner validáció változatlan.

- A mainre zárt alapok után megkezdett Python-integráció: pinned Pyodide 314.0.7 / CPython 3.14.2 author parserport, izolált process/worker, strict DTO, cancel/timeout/restart, hash/licenc artifactkapu és 58 esetes Node/Chromium korpusz (+27 generált kombináció). Teljes Python IR-adapter, UI és release továbbra is nyitott; [pontos státusz](docs/python-parser-platform.md).

- Részletes Python-adapter integrációs terv: PY-01–PY-11 taskok, parser/platform döntési kapu, IR-leképezés, verziózott termékintegráció és tesztmátrix. Ebben a tervcommitban Python-adapter még nincs implementálva.

- Referencia-/próbamunkafolyamat javítása: a kézzel gépelt referencia megmarad, feladatonként külön source/JSON draft, egyértelmű Referenciaforrás/Megoldáskód nézetek és pending jelzések, explicit rendezőből újratöltés, késői admission elleni védelem. Strict TS workspace-politika, ADR-004 és Node/Pages böngészős regressziók.

- Language IR v1 és opt-in CodeLine v3 alap: fizikai source span, atomi többsoros unit, külön syntactic container/binding scope, virtuális határesemények, indent policy. Ugyanaz a bounded bijekciós validátor, strict TS adapterregiszter, JS/TS v2 bridge, gráfmentes render port, Schema-/permutációs-/adapter-/Chromium-contract tesztek és CI generáltkód-kapu. V2 UI, API, importált szabályok és governance megőrizve. Python parser/adapter és v3 termékintegráció nyitott; [terv és állapot](docs/language-engine-migration.md).

- Unicode whitespace előtagok tartalommegőrzése a live formatterben: csak ASCII szóköz/tab normalizálható, a validátor szerződésével egyezően.
- Kiadás előtti review: fixed pozíció közvetlen korláttal, implicit oldalkorlát nélkül; késői formázási és hibás kiértékelési válaszok nem írnak felül újabb munkát. Új üzleti/technikai szerződés és ADR-002.
- Munkafolyamat-központú UI/UX: forrás-/JSON-belépés, forrásfájl-betöltés, külön tanulói preview, megmaradó editor-draftok, hozzáférhető tabs/shortcut/fókusz/busy és mobilfelület; új megjelenítési források strict natív TypeScriptben.
- AI governance, AGENTS, Ousterhout-alapú döntéstulajdonosok és TS-migrációs ADR; natív TS architektúrakapu import-/strictness-/végrehajtási korlátokkal, generált forrásgazdákkal és negatív regressziókkal.

- Scope-onként kompozicionális függőséggenerálás: külső konstanskötések, beágyazott egységek és adat-/vezérlési korlátok; 5040 képi sorpermutációs JS-orákulum, háromszintű regressziók és korai prefix-scope-ellenőrzés az azonos kapcsos zárójelek miatti kereséshez.

- Kötésalapú részleges sorrend az egyszerű primitív const deklarációk között; állandó ID-alapú függőségek, opcionális sourceLine és szerver által számított matchedTokenIds megfeleltetés, szerzői/kiértékelési táblázatokkal. A meglévő modellek szabályai megmaradnak.

- Natív drag-and-drop javítása minden példánál: a böngésző által küldött pointercancel nem törli többé a natív húzást; 36 valódi Node/Pages böngészős regressziós eset.

- Indítási portütközés javítása: implicit alapportnál korlátos fallback, explicit PORT-nál olvasható hiba; más alkalmazás folyamatát nem állítjuk le.

- TASK-19: másolás/beillesztés a szerzői forráshoz, JSON-modellhez, megoldásszerkesztőhöz és rendezőhöz; forrássor-másolás, hibavisszajelzés és fixed-védelem.

- Regex-, komment-, string- és template-tudatos, öt szóközös toleráns behúzás; exact és nyers literálsorok védelme.
- Valódi JS Beautify összehasonlító regresszió, helyi assetek és kontrollált lexikai fallback.
- AST-alapú JS/TS blokkhierarchia; globális struktúravesztés helyett dokumentált intervallumfallback.
- Külön szerzői szintaktikai referenciaaudit, JS-specifikus Acorn parser és működő nyelvi adapterregiszter.
- Egyetlen JSON Schemából generált runtime-ellenőrző; duplikált függőségek, integritás és erőforráskorlátok egységesítése.
- Hatékonyabb fixed-horgonyélek és referenciasor-indexelés; megőrzött bounded search és indeterminate.
- Natív, pointeres, touch és billentyűzetes beszúrás; fókusz/státuszüzenet és animációközi célzás javítása.
- Explicit Local Demo / Preview / Trusted Server validációs módok.
- Modell- és munkamenet-export/import, kézi helyi mentés, szigorú próbálkozásintegritás.
- Bővíthető mezőregiszter, külön szerzői életciklus és persistence, egységes CSS.
- Hordozható HTTP/Pages Playwright-mátrix és egyszeri verify → ellenőrzött artifact → deploy CI-lánc.
- UTF-8 README, helyes repository/Pages útvonalak, pontos tesztállítások és megőrzött harmadikfél-licencek.

A helyi audit lezárásakor távoli push, release és deployment nem történt; a később külön kért kiadási szakasz nyoma a Git/GitHub történetben követhető. Projektlicenc választása továbbra is tulajdonosi döntés.
