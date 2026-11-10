# ADR-125 – A Local Demo motorja háttérszálon (NY-32)

Állapot: **elfogadva** (2026-11-10). Kockázati osztály: megjelenítés, valamint dokumentáció és eszközök; a motor (generálás, kapuk, minősítés, értékelés) nem változott. Az [ADR-001](001-typescript-workbench-and-boundaries.md) átmeneti határának bekötése.

## Kontextus

- **A Pages-en a teljes szerzői motor a fő szálon futott:** generálás, első és második kapu, minősítés (újragenerálással), előnézeti értékelés.
- **Mért kiindulás** (Pages-build, Playwright, 2026-11-10; a leghosszabb fő szálas feladat a Modell készítése alatt):
  - a 436 soros TypeScript minta (formázva 486 sor): **2368 ms**;
  - egy 480 soros, mélyen tagolt JavaScript-forrás: **2597 ms**.
  
  Ennyi ideig a felület nem reagált.
- **A TypeScript-fordító (kb. 9 MB) is a főoldalon töltött be,** `<script>` elemként.

## Döntés

- **A motor háttérszálban (module worker) fut:**
  - `pages-worker.ts`: importálja a fordítót és a változatlan `pages-api.js`-t, és név szerint kiszolgálja a műveleteit;
  - `local-demo.ts`: a fő szálon ugyanazokat a neveket adja, mint a szerver API-ja. A Pages-build az `app/api.js`-t erre irányítja.
  - A háttérszál az első híváskor indul; az első hívás az induláskor betöltött feladatlista.
- **Hívás a szálhatáron át** (`worker-rpc.ts`):
  - a hiba üzenetével és `details` mezőjével kel át; a szerzői folyamat az `error.details.gate`-et olvassa;
  - az ismeretlen művelet hiba;
  - ha a háttérszál nem indul el vagy meghal, minden várakozó és későbbi hívás egy érthető üzenettel bukik, nem lóg.
- **A fordító a háttérszálé:**
  - a build `vendor/typescript.mjs`-t ír: a szállított fájl változatlanul, a végén `globalThis.ts = ts;`;
  - a főoldal nem tölti be a fordítót, így indulás után sem foglalja a fő szálat.
  - Az architektúra-kapu egyetlen, fájlhoz és importhoz kötött kivételt kapott (`pages-worker.ts` → `../vendor/typescript.mjs`), a `../formatter.js`-hez hasonló explicit portként.
- **Egy fő szálas hiba is kiderült és megszűnt.**
  - A háttérszál után 612 és 831 ms maradt. A profil szerint ebből 508 ms a `jsonPending` volt: minden szabályvezérlő megkérdezte, van-e alkalmazatlan JSON, és ehhez minden alkalommal újraszerializálta a teljes modellt.
  - Most a `modelJson` modellobjektumonként egyszer szerializál (gyenge leképezés).
  - Hogy ez ne adhasson elavult választ, a modellt soha nem írjuk át helyben: a tanulói adatok módosítása (`setLearnerData`, ADR-123) új modellobjektumot ad.
  - Ez a szerveres módot is gyorsítja, mert ott ugyanez a kirajzolás fut.

## Eredmény (ugyanaz a mérés)

| Forrás | Előtte | Háttérszállal | Háttérszál + JSON-gyorsítótár |
| --- | --- | --- | --- |
| TS minta (486 sor) | 2368 ms | 612 ms | **139 ms** |
| Mély JS (480 sor) | 2597 ms | 831 ms | **149 ms** |

A teljes idő (kb. 2,4 s) nem rövidült: ugyanaz a munka fut, csak nem a fő szálon. Közben a felület válaszol.

## Két terv („design it twice”)

1. **Az egész motor a háttérszálban, vékony kliens a fő szálon (választott).** A motor állapota (piszkozatok, referenciafeladatok) egy helyen él; a kliens csak továbbít.
2. **Csak a generálás a háttérszálban (elvetve).** A piszkozat két szálon élne, és a minősítés újragenerálása, valamint a kapuk újra a fő szálat foglalnák.

Tartalék (fő szálas futás, ha a háttérszál nem indul) nem készült. A module worker 2023 óta minden fő böngészőben elérhető, és a tartalékhoz a 9 MB-os fordítót újra a főoldalra kellene tölteni. Helyette a hiba egy mondatban megmondja, mit tegyen a felhasználó.

## Tervezési review (docs/design-review.md)

- **worker-rpc.ts:**
  - *elrejti* az üzenetformát, a hívásszámozást, a hiba átadását, valamint az indulási és halálhibát;
  - *interfésze* két függvény: `serve` és `connect`.
- **local-demo.ts:** *elrejti*, hogy háttérszál van, mikor indul, és hogyan néz ki a hívás.
- **pages-worker.ts:** csak bekötés; a motor tudása a `pages-api.js`-ben maradt (átmeneti JS, szűk portleírással: `pages-api.d.ts`).
- **author-workspace.ts `modelJson`:** a „milyen a modell JSON-alakja” tudás egy helyen; a `flow.ts` ezt kérdezi.

## Bizonyíték

- **Egységteszt:**
  - [worker-rpc.test.mjs](../../tests/worker-rpc.test.mjs): érték és sorrend; hiba üzenettel és részletekkel; ismeretlen művelet; induláskor elhaló háttérszál; a JSON-gyorsítótár és az új modellobjektum.
  - [pages-build.test.mjs](../../tests/pages-build.test.mjs): a főoldal nem tölti a fordítót; a `typescript.mjs` és a háttérszál bekötése; az `api.js` a kliens.
- **Böngészős teszt:** [browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py) `local_demo_responsive` (csak Pages).
  - A TS minta modellkészítése alatt a leghosszabb fő szálas feladat 1000 ms alatt marad; ez a régi 2,4 s-ot elkapná.
  - A többi Pages-változatú böngészős eset a háttérszálon át futtatja a teljes szerzői folyamatot.
