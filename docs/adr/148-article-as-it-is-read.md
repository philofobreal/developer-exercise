# ADR-148 – A névelő úgy áll, ahogy a mondat hangzik: „a” vagy „az”, nem „a(z)” (NY-41)

Állapot: **elfogadva** (2026-11-14). A felhasználó jóváhagyta a lépést („jóváhagyom, mehet az NY-41”). Az [ADR-141](141-floating-help-bubble.md) a munkafelület névelőit már rendbe tette; ez a mag és a szerzői elemzés üzeneteit zárja le. Kockázati osztály: mag (üzenetszövegek) és szerzői elemzés; a validátor döntése, a szabályok és a felfedési szintek nem változtak.

## Kontextus (mérve 2026-11-14-én)

- **A mag 56, a szerzői elemzés 9 helyen írt „a(z)”-t:** az üzenet írásakor nem tudni, magánhangzóval kezdődik-e, ami következik („A(z) 4. sor…”, „a(z) „if (x) {” sort”).
- **Az [ADR-147](147-learner-rule-panel-after-a-check.md) óta ezt a tanuló is látja** mind a 16 szállított feladaton: „A(z) 4. sor a(z) 3. sor előtt kell állnia.”
- **A mondat nyelvtana is hibás volt:** a „kell állnia” részes esetet kér („A 4. sornak … kell állnia”); két üzenetváltozat alanyesetben állt.
- **Nyolc további helyen a névelő be volt égetve** egy szám elé („rögzítve a 5. helyen”, „a 1. sorban”): hat a munkafelületen, egy a szerzői elemzésben, egy a vezérlőben.

## Döntés

- **Egy szabály a magban** ([article.ts](../../src/core/article.ts)): `article(mi következik)` és `withArticle(mi következik)`. A szabály azt dönti el, hogyan hangzik, ami következik:
  - **szám:** magyar számnévként („az” az egy, öt, ötven, ötszáz, ezer és az általuk vezetett ezresek, milliók előtt);
  - **sor vagy sorlista** („5. sor”, „1., 3. sor”): az első szám szerint;
  - **kódrészlet:** az első kimondott karaktere szerint. Az idézőjel, a szóköz és az azonosító elején álló `_`, `$` nem hangzik. Az egybetűs nevet a betű magyar neve szerint olvassuk („az x”, „az n”, „a k”). A szót az első betűje szerint, kivéve az angol „ju”-nak hangzó „u”-t („a useState”, „a user”). A jelek közül csak az `=` és az `&` kezdődik magánhangzóval.
- **A „kell állnia” részes esettel áll:** „A 4. sornak a 3. sor előtt kell állnia.”
- **A szerzői elemzés két típusos modulja** (`binding-safety.ts`, `object-state.ts`) a mag szabályát használja; ez két rögzített bekötés az architektúra-szabályokban.
- **A szerzői elemzés két régi moduljának üzenete névelő nélkül áll:** „Szintaktikai hiba (12. sor): …”, „Túl mély egymásba ágyazás (1. sor): …”.
- **A munkafelület számok előtt a saját szabályát használja** (ADR-141); a beégetett névelők helyére az került. A „példa betöltve” üzenet névelő nélkül áll: „Példa betöltve: „…”.”

### Ára

- **Ez olvasási megegyezés, nem kiejtési szótár.** Egy angol szó hangozhat másként, mint ahogy az első betűje mutatja („a one”, „az hour”); ilyenkor a névelő téves lehet. A szabály a leggyakoribb eseteket fedi, és egy helyen javítható.

## Két terv („design it twice”)

1. **Minden üzenet átírása úgy, hogy ne kelljen névelő** („Sor: 4. – a 3. sor előtt kell állnia”). Elvetve: 65 mondat lenne természetellenes, és a mondat közepén álló névelőt ez sem oldja meg.
2. **Három másolat, rétegenként egy** (mag, szerzői elemzés, munkafelület). Elvetve: ugyanaz a nyelvi szabály három helyen térne el idővel.
3. **Egy meghatározás a magban, a szerzői elemzés rögzített bekötéssel használja (választott).** A munkafelület a rétegszabály miatt nem importálhat futó kódot a magból, ezért ott a számokra megmaradt a saját szabály; egy teszt tartja a kettőt lépésben.

## Tervezési review (docs/design-review.md)

- **article.ts elrejti,** hogyan olvasunk egy számot és egy kódrészletet. **Interfésze** két függvény. A hívók nem tudnak magánhangzókról.
- **Az interfész bővítésének oka (AGENTS.md):** a mag nyilvános felülete két függvénnyel nőtt; a hívók a mag három modulja és a szerzői elemzés két modulja. Rejtve marad az olvasás szabálya.
- **design, rögzítve:** két meghatározás él a számokra: a magé (`article`) és a munkafelületé (`ui-utilities.ts`, ADR-141). Oka a rétegszabály (a megjelenítés a magból csak típust importálhat). A [article.test.mjs](../../tests/article.test.mjs) 0-tól 12 000-ig és a nagyságrendi határokon összeveti a kettőt.
- **design, rögzítve:** az architektúra-szabályok két új bekötést kaptak (`binding-safety.ts`, `object-state.ts` → a mag). Ugyanaz az indok, mint a kivonatnál ([ADR-015](015-evidence-binding-and-analysis-environment.md): egy meghatározás).
- **A hibát ott szüntettem meg, ahol lehetett:** három üzenet névelő nélkül áll, így azokban nincs mit eltéveszteni.

## Bizonyíték

- **Egységteszt** ([article.test.mjs](../../tests/article.test.mjs)): 53 szám; a munkafelület szabályával való egyezés; sorok és sorlisták; 51 kódrészlet; és hogy a forrásban nem maradt „a(z)” változó vagy idézet előtt.
- **A teljes regresszió** a mag és a szerzői elemzés üzeneteit használó teszteken.
- **Nem fedi teszt:** minden egyes üzenet teljes szövege (a tesztek a jelentést hordozó részt keresik, nem a névelőt); a kódrészletek olvasása megegyezés, nem mérés.
