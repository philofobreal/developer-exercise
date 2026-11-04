# ADR-096 – Automatikus akadálymentességi átvizsgálás (axe-core)

Állapot: **elfogadva** (2026-11-04). A felhasználó jóváhagyta. Az [ADR-091](091-obsidian-design-frame.md)–[ADR-095](095-tap-to-place-and-drag-insert-migration.md) teljesen átalakította a felület megjelenését, de az akadálymentességet eddig csak kézzel mértük (kontrasztszámítás, érintési célméret). Kockázati osztály: megjelenítés, valamint mérés és eszközök.

## Döntés

1. **Új böngészős készlet** ([browser-a11y.playwright.py](../../tests/browser-a11y.playwright.py), `npm run test:browser:a11y`, a `test:browser:all` része).
   - Az axe-core 4.14.0 (MPL-2.0) pontos verzióval, csak fejlesztői függőségként kerül be; a kiszolgált felület nem tölti be.
   - **Nézetek:** a szerzői Forrás, Szabályok és Próba lépés (ellenőrzés előtt és után), a tanulói előnézet, valamint a gyakorlás rendezővel és megoldáskóddal. Mindegyiket asztali nézetben (1 440 × 900 képpont) és telefonon (390 × 844 képpont, érintéssel) vizsgálja.
   - **Szabálykészlet:** `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.
   - **Elvárás:** minden nézet 0 hibát ad. Mentesség csak a tesztben, szabályazonosítóval és indoklással vehető fel; ma egy sincs.
   - Az axe beinjektálásához a tesztkontextus megkerüli a CSP-t (`bypass_csp`). A kiszolgált CSP változatlan (`script-src 'self'`), és a teszt első futása ezt igazolta is.
   - `A11Y_COLLECT=1` beállítással a készlet minden nézet minden találatát kilistázza, nem áll meg az elsőnél.
2. **Az első futás 6 valódi hibát talált, mind javítva:**

| Szabály | Hol | Javítás |
| --- | --- | --- |
| `label-content-name-mismatch` (WCAG 2.5.3) | Másolás, Beillesztés, Fájl export/import, JSON másolása gombok | az akadálymentes név a látható felirattal kezdődik („Másolás: a felhasználható sorok a vágólapra”) |
| `color-contrast` (1.4.3) | a szabálytábla sorindexe | `--navy-46` → `--navy-62` |
| `color-contrast` (1.4.3) | a kódkiemelés osztálynevei (`Set`, `Map`, `T`) | a Prism saját vörösét felülírja a `--red-76` |
| `aria-required-children` (1.3.1) | az üres forráslista | elemek nélkül `role="group"`, elemekkel `role="list"` |
| `scrollable-region-focusable` (2.1.1) | görgethető lista fókuszálható elem nélkül | a lista fókuszálható (`tabindex="0"`), így billentyűzettel is görgethető |
| `button-name` (4.1.2) | a teljes képernyő gomb mobilon, rejtett felirattal | `aria-label="Teljes képernyő"` |

## Korlát

Az axe a WCAG gépileg ellenőrizhető részét vizsgálja. A 0 hiba nem WCAG-megfelelőség, és nem helyettesíti a képernyőolvasós és a billentyűzetes kézi próbát (AGENTS.md: teljes WCAG-tanúsítást nem állítunk).

## Tervezési review (ADR-037)

- **Tulajdonos:** az átvizsgálás egy tesztkészletben él, a nézetek bejárásával együtt; a felület kódja nem tud róla.
- **Design twice:** *axe a meglévő böngészőkészletekbe szórva:* elvetve. Egy helyen tartjuk a szabálykészletet, a nézetlistát és a mentességeket, így egy új nézet felvétele egy sor.
