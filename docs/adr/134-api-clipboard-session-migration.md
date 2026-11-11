# ADR-134 – Az `api`, a `clipboard` és az `author-session` szigorú TypeScriptben (NY-28)

Állapot: **elfogadva** (2026-11-11). A felhasználó a következő tételt kérte; a jegyzék szerint az NY-28 akkor esedékes, ha a modulokat módosítani kell, és az `api` a P2-ben ([ADR-132](132-progress-stage-and-abort.md)) új szabályt kapott (a megszakítást). Kockázati osztály: megjelenítés, valamint dokumentáció és eszközök. A viselkedés nem változott, egy holt export kivételével.

## Döntés

- **Három kézzel írt JS modul** (`public/app/api.js`, `clipboard.js`, `author-session.js`) forrása mostantól `src/workbench/*.ts`; a `public/app` alatti fájl fordítói kimenet. A két átmeneti deklaráció (`api.d.ts`, `clipboard.d.ts`) megszűnt, mert a forrás maga a szerződés.
- **`api.ts`:**
  - a válaszok típusa `unknown`: a vezérlő (`ui.js`, ADR-001) olvassa őket, a szerver saját típusai nem lépik át a hálózatot. Ez nem állít többet, mint amit a hálózat biztosít;
  - a `validationMode` típusa `'trusted-server' | 'local-demo'`, mert a Pages-build ugyanezen a néven a `local-demo` modult szolgálja ki.
  - **Architektúra-kivétel:** a `src/workbench` alatt a `fetch` tiltott (`presentation-policy`: a rajzolás nem birtokolhat hálózati forgalmat). Az `api.ts` nem rajzol, hanem a felület egyetlen szállítási portja, ezért a szabály ennek az egy fájlnak egyetlen hívást enged: a `fetch`-et. Az értékelés és a generálás itt is tiltott, és minden más felületi modulban a `fetch` is. Mintája az [ADR-125](125-local-demo-engine-in-a-worker.md) egyfájlos fordítóimport-kivétele; az [architecture.test.mjs](../../tests/architecture.test.mjs) rögzíti.
- **`author-session.ts`:** az `installPreview` csak a saját állapotát kéri (`PreviewState`: feladatok, aktív feladat, előnézetek, próbálkozások, szerzői modell és bizonyíték), nem a teljes munkaterület-állapotot.
- **`clipboard.ts`:** a másolási tartalék a dokumentum négy tagját használja (`CopyDocument`), így a teszt egy helyettesítőt adhat.
- **Új paritásteszt** ([api-parity.test.mjs](../../tests/api-parity.test.mjs)): a szerveres `api` és a `local-demo` ugyanazokat a neveket exportálja, ugyanolyan fajtával, és az oldal minden importált művelete mindkettőben megvan.
  - Indok: a Pages-build az `api` helyére a `local-demo` modult teszi; egy csak az egyikben meglévő név a másik build oldalát betöltéskor megtöri (hiányzó ES-modulimport). A szerveres böngészőteszt ezt nem látja, a Pages-teszt csak a ténylegesen bejárt utakon.
- **A teszt egy valódi eltérést talált:** a `local-demo` exportálta az `authorTransition` műveletet, a szerveres `api` nem.
  - Az oldal sosem hívja: a második kaput mindkét módban a `previewDraft` maga futtatja ([ADR-108](108-author-preflight-specification.md) E6).
  - Döntés: kikerült a `local-demo` exportjai közül (a kisebb interfész). A Local Demo motorja (`pages-api`) és a szerver `/api/author/transition` útvonala megmaradt; a `pages-api.test.mjs` közvetlenül a motort vizsgálja.

## Két terv („design it twice”)

1. **Közös `AuthorApi` interfész a `contracts.ts`-ben, amelyet mindkét adapter kielégít.** Elvetve: a válaszok `unknown` típusúak, így a típus csak a nevekről szólna, a kimenetet pedig nem a fordító, hanem a Pages-build állítja össze; a hiba a build kimenetén, futásidőben jelentkezik.
2. **A két lefordított modul exportjainak összevetése tesztben (választott).** Pontosan azt vizsgálja, ami a Pages-buildben megtörhet, és új fogalmat nem visz a kódba.

## Tervezési review (docs/design-review.md)

- Az interfészek nem bővültek; az `api` szélessége egy holt exporttal csökkent (a `local-demo` oldalán).
- Nincs új modul, nincs áteresztő réteg; a három modul ugyanazt rejti, mint eddig.
- **Rögzített maradék:** az NY-28-ból a `pages-api` maradt (a Local Demo motorja, 150 sor, a szerzői lánc JS-moduljait hívja); a jegyzékben marad.

## Bizonyíték

- `api-parity.test.mjs` (új), `clipboard.test.mjs`, `persistence-registry.test.mjs`, `pages-api.test.mjs`, `workbench-sources.test.mjs` (a régi modulok listája: csak `pages-api`).
- A teljes `check:all` és a böngészős sor, mindkét módban.
