# ADR-045 – A konstruktorban létrehozott kulcsok (v22)

Állapot: **elfogadva** (2026-10-30), szabályverzió `scoped-effect-analysis-v22`. A [megbízhatósági terv](../megbizhatosagi-audit-terv.md) 4. fázisának mért tétele: a nem dobó JS-objektumprogramok fő maradék oka.

## Kontextus

**A mért ok:** a v21 után a nem dobó JS-objektumprogramok 56 indokolatlan elutasításából majdnem mind objektumütközés volt két különböző mező írása között:

```js
class Box {
  constructor(label) { this.label = label; this.count = 0; }
  bump() { this.count = this.count + 1; }
}
b.label = 'x';     // egész objektum írásának számított
b.bump();          // egész objektum írásának számított
```

**Az ok:** a felsorolt kulcsokat mutató programban (ADR-029, `JSON.stringify`) egy írás csak akkor mezőszintű, ha a kulcs biztosan létezik, különben új kulcsot hozhat létre, és a kulcssorrend megváltozik. Biztosan létezőnek eddig csak az osztálymező-deklaráció és a TS paramétertulajdonság számított; a konstruktorban értékadással létrehozott kulcs nem.

**A naiv javítás hibás volt:** ha a konstruktorban értékadott kulcsot mindenhol létezőnek vesszük, akkor magában a konstruktorban is. Ott viszont az írás hozza létre a kulcsot, és a két konstruktorsor felcserélése megváltoztatja a kulcssorrendet. Ez 173 hibás elfogadást adott a mérésben.

## Döntés

1. **Létrehozott kulcs** (`ClassInfo.created`): a konstruktor törzsének legfelső szintű `this.x = …` utasítása. Feltételek:
   - a konstruktorban nincs `return` (beágyazott függvényen kívül);
   - `x` nem accessor és nem metódus;
   - feltételes, ciklusbeli, `try`-beli vagy a konstruktorból hívott metódusban történő értékadás nem számít.
2. **A konstrukció alatt nem létezik:** a hatásnyom-értelmezés követi, mely objektumok konstrukciója fut (`Frame.constructing`).
   - Ilyen a `new C(…)` konstruktorhívása és az onnan hívott metódusok.
   - Ilyen az ADR-031 szerinti konstruktortörzs-lista, ahol `this` épül.
   - Ezalatt az írás továbbra is egész objektum írásának számít.
3. **A konstrukció után:** a létrehozott kulcs írása csak az adott mező írása.
4. **Az orákulum változatlan:** ezt a P3 futásidőben, a kulcssorrenddel együtt ítéli meg; a szabály pontosítás a meglévő szerződésen belül.
5. **Szabályverzió:** v22.

## Helyességi érv

- Egy `return` nélküli konstruktor minden legfelső szintű utasítása lefut, mielőtt az objektum a konstruktoron kívül elérhető lenne. Ha közben kivétel keletkezik, az objektum nem jön létre.
- A legfelső szintű `this.x = …` (accessor nélkül) saját adattulajdonságot hoz létre vagy ír. A konstrukció után tehát `x` minden objektumban létezik.
- Létező saját adattulajdonság írása nem változtat a kulcssorrenden; a kulcs törlését (`delete`) a reflexiós szűrő eleve kizárja.

## Bizonyítékok

- **Tesztek:** [constructor-keys.test.mjs](../../tests/constructor-keys.test.mjs), mindegyik az orákulummal ellenőrizve.
  - **Szabad:** két konstruktorban létrehozott mező írása a konstrukció után; TypeScript.
  - **Kötött:** a konstruktor saját sorai továbbra is sorrendben hozzák létre a kulcsokat.
  - **Továbbra is rendezett:**
    - a konstruktorból hívott metódus által létrehozott kulcs;
    - a `return`-ös konstruktor;
    - a feltételes értékadás;
    - az accessor-értékadás.
- **Mérés (12 mag, a v21-hez képest):**
  - nem dobó JS-objektumprogramok: 56 → 3 rés (13,8% → 0,7%);
  - dobó JS-objektumprogramok: 12,4%;
  - JS-osztályok: 3,1% → 2,1%;
  - hibás elfogadás nincs.
- **Gyors baseline (újrarögzítve):** nem dobó JS-objektumprogramok 10,9% → 0%, dobó JS-objektumprogramok 19,4% → 8,8%, flow JS 21,8% → 19,2%; a többi csoport változatlan.
