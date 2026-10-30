# ADR-044 – A szerzői lazítás a jóváhagyott forráshoz kötődik

Állapot: **elfogadva** (2026-10-30), felhasználói döntés alapján, az [ADR-043](043-dead-code-intent-policy.md) kiegészítéseként. Az [ADR-018](018-typed-rule-editing.md) újraszámítását és az [ADR-017](017-model-verification-gate.md) kapuját pontosítja.

## Kontextus

A tanár egy generált kényszert megerősítéssel feloldhat (lazítás), például mert a kód nem fut le. A rendszer azonban csak a sorpárt rögzítette, az indokot nem.

**A hiba:** ha a tanár később módosítja a forrást (például `a.rename('')` helyett `a.rename('c')`, így a kód már lefut), az újraszámítás a lazítást csendben újra alkalmazta (`reapplied`). A feladat így hibás sorrendet fogadhatott el. A modell `unverified` volt, de semmi nem jelezte, hogy a lazítás indoka megszűnt.

## Tervezési változatok („design it twice”)

| Mit figyelünk | Elkapja az előtte álló sor változását? | Elkapja az osztálytörzs változását? |
|---|---|---|
| a két sort | nem | nem |
| a két sort és a köztük lévőket | nem | nem |
| a tartalmazó függvényt | igen | nem |
| **a teljes forrást** | igen | igen |
| szemantikus ellenőrzést (halottkód-bizonyítás) | – | – |

A szemantikus ellenőrzés két okból esett ki: élesben kódot futtatni nem szabad, a bizonyítás pedig a B változat bonyolultsága. A választás ezért a teljes forrás ujjlenyomata.

## Döntés

1. **Ujjlenyomat:** a lazítás rekordja (`RuleRelaxation.sourceDigest`) annak a forrásnak a nem kriptografikus ujjlenyomatát őrzi, amelyre a tanár jóváhagyta (`sourceTextDigest`: a sorok szövege referencia-sorrendben, azonosítók és scope-ok nélkül). Additív, opcionális sémamező.
2. **Egyetlen döntési pont:** a `relaxationHolds` (core) mondja meg, hogy egy lazítás érvényes-e még az adott sorokra. Az újraszámítás és a kapu is ezt kérdezi.
3. **Újraszámítás** (`mergeAuthorRules`):
   - **változatlan forrás:** `reapplied`, ahogy eddig;
   - **megváltozott forrás:** `reconfirm`. A kényszer visszakerül (a szigorúbb, biztonságos állapot), a lazítás nem marad a modellben, a jelentés viszont viszi a tanár megjegyzését. Az újraerősítés ugyanaz a megerősített eltávolítás, mint először, és az új forrásra kötődik;
   - **régi, ujjlenyomat nélküli lazítás:** `unchecked`. Változatlanul újra alkalmazódik, így a régi modellek viselkedése nem változik csendben, és mostantól a forrás változását figyeli.
4. **Kapu** (`verifyAuthorModel`): a más forrásra jóváhagyott lazítás nem magyarázza a hiányzó kényszert, ezért az újralevezetés `differs`.
5. **Felület:** a minősítés panel jelentése megmondja, miért nem alkalmazta a lazítást, és mit tehet a tanár; a megjegyzés escape-elve jelenik meg.

## Következmények

- **Zaj:** bármilyen forrásváltozás újraerősítést kér, egy megjegyzés vagy egy szóköz is. A hibás elfogadás ára nagyobb egy kattintásnál.
- **Nem bizonyít semmit:** nem dönti el, hogy a kód még halott-e, csak kikényszeríti az újbóli jóváhagyást.
- **Kapcsolat a nyitott `verified-only` döntéssel:** a lazított modell `unverified`, ezért `verified-only` mellett nem szolgálható ki.

## Bizonyítékok

- **Core és szerver:** [rule-editing.test.mjs](../../tests/rule-editing.test.mjs):
  - változatlan forrás: `reapplied`;
  - a páron kívüli sor változása: `reconfirm`, a kényszer visszakerül, a megjegyzés megmarad;
  - újraerősítés: az új forrásra kötődik;
  - régi lazítás: `unchecked`, újra alkalmazva, ujjlenyomatot kap;
  - a kapu a más forrásra jóváhagyott lazításnál `differs`.
- **Felület:** [author-rule-panel.test.mjs](../../tests/author-rule-panel.test.mjs) (renderelés, escape-elés, szerveroldali rekord) és a böngészős workbench-teszt.
