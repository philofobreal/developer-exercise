# ADR-112 – Egy behúzás: a forrás, a szabálytábla és a rendező ugyanazt mutatja

Állapot: **elfogadva** (2026-11-08). Kockázati osztály: megjelenítés. A [modularitás és előbehúzás](../modularitas-es-elobehuzas.md) leírásban rögzített Beautify-prefix-javítást (`legacyIndentHints`) visszavonja.

## Kontextus

**A felhasználó jelzése:** ugyanaz a kód három nézetben háromféle behúzással látszik. A kód:

```
let r = 0,
     t = Infinity,
     i = -Infinity;
return {
     count: u, …
}
```

**Az ok: három külön döntés** (mérve, 2026-11-08):
1. **Forrás:** a formázó (TypeScript nyelvi szolgáltatás) kimenete. A modell sorai pontosan ezt a behúzást tárolják.
2. **Szabálytábla:** eldobta a sor behúzását, és a blokkok egymásba ágyazásából számolt mélységet (`depth-N`).
   - A generátor a `t = Infinity,` sort egy belső blokkhoz sorolja, ezért mélyebbre került, mint az `i = -Infinity;`.
3. **Rendező:** a tanulói elrendezésből újraszámol. Ez szándékos, mert a behúzás nem árulhatja el a helyes beágyazást. Két hibája volt:
   - a lexikai behúzó nem ismeri a folytatósort, így a `t` és az `i` a `let` szintjére került;
   - a böngészőben ráfutott a Beautify-prefix-javítás is. Ez a jelölősoros trükk miatt a visszaadott objektumliterál tulajdonságait 0-ra tette.

## Döntés

**Egy tulajdonos:** a [formatter.js](../../public/formatter.js) `formatForIDE` kivetítése rajzolja a szabálytáblát és a rendezőt is.
- **A beágyazás mélysége** az aktuális elrendezésből jön (lexikai behúzó). A referenciából semmi nem szivárog.
- **A sor saját folytatási behúzása a referenciából jön** (`referenceLayout`): ennyivel áll a formázott forrásban mélyebben, mint a beágyazása. Ez csak azt mondja meg, hogy a sor egy utasítás folytatása, amit a szövege (`t = Infinity,`) amúgy is mutat.
- **A behúzási egység is a referenciáé:** a legkisebb egyszintű behúzás (a TS-mintáknál 2, a formázott forrásnál 5). Ha a sorok nem hordoznak behúzást (a katalógusfeladatoknál), 5.
- **Eredmény:** a referenciasorrendben a kivetítés pontosan a formázott forrás; más sorrendben a beágyazás az elrendezést követi.
- **A Beautify-felülírás kimarad** (`legacyIndentHints` törölve). A Beautify-t már csak a Megoldáskód-szerkesztő kifejezett formázása használja (`formatEditor`).

**A két terv:**
1. **A lexikai behúzó tanulja meg a folytatósort (elvetve).** A „sor nem `;`-re végződik” szabály a pontosvessző nélküli kódstílusnál minden sort folytatásnak venne.
2. **A referencia mondja meg soronként a folytatást (választott).** A formázó döntése marad az egyetlen igazság, a kivetítés csak alkalmazza.

## Bizonyíték

- [indentation-single-owner.test.mjs](../../tests/indentation-single-owner.test.mjs):
  - a bejelentett eset: a referenciasorrend kivetítése azonos a formázott forrással (folytatósorok 10, tulajdonságok 10 szóköz);
  - mind a 25 TS-mintamodell a saját 2 szóközös egységével;
  - másik sorrendben a mélység az elrendezésből, a folytatás a sorból jön.
- [legacy-comparison.test.mjs](../../tests/legacy-comparison.test.mjs): átadott Beautify semmit nem változtat a kivetítésen; a visszaadott objektumliterál be van húzva.
- [browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py) `indentation_single_owner`, Node és Pages módban: a Forrás szövege, a szabálytábla sorai és a rendező sorai (referenciasorrendben) soronként azonosak.
