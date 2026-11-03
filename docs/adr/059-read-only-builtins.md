# ADR-059 – Csak olvasó beépített hívás saját objektumon (v30)

Állapot: **elfogadva** (2026-11-03), szabályverzió `scoped-effect-analysis-v30`. A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 4. fázisának 2d tétele. Kiegészíti az [ADR-025](025-local-object-effect-footprints.md) saját objektumos hatáselemzését.

## Kontextus

Az objektumhatás-elemzés minden saját objektumot szivárgónak vett, amely olyan hívásba került, amelyet nem modellez. Ilyen volt az `Object.entries(totals)` is. A szivárgó objektum minden művelete sorompó lett.

**Példa** a `keyorder-entries` korpuszfixture-ből: „Nem számít” kulcssorrend mellett is kötött maradt a `totals.apple = 3` és a `totals.pear = 5` sorrendje, holott az orákulum szerint szabadok (3 mért rés).

A tanár szempontjából ez a leggyakoribb minta: egy összesítő objektumot feltöltünk, majd kilistázzuk.

## Döntés

1. **Modellezett hívások:** az `Object.keys`, `Object.values`, `Object.entries` és `JSON.stringify` hívás, egyetlen argumentummal, ha az argumentum saját objektum vagy tömb. A hívás nem szivárgás, hanem az objektum egészének olvasása. A név a globális objektumé kell legyen: ha a program deklarálja vagy helyi név árnyékolja, nem modellezett.
2. **`Object.keys`, `values`, `entries`:**
   - nem futtatnak programkódot, mert az osztály accessorai a prototípuson vannak, a hívás pedig csak a saját kulcsokat olvassa;
   - saját objektumon nem dobnak;
   - az eredmény friss tömb: a kulcsok szövegek, az értékek a mezőértékek (a tárolt saját objektumokkal együtt), a párok friss tömbök.
3. **`JSON.stringify`:** minden elért objektumot egészében olvas, és dobhat (BigInt, körkörösség). Ha egy elért objektumnak `toJSON` mezője vagy metódusa van, vagy egy értéke ismeretlen objektum, a hívás nem modellezett.
4. **Páros bontás:** a `for (const [név, érték] of …)` saját tömbök saját tömbjein modellezett; minden név a belső tömbök bármely eleme lehet.
5. **A kulcssorrend változatlan:** felsoroló programban a kulcsot létrehozó írás továbbra is egész objektumos írás (ADR-029), ezért „Számít” mellett kötött. „Nem számít” mellett (ADR-055) a mezőnkénti írások szabadok, a felsorolás előtti helyük viszont kötött marad.

## Helyesség

- **A modellezett hívás olvasása** minden mezőt fed, ezért ütközik az objektum minden írásával.
- **A tárolt saját objektumok** az eredménytömb elemeiként követve maradnak: egy későbbi írásuk a felsorolás után kötött.
- **A listaszintű `const x = Object.values(o)`** továbbra sem modellezett (ismeretlen kezdőérték), ezért az eredmény nem juthat követetlenül ismeretlen kódhoz.

## Bizonyíték

- **Új tesztek** ([readonly-builtins.test.mjs](../../tests/readonly-builtins.test.mjs)):
  - `entries`: „Nem számít” mellett szabad, „Számít” mellett kötött; a felsorolás utánra tett írás elutasított, és az orákulum szerint is eltér;
  - `values`: a tárolt objektum későbbi írása kötött;
  - `JSON.stringify`: a felsorolás utáni írás kötött; két kulcsírás „Nem számít” mellett szabad, `toJSON` mezővel kötött;
  - árnyékolt `Object`: kötött.
  - Mindegyiknél 0 hibás elfogadás a korpuszméréssel.
- **Korpusz:** a `keyorder-entries` 3 rése megszűnt (4 → 7 elfogadott szomszéd). A többi 108 fixture rögzített száma változatlan.
- **Generatív alapérték:** csak a címke változott, mert a véletlen programok nem használják ezeket a hívásokat.

## Korlátok

- **Nem modellezett:** az `Object.assign` (az elemzés egésze kikapcsol rá), a spread és a `structuredClone`.
- **A `class-accounts-ts` résén** ez nem segít: ott öröklő osztály van, amelyet az elemzés nem modellez (ADR-025).

## Tervezési review (ADR-037)

- **Tulajdonos:** az objektumhatás-elemző (`object-footprints.ts`), egy új belső függvény (`readingBuiltin`). Az interfész nem változott.
- **Elrejtve:** a beépített nevek listája és a hívások modellje.
- **Rögzített megállapítás:** a modul 700 sor körüli, és egyetlen nagy closure. Ez a terv nyitott tervezési adóssága; a mostani változás nem rontotta a szerkezetét.
