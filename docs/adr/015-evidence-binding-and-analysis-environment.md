# ADR-015 – A bizonyítékok kötése és az elemzési környezet

Állapot: implementálva (a Semantic Ordering Precision epic C2 munkacsomagja, a kritikai felülvizsgálat 4.4 és 4.6 pontja alapján). A validátor, a sorrendi szabályok és a policy-címke (`scoped-effect-analysis-v9`) változatlan.

## Kontextus

Az [ADR-014](014-constraint-provenance.md) minden élhez okot rögzít, de az ok nem volt ahhoz kötve, amiből levezették. Ennek következményei:

- **JSON-szerkesztés:** ha a szerző a JSON-szerkesztőben átír egy kódsort, átszámoz egy azonosítót vagy blokkot változtat, a régi okok változatlanul megmaradnak, és már nem igazak.
- **D1-kockázat:** a szabályszerkesztés (D1) ezekre az okokra alapozza, hogy egy él eltávolítása kockázatos-e. Elavult okkal egy bizonyított él megerősítés nélkül törölhetővé válna.
- **Környezet:** az elemzés feltevései (TypeScript-verzió, import-emit, script vagy modul, osztálymezőmód) nem jelentek meg a modellben. Az `importEmit` csak a generálás bemenete volt.

## Döntés

### 1. Evidence a modellben

Új, additív séma- és típusmező: `authoring.evidence`.

| Mező | Jelentés |
| --- | --- |
| `sourceDigest` | 16 hexa jegyű, 64 bites digest a sorok rendezett `[id, code, scopeId]` hármasain |
| `analyzer` | a proveniencát előállító szabályverzió (a `dependencyPolicy` enumja, közös `$defs`) |
| `environment.typescript` | az elemző TypeScript-verziója |
| `environment.importEmit` | TypeScriptnél a feltételezett import-emit (`verbatim` alapértelmezés, ismeretlen buildnél is) |
| `environment.sourceKind` | `module` vagy `script`, ahogy a globálissorrend-szabály eldöntötte |
| `environment.classFields` | `either`: az eredmény mindkét osztálymezőmódban érvényes (ADR-012) |

**A digest hatóköre:** csak azt fedi le, amire a proveniencia hivatkozik (azonosító, szöveg, scope).

- Ami nem változtatja a proveniencia jelentését, az nincs benne: a `fixed`, a függőségek, a normalizálás.
- Ezért egy szabályművelet vagy egy fixed-beállítás nem oldja a kötést.

**Kriptográfiai erő:** a digest nem kriptográfiai pecsét. Eltérést jelez, hamisítást nem zár ki. Ez szándékos, mert a proveniencia soha nem ad bizalmat:

- a validáció nem olvassa;
- a modellminősítés (V1) újra levezeti, nem elhiszi.

### 2. Egyetlen definíció

A digest algoritmusát csak a core definiálja ([evidence.ts](../../src/core/evidence.ts): `codeLineDigest`, `evidenceStatus`). A projekció explicit, architektúrakapuval engedélyezett bekötéssel hívja: `src/author/code-line-projection.ts -> dist/index.js`, ugyanúgy, ahogy az `engine.ts` is használja a core-t. Más típusos szerzői modul továbbra is csak típust importálhat a core-ból (teszt).

**Ki mit rögzít:**

- az adapter új, opcionális metódusa (`environment`, JS/TS: `jsTsEnvironment`) adja a környezetet;
- a projekció a digestet;
- a generátor a szabályverziót.

### 3. Kötött és kötetlen proveniencia

Az `explainConstraints` csak akkor használja a provenienciát, ha `evidenceStatus(model) === 'current'`. Minden más esetben a proveniencia `unbound`, és minden függőség, illetve él oka `unknown` / `unbound-provenance` (osztálya `legacy`). Ide tartozik:

- a hiányzó evidence;
- az átírt sor, az átszámozott azonosító, a megváltozott scope.

A blokktagság továbbra is `hard`, mert az a modell szerkezetéből jön.

### 4. Újrakötés refreshkor

A „Sorfüggőségek újraszámítása” az újragenerált okokat az eredeti sorazonosítókra képezi (ADR-014). Ezután az evidence-et az eredeti sorokra számolja újra, és az új elemző környezetét veszi át. Egy kézzel átírt modell így egyetlen explicit művelettel kap újra érvényes provenienciát.

## Következmények

- **Proveniencia nélküli, illetve C1-korabeli modellek:** az evidence nélküli modellek (C1 előttiek és a C1 utáni, de C2 előtti exportok) magyarázata `legacy`, illetve `unbound`. A refresh mindkettőt helyreállítja.
- **Mintamodellek:** a TS-mintamodellek az elemző TypeScript-verzióját is rögzítik, ezért egy TypeScript-frissítés a mintákat is újragenerálja. Ez szándékos: a bizonyíték a környezetéhez tartozik.
- **A szerzői felület környezete:** a környezet szerzői megadása (`importEmit`-választó) a D2 része.
- **Az elemző aktualitása:** a V1 feladata, hogy jelezze, ha az `analyzer` régebbi a jelenlegi generátornál.
- **Korlát:** a környezet csak a ténylegesen feltételezett beállításokat rögzíti. A projekt valódi `tsconfig`-ját, a bundlert és a modulbetöltőt nem ismeri; ezek eltérését a konzervatív szabályok fedik (A5 feltevés, formális szerződés). A referencia projektkontextusú auditja az R1 feladata.
