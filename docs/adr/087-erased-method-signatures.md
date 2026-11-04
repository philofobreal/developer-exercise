# ADR-087 – Az egyedi nevű metódusszignatúra törlődik, szabad (v50)

Állapot: **elfogadva** (2026-11-04), szabályverzió `scoped-effect-analysis-v50`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-26 tétele; a korpusz projekciós veszteségének egyik oka. Kiegészíti az [ADR-007](007-type-members.md) típustagjait és az [ADR-013](013-local-writes-clause-chains-and-imports.md) törlődő TypeScript-alakjait.

## Kontextus

A `refl-ts-erased-and-overloads` korpuszfixture interfésze:

```ts
interface Named {
  name(): string;
  id: number;
}
```

A tagrendezés az egyedi nevű, egysoros *adatmező*-szignatúrát törlődőnek, tehát pozíciófüggetlennek vette (`PropertySignature`), a *metódus*szignatúrát (`MethodSignature`) viszont nem. A két tag sorrendje ezért forrássorrendben maradt: 1 rés és 1 projekciós veszteség. A pár nem a futás miatt volt kötött, hanem azért, mert a szabály nem ismerte fel a metódusszignatúrát.

## Döntés ([type-member-ordering.ts](../../src/author/type-member-ordering.ts))

Egy interfész vagy típusliterál metódusszignatúrája ugyanúgy törlődő tag, mint az adatmező-szignatúra. Ugyanazok a feltételek érvényesek rá:
- egyedi név;
- egyszerű módosítók;
- egy sor;
- nincs előtte megjegyzés;
- nincs dekorátora.

## Helyességi érv

- **A futás:** egy interfész és egy típusliterál nem kerül a kibocsátott JavaScriptbe, ezért a tagjai sorrendje a futásra nem hat.
- **A típusrendszer:** a tagok sorrendje a TypeScript típusrendszerében is csak az azonos nevű metódusszignatúráknál számít, mert az overload-feloldás sorrendben próbálja őket. Az egyedi név ezeket kizárja; az azonos nevű metódusszignatúrák kötöttek maradnak, ahogy eddig.
- **A hívás- és konstruktorszignatúra** (`(x): T`, `new (): T`) névtelen, ezért nem egyedi nevű tag. Overloadként kötött marad.

## Mérés

- **Pillanatkép:** a 1 368 generált modellből pontosan a `refl-ts-erased-and-overloads` négy modellje változott, a többi bájtra azonos. A kampány programjaiban nincs interfész-metódusszignatúra.
- **Korpusz:** a `refl-ts-erased-and-overloads` rése 1 → 0, a projekciós vesztesége 1 → 0. A korpusz rése 6 → 5.

## Bizonyíték

[typescript-member-ordering.test.mjs](../../tests/typescript-member-ordering.test.mjs):
- **egyedi nevű metódusszignatúrák:** egymás és egy adatmező mellett felcserélhetők;
- **azonos nevű metódusszignatúrák (overload):** a sorrendjük kötött marad.

[model-verification.test.mjs](../../tests/model-verification.test.mjs): a veszteséges példa most a `wp6-sealed-continued-callback`, mert ennek a fixture-nek nincs többé vesztesége.

## Tervezési review (ADR-037)

- **Tulajdonos:** a tagrendezés `erased` feltétele, egy új szintaxisfajta. Interfész nem változott.
- **Design twice:** *a metódusszignatúrák külön szabálya:* elvetve, mert ugyanaz a törlődés, és az overload-kizárást a meglévő egyedinév-feltétel adja.
