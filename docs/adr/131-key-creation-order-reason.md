# ADR-131 – A kulcssorrend miatti kötés valódi oka: `key-creation-order` (v57)

Állapot: **elfogadva** (2026-11-10). A felhasználó a javaslat szerint kérte. Kockázati osztály: szerzői elemzés, valamint felület és dokumentáció. Az elfogadott sorrendek nem változnak.

## Kontextus

- **A v56 ([ADR-130](130-key-order-reaches-callers.md)) után** „Számít” mellett a kulcsok létrehozási sorrendje kötött, ha a program vagy a hívó felsorolhatja őket.
- **A szabálypanel azonban más okot mutatott:**
  - két mezőnél: `class-evaluation-order` („osztálytagok ugyanabban a kiértékelési fázisban”);
  - két konstruktorírásnál és egy visszaadott objektum kulcsírásainál: `object-write-after-write`.
- **A tanár így nem tudhatta meg,** hogy a szabályt a „Nem számít” beállítás feloldja. Ez ugyanaz a hibatípus, mint a felhasználó objektumliterálos jelzése (ott „szerkezeti, nem távolítható el” állt).
- **A súgó és a beállítás szövege** még a v55-ös értelmezést írta („ha a program felsorolja a kulcsokat”).

## Döntés

- **Definíció szerinti címkézés** (`js-ts-ordering.ts`).
  - „Számít” mellett a sorrendelemzés egyszer „Nem számít” beállítással is lefut.
  - **Átcímkézés:** egy sor egy elődje `key-creation-order` okot kap, ha a „Nem számít” elemzés is ad szabályt ennek a sornak, de abban ez az előd nem szerepel.
  - **Ami változatlan marad:**
    - a szabályszintű ok (a reflektált kulcslánc, `reflected-key-order`);
    - minden ok, ha a „Nem számít” elemzés a sornak nem ad saját szabályt (ilyenkor konzervatívan nem írom át).
  - A kötés maga nem változik, csak az oka.
- **Új okkód:** `key-creation-order`, kategória `policy`: „a kulcsok létrehozási sorrendje: a program vagy a hívó felsorolhatja őket („Számít”); a „Nem számít” beállítás feloldja”.
  - Az objektumliterál kulcslánca (ADR-128) is ezt kapja; a `reflected-key-order` a nem felsorolható (prototípus-)kulcsok reflexiójáé marad.
- **Súgó és beállítás:**
  - a „Számít” szöveg megnevezi a hívót (pl. egy teszt kiírja az objektumot) és a bent maradó objektum kivételét;
  - a beállítás címkéje: „a kulcsok létrehozási sorrendje a megoldás része, a hívó felől is”.

## Két terv („design it twice”)

1. **Címke a forrásnál** (a tagelemzésben és a lábnyom-elemzésben, ahol a „felsorolható” döntés a kötést okozza). Elvetve: a lábnyomban a kulcsírás egész-objektum írássá válik, és a konfliktusból már nem derül ki, miért; két modulba kellene párhuzamos jelölést vinni.
2. **Definíció szerinti összevetés (választott).** A „csak „Számít” mellett köt” pontosan az, amit a tanárnak mondani akarunk, és minden jelenlegi és jövőbeli kulcssorrend-ok ugyanígy címkét kap.
   - Ára egy második elemzés, csak „Számít” mellett.
   - Mérve: a 436 soros TS minta 74 → 81 ms, egy 480 soros tagolt forrás 158 → 274 ms; a háttérszálon fut.

## Bizonyíték

- **[key-order-reach.test.mjs](../../tests/key-order-reach.test.mjs):**
  - a mezők, a konstruktorírások, a visszaadott objektum kulcsírásai és a kiírt literál sorai `key-creation-order` okot kapnak;
  - egy másik mezőt olvasó mező (`class-evaluation-order`) és ugyanannak a kulcsnak két írása megtartja a saját okát.
- **Okkód-bizonyíték:**
  - `key-creation-order` a `ch-multiline-object` korpuszfixtúrán: a visszaadott objektum kulcsait a hívó felsorolja, az orákulum eltérést ítél;
  - az `object-write-after-write` bizonyítéka a `keyorder-listing` fixtúráról egy valódi írásütközésre (`flow-javascript-1`) került. A régi „bizonyíték” valójában kulcssorrend-eset volt rossz okkal.
- **A 16 szállított példa:** függőségük és okaik változatlanok, csak a címke.
