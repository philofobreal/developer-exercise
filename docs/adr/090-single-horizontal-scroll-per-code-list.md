# ADR-090 – Kódlistánként egy vízszintes görgetés, rögzített sorvégi vezérlők

Állapot: **elfogadva** (2026-11-04). Megjelenítési változás a felhasználó hibajelentése alapján: „ne legyenek a soroknak vízszintes scrolljai. Ez hiba, ronda és olvashatatlan.” Validátor, generátor és modell nem változik.

## Kontextus

A `.code-text` szabály minden kódsornak saját `overflow-x: auto` görgetést adott. Egy keskeny nézetben a hosszú sorok alatt soronként külön görgetősáv jelent meg, és ez a sort is takarta.
- **Mérés (900 képpont széles nézet):** a gyakorlásban 13, a szerzői próbarendezőben 10 soronkénti görgetés.
- **Érintett nézetek:** a forrás- és megoldáslista, valamint a szabálytábla. Mindhárom ugyanazt a sorstílust használja.

## Döntés ([style.css](../../public/style.css))

1. **A lista görget, nem a sor.**
   - A forrás- és a megoldáslista (`.drop-zone`), valamint a szabálytábla listája (`.board-list`) egyoszlopos rács (`grid-template-columns: auto`).
   - Minden sor legalább a saját tartalmának szélességét kéri (`min-width: max-content`), ezért az oszlop a leghosszabb sorhoz igazodik, és minden sor ugyanilyen széles.
   - A kód nem görget és nem vágódik le (`overflow: visible`).
2. **A rögzített elemek** (`position: sticky`):
   - a fogantyú és a sorszám a lista bal szélén;
   - a sorvégi vezérlők (beszúrás, fel, le, vissza, szabálygombok) a jobb szélén, a sor saját hátterével és egy árnyékkal, amely jelzi, hogy alattuk kód folytatódik.

   Görgetés közben így minden vezérlő látható és kattintható marad, a leghosszabb sor vége pedig teljesen kigörgetve az ikonok elé esik.
3. **A szabályívek** ([rule-board.ts](../../src/workbench/rule-board.ts), [view.ts](../../src/workbench/view.ts)) a vezérlők látható helyéhez igazodnak, és vízszintes görgetéskor animációs képkockánként egyszer újrarajzolódnak (`requestAnimationFrame`).

Ez a kódszerkesztők megszokott elrendezése: egyetlen vízszintes görgetés, rögzített sorszámsáv.

## Bizonyíték

- **[browser-workbench.playwright.py](../../tests/browser-workbench.playwright.py), „one horizontal scroll per code list”:** 900 képpont széles nézetben, a `class-inventory-ts` modellen, a szabálytáblán és a próbarendezőben ellenőrzi:
  - egyetlen sorbeli elemnek sincs saját görgetése;
  - a lista maga görget;
  - minden sor egyforma széles;
  - a vezérlők a görgetés mindkét végén a látható területen belül vannak.
- **Mérés a javítás után:** 0 soronkénti görgetés minden nézetben (korábban 13 és 10).
- **A teljes böngészőkészlet:** húzás, érintés, billentyűzet, szabályívek és mobilszélesség.

## Tervezési review (ADR-037)

- **Tulajdonos:** az elrendezés a stíluslapé. Az ívek horgonyát egyetlen helyen (`drawRuleArcs`) a látható vezérlőhelyből számoljuk, ezért a nézetkód nem tart párhuzamos görgetési állapotot.
- **Design twice:**
  - *Tördelés (`white-space: pre-wrap`):* elvetve. A sor egy kódsor, a tördelés a behúzást és a sorazonosságot olvashatatlanná tenné, és a sor magassága is változna.
  - *Csonkolás három ponttal:* elvetve. A tanulónak látnia kell a sor teljes szövegét.
