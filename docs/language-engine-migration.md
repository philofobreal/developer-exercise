# Language-Agnostic Exercise Engine – migrációs terv és állapot

Alap: main `96da72e8241a2c99e13053dfcfd9797e2bdc3060`; feature ág: `codex/language-agnostic-foundations`. A döntés indoklása és elrejtett tudás: [ADR-003](adr/003-language-ir-and-codeline-v3.md). Az eddigi governance és üzleti invariánsok kötelező elfogadási feltételek.

| Task | Függőség | Eredmény és elfogadási feltétel | Állapot |
| --- | --- | --- | --- |
| T01 – baseline és döntések | – | Aktuális main, AGENTS, ADR-ek és termékszerződés áttekintve; meglévő tesztek változatlanok | kész |
| T02 – IR v1 / CodeLine v3 | T01 | Strict TS és JSON Schema; source span / unit / container / binding scope külön; hibás verzió és kapcsolatok elutasítása | kész |
| T03 – közös strukturális fordító | T02 | Atomi többfizikaisoros unit, rendezett virtuális határok, dependency/fixed/profile; ugyanaz a bounded bijekciós validátor | kész |
| T04 – v2 kompatibilitás | T02, T03 | Importált v2 szabályok változatlan projekciója; fixed és alternatív profilok; permutációs összehasonlítás | kész |
| T05 – typed plugin author engine | T03, T04 | Explicit regiszter, verzió és capability ellenőrzés; JS/TS port bridge; author audit és adapter contract tesztek | kész |
| T06 – render és indent port | T02, T03 | Unitonként fizikai sorok, nincs gráfszivárgás; semantic indent exact; ismeretlen nyelvhez nincs JS formázás | kész |
| T07 – kapuk és dokumentáció | T01–T06 | Schema generálás, strict build, modulhatár-negatív tesztek, Node/Pages regressziók és CI; pontos korlátlista | kész |
| P01 – Python parser kiválasztása | T01–T07 | Verziózott grammar, Unicode/offset mapping, diagnosztika és author erőforráskorlát | nyitott, következő munka |
| P02 – Python native IR adapter | P01 | INDENT/DEDENT, multiline statement/literal, dekorátor, suite vs binding scope; biztonságos dependency policy | nyitott, nincs implementálva |
| P03 – Python termékintegráció | P02 | UI nyelvválasztó, szerver/Pages capability, unit-drag/persistence v3, formatter és browser mátrix | nyitott, nincs implementálva |

## Végrehajtás és kompatibilitás

A meglévő v2 séma és publikus API nem bővül Python értékkel. Az új API opt-in: adapter → Language IR → CodeLine v3 → compile → validateSubmission. Importált v2 modell projekciója nem hív parsert vagy generátort, ezért a kézzel megadott DAG/profil/fixed szabályok nem vesznek el. A meglévő szerver és statikus demó szerzői folyamata változatlan marad. A bridge az új engine-ben is a régi auditált JS/TS eredményt használja.

Nem állítjuk, hogy a meglévő drag/persistence már többfizikaisoros v3 unitokat kezel. A render port ezek helyes későbbi bevezetését készíti elő; a jelenlegi UI nem kap v3 modellt. A parser és a nyelvi formatter csak szerzői oldalon fut. A tanuló string[] tartalmát a közös validátor ellenőrzi, adapterhívás nélkül.

## Python handoff

A következő implementáló explicit adaptert regisztrál az author engine-ben. A parser natív eredményét a JSON Schema szerinti IR-re fordítja. A Python suite syntactic container; a module/function/class külön binding scope. Minden jelentős behúzás és multiline literal payload exact. A logikai utasítás folytatósorai egy unitba kerülnek. Virtuális nyitás/zárás before/after esemény, nem mesterséges forrássor; üres suite-t nem szabad kitalálni. Először konzervatív sorrendlánc szükséges; függőségek lazítása csak bizonyított részhalmazban.

A tesztekben szereplő kézzel megadott, whitespace-érzékeny IR kizárólag a közös szerződést és validátort teszteli: nem Python parser, nem regisztrált Python adapter és nem szemantikai bizonyíték. Az összes T-task lezárása után indulhat P01, a P-taskok nem részei a kész alapnak.

## Ellenőrzési bizonyíték

Helyi ellenőrzés: 2026-10-24, Windows, Node 25.2.1, TypeScript 5.8.3, Python 3.13, rögzített Playwright 1.64.1 és headless Chromium/Chrome. A CI Node 22-t használ; annak távoli állapota külön GitHub-ellenőrzés.

- `npm run check:all`: strict core/author/workbench/governance build, összes Node-regresszió, architektúrakapu, négy referenciafeladat author auditja és UTF-8/link ellenőrzés. A végső futás eredménye a PR-ben is rögzítve.
- `npm run test:browser:all`: sikeres offline és valódi Node HTTP alkalmazás, 32 HTTP/Pages mátrixeset, 36 drag és 21 workbench eset. Az új `test:browser:engine` külön is sikeresen futott: v3 JS/TS bridge, natív IR virtuális suite, exact whitespace, standalone Schema és modulbetöltés valós Pages-alútvonalon.
- Új Node-szerződéstesztek: a suite összes 720 fizikai sorpermutációja független megengedettségi halmazzal, atomi unitok, virtuális EOF-határok és közös close/open sor, több kötelező előzmény, fixed átlépés, OR-profilok közös budgettel, multiplicitás, Schema/runtime egyezés, source span, async plugin és capability hibák. A teljes 436 soros TS fixture áthalad az új bridge-en is; a régi 31 metódusteszt megmarad.

A sandbox a localhost-kapcsolatokat EACCES hibával blokkolta, ezért a HTTP- és böngészős tesztek az engedélyezett tesztfuttatási környezetben futottak; teszt kihagyására vagy gyengítésére nem került sor. A Playwright a repo ignorált `.venv` könyvtárába került. Nincs runtime függőség- vagy lockfile-módosítás.

A CI az új teszteket a meglévő check/all-browser kapukban futtatja; külön `git diff --exit-code` ellenőrzi a forrásból generált dist/browser/Schema kimenetet. A verify → tested Pages artifact → deploy lánc és jogosultságai változatlanok. A feature PR nem main-merge és nem deployment.

## Átadás

T01–T07 kész. A [szerződés és használati példa](language-engine-contract.md) az adapter implementálásának belépője. P01–P03 nyitott, Python parser/adapter nincs a kész elemek közé sorolva. Az új API opt-in; a régi UI és session v2 formátuma szándékosan megmarad. A szerkezetileg elfogadott programok szemantikai ekvivalenciája továbbra is szerzői felelősség, nem a modell automatikus állítása.

P01–P03 részletes folytatása: [Python-adapter és termékintegráció terve](python-adapter-plan.md), PY-01–PY-11 taskokkal, platform-/parser-döntéssel és kiadási kapukkal. Ez terv, nem kész Python-implementáció.
