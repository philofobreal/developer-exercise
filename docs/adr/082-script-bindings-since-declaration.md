# ADR-082 – A szkriptszintű kötés a deklarációja óta változatlan; az átalakító operátor eredménye primitív (v46)

Állapot: **elfogadva** (2026-11-04), szabályverzió `scoped-effect-analysis-v46`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-24 tétele, amelyet az [ADR-081](081-hostile-environment.md) rosszindulatú környezete választott le a `script` JS résekről. Pontosítja az [ADR-041](041-code-free-script-reads.md) szkriptszintű olvasását.

## Kontextus

A `random-script-javascript-2` tanúban a rosszindulatú környezet (ADR-081) után két rés maradt:

```js
var v1 = 2;
record('r2', 3);
let l3 = v1 + 1;
…
var v5 = 6;
const c6 = l3 + 1;
```

A generátor a `c6` sort a `v5` után kötötte, mert a `c6 = l3 + 1` kezdőértékét kódfuttatónak vette. Ennek két oka volt:
1. **Az olvasás előtt futott kód.** Egy szkriptszintű `let`/`var` értékét a szabály csak akkor vette a deklarációéval azonosnak, ha az *olvasás előtt* egyetlen kódfuttató utasítás sem állt (ADR-041). Itt a `record` előtte áll.
2. **A kezdőérték hatása.** A kötés primitívségét a kezdőérték hatásmentességéből vezette le. A `v1 + 1` viszont egy átírt `v1` mellett kódot futtathat.

Egyik feltétel sem szükséges:
- **A deklaráció előtt futó kód** nem változtathatja meg, amit a deklaráció tárol: egy `let` akkor még nem inicializált (TDZ), egy `var` írását pedig a deklaráció saját értékadása felülírja.
- **A `+` eredménye mindig primitív,** akármit futtat a kiértékelése.

## Döntés ([statement-ordering.ts](../../src/author/statement-ordering.ts))

1. **Változatlan a deklarációja óta** (`codeFreeSince`): egy szkriptszintű, a program által soha nem írt `let`/`var` a deklarációja tárolt értékét tartja, ha a deklaráció és az olvasó utasítás között egyetlen kódfuttató szkriptszintű utasítás sem áll (csak tiszta vagy pozíciófüggetlen egység). Eddig ez az olvasás előtti összes utasításra vonatkozott.
2. **A kezdőérték eredménye** (`primitiveResult`): a kötés értéke primitív, ha a kezdőértéke:
   - literál vagy sablonliterál;
   - átalakító bináris operátor (`+`, `-`, `*`, összehasonlítás, `==`, `===`, `instanceof`, `in`, bitműveletek…), egyoperandusú operátor, `typeof`, `void` vagy `delete`;
   - `&&`/`||`/`??`, `?:`, illetve a vessző operátor, ha minden lehetséges eredményága ilyen;
   - név, amely a saját helyén primitív (változatlan).

   Eddig a kezdőértéknek hatásmentesnek is kellett lennie.

A kezdőérték hatásai a deklaráció utasításáé maradnak, és az a saját sorrendjét változatlanul tartja. A kötés olvasása hatásmentes.

## Helyességi érv

- **A szkriptlista sorrendje.** A tiszta egységek és a kódfuttató utasítások egymáshoz képesti sorrendje kötött (P2), ezért minden elfogadott sorrendben ugyanazok a kódfuttató utasítások állnak a deklaráció és az olvasás között, mint a referenciában. Ha a referenciában nincs ilyen, egyikben sincs.
- **Ki írhatja a kötést.** A deklaráció befejeződése után a kötést csak a program (kizárva: soha nem írja), vagy egy kódfuttató utasítás alatt futó külső kód írhatja (kizárva: nincs ilyen közöttük).
  - Ami a deklaráció *előtt* fut, nem számít: egy `let` akkor még nem inicializált, egy `var` deklaráció értékadása felülírja.
  - A deklaráció saját kezdőértéke alatt futó kód sem számít: egy `let` ekkor még TDZ-ben van, egy `var`-t az értékadás utána írja.
- **A tárolt érték.** Az átalakító operátorok `ToPrimitive`/`ToNumeric` után primitívet adnak, vagy dobnak. Ha dobnak, a deklaráció nem fejeződik be, a szkript megáll, és az olvasás nem fut le.
- **Az olvasó kifejezés** maga hatásmentes kell legyen (`primitive`). Egy olvasáson belüli hívás tehát nem futhat a kötés olvasása előtt.

## Mérés

*A kampány lefutása után kitöltve.*

## Bizonyíték

[script-primitive-bindings.test.mjs](../../tests/script-primitive-bindings.test.mjs), az orákulum a `strict` és a `hostile` környezetben fut:
- **nincs kód a deklaráció és az olvasás között:** a `c6` és egy globális írás (`v5`) felcserélhető, 0 rés;
- **egy `record` a deklaráció és az olvasás között:** a csere indokoltan elutasított. A rosszindulatú `record` lecseréli az `l3`-at, és a konverziója megfigyeli a `v5`-öt.
- **a program újraírja a kötést:** ilyenkor a kötés nem a deklaráció értéke, 0 hibás elfogadás.

[hostile-environment.test.mjs](../../tests/hostile-environment.test.mjs): a `script-2` tanú `c6`/`v5` cseréje most elfogadott és egyenértékű, a tanúnak 0 rése van.

## Tervezési review (ADR-037)

- **Tulajdonos:** az utasításrendezés kötésfeloldása (`binding`, `primitive`). Két belső predikátum változott, az interfész nem.
- **Design twice:**
  - *A `+` operandusainak primitívségét bizonyítani:* elvetve. A kötés olvasásának nem a kezdőérték hatásmentessége a kérdése, hanem a tárolt érték.
  - *A külső hívás utáni összes szkriptkötés elvetése:* ez volt a régi szabály. Elvetve, mert a deklaráció előtti kód a tárolt értéket nem érheti el.
