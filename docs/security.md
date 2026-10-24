# Biztonsági szerződés

A Node-szerver a megbízható referencia és a szabályok tulajdonosa. `POST /api/evaluate` feladatazonosítót, verziót és fizikai kódsorokat fogad; kliensoldali modellel, függőséggel vagy profillal nem írható át a szerverben tárolt szabály. A tanulói kód adat: nincs `eval`, `Function`, `vm`, interpreter, parser vagy futtatás az értékelési útvonalon.

A szerzői csatorna külön, ideiglenes előnézetet hoz létre. JSON Schema → strukturális fordítás → referenciaforrás nyelvi szintaktikai auditja → eredeti sorrend önellenőrzése → draft tárolása. Csak siker után kap a kliens új aktív modellt. A szerzői kérés másolata kerül feldolgozásra. A böngészőben importált modell ugyanazon admission folyamaton megy át.

A böngészőben értékelő Pages-kiadás **Local Demo / Preview Validation**. Sem a referencia, sem a riport nem titkos és nem hiteles vizsgaadat. Saját előnézet Node-on is csak **Preview Validation**. A beépített Node-referenciák értékelését jelöli **Trusted Server Validation**; ez a szabályforrás helyét jelenti, nem bejelentkezést vagy érdemjegyhitelesítést.

Korlátok: 500 sor, soronként 2048 Unicode-kódpont, legfeljebb 250 reprezentált blokk, 32 profil, 5000 explicit él/profil és legfeljebb 10000 levezetett él/profil. A forráskészítő 50000 kódegységnyi forrást, a HTTP-import legfeljebb 1 MiB kérésbodyt fogad. A szerverkorlát és a kliens oldali fileméret-ellenőrzés külön védelmi réteg. Az eredeti forrássorrend auditja kötelező.

A keresés determinisztikus és az összes profilon közös keretet használ; limitnél `indeterminate`, nem `rejected`. A normalizált referenciasorok előindexelése csökkenti az ismételt feldolgozást, de nem változtatja a megengedett hozzárendeléseket. A `fixed` abszolút pozíciót tokenenkénti fixedPosition korlát biztosítja; ez nem írja elő a többi sor eredeti oldalát.

A localStorage és exportfájl kizárólag szerzői adatot/próbálkozást tárol. Importnál a sorazonosítók, multiplicitás és fixed pozíciók ellenőrzöttek; riport nem tölthető vissza hiteles eredményként. A szerverreferenciához importált próbálkozás csak a szerver aktuális azonosítójához/verziójához illeszthető.

A backend alapból loopback címen indul, korlátos HTTP-bodyt és POST-rátát, biztonsági headereket és helyi scriptforrásokra korlátozott CSP-t alkalmaz. Nem tartalmaz bejelentkezést, üzemi jogosultságkezelést, tartós adatbázist vagy központi auditnaplót. Éles vizsgaszolgáltatáshoz ezek, HTTPS és a szerzői modellek külön publikálási/hitelesítési folyamata szükséges. A strukturális elfogadás nem bizonyítja a program szemantikai helyességét.

A `sourceLine` és az importált `authoring.dependencyPolicy` csak metaadat: nem módosítja a fordított függőségi szabályokat és nem igazol szemantikai helyességet. A `matchedTokenIds` sikeres értékeléskor a szerverben tárolt tokenekből számított tanú; kliens által megadott ID vagy megfeleltetés nem írhatja felül a tartalmi vizsgálatot. A riport nem tartalmazza a rejtett szervergráf éleit.
