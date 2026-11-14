# ADR-146 – A munkaterület egy keret: eszközsáv a panelek fölött, a szabálypanel saját elválasztóval (NY-37, D5b)

Állapot: **elfogadva** (2026-11-14). A felhasználó kérése és döntése szó szerint: „ez a rész pedig legyen összedolgozva a dizájnnak megfelelő módon. azaz egyben legyenek a gombok az alatta megjelenő panelekkel. ügyesen legyen kitalálva, mert azt is szeretném, hogy a jobb oldali »sor szabályai« és a mellette lévő panel is horizontálisan állítható, úgy mint a felhasználható sorok és a megoldás panel”, majd a bemutató után: „jóváhagyom, mehet az A, az NY-43 vele együtt”. Az [ADR-107](107-editor-window-focus-split-and-rule-inspector.md) elválasztóját és szabálypaneljét bővíti. Kockázati osztály: megjelenítés; a motor, a szabályok és az értékelés nem változott.

## Kontextus (a D5 után)

- **Az eszköztár a panelek fölött lebegett:** négy gomb egy sorban, alatta 14 px köz, majd a két lista külön-külön kártyaként, mellettük (kérésre) a szabálypanel harmadik kártyaként.
- **A szabálypanel szélessége rögzített volt** (300–360 px), a két lista szélessége állítható.
- **A szabálypanel magassága a saját tartalmától függött** (legfeljebb a képernyő mínusz 140 px): nyitáskor a listák megnyúltak vele.

## Döntés

- **Egy keret** (`.workspace`, 12 px-es sarok): felül az eszközsáv, alatta a panelek. A panelek a keret dokkjai, nem kártyák: nincs saját keretük és sarkuk, vékony vonal választja el őket.
- **Az eszközsávban balra áll, ami a próbálkozást változtatja** (Újrakezdés, Mintamegoldás kitöltése), **jobbra, ami a nézetet** (Sor szabályai, Fókusz). A „Sor szabályai” így a panelje fölött áll.
- **A szabálypanel a keret harmadik dokkja,** saját elválasztóval:
  - egérrel húzható, billentyűzettel a nyilakkal, a Home és az End billentyűvel állítható; az elválasztó arra megy, amerre a nyíl mutat (balra: a panel szélesedik);
  - a panel a listák és a panel együttes szélességének 20–50%-a, kezdetben 28%, de legalább 280 px;
  - a böngésző megjegyzi, a két lista arányától függetlenül.
- **A szabálypanel pontosan olyan magas, mint a listák,** és önmagában görög: a tartalma nem méretezi a keretet, nyitáskor semmi nem mozdul el.
- **1100 px alatt a szabálypanel az eddigi lap** (a képernyő jobb szélén, telefonon alul), elválasztó nélkül.
- **Telefonon a két lista a keretben egymás alatt áll,** vonallal elválasztva.

### Ára

- **A szabálypanel alacsonyabb lett** ott, ahol a listák alacsonyak: 1440×900-on 604 px (eddig legfeljebb 760 px), 1366×650-en 287 px. Hosszú szabálylistához a Fókusz mód ad helyet.
- **A keret pereme 22 px-t vesz el az eszközsáv szélességéből** telefonon; a köz ezért ott 6 px (eddig 8 px), így 390 px-en mindkét felirat megmaradt.

## Vele együtt: a gyakorlás oldalsávja az oldal aljáig ér (NY-43)

A felhasználó kérése: „ne rugaszkodjon el az alja az oldalnak ilyen módon gyakorlás nézeten”.

- **Az ok (mérve 1366×650-en):** a feladatlista oldalsávja ragadós volt, a magassága a képernyő mínusz 64 px, vagyis a fejléccel számolt. Amint a fejléc kigördült, az oldalsáv a képernyő tetejére tapadt, és 64 px-rel a képernyő alja fölött véget ért; a főoszlop tovább tartott.
- **A javítás:** az oldalsáv olyan hosszú, mint a mellette álló oldal; a benne lévő lista ragad a képernyő tetejére, legfeljebb képernyőnyi magas, és önmagában görög.
- **Ára:** az oldal tetején a lista alsó 64 px-e a képernyő alatt kezdődik; az oldal görgetésével kerül elő.

## Két terv („design it twice”)

A keretre (a bemutató két változata):

1. **A – egy keret, a szabálypanel a sáv alatt (választott).** A három panel egyformán viselkedik; a panel nyitása nem mozdítja el az eszközsávot.
2. **B – keret a listáknak, a szabálypanel külön kártya a sáv tetejétől.** Elvetve (a felhasználó döntése): a panel magasabb lenne, de nyitásakor a sáv összeszűkül, a gombok elcsúsznak.

Az oldalsávra:

1. **A fejléc is ragadós.** Elvetve: alacsony ablakban állandóan 64 px-t venne el, és a listák mért helye ([ADR-144](144-lists-end-above-the-result-bar.md)) arra épül, hogy a fejléc kigördül.
2. **Görgetésfigyelő méri, mennyi látszik a fejlécből.** Elvetve: minden görgetési képkockán újraszámolná az oldalsávot egy olyan hibáért, amelyet a stíluslap egyedül megold.
3. **A sáv az oldallal nyúlik, a lista ragad benne (választott).** Nincs futásidejű kód.

## Tervezési review (docs/design-review.md)

- **pane-split.ts elrejti** az elválasztók tartományát, kezdőértékét, tárolását, és azt, hogyan lesz a mutató helyéből arány (a szabálypanel jobbról mér). **Interfésze** nevet kapott: `paneSplit(root, név)`, `separatorAttributes(root, név)`, `installPaneSplit(root, moved)`. A nézet eddig maga írta ki a tartományt (`aria-valuemin="20"`), vagyis a modul tudását másolta; ez megszűnt.
- **Az állapot egy helyen van:** az elválasztó értéke a gyökér CSS-változója; a modul onnan olvassa vissza. A párhuzamos `data-split` jellemző megszűnt.
- **Az interfész bővítésének oka (AGENTS.md):** új hívó nincs (a nézet az egyetlen); rejtve marad a tartomány, a tárolókulcs és a mérés iránya; a név azért kell, mert két elválasztó van.
- **A keret a stíluslapé:** a nézet egyetlen burkolóelemet kapott; hogy a panelek kártyák vagy dokkok, azt a stíluslap dönti el.
- **design, rögzítve:** a keret `overflow:clip`-pel vágja a sarkait. Ami a kereten kívülre nyúlna (a panelek fókuszkerete a keret szélén), azt levágná; a listák és az elválasztók fókuszjelzése befelé rajzol, a gombok körül a sáv 8 px-es pereme elég a 5 px-es keretnek.
- **design, rögzítve:** az 1100 px-es határ (dokk vagy lap) csak a stíluslapban él; a modul nem tud róla. A lap mellett az elválasztó `display:none`, hogy billentyűzettel se legyen elérhető.
- **Első változat, visszavonva:** nem volt; a bemutató CSS-e ideiglenes volt, a megvalósítás a meglévő szabályokat írta át.

## Bizonyíték

- **Böngészős teszt** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py), `rules_split`, 1440×900): az eszközök sorrendje és helye; az elválasztó szerepe és tartománya; a panel a részét kapja (28%); nyitása nem változtat a keret magasságán; a panel olyan magas, mint a listák, és hosszú tartalommal önmagában görög; húzásra 180 px-rel szélesebb, a listák aránya közben nem változik; nyilak, Home, End; legalább 280 px; újratöltés után mindkét arány megmarad; 1024 px-en lap, elválasztó nélkül; telefonon a lapnak saját magassága van.
- **Elrendezés-kapu** ([browser-layout.playwright.py](../../tests/browser-layout.playwright.py)): minden nézetben és mindkét témában a sáv és a panelek a keret széléig érnek, köz nélkül egymás alatt; a panelnek nincs saját kerete és sarka; a keret sarka a felülettokené; a dokkolt szabálypanel olyan magas, mint a listák. Az oldalsáv (`sidebar`, 1366×650): az oldal tetején és alján is leér a képernyő aljáig, az utolsó feladat a lista görgetésével elérhető.
- **Mutációs ellenőrzés:** tizenhét rontás megbuktatja a teszteket. A `rules_split` esetet tizenkettő: a panel tartalma méretezi a keretet; rögzített szélesség; nincs legkisebb szélesség; az elválasztó balról mér; a nyilak fordítva visznek; a Home és az End felcserélve; közös tárolókulcs a két elválasztónak; a szabálypanel aránya nincs megjegyezve; a panel 80%-ig nyúlhat; a nézeteszközök a többi mellett állnak; a lap mellett megmarad az elválasztó; a lapnak nincs saját mérete. Az elrendezés-kaput öt: a panelek kártyák a keretben; az eszközsáv külön áll; a keret szögletes; az oldalsáv listája a fejléccel számol; az oldalsáv a listájával véget ér. Az első körben egy rontás átcsúszott (a lap melletti elválasztó nulla magasságú, a teszt ezért rejtettnek látta); a teszt azóta azt nézi, hogy billentyűzettel sem érhető el.
- **Nem fedi teszt:** érintéssel húzott elválasztó (a mutatóesemények közösek az egérrel, de a teszt egérrel húz). A bekapcsolt nézetváltó gombokat ([ADR-133](133-view-switches-off.md); alapból ki vannak kapcsolva) a keretben csak képernyőképen néztem meg: 1440 px-en, 390 px-en és fekvő telefonon, a rendezőben és a megoldáskód nézetben; az akadálymentességi vizsgálat a megoldáskód nézetet így is bejárja.
