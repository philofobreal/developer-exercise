# ADR-049 – Az AI governance teljessé tétele

Állapot: **elfogadva** (2026-10-31). A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) G fázisa. Kiegészíti az [ADR-001](001-typescript-workbench-and-boundaries.md) governance-irányát és az [ADR-037](037-standing-design-review.md) tervezési governance-ét.

## Kontextus

Az [ai-governance.md](../ai-governance.md) magát részlegesnek nevezte. A G fázis hat szempontja közül csak a tervezési governance (ADR-037) volt teljes: tulajdonossal, kikényszerítéssel és bizonyítékkal.

| Szempont | Hiány |
| --- | --- |
| AI-hozzájárulás eredete | a commitok `Co-Authored-By` sort kaptak, de ez sehol nem volt szabály |
| Review-protokoll | a tervezési menet le volt írva, a helyességi menet és a bizonyítékigény nem |
| Jóváhagyási pontok | az AGENTS.md-ben és a munkamenet-emlékekben szétszórva |
| Külső tartalom adatként | szabály volt, tulajdonos és bizonyíték nélkül |
| Kockázati besorolás | nem létezett |
| Bizonyítékok megőrzése | gyakorlat volt (tesztek, baseline-ok, ADR), szabály nem |

Egy gépi rés is előkerült. A dokumentum-kapu (`verify-docs`) az ADR-mappát nem ellenőrizte. A szerződés szabályverzió-táblájában pedig két verzió (v6, v7) közös sorban állt, ami gépileg nem volt egyértelmű.

## Döntés

1. **Elemtábla:** az ai-governance.md új táblája (`Governance-elemek`) minden elemhez megadja a tulajdonost, a kikényszerítést (gépi vagy review) és a bizonyítékot. A tábla szerkezetét teszt ellenőrzi.
2. **Kockázati osztályok:**
   - mag;
   - szerzői elemzés;
   - orákulum és mérés;
   - megjelenítés;
   - dokumentáció és eszközök.

   Mindegyikhez kötelező bizonyíték tartozik. A szerzői elemzés és az orákulum változása szabályverzió- vagy szerződésváltozás, ADR-rel és azonos mércéjű összevetéssel.
3. **Jóváhagyási pontok:** az AGENTS.md egy helyen sorolja fel őket. Ezek: push (Pages-telepítés), távoli művelet, deploy, hitelesítő adatok, forráskód kiküldése, runtime AI, destruktív git-művelet, más munkájának felülírása, régi feladatok függőségeinek átírása, pedagógiai döntés. A szabályok nem vezetnek be új, akadályozó jóváhagyást a már engedélyezett helyi munkára.
4. **Eredet:** az AI-közreműködéssel készült commit `Co-Authored-By:` sorban nevezi meg a modellt. Ezt az ügynöki utasítás és a review kényszeríti ki. A git-előzmény gépi ellenőrzése a humán commitok miatt nem lenne megbízható, ezért ez nem gépi kapu.
5. **Gépi kontrollok** ([governance.test.mjs](../../tests/governance.test.mjs), [verify-docs](../../scripts/verify-docs.mjs)):
   - minden ADR egyszer számozott, a címe a számát viseli, és van állapotsora;
   - a szabályverzió-címkék egyeznek a sémában, a TS-típusban, a szerződésben (saját sor, létező ADR-rel) és a generátorban;
   - az AGENTS.md hivatkozik a governance-dokumentumokra, és tartalmazza a push- és az eredetszabályt;
   - a dokumentum-kapu az ADR-eket is ellenőrzi (UTF-8, NUL, helyi linkek).
6. **A szerződéstábla:** a v6 és a v7 külön sort kapott.

## Következmények

- Az ai-governance.md többé nem „részleges”. Ami nem gépi, azt kimondottan review-kontrollnak nevezi: tervezési minőség, pedagógiai döntések, jóváhagyások, eredet.
- **Új szabályverzió-címkénél:** a gépi kapu a sémát, a típust, a szerződés sorát és az ADR-t együtt követeli meg, így egy hiányzó dokumentáció a `check`-en bukik.

## Bizonyítékok

- A governance-teszt (`governance.test.mjs`) és a kibővített dokumentum-kapu a `npm run check:all` része.
- A mostani állapotra: 49 ADR, 22 szabályverzió-címke (v4–v25), mind konzisztens.
