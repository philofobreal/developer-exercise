# ADR-041 – Szkriptszintű globális kódmentes olvasása (v20)

Állapot: **elfogadva** (2026-10-30), szabályverzió `scoped-effect-analysis-v20`. A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 4. fázisában a mért okok sorrendjében következő tétel.

## Kontextus

**A mért fő ok:** a v19 utáni generatív mérésben (12 mag) a JS-szkriptek indokolatlan elutasításainak szinte mindegyike (58/58) `effectful-or-unknown-initializer`. A minta:

```js
var v1 = 2;
let l3 = 4;
let l4 = v1 + 1;
```

**Miért kötött ma:**
- a `v1 + 1` csak akkor tiszta, ha `v1` olvasása primitív értéket ad;
- a sehol nem írt `let`/`var` a függvénytörzsben konstansként viselkedik;
- a szkriptszintű viszont nem: más kód a globális hatókörön át írhatja (`globalThis.v1 = …`, másik szkript, ismeretlen hívás);
- így `l4` barrier, és a független `l3`-mal is kötött.

## Döntés

**A szabály:** egy szkriptszintű `var`/`let` olvasása primitív, ha mindegyik feltétel teljesül:
- a kötés egyszer deklarált, primitív kezdőértékű, és név szerint sehol nem írt (ahogy a függvénytörzsben is);
- az olvasás maga is a szkript szintjén történik (nem függvény-, metódus- vagy osztálytörzsben);
- a referencia-sorrendben az olvasó szkriptszintű utasítás előtt csak tiszta (`pure`) vagy pozíciófüggetlen egység áll. Ilyen például a hoistolt függvény és a kódot nem futtató osztály.

Minden más eset változatlan.

## Helyességi érv

- **Az olvasott érték a kezdőérték:**
  - szkriptszinten egy tiszta egység és egy barrier sorrendje mindig kötött (P2; az ADR-019 kommutációja csak függvényszintű listára vonatkozik);
  - ha a referenciában az olvasó előtt nincs kódot futtató utasítás, akkor egyetlen elfogadott sorrendben sincs;
  - az olvasásig így semmilyen kód nem futott, sem név szerint, sem a globális objektumon át: a kötés értéke a primitív kezdőérték;
  - a kezdőérték sorrendjét a deklaráció sorára mutató bemeneti él (`binding-input`) őrzi.
- **Primitív érték olvasása kódot nem futtat:** a koerciós operátorok primitíveken nem hívnak felhasználói kódot, ezért két ilyen olvasás egymáshoz képest szabad.
- **Környezeti feltevés:** a program saját globális neveit a környezet előre nem definiálja accessorként. Ezt a szkriptszintű `var`-ok kulcssorrend-szabálya (ADR-010) is feltételezi.

## Bizonyítékok

- **Tesztek:** [script-reads.test.mjs](../../tests/script-reads.test.mjs), mindegyik az orákulummal ellenőrizve.
  - szabad: sehol nem írt `var` és `let`, ilyen olvasások lánca, előtte hoistolt függvény és kódmentes osztály, utána ismeretlen hívás;
  - kötött: előtte ismeretlen hívás, globális objektumon át írás (`valueOf`-fal, az orákulum szerint megfigyelhető), statikus blokkos osztály, név szerint írt `var`, kétszer deklarált `var`, függvénytörzsből való olvasás.
- **Mérés:**
  - a 12 magos mérésben a JS-szkriptek indokolatlan elutasítási aránya 21,4%-ról 0,37%-ra esett, hibás elfogadás nincs;
  - a gyors generatív baselineban a JS-szkriptek aránya 28,4%-ról 2,4%-ra esett, a többi csoport változatlan.

## Korlátok

- **Egy kódot futtató utasítás után** minden olvasás konzervatív marad, akkor is, ha az a kód bizonyíthatóan nem írja a kötést. Ehhez hatásösszegzés kell (a terv 3. tétele).
- **Az expando-deklaráció:** a JS-elemző a `globalThis.v = …` értékadást a `v` második deklarációjának tekinti. Ilyenkor a `var v` nem egyedi, és konzervatív marad.

## Tervezési megjegyzés

- **Időbeli csatolás:** a feltétel a szkriptlista már összegzett egységeit használja (`scriptUnits`), amelyek a forrássorrendben töltődnek.
- **Miért elfogadható:** a csatolás a `statement-ordering` elemzésén belül marad, a hívók nem látják. Ha egy egység még nincs összegezve, a feltétel konzervatívan hamis. Ugyanez a sorrend adja a forrássorrendi összegzést is, ezért külön állapot nem kell.
