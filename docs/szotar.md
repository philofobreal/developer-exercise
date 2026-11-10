# Szótár és íráskönyv

Egy fogalom, egy szó (ADR-119). A felület minden felirata ezt követi. A [glossary.test.mjs](../tests/glossary.test.mjs) a felület forrásában tiltja a régi szavakat.

## Fogalmak

| Szó | Jelentése | Hol | Nem ezt |
| --- | --- | --- | --- |
| **Ellenőrzés** | a tanuló összeállított megoldásának értékelése | Próba, Gyakorlás (sárga gomb) | forrás vagy modell vizsgálatára |
| **Forrás vizsgálata** | a referenciaforrás nyelvi és futási vizsgálata, modell készítése nélkül | Forrás lépés | „Forrás ellenőrzése” |
| **Minősítés** | a kész modell besorolása: elemzéssel igazolt, konzervatív, szerzői módosítás, nem igazolt | Szabályok lépés | „Minősítés és ellenőrzések” |
| **Megnyitás…** | tartalom behozása kívülről: példa, forrásfájl, JSON-fájl, TypeScript-minta, mentett munka | menük, eszközsávok | „betöltés” |
| **Alkalmazás** | a piszkozat élessé válik (a modell vagy a megoldás ebből készül) | JSON alkalmazása, Megoldás alkalmazása | „Modell betöltése” |
| **Mentés a böngészőbe / Mentett munka megnyitása** | a munkamenet ezen a böngészőn | Munkamenet menü | „Helyi mentés”, „Visszatöltés” |
| **Exportálás fájlba… / Importálás fájlból…** | a munkamenet fájlként | Munkamenet menü | „Fájl export”, „Fájl import” |
| **Újrakezdés** | a tanulói megoldás kiürítése | Próba, Gyakorlás | „Visszaállítás” |
| **Visszavonás** | a legutóbbi betöltés visszavonása | Forrás lépés | |
| **Változtatások elvetése** | a nem alkalmazott forrásváltozás eldobása | Forrás, Szabályok | „Forrásváltozás elvetése”, „Változások elvetése” |
| **Sor szabályai** | a kijelölt sor szabálypanele | Próba eszköztár, kijelölt sor sávja | „Szabályok” gomb (az a lépés neve) |
| **Kód frissítése a rendezőből** | a megoldáskód újraírása a rendező állapotából | Megoldáskód | „Rendezőből újratöltés” |
| **Mintamegoldás kitöltése** | a referencia sorrend beírása a megoldásba (szerző) | Próba | „Minta kitöltés” |
| **TypeScript minta (436 sor)** | a szállított nagy TypeScript-szolgáltatás | Megnyitás menü | „TS tesztfájl” |
| **Kód / Elemzés és szabályok / Próba és kiadás** | a feladatkészítés három lépése (ADR-123) | lépéssor, lépéscímek, üzenetek | „Forrás”, „Szabályok”, „Próba” mint lépésnév |
| **Vizsgálati beállítások / Elemzési beállítások** | a forrás vizsgálatának beállításai (Kód lépés) / az elemzési környezet és a profil (Elemzés és szabályok lépés) | beállításblokkok | |
| **Tanulói adatok és kiadás** | a feladat címe, leírása, szintje és az exportálás | Próba és kiadás lépés | |
| **Vissza a kódhoz** | visszalépés a Kód lépésbe | műveletsáv | „Vissza a forráshoz” |
| **ⓘ (Súgó: …) / Részletek a súgóban** | a címke utáni buborék: egy-két mondat, egy ellenőrzött példa, és a súgóoldal a témánál, új lapon (ADR-124) | beállítások, állapotkérdések, minősítés, leletek | „info”, „Tudj meg többet” |
| **Kész / Figyelem / Hiba / Zárolt / Elavult** | a lépéssor egyetlen szókészlete: rendben; továbbengedve, de figyelj; javítani kell; még nem nyitható meg; a modell óta változott a forrás (ADR-122) | lépéssor | „Hibás forrás”, „Figyelmeztetés”, „Figyelmeztetéssel”, „Zárva” |
| **A feladat állapota** | a tanári állapotkártya: Kitölthető? Ellenőrizhető? Igazságos? – Igen / Részben / Nem, és a következő lépés | Szabályok lépés | |
| **Következő lépés** | az egyetlen javasolt teendő az állapotkártya alján | Szabályok lépés | |
| **Megmutatom** | az óvatos szabályok fajtáinak megnyitása a „Szabályok típus szerint” listában | állapotkártya | |

**Ami nem változhat:** a *Local Demo*, a *Preview Validation* és a *Trusted Server Validation* az AGENTS.md szerződésének nevei. Angolul maradnak; a jelentésük magyarul a jelvény leírásában áll.

## Íráskönyv

- **Főnévi alak:** a gomb azt mondja, mi történik: „Modell készítése”, „JSON alkalmazása”, „Forrás vizsgálata”.
- **Három pont:** fájlválasztót vagy párbeszédet nyitó művelet végén „…” áll („JSON megnyitása…”, „Exportálás fájlba…”).
- **Mondatkezdő nagybetű** minden feliratban. Kis, nagybetűs, ritkított írás csak csoportfelirat lehet (például „FELADATOK”).
- **A továbblépést és a külső hivatkozást ikon jelzi,** nem a felirat része (nem „→ Szabályok”).
- **A hibaüzenet** azt mondja, mi a baj és mit tegyél, mentegetőzés nélkül.
- **Egy fogalom, egy szó:** új felirat előtt keresd meg a táblában. Ha nincs benne, a szó előbb a táblába kerül.
