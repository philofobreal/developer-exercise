# ADR-001 – Governance, TypeScript és munkafolyamat-központú felület

Állapot: elfogadott megvalósítási irány. A meglévő üzleti szerződés megmarad.

## Döntés és sorrend

1. **P0: governance és határok.** AGENTS, döntéstulajdonosok, forrás-/generált kód térkép, tiltott rétegfüggőségek és végrehajtási kapu. Az eredeti tesztek és kézi modellek adják a változatlan viselkedési alapot.
2. **P1: strict TypeScript prezentációs szelet.** Az új renderer, megjelenítési szerződések, ikonok, hozzáférhető navigáció, állapot-/fókuszfolytonosság, editor-infrastruktúra és függőségi táblák natív TS-ből készülnek. A meglévő üzleti modulok szűk, explicit portok mögött maradnak. A browser számára kiadott JS buildtermék.
3. **P2: UI/UX átalakítás.** Feladatkönyvtár, gyakorlás és szerzői munka hierarchiája; egyértelmű elsődleges művelet, helyi mentés/fájlkezelés, haladás, draft/alkalmazott állapot, megértést segítő kiértékelés, billentyűzet és mobil. Ez nem változtatja a kiértékelési algoritmust vagy a meglévő formátumokat.
4. **P3: üzleti frontend TS-migráció.** attempt → persistence → clipboard/input adapter → author-session → HTTP/Pages API → controller. Egyszerre egy döntéstulajdonos, változatlan publikus hívások, a meglévő Node és HTTP/Pages regressziókkal. A controller csak koordináljon, ne kapjon új domainpolitikát. A portdeklaráció a valódi implementáció migrációjakor megszűnik.
5. **P4: author és server TS-migráció.** (Első szelet kész: statement-ordering → strict TS, [ADR-008](008-effect-based-statement-ordering.md); a nyelvfüggetlen sorrendi relációk, a lezárás és a redukció → strict TS, [ADR-011](011-language-independent-ordering-relations.md).) Parser/adapter és AST-intervallum-, binding-/statement-ordering algoritmusok, majd catalog és HTTP/listen. A szerver Node típusai külön buildkonfigurációban maradjanak; a core böngésző/hálózat-független. Az AST library-típusokat az author belsejében kell elrejteni.
6. **P5: formatter és build toolok.** Lexikai formatter és vendor-határok TS-re; a harmadik fél könyvtárát nem írjuk újra. Utolsó lépésben a még JS build-/tesztinfrastruktúra felülvizsgálata. Az átmeneti kivételek csak akkor szűnnek meg, amikor az összes fogyasztó és teszt átállt.

A mostani feladat P0–P2 megvalósítása és P3–P5 rögzített migrációs terve. A teljes örökölt rendszer egyidejű átnevezése túl sok független változást kapcsolna a felülethez, és gyengítené a hibák elkülöníthetőségét. Nem állítjuk, hogy minden jelenlegi forrás TypeScript.

## Elrejtett tudás és portok

A view csak Exercise/Attempt/Author összefoglalót és a kis text/fixed/formattedAnswer felületet kapja. Nem hoz létre függőségi gráfot, nem parse-ol kódot, nem hív szerver-infrastruktúrát. A folytonosság modul a render miatti fókusz-/details-állapotot rejti el. Az interakció modul a tabs/shortcut/busy szabályokat rejti el. A meglévő controller adat- és szabálymódosítása továbbra is az eredeti domainmodulokon át történik.

A TypeScript portdeklaráció nem runtime-validáció. A megbízhatósági ellenőrzések a meglévő JSON Schema/compiler/persistence admission rétegben maradnak. A régi JavaScriptet a compiler új prezentációs típusa nem teszi automatikusan típusellenőrzötté.

## Ellenőrzés

Strict TS build, noEmitOnError, kézi any/ts-ignore tiltás, importirányok és generált kód egyezése; majd az eredeti Node-, formatter-, modell-, scope-, HTTP/Pages-, clipboard-, persistence- és dragtesztek. Az új UX-hez külön keyboard/focus/draft/progress/busy/responsive vizsgálatok és vizuális képernyőképek tartoznak. A WCAG/APG szabályok alkalmazása nem helyettesít teljes képernyőolvasó- vagy WCAG-tanúsítást.


## Megvizsgált alternatívák és végrehajtott P0–P2 szelet

Az első lehetőség az eredeti négy egyenrangú eszköztab és globális műveletsor kozmetikai átalakítása lett volna. Ez megtartotta volna a source/model/próba keveredését és a még nem alkalmazott editor mellé tett, amúgy blokkolt kiértékelést. A választott változat két szerzői bemenetet kapcsol egy próbaállapothoz, majd elkülönített tanulói preview-t ad. A műveletek a saját objektumuknál vannak; az ismétlődő megoldásmásolás egy vezérlővé olvad össze.

P0–P2 elkészült: strict TS view/fields/icons/contracts/interaction/continuity/editor-infrastruktúra/dependency-táblák, typed governance checker, forrásgazda-térkép és negatív kaputesztek. A public/ui.js változása szűk kompatibilitási bekötés: az új állapot-/interakciószabályokat a natív TS-modul hívja. P3–P5 továbbra is nyitott, rögzített migrációs munka, nem lezárt vállalás. UI-részletek: [munkafolyamatok](../ui-ux-workflows.md).


Kiadási review-kivétel a legacy formatterben: két meglévő trimStart kifejezés a validátorral azonos, kizárólag ASCII szóköz/tab előtagot eltávolító kifejezésre javult. Ez tartalommegőrzési hibajavítás, nem új JavaScript modul vagy új politika; külön regresszió ellenőrzi a natív TypeScript mag normalizálásával. A teljes formatter-migráció továbbra is P5.
