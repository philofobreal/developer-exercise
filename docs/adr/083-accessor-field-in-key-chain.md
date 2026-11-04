# ADR-083 – Az `accessor` mező az azonos nevű definíciók láncában (v47)

Állapot: **elfogadva** (2026-11-04), szabályverzió `scoped-effect-analysis-v47`. A [nyitott tételek jegyzékének](../nyitott-tetelek.md) NY-22 tételének utolsó tanúja. Kiegészíti az [ADR-068](068-binding-context-member-phases-early-exit.md) azonos kulcsú definícióit és az [ADR-078](078-member-definitions-and-accessor-reads.md) getter–setter összevonását.

## Kontextus

Az NY-22 utolsó tanúja (`random-inherit-typescript-7`) ugyanazon a néven három tagot tartalmaz az ősben:

```ts
class Base7 {
  get f0(): unknown { … }
  set f0(value: unknown) { … }
  get t2(): unknown { … }
  accessor f0 = 3;
}
```

Az azonos kulcsú definíciók lánca (ADR-068) csak metódust és accessort fogadott be, `accessor` mezőt nem. Ezért egyik tag sem lett lánctag: mindhárom kiértékelési fázis nélküli, besorolatlan tag maradt (`unclassified-member`), és minden más taghoz kötött.

Környezetváltozatokkal: TypeScriptben 2 rés, `classFields: 'define'` mellett 6.

## Döntés ([type-member-ordering.ts](../../src/author/type-member-ordering.ts))

1. **Az `accessor` mező lánctag.** Egy dekorátor nélküli, nem `abstract`/`declare`, ismert nevű `accessor` mező az azonos nevű definíciók láncának tagja.
   - Az osztály definíciójakor a metódusok között, tagsorrendben telepíti a get/set párját a prototípuson (`static` esetén a konstruktoron), és felülírja, amit egy korábbi azonos kulcsú definíció hagyott.
   - Ha egy kulcs minden tagja ilyen definíció (metódus, accessor vagy `accessor` mező), a kulcs láncot alkot.
2. **A mezőrész változatlan.** Az `accessor` mező kezdőértéke a mezők sorában fut, és a privát tárolót tölti. A mező ezért a kiértékelési fázisában kötött marad. Csak a definíciós szerepe kerül a láncba.
3. **A lánc sorrendje:**
   - a getter és a setter egymás mellett felcserélhető (ADR-078);
   - az `accessor` mező mindkettő után áll, mert felülírja őket;
   - más kulcsú definíciókhoz képest a lánc szabad.

## Helyességi érv

- **A definíció ideje.** A ClassDefinitionEvaluation a tagokat sorrendben értékeli ki. Az `accessor` mező ekkor definiálja a get/set párját, ugyanúgy, mint egy metódus vagy egy accessor a saját tulajdonságát.
- **Mi dönt.** Egy kulcs végső tulajdonsága attól függ, melyik definíció áll utoljára. A lánc ezt a sorrendet tartja meg, egyetlen kivétellel: az egymás melletti getter és setter összeolvad, így egymáshoz képest felcserélhetők (ADR-078).
- **A mezőrész:** az `accessor` mező privát tárolója a mezők sorában töltődik, és ezt a mezőfázis kötése megtartja.
- **A kulcssorrend** reflexiója továbbra is a külön kulcslánc dolga (ADR-010/020).

## Ami marad

`classFields: 'define'` mellett a tanúban 4 rés marad: az `accessor f0` a getter és a setter elé kerül.
- **Miért nem látszik:** a leszármazott saját `f0` mezője minden példányon elfedi a prototípus `f0` tulajdonságát, és `Base7`-et a program nem példányosítja, ezért a prototípus végállapota nem látszik.
- **Miért nem oldjuk fel:** ehhez programszintű elérhetőségi elemzés kellene egyetlen ritka mintáért.
- **Régi mezőmódban** ugyanez a csere valóban máshogy fut, mert az értékadás az utolsó definíció setterét hívja.

## Mérés

**Kampány, 12 mag, v46 → v47:**
- **`strict` és `hostile` környezet** (a `function`, `class`, `param`, `script`, `inherit` és `object` fajta): az `inherit` TS-ben 514 → 517 elfogadott sorrend, a rés 2 → 0. A többi csoport változatlan, 0 hibás elfogadás.
- **Környezetváltozatokkal** (`strict`, `es2015`, `sloppy`; `inherit` és `class`):
  - mindkét mód: az `inherit` TS rése 0;
  - `classFields: 'define'`: 4 rés (lásd: Ami marad);
  - 0 hibás elfogadás mindkét módban.
- A `flow` fajtát a v48 kampánya méri ([ADR-084](084-loop-first-iteration.md)), amely ezt a változást is tartalmazza.

## Bizonyíték

[member-footprints.test.mjs](../../tests/member-footprints.test.mjs) (ADR-083 eset), az orákulum mindkét mezőmódban és az ES2015-ös kibocsátásban:
- **a getter és a setter** az `accessor` mező mellett is felcserélhető;
- **egy más kulcsú metódus** szabad a lánchoz képest;
- **az `accessor` mező** a lánc elé téve indokoltan elutasított: `[[Set]]` módban a leszármazott értékadása ekkor a rögzítő settert futtatja;
- 0 hibás elfogadás.

## Tervezési review (ADR-037)

- **Tulajdonos:** a tagrendezés. Az `autoField` predikátum a láncba engedést dönti el, a lánc bejárása a tagok forrássorrendjén halad (eddig csak a szabad definíciókon). Interfész nem változott.
- **Design twice:**
  - *Az `accessor` mező kettébontása két egységre (definíció és kezdőérték):* elvetve. Egy sor egy egység marad, és a két szerepet a lánc, illetve a mezőfázis külön köti.
  - *A prototípus-elfedés elemzése a `define` mód maradékára:* elvetve (lásd: Ami marad).
