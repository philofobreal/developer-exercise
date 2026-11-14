# ADR-151 – A szerver nyilvános címen: a látogató címe, és csak gyakorlás

Állapot: **elfogadva** (2026-11-14). A felhasználó döntése: „az a fő célom, hogy ne tudjanak belenézni a fejlesztési know-how-ba”, majd „legyen az A, a motor fusson szerveren”. Kockázati osztály: szerver és megjelenítés. A validátor, a szerzői elemzés, a szabályok és az értékelés nem változott.

## Kontextus

- **A Pages-kiadás a motort a böngészőbe szállítja.** Az `_site` kb. 2 MB olvasható JavaScriptet tartalmaz: a validátort és a szerzői elemzést modulonként, 53 `.d.ts` és 53 `.map` fájllal, a `src/author` forrásait változatlanul. Tömörítés ezt csak lassítja, nem rejti el.
- **A Node-szerver a motort magánál tartja:** a `public/` mappát és az API-t szolgálja ki, a `dist/` nem érhető el róla. Eddig helyi fejlesztői szerver volt; nyilvános címen négy dolog nem működött (mérve és a kódból):

  | Hiány | Következmény nyilvános címen |
  | --- | --- |
  | A kéréskorlát a socket címére számolt | proxy mögött minden látogató egy címnek látszik: percenként 120 POST összesen |
  | A szerzői kapu a socket címéből döntött | a saját gépen futó proxy mögül minden látogató helyi kliensnek látszik; ha a proxy a hosztnevet is átírja (az nginx alapbeállítása), token nélkül a szerzői API nyitva áll |
  | A lap szerzői módban nyílt, és minden szerzői eszközt felkínált | a látogató olyan felületet lát, amelynek minden kérését a szerver elutasítja |
  | A `typescript` fejlesztői függőség volt | a szerver futás közben tölti be; `npm ci --omit=dev` után nem indul |

## Döntés

### 1. A látogató címe ([client-address.ts](../../src/server/client-address.ts))

- **`CODELINE_TRUSTED_PROXIES`** megadja, hány saját fordított proxy áll a szerver előtt (alapérték 0: közvetlen elérés). Hibás érték esetén a szerver nem indul el.
- **Proxy mögött a látogató címe** az `X-Forwarded-For` jobbról számított annyiadik eleme, ahány megbízható proxy van: ezt az utolsó megbízható proxy írta be. Ami tőle balra áll, azt a látogató maga küldte, nem számít.
- **Ha a lista rövidebb a láncnál,** a kérés nem a teljes láncon jött: a cím a socket címe.
- **Egy cím, két felhasználó:** a kéréskorlát és a szerzői kapu ugyanazt a címet kapja. A szerzői kapu `client` paramétere nélkül a socket címéből dönt, mint eddig.

### 2. Kérdés a szervertől: kap-e ez a kliens szerzői szolgáltatást

- **`GET /api/access` → `{authoring: boolean}`.** A válasz a szerzői kapu döntése erre a kérésre. Jogot nem ad: minden szerzői útvonal újra dönt ([ADR-027](027-disclosure-and-author-authorization.md)).
- **A lap egyszer kérdez, induláskor** (`authorAccess`, az [api.ts](../../src/workbench/api.ts) portján). A megválaszolatlan kérdés „nem”. A Local Demo mindig „igen”: ott a szerzői motor a látogató böngészőjében fut.

### 3. Ahol nincs szerzői szolgáltatás, a lap csak gyakorlás

- **Egy tulajdonos, az elérhetőségi modell** ([availability.ts](../../src/workbench/availability.ts), [ADR-120](120-availability-model.md)): az `authoring` és a `format-solution` művelet *rejtett*, ha `state.authoring === false`.
- **A nézet nem rajzolja ki** a módváltót, a „Saját feladat ebből” hivatkozást és a megoldáskód „Formázás” gombját (az a szerzői szolgáltatást hívja).
- **A szerzői módba nem lehet belépni:** az `enterMode` ilyenkor nem vált. A lap gyakorló módban nyílik, és szerzői politikát sem kér le, így a háttérben sincs elutasított kérés.
- **A súgó „Kipróbálom” hivatkozása** megmondja, hogy a feladatkészítés ezen a szerveren nem érhető el, és a gyakorlásban marad.
- **Ez felületi elkülönítés, nem jogosultság:** a jogot továbbra is a szerver dönti el.

### 4. A `typescript` futásidejű függőség

A `dependencies` közé került, mert a katalógus és a szerzői szolgáltatás futás közben tölti be.

## Két terv („design it twice”)

**A látogató címéhez:**
1. **Az `X-Forwarded-For` első eleme.** Elvetve: azt a látogató írja, a korlát egy fejléccel megkerülhető.
2. **A megbízható proxyk száma, jobbról számolva (választott).** Csak azt hiszi el, amit a saját proxy írt.

**A csak gyakorló laphoz:**
1. **A lap a szerzői politika lekérésének hibájából következtet.** Elvetve: a hálózati hiba és az elutasítás egybemosódik, és minden látogatónál egy elutasított kérés marad.
2. **Külön útvonal a kérdésre (választott).** A `getExercises` szerződése nem változik.
3. **Külön, szerzői kód nélküli lapváltozat.** Elvetve most: két felület, két tesztkör. A szerzői *megjelenítés* kódja így a nyilvános oldalon is letölthető; a motor nem.

## Tervezési review (docs/design-review.md)

- **client-address.ts:** *elrejti* a fejlécet, a lista formátumát és a számolást. *Interfésze:* egy cím a kérésből, és a környezeti változó értelmezése. Hívója a szállítási réteg és a kompozíciós gyökér.
- **author-gate.ts:** az interfész egy opcionális mezővel bővült (`client`). *Elrejtve marad,* hogy a címből és a hosztnévből hogyan lesz döntés. Változó hívó: a `http.mjs`.
- **availability.ts:** a „nincs szerzői szolgáltatás” szabály egy helyen van; a nézet és a `flow.ts` őt, illetve az állapot egy mezőjét kérdezi.
- **design, rögzítve:** a `public/ui.js` (régi, kézzel írt modul, [ADR-001](001-typescript-workbench-and-boundaries.md)) négy helyen bővült bekötéssel (indulás, politika-lekérés, súgópróba, import); új szabály nem került bele.
- **design, rögzítve:** a `format-solution` azért rejtett, mert a formázás szerzői útvonalon fut. A tanulói formázás saját útvonala külön döntés.

## Bizonyíték

- **Egységteszt** ([public-server.test.mjs](../../tests/public-server.test.mjs)):
  - a cím közvetlen elérésnél, egy és két proxy mögött, ismételt fejléccel, megkerült proxyval és a láncnál rövidebb listával;
  - a hibás `CODELINE_TRUSTED_PROXIES` érték hibát dob;
  - a helyi proxy mögül érkező látogató nem helyi szerző, loopback hosztnévvel sem;
  - az `/api/access` válasza helyi szerzőnek, proxy mögötti látogatónak, tokennel és token nélkül;
  - a kéréskorlát látogatónként számol, és a hamisított bal oldali elem nem nullázza.
- **Egységteszt** ([availability.test.mjs](../../tests/availability.test.mjs)): a két művelet rejtett, és a szerzői módba nem lehet belépni.
- **Böngészős sor** ([browser-public.playwright.py](../../tests/browser-public.playwright.py), `npm run test:browser:public`, a `test:browser:all` része), 5 eset: asztali gépen és telefonon nincs módváltó, szerzői lépés és „Saját feladat ebből”; az ellenőrzés elfogad; a megoldáskód nézetében nincs „Formázás”; a súgópróba üzenetet ad; a helyi szerző lapja változatlan. Egyik nyilvános esetben sincs 400 fölötti válasz vagy lapon belüli hiba.
- **Mérés** (ezen a gépen, 4 mag): indulás 1,1 mp, memória kb. 225 MB, egy kiértékelés mediánja 1,2 ms.
- **Teljes kör:** `npm run gate` (a szerver és az eszközlánc változott).

## Nyitott

- **A kitelepítés maga nincs kész** (NY-59): a tárhely kiválasztása a felhasználó döntése; hozzá tartozik a `npm run deploy` parancs, a statikus fájlok gyorsítótárazása és tömörítése (ma `no-store`, tömörítés nélkül), és az, hogy a piszkozatok és a kéréskorlát memóriában élnek, ezért egy példány futhat.
- **A motor addig nyilvános marad, amíg a Pages-kiadás és a nyilvános forrásrepó él** (NY-60): a Pages leállítása és a repó priváttá tétele távoli művelet, a felhasználó dönt róla.

## Korlát

- **A feladatlista a sorokat a referencia sorrendjében adja,** és a felület a „Mintamegoldás kitöltése” gombot is felkínálja: egy érvényes megoldás így a szerverről is kiolvasható. Ez pedagógiai döntés, ez a változás nem érinti. A szabálygráf nem jut ki.
- **A nyilvános lapon az akadálymentességi átvizsgálás nem futott külön;** a lap a gyakorló nézet, amelyet a meglévő sor vizsgál.
- **Munkamenet importja szerzői modellel** a nyilvános lapon a szerver elutasításával végződik (az üzenete megjelenik).
