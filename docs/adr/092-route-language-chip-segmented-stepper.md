# ADR-092 – Útvonalsor, nyelvjelvény és egysávos lépéssor (dizájn, 3. szakasz)

Állapot: **elfogadva** (2026-11-04). Az [ADR-091](091-obsidian-design-frame.md) ütemtervének 3. szakasza, a felhasználó dizájnterve alapján. Megjelenítési változás; validátor, generátor, modell és API nem változik.

## Döntés ([view.ts](../../src/workbench/view.ts), [style.css](../../public/style.css))

1. **Útvonalsor** (`<nav class="breadcrumb" aria-label="Útvonal">`): monospace nagybetűvel, a jelenlegi elem `aria-current="page"`.
   - **Szerzői nézetben:** „Studio / Feladatkészítés / {lépés}”;
   - **gyakorlásban:** „Studio / Gyakorlás / Gyakorlófeladat”;
   - **tanulói nézetben** nincs útvonalsor, mert ott nincs navigáció.
2. **Nyelvjelvény** (`.language-chip`): „TS TypeScript · 34 sor”, a fejléc jobb szélén. A korábbi „nyelv · mód · sorszám” sort váltja.
3. **Egysávos lépéssor:** a három lépés egy közös sáv három egyenlő szegmense, nyilak nélkül. Minden szegmens címkéje „01 · Forrás” alakú.
   - **Kész lépés:** az aktuális lépés előtti, nem zárolt és nem elavult lépés. Pipát kap a számdobozban, és az alcím elé „Kész” kerül.
   - **Aktuális lépés:** kitöltött ciánkék számdoboz és fénylő alsó vonal.
   - **Zárolt és elavult lépés:** a régi feliratokkal („Zárolt”, „Elavult”).
   - **650 képpont alatt:** a számdoboz és az alcím elrejtve, a címke tördelhető. 320 képpont szélesen sem lóg ki.

A lépésgombok `data-step` attribútuma és `aria-current="step"` állapota változatlan, ezért a vezérlők és a tesztek kapcsolódási pontjai nem változtak. A számdoboz `aria-hidden`; a képernyőolvasó a „01 · Forrás” címkét olvassa fel.

## Magasság

**Az első változat elbukott:** a magasabb lépéssor (58 képpont) és a 30 képpontos cím körülbelül 14 képponttal lejjebb tolta a rendezőt. Az egérrel húzó böngészőteszt (`browser-matrix`, „real mouse pointer insertion”) 1 000 képpont magas nézetben így a látható terület alá célzott.

**A tesztet nem igazítottuk.** A fejléc visszakapta a korábbi magasságát: a lépéssor 52 képpont, a cím 28 képpont. A rendező feljebb hozása a 4. szakasz feladata.

## Bizonyíték

- **A böngészőkészlet:** a lépésváltás, a zárolás, az elavulás, a mobilszélesség (320, 390 és 768 képpont, `scrollWidth ≤ szélesség`), valamint a Pages-nézet változatlan elvárásokkal fut.
- **Képernyőképek:** a szerzői Próba lépés, a gyakorlónézet és a 390 képpontos mobilnézet.

## Tervezési review (ADR-037)

- **Tulajdonos:** az útvonalsort és a nyelvjelvényt egy-egy segédfüggvény (`breadcrumb`, `languageChip`) adja mindhárom fejléchez. A „kész” állapotot a lépéssor a meglévő `flowSteps` állapotból számolja, saját állapotot nem tart.
- **Design twice:** *a kész lépés külön állapotként a `flowSteps`-ben:* elvetve. A „kész” csak megjelenítés: az aktuálisnál korábbi, nem zárolt, nem elavult lépés. A folyamatállapotot nem bővíti.
