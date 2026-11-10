# ADR-114 – A bizonyítottan csak szűkítő kézi modell szerzői módosítás, nem „nem igazolt”

Állapot: **elfogadva** (2026-11-09). Kockázati osztály: mag (a modellminősítő a validátor magjának része). Az [ADR-017](017-model-verification-gate.md) minősítési szabályának pontosítása; az [ADR-108](108-author-preflight-specification.md) E9–E10 árnyékfuttatásában nyitva hagyott pedagógiai döntést zárja le.

## Kontextus

- **A mai szabály ([engine.ts](../../src/author/engine.ts) `verifyAuthorModel`):** a minősítő a modell forrásából újragenerálja a szabályokat, és csak betű szerinti egyezést fogad el (`rederivation: match`). Minden más eltérés `differs`, és a minősítés „nem igazolt”.
- **A következmény:**
  - ugyanaz a szigorítás a Szabályok panelen hozzáadva „szerzői módosítás”;
  - JSON-ban kézzel megírva „nem igazolt”, akkor is, ha a modell semmit sem fogad el, amit a generált elutasít.
- **A „nem igazolt” két helyen fáj:**
  - a „Tilt” beállítás mellett a Próba nem nyílik meg;
  - a `verified-only` publikálás elutasítja.
- **A konkrét eset:** az `01-user-account.values-only` minta.
  - A szerző egy generált szabályt (5. sor ← 4. sor) kihagyott, mert a saját, erősebb szabályai (15 szerzői él) már következtetik.
  - Mért tény (2026-11-08): a generált modell minden sorrendi kötése következik a minta szabályaiból, a blokkszerkezet azonos, rögzített sor és profil nincs.

## Döntés

**Új újralevezetési eredmény: `narrower`.** A szerzői oldal (`verifyAuthorModel`) akkor adja, ha nincs betű szerinti egyezés, de mind a három teljesül:
1. **Azonos szerkezet:** ugyanazok a blokkok és sor-hatókörök, ugyanazzal az ellenőrzéssel, mint a `match` esetén (`sameStructure`).
2. **Minden generált sorrend következik:** az újragenerált modell minden kötése (sorfüggőség és közös él, a megerősített lazítások nélkül) a modell saját függőségeiből és éleiből tetszőleges távolságon át következik (tranzitív lezárt).
3. **Nincs hamis elemzői ok:** a modell minden nem szerzői provenienciabejegyzése (ok, kategória, kód) az újragenerálásban is szerepel. Az elemzőnek kiadott szűkítés így nem lehet `narrower`.

**A mag (`verifyModel`) így kezeli:**
- a `narrower` nem kerül a „nem igazolt” okok közé;
- a minősítés legalább `author-modified`, akkor is, ha a szerzői szabályok száma 0;
- új lelet: „A szabályok eltérnek a forrás újragenerálásától, de bizonyítottan csak szűkítenek…”;
- a „Minden kényszer oka az aktuális elemzésből újra levezetett” állítás alapja `not-established` (a szerzői kötés nem az elemzésből jön, de nem is cáfolt).

**Miért helyes (soundness):** a modell által elfogadott sorrendek a sorrendi kötések lineáris kiterjesztései a változatlan blokkszerkezeten belül. Ha a kötések lezártja bővebb, a kiterjesztések halmaza szűkebb. A tartalom azonos, mert a regenerálás a modell saját soraiból fut. A rögzített sorok és a profilok csak tovább szűkítenek, és a mag ezeket eddig is szerzői módosításnak minősítette. A modell tehát semmit nem fogad el, amit az elemzéssel igazolt generált modell elutasítana.

**Ami nem változik:**
- a lazítás (generált kötés, amely nem következik) továbbra is `differs`, „nem igazolt”;
- a szerkezetváltozás és a hamis elemzői ok is `differs`;
- a referencia elfogadása, a kapupróbák és a nyelvi audit továbbra is a publikálhatóság feltételei.

**Pedagógiai következmény (a felhasználó 2026-11-09-i döntése):** az ilyen modell „Tilt” mellett is megnyitja a Próbát, és `verified-only` mellett publikálható.

## Két terv („design it twice”)

1. **A szűkítés bizonyítása a szerzői oldalon, a mag egy új értéket kap (választott).**
   - A regenerált modell és a sorpárosítás (`id`) ma is csak a `verifyAuthorModel`-ben él; a lezárt-összevetés ugyanott marad.
   - A mag interfésze egy értékkel bővül (`rederivation: 'narrower'`), a regenerált modellt továbbra sem látja.
   - **Rejtve marad:** hogyan párosítjuk a sorokat, mely lazítás számít megerősítettnek, hogyan számoljuk a lezártat.
   - **Változó hívó:** egyedül a `verifyAuthorModel`. A `verifyModel` többi hívója nem ad `rederivation`-t, és a viselkedésük változatlan.
2. **A mag kapja meg a regenerált modellt, és maga hasonlít (elvetve).**
   - A mag interfésze egy teljes modellel szélesedne.
   - A sorpárosítás és a lazítások tudása a magba szivárogna.
   - Az AGENTS.md szerint a szerzői elemzés birtokolja a nyelvi és regenerálási döntéseket, nem a mag.
3. **Elfogadott sorrendek felsorolása és összevetése (elvetve).** Exponenciális, és a keretkorlát miatt csak „nem eldönthető” választ adna nagyobb modellen. A lezárt-összevetés n ≤ 500 sorra négyzetes.

## Mérés (2026-11-09)

- **Szállított modellek** (16 katalógusfeladat, 25 TypeScript-mintamodell; 41): egyedül a `values-only` minősítése változott (`unverified` → `author-modified`, `rederivation: narrower`). Eloszlás a szerver nyelvi auditjával: 32 elemzéssel igazolt, 4 konzervatív, 4 szerzői módosítású, 1 nem igazolt (a szándékosan hibás `13-duplicate-names`, TS2300).
- **Árnyékfuttatás** (`node scripts/preflight-measure.mjs`, mindhárom beállítás): 40 modell mindkét kapun átmegy. Csak a szándékosan hibás `13-duplicate-names` akad el (első kapu, TS2300).

## Bizonyíték

[proven-narrowing.test.mjs](../../tests/proven-narrowing.test.mjs):
- **pozitív:**
  - a `values-only` minta `narrower`, `author-modified`, és `verified-only` mellett publikálható;
  - egy szerzői kötés, amely a generált szabályt következtetetté teszi: `narrower`, és a modell minden elfogadott sorrendjét a generált is elfogadja;
  - „Tilt” mellett a második kapu átengedi.
- **negatív, „nem igazolt” marad:**
  - a lazítás (egy generált kötés elhagyása pótlás nélkül), „Tilt” mellett zárt Próbával;
  - a szűkítő kötés elemzői kategóriával (hamis ok);
  - másik blokkba áthelyezett sor.
- A generált minta továbbra is `match`.

## Következmények

- A `ModelVerification.checks.rederivation` értékkészlete: `match | narrower | differs | not-run`.
- A Szabályok panelen hozzáadott és a JSON-ban kézzel megírt szigorítás ugyanazt a minősítést kapja.

## Kiegészítés (2026-11-10): a lazítás megnevezése (B2)

- **Probléma:** egy kézi modell, amely egyszerre szűkít és lazít, eddig csak az általános leletet kapta („A generált szabályok eltérnek a forrás újragenerálásától…”). A szerző nem tudta meg, melyik kötése a hiba.
- **Döntés:**
  - azonos blokkszerkezet mellett a `verifyAuthorModel` a lezárt-ellenőrzés közben összegyűjti azokat a regenerált sorrendi kötéseket, amelyek nem következnek a modell saját szabályaiból, és a magnak `unimplied` bemenetként adja át (sor-azonosítókkal);
  - a mag ezt a leletben nevezi meg (legfeljebb öt kötést, a többit „…” jelzi): „A szabályok lazítanak a forrás újragenerálásához képest: N generált sorrendi kötés nem következik a modell szabályaiból (#1 → #3, …).” Ez a lelet az általános helyett áll;
  - a szűkítő szerzői szabály leletje mellette marad, így a szűkítő és lazító modellnél mindkét oldal látszik.
- **Pontosság:** a mondat azt állítja, amit bizonyítunk. Hogy egy kötés nem következik, azt a lezárt mutatja meg. Hogy ettől több sorrend fogadható el, az csak lehetőség („engedhet meg”), mert egy rögzített hely vagy profil máshonnan is kötheti.
- **Interfész:**
  - a `VerificationInput` egy opcionális mezővel bővül;
  - a regenerált modell továbbra sem kerül a magba (ugyanaz az elv, mint a választott tervben);
  - a többi hívó nem ad `unimplied`-ot, ezért náluk semmi nem változik.
- **Bizonyíték:** [proven-narrowing.test.mjs](../../tests/proven-narrowing.test.mjs) „B2” teszt:
  - a tiszta lazítás megnevezi a `#1 → #3` kötést, és az általános lelet eltűnik;
  - a szűkítő és lazító modell mindkét hiányzó kötést megnevezi, a szerzői szűkítést is;
  - a tiszta szűkítés semmit nem nevez meg.
