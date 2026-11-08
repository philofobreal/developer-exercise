# ADR-111 – A szerzői formázó soronként egy utasítást ad, a záró kapcsos zárójelet külön sorba téve

Állapot: **elfogadva** (2026-11-08). Kockázati osztály: szerzői elemzés (a formázó a referenciaforrást alakítja át, amelyből a kódsorok lesznek).

## Kontextus

- **A felhasználó kérdése:** miért nem tördeli a Formázás az egysoros kódot és a sorvégi kapcsos zárójeleket, ahogy az eredeti ngDynamic repó javított megoldása.
- **A mai formázó** ([ts-format.mjs](../../src/author/ts-format.mjs)) a TypeScript nyelvi szolgáltatás formázóját használja. Ez csak a soron belüli szóközt és a behúzást igazítja, sort soha nem tör.
  - A `function f(){a();b();}` egy sorban marad.
  - A sorvégi `}` a helyén marad.
- **Az ngDynamic** (`src/app/components/text-field/text-field.component.ts`) a `js-beautify` 1.13-at használja 5 szóközös behúzással és `brace_style: 'collapse'` beállítással. A beállítások itt is megvannak: [legacy-beautifier.js](../../public/formatting/legacy-beautifier.js).

## Mérés: a `js-beautify` 1.13 a mai kódon

- **Szintaktikai hibát ad:** az `obj?.a?.(1)` és a `??=` sorokra bontása után.
- **A TS-osztálymezőt és a metódust egy sorban hagyja:** `private x = []; get() {`.
- **Két sorra töri a generikus nyílfüggvényt:** `<T,>`.

## Döntés

**Az ngDynamic viselkedését vesszük át, nem a könyvtárát.**

- **Sortörés:** a sortörést a TypeScript szintaxisfája végzi (`breakLines`). Új sort ott kezd, ahol a feldolgozó már elválasztott két listaelemet, és azok egy sorban állnak:
  - utasítások (fájl, blokk, modul, `case`-ág);
  - `case`-ágak;
  - osztály-, interfész- és enumtagok;
  - a blokk záró `}`-je, ha az utolsó elem sorában áll.
- **A `} else {` együtt marad.** Utána a mostani nyelvi szolgáltatás húz be, 5 szóközzel.
- **Sosem tör egy utasításon vagy kifejezésen belül**, így az automatikus pontosvessző-beszúrás (ASI) nem változtathat a jelentésen.
- **Szintaxis-őr:** a formázás előtti és utáni szintaxisfa csomópontjai és tokenjei azonosak kell legyenek (`syntaxSignature`, pozíciók és köztes szóközök nélkül).
  - Ha a sortörés megváltoztatná a fát, a sortörés elmarad.
  - Ha a végeredmény változtatná meg, a formázás hibával áll meg („A formázás megváltoztatná a kód szerkezetét…”).
- **Tudatos eltérés az ngDynamictól:** az objektum- és tömbliterálokat nem bontjuk tulajdonságonként sorokra. A kódsor-modell (v2) a többsoros kifejezéseket nem kezeli; ez a v3 egységmodell külön epicje.

### A két terv („design it twice”)

1. **`js-beautify` + javítás + szintaxis-őr (elvetve).** Hű az ngDynamichoz, de a 2020-as könyvtár a mai szintaxis egy részét elrontja: az őr ezeket elutasítaná, és a formázó ott semmit nem tenne. A TS-tagokat külön kellene tördelni.
2. **Szintaxisfa alapú sortörés + a meglévő behúzás (választott).** Minden támogatott szintaxist ismer, és egy helyen dönt a sorhatárról. A szerveren és a Pages-en ugyanaz a modul fut, új függőség nélkül.

## Bizonyíték

[format-line-breaks.test.mjs](../../tests/format-line-breaks.test.mjs):
- az egysoros függvény és a sorvégi zárójelek sorokra bomlanak;
- `?.`, `??=`, `switch`, TS-osztály, interfész és enum: elemenként egy sor;
- `<T,>` egyben marad;
- az objektumliterál, a sablonszöveg, a reguláris kifejezés és a megjegyzések a helyükön maradnak;
- kétszer formázva nem változik;
- `b\n(c)` egy hívás marad, nem kerül elé sortörés.
