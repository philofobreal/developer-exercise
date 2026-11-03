# ADR-058 – Futásidejű elérési tanú az orákulumban

Állapot: **elfogadva** (2026-11-03). Orákulum és mérés, az 5. fázis része ([megbízhatósági terv](../megbizhatosagi-audit-terv.md)). Szabályverzió nem változik, a generátor és a validátor változatlan.

## Kontextus

Az ADR-052 és -053 óta a generátor név- és szivárgáselemzéssel dönti el, hogy egy program kulcsot listáz, reflexiót használ, vagy olvasást módosító horgot telepít-e akkor is, ha a nevet nem írja ki (`Object['ke' + 'ys']`). Az orákulum ugyanezekhez a kérdésekhez a generátor szöveges mintáinak másolatát használta (`enumerationNames`, `reflectionNames`, `contractHooks`), tehát nem volt független.

**Bizonyított következmény:** egy program a ki nem írt nevű `keys` eredménye szerint új objektumba másolja a kulcsokat. Az orákulum nem látott kulcslistázást, ezért az eredmény kulcsait rendezve hasonlította össze, és a két kulcsírás cseréjét egyenértékűnek mondta, holott a kimenet `{a, b}` helyett `{b, a}`.
- Itt a generátor helyesen utasított el, és a mérés ezt tévesen résnek számolta.
- Fordított helyzetben ugyanez a vakfolt egy hibás elfogadást is eltakarna.

## Döntés

1. **Elérési tanú.** Az orákulum a futtatás előtt a következő API-kat átlátszó Proxyra cseréli. A Proxy a nevet, a hosszt, a prototípust és a statikus tagokat változatlanul továbbítja, és rögzíti, mit hívott a program.
   - **Kulcslistázás:** `Object.keys`, `values`, `entries`, `assign`, `JSON.stringify`, `structuredClone`.
   - **Reflexió:** `getOwnPropertyNames`, `getOwnPropertyDescriptors`, `getOwnPropertySymbols`, minden `Reflect`-metódus, a `Function` és a többi függvénykonstruktor (a `constructor.constructor` útja is), valamint az `eval`, ha a szöveg nem nevezi meg.
   - **Horog:** `defineProperty`, `defineProperties`, `setPrototypeOf`, `Proxy`, a második argumentummal hívott `Object.create`, a `__defineGetter__` és `__defineSetter__`, a `__proto__` beállítása, és a `Symbol` jól ismert tagjainak olvasása.
2. **Csak a program saját sora számít.** A hívó a hívási lánc első, az előtag utáni kerete. Ha a próbahívás sorában van, az a külső megfigyelő (ADR-020, ADR-029), és nem a program része. A harness pillanatképe és szerializálása alatt a tanú ki van kapcsolva.
3. **A tények a szöveg és a tanú uniója:**
   - **rendezett:** szöveges reflexió, vagy elért reflexió;
   - **felsorolt:** az előbbi, szöveges kulcslistázás, vagy elért kulcslistázás;
   - **bemenet:** elért horog mellett `any`, akkor is, ha a fixture `valid`-ot kér.

   Ha a referencia futása többet ér el, mint amit a szöveg mutat, az orákulum a referenciát az erősebb tényekkel elemzi és futtatja újra.
4. **Csak a jelöltnél elért hívás:** ha egy jelölt sorrend futása olyat ér el, amit a tények nem fednek, az ítéletet egy minden tényt feltételező orákulum hozza meg. A tanú csak szigorít, sosem lazít.

## Miért független

A tanú a futó program tényleges hívásait figyeli. Nem ismeri a generátor névösszevonását, szivárgáselemzését, visszatérés-követését és névlistáit, és nem is hívja őket. A szöveges szabály megmaradt: a `for…in` és a spread nem hívás, ezeket csak a szöveg mutatja.

## Bizonyíték

- **Új tesztek** ([reach-witness.test.mjs](../../tests/reach-witness.test.mjs)):
  - a fenti másolóprogram: elérés látszik, a csere eltérő, a generátor elutasít, hibás elfogadás nincs;
  - ki nem írt reflexió és `constructor.constructor`;
  - ki nem írt `defineProperty` `valid` kéréssel: a tény `any`, és a sorrend kötött;
  - a próbahívás saját kulcslistázása nem számít;
  - a tanú átlátszó: közvetlen `eval`, `Function` azonossága, `Object.keys.name`, `Proxy`, `Array` leszármazott, `Symbol`;
  - a csak jelöltnél elért hívás nem marad rejtve.
- **Korpusz:** mind a 109 fixture rögzített számai változatlanok.
  - A korpuszban minden elért API a szövegben is szerepel, ezért a tények sehol nem változtak.
  - A `class-accounts-ts` próbájának `Object.keys(…).sort()` hívása a második pont nélkül tévesen 51 hibás elfogadást mutatott. Ez a próba hívása, nem a programé.
- `check:all` zöld.

## Korlátok

- **Csak a lefutó kód.** A rögzített próbán le nem futó ágat a tanú nem látja; ott a szöveges szabály és a generátor statikus elemzése marad.
- **A `for…in` és a spread** szöveges.
- **A program olvashatja a tanút:** például az `Object.keys === Object.keys` igaz marad, de egy Proxy-észlelő trükk elvben különbséget láthat. Rögzített fixture-ön ez nem fordul elő.

## Tervezési review (ADR-037)

- **Tulajdonos:** a tanú az orákulum futtató részében van (`reachWitness`, `execute`). A tények összeállítása a `createOracle`-ben történik.
- **Interfész:** a meglévő `judge` két olvasható mezőt kap: `reach` és `facts`. A hívók változatlanok.
- **Elrejtve:** a Proxy-csere, a hívókeret meghatározása és a felfokozott orákulum.
