# ADR-032 – Ismert értékek: konstans argumentummal soha nem dobó ellenőrzés (v16)

Állapot: implementálva (2026-10-29). Policyverzió: `scoped-effect-analysis-v16`. Az [ADR-028](028-runtime-precise-object-footprints.md) dobáselemzését teszi értékérzékennyé. A validátor, a séma és a tanulói értékelés változatlan.

## Kontextus

Az ADR-028-ban rögzített rés: egy `if (!id) throw …` ellenőrzés akkor is lehetséges dobásnak számított, ha az argumentum literál, és az ellenőrzés vele soha nem teljesül. Két ilyen konstrukció (`new User("u1")`, `new User("u2")`) emiatt sorrendhez kötött volt, pedig futásidőben egyik sem dob.

## Döntés

### 1. Ismert érték

Az absztrakt érték egy `known` mezőt kap: azt az egyetlen primitívet, amely az érték biztosan. Ismert értéket ezek adnak:

- string-, szám- és template-literál, `true`, `false`, `null`, a globális `undefined`;
- egy hiányzó argumentum (`undefined`);
- az alábbi műveletek, ha minden bemenetük ismert:
  - `!`, egyoperandusú `-`, `typeof`;
  - `===`, `!==`;
  - `<`, `<=`, `>`, `>=` két számon vagy két stringen;
  - `+` (összeadás vagy összefűzés), `-`, `*`, `/`, `%` számokon;
  - `.length` ismert stringen;
  - template ismert részekből.

**Ezek a műveletek primitíveken kódot nem futtatnak**, ezért a kiértékelésük biztonságos.

**Továbbadás:**

- az ismert argumentum a konstruktor-, metódus- és accessortörzsek paramétereibe ismert értékként érkezik;
- az unió csak akkor ismert, ha minden tagja ugyanaz az érték;
- egy mező értéke az objektumra írt összes érték uniója (folyamatérzéketlen), ezért két különböző írás után ismeretlen.

### 2. Kiválasztott ág

Ha egy `if` feltétele ismert, csak a kiválasztott ág fut. A másik ág dobása, írása és olvasása nem számít. Ugyanígy:

- a feltételes kifejezésben (`c ? a : b`) csak a kiválasztott oldal;
- a rövidzárnál (`&&`, `||`, `??`) a jobb oldal csak akkor számít, ha ténylegesen lefut.

**A határ:** ismeretlen érték mellett (paraméterből érkező, összevont mezőérték, ismeretlen forrás) mindkét ág számít, ahogy eddig. Egy mindig teljesülő ellenőrzés (`new Account('')`) továbbra is lehetséges dobás.

## Független orákulum

A saját objektumokon dolgozó `if/else` feltétele mostantól bármely „érték” (ADR-031) lehet, nem csak `===`/`!==` összevetés. A sorrendről így is a futásidejű P3 dönt.

## Következmények

- A konstans argumentummal soha nem dobó konstruktorok és metódushívások egymáshoz képest szabadok.
- **Ismert, dokumentált veszteség:** az objektumonként összevont mezőérték miatt egy ellenőrzés akkor is lehetséges dobás marad, ha futásidőben a ténylegesen olvasott érték mellett nem dob (`value-guards-merged`).
- A TS-mintatár modelljeiben csak a címke változott.

## Bizonyíték

[value-guards.test.mjs](../../tests/value-guards.test.mjs) és négy új fixture. Az objektumhatás-csomag minden elfogadott egysoros mozgatást a futásidejű orákulummal ellenőriz.

**Lefedett esetek:**

- soha nem dobó ellenőrzés: `!id`, `limit < 0 || id.length > 8`, `value === '' && …`, template argumentum;
- mindig dobó ellenőrzés (`''`, `0`);
- ismeretlen paraméter;
- összevont mezőérték.
