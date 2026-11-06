# ADR-103 – Szerzői forrás és kódnézet: három befogadási hiba javítása

Állapot: **elfogadva** (2026-11-06). A felhasználó kérte, hogy a dizájnmunka előtt vizsgáljuk át az elemzőt, a kódsor-generátort és a validátort, és ütemezzük a talált hibák javítását. Kockázati osztály: szerzői elemzés (befogadás) és megjelenítés (próbálkozás). A generált szabályok nem változnak, ezért szabályverzió-váltás nincs.

## Kontextus

Célzott próbák a szerzői úton és a próbálkozás kódnézetén (a validátorban nem találtunk hibát: 400 soros modellen helyes verdikt 33–46 ms alatt, a v52 kampány 0 hibás elfogadással):

1. **Mély beágyazás:**
   - TypeScript-forrásnál 1 000 mélységű tömbliterál, 2 000 mélységű zárójelezés vagy egy 10 000 tagú összeadás a rekurzív parsert veremtúlcsordulásba vitte (`RangeError`). A szerver erre azt válaszolta: „nem elérhető TypeScript parser”.
   - JavaScriptnél az Acorn kulturáltan hibát dobott, de „Szintaktikai hiba”-ként, ami félrevezető.
   - A típusellenőrzés ideje a mélységgel meredeken nő: 500 mélység 1,9 s, 600 mélység 3,1 s egy 1,2 KB-os forráson (ADR-102 utáni vizsgálat, `docs/investigations`, helyi).
2. **BOM:** a forrás elején álló bájtsorrend-jel (U+FEFF) az első sor tartalmába került. Kódnézetben begépelve ez a sor nem illeszthető.
3. **Kódnézet:** egy `indent` normalizálású sor végén álló szóköz, vagy a webről másolt kódban gyakori nem törő szóközös (U+00A0) behúzás miatt a sor „nem engedélyezett” lett (`unknown_content`).

## Döntés

1. **Lexikális beágyazási korlát a szerzői JS/TS forrásra** ([source-nesting.ts](../../src/author/source-nesting.ts), `nestingExcess`, `MAX_NESTING = 64`, ugyanaz, mint a Python-auditban):
   - a fordító lineáris szkennerével mér, minden parse előtt;
   - a `(`, `[`, `{` és a `${…}` számít;
   - a sztring, a megjegyzés, a reguláris kifejezés és a template szövege nem;
   - a korlátot átlépve leáll, így a költség a hibáig lineáris;
   - üzenet: „Túl mély egymásba ágyazás a(z) N. sorban: legfeljebb 64 szint…”.

   A repó 482 forrásának legnagyobb mélysége 5.
2. **Veremvédelem:**
   - a parse és az egész generálás `RangeError`-ja szerzői hiba lesz: „A forrás egy kifejezése túl hosszú vagy túl összetett…”;
   - az Acorn veremhibája ugyanezt az üzenetet kapja, nem szintaktikai hibát.
3. **BOM:** a generátor és a nyelvi motor a forrás normalizálásakor eltávolítja a kezdő U+FEFF-et.
4. **Kódnézet** ([attempt.ts](../../src/workbench/attempt.ts), `sameRow`):
   - egy `indent` sor illesztésekor a sorvégi szóköz és tabulátor, valamint a vezető U+00A0 és U+FEFF behúzás nem számít;
   - az `exact` sor (többsoros literál belseje) változatlanul pontos;
   - az illesztett sor a referencia saját szövegével kerül beküldésre, így az értékelés és a mag (`contentKey`) változatlan.

## Bizonyíték

[source-admission.test.mjs](../../tests/source-admission.test.mjs):
- a szkenner a literálok, a megjegyzések és a reguláris kifejezések zárójeleit nem számolja;
- a repó minden forrása 16 szinten belül marad;
- a túl mély és túl hosszú forrást mindkét nyelven szerzői hiba utasítja el, `RangeError` soha nem jut ki;
- a BOM nincs az első sorban;
- a kódnézet a sorvégi és az NBSP-s whitespace-t tűri, az `exact` sor pontos marad;
- HTTP: a túl mély forrás érthető 400-as választ kap.

A Pages-artifact a `languages.mjs` új típusos importját is átírja (`scripts/build-pages.mjs`); ezt a böngészős mátrix (`real Pages HTTP subpath`) fogta meg, a Node-tesztek nem. A teljes `test:browser:all` zöld, az axe 0 hibával.

## Tervezési review (ADR-037)

- **Tulajdonos:**
  - a beágyazási korlát egy kis, típusos modul, egy függvénnyel; a régi `languages.mjs` csak meghívja (ADR-001 szerinti bekötés, felvéve az architektúra-kapu `typedAuthorWiring` listájára);
  - a sorillesztés tűrése a próbálkozásé, amely a sorok elrendezését birtokolja; a tartalomegyezés szabálya a magban marad.
- **Design twice:**
  - *Csak a `RangeError` elkapása:* elvetve önmagában. A parser elszállását kezelné, de a mély beágyazás típusellenőrzési idejét nem.
  - *A mag `contentKey`-jének bővítése a sorvégi whitespace-re:* elvetve. A magot minden értékelési út használja, a tűrés viszont csak a gépelt szöveg illesztésének kérdése.
