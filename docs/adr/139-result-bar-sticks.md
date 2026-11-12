# ADR-139 – Az értékelősáv minden szélességen ragad

Állapot: **elfogadva** (2026-11-11). A felhasználó kérése: „a gyakorló nézetben is a lábléc hasonlóan ragadós legyen, mint a feladat készítése nézetben”. Kockázati osztály: megjelenítés.

## Kontextus

- **A lépések műveletsávja** (`.action-bar`, [ADR-123](123-steps-reassigned-and-one-skeleton.md)) minden szélességen a képernyő aljára ragad.
- **Az értékelősáv** (`.evaluation-bar`: az ítélet és az Ellenőrzés gomb a gyakorlásban és a szerzői Próba lépésben) csak 650 px alatt ragadt. Asztalon a dokumentum végén állt, és egy hosszabb feladatnál kigördült a képből ([ADR-127](127-one-progress-indicator.md) is rögzítette: „asztalon az értékelősáv nem ragad”).
- Mérve 1280×640-en a gyakorlásban a sáv alja 733 px volt a 640-ből.

## Döntés

- **Az értékelősáv minden szélességen a képernyő aljára ragad** (`position: sticky; bottom: 0`), a műveletsávval azonos módon. Rétege 15, a műveletsávé 14, a súgóbuboréké 13.
- **Egy ragadós elem nem lépi túl a tárolóját.** Ha a lépés a képernyő alja előtt véget ér, a sáv a saját helyén áll; így is mindig a képernyőn van.
- **A listák a ragadós sáv fölött végződnek:** a magasságuk képlete 380 helyett 400 px-et hagy a lap többi részének. Mérve 1500×1000-en egy két sorba törő leírásnál a lista alja 17 px-szel a sáv alá került volna; a lista alsó, automatikus görgetési sávja (27 px) így részben elérhetetlen lett volna húzás közben.
- **Asztalon nincs alsó görgetési margó** (`scroll-padding-bottom`). Kipróbáltam: a ragadós sávban álló gomb fókuszkor mindig a margóba esik, így a böngésző az oldal végére görgetett (225 px ugrás), a listák belső görgetésén pedig nem segít. A telefon korábbi beállítása (150 px) változatlan.
- **Rögzített maradék:** háromsoros vagy hosszabb leírásnál és alacsony képernyőn (a lista legalább 320 px magas) a lista alja a sáv alá kerülhet, amíg az oldalt nem görgetik; ez telefonon is így van. Egy mért magasság (mint a fejlécé, ADR-137) megszüntetné, de a fókusz módot, a panelosztót és a fekvő telefont is kezelnie kellene.
- **A telefonos szabályok változatlanok:** legfeljebb 40% magas, görgethető, felső árnyék. A fókusz mód saját elrendezése (statikus sáv) szintén.

## Bizonyíték

- **Mérés:** 1280×640-en, 1440×760-on és 390×700-on, gyakorlásban, ellenőrzés előtt és után a sáv alja a képernyő alja (640, 760 és 700 px).
- **Böngészős teszt** (`result_bar_sticks`; gyakorlás és szerzői Próba lépés; két asztali méret és telefon): az oldal tetején a sáv a képernyőn van.
  - Mutációs próba: a ragadás nélkül 1280 px-en a sáv kilóg a képből, és a teszt elbukik.
- **A drag-tesztsor** a látható rész alját a ragadós sáv tetejénél számolja. Az első teljes futásban egy 29 soros feladatnál a sáv alá eső sorra ejtett, és ezzel tárta fel az átfedést.
- **A mátrix-tesztsor görgetésmegőrzési esete** a görgetés után ténylegesen látható sort választja. Eddig becsülte az indexet, és a 20 px-szel alacsonyabb listán a becsült sor 3 px-szel kilógott, így a kattintás előtt a teszt maga görgetett; az alkalmazás nem mozdít (JavaScript-kattintással ellenőrizve).
