# ADR-120 – Elérhetőségi modell: rejtett, letiltott okkal vagy elérhető

Állapot: **elfogadva** (2026-11-09; az „egyszerre egy piszkozat” szabályt a felhasználó jóváhagyta). Kockázati osztály: megjelenítés és interakció. A felület-audit U3 pontja.

## Kontextus

A felület-audit szerint (2026-11-09) szinte minden gomb mindig kattintható volt, és csak kattintás után derült ki, hogy nem kellett volna:
- **Visszatöltés mentés nélkül:** „Nincs helyi mentés.”
- **Szabályszerkesztés alkalmazatlan JSON mellett:** a hiba csak kattintás után jelent meg.
- **Szabályszerkesztés alkalmazatlan forrás mellett:** engedett volt, így ugyanarról a modellről két piszkozat élt egyszerre.
- **Modell készítése változatlan forrással:** újrafutott, ugyanarra az eredményre.
- **Szétszórt tudás:** a „van alkalmazatlan JSON” feltételt két modul is külön tudta (`flow.ts jsonPending`, `rule-panel.ts ruleEditBlocked`).

## Döntés

- **Egy tulajdonos: [availability.ts](../../src/workbench/availability.ts).** Műveletenként egy választ ad:
  - **rejtett:** ebben a helyzetben soha nem értelmes, a nézet ki sem rajzolja;
  - **letiltott okkal:** most nem, de később igen; az ok megmondja, mit tegyél;
  - **elérhető.**
- **Mostani szabályok:**

  | Művelet | Letiltva, ha | Ok |
  | --- | --- | --- |
  | Modell készítése | nincs forrás; vagy a modell naprakész (a piszkozat egyezik az alkalmazottal) | „Nincs forrás…”, „A modell naprakész…” |
  | Forrás vizsgálata | nincs forrás | „Nincs forrás…” |
  | Mentett munka megnyitása | ebben a böngészőben nincs mentés (privát ablakban sem) | „Ebben a böngészőben még nincs mentett munka…” |
  | Újrakezdés | a megoldás üres | „A megoldás üres…” |
  | Szabályszerkesztés (panel, tábla, rögzítés, kapcsolat, típus szerinti feloldás) | alkalmazatlan CodeLine JSON van; vagy a forrás vagy az elemzési beállítás megváltozott a modell óta | „…Alkalmazd vagy vesd el…”, „…Készítsd újra a modellt, vagy vesd el a változtatásokat.” |

- **A letiltott vezérlő fókuszálható marad:** `aria-disabled="true"`, az ok `title`-ben és `data-disabled-reason`-ben. Billentyűzettel és képernyőolvasóval is kiderül, miért nem érhető el; a natív `disabled` ezt elrejtené.
- **Egy capture fázisú figyelő** ([interactions.ts](../../src/workbench/interactions.ts) `installDisabledGuard`) minden kezelő előtt megállítja a tiltott vezérlő aktiválását. Az okot a vezérlő mellett mutatja, udvarias élő régióban. Hiba nem keletkezik, mert semmi nem futott.
- **Egyszerre egy piszkozat:** amíg a szabályszerkesztő vár, a Szabályok lépés és a Próba szabálypanele egyszer kiírja a szünet okát (`data-edit-paused`).
- **Újrarajzolás nélkül is friss:** ami gépelés vagy mentés után változhat (Modell készítése, Forrás vizsgálata, Mentett munka megnyitása), `data-availability` jelölést kap. A `refreshAvailability` ezeket helyben frissíti a szerkesztő minden bevitele és a mentés után. Enélkül a böngészős teszt kimutatta, hogy üres forrás után begépelt kódnál a Modell készítése tiltva maradt volna.
- **A kezelők utolsó védvonalként ugyanezt kérdezik** (`reasonOf(availability(…))`). A `ruleEditBlocked` megszűnt.

## Két terv („design it twice”)

1. **Egy modul, amelyet a nézet, az őr és a kezelők is kérdeznek (választott).** Egy szabály egy helyen; a nézet csak attribútumot rajzol, a kezelőnek nem kell hibaüzenetet írnia.
2. **Feltételek a nézetben és a kezelőkben (elvetve).** Ez a mai állapot: ugyanaz a feltétel több helyen, és a kezelő utólag ír hibát.

## Mi változott viselkedésben

**Egy meglévő tesztelvárás változott:** alkalmazatlan forrás mellett eddig lehetett szabályt szerkeszteni (`pending_reference_survives_rule_edit`). Most a szerkesztő vár, és megmondja, miért; a forráspiszkozat megmarad, elvetése után a szerkesztés újra elérhető. Ez a jóváhagyott „egyszerre egy piszkozat” szabály.

## Bizonyíték

- **Egységteszt:** [availability.test.mjs](../../tests/availability.test.mjs) minden szabályt mindkét irányban vizsgál, és azt is, hogy a tiltás fókuszálható attribútum (nem `disabled`), escape-elt okkal.
- **Böngészős teszt:** [browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py) `availability_rules`:
  - üres forrásnál a Modell készítése tiltott; kényszerített kattintásra az ok megjelenik, és nem készül modell;
  - kész modellnél „naprakész”;
  - alkalmazatlan JSON mellett a vizuális szerkesztő szünetel, a rögzítés nem fut le;
  - a JSON visszaállítása után a szünet megszűnik.
- **Átírt meglévő teszt:** a `pending_reference_survives_rule_edit` a fenti viselkedésváltozás szerint.
- **A mátrixteszt `author()` segédje:** ha a modell ebből a forrásból már naprakész (a Modell készítése tiltott), a meglévőt használja, és ahogy a tanár is tenné, az Újrakezdés gombbal tiszta megoldásból indul.
