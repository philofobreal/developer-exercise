# Üzleti és technikai működési szerződés

## Cél és két adatút

A műhely feladata programkódsorok sorrendezésének oktatása: a szerző készít és kipróbál egy referenciafeladatot, a tanuló a megengedett sorokból állít össze megoldást. A strukturális elfogadás a szerző által megadott szabályok teljesülése; nem tetszőleges JavaScript/TypeScript programok szemantikai ekvivalenciájának bizonyítása.

A szerző forráskóddal vagy teljes CodeLine JSON-nal indulhat. Forrásból csak kérésre történik teljes formázás; az Alkalmazás az akkor látható forrást elemzi, és nem formázza át hallgatólagosan. A JSON-import nem generálja újra a kézi függőségeket. Mindkét út séma-, gráf-, referenciaszintaxis- és eredeti sorrend-ellenőrzés után ugyanazt az aktív előnézetet hozza létre. Hibánál a korábbi alkalmazott állapot megmarad. Az újraalkalmazott forrás új modellt ad, így a korábbi kézi JSON-szabályok előzetes exportja indokolt.

A tanulói értékelés külön adatút: azonosító + revízió + kódsorok → tartalmi hozzárendelés → sorrendi és blokkszabályok → eredmény. A tanulói kódot sem parser, sem compiler, sem futtató nem dolgozza fel ezen az úton. A Node referencia a szerveré; a Pages helyi demonstráció; a saját szerzői preview egyik esetben sem hiteles vizsgacsatorna.

## Az adatmodell jelentése

| Fogalom | Pontos szabály |
| --- | --- |
| lines sorrendje | A szerző által megadott referencia; önellenőrzés bemenete és a fixed sorhely alapja. Nem írja elő önmagában az összes szabad sor sorrendjét. |
| id | Az adott feladatverzión belüli állandó sorazonosító; átrendezés nem számozza újra. A beküldő állított ID-ja nem bizonyít tartalmi azonosságot. |
| sourceLine | Opcionális, 1-től induló eredeti fizikai forráshely. Tájékoztató metaadat; nem függőségi kulcs és nem megoldáspozíció. |
| dependencies | Minden felsorolt ID-nak korábban kell állnia, tetszőleges távolságra. A tömb sorrendje nem korlátozza az előzményeket egymáshoz képest. |
| edges | Minden profilban kötelező before → after él. A függőségekkel együtt AND. |
| profiles | Egy profilon belül az élek AND, a profilok között OR. Az alapfüggőségek mindegyik profilban érvényesek. |
| fixed | A referenciasor abszolút indexe és tartalma marad; a többi sor átléphet a két oldala között, ha más szabály nem tiltja. Nem szomszédsági követelmény és nem implicit oldalkorlát. |
| blocks / scopeId | A megtartott lexikai konténer, annak szülője és nyitó/záró sorai. A kiértékelő szabályos egymásba ágyazást követel. |
| functionBlock | A megtartott függvénytulajdonos; a scope-hierarchiából ellenőrzött adat, nem behúzási szint. |
| normalization | indent: csak vezető szóköz/tab hagyható figyelmen kívül; exact: minden kódegység számít. |

Két azonos tartalmú zárókapocs továbbra is két külön referenciaelőfordulás. Az értékelő teljes bijekciót keres: minden beküldött sorhoz egy, pontosan egyszer felhasznált referenciaelőfordulás tartozik. A sikeres matchedTokenIds szerver által számított tanú, nem a kliens által beküldött igazolás. A formális feltétel: [validációs modell](validacios-modell-es-formazas.md).

## Sorrendezés és sorhelyrögzítés

A kezdeti megoldás a fixed sorokat már a referenciahelyükön tartalmazza, a többi hely üres; a mozgatható elemek a felhasználható sorok között vannak. A húzás célja egy 0..N fizikai sorok közötti határ. A célzott sor felezőpontja dönti el az előtte/utána helyet. Az attempt modul kihagyja a fixed helyeket, és a köztes mozgatható elemeket a legközelebbi szabad hely felé tolja. Teljes megoldáson belüli mozgatás először a kiinduló helyet szabadítja fel. A fel/le gombok a következő mozgatható sorhelyre céloznak, a közbeeső fixed helyeket átugorva. Ez beszúrás, nem két elem felcserélése; sikertelen művelet nem módosít részlegesen állapotot.

A natív egérhúzás, a pointer/érintés, a billentyűzet és a sorvezérlő gombok ugyanazt a domaint használják. A natív dragstart után érkező pointercancel nem törli a natív húzást; a saját pointergesztust csak annak azonosítója szakíthatja meg. A fogantyú billentyűzete: Szóköz/Enter → nyilak/Home/End → Enter; Escape megszakít. A fixed sort sem visszatenni, sem áthelyezni nem lehet. Az eredményességet a külön Ellenőrzés adja meg, a kitöltöttségi sáv csak az elhelyezett sorok száma.

A megoldásszerkesztő és a vágólapos rendezőbe illesztés ellenőrzi a fixed hely tartalmát az adott normalizálással. Hibánál a korábbi próbálkozás megmarad. Az import szintén ellenőrzi a rögzített sor-ID helyét. A szerver a belső fixedPosition korláttal védi ugyanezt, ezért a kliens megkerülése sem enged rögzített tartalmat más sorhelyre. Az oldalak közötti szabad átrendezés javítását az [ADR-002](adr/002-fixed-positions.md) rögzíti.

## Tabulálás, behúzás és formázás

Három külön műveletet kell megkülönböztetni:

1. **Tab a szövegszerkesztőben:** a kijelölt szövegrészt öt U+0020 szóközre cseréli, és előre viszi a kurzort. Nem valódi tabkaraktert szúr be. Nincs blokkos kijelölésbehúzás vagy Shift+Tab visszahúzás; jelenleg az is ugyanazt az öt szóközt szúrja be.
2. **Explicit Formázás gomb:** teljes dokumentumlayoutot formázhat, tehát sorokat is tördelhet. A referenciaforrást még a modellsorok kialakítása előtt lehet így rendezni. A megoldásszerkesztőben a formázás csak draftot módosít; az Alkalmazás továbbra is ellenőrzi a sorszámot és a fixed helyeket.
3. **Élő rendezőbeli behúzás:** az aktuális sorrendből készülő, toleráns vizuális projekció öt szóközös szintekkel. Sorokat nem bonthat, vonhat össze vagy számozhat újra. A validátor az eredeti elemszöveget kapja, nem a kirajzolt behúzást. Másolás a kirajzolt elrendezést adja; visszaillesztéskor a tokenenkénti normalizálás érvényes.

A lexikai réteg string-, komment-, regex-, template- és interpolációs állapotokat követ. A JS Beautify 1.13.13 eredeti opciói és ideiglenes _____code_line_end_; jelölése csak ellenőrzött behúzási javaslatot adhatnak. A jelölő soha nem lesz CodeLine vagy beküldött tartalom. TypeScriptnél, exact soroknál és bizonytalan literálhelyzeteknél a lexikai réteg dönt; hiba esetén kontrollált fallback történik. Literálpayload és exact sor minden kódegysége változatlan. A megjelenítés nem bizonyít szintaktikai vagy szemantikai helyességet. Részletek: [formázási felelősségek](modularitas-es-elobehuzas.md).

## Szerkesztési és tesztelési állapot

Forrás- és JSON-draft csak sikeres alkalmazás után lesz aktív; a forrásfájl betöltése önmagában draft, a JSON-fájl importja sikeres admission után aktivál. A megoldásszerkesztő draftja nézetváltáskor megmarad, és alkalmazáskor kerül a rendezőbe. Ha közben a rendező módosult, figyelmeztetés látható. A formázási válasz csak változatlan szerkesztőhöz, nyelvhez, feladathoz, nézethez és próbálkozás-generációhoz írhat vissza. Az elavult értékelési siker vagy hiba nem minősítheti az újabb próbálkozást.

Kompatibilis modellszabály-módosítás megtartja a sorazonosságot, tartalmat, fixed jelzőt és normalizálást; a régi riport törlődik, és új értékelés történik. A munkamenet az alkalmazott feladatot és próbálkozást menti, nem teljes workspace-draftokat és nem hitelesített riportot. A tanulói preview ugyanazt a megoldói mechanizmust mutatja, szerzői és technikai eszközök nélkül; prezentációs elkülönítés, nem jogosultsági védelem.

## Felelősség és bizonyíték

| Követelmény | Tulajdonos / forrás | Regresszió |
| --- | --- | --- |
| Séma, ID, scope, fixed pozíció | docs/schema.json; src/core | schema-contract, code-line, validator |
| Kötésfüggőségek és beágyazás | src/author | dependency-bindings, ordering-semantics; 5040 lapos permutáció |
| Beszúrás és rögzített UI-hely | public/app/attempt.js, drag-insert.js | insertion, clipboard, persistence-registry; 36 valódi húzás |
| Behúzás és literálvédelem | public/formatter.js, public/formatting | lexical-context, legacy-comparison, formatter-contract, live-indent |
| Draft, preview és async folytonosság | src/workbench, public/ui.js bekötés | workbench-interactions; browser-workbench Node/Pages |
| Referencia tulajdonlása | src/server/catalog.mjs, API adapterek | trust-boundary, HTTP, pages-api |
| Modulhatárok és natív TS | AGENTS, src/workbench, scripts/architecture-rules.ts | architecture; verify-architecture; strict build |

Az új prezentáció és governance strict natív TypeScript; az örökölt JS/MJS nem lett hallgatólagosan típusellenőrzött. A további átállás sorrendje az [ADR-001](adr/001-typescript-workbench-and-boundaries.md), az aktuális review és teszteredmények az [auditjelentés](audit-report.md) része.
