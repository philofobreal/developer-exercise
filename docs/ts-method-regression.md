# TypeScript és tesztlefedettség

Az eredeti `tests/fixtures/copy-field-utility.service.ts` változatlan tesztanyag: 31 osztálytag, 436 nem üres modell-sor. A teljes fájl és minden tag külön regressziós eset maradt.

| Ellenőrzés | Mit bizonyít? | Mit nem bizonyít? |
| --- | --- | --- |
| TS/JS parseraudit | A választott nyelvi szintaxis feldolgozható; JS-nél az Acorn a TS-konstrukciókat is kizárja | Típushelyesség és üzleti működés |
| `tsc -p tsconfig.json` | A strukturális mag TypeScript-típusellenőrzése és buildje sikeres | A külső függőségekkel rendelkező service típushelyessége |
| Formázási regresszió | 5-space formátum, idempotencia, 31 tagnév megőrzése, sor-/tokentartalom a live preview-ban | Futásidejű szemantikai ekvivalencia minden forrásnál |
| Modellgenerálás | AST-hierarchia, scope-ok és funkciótulajdonosok fennmaradnak; közös fizikai határnál explicit korlátozott fallback | Minden lehetséges nyelvi konstrukció veszteségmentes leírása |
| Strukturális validáció | Referenciasorrend elfogadása, tartalomváltozás/tiltott átrendezés elutasítása, megengedett függőségi szabadság | Az összes megengedett program azonos futásidejű működése |
| HTTP/E2E | Valódi szerzői, modellalkalmazási, rendezési és értékelési folyamat működése | Távoli GitHub-deployment vagy teljes képernyőolvasó-tanúsítás |

A teljes service tesztje megköveteli az `ast-hierarchy` stratégiát, sok megtartott blokkot és nem nulla függvényazonosítókat. A korábbi teljes `conservative-serial` fallbackre vonatkozó elvárás megszűnt. A 31 tagra továbbra is történik parserellenőrzés, formázás, újraformázás, modellgenerálás és strukturális értékelés.

Új regressziók: regex/osztás, karakterosztályok, escape, interpolációk, nyers template-whitespace, összetett AST-blokkok, hibás szerkesztett referencia, JS-ben tiltott TS-szintaxis, Schema/Ajv/runtime egyezés, 500 fixed sor, NaN keresési keret, import-integritás, bővíthető mezők, nyelvi adapterek és shadowingot megkülönböztető kötésjelzések.

`npm run test:browser:all` futtatja az eredeti offline és valódi HTTP-szkripteket, továbbá a külön nevű esetekből álló Node/Pages mátrixot és a 36 esetből álló valódi húzási regressziót (`test:browser:drag`). Ez utóbbi mind a négy beépített példában kódszövegről indított natív húzást és fogantyús pointermozgatást végez, a forrásból és a megoldáson belül is. A böngésző natív pointercancel átmenete, az idegen pointerazonosító megszakítása és a tényleges touchCancel is külön ellenőrzött. A teljes TS-minta betöltése, formázása, generálása, értékelése és görgetése valódi böngészőben is szerepel. A JS Beautify összehasonlítás helyi, pontos verziójú könyvtárat használ, nincs CDN-függősége.

A service külső Nexius/Angular-függőségei a tesztanyag részei, nem az alkalmazás futásidejű függőségei. A service-et nem hajtjuk végre, és a hiányzó külső projekt nélkül nem állítunk rá teljes típusellenőrzést. A végleges helyi eredmények és darabszámok az auditjelentésben szerepelnek.

A kötésalapú függőséggenerálás regressziói külön ellenőrzik a két előzményhez kötött változódeklarációkat, független köztes sorokat, shadowingot, a forráshely és ID különválasztását, az 500 független sort, a mellékhatásos/using korlátokat és a szerver által kiszámított megfeleltetést. A böngészős mátrix JS/TS × Node/Pages négy új folyamatával 28 esetre bővült.

A képi evaluate fixture összes 5040 fizikai permutációját a kézi és generált modell mellett független Acorn AST + tényleges JS-futtatás is vizsgálja (csak rögzített, bounded tesztfixture-ök, nem tanulói kód). A háromszintű példa 240 belső permutációja és 289 egyes sor-áthelyezése, illetve hatás-/értékadás-/vezérlés-fixture-ök külön szerepelnek. A böngészős mátrix háromszintű JS/TS × Node/Pages vizsgálataival 32 esetre bővült. A futásidejű egyezés és a konzervatív hívási szerződés külön ellenőrzött feltétel.


A kiadás előtti review a fixed abszolút sorhelyét 120 teljes permutációval ellenőrzi: a független sorok a rögzített sor két oldala között is átkerülhetnek. Külön teszt fedi az érvénytelen/ütköző fixedPosition értékeket és a duplikált tartalomhoz tartozó pozícióhű tanút. A browser-workbench kör 21 esetben vizsgálja a szerzői/preview folyamatokat, a fixed keresztezést, a késői formázási/értékelési válaszok eldobását és a mobilnézeteket. A strict workbench/governance build és a negatív architektúrakaputesztek az új natív TypeScript-szeletet is védik.
