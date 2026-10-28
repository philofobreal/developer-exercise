# Munkafolyamat-központú UI/UX

## Cél és megőrzött érték

A műhely programozási sorrendező feladatok készítését és kipróbálását segíti. A nyilvános CodeLine-modell, a tartalmi és függőségi/scope-validálás, a fixed sorok, az exact whitespace, a több beviteli út és az import/export szerződése változatlan. A felület a már működő döntéstulajdonosokra épül, nem vezet be második validátort.

## Két mód, három lépés ([ADR-022](adr/022-stepwise-author-flow.md))

A fejléc módváltója két, egymástól független munkát választ el:

- **Feladat készítése** (kezdőoldal): egyetlen szerzői projekt, három lépésben. Egyszerre egy lépés aktív.
- **Gyakorlás:** a beépített (trusted) gyakorlófeladatok listája, tanulói rendezővel és megoldáskóddal. A gyakorlás soha nem változtatja a szerzői projektet, és a szerzői munka sem a gyakorlást. Egy gyakorlófeladatból a „Saját feladat ebből a példából” gombbal lehet saját feladatot indítani.

A szerzői lépések:

| Lépés | Mit csinál | Mikor érhető el |
| --- | --- | --- |
| **1 · Forrás** | A helyes program (forráskód) vagy egy kész CodeLine JSON. Indulás üresen, példából, forrásfájlból, a TS tesztfájlból vagy mentett munkamenetből. A „Modell készítése” után a folyamat a Szabályok lépésre lép. | mindig |
| **2 · Szabályok** | Vizuális szabálytábla: a referencia sorai modellsorrendben, a szabályok ívekkel rajzolva, a sorok összeköthetők. Mellette a kijelölt sor szabálypanelje (ADR-021), alatta a minősítés. Haladó eszközként a CodeLine JSON, a függőségtábla és az újraszámítás. | ha van alkalmazott modell |
| **3 · Próba** | Rendező és Megoldáskód, ellenőrzés, tanúsorrend, munkamenet-kezelés, valamint a „Tanulói nézet”. | ha van alkalmazott modell |

**Egyetlen igazságforrás:** a Szabályok és a Próba lépés mindig az **alkalmazott** modellt mutatja.

- Ha a forrás vagy a JSON ehhez képest nem alkalmazott változást tartalmaz, a későbbi lépések „Elavult” jelzést és magyarázó sávot kapnak.
- A forrásváltozásnál a sáv műveletei: „Modell újrakészítése” vagy „Forrásváltozás elvetése”.
- A JSON-változásnál a sáv művelete: „JSON megnyitása”.
- Egy sikeres alkalmazás minden származtatott nézetet ugyanabból a modellből frissít: a táblát, a panelt, a JSON-t, a minősítést és a próbát.
- A kompatibilis kitöltés megmarad, és azonnal újraértékelődik.

**Hová lép az alkalmazás:**

| Művelet | Cél |
| --- | --- |
| forrásból vagy fájlból készített modell | Szabályok |
| JSON alkalmazása a Szabályok lépésben | marad |
| szabályszerkesztés | marad |
| újraszámítás | marad |
| munkamenet importja | Próba |

A **Sorfüggőségek újraszámítása** az aktuális JSON generált sorfüggőségeit frissíti a jelenlegi JS/TS elemzővel, azonos sor- és blokkstruktúra mellett. A rögzített importkibocsátással dolgozik. A kód, a sor-ID, a fixed, a szerzői szabályok és a profilok megmaradnak; a jelentés a Minősítés alatt jelenik meg. [Példa és javított JSON](evaluate-legacy-serial-case.md).

**Késői válaszok elleni védelem:** a fájl-, vágólap- és hálózati olvasás előtt rögzített szerzői kérésgeneráció védi a referenciát. Újabb szerzői művelet, szövegmódosítás vagy másik modell után a késői eredmény nem aktiválhat modellt. A módváltás nem szakít meg egy folyamatban lévő szerzői kérést. [ADR-006](adr/006-explicit-dependency-refresh-and-review-guards.md).

## Szabályok a táblán

- **Kijelölés:** a sor láncszem gombja kijelöli a sort. Kiemelődnek a közvetlen előzményei (kék) és követői (borostyán), az ívek kirajzolódnak, és megnyílik a panel. A „Minden nem szerkezeti szabály rajzolása” az egész gráfot mutatja.
- **Kapcsolatkapcsoló ([ADR-024](adr/024-link-toggle-and-exact-restore.md)):** egy sor körére kattintva az lesz a kiinduló sor, és a többi sor köre a vele való közvetlen kapcsolatot mutatja: kék pipa (előtte kell állnia), borostyán pipa (utána), lakat (szerkezeti, nem szüntethető meg), üres kör (nincs kapcsolat). Pipára kattintva a kapcsolat megszűnik, üres körre kattintva létrejön; ugyanazok a kattintások egy megszüntetett generált kapcsolatot pontosan visszaállítanak. Egy körről egy másik sorra húzás (egér, toll, érintés) ugyanez a kapcsoló. Billentyűzettel: Enter a kiinduló körön, majd a másikon; Escape vagy a kiinduló kör befejezi. Új kapcsolat iránya a referencia sorrendje, mert kötelező szabály csak azzal összhangban vehető fel (ADR-018); a megerősítést igénylő megszüntetést a panel kéri.
- **Döntés:** minden szerkesztés típusos szabályművelet; a megengedhetőségről, a megerősítés szintjéről és az újraminősítésről a core dönt (ADR-018, ADR-021). Egy nem alkalmazott JSON-piszkozat mellett a szabályszerkesztés nem indul el; a nem alkalmazott forráspiszkozat megmarad.

## Próba és tanulói nézet

**Szabályok a próbarendezőn:** a szerző saját előnézetében a Próba lépésben is minden soron ott van a láncszem és a kör (kapcsolatkapcsoló), a rendező fölött a jelmagyarázat és a „Minden nem szerkezeti szabály rajzolása” kapcsoló, alatta a szabálypanel.

- Az ívek a szerző aktuális elrendezésében rajzolódnak, és minden mozgatás után újra; egy fordított irányú ív a szabállyal ellentétes jelenlegi sorrendet mutatja.
- Egy szabályszerkesztés megtartja a kitöltést, és azonnal újraértékeli; a rendező görgetési helyzete, a fókusz és a nyitott részletek ugyanúgy megmaradnak, mint egy húzás után.
- A körről induló húzás kapcsolatot hoz létre vagy szüntet meg, sort nem mozgat; a fogantyú továbbra is mozgat.
- A gyakorló mód és a tanulói nézet ebből semmit nem mutat.

A **Próba** a rendezőt és a megoldás kódszerkesztőjét kínálja. A szerző mintát tölthet ki, újrakezdhet, másolhat, beilleszthet, és ugyanazzal a kiértékeléssel vizsgálhatja a megengedett és a tiltott elrendezéseket.

A kódszerkesztő külön, még nem alkalmazott munkaváltozat. Más nézetre vagy lépésre váltás nem dobja el. Ha közben a rendező módosul, visszatéréskor jelzés figyelmeztet a két változatra. A „Rendezőből újratöltés” explicit módon elveti a szerkesztő piszkozatát.

A **Tanulói nézet** (csak a Próba lépésben) elrejti:

- a módváltót és a lépéseket;
- a szabálytáblát;
- a mintakitöltést és a mentést;
- a belső tanú- és keresési részleteket.

A feladatleírás, a rendező, a kódszerkesztő, a másolás, a beillesztés, az újrakezdés és a kiértékelés marad. Ez prezentációs elkülönítés, nem jogosultságkezelés. A Local Demo / Preview / Trusted Server jelölések változatlan jelentésűek.

## Interakció és hozzáférhetőség

- **Elemek:** natív button, input/select/textarea, progress, details és list/listitem elemek.
  - A lépések egy rendezett lista gombjai: `aria-current="step"`, a zárolt lépés `disabled`, okkal.
  - A Rendező/Megoldáskód és a Vizuális/JSON váltó tablist: Bal/Jobb/Home/End mozgat, Enter vagy Space aktivál.
- **Folytonosság:** a fókusz, az editor-kijelölés és a megnyitott magyarázatok a DOM-csere után megmaradnak, alnézetenként külön (a Szabályok vizuális és JSON nézete nem írja felül egymást).
- **Ctrl/Cmd+Enter** az aktuális lépés elsődleges műveletét végzi: modellkészítés, JSON alkalmazása, megoldás alkalmazása vagy ellenőrzés.
- **Visszajelzés:** az async műveletek aria-busy/disabled állapotot kapnak; a visszajelzések role=status / aria-live úton is elérhetők.
- **Célméretek:** legalább 24 px vezérlők, érintéskor 44 px fogantyúk, 28 px-es összekötő körgombok. 320/390/768 px szélességen nincs vízszintes oldaltúlcsordulás.

Elsődleges irányelvek: [WAI-ARIA tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/), [WCAG 2.5.8 célméret](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [WCAG státuszjelzések](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), [fókusz láthatósága](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html). A megvalósítás és a célzott automatizált QA nem jelent teljes WCAG-tanúsítást.

## Forrásgazda és ellenőrzés

A megjelenítés a `src/workbench` natív strict TypeScript-forrása; az állapotgép a `flow.ts`, a szabálytábla a `rule-board.ts`. A `public/app` megfelelő JS-moduljai buildtermékek. Az eredeti üzleti JS-portok átmeneti állapotát az [ADR-001](adr/001-typescript-workbench-and-boundaries.md) nevezi meg.

**Tesztek:**

- `tests/workbench-flow.test.mjs`: minden állapotátmenet (zárolás, elavulás, módváltás, landolás, összekötés iránya).
- `npm run test:browser:workbench`: 45 folyamat Node és Pages módban, többek között:
  - a zárolt lépések;
  - az újraépítés és a JSON-alkalmazás után minden későbbi lépés frissül;
  - egy szerzői projekt a gyakorlás mellett, példák mint kezdőpontok;
  - szabálypanel és kapcsolatkapcsoló egérrel, húzással és billentyűzettel, a táblán és a próbarendezőn is (létrehozás, megszüntetés, pontos visszaállítás);
  - az ívek újrarajzolása rendezés közben és az azonnali újraértékelés;
  - a görgetés megmaradása szabály hozzáadása és eltávolítása után;
  - a piszkozatok megőrzése és a késői válaszok elleni védelem;
  - tanulói elkülönítés és három mobilméret.
- A mátrix-, drag-, offline-, HTTP- és TypeScript-kör az új navigációval fut.

A mezők, a Tab/behúzás, a beszúrás és a fixed részletes üzleti jelentése: [működési szerződés](business-technical-contract.md).
