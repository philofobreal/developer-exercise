# ADR-004 – Referencia és megoldás, feladatonkénti munkaváltozatok

Állapot: megvalósítva; a feladatonkénti szerzői munkaváltozatokat az [ADR-022](022-stepwise-author-flow.md) egyetlen szerzői projektre cserélte (a gyakorlás külön mód). A referencia és a próba szétválasztása érvényes. Az [ADR-001](001-typescript-workbench-and-boundaries.md), [ADR-002](002-fixed-positions.md) és [ADR-003](003-language-ir-and-codeline-v3.md) változatlanul érvényes.

A referencia gépelése nem frissítette a controller tárolt source mezőjét; nézetváltáskor elveszhetett. Emellett a globális szerzői forrás más feladathoz tartozhatott, mint a kiválasztott próba. A megoldásszerkesztő helyesen külön munkaváltozatot tartott, de a feliratok két hasonló forrásnézetnek láttatták ezeket.

A referencia a feladatot és szabályokat határozza meg; a próba a belőlük összeállított megoldás. A szerzői source/JSON munkaváltozat feladatonként, memóriában megmarad. Első megnyitáskor a kiválasztott feladat publikus kódsoraiból indul. A beépített feladatból csak saját szerzői másolat készülhet, trusted szabályok nem kerülnek a klienshez. Alkalmazás után ugyanaz a feladat látható mindkét fázisban; a megoldás szerkesztése nem írhatja át a referenciát.

A typed author-workspace modul rejti a munkaváltozatok kiválasztási, mentési és baseline-politikáját. Az új státusz/nézetlogika strict TS. A legacy controller kizárólag a portok bekötését és a hiányzó inputesemény továbbítását kapja; a generált public/app kódot a compiler írja. A késői admission nem írhat felül újabb szerkesztést vagy feladatváltást. A meglévő installPreview továbbra is az atomi referencia-/attempt admission tulajdonosa.

A szerzői draftok memóriabeli megőrzése nem új session formátum. A fixed, exact, beszúrás, dependency/profile, szintaktikai audit és trusted/preview/local-demo szerződés változatlan. A kézzel adott JSON-szabályokat normál import nem generálja újra. A teljes forrás-újragenerálás mellett az [ADR-006](006-explicit-dependency-refresh-and-review-guards.md) külön explicit sorfüggőség-frissítést vezetett be: ez csak a dependencies mezőket cseréli, a fixed helyeket, kézi éleket és profilokat megtartja.
