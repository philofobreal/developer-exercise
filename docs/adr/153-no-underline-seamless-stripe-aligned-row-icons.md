# ADR-153 – Három felületi javítás: gombban nincs aláhúzás, a panelfej sávja varratmentes, a sorok ikonjai egy oszlopban állnak (NY-59)

Állapot: **elfogadva** (2026-11-14). A felhasználó észrevételei és kérése („tárd fel őket és módosítsd, javítsd szakszerűen”). Kockázati osztály: megjelenítés. Látható változás, ezért nem refaktor-kommit; a markup-szerződés nem változott. Ez az ADR az [ADR-140](140-button-system.md) és az [ADR-143](143-plates-and-soft-surfaces.md) egy pontját módosítja (a bekapcsolt gomb jele).

## Kontextus (mérve 2026-11-14-én)

- **(a) Aláhúzás a gombokban.** A bekapcsolt gomb (`aria-pressed`: a kiválasztott mód, a kapcsolók) a felirata alatt 2 px-es vonalat viselt. Ezt a D1 vezette be szándékosan, hogy az állapotot ne csak a szín jelezze. A felhasználó döntése: gombban soha ne legyen aláhúzás. Egy további hely is aláhúzott volt: a zárolt beállítás „Miért?” lenyílója.
- **(b) Halvány vízszintes csík a két rendezőpanel bal felső sarkában.** A panelfej színes sávja két rétegből áll: egy 5×15 px-es sávból és alatta egy negyedkör lábból. A két réteg éllel illeszkedett. Ahol az illesztés tört képpontra esett, a böngésző mindkét élt külön simította, és a kettő együtt nem adott teli színt: halvány vonal a sáv közepén, ott, ahol a kerekítés kezdődik.
  - A Local Demóban 125%-os skálázásnál látszott; a szerveren 110%-nál és 175%-nál (a panel teteje tört képponton áll, például 350,8 px-en, ezért függ az oldal tartalmától).
- **(c) A szabályívek a sorok ikonjai mögé futottak a Próba lépésben, ha a lista első sora rögzített.**
  - A rögzített sor végén a három mozgatógomb helyén a „Rögzített” felirat áll, amely 20 px-rel keskenyebb volt náluk. A sor szabályainak ikonja ezért a rögzített sorban 20 px-rel jobbra állt (1292 px a többi sor 1272 px-e helyett).
  - Az ívek a helyüket a lista első sorának ikonjaitól vették. Rögzített első sornál így minden ív 20 px-rel jobbra került, a többi sor ikonjai mögé.
  - A szabálytábla (2. lépés) nem érintett: ott minden sor ikonjai egy oszlopban álltak.

## Döntés

- **(a) Gombban nincs aláhúzás, semmilyen állapotban.**
  - A bekapcsolt gomb jele ezután a halvány kék lap és a körülötte futó kék vonal (ez forma, nem csak szín), a felirat kék. A 2 px-es jel megszűnt.
  - A „Miért?” lenyíló aláhúzás helyett nyilat kapott (▾, nyitva ▴), és egérrel fölé állva halvány hátteret.
  - A szövegben álló valódi hivatkozások (például a súgóra mutatók) nem gombok; rájuk ez a döntés nem vonatkozik.
- **(b) A sáv lába egy képponttal a sáv vége fölött kezdődik,** így a két réteg átfed, és az illesztést a sáv teli színe takarja. A sáv alakja nem változott.
- **(c) A sorok szabályikonjai egy oszlopban állnak.**
  - A rögzített sor felirata pontosan akkora helyet foglal, mint a három mozgatógomb a többi sorban (jobbra igazítva, a felirat helye nem változott). Ez a felhasználó javaslata.
  - Az ívek a lista legbalra álló sorvezérlői elé állnak, bármelyik soréi azok. Az első sor egyedül többé nem dönti el a helyüket.

## Két terv („design it twice”)

A sáv varratára:
1. **A sáv egy pszeudoelem lekerekített sarokkal** (egy alak, egyszer simítva). Elvetve: az elrendezés-kapu sarokvizsgálata nem látja a pszeudoelemeket, ezért a sáv szándékosan a doboz saját háttere ([ADR-143](143-plates-and-soft-surfaces.md)).
2. **A sáv egy képponttal hosszabb.** Elvetve: a láb első sorában a sáv jobb szélén apró szögletet adna.
3. **A láb rétege egy képponttal feljebb kezdődik, a kör középpontja a helyén marad (választott).** Az alak képpontra ugyanaz.

Az ikonoszlopra:
1. **Csak az ívek helyét javítani** (a legbalra álló vezérlőkhöz). Elvetve önmagában: az ívek jók lennének, de az ikonok továbbra is két oszlopban állnának.
2. **A rögzített sorba három láthatatlan gombot tenni.** Elvetve: fölösleges elemek minden rögzített sorban.
3. **A felirat szélessége a gombokéból számolva, két változóval (választott),** és mellé az 1. terv, hogy egy eltérő szélességű sor később se hozza vissza a hibát.

## Tervezési review (docs/design-review.md)

- **A változás három szabály a stíluslapban és négy sor a `rule-board` modulban.** Új modul, új interfész nincs.
- **A `rule-board` továbbra is egyedül tudja, hol állnak az ívek;** a hívó (a nézet kirajzolása) nem változott.
- **design, rögzítve:** a gomb szélessége és a köz most két változó (`--tool-w`, `--tool-gap`) a megoldáslista sorvezérlőin; a gombok saját méretszabályai ezektől függetlenül megmaradtak (24 px, durva mutatónál 32 px). A kettő eltérhet, ha valaki csak az egyiket írja át; a böngészős teszt megfogja (az ikonok két oszlopba kerülnének).
- **A kapu tanulsága (első futás: 2 piros a 17-ből):** a lenyíló nyila 11 px-es betűt kapott, amit a 12 px-es alsó határ tesztje megfogott (most 12 px); a munkafelület-sáv `button_states` esete még a 2 px-es jelet várta, a döntés szerint módosult (a bekapcsolt lap arcára semmi nincs rajzolva).
- **Ismert maradék:** durva mutatójú, de egérrel is kezelt keskeny képernyőn (650 px alatt) a fel és le gomb nem látszik, így ott a felirat szélesebb a megmaradt egy gombnál, és az ikonok két oszlopban állnak. Az ívek ott is jó helyen vannak (ezt a teszt a felirat összenyomásával ellenőrzi).

## Bizonyíték

- **Elrendezés-kapu** ([browser-layout.playwright.py](../../tests/browser-layout.playwright.py)), minden nézetben és mindkét témában:
  - a bekapcsolt gombnak van vonala, és az arcára semmi nincs rajzolva;
  - egyetlen gomb, lenyíló vagy gombként rajzolt hivatkozás sem aláhúzott (a gyerekelemei sem);
  - a sáv két rétege átfed;
  - **új eset:** a sáv középső oszlopa egyszínű 7 képpontarányon (1; 1,1; 1,25; 1,5; 1,75; 2; 2,5), mindkét témában, mindkét panelen. A képpontokat eszközfelbontáson olvassa (`pixels` a `browser_support`-ban).
- **Böngészős teszt** ([browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py), `rule_icons_in_one_column`): rögzített első sorral a Próba megoldáslistájában minden sor szabályikonja ugyanott áll; a kijelölt sor ívei egyetlen sor vezérlői mögé sem futnak. A második állítás összenyomott felirattal is igaz.
- **Mutációs ellenőrzés:** öt visszarontás, mind megbukik a megfelelő teszten (éllel illesztett sáv, visszatett jel, aláhúzott gombfelirat, saját szélességű felirat, az első sorhoz igazított ívek). A képpontos teszt önmagában is megfogja a régi sávot (a szerveren 1,1 és 1,75 aránynál, mindkét témában).
- **Előtte–utána képek** a javításról (a munkamenet jelentésében).

## Korlát

- **A bekapcsolt állapotot a forma oldaláról már csak az 1 px-es vonal jelzi.** Ez gyengébb jel, mint a 2 px-es vonal volt; a képernyőolvasónak az állapotot változatlanul az `aria-pressed` mondja meg.
- **A sáv teteje fölött a szomszédos vonal tört képpontnál továbbra is két sorban simul** (ez az oldal elrendezéséből adódik, nem a sávból).
