# ADR-062 – Környezetváltozatok és kanonikus `for…in` az orákulumban

Állapot: **elfogadva** (2026-11-03). Orákulum és mérés, az 5. fázis 2. tétele ([megbízhatósági terv](../megbizhatosagi-audit-terv.md)), és az [ADR-055](055-key-order-setting.md) nyitott korlátja. A generátor és a validátor változatlan.

## Kontextus

- **Egyetlen futtatási környezet:** az orákulum a fixture-t eddig csak a szerződés alapkörnyezetében futtatta: strict szkript, TypeScriptnél ES2022, mindkét osztálymező-mód. A [formális szerződés](../formal-ordering-contract.md) szerint a generátor más `target` mellett is konzervatív, ezt azonban semmi nem mérte. Böngészőben a klasszikus szkript alapból sloppy módban fut.
- **A `for…in` sorrendje:** „Nem számít” kulcssorrend mellett (ADR-055) az orákulum minden kulcslistázó függvényt kanonikus sorrendre állított, de a `for…in` bejárást nem. Egy ilyen program felcserélt kulcsírása a generátor szerint szabad, az orákulum szerint eltérő volt.

## Döntés

1. **Környezetváltozatok** (`environments`, fixture-mező, kampányban `--environments`):
   - **`strict`:** az eddigi alapkörnyezet;
   - **`es2015`:** a program ES2015-re fordított kódja, mindkét osztálymező-módban, JS-nél és TS-nél is;
   - **`sloppy`:** strict mód nélkül, de csak ott, ahol a referencia sloppy módban ugyanazt adja, mint strict módban. A szerződés strict szkriptet ígér, ezért ahol a program a szigorúságtól függ, ott ez a változat nem releváns.

   Egy változat akkor számít, ha a referencia hiba nélkül fut benne. A jelöltnek minden számító változatban egyeznie kell (`judge.environments`). Alapból csak a `strict` fut; a változatok a teljesebb méréshez kapcsolhatók be, mert az időigényük többszörös.
2. **Kanonikus `for…in`:** „Nem számít” mellett a futtatott kódban minden `for (… in o)` `for (… of __forIn(o))` lesz. A `__forIn` ugyanazokat a kulcsokat adja, mint a `for…in`: felsorolható, szöveges kulcsok, előbb a sajátok, majd prototípusonként. Minden szinten kanonikus sorrendben. A kulcsokat a ciklus elején veszi, így a ciklus közben hozzáadott vagy törölt kulcsot nem követi; ezt a sorrendet a szabvány sem rögzíti.

## Bizonyíték

- **[oracle-environments.test.mjs](../../tests/oracle-environments.test.mjs):**
  - `for…in` kulcsgyűjtés: „Számít” mellett a csere elutasított és eltérő, „Nem számít” mellett elfogadott és egyenértékű;
  - az örökölt kulcsok a sajátok után jönnek;
  - a szigorúságtól függő program sloppy változata kimarad;
  - hat korpuszfixture és egy kampánymag mindhárom változatban 0 hibás elfogadással.
- **A teljes korpusz (109 fixture) mindhárom változatban:**
  - mindegyiknél mindhárom változat számít;
  - 0 hibás elfogadás;
  - a rések száma változatlan (41).
- **Kampány, 3 mag, minden fajta, mindhárom változat:** 0 hibás elfogadás.

## Korlátok

- **A változatok nem alapértelmezettek** a `check:all`-ban, csak a dedikált tesztekben és a kapcsolóval futó kampányban.
- **A sloppy változat** csak a szigorúságtól független programokra mér.
- **A ciklus közben változó kulcskészlet** a `__forIn`-nel nem követett.
