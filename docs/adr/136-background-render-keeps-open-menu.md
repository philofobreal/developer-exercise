# ADR-136 – A háttérben érkező válasz nem csukja be a nyitott menüt

Állapot: **elfogadva** (2026-11-11). A felhasználó kérte, hogy a Pages hibáját javítsam ki: a v57 óta egy CI-futás sem volt zöld, így az élő oldal nem frissült. Kockázati osztály: megjelenítés. A motor, a szabályok és az értékelés nem változott.

## Kontextus

- **A munkafelület minden rajzoláskor újraírja a `#app` tartalmát.** A nyitott `details` elemek közül csak a `data-memory` jelölésűek nyílnak újra; a fejléc- és lépésmenük (`Megnyitás`, `Munkamenet`) zárva rajzolódnak.
- **Betöltés után a beállítás-feloldó válasza aszinkron érkezik, és újrarajzol** (`ensurePolicy`).
  - Ha a szerző közben megnyitotta a „Megnyitás” menüt, a válasz becsukta, akár a mutató alatt.
  - Lassú hálózaton (és a CI gépén) ez valódi hiba: a `source_file` böngészőteszt a menü gombját nem találta láthatónak, és a `99101d3` CI-futása ezen bukott.

## Döntés

- **A rajzolás tudja, hogy háttérbeli-e** (`render({background: true})`): olyan választ rajzol, amelyet nem a szerző épp most indított.
  - Ilyenkor a nyitott fejléc- és lépésmenü (`details.menu`, a `…-menu` osztálya szerint, a súgóbuborékok kivételével) ugyanabban a nézetben nyitva marad.
  - A felhasználói művelet utáni rajzolás változatlan: a menüben választott művelet után a menü bezárul, mint eddig.
- **Most egy háttérbeli rajzolás van:** a beállítás-feloldó válasza. Ha később más háttérválasz is rajzol, ugyanezt a jelzőt kapja.

## Két terv („design it twice”)

1. **A menük `data-memory` jelölést kapnak** (a lenyitott magyarázatok mintájára). Elvetve: a művelet utáni rajzolás is nyitva hagyná a menüt. A menüt bezáró kattintásfigyelő a dokumentumon fut, a művelet rajzolása után, és a már lecserélt elemet zárná be.
2. **Csak a háttérbeli rajzolás őrzi a menüt (választott).** A különbség a rajzolás okában van, és azt a hívó tudja; a megőrzés a folytonossági modulé (`continuity.ts`).

## Tervezési review (docs/design-review.md)

- **continuity.ts:** *elrejti*, mely nyitott elemek élik túl a rajzolást. A `capture` kap egy `background` jelzőt; a menü neve a `…-menu` osztály.
- **view.ts:** a `render` egy opcionális jelzőt kap, és továbbadja. Hívó: a `ui.js` beállítás-feloldó ága (átmeneti JS, ADR-001, egy szűk bekötés).

## Bizonyíték

- **Böngészős teszt** (`background_render_keeps_menu`):
  - a beállítás-feloldó válaszát visszatartja, megnyitja a „Megnyitás” menüt, majd elengedi a választ;
  - a rajzolás megtörténik, a menü nyitva marad, a gombja látható;
  - a menüből választott művelet után a menü bezárul.
  - Mutációs próba: a jelző nélkül (a régi `render()`) a teszt elbukik.
- **A `source_file` eset** szerveres és Pages módban háromszor egymás után zöld.
