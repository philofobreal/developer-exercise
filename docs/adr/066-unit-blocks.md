# ADR-066 – Egységblokk: a lyukas többsoros egység a validátor scope-jában (v33)

Állapot: **elfogadva** (2026-11-03), szabályverzió `scoped-effect-analysis-v33`. A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 6. fázisának rövid távú tétele. Az [ADR-009](009-sealed-units-and-throw-free-reads.md) lezárását szűkíti; a v3 egységmodell (hosszú táv) külön epic marad.

## Kontextus

Az ADR-009 óta egy lyukas többsoros egység minden azonos scope-ú testvérét a forrásbeli oldalához köti. Lyukas az egység, ha egy nem utolsó sora után a validátor nyitott scope-ja az egység saját scope-ja. Ilyen például a `record(` / `'a',` / `);`. Ennek oka: a precedencia nem tudja kifejezni, hogy egy sor „ne kerüljön a belsejébe”. Ezért egy független, hoistolt függvény vagy egy szabad osztálytag sem léphet át egy többsoros hívást vagy mezőinicializálót.

A validátor `Scope` szabálya viszont épp ezt fejezi ki: egy sor csak a saját blokkjába kerülhet, és egy blokk sorai csak a nyitó és a záró sora között állhatnak.

**Mérés a változás előtt (12 mag, v32):**
- `function` JS: 30 rés, ebből 15 `sealed-unit` okú;
- `class` TS: 26 rés, ebből 14 `sealed-unit` és 5 `continued-row` okú.

## Döntés

1. **Egységblokk.** A projekció ([code-line-projection.ts](../../src/author/code-line-projection.ts)) a lyukas egységnek `block` fajtájú blokkot ad, ha egy blokk ábrázolhatja:
   - az első sora nyitja, az utolsó zárja;
   - a folytatósorok `scopeId`-je ez a blokk.

   Ilyenkor nincs lezáró él. A testvérek az egység előtt és után is állhatnak, a belsejébe a validátor nem engedi őket.
2. **Mikor ábrázolható:**
   - egyik határsora sem más blokk (megtartott, elhagyott vagy klauzula) határa, és nem egy másik egységblokké;
   - minden blokk, amely az egység sorait érinti, az egység belsejében van;
   - a 250 blokkos keretben van hely (a valódi blokkok elsőbbséget kapnak).

   Minden más lyukas egység az ADR-009 lezárását kapja. Ilyen a TS overload-csoport, és a `});` sorral záruló hívás, amelynek utolsó sora egy függvényt is zár. A v2 egy sorhoz egy blokkhatárt enged, ezért ezek a v3 folytonossági egységét igénylik.
3. **Okkódok:** az egységblokk sorai között `continued-row` marad az ok, nem `block-close`. Új okkód nincs.
4. **Frissítés:** a meglévő modell függőségfrissítése ([dependency-refresh.ts](../../src/author/dependency-refresh.ts)) átveszi az új egységblokkokat:
   - ha az új szerkezet csak `block` fajtájú blokkokkal bővül;
   - és ezek elhagyásával pontosan a régi blokkok, szülők és sor-scope-ok adódnak.

   A régi blokkok azonosítója megmarad, az új egységblokk friss `unit-N` azonosítót kap. Minden más szerkezeti eltérés továbbra is elutasított.
5. **Ellenőrzési kapu:** a modellellenőrzés újraszármaztatása csak azonos szerkezetnél `match` ([engine.ts](../../src/author/engine.ts)).
   - Egy egységblokk nélküli modell ugyanazokat a függőségeket mutathatja, mint az új elemzés. Egységblokk nélkül viszont egy testvér az egység belsejébe kerülhet.
   - Ezért az ilyen modell `differs`, nem igazolt.
6. **Nem változik:**
   - a v2 séma (a `block` fajta már létezett);
   - a validátor és a mag;
   - a tanulói nézet (nem a scope-ból számol behúzást).

   A szerzői szabálytábla a mélységgel behúzza a folytatósorokat. Ez a szokásos tördelést követi.

## Helyességi érv

A validátor egy sort csak ott fogad el, ahol a nyitott scope a sor `scopeId`-je, és egy blokk a nyitó és a záró sora között nyitott. Az egységblokk belső sorai csak a blokkon belül állhatnak, a testvérek csak kívül. Így az egység összefüggő marad, és a saját listájában áll. Ez a [formális szerződés](../formal-ordering-contract.md) lokalitási lépése (A4, P0/P1).

Az egységen belüli sorrendet a `continued-row` élek tartják. Egy egységblokk az egység sorait érintő minden blokkot tartalmaz, ezért a blokkhierarchia faszerkezetű marad.

## Mérés

| Mérés | Előtte (v32) | Utána (v33) |
| --- | --- | --- |
| Kampány, 12 mag, `function` JS: rés | 30 (15 `sealed-unit`) | 15 (0 `sealed-unit`) |
| Kampány, 12 mag, `function` JS: elfogadott sorrend | 533 | 564 |
| Kampány, 12 mag, `class` JS/TS és `script` JS/TS | | változatlan |
| Korpusz (109 fixture, 54 754 szomszéd): rés | 41 | 35 |
| Korpusz: elfogadott sorrend | 1 072 | 1 078 |
| Gyors alapérték, `function javascript`: rés | 12 | 3 |

- Minden mérésben 0 hibás elfogadás. A teljes 12 magos kampány (6 fajta, 2 nyelv, „Számít” beállítás) 351 635 sorrendet ítélt meg; az `object`, `flow` és `param` fajta rése változatlan.
- A `class` TS maradéka (14 `sealed-unit`, 5 `continued-row`) teljes egészében overload-csoport.
- **A korpuszban 6 egység lett egységblokk:**
  - `wp6-hoisted-into-continued-call`, `wp6-member-into-continued-field`;
  - `task-group-by-js` (két szerződés), `task-cart-total-ts` (két szerződés).
- **Lezárva maradt:** csak a három overload-fixture.
- **Változott még:** a TypeScript mintakatalógus `19-literal-whitespace` modellje (többsoros sablonliterál).

## Bizonyíték

[unit-blocks.test.mjs](../../tests/unit-blocks.test.mjs):
- **többsoros hívás:** a hoistolt függvény átléphet rajta, a belsejébe nem kerülhet;
- **`});`-vel záruló hívás:** lezárva marad;
- **többsoros mezőinicializáló:** a metódus elé léphet;
- **frissítés:** átveszi az egységblokkot, más szerkezeti eltérést elutasít;
- **ellenőrzési kapu:** egységblokk nélküli modellre `differs`;
- minden fixture-ön 0 hibás elfogadás, 0 eldöntetlen.

## Tervezési review (ADR-037)

- **Tulajdonos:** a projekció. Az elrejtett döntés az, hogy melyik egység lesz blokk. A `ProjectionInput` és a `CodeLineProjection` interfész nem változott.
- **Frissítés:** a szerkezetfinomítás szabálya a frissítő modulban van, az interfésze nem változott.
- **Rögzített megállapítás:** az ellenőrzési kapu a blokkszámból következtet az azonos szerkezetre. Ez azon múlik, hogy a frissítés csak blokkot adhat hozzá. A tudás a megjegyzésben és itt rögzített. Ha a frissítés más finomítást is kapna, a kapunak saját szerkezet-összevetés kell.
- **Design twice:**
  - *Új `unit` blokkfajta a v2 sémában:* elvetve. Sémaváltozással és a felület minden blokkfogyasztójának módosításával járna. Közben ugyanazt fejezné ki, és a v3 natív egysége úgyis felváltja.
  - *A v3 egységmodell most:* a 6. fázis hosszú távú tétele. A mag már tud folytonos egységet (`unit-structure.ts`), de a szerzői lánc egésze v2-sor alapú (szabálytábla, szerkesztés, ellenőrzés, frissítés). A v3-ra csak az overload-csoport és a blokkot is záró egység vár.

## Nyitott

A v3 egységmodell integrálása a szerzői láncba (külön epic, saját ADR-rel és sémaverzióval). A mért haszna ma az overload-csoport körüli rés.

*Utóirat:* az overload-csoport rését az [ADR-079](079-overload-header-blocks.md) (v45) a v2-ben megszüntette: a függvényblokk az első szignatúránál nyílik, és a kapu a szerkezetet veti össze, nem a blokkszámot. A v3 bekötésének így ma nincs mért haszna. A `});`-vel záruló hívás lezárva marad (a korpuszban `wp6-sealed-continued-callback`, 1 rés).
