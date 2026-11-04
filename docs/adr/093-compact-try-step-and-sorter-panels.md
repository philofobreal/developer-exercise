# ADR-093 – Tömör Próba lépés és rendezőpanelek (dizájn, 4. szakasz)

Állapot: **elfogadva** (2026-11-04). Az [ADR-091](091-obsidian-design-frame.md) ütemtervének 4. szakasza. Megjelenítési változás; validátor, generátor, modell és API nem változik.

## Kontextus

Az [ADR-092](092-route-language-chip-segmented-stepper.md) mérése megmutatta a fő gondot. 1 500 × 1 000 képpontos szerzői Próba nézetben a megoldáslista 800 képpont körül kezdődött, és egy rövid feladat utolsó sora már a képernyő alá esett. A Próba lépés fejléce, a szabálymagyarázat és az útmutató sor együtt közel 300 képpontot foglalt a rendező fölött.

## Döntés ([view.ts](../../src/workbench/view.ts), [rule-board.ts](../../src/workbench/rule-board.ts), [style.css](../../public/style.css))

1. **Próbarendező fejléc:** „Próbarendező” cím, egysoros leírás, kompakt haladássáv. A „3. LÉPÉS” felirat elmaradt, mert a lépéssor mutatja. A kártya megtartja a „kitöltöttség nem jelent helyes megoldást” figyelmeztetést.
2. **Szabályjelmagyarázat:** a színminták egy sorban maradnak, a vezérlők hosszabb magyarázata egy „Jelmagyarázat” összecsukható blokkba került. Ugyanez érvényes a szabálytáblán. A nyitott állapotot a nézet megjegyzi (`data-memory`).
3. **Információs sáv:** az útmutató bal oldali kiemelővel és „HÚZÁS” címkével jelenik meg (`role="note"`); a billentyűzetes súgó változatlan.
4. **Darabszám-jelvények:** a panelcím melletti szám („19 elhelyezendő”, „6/25 sor elhelyezve”) jelvény lett. A szöveg pontosabb a terv „2 sor”, illetve „4 / 6” felirataránál, ezért megmaradt.
5. **Üres helyek:** szaggatott keretes „+ Sor beszúrása” mező.
6. **Ellenőrző sáv:** keretes állapotkártya ikondobozzal, az elsődleges gomb jobbra.
7. **Oldalsáv háttere:** a sáv hátterét és keretét a rácsoszlop rajzolja (`--side-w`), így a ragadós oldalpanel alatt hosszú oldalon sem marad üres sáv.

## Mérés

- **A megoldáslista teteje** (szerzői Próba, 1 500 × 1 000 képpont, érintéses emuláció): 800 → 742 képpont.
- **Egy ötsoros feladat utolsó sorának alja:** 1 005 → 962 képpont, tehát a képernyőn belül.
- **Érintéses eszközön** minden gomb és összecsukható fejléc legalább 44 képpont magas. Ez szándékos érintési célméret, ezért egérrel a nézet alacsonyabb.

## Bizonyíték

A teljes böngészőkészlet változatlan elvárásokkal fut: húzás, érintés, billentyűzet, a szabálysáv megléte csak szerzői előnézetben, mobilszélesség és Pages.

## Tervezési review (ADR-037)

- **Tulajdonos:** a jelmagyarázat egy helyen (`legend`) él a szabálytáblának és a rendezőnek. A tömörítés tisztán stílus és szöveg; állapot és esemény nem változott.
- **Design twice:** *a szabálysáv teljes elrejtése egy kapcsoló mögé:* elvetve. A színek jelentése rendezés közben is kell, a hosszú magyarázat nem.
