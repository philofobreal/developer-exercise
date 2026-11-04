# ADR-094 – Billentyűsúgó az eszköztárban, mobil rendező (dizájn, 5. szakasz)

Állapot: **elfogadva** (2026-11-04). Az [ADR-091](091-obsidian-design-frame.md) ütemtervének 5. szakasza és a 4. szakasz folytatása. A felhasználó iránymutatása: „ami értelmes, célja van és ipari sztenderd, azt csináld, ne a látványterv határozza meg a funkciókat.” Megjelenítési változás; validátor, generátor, modell és API nem változik.

## Döntés ([view.ts](../../src/workbench/view.ts), [style.css](../../public/style.css))

1. **Billentyűsúgó az eszköztárban.** A külön útmutató sáv elmaradt. A szövege ismétlés volt: a húzásról a forráslista alsó sávja („Húzással vagy a + gombbal helyezd el”) és a szerzői Tipp kártya is szól. A „Billentyűzettel is” súgó a Rendező/Megoldáskód fülek mellé került, lenyíló súgóként, a nyitott állapotot a nézet megjegyzi. Ez a kódszerkesztők megszokott eszköztára.
2. **A forráslistának nincs jobb belső margója.** A ragadós sorvégi gomb így a lista szélén áll meg, és mögötte nem látszik ki kód (az [ADR-090](090-single-horizontal-scroll-per-code-list.md) maradéka, minden szélességen).
3. **Mobil, 650 képpont alatt:**
   - **Ragadós ellenőrző sáv:** az állapotkártya az ellenőrző gombbal a képernyő alján marad rendezés közben (a mobil vásárlási és űrlapsávok mintája).
     - Tömör: az üzenet legfeljebb két sor, a sáv legfeljebb a képernyő 40%-a, és nincs rajta billentyűparancs-tipp.
     - A `scroll-padding-bottom` gondoskodik róla, hogy egy fókuszba vagy nézetbe görgetett elem ne kerüljön alá.
   - **A kettős „Gyakorlófeladatok” cím** közül a nagy elrejtve; a listacím a darabszámmal marad.
   - **A panelcímek gombjai** egy sorban, a cím alá tördelve.

**Ami tudatosan nem került bele:**
- **Kiválasztás, majd koppintás az üres helyre:** mobilon ez bevett minta, és a billentyűzetes „felvesz, céloz, lerak” megfelelője lenne. Új interakciós mód viszont, és érinti az egér, az érintés és a billentyűzet egyenértékűségét (AGENTS.md). Ezért külön lépés, saját tesztekkel.

## Mérés

- **Szerzői Próba, 1 500 × 1 000 képpont, érintéses emuláció:** a megoldáslista teteje 742 → 672 képpont (az ADR-093 előtt 800).
- **Mobil gyakorlás, 390 × 844 képpont:**
  - a forráslista teteje 966 → 935 képpont;
  - az ellenőrző gomb rendezés közben a képernyőn marad;
  - `scrollWidth` = 390, nincs vízszintes kilógás.

## Bizonyíték

A teljes böngészőkészlet változatlan elvárásokkal fut: 320, 390 és 768 képpontos érintéses elrendezés, érintési célméretek, húzás, billentyűzet és Pages.

## Tervezési review (ADR-037)

- **Tulajdonos:** a súgó szövege egy helyen él (a `details`), csak a helye változott. A mobil viselkedés tisztán stílus.
- **Design twice:** *külön mobil ellenőrző sáv ugyanazzal a gombbal:* elvetve. Két `[data-check]` gomb kettős vezérlőt és kétértelmű teszthorgonyt jelentene; ugyanaz a sáv ragad a képernyő aljára.
