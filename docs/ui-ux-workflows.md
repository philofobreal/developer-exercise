# Munkafolyamat-központú UI/UX

## Cél és megőrzött érték

A műhely programozási sorrendező feladatok készítését és kipróbálását segíti. A nyilvános CodeLine-modell, a tartalmi és függőségi/scope-validálás, a fixed sorok, az exact whitespace, a több beviteli út és az import/export szerződése változatlan. A design a már működő döntéstulajdonosokra épül, nem vezet be második validátort.

A munkafolyamat két szerzői belépési pontja ugyanahhoz az alkalmazott feladathoz vezet:

- **Referenciaforrás:** JS/MJS/TS/TXT fájl helyi betöltése vagy vágólap → szerkesztés/formázás → Alkalmazás → generált modell és rendezési próba. A fájlbetöltés önmagában nem aktivál új feladatot. Legfeljebb 200 KB fájl és 50000 karakter forrás támogatott; a szerver méretkorlátjai továbbra is érvényesek.
- **Adatmodell:** teljes CodeLine JSON szerkesztése/beillesztése vagy JSON-fájl betöltése → meglévő Schema/strukturális/szintaktikai admission → ugyanaz a próba. Ez kezdő feladat nélkül is elérhető. A meglévő fájlimport sikeres ellenőrzés után közvetlenül aktivál; a JSON-szerkesztőben végzett módosítás külön alkalmazandó.

JSON alkalmazásakor a referenciaforrás kitöltődik a modell soraiból. Forrás alkalmazásakor a generált teljes JSON szerkeszthető. A forrás újraalkalmazása új modellt generál, nem egyesíti automatikusan a régi kézi JSON-szabályokat; ezek exportálhatók. A forrássorszám metaadat, nem megoldáspozíció.

Az Adatmodell külön **Sorfüggőségek újraszámítása** művelete az aktuális JSON sorfüggőségeit frissíti a jelenlegi JS/TS elemzővel, azonos sor-/blokkstruktúra mellett. Kód, sor-ID, fixed, kézi élek és profilok megmaradnak; kompatibilis kitöltés újraértékelődik. A normál import nem hívja. Régi generált modellnél a felület elmagyarázza, hogy a `dependencyHints` nem validátorszabály. [Példa és javított JSON](evaluate-legacy-serial-case.md).

A fájl-/vágólap-/hálózati olvasás előtt rögzített közös szerzői kérésgeneráció védi a referenciát: újabb szerzői művelet, szövegmódosítás vagy feladatváltás után a késői eredmény nem aktiválhat modellt. A JSON- és session-fájlok olvasás előtti védelme is ugyanide tartozik; a védelem memóriabeli, nem sessionmező. [ADR-006](adr/006-explicit-dependency-refresh-and-review-guards.md).

## Próba és tanulói preview

A **Próba** a rendezőt és a megoldás kódszerkesztőjét kínálja. A szerző mintát tölthet ki, újrakezdhet, másolhat, beilleszthet és ugyanazzal a kiértékelési mechanizmussal vizsgálhatja a megengedett/tiltott elrendezéseket. A rendező az egyetlen aktív próbálkozásállapot.

A kódszerkesztő külön, még nem alkalmazott munkaváltozat. Más nézetre váltás nem dobja el. Ha közben a rendező módosul, visszatéréskor jelzés figyelmeztet a két változatra. Az alkalmazás az eredeti domainmodulon keresztül történik. Ebben a nézetben nincs félrevezető, az alkalmazás előtt amúgy sem működő Ellenőrzés gomb: a fő művelet az Alkalmazás. Utána a rendezőben lehet értékelni.

Az **01 · Referencia és szabályok** és **02 · Megoldás és próba** ugyanahhoz a kiválasztott feladathoz tartozik. A Referenciaforrás a helyes program és a feladat alapja; a Megoldáskód a rendezőben összeállított próbáé. A próba módosítása nem írja át a referenciát. A „Rendezőből újratöltés” explicit módon elveti a megoldásszerkesztő draftját, és a jelenlegi rendezőből tölti vissza.

A referencia kézi gépelése is azonnal menti a memóriabeli draftot, és „Nem alkalmazott referencia” jelzést kap. A szerzői source/JSON munkaváltozatok feladatonként megmaradnak nézet- és könyvtárváltáskor; első alkalommal a kiválasztott feladat publikus forrásából indulnak. A gyakorlófeladat szerzői alkalmazása új saját preview-t hoz létre, a szerver trusted szabályait nem módosítja. Alkalmazás csak az aktuális, változatlan munkaváltozatot aktiválhatja; késői válasz nem ír felül újabb szöveget. Ezek memóriabeli draftok, nem új vagy automatikusan mentett session formátum. Döntés: [ADR-004](adr/004-reference-and-attempt-workspaces.md).

A **Tanulói preview** elrejti a könyvtárat, forrás-/JSON-szerzői tabokat, mintakitöltést, mentés-/fájlkezelést és belső tokenmegfeleltetési/keresési részleteket. A feladatleírás, rendező/kódszerkesztő, másolás/beillesztés, újrakezdés és kiértékelési visszajelzés marad. A szerző visszalépési gombja a preview-host navigációja; a visszalépés nem törli a próbálkozást vagy a szerzői munkaváltozatokat. Ez prezentációs elkülönítés, nem bejelentkezés/jogosultságkezelés vagy új hiteles vizsgacsatorna. A Local Demo / Preview / Trusted Server validációs jelölések változatlan jelentésűek.

A könyvtárban öt referenciafeladat van: négy összetett algoritmus-/osztálypélda és az alternatív profilok példája. A saját alkalmazott előnézet külön csoportot kap. A clipboard közvetlenül az érintett szerkesztőnél/panelnél található; a megoldás Másolás gombja a korábbi két azonos műveletet egyetlen vezérlőre vonja össze. A mentés az oldalsó munkamenet-csoportban van, nem versenyez az elsődleges ellenőrzéssel.

## Interakció és hozzáférhetőség

- Natív button, input/select/textarea, progress, details és list/listitem elemek. A tablist megfelelő selected/controls/labelledby kapcsolatokkal rendelkezik. Bal/jobb/Home/End fókuszt mozgat; Enter/Space aktivál (kézi aktiválás).
- A fókusz, editor-kijelölés és megnyitott magyarázatok a szükséges DOM-csere után megmaradnak; async ellenőrzés befejezése nem görgeti el a munkát. Ha közben a felhasználó máshova fókuszál, nem lopjuk vissza a fókuszt.
- Ctrl/Cmd+Enter az aktuális nézet elsődleges műveletét végzi: forrás/JSON/megoldás alkalmazása vagy a rendező ellenőrzése. Foglalt gombot újra nem aktivál.
- Az async műveletek látható várakozási és aria-busy/disabled állapotot kapnak. A visszajelzések role=status / aria-live útvonalon is elérhetők; az indeterminate nem jelenik meg hibás megoldásként.
- Elhelyezettségi progress és értékelési eredmény külön fogalom. A kitöltött feladatot is ellenőrizni kell. A bizalmi mód szövegesen is látható, nem csak színnel.
- Minimum 24 px sorvezérlők, érintéskor 44 px fogantyúk és nagyobb műveletcélok; látható fókusz, reduced-motion támogatás, 320/390/768 px szélességen vízszintes oldal-túlcsordulás nélküli felület. A kód és a táblázatok saját görgetést használnak.

Elsődleges irányelvek: [WAI-ARIA tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/), [WCAG 2.5.8 célméret](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [WCAG státuszjelzések](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), [fókusz láthatósága](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html). A megvalósítás és a célzott automatizált QA nem jelent teljes WCAG-tanúsítást.

## Forrásgazda és ellenőrzés

A megjelenítési implementáció a src/workbench natív strict TypeScript-forrása. A public/app megfelelő JS-moduljai buildtermékek; a régi importútvonalak megmaradnak. Az architektúrakapu a forrás/emit egyezést is ellenőrzi. Az eredeti üzleti JS-portok átmeneti állapotát az [ADR-001](adr/001-typescript-workbench-and-boundaries.md) nevezi meg; ettől az egész repository még nem vált TypeScriptté.

A `npm run test:browser:workbench` 29 folyamatot vizsgál Node/Pages módban: modellből indítás, source file pending/apply és JSON-fájl, forrás/JSON összekapcsolás, referencia gépelése és feladatváltáskori draft-megőrzés, megoldás/reference szétválasztás, explicit rendezőből újratöltés, learner preview izoláció/visszatérés, tabs/draft, fókusz/details/contextual copy, ismételt async check elkerülése, késői admission-/mintabetöltési/formázási/értékelési válaszok védelme, fixed körüli keresztezés és három mobilméret. A meglévő offline/HTTP/32 esetű mátrix/36 drag kör is megmaradt. A scrolltesztek látható sort választanak a tényleges sormagasságból, így a pixelméret megváltoztatása nem keveredik a scroll megőrzésével.

A mezők, Tab/behúzás, beszúrás és fixed részletes üzleti jelentése: [működési szerződés](business-technical-contract.md).
