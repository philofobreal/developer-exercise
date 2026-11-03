# ADR-055 – Feladatszintű kulcssorrend-beállítás (v29)

Állapot: **elfogadva** (2026-11-02), szabályverzió `scoped-effect-analysis-v29`. A felhasználó döntése (pedagógiai szabály): „lehessen beállítani, hogy ne húzza be ezeket a sorfüggőségeket … úgy, hogy ne kelljen kézzel megszüntetgetni”. Kiegészíti az [ADR-020](020-unobserved-key-order.md), [ADR-029](029-unobserved-instance-field-order.md), [ADR-052](052-unspelled-property-names.md) és [ADR-053](053-folded-names-and-returns.md) megfigyelési szabályait.

## Kontextus

Ha egy program felsorolja vagy szerializálja a kulcsokat (`Object.keys`, `JSON.stringify`, `Object.entries`, `for…in`, `getOwnPropertyNames`), akkor a mezők, metódusok és kulcsok létrehozási sorrendje látszik a kimenetben. A generátor ezért ezeket a sorokat sorrendhez köti. Ez helyes, de sok feladatban a tanár szerint a kulcsok sorrendje nem a tananyag része. Eddig ilyenkor minden ilyen szabályt egyenként, policy-felülírással kellett eltávolítani, és a modell ezzel „Nem igazolt” minősítést kapott.

**Ipari gyakorlat:**
- **Tesztkeretrendszerek:** az objektumok mély összehasonlítása a kulcsok sorrendjét nem nézi (Jest `toEqual`, Node `assert.deepStrictEqual`).
- **JSON:** a JSON-objektum a szabvány szerint rendezetlen (RFC 8259).
- **Szigorú összevetés:** ahol a sorrend mégis számít (pillanatkép-teszt, szövegszintű kimenet-összevetés), azt külön választják.

## Döntés

1. **Beállítás** (`keyOrder`), a szerző választja feladatonként, a Forrás lépésben („Objektumkulcsok sorrendje”):
   - **`observed` – „Számít” (alapértelmezett):** a szabályok változatlanok.
   - **`ignored` – „Nem számít”:** a kulcsok létrehozási sorrendje nem része a feladat eredményének. A generátor a kulcslistázó programban sem köti a kulcsokat létrehozó sorokat egymáshoz (az ADR-020, -029, -052 és -053 megfigyelési feltétele kikapcsol). A kulcsok **megléte** és az **értékek** továbbra is kötnek: például az `Object.keys(o).length` a később létrejövő kulccsal szemben kötött marad.
2. **Rögzítés:** a modell `authoring.evidence.environment.keyOrder` mezője rögzíti (additív sémamező). A modellminősítés és a „Sorfüggőségek újraszámítása” ezzel generál újra; a mező kézi törlése kézi módosításként jelenik meg.
3. **Láthatóság:** a Szabályok lépés a modell elemzési beállításait (bemenetek, kulcssorrend) egy sorban mutatja.
4. **Minősítés:** a beállítással készült modell „Elemzéssel igazolt” marad, mert a szabályai a kimondott megfigyelési szerződéshez képest bizonyítottak, nem kivételek.

## Független orákulum

Az orákulum ugyanezt a politikát saját kóddal valósítja meg. `keyOrder: 'ignored'` esetén:

- a futtatás előtt az `Object.keys`, `Object.values`, `Object.entries`, `Object.getOwnPropertyNames`, `Reflect.ownKeys` és a `JSON.stringify` kanonikus sorrendet ad (tömbindexek növekvően, majd a nevek rendezve, majd a szimbólumok), így a létrehozási sorrend futásidőben sem figyelhető meg;
- a P4 halmazként hasonlít.

**Korlát (feloldva, [ADR-062](062-oracle-environments-and-for-in.md)):** a `for…in` bejárási sorrendjét az orákulum eredetileg nem normalizálta, ezért ilyen programban a mérés szigorúbb volt a politikánál. Most a `for…in` is kanonikus sorrendben jár.

## Pedagógiai határ

„Nem számít” mellett az a program is szabad sorrendet kap, amely a kulcsok sorrendjéből *számol*, például az első kulcsot használja. Ez a beállítás kimondott jelentése, és a felület súgószövege figyelmeztet rá.

## Bizonyíték

- **Tesztek** ([key-order-setting.test.mjs](../../tests/key-order-setting.test.mjs)):
  - kulcslistázó program: „Számít” mellett elutasít, „Nem számít” mellett elfogad, az orákulum mindkettőt megerősíti;
  - `JSON.stringify`: szabad; a kulcsok száma és a mezőérték olvasása kötött marad;
  - a bizonyíték, a minősítés (a mező törlése eltérést ad), a frissítés, az ismeretlen érték elutasítása;
  - a felület kérése és visszatöltése.
- **Korpusz:** hat dedikált fixture (`origin: 'key-order'`), JS és TS, hibás elfogadás nélkül.
  - Felszabaduló sorrendek: JSON 0 → 5, TS-mezők 1 → 6, a kulcslistázó osztály 3 → 4 szomszédos sorrend.
  - A kulcsszámláló program helyesen kötött marad.
  - Az `Object.entries(totals)` fixture 3 rése nem kulcssorrend-ügy: az objektum a hívásba szivárog (a nyitott 2d korlát).
- **Generatív kampány** (12 mag, mindkét beállítás): lásd a CHANGELOG-ot és a commitot.
- **Böngésző:** a „Nem számít” beállítással a felcserélt kulcsírás kézi szabálytörlés nélkül „Elfogadva”.
