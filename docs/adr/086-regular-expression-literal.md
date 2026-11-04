# ADR-086 – A reguláris kifejezés literálja tiszta kezdőérték (v49)

Állapot: **elfogadva** (2026-11-04), szabályverzió `scoped-effect-analysis-v49`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-25 tétele; a korpusz maradék réseinek legnagyobb csoportja. Kiegészíti az [ADR-019](019-pure-effect-commutation.md) tiszta kezdőértékeit.

## Kontextus

A `cov-optional-delete-regex` korpuszfixture 4 rése egy okra vezethető vissza:

```js
delete config.extra;
const pattern = /a+b/g;
```

A `delete` kódfuttató utasítás (barrier). A `const pattern = /a+b/g` kezdőértékét a generátor kódfuttatónak vagy ismeretlennek vette (`effectful-or-unknown-initializer`), ezért nem léphetett át a `delete`-en. Egy literál tömb vagy objektum, egy függvénykifejezés viszont már tiszta volt (ADR-019).

## Döntés ([statement-ordering.ts](../../src/author/statement-ordering.ts), `pure`)

A reguláris kifejezés literálja tiszta kifejezés: hatásmentes, és nem dob.

## Helyességi érv

- **Nem fut kód:** a literál kiértékelése (`RegExpCreate`) a beépített `%RegExp%` konstruktort használja. Nem a globális `RegExp` nevet keresi ki, így a program kódját sem futtatja.
- **Friss objektum:** az eredmény minden kiértékeléskor új, ezért senki más nem érheti el, csak a kötésen át.
- **Nem dob:** egy hibás minta korai `SyntaxError`, a program el sem indul.
- **A kötés olvasója** a meglévő adatfüggőséggel a deklaráció után marad. Egy záróelem, amely a kötést olvassa, a hívó utasításával együtt rendezett (a bizonyíték negatív esete).

## Mérés

- **Pillanatkép:** a 1 368 generált modellből (a katalógus négy beállításkombinációban és a kampány mind a 7 fajtája) pontosan a `cov-optional-delete-regex` négy modellje változott, a többi bájtra azonos. A kampány véletlen programjai nem tartalmaznak reguláris kifejezést, ezért a v48 kampánya erre a változásra is érvényes.
- **Korpusz:** a `cov-optional-delete-regex` rése 4 → 0, az elfogadott sorrend 0 → 4, 0 hibás elfogadás. A korpusz rése 10 → 6.

## Bizonyíték

[regex-literal.test.mjs](../../tests/regex-literal.test.mjs):
- **a literál deklarációja** a `delete`-tel felcserélhető; a fixture-ön 0 rés és 0 hibás elfogadás;
- **negatív eset:** egy nyílfüggvény olvassa a kötést, és egy `try`-ban hívják a deklaráció előtt. A deklaráció a hívás elé téve indokoltan elutasított, mert az első olvasás eredménye megváltozik.

## Tervezési review (ADR-037)

- **Tulajdonos:** az utasításrendezés `pure` osztályozója, egy új eset; interfész nem változott.
- **Design twice:** *a `RegExp` objektum belső állapotának (`lastIndex`) követése:* elvetve. A deklaráció tisztasága nem függ tőle. A kötést olvasó hívások (például a `match`) a saját sorrendjüket a meglévő szabályokkal kapják.
