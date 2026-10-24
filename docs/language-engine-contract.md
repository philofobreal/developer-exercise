# Language IR v1 és CodeLine v3 – implementációs szerződés

Források: [Language IR Schema](language-ir.schema.json), [CodeLine v3 Schema](codeline-v3.schema.json), [strict TypeScript típusok](../src/core/language-ir.ts). A [v2 Schema](schema.json) változatlan. A sémák alakot és méretet, a fordító kapcsolatokat, DAG-ot, hierarchiát, unitpartíciót, forráshelyeket és referenciasorrendet ellenőriz. A pinned Ajv mindháromból ugyanabba a browser-safe standalone checkerbe generál; nincs külön kézi shape-validator. Az új kód strict TS, a dist buildtermék.

## Adatmodell

| Fogalom | Jelentés |
| --- | --- |
| `lines[].id` | Egy fizikai referenciaelőfordulás stabil ID-ja; azonos szöveg továbbra is külön előfordulás |
| `sourceSpan` | LF forrásra mutató félignyílt UTF-16 offset, 1-alapú sor, 0-alapú oszlop; nem aktuális megoldáspozíció vagy UTF-8 byteoffset |
| `units[].lineIds` | Egyben mozgatott, egymás melletti és sorrendtartó sorok; egy unit lehet több fizikai sor |
| `containerId` | Szintaktikai tartalmazó; nem automatikusan binding scope |
| `bindingScopeId` | Külön szerzői névkötési hierarchia; nem runtime lookup |
| `boundaries` | Unithatáron before/after fázisban, tömbsorrendben feldolgozott open/close események; nem beküldött kódsor |
| `dependencies`, `edges` | A before unit összes sora megelőzi az after unit összes sorát; nem szomszédsági szabály |
| `fixed` | A teljes unit eredeti fizikai sorhelyei rögzítettek; más unit átléphet előtte/mögötte, ha egyéb szabály engedi |
| `profiles` | OR a profilok között; közös szabályok és a kiválasztott profil élei AND |
| `indentPolicy` | Presentation: engedélyezett ASCII indent projekció; semantic: exact és preserve. A tabWidth nem forrásnormalizálás |

A referenciában a unitok pontosan partícionálják a sorokat, ugyanabban a sorrendben. Minden konténernek egy nyitó és egy záró eseménye van. A validátor before eseményeket dolgoz fel, ellenőrzi a sor containerId-ját, majd after eseményeket dolgoz fel. Több bezárás ugyanazon anchoron belülről kifelé történik; közös `} else {` sor előtt zárás, utána nyitás történhet. A virtuális jelző eredetadat: mindkét esetben ugyanaz a struktúraellenőrzés, szövegből kitalált lexikai jelentés nélkül.

A span teljes fizikai sorra mutat. Kizárólag a legacy bridge-ben megengedett a régi generátor utolsó `trimEnd()` műveletével kihagyott forrásvégi whitespace suffix: a span ilyenkor a ténylegesen átvett prefixre mutat. Az eredeti forrás megmarad, a grading-tartalom változatlan. Ha v2 importhoz nincs eredeti forrás, `analysis.sourceOrigin = reconstructed-v2`; a régi opcionális sourceLine adatból nem gyártunk hiteles forráspozíciót.

A binding scope hierarchia integritását a mag ellenőrzi; a nyelvileg helyes kiosztás az adapter felelőssége. A JS/TS bridge csak a v2-ben megtartott function ownership-t vetíti ide, a statement-ordering és binding-hint döntéseit `legacyAuthoring` alatt is megőrzi. Nem állít teljes JS/TS binding IR-t. A Python adapter majd külön dönt a module/class/function, closure/nonlocal/global és comprehension esetekről.

## Belépési pontok

- `compileVersionedExercise(v2 | v3)`: explicit dispatch; ismeretlen verzió elutasítva.
- `upgradeCodeLineExerciseV2(model, originalSource?)`: szabályprojekció parser/regenerálás nélkül. Nincs automatikus, veszteséges v3 → v2 downgrade.
- `compileCodeLineExerciseV3(model)`: Schema + integritás + referenciasorrend, majd a közös `CompiledRules`. Limitnél `indeterminate`: a referencia nem publikálható, de nem bizonyítottan hibás.
- `validateSubmission(compiled, {exerciseId, revision, lines}, options)`: változatlan tartalmi protokoll, adapter/parser/futtatás nélkül. Unit-szomszédság a meglévő DFS jelöltrendelésében, scope ugyanabban az assigned-prefix ellenőrzésben. Egy közös budget minden profilra.
- `prepareRenderPlan(model)`: gráfmentes fizikai sor-/unit-adatok. Ez adat, a renderer továbbra is HTML-escape-el. `projectDisplayRows(unit, policy, display)` a teljes javaslatot eldobja, ha sorhatár, payload vagy exact whitespace sérül. A vizuális eredmény nem grading input.

Az IR és a v3 modell nem tanulói hitelesítési objektum. A belépő author-time könyvtári API, új HTTP endpoint nélkül. A catalog kizárólag saját v2 referenciájából értékel; a preview és Local Demo státusz változatlan.

## JS/TS bridge használata

Build után Node-ban a composition root zárja a parser-infrastruktúrát a portokba:

```js
import ts from 'typescript';
import {LanguageEngine, createLegacyJSTSBridge} from './dist/author/engine.js';
import {generateCodeLineExercise} from './src/author/generator.mjs';
import {auditReference} from './src/author/audit.mjs';
import {getLanguageAdapter} from './src/author/languages.mjs';

const engine = new LanguageEngine();
const ports = {
  generate: input => generateCodeLineExercise(input, ts),
  audit: model => auditReference(model, ts),
  format: (source, language) => getLanguageAdapter(language).format(source, ts)
};
for (const language of ['javascript', 'typescript']) {
  engine.register(createLegacyJSTSBridge(language, ports));
}
const result = await engine.generate('javascript', {source: 'const a = 1;'});
// result.model: v3; result.compiled: közös validátor; result.renderPlan: display port
```

A plugin `contractVersion: 1`, egyedi `id`, explicit `adapterVersion`, capability és indent policy mezőket, valamint szinkron/aszinkron `analyze` műveletet ad. Opcionális szerzői formázás csak explicit capability mellett engedélyezett; a formázott forrás is admissionön megy át. Az eredmény az adott nyelv és forrás IR-je; AST és parserkönyvtár nincs a publikus felületen. A regiszter engine-példányonként izolált. Az adapter megbízható alkalmazáskód; a deklaráció és capability nem sandbox vagy szemantikai bizonyíték.

Pages alatt a compiled engine `/dist/author/engine.js`, a régi modulok `/author/` alatt vannak; a modulgráfot valódi Chromium és subpath HTTP teszt ellenőrzi. A natív fixture nyelve `indent-fixture`; `python` adapter és parser nincs implementálva.

## Kész és nyitott

Az alap tartalmazza a szerződéseket, fordítást, regisztert, JS/TS bridge-et és render portot. A jelenlegi UI, unit-drag, clipboard és session persistence v2, változatlan formátummal. A Python parser kiválasztása, natív IR-emissziója, byte/code-point → UTF-16 leképezése, formattere, függőségi részhalmaza és termék-integrációja következő feladat. Taskfüggőségek és bizonyítékok: [migrációs terv](language-engine-migration.md).
