# ADR-107 – Fókusz mód mint szerkesztőablak, állítható elválasztó és külön nyíló szabálypanel

Állapot: **elfogadva** (2026-11-07). Kockázati osztály: megjelenítés. Az ADR-106 Fókusz módját alakítja át.

## Kontextus

A felhasználó kérései a Fókusz módhoz:
1. Úgy töltse ki a képernyőt, mint egy kódszerkesztő (például VS Code) forrásnézete.
2. A két lista szélessége egymás rovására állítható legyen.
3. Teljes képernyőn ne legyen függőleges görgetés. Ami lenyílik, a kódnézettel együtt, reszponzívan alkalmazkodjon.
4. A szerzői szabálypanel ne nyíljon meg magától, valahányszor egy sor szabály-ikonját kijelöljük. Külön gomb nyissa, és ennek helye, valamint a panel megjelenése kövesse a bevett ipari gyakorlatot.

Az ADR-106 Fókusz módja rögzített magasságokkal számolt (`100dvh − N px`). Ha valami lenyílt (szabálypanel, részletes magyarázat), a munkaterület görgetni kezdett. A szabálypanel a listák alatt mindig megjelent, egy sor kijelölésekor tartalommal.

## Döntés

1. **Szerkesztőablak-elrendezés** (csak Fókusz módban):
   - **Felépítés:** a munkaterület egyetlen, képernyőmagas rugalmas oszlop.
     - Saját magasságot vesz fel: a címsor, az eszközsor, az összekötési útmutató, az Ellenőrzés-sáv és a modell-üzenet (egy sorra rövidítve).
     - A maradékot kitölti: a két lista vagy a Megoldáskód szerkesztő.
   - **Görgetés:** a listák és a szerkesztő belül görgetnek. Ami lenyílik (technikai részletek, részletes magyarázat, soronkénti megfeleltetés), legfeljebb a képernyő negyedét veszi el, és belül görget. Így a kódnézet zsugorodik, az oldal soha nem görget.
   - **Telefonon:** a két lista egymás alatt, egyenlő magassággal osztozik.
2. **Elválasztó** ([pane-split.ts](../../src/workbench/pane-split.ts)):
   - **Hely:** a két lista között egy 12 px-es, egérrel és érintéssel húzható sáv. Egy vékony vonal jelzi, hoverre, fókuszra és húzás közben a kiemelő kékkel kiszélesedik.
   - **Működés:** a forráslista arányát állítja 20 és 80 % között; amennyivel az egyik szélesebb, annyival keskenyebb a másik.
   - **Billentyűzet:** `role="separator"`, értékkel. A nyilak 2 %-ot léptetnek, a Home és az End a széleket adja.
   - **Tárolás:** gyökér CSS-változó (`--split`), a böngésző megjegyzi (`ngdynamic.pane-split.v1`).
   - **Hatókör:** Fókusz módon kívül, széles képernyőn is működik; telefonon (egy oszlop) nincs elválasztó.
3. **Szabálypanel** (a VS Code másodlagos oldalsávja, illetve a tervezőeszközök tulajdonságpanelje mintájára):
   - **Sorkijelölés:** a sor láncszem ikonja csak kijelöl (sorkiemelés és ívek), a panelt nem nyitja meg.
   - **Nyitó gomb:** „Szabályok” felirattal az eszközsor jobb oldalán, a Fókusz gomb mellett, `aria-pressed`, `aria-expanded` és `aria-controls` attribútummal. Csak a szerző saját előnézetében látszik.
   - **Széles képernyőn (1100 px felett):** dokkolt jobb oldali oszlop a listák mellett.
     - Felül a fejléc (cím és bezáró ×), alatta a jelmagyarázat és „a minden szabály rajzolása” kapcsoló, majd a kijelölt sor szabályai.
     - Saját görgetése van; Fókusz módban a munkaterület teljes magasságát kapja.
   - **Keskeny képernyőn:** jobbról becsúszó, nem modális lap.
   - **Fókusz és bezárás:** nyitáskor a fókusz a panel bezáró gombjára kerül. Escape vagy a × bezárja, és a fókusz visszakerül a nyitó gombra.
   - **Kivétel:** a hibás sorrend okánál lévő „szabály megnyitása” gomb kifejezett megnyitási kérés, ezért kinyitja a panelt.
   - **Ami a panelen kívül marad:** az összekötés útmutatója a listák fölött marad, mert a sorokon végzett műveletről szól.
   - **Ami a panelen belül rejtett:** a panel saját, a kijelölést megszüntető „Bezárás” gombja. A kijelölést a sor láncszeme ugyanúgy megszünteti, a panelt pedig a ×.

## Bizonyíték

- **`browser-workbench`, „pane separator and full-screen focus without scroll”:**
  - húzás és billentyűzet: nyilak, Home, End;
  - újratöltés után is ugyanaz az arány és szélesség;
  - Fókusz módban nyitott szabálypanellel, ellenőrzés után és nyitott technikai részletekkel az oldal és a munkaterület görgetése 0; a Megoldáskód nézetben is 0.
- **`try_rules`:**
  - a láncszem kijelöl, de panelt nem nyit;
  - a gomb nyit, és a fókusz a panelre kerül;
  - Escape-re a panel bezárul, és a fókusz visszakerül a gombra.
- **A meglévő szabályszerkesztési esetek** (összekötés, rögzítés, a hiba okából nyitás) a gombbal nyitott panelen futnak.
- **Mérés:** 1440 × 900-on és 1280 × 720-on a Fókusz mód görgetés nélküli. Ellenőrzés után a listák 672 → 578 px-re, illetve 492 → 398 px-re zsugorodnak, a lap nem görget. iPhone 13-on is 0 a görgetés.

## Tervezési review (ADR-037)

- **Tulajdonos:**
  - az arány tudása (határok, tárolás, mutató és billentyűzet) a `pane-split.ts`-ben van;
  - a panel nyitottsága egy állapotmező (`rulePanelOpen`), amelyet csak a nézet olvas, és csak a gombok és az Escape írnak;
  - az elrendezést a stíluslap birtokolja.
- **Design twice:**
  - *Rögzített magasságok számolása:* elvetve. Minden lenyíló elem új számot kívánna, a rugalmas oszlop magától alkalmazkodik.
  - *A szabálypanel modális ablakban:* elvetve. Szabályszerkesztés közben a sorokat látni kell; a dokkolt panel mellettük marad.
  - *A panel nyitása a sor dupla kattintására:* elvetve. Rejtett gesztus, billentyűzettel nem felfedezhető.
